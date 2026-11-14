(function(){
const cfg=window.HOSTMASTER_ACCESS_CONFIG||window.ACCESS_CONFIG||{}, valid=cfg.SUPABASE_URL&&cfg.SUPABASE_URL.includes('.supabase.co')&&cfg.SUPABASE_ANON_KEY&&cfg.SUPABASE_ANON_KEY.length>20;
const el=id=>document.getElementById(id), msg=t=>el('auth-msg').textContent=t;
if(!valid){msg('Configure config.js com as credenciais PUBLICÁVEIS do novo projeto Supabase.');return;}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const inviteToken=new URLSearchParams(location.search).get('invite');
if(inviteToken){
 const guest=el('guest'),state=el('guest-state'),details=el('guest-details');
 el('auth').classList.add('hidden');el('app').classList.add('hidden');guest.classList.remove('hidden');
 let locked=false, expiryTimer=null, refreshTimer=null;
 const lockGuest=message=>{
  if(locked)return;locked=true;
  if(expiryTimer)clearTimeout(expiryTimer);
  if(refreshTimer)clearInterval(refreshTimer);
  state.textContent=message;
  details.replaceChildren();
  const note=document.createElement('p');note.className='rounded-lg bg-slate-800 p-4 text-slate-300';note.textContent='Sua sessão de hóspede foi encerrada. O link e as autorizações desta hospedagem não podem mais ser utilizados.';
  details.append(note);
  try{history.replaceState({},'',location.pathname);}catch(_){}
 };
 const refreshGuest=async()=>{
  if(locked)return;
  try{
   const {data,error}=await db.rpc('validate_access_invite_devices',{p_token:inviteToken});
   if(error)throw error;
   const rows=Array.isArray(data)?data:[];
   if(!rows.length){lockGuest('Convite inválido ou não encontrado.');return;}
   const first=rows[0],now=Date.now(),end=new Date(first.expires_at).getTime(),begin=new Date(first.starts_at).getTime();
   if(first.authorization_state==='revoked'){lockGuest('O proprietário cancelou esta autorização.');return;}
   if(first.authorization_state==='expired'||now>=end){lockGuest('Estadia encerrada. A sessão foi finalizada automaticamente.');return;}
   state.textContent=first.authorization_state==='not_started'||now<begin?'Acesso programado. Ainda não chegou o horário de entrada.':'Hospedagem ativa · equipamentos autorizados abaixo.';
   const header=document.createElement('div');header.className='mb-3 rounded-lg border border-cyan-500/20 bg-slate-950 p-3';
   const who=document.createElement('p');who.className='font-semibold text-white';who.textContent='Hóspede: '+first.guest_name;
   const when=document.createElement('p');when.className='mt-1 text-xs text-slate-400';when.textContent='Até: '+new Date(first.expires_at).toLocaleString('pt-BR');
   header.append(who,when);
   const cards=rows.map(row=>{
    const active=row.is_authorized&&row.authorization_state==='valid'&&now>=begin&&now<end;
    const card=document.createElement('div');card.className='mb-2 rounded-xl border p-4 '+(active?'border-emerald-500/40 bg-emerald-500/10':'border-slate-700 bg-slate-950 opacity-50');
    const title=document.createElement('p');title.className='font-semibold '+(active?'text-emerald-200':'text-slate-500');title.textContent=row.device_name;
    const sub=document.createElement('p');sub.className='mt-1 text-xs '+(active?'text-emerald-300':'text-slate-600');sub.textContent=active?'LIBERADO PELO PROPRIETÁRIO':(row.is_authorized?'AUTORIZAÇÃO FORA DO HORÁRIO':'NÃO LIBERADO');
    card.append(title,sub);return card;
   });
   details.replaceChildren(header,...cards);
   if(expiryTimer)clearTimeout(expiryTimer);
   expiryTimer=setTimeout(()=>refreshGuest(),Math.max(1000,Math.min(end-now+50,2147483000)));
  }catch(_){state.textContent='Não foi possível confirmar sua autorização. Nenhum acesso deve ser utilizado até a validação do servidor.';}
 };
 refreshGuest();
 refreshTimer=setInterval(refreshGuest,15000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshGuest();});
 return;
}
let props=[],devices=[],invites=[],androidNodes=[],androidTableReady=true;
function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function date(v){return new Date(v).toLocaleString('pt-BR');}
async function load(){
 const [p,d,i,n]=await Promise.all([
  db.from('access_properties').select('*').order('created_at',{ascending:false}),
  db.from('access_devices').select('*').order('created_at',{ascending:false}),
  db.from('access_invites').select('id,guest_name,device_id,starts_at,expires_at,status,created_at').order('created_at',{ascending:false}),
  db.from('access_android_nodes').select('id,property_id,node_name,status,pairing_expires_at,last_seen_at,created_at').order('created_at',{ascending:false})
 ]);
 if(p.error)throw p.error;if(d.error)throw d.error;if(i.error)throw i.error;
 if(n.error && !['42P01','PGRST205'].includes(n.error.code))throw n.error;
 androidTableReady=!n.error;androidNodes=n.error?[]:(n.data||[]);
 props=p.data||[];devices=d.data||[];invites=i.data||[];
 el('count-properties').textContent=props.length;el('count-devices').textContent=devices.length;
 el('device-property').innerHTML='<option value="">Selecione o imóvel</option>'+props.map(x=>'<option value="'+escape(x.id)+'">'+escape(x.title)+'</option>').join('');
 el('invite-device').innerHTML=devices.map(x=>{const p=props.find(y=>y.id===x.property_id);return '<option value="'+escape(x.id)+'">'+escape(p?.title||'Imóvel')+' — '+escape(x.device_name)+'</option>';}).join('');
 el('android-property').innerHTML='<option value="">Selecione a casa piloto</option>'+props.map(x=>'<option value="'+escape(x.id)+'">'+escape(x.title)+'</option>').join('');
 el('android-node-list').innerHTML=!androidTableReady?'Execute o arquivo android-pilot.sql no SQL Editor do Supabase para habilitar o pareamento.':(androidNodes.length?androidNodes.map(n=>{const p=props.find(x=>x.id===n.property_id);const status={pending:'Aguardando pareamento',paired:'Pareado',online:'Online',offline:'Offline',revoked:'Revogado'}[n.status]||n.status;return '<article class="rounded-lg border border-slate-700 p-3"><b class="text-white">'+escape(p?.title||'Imóvel')+'</b><p>'+escape(n.node_name)+' · '+escape(status)+'</p><p class="text-xs text-slate-500">Último contato: '+(n.last_seen_at?date(n.last_seen_at):'Ainda não conectado')+'</p>'+(n.status!=='revoked'?'<button data-revoke-node="'+escape(n.id)+'" class="mt-2 rounded-lg border border-red-500/50 px-3 py-2 text-xs text-red-300">Desvincular central</button>':'')+'</article>';}).join(''):'Nenhuma central Android vinculada.');
 el('inventory').innerHTML=props.length?props.map(p=>'<article class="rounded-xl border border-slate-700 p-4"><b class="text-white">'+escape(p.title)+'</b><p>'+escape(p.address)+'</p><div class="mt-3 space-y-2">'+devices.filter(d=>d.property_id===p.id).map(d=>'<div class="rounded-lg bg-slate-950 p-3"><b class="text-cyan-200">'+escape(d.device_name)+'</b> · '+(d.manufacturer==='agl_home'?'AGL Home':'Primebras Rio')+'<p class="text-xs text-slate-500">'+escape(d.device_type)+' · '+escape(d.model||'Modelo não informado')+' · Integração pendente</p></div>').join('')+'</div></article>').join(''):'Nenhum imóvel cadastrado.';
 el('invites-list').innerHTML=invites.length?invites.map(i=>{const d=devices.find(x=>x.id===i.device_id);const p=props.find(x=>x.id===d?.property_id);return '<article class="rounded-xl border border-slate-700 p-3"><b class="text-white">'+escape(i.guest_name)+'</b><p>'+escape(p?.title||'Imóvel')+' · '+escape(d?.device_name||'Equipamento')+'</p><p class="text-xs text-slate-400">De '+date(i.starts_at)+' até '+date(i.expires_at)+'</p><p class="mt-1 text-xs '+(i.status==='active'?'text-emerald-300':'text-slate-500')+'">Status: '+escape(i.status)+'</p>'+(i.status==='active'?'<button data-revoke="'+escape(i.id)+'" class="mt-2 rounded-lg border border-red-500/50 px-3 py-2 text-xs text-red-300">Cancelar convite</button>':'')+'</article>';}).join(''):'Nenhum convite emitido.';
}
el('android-create').addEventListener('click',async()=>{
 const out=el('android-pairing-msg'),propertyId=el('android-property').value;
 if(!androidTableReady){out.textContent='Primeiro execute android-pilot.sql no Supabase.';return;}
 if(!propertyId){out.textContent='Selecione o imóvel que será a casa piloto.';return;}
 out.textContent='Gerando código de pareamento...';
 const {data,error}=await db.rpc('create_android_pairing',{p_property_id:propertyId,p_node_name:'HostMaster Android'});
 if(error){out.textContent='Não foi possível gerar: '+error.message;return;}
 const row=Array.isArray(data)?data[0]:data;
 if(!row?.pairing_code){out.textContent='Não foi possível recuperar o código. Atualize a lista.';return;}
 const expiry=new Date(row.expires_at).toLocaleString('pt-BR');
 out.innerHTML='Código de pareamento: <b class="break-all text-white">'+escape(row.pairing_code)+'</b> <button id="copy-android-code" class="ml-2 underline font-bold">Copiar</button><p class="mt-2 text-xs">Use este código no APK da casa selecionada. Ele expira em '+escape(expiry)+' e só pode ser usado uma vez.</p>';
 el('copy-android-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(row.pairing_code);el('copy-android-code').textContent='Copiado!';}catch(_){out.textContent='Não foi possível copiar automaticamente. Selecione e copie o código exibido.';}});
 await load();
});
el('android-node-list').addEventListener('click',async e=>{
 const id=e.target?.dataset?.revokeNode;if(!id)return;
 if(!confirm('Deseja desvincular a central Android deste imóvel?'))return;
 const {error}=await db.rpc('revoke_android_node',{p_node_id:id});
 if(error){alert('Não foi possível desvincular: '+error.message);return;}
 el('android-pairing-msg').textContent='Central desvinculada. Gere um novo código para outro Android, se necessário.';
 await load();
});
el('login').addEventListener('submit',async e=>{e.preventDefault();const {data,error}=await db.auth.signInWithPassword({email:el('email').value,password:el('password').value});if(error){msg(error.message);return;}msg('');await show(data.session);});
el('logout').addEventListener('click',async()=>{await db.auth.signOut();await show(null);});
el('property-form').addEventListener('submit',async e=>{e.preventDefault();const {data:user}=await db.auth.getUser();const {error}=await db.from('access_properties').insert({title:el('property-title').value.trim(),address:el('property-address').value.trim(),owner_id:user.user.id});if(error){alert(error.message);return;}e.target.reset();await load();});
el('device-form').addEventListener('submit',async e=>{e.preventDefault();const {error}=await db.from('access_devices').insert({property_id:el('device-property').value,manufacturer:el('manufacturer').value,device_name:el('device-name').value.trim(),device_type:el('device-type').value,model:el('device-model').value.trim()});if(error){alert(error.message);return;}e.target.reset();await load();});
el('invite-form').addEventListener('submit',async e=>{e.preventDefault();const out=el('invite-msg');out.textContent='Gerando convite seguro...';const start=new Date(el('invite-start').value),end=new Date(el('invite-end').value);if(!el('invite-start').value||!el('invite-end').value||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){out.textContent='Confira as datas: o término deve ser depois do início.';return;}const selectedDevices=Array.from(el('invite-device').selectedOptions).map(o=>o.value).filter(Boolean);if(!selectedDevices.length){out.textContent='Selecione pelo menos um equipamento.';return;}const {data,error}=await db.rpc('create_access_invite_multi',{p_device_ids:selectedDevices,p_guest_name:el('guest-name').value.trim(),p_starts_at:start.toISOString(),p_expires_at:end.toISOString()});if(error){out.textContent='Não foi possível gerar: '+error.message;return;}const row=Array.isArray(data)?data[0]:data;if(!row?.invite_token){out.textContent='Convite criado, mas não foi possível recuperar o código. Atualize a lista.';await load();return;}const link=location.origin+location.pathname+'?invite='+encodeURIComponent(row.invite_token);out.innerHTML='Convite criado. <button id="copy-invite" class="underline font-bold">Copiar link/código</button><p class="mt-2 text-xs">Guarde este link: o código completo só é exibido uma vez. O mesmo link mostra todos os equipamentos do imóvel, destacando somente os autorizados. A abertura física ainda depende da integração oficial de cada fabricante.</p>';el('copy-invite').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link);out.querySelector('button').textContent='Link copiado!';}catch(_){out.textContent='Copie este link manualmente: '+link;}});e.target.reset();await load();});
el('invites-list').addEventListener('click',async e=>{const id=e.target?.dataset?.revoke;if(!id)return;if(!confirm('Deseja cancelar este convite?'))return;const {error}=await db.rpc('revoke_access_invite',{p_invite_id:id});if(error){alert('Não foi possível cancelar: '+error.message);return;}await load();});
async function show(session){el('auth').classList.toggle('hidden',!!session);el('app').classList.toggle('hidden',!session);el('logout').classList.toggle('hidden',!session);if(session)try{await load();}catch(e){msg('Erro ao carregar: '+e.message);}}
db.auth.getSession().then(({data})=>show(data.session));db.auth.onAuthStateChange((_event,session)=>show(session));
})();