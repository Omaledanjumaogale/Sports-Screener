import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveAccess, markSubscribed, registerProfile } from '../../convex/users';
import { activateSession } from '../../convex/testerCodes';
import { consumeResetTokens } from '../../convex/email';
import { verifiedPayment, validWebhookSignature } from '../../convex/paymentValidation';

function database(tables: Record<string, any[]> = {}) {
  const db: any = { patch: vi.fn(async()=>{}), insert: vi.fn(async()=> 'new-row'), delete: vi.fn(async()=>{}), get: vi.fn(async()=>null) };
  db.query=(table:string)=>{
    const filters: Array<[string,unknown]>=[];
    const result:any={ withIndex: (_name:string, callback?:any)=>{const builder:any={eq:(key:string,value:unknown)=>{filters.push([key,value]);return builder;}};callback?.(builder);return result;},first:async()=> (tables[table]??[]).find(row=>filters.every(([key,value])=>row[key]===value))??null, collect:async()=> (tables[table]??[]).filter(row=>filters.every(([key,value])=>row[key]===value)) };
    return result;
  };return db;
}
afterEach(()=>vi.unstubAllEnvs());

describe('authoritative access acceptance matrix',()=>{
  it.each([
    ['ordinary',{},false,false], ['expired',{isSubscribed:true,subscriptionExpiresAt:1,subscriptionTier:'master'},false,false],
    ['Punter',{isSubscribed:true,subscriptionExpiresAt:3000,subscriptionTier:'punter'},true,false],
    ['Master',{isSubscribed:true,subscriptionExpiresAt:3000,subscriptionTier:'master'},true,true]
  ])('%s permissions derive from persisted access',async(_name,profile,subscribed,master)=>{
    const result=await deriveAccess({db:database({userProfiles:[{email:'person@example.com',...profile}]})},'person@example.com','personal|session',2000);
    expect(result.isSubscribed).toBe(subscribed);expect(result.hasMasterPass).toBe(master);
  });
  it('grants configured administrator access',async()=>{vi.stubEnv('SUPER_ADMIN_EMAIL','admin@example.com');expect((await deriveAccess({db:database()},'admin@example.com','admin|session')).isAdmin).toBe(true);});
  it.each([['claimed',3000,true],['claimed',1000,false],['revoked',3000,false],['suspended',3000,false]])('personal tester %s expiry %i',async(status,expiry,active)=>{
    const result=await deriveAccess({db:database({testerCodes:[{_id:'code-row',code:'PDT-CODE',actualEmail:'person@example.com',authUserId:'personal',status,trialExpiresAt:expiry}],testerSessions:[{subject:'personal|session',code:'PDT-CODE'}]})},'person@example.com','personal|session',2000);
    expect(result.isTester).toBe(true);expect(result.hasMasterPass).toBe(active);
  });
  it('retired shared credentials cannot retain trial access',async()=>{vi.stubEnv('TESTER_EMAIL','shared@example.com');const result=await deriveAccess({db:database()},'shared@example.com','shared|session',2000);expect(result.isSubscribed).toBe(false);});
  it('an expired tester on a paid Punter plan retains paid access without a Master upgrade',async()=>{const result=await deriveAccess({db:database({testerCodes:[{code:'PDT-CODE',actualEmail:'person@example.com',authUserId:'personal',status:'claimed',trialExpiresAt:1000}],testerSessions:[{subject:'personal|session',code:'PDT-CODE'}],userProfiles:[{email:'person@example.com',isSubscribed:true,subscriptionTier:'punter',subscriptionExpiresAt:3000}]})},'person@example.com','personal|session',2000);expect(result.isSubscribed).toBe(true);expect(result.hasMasterPass).toBe(false);expect(result.subscriptionExpiresAt).toBe(3000);});
  it('rejects another account attempting to activate a tester code',async()=>{
    const db=database({testerCodes:[{code:'PDT-CODE',authUserId:'owner',actualEmail:'owner@example.com',status:'claimed'}]});
    await expect((activateSession as any)._handler({db,auth:{getUserIdentity:async()=>({subject:'attacker|session',email:'attacker@example.com'})}},{code:'PDT-CODE',deviceId:'device123'})).rejects.toThrow('another account');
  });
  it('rejects the wrong device',async()=>{
    const db=database({testerCodes:[{code:'PDT-CODE',authUserId:'owner',actualEmail:'owner@example.com',status:'claimed',deviceId:'original-device'}]});
    await expect((activateSession as any)._handler({db,auth:{getUserIdentity:async()=>({subject:'owner|session',email:'owner@example.com'})}},{code:'PDT-CODE',deviceId:'different-device'})).rejects.toThrow('another device');
  });
  it('rejects forged profile ownership before writing',async()=>{const db=database();await expect((registerProfile as any)._handler({db,auth:{getUserIdentity:async()=>({subject:'attacker|session',email:'attacker@example.com'})}},{email:'victim@example.com'})).rejects.toThrow('signed-in account');expect(db.patch).not.toHaveBeenCalled();});
});

describe('payment settlement',()=>{
  const transaction={id:123,status:'successful',customer:{email:'person@example.com'},tx_ref:'reference',amount:5000,currency:'NGN'};
  it.each([{amount:4999},{amount:9500},{currency:'USD'},{status:'failed'},{tx_ref:''}])('rejects invalid provider data %j',patch=>expect(()=>verifiedPayment({...transaction,...patch})).toThrow());
  it('rejects wrong customer and reference',()=>{expect(()=>verifiedPayment(transaction,{email:'other@example.com'})).toThrow();expect(()=>verifiedPayment(transaction,{reference:'different'})).toThrow();});
  it('assigns only exact configured plan amounts',()=>{expect(verifiedPayment(transaction).tier).toBe('punter');expect(verifiedPayment({...transaction,amount:10000}).tier).toBe('master');});
  it('replaying settled payment cannot extend expiry',async()=>{const db=database({subscriptions:[{txRef:'reference',email:'person@example.com',status:'successful'}],userProfiles:[{email:'person@example.com',subscriptionExpiresAt:1000}]});const result=await(markSubscribed as any)._handler({db},{email:'person@example.com',txRef:'reference'});expect(result.expiresAt).toBe(1000);expect(db.patch).not.toHaveBeenCalled();});
  it('rejects missing profiles without consuming settlement',async()=>{const db=database();await expect((markSubscribed as any)._handler({db},{email:'person@example.com',txRef:'new'})).rejects.toThrow('profile is missing');expect(db.insert).not.toHaveBeenCalled();});
  it('validates raw-body HMAC and rejects modified payload',async()=>{const raw='{"event":"charge.completed"}';const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('test-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)))));expect(await validWebhookSignature(raw,signature,'test-secret')).toBe(true);expect(await validWebhookSignature(raw+' ',signature,'test-secret')).toBe(false);});
});

describe('recovery token consumption',()=>{
  it('rejects expired or mismatched codes without deleting',async()=>{const db=database({emailTokens:[{email:'person@example.com',codeHash:'expired',expiresAt:1}]});expect(await(consumeResetTokens as any)._handler({db},{email:'person@example.com',codeHash:'expired'})).toBe(false);expect(db.delete).not.toHaveBeenCalled();});
  it('atomically consumes every code for the same account after validation',async()=>{const db=database({emailTokens:[{_id:'token',email:'person@example.com',codeHash:'valid',expiresAt:Date.now()+10000}]});expect(await(consumeResetTokens as any)._handler({db},{email:'person@example.com',codeHash:'valid'})).toBe(true);expect(db.delete).toHaveBeenCalledWith('token');});
});
