const $=s=>document.querySelector(s);
const money=c=>new Intl.NumberFormat('es-VE',{style:'currency',currency:'USD'}).format(c/100);
const date=s=>new Intl.DateTimeFormat('es-VE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Caracas'}).format(new Date(s));
const el=(tag,text)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;return node};
let data;
function notice(s){$('#estado').textContent=s}
async function api(path,body){
 const r=await fetch('/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
 const v=await r.json();if(!r.ok)throw Error(v.error||'No se pudo cargar el mercado.');return v;
}
async function action(button,work,message){
 button.disabled=true;
 try{await work();notice(message);await refresh()}catch(e){notice(e.message)}finally{button.disabled=false}
}
function button(label,work,message){const b=el('button',label);b.type='button';b.onclick=()=>action(b,work,message);return b}
function box(parent,title){const n=el('div');n.className='row';n.append(el('h4',title));parent.append(n);return n}
function quantity(parent,title,value,max){
 const label=el('label',title),input=el('input');Object.assign(input,{type:'number',min:'1',max:String(max),step:'1',value:String(value),required:true});label.append(input);parent.append(label);return ()=>{if(!input.reportValidity())throw Error('Revisa la cantidad.');return Number(input.value)};
}
function catalog(){
 const root=$('#catalogo');root.replaceChildren();
 const topic=root.dataset.category;
 const tags={'Gastronomía':['Gastronomía'],'Deporte':['Deporte'],'Artes y cultura':['Teatro','Música'],'Talleres':['Taller'],'Música':['Música']};
 const keywords={'Lectura':'lectura|libro','Juegos':'juego|ajedrez','Cine':'cine|película','Café':'café|cafe','Senderismo':'senderismo|caminata','Naturaleza':'naturaleza|montaña|ávila','Bienestar':'bienestar|yoga'};
 const matches=l=>!topic || tags[topic]?.includes(l.category) || (keywords[topic] && new RegExp(keywords[topic],'i').test(l.title+' '+l.description));
 const visible=data.listings.filter(l=>matches(l)).filter(l=>l.approved&&l.active&&Date.parse(l.starts)>Date.now()&&($('#filtro').value==='Todas'||$('#filtro').value===l.category));
 if(!visible.length)root.append(el('p','Todavía no hay experiencias publicadas en esta selección.'));
 for(const l of visible){
 const n=el('article');n.className='tile';root.append(n);
 const image=el('img');image.src='/api/foto?id='+encodeURIComponent(l.id);image.alt=l.title;image.loading='lazy';
 n.append(image,el('p',l.category+' · '+l.area),el('h3',l.title),el('p',l.description),el('p','Organiza '+l.seller),el('p',date(l.starts)+' · Hora de Caracas'),el('strong',money(l.price)+' por persona'),el('p',l.available+' cupos disponibles'));
 if(!l.available||l.mine)continue;
 if(!data.signed){const a=el('a',l.checkout?'Iniciar sesión para pagar en línea':'Iniciar sesión para reservar');a.href='/signin-with-chatgpt?return_to='+encodeURIComponent(location.pathname);a.target='_top';n.append(a);continue}
 if(l.checkout){
 const pay=el('button','Pagar en línea');pay.type='button';pay.className='purchase';
 const key=crypto.randomUUID();
 n.append(el('small','Una entrada por reserva. Pagarás '+money(l.price)+' en '+new URL(l.checkout).hostname+'. El organizador recibirá tu correo para confirmar el pago.'),pay);
 pay.onclick=async()=>{
  pay.disabled=true;
  try{await api('reservar',{id:l.id,qty:1,key});location.assign(l.checkout)}
  catch(e){notice(e.message);pay.disabled=false}
 };
 continue;
 }
 const qty=quantity(n,'Personas',1,Math.min(100,l.available));
 const total=el('p','Total: '+money(l.price));n.append(total);n.querySelector('input').oninput=e=>total.textContent='Total: '+money(l.price*Number(e.target.value||0));
 let key=crypto.randomUUID();n.append(el('small','Tu correo se compartirá con el organizador para coordinar el pago.'),button('Reservar cupos',async()=>{await api('reservar',{id:l.id,qty:qty(),key});key=crypto.randomUUID()},'Reserva registrada. Puedes verla en Mi actividad.'));
 }
}
function account(){
 const root=$('#personal');root.replaceChildren();
 if(!data.signed)return;
 root.append(el('h3','Mis anuncios'));const mine=data.listings.filter(l=>l.mine);
 if(!mine.length)root.append(el('p','Todavía no has creado anuncios.'));
 for(const l of mine){const n=box(root,l.title);n.append(el('p',(!l.approved?'En revisión':l.active?'Publicado':'Pausado')+' · '+l.available+' cupos libres'));
 const cap=quantity(n,'Cupos totales',l.capacity,5000);
 n.append(button('Guardar cupos',()=>api('editar',{id:l.id,capacity:cap(),active:l.active}),'Cupos actualizados.'),button(l.active?'Pausar anuncio':'Reactivar anuncio',()=>api('editar',{id:l.id,capacity:l.capacity,active:1-l.active}),'Anuncio actualizado.'));
 }
 for(const managing of [false,true]){
 root.append(el('h3',managing?'Reservas recibidas':'Mis reservas'));const list=data.bookings.filter(b=>!!b.managing===managing);
 if(!list.length)root.append(el('p','Todavía no hay reservas.'));
 for(const b of list){const n=box(root,b.title);n.append(el('p',date(b.starts)+' · '+b.qty+' plaza(s) · '+money(b.total)+' · '+b.status));
 if(managing)n.append(el('p','Contacto: '+b.contact),el('p','Comisión: '+money(b.fee)+' · Neto: '+money(b.total-b.fee)));
 if(b.status==='pendiente'){
 if(!managing && b.checkout){
 const pay=el('a','Pagar en línea');pay.href=b.checkout;pay.className='purchase';n.append(pay);
 }
 if(managing)n.append(button('Confirmar pago recibido',()=>{if(!confirm('¿Ya recibiste el pago de '+money(b.total)+'? La comisión será '+money(b.fee)+'.'))throw Error('La reserva sigue pendiente.');return api('estado',{id:b.id,status:'pagada'})},'Venta registrada.'));
 n.append(button('Cancelar reserva',()=>{if(!confirm('¿Cancelar esta reserva y liberar sus cupos?'))throw Error('La reserva sigue pendiente.');return api('estado',{id:b.id,status:'cancelada'})},'Reserva cancelada.'));
 }}
 }
}
function admin(){
 $('#admin').hidden=!data.admin;if(!data.admin)return;const r=$('#revision'),l=$('#libro');r.replaceChildren();l.replaceChildren();
 for(const item of data.listings){const n=box(r,item.title+' · '+item.seller);const photo=el('img');photo.src='/api/foto?id='+encodeURIComponent(item.id);photo.alt=item.title;photo.width=140;if(item.checkout){const link=el('a','Revisar enlace de pago · '+new URL(item.checkout).hostname);link.href=item.checkout;link.target='_blank';link.rel='noopener noreferrer';n.append(link)}n.append(photo,el('p',[item.description,item.area,date(item.starts),money(item.price)].join(' · ')),button(item.approved?'Retirar del catálogo':'Aprobar publicación',()=>api('revisar',{id:item.id,approved:1-item.approved}),'Revisión guardada.'))}
 if(!data.listings.length)r.append(el('p','No hay anuncios para revisar.'));
 l.append(el('strong','Total devengado: '+money(data.ledger.reduce((sum,b)=>sum+b.fee,0))));
 for(const b of data.ledger)box(l,b.seller+' · '+b.title).append(el('p','Venta '+money(b.total)+' · Comisión '+money(b.fee)+' · Reserva '+b.id));
}
async function refresh(){data=await api('mercado');if($('#anuncio'))$('#anuncio').hidden=!data.signed;document.querySelectorAll('.signin').forEach(n=>n.hidden=data.signed);if($('#catalogo'))catalog();if($('#personal'))account();if($('#admin'))admin()}
async function photo(file){
 if(!file||file.size>12*1024*1024)throw Error('Selecciona una foto de menos de 12 MB.');
 const img=await createImageBitmap(file);const c=el('canvas');const scale=Math.min(1,760/img.width,760/img.height);c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);img.close();return c.toDataURL('image/jpeg',.74).split(',')[1];
}
const form=$('#anuncio');for(const cat of ['Taller','Teatro','Deporte','Gastronomía','Música','Otro']){form?.elements.category.add(new Option(cat));$('#filtro')?.add(new Option(cat))}
if(form)form.elements.precio.oninput=()=>{const cents=Math.round(Number(form.elements.precio.value)*100);const fee=Math.round(cents*.15);$('#calculo').textContent='Por una plaza: comisión '+money(fee)+' · Recibes '+money(cents-fee)};
if(form)form.onsubmit=e=>{e.preventDefault();action(form.querySelector('button'),async()=>{
 const b=Object.fromEntries(new FormData(form));await api('publicar',{title:b.title,seller:b.seller,area:b.area,category:b.category,description:b.description,starts:new Date(b.fecha+':00-04:00').toISOString(),checkout:b.checkout,price:Math.round(Number(b.precio)*100),capacity:Number(b.capacity),photo:await photo(b.image)});form.reset();$('#calculo').textContent='';
},'Anuncio enviado. Puedes seguir su revisión en Mi actividad.')};
if($('#filtro'))$('#filtro').onchange=catalog;refresh().catch(e=>notice(e.message));
