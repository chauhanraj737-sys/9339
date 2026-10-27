import { getStore } from '@netlify/blobs';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export function store() { return getStore({name:'retailer-auth',consistency:'strong'}); }
export function hash(password, salt=randomBytes(16).toString('hex')) { return {salt,hash:scryptSync(password,salt,64).toString('hex')}; }
export function verify(password, user) { const h=hash(password,user.salt).hash; return timingSafeEqual(Buffer.from(h,'hex'),Buffer.from(user.hash,'hex')); }
export function publicUser(u) { return {id:u.id,username:u.username,name:u.name,role:u.role,rights:u.role==='Admin'?{view:true,pdf:true,png:true,share:true}: {...u.rights,edit:false},fos:u.fos||[]}; }
export function digest(t) { return createHash('sha256').update(t).digest('hex'); }
export function token(req) { return req.headers.get('cookie')?.match(/(?:^|;\s*)retailer_session=([a-f0-9]{64})(?:;|$)/)?.[1]; }
export async function session(req) { const t=token(req); if(!t)return null; const s=await store().get('sessions/'+digest(t),{type:'json'}); if(!s||s.expires<Date.now())return null; const u=await store().get('users/'+s.username,{type:'json'}); return u&&u.id===s.userId?publicUser(u):null; }
export function sameOrigin(req) { const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin; }
export function json(body,status=200,headers={}) { return Response.json(body,{status,headers:{'cache-control':'no-store',...headers}}); }
export function cookie(value,age=43200) {return `retailer_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;}
export {randomBytes};
