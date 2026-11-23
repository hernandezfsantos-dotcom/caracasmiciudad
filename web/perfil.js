const form=document.querySelector('#perfil'),status=document.querySelector('#estado');
const params=new URLSearchParams(location.search),publish=params.has('publicar'),plan=params.get('plan');
function fields(){
 const company=form.elements.tipo.value==='empresa';
 document.querySelector('#organizacion').hidden=!company;
 form.elements.empresa.required=company;
 document.querySelector('#comision').hidden=form.elements.tipo.value==='cliente';
}
form.elements.tipo.onchange=fields;
async function load(){
 const response=await fetch('/api/perfil');if(!response.ok)throw Error();
 const data=await response.json();
 if(!data.signed){const link=document.querySelector('#identificar');link.href='/signin-with-chatgpt?return_to='+encodeURIComponent(location.pathname+location.search);link.hidden=false;return}
 form.elements.email.value=data.email||'';
 const profile=data.profile;
 if(profile){for(const key of ['nombre','tipo','empresa'])form.elements[key].value=profile[key]}
 if(publish&&form.elements.tipo.value==='cliente')form.elements.tipo.value='particular';
 if(profile&&plan){location.replace('/experiencias#oferta-'+encodeURIComponent(plan));return}
 if(profile&&publish&&profile.tipo!=='cliente'){location.replace('/publicar');return}
 fields();
 if(profile&&!publish){const panel=document.querySelector('#panel-perfil');panel.hidden=false;document.querySelector('#editar-perfil').onclick=()=>{panel.hidden=true;form.hidden=false;form.elements.nombre.focus()}}
 else form.hidden=false;
}
form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{const {nombre,tipo,empresa}=form.elements;const r=await fetch('/api/perfil',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:nombre.value,tipo:tipo.value,empresa:empresa.value})});const d=await r.json();if(!r.ok)throw Error(d.error);
 location.assign(plan?'/experiencias#oferta-'+encodeURIComponent(plan):publish&&tipo.value!=='cliente'?'/publicar':'/mi-cuenta')
 }catch(error){status.textContent=error.message;button.disabled=false}
};
load().catch(()=>status.textContent='No se pudo cargar tu perfil. Recarga la página.');
