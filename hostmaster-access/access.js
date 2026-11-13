(function(){
const cfg=window.HOSTMASTER_ACCESS_CONFIG||window.ACCESS_CONFIG||{}, valid=cfg.SUPABASE_URL&&cfg.SUPABASE_URL.includes('.supabase.co')&&cfg.SUPABASE_ANON_KEY&&cfg.SUPABASE_ANON_KEY.length>20;
const el=id=>document.getElementById(id), msg=t=>el('auth-msg').textContent=t;
if(!valid){msg('Configure config.js com as credenciais PUBLICÁVEIS do novo projeto Supabase.');return;}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const inviteToken=new URLSearchParams(location.search).get('invite');
if(inviteToken){
 const guest=el('guest'),state=el('guest-state'),details=el('guest-details');
 el('auth').classList.add('hidden');el('app').classList.add('hidden');guest.classList.remove('hidden');
 db.rpc('validate_access_invite',{p_token:inviteToken}).then(({data,error})=>{
  if(error){state.textContent='Não foi possível validar este convite. Tente novamente mais tarde.';return;}
  const row=Array.isArray(data)?data[0]:data;
  if(!row){state.textContent='Convite não encontrado ou código inválido.';return;}
  const labels={valid:'Convite válido: autorização ativa neste momento.',not_started:'Convite válido, mas ainda não está no período de autorização.',expired:'Este convite expirou.',revoked:'Este convite foi cancelado pelo proprietário.'};
  state.textContent=labels[row.authorization_state]||'Convite sem autorização.';
  const fields=[['Hóspede',row.guest_name],['Equipamento autorizado',row.device_name],['Fabricante',row.manufacturer==='agl_home'?'AGL Home':'Primebras Rio'],['Início',new Date(row.starts_at).toLocaleString('pt-BR')],['Término',new Date(row.expires_at).toLocaleString('pt-BR')]];
  details.replaceChildren(...fields.map(([label,value])=>{const p=document.createElement('p');p.textContent=label+': '+value;return p;}));
 }).catch(()=>{state.textContent='Falha de comunicação ao validar o convite.';});
 return;
}
let props=[],devices=[],invites=[];
function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function date(v){return new Date(v).toLocaleString('pt-BR');}
async function load(){
 const [p,d,i]=await Promise.all([
  db.from('access_properties').select('*').order('created_at',{ascending:false}),
  db.from('access_devices').select('*').order('created_at',{ascending:false}),
  db.from('access_invites').select('id,guest_name,device_id,starts_at,expires_at,status,created_at').order('created_at',{ascending:false})
 ]);
 if(p.error)throw p.error;if(d.error)throw d.error;if(i.error)throw i.error;
 props=p.data||[];devices=d.data||[];invites=i.data||[];
 el('count-properties').textContent=props.length;el('count-devices').textContent=devices.length;
 el('device-property').innerHTML='<option value="">Selecione o imóvel</option>'+props.map(x=>'<option value="'+escape(x.id)+'">'+escape(x.title)+'</option>').join('');
 el('invite-device').innerHTML='<option value="">Selecione o equipamento autorizado</option>'+devices.map(x=>{const p=props.find(y=>y.id===x.property_id);return '<option value="'+escape(x.id)+'">'+escape(p?.title||'Imóvel')+' — '+escape(x.device_name)+'</option>';}).join('');
 el('inventory').innerHTML=props.length?props.map(p=>'<article class="rounded-xl border border-slate-700 p-4"><b class="text-white">'+escape(p.title)+'</b><p>'+escape(p.address)+'</p><div class="mt-3 space-y-2">'+devices.filter(d=>d.property_id===p.id).map(d=>'<div class="rounded-lg bg-slate-950 p-3"><b class="text-cyan-200">'+escape(d.device_name)+'</b> · '+(d.manufacturer==='agl_home'?'AGL Home':'Primebras Rio')+'<p class="text-xs text-slate-500">'+escape(d.device_type)+' · '+escape(d.model||'Modelo não informado')+' · Integração pendente</p></div>').join('')+'</div></article>').join(''):'Nenhum imóvel cadastrado.';
 el('invites-list').innerHTML=invites.length?invites.map(i=>{const d=devices.find(x=>x.id===i.device_id);const p=props.find(x=>x.id===d?.property_id);return '<article class="rounded-xl border border-slate-700 p-3"><b class="text-white">'+escape(i.guest_name)+'</b><p>'+escape(p?.title||'Imóvel')+' · '+escape(d?.device_name||'Equipamento')+'</p><p class="text-xs text-slate-400">De '+date(i.starts_at)+' até '+date(i.expires_at)+'</p><p class="mt-1 text-xs '+(i.status==='active'?'text-emerald-300':'text-slate-500')+'">Status: '+escape(i.status)+'</p>'+(i.status==='active'?'<button data-revoke="'+escape(i.id)+'" class="mt-2 rounded-lg border border-red-500/50 px-3 py-2 text-xs text-red-300">Cancelar convite</button>':'')+'</article>';}).join(''):'Nenhum convite emitido.';
}
el('login').addEventListener('submit',async e=>{e.preventDefault();const {data,error}=await db.auth.signInWithPassword({email:el('email').value,password:el('password').value});if(error){msg(error.message);return;}msg('');await show(data.session);});
el('logout').addEventListener('click',async()=>{await db.auth.signOut();await show(null);});
el('property-form').addEventListener('submit',async e=>{e.preventDefault();const {data:user}=await db.auth.getUser();const {error}=await db.from('access_properties').insert({title:el('property-title').value.trim(),address:el('property-address').value.trim(),owner_id:user.user.id});if(error){alert(error.message);return;}e.target.reset();await load();});
el('device-form').addEventListener('submit',async e=>{e.preventDefault();const {error}=await db.from('access_devices').insert({property_id:el('device-property').value,manufacturer:el('manufacturer').value,device_name:el('device-name').value.trim(),device_type:el('device-type').value,model:el('device-model').value.trim()});if(error){alert(error.message);return;}e.target.reset();await load();});
el('invite-form').addEventListener('submit',async e=>{e.preventDefault();const out=el('invite-msg');out.textContent='Gerando convite seguro...';const start=new Date(el('invite-start').value),end=new Date(el('invite-end').value);if(!el('invite-start').value||!el('invite-end').value||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){out.textContent='Confira as datas: o término deve ser depois do início.';return;}const {data,error}=await db.rpc('create_access_invite',{p_device_id:el('invite-device').value,p_guest_name:el('guest-name').value.trim(),p_starts_at:start.toISOString(),p_expires_at:end.toISOString()});if(error){out.textContent='Não foi possível gerar: '+error.message;return;}const row=Array.isArray(data)?data[0]:data;if(!row?.invite_token){out.textContent='Convite criado, mas não foi possível recuperar o código. Atualize a lista.';await load();return;}const link=location.origin+location.pathname+'?invite='+encodeURIComponent(row.invite_token);out.innerHTML='Convite criado. <button id="copy-invite" class="underline font-bold">Copiar link/código</button><p class="mt-2 text-xs">Guarde este link: o código completo só é exibido uma vez. A tela de validação do hóspede e a integração física serão a próxima etapa.</p>';el('copy-invite').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link);out.querySelector('button').textContent='Link copiado!';}catch(_){out.textContent='Copie este link manualmente: '+link;}});e.target.reset();await load();});
el('invites-list').addEventListener('click',async e=>{const id=e.target?.dataset?.revoke;if(!id)return;if(!confirm('Deseja cancelar este convite?'))return;const {error}=await db.rpc('revoke_access_invite',{p_invite_id:id});if(error){alert('Não foi possível cancelar: '+error.message);return;}await load();});
async function show(session){el('auth').classList.toggle('hidden',!!session);el('app').classList.toggle('hidden',!session);el('logout').classList.toggle('hidden',!session);if(session)try{await load();}catch(e){msg('Erro ao carregar: '+e.message);}}
db.auth.getSession().then(({data})=>show(data.session));db.auth.onAuthStateChange((_event,session)=>show(session));
})();