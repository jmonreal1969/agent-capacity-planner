import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import handler from './api/gate.js';
process.env.CAPACITY_PIN='672941';process.env.CAPACITY_SESSION_SECRET='test-only-signing-key-not-for-deployment';
async function request(url='/',method='GET',body=undefined,extra={}){const req={url,method,body,headers:{host:'planner.test','x-vercel-forwarded-for':'192.0.2.1',...extra},socket:{remoteAddress:'192.0.2.1'}},res={statusCode:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(v=''){this.body=String(v);}};await handler(req,res);return res;}
let r=await request();assert.equal(r.statusCode,200);assert.match(r.body,/Access PIN/);assert.ok(!r.body.includes('SCENARIO BUILDER'));assert.match(r.headers['cache-control'],/no-store/);
for(const path of ['/app.js','/style.css','/model.js','/README.md','/api/gate.js']){r=await request(path);assert.equal(r.statusCode,401);}
r=await request('/login','POST',{pin:'000000'});assert.equal(r.statusCode,401);assert.match(r.body,/not correct/);
r=await request('/login','POST',{pin:'672941'},{origin:'https://evil.test'});assert.equal(r.statusCode,403);
r=await request('/login','POST',{pin:'672941'},{origin:'https://planner.test'});assert.equal(r.statusCode,303);const cookie=r.headers['set-cookie'][0];assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/Max-Age=28800/);const session=cookie.split(';')[0];
r=await request('/','GET',undefined,{cookie:session});assert.match(r.body,/SCENARIO BUILDER/);assert.match(r.body,/action="\/logout"/);
r=await request('/app.js','GET',undefined,{cookie:session});assert.equal(r.statusCode,200);assert.match(r.headers['content-type'],/javascript/);
r=await request('/','GET',undefined,{cookie:session+'tampered'});assert.match(r.body,/Access PIN/);
const key=createHmac('sha256',process.env.CAPACITY_SESSION_SECRET).update(process.env.CAPACITY_PIN).digest(),payload=Buffer.from(JSON.stringify({kind:'session',exp:Date.now()-1000})).toString('base64url'),signature=createHmac('sha256',key).update(payload).digest('base64url');
r=await request('/','GET',undefined,{cookie:'__Host-capacity_session='+payload+'.'+signature});assert.match(r.body,/Access PIN/);
r=await request('/logout','POST',undefined,{cookie:session});assert.equal(r.statusCode,303);assert.match(r.headers['set-cookie'],/Max-Age=0/);
for(let i=0;i<5;i++)await request('/login','POST',{pin:'000000'},{'x-vercel-forwarded-for':'192.0.2.2'});
r=await request('/login','POST',{pin:'672941'},{'x-vercel-forwarded-for':'192.0.2.2'});assert.equal(r.statusCode,429);
delete process.env.CAPACITY_PIN;r=await request();assert.equal(r.statusCode,503);
console.log('PIN gate checks passed: protected assets, login, signed cookies, tampering, expiry, logout, origin checks, throttling, and fail-closed configuration.');