import bootstrap from '../lib/bootstrap.mjs';
import {store,hash,verify,publicUser,session,sameOrigin,json,cookie,token,digest,randomBytes} from '../lib/auth.mjs';
async function revokeSessions(db,username,keepKey='') {
 const {blobs=[]}=await db.list({prefix:'sessions/'});
 await Promise.all(blobs.filter(b=>b.key!==keepKey).map(async b=>{const session=await db.get(b.key,{type:'json'});if(session?.username===username)await db.delete(b.key);}));
}
export default async (req,context) => {
 try {
  const db=store();
  if(req.method==='GET') {const user=await session(req);return user?json({user}):json({error:'Sign in required'},401);}
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(!sameOrigin(req))return json({error:'Forbidden'},403);
  const body=await req.json();const action=body.action||'login';
  if(action==='login') {
   const username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');
   if(password.length>256||!/^[-a-z0-9_.]{1,64}$/.test(username))return json({error:'Invalid credentials'},401);
   const key='attempts/'+digest((context?.ip||'unknown')+username);
   const attempts=await db.get(key,{type:'json'});const count=attempts?.until>Date.now()?attempts.count:0;
   if(count>=10)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
   await db.setJSON(key,{count:count+1,until:attempts?.until>Date.now()?attempts.until:Date.now()+900000});
   const user=await db.get('users/'+username,{type:'json'})||(username===bootstrap.username?bootstrap:null);
   if(!user||!verify(password,user))return json({error:'Invalid credentials'},401);
   if(user.id==='admin')await db.setJSON('users/'+username,user);
   await db.delete(key);
   const t=randomBytes(32).toString('hex');await db.setJSON('sessions/'+digest(t),{username,userId:user.id,expires:Date.now()+43200000});
   return json({user:publicUser(user)},200,{'set-cookie':cookie(t)});
  }
  const user=await session(req);if(!user)return json({error:'Sign in required'},401);
  if(action==='logout'){const t=token(req);if(t)await db.delete('sessions/'+digest(t));return json({ok:true},200,{'set-cookie':cookie('',0)});}
  if(action==='change-password') {
   if(user.role!=='Admin')return json({error:'Administrator access required'},403);
   const account=await db.get('users/'+user.username,{type:'json'});
   const currentPassword=String(body.currentPassword||''),newPassword=String(body.newPassword||'');
   if(!account||!verify(currentPassword,account))return json({error:'Current password is incorrect'},403);
   if(newPassword.length<8||newPassword.length>256)return json({error:'New password must contain 8 to 256 characters'},400);
   await db.setJSON('users/'+user.username,{...account,...hash(newPassword)});
   const t=token(req);await revokeSessions(db,user.username,t?'sessions/'+digest(t):'');
   return json({ok:true});
  }
  if(action==='authorize') {const allowed=['pdf','png','share'].includes(body.right)&&user.rights[body.right];return allowed||user.role==='Admin'?json({ok:true}):json({error:'Action not allowed'},403);}
  if(user.role!=='Admin')return json({error:'Administrator access required'},403);
  if(action==='users'){const {blobs}=await db.list({prefix:'users/'});const users=await Promise.all(blobs.map(b=>db.get(b.key,{type:'json'})));return json({users:users.filter(Boolean).map(publicUser)});}
  const username=String(body.username||'').trim().toLowerCase();
  if(!/^[-a-z0-9_.]{1,64}$/.test(username)||username===bootstrap.username)return json({error:'Invalid or protected username'},400);
  const key='users/'+username,existing=await db.get(key,{type:'json'});
  if(action==='reset-password') {
   if(!existing||existing.role==='Admin')return json({error:'User account not found'},404);
   const password=String(body.password||'');
   if(password.length<8||password.length>256)return json({error:'Password must contain 8 to 256 characters'},400);
   await db.setJSON(key,{...existing,...hash(password)});await revokeSessions(db,username);
   return json({ok:true});
  }
  if(action==='delete'){await db.delete(key);return json({ok:true});}
  if(!['create','update'].includes(action))return json({error:'Unknown action'},400);
  if(action==='create'&&existing)return json({error:'Username already exists'},409);
  if(action==='update'&&!existing)return json({error:'User not found'},404);
  if(action==='create'&&(typeof body.password!=='string'||body.password.length<4))return json({error:'Password must contain at least four characters'},400);
  if(body.password&&body.password.length>256)return json({error:'Password too long'},400);
  const rights={view:true,pdf:body.rights?.pdf===true,png:body.rights?.png===true,share:body.rights?.share===true};
  const account={id:existing?.id||randomBytes(16).toString('hex'),username,name:String(body.name||username).slice(0,100),role:'User',rights,fos:Array.isArray(body.fos)?body.fos.filter(x=>typeof x==='string').slice(0,100):[],...(body.password?hash(body.password):{salt:existing.salt,hash:existing.hash})};
  await db.setJSON(key,account);return json({user:publicUser(account)});
 }catch{return json({error:'Authentication service unavailable. Please retry.'},500);}
};
