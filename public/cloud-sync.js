// Only confirmed server responses become dashboard state. No browser storage is read or written.
class CloudDashboard {
 constructor({fetcher=fetch,apply,canWrite,onUnauthorized}) {
  Object.assign(this,{fetcher,apply,canWrite,onUnauthorized});
  this.busy=false;this.ready=false;this.revision=0;this.generation=0;this.confirmed=null;
 }
 reset(){this.ready=false;this.confirmed=null;this.generation++;}
 async request(method,body) {
  const generation=this.generation;
  const response=await this.fetcher('/.netlify/functions/sync',{method,credentials:'same-origin',cache:'no-store',...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
  if(generation!==this.generation)throw Error('Session changed. Please sign in again.');
  if(response.status===401)this.onUnauthorized();
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Could not save or load the cloud report.');
  if(!Array.isArray(result.data))throw Error('Invalid cloud report. Please retry.');
  if(generation!==this.generation)throw Error('Session changed. Please sign in again.');
  this.confirmed=result;this.revision=result.revision||0;this.ready=true;this.apply(result);
  return result;
 }
 async load() {
  if(this.busy)throw Error('Cloud synchronization is in progress. Please retry.');
  this.busy=true;
  try{return await this.request('GET');}finally{this.busy=false;}
 }
 async save(report) {
  if(!this.canWrite()||!this.ready)throw Error('Sign in as an administrator and load the cloud report before saving.');
  if(this.busy)throw Error('Cloud synchronization is in progress. Please retry.');
  this.busy=true;
  try{return await this.request('POST',{...report,revision:this.revision});}finally{this.busy=false;}
 }
}
window.CloudDashboard=CloudDashboard;
