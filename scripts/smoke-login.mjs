import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn,spawnSync } from 'node:child_process';
import { randomBytes,randomUUID } from 'node:crypto';
import {mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
const origin='http://127.0.0.1:32190';const database=resolve('.caltrack',`smoke-${randomUUID()}.db`);
await mkdir('.taste-skill/login',{recursive:true});
const prepare=spawnSync(process.execPath,['scripts/smoke-backend.mjs','--prepare',database],{windowsHide:true,stdio:'ignore'});assert.equal(prepare.status,0);
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','32190'],{windowsHide:true,stdio:'ignore',env:{...process.env,CALTRACK_BUILD_DIR:'.caltrack/login-build',DATABASE_URL:`file:${database}`,TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',VERCEL:'',NODE_ENV:'production',BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:randomBytes(32).toString('base64url')}});
let browser,browserServer;
try{
 for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break;}catch{} await new Promise(r=>setTimeout(r,500));}
 browserServer=await chromium.launchServer({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});browser=await chromium.connect(browserServer.wsEndpoint());
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.waitForURL(origin+'/login');await page.getByRole('heading',{name:'Masuk ke CalTrack',exact:true}).waitFor();
 assert.equal(await page.getByText('Data contoh',{exact:true}).count(),0);
 await page.screenshot({path:'.taste-skill/login/login-mobile.png',fullPage:true});
 await page.getByRole('link',{name:'Daftar',exact:true}).click();await page.getByRole('heading',{name:'Daftar CalTrack',exact:true}).waitFor();
 const email=`login-${randomUUID()}@example.test`,password=randomBytes(20).toString('base64url');
 await page.getByLabel('Nama',{exact:true}).fill('Akun Uji Login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Kata sandi',{exact:true}).fill(password);await page.getByLabel('Ulangi kata sandi',{exact:true}).fill(password);await page.getByRole('button',{name:'Daftar',exact:true}).click();
 await page.waitForURL(origin+'/onboarding');await page.locator('.account-strip').waitFor();assert.equal(await page.locator('.demo-access-strip').count(),0);
 const profile=await page.request.put(origin+'/api/profile',{headers:{Origin:origin},data:{name:'Akun Uji Login',age:28,gender:'male',weightKg:75,heightCm:175,activityLevel:'light',goal:'maintenance'}});assert.equal(profile.status(),200);
 const log=await page.request.post(origin+'/api/food-logs',{headers:{Origin:origin},data:{mealType:'lunch',inputMethod:'text',items:[{foodName:'Makanan akun sendiri',weightGrams:100,calories:120,proteinG:4,carbsG:20,fatG:2,fiberG:1,sugarG:0,sodiumMg:2}]}});assert.equal(log.status(),201);
 await page.goto(origin);await page.reload();await page.getByRole('button',{name:'Keluar akun',exact:true}).waitFor();await page.getByText('Makanan akun sendiri',{exact:true}).waitFor();assert.equal(await page.getByText('Nasi ayam panggang',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Keluar akun',exact:true}).click();await page.waitForURL(origin+'/login');
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Kata sandi',{exact:true}).fill(password);await page.getByRole('button',{name:'Masuk',exact:true}).click();await page.waitForURL(origin+'/');await page.getByText('Makanan akun sendiri',{exact:true}).waitFor();
 await page.screenshot({path:'.taste-skill/login/account-mobile.png',fullPage:true});
 const demoContext=await browser.newContext({viewport:{width:390,height:844}});const demo=await demoContext.newPage();demo.setDefaultTimeout(15000);await demo.goto(origin+'/login');await demo.getByRole('link',{name:'Lihat contoh tanpa akun',exact:true}).click();await demo.locator('.demo-access-strip').waitFor();
 for(const width of [320,390,1440]){await demo.setViewportSize({width,height:900});assert.equal(await demo.getByRole('link',{name:'Masuk',exact:true}).isVisible(),true);assert.equal(await demo.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`No horizontal overflow at ${width}`);}
 await demo.reload();await demo.locator('.demo-access-strip').waitFor();await demo.getByRole('link',{name:'Masuk',exact:true}).click();await demo.waitForURL(origin+'/login');await demo.getByRole('heading',{name:'Masuk ke CalTrack',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: fresh visit opens login; UI registration, account-only data, logout/login persistence, explicit demo, visible mobile login, no horizontal overflow and no browser errors.');
}finally{await browser?.close();await browserServer?.close();server.kill();await new Promise(r=>server.once('exit',r));for(const suffix of['','-shm','-wal'])await rm(database+suffix,{force:true}).catch(()=>{});}
