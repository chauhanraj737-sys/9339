(() => {
 let current=null,last='',loading=false,ready=false;
 const el=id=>document.getElementById(id);
 const admin=()=>current?.role==='Admin';
 const allowed=right=>!!current&&(admin()||current.rights[right]===true);
 async function api(action,body={}) {
  const r=await fetch('/.netlify/functions/auth',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action,...body})});
  const j=await r.json();if(!r.ok){if(r.status===401)lock();throw Error(j.error||'Request failed');}return j;
 }
 function lock(){current=null;ready=false;last='';data.splice(0,data.length);chosen=-1;render();document.body.classList.add('auth-locked');el('loginGate').style.display='grid';panel.hidden=true;el('loginPass').value='';}
 const style=document.createElement('style');style.textContent='[data-denied="true"]{display:none!important}#userAccess{padding:20px;background:white;border:1px solid #dfe7f1;border-radius:14px;margin-bottom:16px}#userAccess form{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}#userAccess label{display:grid;gap:6px}#userAccess input,#userAccess select{padding:8px;border:1px solid #ccd7e4;border-radius:6px}#userAccess .account{padding:12px;border-top:1px solid #ddd;display:flex;gap:12px;align-items:center;flex-wrap:wrap}';document.head.append(style);
 const actions=document.querySelector('.actions');
 const badge=document.createElement('span');actions.prepend(badge);
 function button(text,fn){const b=document.createElement('button');b.className='secondary';b.type='button';b.textContent=text;b.onclick=fn;actions.append(b);return b;}
 const managerButton=button('User access',()=>showUsers().catch(report));
 button('Logout',async()=>{try{await api('logout');lock();}catch(e){report(e);}});
 const panel=document.createElement('section');panel.id='userAccess';panel.hidden=true;document.querySelector('.controls').before(panel);
 panel.innerHTML='<h2>User access management</h2><p>Accounts and rights are saved securely on the server. Only administrators can change dashboard data.</p><div id="accountList"></div><form id="accountForm"><label>Name<input name="name" required maxlength="100"></label><label>Username<input name="username" required pattern="[-a-zA-Z0-9_.]{1,64}" maxlength="64"></label><label>Password<input name="password" type="password" required minlength="4" maxlength="256" autocomplete="new-password"></label><label>Allowed FOS (none = all)<select name="fos" multiple></select></label><label><input name="pdf" type="checkbox"> PDF download</label><label><input name="png" type="checkbox"> PNG download</label><label><input name="share" type="checkbox"> WhatsApp share</label><button class="primary" type="submit">Create user</button></form><button type="button" id="closeUsers" class="secondary">Close</button><p id="accountStatus" role="status"></p>';
 el('closeUsers').onclick=()=>panel.hidden=true;
 function report(e){msg(e.message,true);el('accountStatus').textContent=e.message;}
 async function showUsers(){if(!admin())return;panel.hidden=false;const j=await api('users');const list=el('accountList');list.replaceChildren();
  for(const u of j.users){const row=document.createElement('div');row.className='account';const name=document.createElement('b');name.textContent=u.name+' ('+u.username+')';row.append(name);
   if(u.role==='Admin'){row.append(document.createTextNode('Administrator'));}else{
    const checks={};for(const right of ['pdf','png','share']){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=u.rights[right];checks[right]=input;label.append(input,document.createTextNode(right));row.append(label);}
    const fos=document.createElement('select');fos.multiple=true;fos.setAttribute('aria-label','Allowed FOS for '+u.username);for(const value of new Set([...data.map(r=>r.fos||'Unassigned'),...u.fos])){const option=new Option(value,value);option.selected=u.fos.includes(value);fos.add(option);}row.append(fos);
    for(const [text,fn] of [['Save rights',()=>api('update',{username:u.username,name:u.name,fos:[...fos.selectedOptions].map(o=>o.value),rights:Object.fromEntries(Object.entries(checks).map(([k,v])=>[k,v.checked]))})],['Delete',()=>api('delete',{username:u.username})]]){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.onclick=async()=>{try{await fn();await showUsers();el('accountStatus').textContent='Saved.';}catch(e){report(e);}};row.append(b);}
   }list.append(row);
  }
  const select=el('accountForm').elements.fos;select.replaceChildren();for(const f of new Set(data.map(r=>r.fos||'Unassigned')))select.add(new Option(f,f));
 }
 el('accountForm').onsubmit=async e=>{e.preventDefault();const f=e.target.elements;try{await api('create',{name:f.name.value,username:f.username.value,password:f.password.value,fos:[...f.fos.selectedOptions].map(o=>o.value),rights:{pdf:f.pdf.checked,png:f.png.checked,share:f.share.checked}});e.target.reset();await showUsers();el('accountStatus').textContent='User created.';}catch(e){report(e);}};
 function permissions(){badge.textContent=current?'Signed in: '+current.name:'';managerButton.dataset.denied=String(!admin());
  const mapping={singlePdf:allowed('pdf'),allPdf:allowed('pdf'),singlePng:allowed('png'),allFiles:allowed('pdf')&&allowed('png'),editBackup:admin(),saveMonth:admin(),clearMonth:admin(),file:admin()};
  for(const [id,ok] of Object.entries(mapping)){const e=el(id);if(e)e.dataset.denied=String(!ok);}
  document.querySelector('label[for="file"]').dataset.denied=String(!admin());document.querySelectorAll('.edit-row').forEach(b=>b.dataset.denied=String(!admin()));
  document.querySelectorAll('[data-share]').forEach(b=>b.dataset.denied=String(!allowed('share')||!allowed(b.dataset.share)));
  el('month').disabled=!admin();if(!admin()){panel.hidden=true;el('editDialog').close();}
 }
 const originalRows=rows;rows=function(){originalRows();permissions();};
 const originalEditor=openEditor;openEditor=function(i){if(admin())originalEditor(i);};
 // Capture events before the dashboard's existing handlers run, including newly rendered row actions.
 document.addEventListener('click',e=>{const b=e.target.closest('button,label');if(b?.dataset.denied==='true'){e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('submit',e=>{if(e.target.id==='editForm'&&!admin()){e.preventDefault();e.stopImmediatePropagation();}},true);
 for(const [id,right] of Object.entries({singlePdf:'pdf',allPdf:'pdf',singlePng:'png',allFiles:'pdf'})){const b=el(id),original=b.onclick;b.onclick=async e=>{try{await api('authorize',{right});if(id==='allFiles')await api('authorize',{right:'png'});await original(e);}catch(err){report(err);}};}
 for(const type of ['pdf','png']){const b=button('WhatsApp '+type.toUpperCase(),async()=>{try{await api('authorize',{right:'share'});await api('authorize',{right:type});if(chosen<0)return msg('Select one retailer first.',true);const r=data[chosen],blob=await(type==='pdf'?pdf(r):png(r)),name=safe(r.name)+'_'+safe(monthName())+'.'+type,file=new File([blob],name,{type:blob.type}),text='Mobile World Dahod report for '+r.name+' - '+monthName();if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],text,title:name});}else{dl(blob,name);window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');msg('Attach the downloaded report in WhatsApp.');}}catch(e){if(e.name!=='AbortError')report(e);}});b.dataset.share=type;}
 async function loadCloud(){if(loading||!current)return;loading=true;try{const r=await fetch('/.netlify/functions/sync',{cache:'no-store'});if(r.status===401){lock();return;}if(!r.ok)throw Error('Could not load shared dashboard.');const j=await r.json();if(Array.isArray(j.data)){const incoming=JSON.stringify(j.data);if(incoming!==last||!ready){data.splice(0,data.length,...j.data);source=j.source||source;if(j.month)el('month').value=j.month;chosen=-1;render();}last=incoming;}else last=JSON.stringify(data);ready=true;}finally{loading=false;}}
 async function enter(u){current=u;ready=false;if(!admin()){data.splice(0,data.length);chosen=-1;render();}await loadCloud();if(!current)return;document.body.classList.remove('auth-locked');el('loginGate').style.display='none';el('loginPass').value='';permissions();}
 el('loginForm').onsubmit=async e=>{e.preventDefault();el('loginError').textContent='';const b=e.target.querySelector('button');b.disabled=true;try{const j=await api('login',{username:el('loginUser').value,password:el('loginPass').value});await enter(j.user);}catch(err){el('loginError').textContent=err.message;}finally{b.disabled=false;}};
 setInterval(async()=>{if(!current||loading||!ready)return;try{const r=await fetch('/.netlify/functions/auth',{cache:'no-store'});if(!r.ok){if(r.status===401)lock();return;}current=(await r.json()).user;permissions();const now=JSON.stringify(data);if(admin()&&(now!==last||source!==lastSource||el('month').value!==lastMonth)){loading=true;try{const r=await fetch('/.netlify/functions/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data,source,month:el('month').value})});if(!r.ok)throw Error('Shared changes could not be saved.');last=now;lastSource=source;lastMonth=el('month').value;}finally{loading=false;}}else await loadCloud();}catch(e){report(e);}},2500);
 let lastSource=source,lastMonth=el('month').value;
 permissions();fetch('/.netlify/functions/auth',{cache:'no-store'}).then(async r=>{if(r.ok)await enter((await r.json()).user);}).catch(e=>{el('loginError').textContent=e.message;});
})();
