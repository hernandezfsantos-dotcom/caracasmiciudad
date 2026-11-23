const id=s=>document.getElementById(s);
const session=()=>sessionStorage.getItem('caracas-demo-user');
const fail=message=>{throw Error(message)};
async function hash(key,salt){const bytes=new TextEncoder(),material=await crypto.subtle.importKey('raw',bytes.encode(key),'PBKDF2',false,['deriveBits']);const digest=await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes.encode(salt),iterations:150000,hash:'SHA-256'},material,256);return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')}
const node=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n};
function notice(t){id('notice').textContent=t}
function action(fn){return async e=>{e?.preventDefault();try{await fn(e)}catch(error){notice(error.message)}}}
function button(label,fn){const b=node('button',label);b.type='button';b.onclick=action(fn);return b}
let editing=null,selected=new URLSearchParams(location.search).get('plan'),quote=null;
const sold=(state,key)=>state.sales.filter(s=>s.offer===key).length;
const future=o=>Date.parse(o.date+':00-04:00')>Date.now();
const activeUser=state=>state.accounts.some(a=>a.alias===session())?session():null;
const editor=id('editor');
for(const row of seeds)editor.elements.image.add(new Option(row[1],row[4]));
function clearEditor(){editing=null;editor.reset();id('editor-title').textContent='Crear una oferta';id('net').textContent=''}
function estimate(){const n=Math.round(100*Number(editor.elements.price.value));id('net').textContent='Comisión del 15 %: '+money(fee(n))+' · Recibes '+money(n-fee(n))}
editor.elements.price.oninput=estimate;id('reset').onclick=clearEditor;
function checkout(o){selected=o.key;if(!session()){notice('Crea tu cuenta de prueba o entra para continuar con la compra.');id('login').elements.alias.focus();return}
 quote={key:o.key,price:o.price,id:crypto.randomUUID()};id('summary').textContent=o.title+' · '+o.area+' · Una entrada por '+money(o.price)+'. No se realizará ningún cargo.';id('pay').showModal()}
