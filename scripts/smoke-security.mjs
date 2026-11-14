import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Controlled inference stub: proves route resource limits without calling a real
// model or using a paid provider. All accounts belong to a disposable test DB.
const root = fileURLToPath(new URL('../', import.meta.url));
const pending = [];
let failProvider = false;
const model = createServer(async (request, response) => {
  if (request.url === '/api/tags') { response.setHeader('Content-Type','application/json'); return response.end(JSON.stringify({ models: [{ name: 'qwen3:4b-instruct' }] })); }
  let body = ''; for await (const chunk of request) body += chunk;
  const message = JSON.parse(body).messages.at(-1).content;
  if (message.startsWith('hold')) await new Promise(resolve => pending.push(resolve));
  response.setHeader('Content-Type','application/json');
  if (failProvider) { response.statusCode = 500; return response.end('internal-provider-detail'); }
  response.end(JSON.stringify({ done: true, done_reason: 'stop', message: { content: 'Saran uji lokal.' } }));
});
await new Promise(resolve => model.listen(0,'127.0.0.1',resolve));
const reserve = createServer(); await new Promise(resolve => reserve.listen(0,'127.0.0.1',resolve));
const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const database = join(root,'.caltrack',`smoke-${randomUUID()}.db`);
let child;
let checks = 0;
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
const until = async predicate => { for(let i=0;i<100;i++) { if(predicate()) return; await delay(50); } throw new Error('Test provider did not receive expected work'); };
try {
  const preparation = spawn(process.execPath,['scripts/smoke-backend.mjs','--prepare',database],{cwd:root,windowsHide:true,stdio:'inherit'});
  assert.equal(await new Promise((resolve,reject) => { preparation.once('error',reject); preparation.once('exit',resolve); }),0,'Disposable database preparation must succeed');
  child = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,NODE_ENV:'production',DATABASE_URL:`file:${database}`,BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:randomBytes(32).toString('base64url'),CHAT_PROVIDER:'ollama',OLLAMA_MODEL:'qwen3:4b-instruct',OLLAMA_BASE_URL:`http://127.0.0.1:${model.address().port}`,OPENAI_API_KEY:''}});
  let ready=false;
  for(let i=0;i<60;i++) { try { ready=(await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok; } catch {} if(ready)break; await delay(500); }
  assert(ready,'Verification server must start');
  const call = (path,{cookie,body,headers={}}={}) => fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  async function account(name) { const response=await call('/api/auth/sign-up/email',{body:{name,email:`${name}@example.test`,password:randomBytes(24).toString('base64url')}}); assert.equal(response.status,200); return response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '); }
  const [a,b,c] = [await account('security-a'),await account('security-b'),await account('security-c')];
  const homepage=await call('/'); assert.equal(homepage.headers.get('x-content-type-options'),'nosniff'); assert.equal(homepage.headers.get('x-frame-options'),'DENY'); assert.match(homepage.headers.get('content-security-policy'),/frame-ancestors 'none'/); checks+=3;
  assert.equal((await call('/api/adventure')).status,401); checks++;
  for(const unsafe of [{Origin:'https://attacker.example.test'},{Origin:'null'},{Origin:origin,'Sec-Fetch-Site':'cross-site'}]) { assert.equal((await call('/api/adventure',{cookie:a,body:{action:'claim',questId:'first-log'},headers:unsafe})).status,401); checks++; }
  const noOrigin=await fetch(origin+'/api/adventure',{method:'POST',headers:{Cookie:a,'Content-Type':'application/json'},body:JSON.stringify({action:'claim',questId:'first-log'})}); assert.equal(noOrigin.status,401); checks++;
  const state=await (await call('/api/adventure',{cookie:a})).json();
  assert.equal((await call('/api/adventure',{cookie:a,body:{action:'claim',questId:state.optionalQuests[0].id,xp:10000,userId:'someone-else'}})).status,409); checks++;
  const first=call('/api/chat',{cookie:a,body:{message:'hold A'}}); await until(()=>pending.length===1);
  assert.equal((await call('/api/chat',{cookie:a,body:{message:'duplicate expensive request'}})).status,429); checks++;
  const second=call('/api/chat',{cookie:b,body:{message:'hold B'}}); await until(()=>pending.length===2);
  const saturated=await call('/api/chat',{cookie:c,body:{message:'third expensive request'}}); assert.equal(saturated.status,429); assert.equal((await saturated.json()).error,'chat_busy'); checks++;
  pending.splice(0).forEach(resolve=>resolve());
  const completed=await Promise.all([first,second]); assert(completed.every(response=>response.status===200)); checks++;
  const conversation=(await completed[0].json()).conversationId;
  assert.equal((await call(`/api/chat?conversationId=${conversation}`,{cookie:b})).status,404); checks++;
  failProvider=true;
  const failed=await call('/api/chat',{cookie:a,body:{message:'test provider failure'}}); assert.equal(failed.status,503); assert.doesNotMatch(await failed.text(),/internal-provider-detail/); checks++;
  failProvider=false;
  assert.equal((await call('/api/chat',{cookie:a,body:{message:'retry after released failure'}})).status,200); checks++;
  console.log(`Passed ${checks} security checks: session origins, response headers, quest tampering, account isolation, inference capacity and failed-request recovery.`);
} finally {
  pending.splice(0).forEach(resolve=>resolve());
  if (child && child.exitCode === null) {
    const closed = new Promise(resolve => child.once('exit',resolve));
    child.kill(); await closed;
  }
  model.closeAllConnections(); await new Promise(resolve=>model.close(resolve));
  for (const suffix of ['', '-wal', '-shm']) await rm(database+suffix,{force:true});
}
