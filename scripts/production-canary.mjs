import { readFile, writeFile } from 'node:fs/promises';
import { ConvexHttpClient } from 'convex/browser';
const base=process.env.E2E_BASE_URL||'https://pulseodds.ewinproject.org';
const results=[];
for(const path of ['/','/auth','/auth/reset','/tester','/football','/admin']){
  const response=await fetch(base+path,{signal:AbortSignal.timeout(20000)});const html=await response.text();
  results.push({name:`Published ${path}`,pass:new URL(response.url).pathname===path&&response.ok&&html.includes('<html')&&!!response.headers.get('content-security-policy')});
}
const body=JSON.stringify({messages:[{role:'user',content:'Reply with Ready.'}],max_tokens:64});
const anonymous=await fetch(base+'/api/ai-analyze',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(20000)});
results.push({name:'Published edge denies anonymous AI requests',pass:anonymous.status===401});
const account=JSON.parse(await readFile('.secrets/release-admin-credentials.json','utf8'));
const client=new ConvexHttpClient('https://gallant-minnow-735.eu-west-1.convex.cloud');
const login=await client.action('auth:signIn',{provider:'password',params:{email:account.email,password:account.password,flow:'signIn'}});
if(!login.tokens?.token)throw new Error('Administrator authentication unavailable');client.setAuth(login.tokens.token);
try{
  const response=await fetch(base+'/api/ai-analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.tokens.token}`,Origin:new URL(base).origin},body,signal:AbortSignal.timeout(90000)});
  const result=await response.json();results.push({name:'Published edge authorizes administrator and reaches AI provider',pass:response.ok&&result.success===true,http:response.status,provider:result.provider??result.model??null});
}finally{await client.action('auth:signOut',{});client.clearAuth();}
const health=await fetch('https://gallant-minnow-735.eu-west-1.convex.site/api/health',{signal:AbortSignal.timeout(15000)});const status=await health.json();results.push({name:'Production backend health',pass:health.ok&&status.status==='ok',status:status.status});
await writeFile('tmp/production-audit/production-canary.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));if(results.some(result=>!result.pass))process.exitCode=1;
