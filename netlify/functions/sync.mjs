import { session, sameOrigin, json } from '../lib/auth.mjs';
import { getStore } from '@netlify/blobs';

const validMonth = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
function view(saved, user, requestedMonth=saved.month) {
  const history=saved.history||{};
  const availableMonths=[...new Set([...Object.keys(history).filter(validMonth),...(validMonth(saved.month)?[saved.month]:[])])].sort();
  const month=validMonth(requestedMonth)?requestedMonth:(validMonth(saved.month)?saved.month:'');
  const report=month===saved.month?saved:(history[month]||{data:[],source:'No upload for '+month});
  const data=Array.isArray(report.data)?report.data:[];
  const {history:_history,...current}=report;
  return {...current,month,revision:saved.revision||0,availableMonths,data:user.fos.length?data.filter(r=>user.fos.includes(r.fos||'Unassigned')):data};
}
export default async request => {
 try {
  const user=await session(request);
  if(!user)return json({error:'Sign in required'},401);
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
  if(request.method==='POST'&&(user.role!=='Admin'||!sameOrigin(request)))return json({error:'Administrator access required'},403);
  // Changes must be visible immediately to other devices after a successful save.
  const store=getStore({name:'retailer-dashboard',consistency:'strong'});
  const saved=await store.get('current',{type:'json'})||{data:[],source:'No cloud upload',month:'',revision:0};
  if(request.method==='GET') {
   const requestedMonth=new URL(request.url).searchParams.get('month')||saved.month;
   return json(view(saved,user,requestedMonth));
  }
  const body=await request.json(),action=body.action||'save';
  if(!['save','clear','select'].includes(action)||!validMonth(body.month))return json({error:'Invalid action or report month'},400);
  if(body.revision!==undefined&&body.revision!==(saved.revision||0))return json({error:'The cloud report changed on another device. Reload and try again.'},409);
  const history={...saved.history};
  if(validMonth(saved.month)&&!Object.hasOwn(history,saved.month))history[saved.month]={data:saved.data,source:saved.source};
  let report;
  if(action==='save') {
   if(!Array.isArray(body.data)||body.data.some(r=>!r||typeof r!=='object'||Array.isArray(r)))return json({error:'Invalid retailer data'},400);
   report={data:body.data,source:typeof body.source==='string'?body.source:''};
   history[body.month]=report;
  } else {
   if(action==='clear')delete history[body.month];
   report=history[body.month]||{data:[],source:'No upload for '+body.month};
  }
  const next={...report,month:body.month,history,revision:(saved.revision||0)+1};
  await store.setJSON('current',next);
  return json(view(next,user));
 } catch {return json({error:'Cloud storage is unavailable. Changes were not confirmed; please retry.'},503);}
};
