// Operator verification. Credentials remain in memory or ignored private files.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
const cli=['node_modules/convex/bin/main.js'];
const run=(args,options={})=>execFileSync(process.execPath,[...cli,...args],{encoding:'utf8',maxBuffer:16*1024*1024,...options});
const inventory=run(['env','list','--prod']);
const env=Object.fromEntries(inventory.split(/\r?\n/).filter(line=>/^[A-Z][A-Z0-9_]*=/.test(line)).map(line=>{const index=line.indexOf('=');let value=line.slice(index+1);try{if(value.startsWith('"'))value=JSON.parse(value);}catch{}return[line.slice(0,index),value];}));
const privateDir='.secrets';mkdirSync(privateDir,{recursive:true});mkdirSync('tmp/production-audit',{recursive:true});
const client=new ConvexHttpClient('https://gallant-minnow-735.eu-west-1.convex.cloud');
async function login(email,password){client.clearAuth();const result=await client.action('auth:signIn',{provider:'password',params:{email,password,flow:'signIn'}});if(!result.tokens?.token)throw new Error('Configured account authentication failed');client.setAuth(result.tokens.token);return result.tokens;}
const findings=[];const tracked=execFileSync('git',['ls-files'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
for(const file of tracked){let content;try{content=readFileSync(file,'utf8');}catch{continue;}for(const [name,secret] of Object.entries(env)){if(!/PASSWORD|SECRET|API_KEY|TOKEN|AI_KEY/.test(name)||secret.length<8)continue;if(content.includes(secret)||content.includes(Buffer.from(secret).toString('base64')))findings.push({scope:'current',file,credential:name,fingerprint:createHash('sha256').update(secret).digest('hex').slice(0,12)});}}
// Search past revisions without putting secret values in command arguments.
const objects=execFileSync('git',['rev-list','--objects','--all'],{encoding:'utf8',maxBuffer:16*1024*1024}).split('\n').map(line=>{const space=line.indexOf(' ');return{hash:line.slice(0,space),file:line.slice(space+1)};}).filter(row=>/\.(?:ts|js|cjs|mjs|svelte|md|toml|json)$/.test(row.file));
const batch=execFileSync('git',['cat-file','--batch'],{input:objects.map(row=>row.hash).join('\n')+'\n',maxBuffer:256*1024*1024});
let offset=0;
for(const object of objects){const end=batch.indexOf(10,offset);const header=batch.subarray(offset,end).toString().split(' ');const length=Number(header[2]);if(!Number.isFinite(length))throw new Error('Unexpected history object');const content=batch.subarray(end+1,end+1+length).toString('utf8');offset=end+length+2;for(const[name,secret]of Object.entries(env)){if(!/PASSWORD|SECRET|API_KEY|TOKEN|AI_KEY/.test(name)||secret.length<8)continue;if(content.includes(secret)||content.includes(Buffer.from(secret).toString('base64')))findings.push({scope:'history',blob:object.hash.slice(0,12),file:object.file,credential:name,fingerprint:createHash('sha256').update(secret).digest('hex').slice(0,12)});}}
writeFileSync('tmp/production-audit/credential-inventory.json',JSON.stringify({historyBlobsScanned:objects.length,findings},null,2));
console.log(`Credential inventory: ${objects.length} historical blobs checked; ${findings.length} matches. Values withheld.`);
await login(env.SUPER_ADMIN_EMAIL,env.SUPER_ADMIN_PASSWORD);
const access=await client.mutation('users:syncAccess',{});if(!access.isAdmin)throw new Error('Administrator access was not verified');
const ops=await client.query('releaseOps:snapshot',{});
console.log('Production administrator and operations dashboard verified.');
const copilot=await client.mutation('users:authorizeCopilot',{});if(!copilot.allowed)throw new Error('Copilot authorization failed');
if(process.argv.includes('--rotate')){
  const password=randomBytes(32).toString('base64url');
  const retiredPassword=randomBytes(32).toString('base64url');
  writeFileSync(`${privateDir}/release-admin-credentials.json`,JSON.stringify({email:env.SUPER_ADMIN_EMAIL,password,createdAt:new Date().toISOString()},null,2),{mode:0o600});
  writeFileSync(`${privateDir}/admin-password.txt`,password,{mode:0o600});
  writeFileSync(`${privateDir}/retired-tester-password.txt`,retiredPassword,{mode:0o600});
  await client.action('accountAdmin:resetAccountPassword',{email:env.SUPER_ADMIN_EMAIL,newPassword:password});
  run(['env','set','SUPER_ADMIN_PASSWORD','--from-file',`${privateDir}/admin-password.txt`,'--prod']);
  await login(env.SUPER_ADMIN_EMAIL,password);
  if(env.TESTER_EMAIL){await client.action('accountAdmin:resetAccountPassword',{email:env.TESTER_EMAIL,newPassword:retiredPassword});run(['env','set','TESTER_PASSWORD','--from-file',`${privateDir}/retired-tester-password.txt`,'--prod']);}
  console.log('Administrator and retired shared-account credentials rotated; sessions invalidated. Private credential file saved.');
}
if(process.argv.includes('--rotate-webhook')) {
  const secret=randomBytes(32).toString('base64url');
  writeFileSync(`${privateDir}/flutterwave-webhook-secret.txt`,secret,{mode:0o600});
  run(['env','set','FLW_SECRET_HASH','--from-file',`${privateDir}/flutterwave-webhook-secret.txt`,'--prod']);
  console.log('Exposed webhook secret invalidated on Convex. Provider dashboard must be updated from the private file before webhook acceptance.');
}
const migrations=[];
for(const table of ['drafts','savedScreeners','betSlips']){let cursor;let scanned=0,eligible=0,skipped=0;let pages=0;do{const preview=await client.mutation('releaseOps:migrateOwnership',{table,cursor});scanned+=preview.scanned;eligible+=preview.eligible;skipped+=preview.skipped;if(process.argv.includes('--migrate')&&preview.eligible)await client.mutation('releaseOps:migrateOwnership',{table,cursor,apply:true});cursor=preview.done?undefined:preview.cursor;if(preview.done)break;}while(++pages<100);migrations.push({table,scanned,eligible,skipped,applied:process.argv.includes('--migrate')});}
await client.action('auth:signOut',{});client.clearAuth();
let anonymousDenied=false;try{await client.mutation('users:authorizeCopilot',{});}catch{anonymousDenied=true;}
writeFileSync('tmp/production-audit/live-release-verification.json',JSON.stringify({at:new Date().toISOString(),adminVerified:true,copilotVerified:true,anonymousDenied,migrations,services:ops.services,credentialMatches:findings.length},null,2));
console.log(JSON.stringify({anonymousDenied,migrations,services:ops.services}));
