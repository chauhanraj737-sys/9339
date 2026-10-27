import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import auth from '../netlify/functions/auth.mjs';
import sync from '../netlify/functions/sync.mjs';
import bootstrap from '../netlify/lib/bootstrap.mjs';
import {hash,store} from '../netlify/lib/auth.mjs';
const origin='https://example.test';
function request(path,body,cookie,method='POST',otherOrigin=origin){return new Request(origin+'/.netlify/functions/'+path,{method,headers:{origin:otherOrigin,...(cookie?{cookie}:{}),'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});}
test('server sessions, account lifecycle, rights, and sync authorization',async()=>{
 // Seed the production administrator identity with an ephemeral password in the mock store.
 const password=randomBytes(20).toString('hex');await store().setJSON('users/yusuf',{...bootstrap,...hash(password)});
 const login=await auth(request('auth',{username:'yusuf',password}),{ip:'test'});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await auth(request('auth',null,null,'GET'))).status,401);
 assert.equal((await sync(request('sync',{data:[]}))).status,401);
 const payload={username:'test-user',password:randomBytes(20).toString('hex'),name:'Test',fos:['A'],rights:{pdf:true,png:false,share:false,edit:true}};
 const created=await auth(request('auth',{action:'create',...payload},cookie));assert.equal(created.status,200);const account=(await created.json()).user;assert.equal(account.rights.edit,false);assert.equal(account.hash,undefined);
 assert.equal((await auth(request('auth',{action:'create',...payload},cookie))).status,409);
 const signed=await auth(request('auth',{username:payload.username,password:payload.password}),{ip:'user'});assert.equal(signed.status,200);const userCookie=signed.headers.get('set-cookie').split(';')[0];
 assert.equal((await auth(request('auth',{action:'users'},userCookie))).status,403);
 assert.equal((await auth(request('auth',{action:'authorize',right:'png'},userCookie))).status,403);
 assert.equal((await auth(request('auth',{action:'authorize',right:'pdf'},userCookie))).status,200);
 assert.equal((await sync(request('sync',{data:[]},userCookie))).status,403);
 assert.equal((await sync(request('sync',{data:[{fos:'A'},{fos:'B'}]},cookie))).status,200);
 const view=await sync(request('sync',null,userCookie,'GET'));assert.equal((await view.json()).data.length,1);
 assert.equal((await auth(request('auth',{action:'delete',username:'yusuf'},cookie))).status,400);
 assert.equal((await auth(request('auth',{action:'users'},cookie,'POST','https://other.test'))).status,403);
 assert.equal((await auth(request('auth',{action:'update',username:payload.username,rights:{png:true}},cookie))).status,200);
 assert.equal((await auth(request('auth',{action:'authorize',right:'pdf'},userCookie))).status,403);
 assert.equal((await auth(request('auth',{action:'delete',username:payload.username},cookie))).status,200);
 assert.equal((await auth(request('auth',null,userCookie,'GET'))).status,401);
 assert.equal((await auth(request('auth',{action:'logout'},cookie))).status,200);
 assert.equal((await auth(request('auth',null,cookie,'GET'))).status,401);
});
