import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ConvexHttpClient} from 'convex/browser';
import {chromium} from 'playwright';
const base=process.env.E2E_BASE_URL||'http://localhost:4184';
const client=new ConvexHttpClient('https://gallant-minnow-735.eu-west-1.convex.cloud');
const results=[];const from=new Date(Date.now()-90*86400000).toISOString().slice(0,10),to=new Date().toISOString().slice(0,10);
const args={sport:'basketball',from,to,mode:'preferred'};
await mkdir('tmp/production-audit',{recursive:true});
let denied=false;try{await client.query('marketAnalytics:report',args);}catch(reason){denied=/sign|auth|access/i.test(String(reason?.data??reason));}
results.push({name:'Anonymous market evidence denied',pass:denied});
const account=JSON.parse(await readFile('.secrets/release-admin-credentials.json','utf8'));
const login=await client.action('auth:signIn',{provider:'password',params:{email:account.email,password:account.password,flow:'signIn'}});
if(!login.tokens?.token)throw new Error('Administrator authentication unavailable');client.setAuth(login.tokens.token);
try{
  for(const sport of ['basketball','football','tennis','hockey','baseball','rally','instant-football','instant-basketball','vfootball','rugby','cricket','mma','volleyball']){
    const report=await client.query('marketAnalytics:report',{...args,sport});
    results.push({name:`Protected ${sport} evidence`,pass:report.sport===sport&&report.rows.length<=100&&Array.isArray(report.groups),fixtures:report.fixtures,fullArchive:report.fullArchive,legacyArchive:report.legacyArchive,automatedCoverage:report.automatedCoverage,more:report.truncated});
  }
  const report=await client.query('marketAnalytics:report',{...args,mode:'all'});
  results.push({name:'All-candidate report remains bounded',pass:report.rows.length<=100&&report.mode==='all'});
}finally{await client.action('auth:signOut',{});client.clearAuth();}
const browser=await chromium.launch({headless:true});const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',reason=>errors.push(String(reason)));
  await page.goto(`${base}/auth`);await page.waitForLoadState('networkidle');await page.locator('input[type=email]').fill(account.email);await page.locator('input[type=password]').fill(account.password);await page.locator('form button[type=submit]').click();await page.waitForURL(url=>url.pathname==='/admin',{timeout:45000});
  await page.getByRole('button',{name:'Markets',exact:true}).click();await page.getByRole('heading',{name:'Market intelligence by sport'}).waitFor();await page.getByText('Archived fixtures',{exact:true}).waitFor({timeout:30000});
  results.push({name:'Administrator market dashboard loads live evidence',pass:true});
  for(const theme of ['light','dark'])for(const width of [360,768,1440]){
    await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
    await page.locator('.market-workspace').screenshot({animations:'disabled',timeout:60000,path:`tmp/production-audit/market-admin-${theme}-${width}.png`});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);results.push({name:`Admin market layout ${theme} ${width}`,pass:!overflow});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'volleyball',exact:true}).click();await page.getByText('This sport has screener guidance, but no automated fixture archive.',{exact:false}).waitFor();results.push({name:'Unsupported automated coverage clearly labelled',pass:true});
  await page.getByRole('button',{name:'basketball',exact:true}).click();await page.getByText('Archived fixtures',{exact:true}).waitFor();
  await page.getByLabel('Selection sample',{exact:true}).selectOption('all');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await page.locator('.coverage').filter({hasText:'All retained candidates'}).waitFor();results.push({name:'Report filters apply without stale state',pass:true});
  results.push({name:'No uncaught market dashboard errors',pass:errors.length===0,errors});
}catch(reason){results.push({name:'Market dashboard acceptance completion',pass:false,error:String(reason)});}
finally{await browser.close();await writeFile('tmp/production-audit/market-acceptance.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.pass))process.exitCode=1;
