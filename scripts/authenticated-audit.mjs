import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const base=process.env.E2E_BASE_URL||'http://localhost:4184';
const account=JSON.parse(await fs.readFile('.secrets/release-admin-credentials.json','utf8'));
const browser=await chromium.launch({headless:true});const errors=[];const results=[];
const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();
page.on('pageerror',reason=>errors.push(String(reason)));
try{
  await page.goto(`${base}/auth`);await page.locator('input[type=email]').fill(account.email);await page.locator('input[type=password]').fill(account.password);
  await page.locator('form button[type=submit]').click();await page.waitForURL(url=>url.pathname==='/admin',{timeout:45000});
  await page.getByRole('heading',{name:'Performance, access and service health'}).waitFor();
  await page.getByRole('button',{name:'Services',exact:true}).click();await page.getByRole('heading',{name:'Payment configuration'}).waitFor({timeout:20000});
  results.push({name:'Administrator login and live operational metrics',pass:true});
  await page.getByRole('button',{name:'Accounts',exact:true}).click();await page.locator('.ops tbody tr').first().waitFor({timeout:15000});
  results.push({name:'Paginated account inventory loads',pass:true});
  await page.getByRole('button',{name:'Evidence',exact:true}).click();await page.getByRole('heading',{name:'Immutable pre-match prediction archive'}).waitFor();
  await page.getByRole('button',{name:'Migrations',exact:true}).click();await page.getByRole('button',{name:'Preview next page'}).click();await page.getByRole('status').filter({hasText:'Dry run only'}).waitFor();
  results.push({name:'Evidence and migration state interfaces render',pass:true});
  await page.screenshot({path:'tmp/production-audit/admin-operations.png',fullPage:true});
  for(const route of ['football','basketball','tennis','rally','hockey','baseball','rugby','cricket','mma','volleyball','instant-football','instant-basketball','vfootball','predictor','predictor/football','betslip']){
    await page.goto(`${base}/${route}`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(500);
    results.push({name:`Authenticated /${route} remains accessible`,pass:new URL(page.url()).pathname===`/${route}`});
  }
  results.push({name:'No uncaught authenticated UI errors',pass:errors.length===0,errors});
}catch(reason){results.push({name:'Authenticated acceptance completion',pass:false,error:String(reason)});}
finally{await browser.close();await fs.writeFile('tmp/production-audit/authenticated-results.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));if(results.some(result=>!result.pass))process.exitCode=1;