async function render(){const state=await transaction(),user=activeUser(state);
 id('member').hidden=!user;id('guest').hidden=!!user;id('gestion').hidden=!user;id('who').textContent=user||'';for(const key of ['catalog','mine','history'])id(key).replaceChildren();
 for(const o of state.offers){const count=sold(state,o.key),available=o.capacity-count;
 if(o.active&&future(o)){const n=node('article',''),img=new Image();img.src='assets/'+o.image;img.alt='';const buy=button('Comprar',()=>checkout(o));buy.disabled=available<1;n.append(img,node('h3',o.title),node('p',o.area),node('p',o.date.replace('T',' · ')+' · '+available+' cupos'),node('strong',money(o.price)+' por persona'),node('p',''),buy);id('catalog').append(n)}
 if(user&&o.owner===user){const n=node('article','');n.append(node('strong',o.title),node('p',(o.active?'Publicada':'Pausada')+' · '+count+' entradas vendidas'),button(o.promotedUntil>Date.now()?'Destacado activo':'Pagar destaque · US$ 5 (prueba)',async()=>{
 if(o.promotedUntil>Date.now()){notice('Tu oferta ya está destacada.');return}
 if(!confirm('¿Simular US$ 5 por siete días en la portada? No se realiza ningún cargo.'))return;
 await transaction(s=>{const item=s.offers.find(x=>x.key===o.key&&x.owner===session());if(!item||!item.active||!future(item))fail('Activa una oferta futura.');if(!(item.promotedUntil>Date.now()))item.promotedUntil=Date.now()+7*86400000});notice('Destaque simulado activo durante siete días.');await render()
 }),button('Editar',()=>{editing=o.key;for(const k of ['title','area','date','capacity','image'])editor.elements[k].value=o[k];editor.elements.price.value=o.price/100;estimate();id('editor-title').textContent='Editar oferta';editor.elements.title.focus()}),button(o.active?'Pausar':'Reactivar',async()=>{await transaction(s=>{const item=s.offers.find(i=>i.key===o.key&&i.owner===session());if(!item)fail('Inicia sesión.');item.active=!o.active});await render()}));id('mine').append(n)}
 }
 if(user&&!id('mine').children.length)id('mine').textContent='Crea tu primera oferta de prueba.';
 for(const s of state.sales.slice().reverse()){if(!user||s.buyer!==user&&s.owner!==user)continue;const n=node('article','');n.append(node('strong',s.title),node('p','Compra simulada · '+money(s.total)+' · Ref. '+s.id.slice(0,8)));if(s.buyer===user){n.append(ticketQR(s.id),node('p','Código: '+s.id),node('p',s.used?'Entrada utilizada':'Entrada de prueba · Presenta este QR en la puerta.'))}
 if((s.owner===user||(!s.owner&&s.buyer===user))&&!s.used){const input=document.createElement('input');input.placeholder='Código del QR';input.setAttribute('aria-label','Código para el control de acceso');n.append(input,scanButton(input),button('Validar entrada de prueba',async()=>{await transaction(state=>{const sale=state.sales.find(x=>x.id===input.value.trim()&&x.offer===s.offer);if(!sale||!(sale.owner===session()||(!sale.owner&&sale.buyer===session())))fail('Entrada no válida para este evento.');if(sale.used)fail('Esta entrada ya se utilizó.');sale.used=true});notice('Entrada validada. Acceso registrado.');await render()}))}
 if(s.owner===user)n.append(node('p','Venta · Comisión '+money(s.fee)+' · Neto '+money(s.total-s.fee)));id('history').append(n)}
 if(!id('history').children.length)id('history').textContent='Aquí aparecerán tus operaciones de prueba.';
}
id('login').onsubmit=action(async e=>{const f=e.target,alias=f.elements.alias.value.trim().toLowerCase(),key=f.elements.clave.value;if(!alias)fail('Introduce un alias.');const register=e.submitter?.value==='register';const state=await transaction(),account=state.accounts.find(a=>a.alias===alias);
 if(register){if(!f.elements.terms.checked)fail('Acepta la comisión del 15 % para crear la cuenta.');const salt=crypto.randomUUID(),digest=await hash(key,salt);await transaction(s=>{if(s.accounts.some(a=>a.alias===alias))fail('Este alias ya está registrado.');s.accounts.push({alias,salt,digest,accepted:new Date().toISOString()})})}
 else if(!account||await hash(key,account.salt)!==account.digest)fail('Comprueba el alias y la clave de prueba.');
 sessionStorage.setItem('caracas-demo-user',alias);f.reset();notice('Sesión iniciada.');await render();const o=state.offers.find(o=>o.key===selected);if(o)checkout(o)
});
id('logout').onclick=action(async()=>{sessionStorage.removeItem('caracas-demo-user');selected=null;clearEditor();notice('Sesión cerrada.');await render()});
editor.onsubmit=action(async()=>{const f=Object.fromEntries(new FormData(editor)),o={title:f.title.trim(),area:f.area.trim(),price:Math.round(Number(f.price)*100),capacity:Number(f.capacity),date:f.date,image:f.image};if(!o.title||!o.area||!future(o))fail('Revisa el título, el lugar y la fecha futura.');
 await transaction(s=>{const user=activeUser(s);if(!user)fail('Inicia sesión.');if(editing){const item=s.offers.find(i=>i.key===editing&&i.owner===user);if(!item||sold(s,editing)>o.capacity)fail('Los cupos deben cubrir las ventas realizadas.');Object.assign(item,o)}else s.offers.push({...o,key:crypto.randomUUID(),active:true,owner:user})});clearEditor();notice('Oferta guardada en el mercado de prueba.');await render()});
id('cancel').onclick=()=>id('pay').close();
id('confirm').onclick=action(async()=>{const q=quote;id('pay').close();await transaction(s=>{const o=s.offers.find(i=>i.key===q.key),user=activeUser(s);if(!user||!o?.active||!future(o)||o.price!==q.price||sold(s,o.key)>=o.capacity)fail('La oferta ha cambiado. Vuelve a consultar sus datos.');if(!s.sales.some(r=>r.id===q.id))s.sales.push({id:q.id,offer:o.key,title:o.title,owner:o.owner,buyer:user,total:o.price,fee:fee(o.price)})});selected=null;notice('Compra simulada confirmada. Consulta el recibo en Mis compras y ventas.');await render()});
action(async()=>{await render();const o=(await transaction()).offers.find(o=>o.key===selected);if(o)checkout(o)})();
