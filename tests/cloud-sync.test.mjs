import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const window={};
runInNewContext(await readFile('cloud-sync.js','utf8'),{window,fetch:()=>{},Error});
const CloudDashboard=window.CloudDashboard;

test('default fetcher loads and saves without using the dashboard as the fetch receiver',async()=>{
 const requests=[],applied=[],browser={};
 runInNewContext(await readFile('cloud-sync.js','utf8'),{
  window:browser,
  fetch:function(url,options){
   // Native browser fetch rejects a CloudDashboard receiver.
   assert.equal(this,undefined);
   requests.push({url,...options});
   return Promise.resolve(Response.json({data:[],month:'2026-10',revision:requests.length}));
  }
 });
 const cloud=new browser.CloudDashboard({canWrite:()=>true,onUnauthorized:()=>assert.fail('unexpected session expiry'),apply:r=>applied.push(r)});
 await cloud.load();
 await cloud.save({data:[],month:'2026-10'});
 assert.equal(applied.length,2);
 assert.deepEqual(requests.map(r=>r.method),['GET','POST']);
 for(const request of requests){
  assert.equal(request.url,'/.netlify/functions/sync');
  assert.equal(request.credentials,'same-origin');
  assert.equal(request.cache,'no-store');
 }
 assert.equal(JSON.parse(requests[1].body).revision,1);
});

test('cloud writes await confirmation and never apply failed or offline changes',async()=>{
 const requests=[],applied=[];let reply,resolve;
 const cloud=new CloudDashboard({canWrite:()=>true,onUnauthorized:()=>{},apply:r=>applied.push(r),fetcher:async(url,options)=>{requests.push({url,...options});return reply;}});
 await assert.rejects(cloud.save({data:[]}),/load the cloud/);
 reply=Response.json({data:[{name:'Server'}],month:'2026-10',revision:2});await cloud.load();
 cloud.fetcher=async()=>new Promise(r=>resolve=r);
 const pending=cloud.save({data:[{name:'Edited'}],month:'2026-10'});
 assert.equal(applied.length,1);assert.equal(cloud.busy,true);
 await assert.rejects(cloud.save({data:[]}),/in progress/);
 resolve(Response.json({error:'Storage failed'},{status:503}));
 await assert.rejects(pending,/Storage failed/);assert.equal(applied.length,1);assert.equal(cloud.busy,false);
 cloud.fetcher=async()=>{throw Error('Offline');};
 await assert.rejects(cloud.load(),/Offline/);assert.equal(applied.length,1);
 cloud.fetcher=async(url,options)=>{requests.push({url,...options});return Response.json({data:[{name:'Edited'}],month:'2026-10',revision:3});};
 await cloud.save({data:[{name:'Edited'}],month:'2026-10'});
 assert.equal(applied.length,2);assert.equal(JSON.parse(requests.at(-1).body).revision,2);
 assert.equal(requests.at(-1).credentials,'same-origin');assert.equal(requests[0].cache,'no-store');
});

test('viewers cannot save and expired sessions trigger locking',async()=>{
 let locked=false;
 const cloud=new CloudDashboard({canWrite:()=>false,onUnauthorized:()=>locked=true,apply:()=>assert.fail('must not apply'),fetcher:async()=>Response.json({error:'Sign in required'},{status:401})});
 await assert.rejects(cloud.load(),/Sign in required/);assert.equal(locked,true);
 cloud.ready=true;await assert.rejects(cloud.save({data:[]}),/administrator/);
});

test('actual edit and import handlers keep displayed data unchanged until cloud confirmation',async()=>{
 const html=await readFile('index.html','utf8');
 const lines=html.split('\n');
 const edit=lines.find(l=>l.startsWith("$('#editBackup').onclick="));
 const importer=lines.find(l=>l.startsWith("$('#file').onchange="));
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'2026-10',addEventListener(type,fn){this[type]=fn;},close(){this.closed=true;}});return elements.get(id);};
 const original={name:'Retailer',fos:'A',schemes:[{value:10}],deduction:0,onBill:2,grand:10,final:12};
 const data=[structuredClone(original)],messages=[],writes=[];let resolve,reject;
 const context={
  $:selector=>element(selector),data,source:'original.xlsx',editingIndex:0,chosen:0,
  structuredClone,Number,JSON,Error,downloadEditBackup(){},refreshDraft(){},
  msg:(...args)=>messages.push(args),
  document:{querySelectorAll:()=>[{value:'20'}],querySelector:selector=>({value:selector.includes('deduction')?'-3':'2'})},
  readExcel:async()=>[{name:'Imported',fos:'B'}],
  window:{dashboardCloud:{save:report=>{writes.push(structuredClone(report));return new Promise((yes,no)=>{resolve=yes;reject=no;});}}}
 };
 runInNewContext(edit+'\n'+importer,context);
 const pending=element('#editForm').submit({preventDefault(){}});
 assert.deepEqual(data,[original]);assert.equal(element('#editDialog').closed,undefined);
 assert.equal(writes[0].data[0].final,19);
 reject(Error('Cloud write failed'));await pending;
 assert.deepEqual(data,[original]);assert.match(messages.at(-1)[0],/Cloud write failed/);
 const fileInput={files:[{name:'import.xlsx'}],value:'import.xlsx'};
 const importing=element('#file').onchange({target:fileInput});
 await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(data,[original]);assert.equal(writes.at(-1).source,'import.xlsx');
 reject(Error('Offline'));await importing;
 assert.deepEqual(data,[original]);assert.equal(context.source,'original.xlsx');assert.match(messages.at(-1)[0],/Offline/);
 const saving=element('#editForm').submit({preventDefault(){}});
 assert.equal(element('#editDialog').closed,undefined);resolve();await saving;
 assert.equal(element('#editDialog').closed,true);assert.match(messages.at(-1)[0],/saved to the cloud/);
});
