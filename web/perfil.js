import {db,login,register,logout} from '../supabase-client.js';
const form=document.querySelector('#perfil'), status=document.querySelector('#estado'), auth=document.querySelector('#auth'), salir=document.querySelector('#salir'), panel=document.querySelector('#panel-perfil');
let user;
const fail=e=>status.textContent=e.message||'No se pudo completar la operación.';
function fields(){const company=form.elements.tipo.value==='empresa';document.querySelector('#organizacion').hidden=!company;form.elements.empresa.required=company;document.querySelector('#comision').hidden=form.elements.tipo.value==='cliente';}
form.elements.tipo.onchange=fields;
async function load(){const {data,error}=await db.auth.getUser();user=data?.user;auth.hidden=!!user;salir.hidden=!user;form.hidden=true;panel.hidden=true;if(!user)return;const p=await db.from('perfiles').select('*').eq('id',user.id).maybeSingle();if(p.error)throw p.error;form.elements.email.value=user.email||'';if(p.data){for(const k of ['nombre','tipo','empresa'])form.elements[k].value=p.data[k]||'';panel.hidden=false;}else form.hidden=false;fields();}
auth.onsubmit=async e=>{e.preventDefault();try{const f=new FormData(auth);const result=await (e.submitter.value==='register'?register:login)(f.get('email'),f.get('password'));if(result.error)throw result.error;status.textContent=result.data.session?'Sesión iniciada.':'Revisa tu correo para confirmar tu cuenta.';await load();}catch(e){fail(e)}};
salir.onclick=async()=>{const r=await logout();if(r.error)return fail(r.error);location.reload();};
document.querySelector('#editar-perfil').onclick=()=>{panel.hidden=true;form.hidden=false;};
form.onsubmit=async e=>{e.preventDefault();try{if(!user)throw Error('Inicia sesión');const {nombre,tipo,empresa}=form.elements;const r=await db.from('perfiles').upsert({id:user.id,nombre:nombre.value,tipo:tipo.value,empresa:empresa.value||null});if(r.error)throw r.error;status.textContent='Perfil guardado.';if(new URLSearchParams(location.search).has('publicar')&&tipo.value!=='cliente')location.assign('./publicar.html');else await load();}catch(e){fail(e)}};
load().catch(fail);
