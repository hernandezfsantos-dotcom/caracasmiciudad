const list=document.getElementById('registros'),labels={cliente:'Comprador',particular:'Anunciante particular',empresa:'Empresa'};
list.parentElement.ontoggle=async()=>{
 if(!list.parentElement.open)return;
 try{const r=await fetch('/api/registros');if(!r.ok)throw Error();const {profiles}=await r.json();list.replaceChildren();
 for(const p of profiles){const row=document.createElement('p');row.textContent=[p.nombre,p.empresa,p.email,labels[p.tipo],p.creado.slice(0,10)].filter(Boolean).join(' · ');list.append(row)}
 if(!profiles.length)list.textContent='Todavía no hay perfiles registrados.';
 }catch{list.textContent='No se pudieron cargar los registros.'}
};
