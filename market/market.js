import {db,value,money,date,localTime} from './client.js';

const $ = id => document.getElementById(id);
const ui = ['buscar','actividad','clave','cuenta','publicar','admin'];
const filters = $('filters'), listing = $('listing'), profile = $('profile');
const messages = {
  invalid_credentials:'Revisa el correo y la contraseña.',
  email_not_confirmed:'Confirma tu correo antes de entrar.',
  user_already_exists:'Ya hay una cuenta para este correo. Prueba iniciar sesión.',
  over_email_send_rate_limit:'Espera unos minutos antes de pedir otro correo.',
  email_address_not_authorized:'El envío de correos a esta dirección aún no está habilitado.',
  weak_password:'Elige una contraseña más segura.',
  signup_disabled:'El registro está temporalmente cerrado.'
};
let session, person, admin, categories = [], zones = [], edit, offset = 0, searchVersion = 0, routeVersion = 0;
let next = '#cuenta', publicView = '#buscar', accessIntent = '';
const access = $('acceso');
const accessEmail = $('access-email').elements.email;
const accessForms = ['login', 'register', 'recover'];
const selected = form => Object.fromEntries(new FormData(form));
const quote = (a,n = 1) => a.precio ? money(a.precio * n,a.moneda) : 'Gratis';
const notify = t => { $(access.open ? 'access-notice' : 'notice').textContent = t; };
const feedback = e => notify(messages[e.code] || (e.code === 'P0001' ? e.message : e instanceof Error && !e.code && !e.status ? e.message : 'No se pudo completar la operación. Inténtalo de nuevo.'));
const get = async result => value(await result);
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function link(text,href,cls='button') {
  const a = el('a',text,cls);
  a.href = href;
  return a;
}
function action(text,fn) {
  const b = el('button',text);
  b.type = 'button';
  b.onclick = async () => { b.disabled = true; try { await fn(); } catch(e) { feedback(e); } finally { b.disabled = false; } };
  return b;
}
function submit(form,fn) {
  form.onsubmit = async event => {
    event.preventDefault();
    const b = event.submitter;
    if (b) b.disabled = true;
    try { await fn(selected(form)); } catch(e) { feedback(e); } finally { if(b) b.disabled = false; }
  };
}
function setOptions(select, choices, empty) {
  const current = select.value;
  select.replaceChildren(...(empty ? [new Option(empty,'')] : []),...choices.map(x=>new Option(x,x)));
  if (choices.includes(current)) select.value = current;
}
const normalize = input => String(input || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const activity = id => '#actividad/'+id;
function sign(view,intent='') {
  next = view;
  accessIntent = intent;
  location.hash = '#acceso';
}
function accessTitle() {
  return accessIntent === 'reserve' ? 'Entra para reservar'
    : accessIntent === 'favorite' ? 'Entra para guardar tu favorito'
    : next.startsWith('#publicar') ? 'Entra para publicar tu experiencia'
    : 'Entra en Caracas.Hoy';
}
function accessStep(step) {
  const start = step === 'start';
  $('access-start').hidden = !start;
  $('access-email-summary').hidden = start;
  $('access-email-value').textContent = accessEmail.value.trim();
  for (const id of accessForms) $(id).hidden = id !== step;
  $('access-title').textContent = ({
    register:'Crea tu cuenta',
    recover:'Recupera tu contraseña'
  })[step] || accessTitle();
  $('access-description').textContent = ({
    login:'Ingresa tu contraseña o crea una cuenta gratis.',
    register:'Regístrate gratis con tu correo electrónico.',
    recover:'Te enviaremos un enlace para elegir una nueva contraseña.'
  })[step] || 'Inicia sesión o crea una cuenta gratis para continuar.';
  $('access-notice').textContent = '';
  if (!access.open) return;
  const focus = {
    start:accessEmail,
    login:$('login').elements.password,
    register:$('register').elements.nombre,
    recover:$('recover').querySelector('button')
  };
  focus[step].focus();
}
function showAccess() {
  if (!access.open) {
    for (const id of accessForms) $(id).reset();
    accessStep('start');
    access.showModal();
    accessEmail.focus();
  }
}
function dismissAccess() { location.hash = publicView; }
$('close-access').onclick = dismissAccess;
access.oncancel = event => { event.preventDefault(); dismissAccess(); };
submit($('access-email'), ({email}) => {
  $('login').elements.email.value = email.trim();
  $('register').elements.email.value = email.trim();
  accessStep('login');
});
$('change-email').onclick = () => {
  $('login').elements.password.value = '';
  $('register').elements.password.value = '';
  accessStep('start');
};
$('show-register').onclick = () => accessStep('register');
$('show-recover').onclick = () => accessStep('recover');
$('register-back').onclick = $('recover-back').onclick = () => accessStep('login');
function populate(form, all) {
  const f = form.elements;
  setOptions(f.categoria,categories.filter(x=>x.activa).map(x=>x.nombre),all?'Todas':'Selecciona');
  setOptions(f.municipio,[...new Set(zones.filter(x=>x.activa).map(x=>x.municipio))],all?'Todos':'Selecciona');
  const update = () => setOptions(f.zona,zones.filter(x=>x.activa && (!f.municipio.value || x.municipio===f.municipio.value)).map(x=>x.nombre).filter((x,i,a)=>a.indexOf(x)===i),all?'Todas':'Selecciona');
  f.municipio.onchange = update; update();
}
async function metadata() {
  [categories,zones] = await Promise.all([get(db.from('categorias').select('*').order('nombre')),get(db.from('zonas').select('*').order('nombre'))]);
  populate(filters,true); populate(listing,false);
}
async function refreshAccount() {
  [person,admin] = session ? await Promise.all([
    get(db.from('perfiles').select('*').eq('id',session.user.id).maybeSingle()),get(db.rpc('es_admin'))
  ]) : [null,false];
  $('admin-link').hidden = !admin;
}
async function photo(path, where) {
  if (!path) return;
  const image = el('img');
  image.alt = '';
  image.loading = 'lazy';
  const {data} = await db.storage.from('anuncios').createSignedUrl(path,300);
  if (data?.signedUrl) { image.src = data.signedUrl; where.append(image); }
}
function card(a,available) {
  const box = el('article',null,'card');
  const cover = link('',activity(a.id),'card-cover');
  cover.setAttribute('aria-label',a.titulo);
  void photo(a.imagenes?.[0],cover);
  if (!Number(a.precio)) cover.append(el('span','Gratis','card-label'));
  const title = el('h2');
  title.append(link(a.titulo,activity(a.id),'card-title'));
  const area = [a.zona,a.municipio].filter(Boolean).join(' · ');
  box.append(cover,title,el('p',area,'card-meta'),el('p',date(a.fecha_inicio),'card-meta'),
    el('strong',quote(a),'card-price'));
  if (available != null) box.append(el('p',available+' cupos disponibles','card-meta'));
  box.append(link('Ver detalles y reservar',activity(a.id)));
  return box;
}
const searchFields = 'id,titulo,descripcion,categoria,municipio,zona,fecha_inicio,precio,moneda,imagenes';
async function search(reset = true) {
  const turn = ++searchVersion;
  if (reset) {offset = 0;$('more').hidden=true;}
  const out = $('results'), f = selected(filters), rows = [];
  if (reset) out.replaceChildren(el('p','Buscando actividades…'));
  let hasMore = true;
  while (rows.length < 18 && hasMore) {
    const start = offset;
    const end = start + 47;
    let q = db.from('anuncios').select(searchFields).eq('estado','publicado').gt('fecha_inicio',new Date().toISOString()).order('fecha_inicio').order('id').range(start,end);
    for (const key of ['categoria','municipio','zona']) if (f[key]) q = q.eq(key,f[key]);
    if (f.dia) {
      const lo = new Date(f.dia+'T00:00:00-04:00');
      q = q.gte('fecha_inicio',lo.toISOString()).lt('fecha_inicio',new Date(+lo+86400000).toISOString());
    }
    if(filters.dataset.weekend==='1'&&!f.dia){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const d=new Date(today+'T00:00:00-04:00'),weekday=new Date(today+'T12:00:00Z').getUTCDay();if(Number.isFinite(+d)){const begin=weekday===0||weekday===6?0:5-weekday;const end=(7-weekday)%7+1;q=q.gte('fecha_inicio',new Date(+d+begin*86400000).toISOString()).lt('fecha_inicio',new Date(+d+end*86400000).toISOString());}}
    if (f.precio==='gratis') q=q.eq('precio',0);
    if (f.precio==='pago') q=q.gt('precio',0);
    if (f.max!=='') q=q.or('precio.eq.0,and(moneda.eq.'+f.moneda+',precio.lte.'+Number(f.max)+')');
    const data = await get(q);
    const availability = data.length ? await get(db.rpc('cupos_disponibles',{ids:data.map(x=>x.id)})) : [];
    if (turn !== searchVersion) return;
    const counts = new Map(availability.map(x=>[x.anuncio,x.libres]));
    for (const a of data) {
      if (normalize([a.titulo,a.descripcion,a.categoria,a.municipio,a.zona].join(' ')).includes(normalize(f.q))
       && (!f.libres || counts.get(a.id)>0)) rows.push([a,counts.get(a.id) ?? 0]);
    }
    offset = start + data.length;
    hasMore = data.length === 48;
  }
  if(reset) out.replaceChildren();
  for (const [a,n] of rows) out.append(card(a,n));
  if (!out.children.length) out.append(el('p','No encontramos actividades. Prueba con otra fecha, zona o categoría, o limpia los filtros.'));
  $('more').hidden = !hasMore;
}
submit(filters,()=>search());
filters.onreset = ()=>setTimeout(()=>{delete filters.dataset.weekend;filters.elements.municipio.onchange();search().catch(feedback)},0);
$('more').onclick = async () => {
  $('more').disabled = true;
  try { await search(false); } catch(e) { feedback(e); } finally { $('more').disabled = false; }
};
async function detail(id,version) {
  const root = $('actividad');
  root.replaceChildren(el('p','Cargando actividad…'));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return root.replaceChildren(el('p','Actividad no disponible.'));
  const a = await get(db.from('anuncios').select('*').eq('id',id).maybeSingle());
  if (version !== routeVersion) return;
  if (!a || a.estado!=='publicado') return root.replaceChildren(el('p','Actividad no disponible.'),link('Volver a experiencias','#buscar'));
  const [available,favorite] = await Promise.all([
    get(db.rpc('cupos_disponibles',{ids:[a.id]})),
    session && person ? get(db.from('favoritos').select('anuncio_id').eq('usuario_id',session.user.id).eq('anuncio_id',a.id).maybeSingle()) : null
  ]);
  if (version !== routeVersion) return;
  const n = available[0]?.libres ?? 0, photos = el('div',null,'photos');
  for (const path of a.imagenes) void photo(path,photos);
  const save = action(favorite?'Quitar de favoritos':'Guardar en favoritos',async()=>{
    if (!session) return sign(activity(id),'favorite');
    if (!person) return editProfileFor(activity(id));
    if (favorite) await get(db.from('favoritos').delete().eq('usuario_id',session.user.id).eq('anuncio_id',id));
    else await get(db.from('favoritos').insert({usuario_id:session.user.id,anuncio_id:id}));
    await detail(id,routeVersion);
  });
  root.replaceChildren(link('Volver a experiencias','#buscar',''),el('h1',a.titulo),photos,el('p',a.descripcion),
    el('p','Organiza '+(a.organizador||'el anunciante')),el('p',[a.municipio,a.zona,a.direccion].filter(Boolean).join(' · ')),
    el('p',date(a.fecha_inicio)+' · Hora de Caracas'),el('strong',quote(a)+' por persona'),el('p',n+' cupos disponibles'),
    el('p',a.condiciones),el('p',a.precio?'El organizador debe confirmar tu solicitud. Después acordarás el pago directamente con él. '+a.instrucciones:'Actividad gratuita.'),save);
  if (a.anunciante_id===session?.user.id || !n || Date.parse(a.fecha_inicio)<=Date.now()) return;
  if (!session) {
    root.append(action('Entrar para reservar',()=>sign(activity(id),'reserve')));
    return;
  }
  const form = el('form',null,'compact'), label = el('label','Número de participantes'), qty = el('input');
  Object.assign(qty,{type:'number',name:'qty',min:'1',max:String(Math.min(n,100)),value:'1',required:true});
  const total = el('output','Total: '+quote(a)), button = el('button','Solicitar reserva');
  qty.oninput = ()=>{total.textContent='Total: '+quote(a,Number(qty.value))};
  label.append(qty);form.append(label,total,button);root.append(form);
  submit(form,async({qty:count})=>{
    if (!session) return sign(activity(id),'reserve');
    if (!person) return editProfileFor(activity(id));
    await get(db.rpc('pedir_reserva',{actividad:id,plazas:Number(count)}));
    location.hash='#cuenta';notify('Solicitud recibida. Consulta su estado en Mi cuenta.');
  });
}
function editProfileFor(target) {
  next=target;location.hash='#cuenta';$('profile-details').open=true;
  notify(target.startsWith('#publicar') ? 'Elige Anunciante particular o Anunciante empresa en Mi perfil para publicar.' : 'Completa tu perfil para continuar.');
}
function row(root,title,description) {
  const box=el('article',null,'row');
  box.append(el('h3',title),el('p',description));root.append(box);return box;
}
function empty(root,text) {if(!root.children.length) root.append(el('p',text));}
function booking(root,r,host) {
  const a=r.anuncio, box=row(root,a?.titulo||'Actividad',date(a?.fecha_inicio)+' · '+r.cantidad+' plaza(s) · '+r.estado);
  if(r.total!==null)box.append(el('p',(Number(r.total)===0?'Gratis':money(r.total,r.moneda))+' · '+(r.pagada?'Pago recibido':Number(r.total)===0?'Sin cobro':'Pago por coordinar')));
  if(host && r.contacto) box.append(el('p','Correo del cliente: '+r.contacto));
  if(!host&&a?.whatsapp&&r.estado==='confirmada')box.append(el('p',a.instrucciones),link('Contactar por WhatsApp','https://wa.me/'+a.whatsapp.replace('+','')));
  const actions=el('div',null,'buttons');box.append(actions);
  function change(name,status) {actions.append(action(name,async()=>{await get(db.rpc('gestionar_reserva',{reserva:r.id,accion:status}));notify('Reserva actualizada.');await dashboard(routeVersion)}));}
  if(host&&r.estado==='pendiente'){change('Confirmar','confirmada');change('Rechazar','rechazada')}
  if(host&&r.estado==='confirmada')change('Marcar completada','completada');
  if(host&&['confirmada','completada'].includes(r.estado)&&!r.pagada&&Number(r.total)>0)change('Registrar pago recibido','pagada');
  if(host&&r.pagada&&Number(r.total)>0)box.append(el('p','Comisión de Caracas.Hoy: '+money(Number(r.total)*.15,r.moneda)));
  if(!host&&['confirmada','pendiente'].includes(r.estado)&&!r.pagada)change('Cancelar','cancelada');
}
async function dashboard(version) {
  if(!session)return sign('#cuenta');
  const user=session.user.id;
  if(person){for(const key of ['nombre','tipo','empresa','telefono','zona'])profile.elements[key].value=person[key]||'';}
  else $('profile-details').open=true;
  profile.elements.tipo.onchange();
  const [fav,listings,bookings]=await Promise.all([
    get(db.from('favoritos').select('anuncio_id,anuncio:anuncios(id,titulo,zona,municipio,precio,moneda,fecha_inicio,estado,imagenes)').order('creado',{ascending:false})),
    get(db.from('anuncios').select('*').eq('anunciante_id',user).order('creado',{ascending:false})),
    get(db.rpc('minhas_reservas'))
  ]);
  if(version!==routeVersion)return;
  const counts=listings.length?await get(db.rpc('cupos_disponibles',{ids:listings.map(x=>x.id)})):[];
  if(version!==routeVersion)return;
  for(const key of ['favorites','listings','upcoming','history','incoming'])$(key).replaceChildren();
  for(const f of fav){
    const a=f.anuncio;
    const box=a?.estado==='publicado'?card(a):el('article','Actividad fuera del catálogo','card');
    const id=f.anuncio_id||a?.id;
    if(id)box.append(action('Quitar de favoritos',async()=>{await get(db.from('favoritos').delete().eq('usuario_id',user).eq('anuncio_id',id));await dashboard(routeVersion)}));
    $('favorites').append(box);
  }
  for(const a of listings){
    const free=counts.find(x=>x.anuncio===a.id)?.libres;
    const box=row($('listings'),a.titulo,a.estado+' · '+(free??0)+' de '+a.cupos+' cupos libres'+(a.motivo?' · '+a.motivo:''));
    box.append(link('Editar anuncio','#publicar/'+a.id));
    if(a.estado==='publicado')box.append(action('Pausar',async()=>{await get(db.from('anuncios').update({estado:'pausado'}).eq('id',a.id));await dashboard(routeVersion)}));
  }
  for(const r of bookings){
    if(r.cliente_id===user){
      const current=['pendiente','confirmada'].includes(r.estado)&&(!r.anuncio?.fecha_inicio||Date.parse(r.anuncio.fecha_inicio)>Date.now());
      booking($(current?'upcoming':'history'),r,false);
    }else booking($('incoming'),r,true);
  }
  for(const [key,txt] of [['favorites','Todavía no guardaste actividades.'],['listings','Todavía no tienes anuncios.'],['incoming','Todavía no recibiste reservas.'],['upcoming','Todavía no tienes reservas próximas.'],['history','Todavía no hay reservas en el historial.']]) empty($(key),txt);
}
profile.elements.tipo.onchange=()=>{
  const company=profile.elements.tipo.value==='empresa';
  $('company').hidden=!company;profile.elements.empresa.required=company;
};
submit(profile,async f=>{
  await get(db.from('perfiles').upsert({id:session.user.id,nombre:f.nombre.trim(),tipo:f.tipo,empresa:f.tipo==='empresa'?f.empresa.trim():null,telefono:f.telefono.trim(),zona:f.zona.trim()}));
  await refreshAccount();
  const target=next;next='#cuenta';notify('Perfil actualizado.');
  if(target!=='#cuenta')location.hash=target;else await dashboard(routeVersion);
});
function pricing() {
  const f=listing.elements,free=f.gratis.checked;
  f.precio.disabled=free;f.instrucciones.required=!free;
  const price=Number(f.precio.value)||0;
  $('commission').textContent=free?'Actividad gratuita.':price?'Por entrada: comisión '+money(price*.15,f.moneda)+' · Neto '+money(price*.85,f.moneda):'Comisión del 15 % por venta confirmada.';
}
for(const key of ['gratis','precio','moneda'])listing.elements[key].oninput=pricing;
async function publish(id,version) {
  if(!session)return sign('#publicar'+(id?'/'+id:''));
  if(!person||person.tipo==='cliente')return editProfileFor('#publicar'+(id?'/'+id:''));
  const result=id?await get(db.from('anuncios').select('*').eq('id',id).eq('anunciante_id',session.user.id).maybeSingle()):null;
  if(version!==routeVersion)return;
  if(id&&!result)throw Error('Anuncio no disponible.');
  listing.reset();populate(listing,false);edit=result;
  $('listing-title').textContent=edit?'Editar mi experiencia':'Publica tu experiencia';
  if(edit){
    for(const key of ['titulo','categoria','descripcion','municipio','direccion','precio','moneda','cupos','whatsapp','condiciones','instrucciones'])listing.elements[key].value=edit[key]??'';
    listing.elements.municipio.onchange();listing.elements.zona.value=edit.zona;listing.elements.fecha.value=localTime(edit.fecha_inicio);
    listing.elements.gratis.checked=Number(edit.precio)===0;listing.elements.comision.checked=edit.comision_aceptada;
  }
  listing.elements.fotos.required=!edit?.imagenes?.length;pricing();
}
submit(listing,async f=>{
  const photos=[...listing.elements.fotos.files], uploaded=[];
  if(photos.length>5||photos.some(x=>!['image/jpeg','image/png','image/webp'].includes(x.type)||x.size>5242880))throw Error('Selecciona hasta cinco fotos JPG, PNG o WebP de 5 MB cada una.');
  const starts=new Date(f.fecha+':00-04:00');
  if(!(starts>Date.now()))throw Error('Selecciona una fecha futura.');
  const sale={titulo:f.titulo.trim(),descripcion:f.descripcion.trim(),categoria:f.categoria,municipio:f.municipio,zona:f.zona,
    direccion:f.direccion.trim(),whatsapp:f.whatsapp.trim(),condiciones:f.condiciones.trim(),instrucciones:f.instrucciones.trim(),
    precio:f.gratis?0:Number(f.precio),moneda:f.moneda,cupos:Number(f.cupos),comision_aceptada:!!f.comision,fecha_inicio:starts.toISOString(),estado:'pendiente'};
  const old=edit;
  try{
    for(const file of photos){
      const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
      const path=session.user.id+'/'+crypto.randomUUID()+'.'+ext;
      await get(db.storage.from('anuncios').upload(path,file,{contentType:file.type}));uploaded.push(path);
    }
    sale.imagenes=uploaded.length?uploaded:old?.imagenes||[];
    if(old)await get(db.from('anuncios').update(sale).eq('anunciante_id',session.user.id).eq('id',old.id).select('id').single());
    else await get(db.from('anuncios').insert({...sale,anunciante_id:session.user.id}).select('id').single());
  }catch(error){if(uploaded.length)await db.storage.from('anuncios').remove(uploaded);throw error}
  if(old?.imagenes?.length&&uploaded.length)await db.storage.from('anuncios').remove(old.imagenes);
  location.hash='#cuenta';notify('Anuncio enviado a revisión.');
});
async function administration(version) {
  if(!admin)throw Error('Acceso restringido.');
  const [data,listings]=await Promise.all([get(db.rpc('panel_administrativo')),get(db.from('anuncios').select('*').order('creado',{ascending:false}))]);
  if(version!==routeVersion)return;
  for(const key of ['moderation','users','admin-bookings','audit','taxonomy-list'])$(key).replaceChildren();
  $('stats').textContent=data.usuarios.length+' perfiles · '+listings.filter(x=>x.estado==='pendiente').length+' anuncios pendientes · '+listings.filter(x=>x.estado==='publicado').length+' publicados';
  for(const a of listings){
    const box=row($('moderation'),a.titulo,[a.estado,a.organizador,a.municipio,a.zona,a.direccion,date(a.fecha_inicio),quote(a),a.descripcion,a.condiciones,a.instrucciones,a.motivo].filter(Boolean).join(' · '));
    const images=el('div',null,'photos');box.append(images);for(const image of a.imagenes)void photo(image,images);
    const label=el('label','Motivo del rechazo'),reason=el('textarea');reason.maxLength=500;label.append(reason);box.append(label);
    const actions=el('div',null,'buttons');box.append(actions);
    for(const [name,state] of [['Aprobar','publicado'],['Rechazar','rechazado'],['Pausar','pausado']]){
      if(state===a.estado)continue;
      actions.append(action(name,async()=>{await get(db.rpc('moderar_anuncio',{actividad:a.id,nuevo:state,razon:reason.value.trim()}));notify('Moderación guardada.');await administration(routeVersion)}));
    }
  }
  for(const u of data.usuarios)row($('users'),u.nombre,[u.tipo,u.empresa,u.email,date(u.creado)].filter(Boolean).join(' · '));
  for(const r of data.reservas)row($('admin-bookings'),listings.find(a=>a.id===r.anuncio_id)?.titulo||r.anuncio_id,r.estado+' · '+r.cantidad+' plazas · '+money(r.total,r.moneda)+' · '+(r.pagada?'Pago registrado · Comisión del 15 %: '+money(Number(r.total)*.15,r.moneda):Number(r.total)===0?'Gratis':'Pago pendiente'));
  for(const a of data.acciones)row($('audit'),a.accion,[a.objeto,a.detalle,date(a.fecha)].filter(Boolean).join(' · '));
  for(const [clase,items] of [['categoria',categories],['zona',zones]])for(const item of items){
    const box=row($('taxonomy-list'),item.nombre,[item.municipio,item.activa?'Activa':'Inactiva'].filter(Boolean).join(' · '));
    box.append(action(item.activa?'Desactivar':'Activar',async()=>{await get(db.rpc('gestionar_catalogo',{clase,nombre_nuevo:item.nombre,municipio_nuevo:item.municipio||'',habilitada:!item.activa}));await metadata();await administration(routeVersion)}));
  }
  for(const key of ['moderation','users','admin-bookings','audit'])empty($(key),'Todavía no hay registros.');
}
submit($('taxonomy'),async f=>{await get(db.rpc('gestionar_catalogo',{...f,habilitada:!!f.habilitada}));await metadata();await administration(routeVersion);notify('Catálogo actualizado.');});
const callback = () => new URL('./',location.href).href;
const returnKey = 'caracas-market-return';
function rememberReturn() { sessionStorage.setItem(returnKey,next); }
function finishAccess(target) {
  sessionStorage.removeItem(returnKey);
  if (access.open) access.close();
  location.hash = target;
}
async function enableGoogle() {
  const settings = await fetch(db.supabaseUrl+'/auth/v1/settings',{headers:{apikey:db.supabaseKey}});
  if (!settings.ok) throw Error();
  const {external} = await settings.json();
  $('google-login').disabled = !external?.google;
  $('google-status').hidden = !!external?.google;
  $('google-status').textContent = 'El acceso con Google estará disponible próximamente.';
}
enableGoogle().catch(()=>{$('google-status').textContent = 'Google no está disponible por el momento.';});
$('google-login').onclick = async () => {
  const button = $('google-login');
  button.disabled = true;
  try {
    rememberReturn();
    await get(db.auth.signInWithOAuth({provider:'google',options:{redirectTo:callback()}}));
  } catch(error) { feedback(error);button.disabled = false; }
};
submit($('login'),async f=>{
  const data=await get(db.auth.signInWithPassword(f));session=data.session;await refreshAccount();
  $('login').reset();finishAccess(next);notify('Sesión iniciada.');
});
submit($('register'),async f=>{
  rememberReturn();
  const data=await get(db.auth.signUp({email:f.email,password:f.password,options:{data:{nombre:f.nombre},emailRedirectTo:callback()}}));
  $('register').elements.password.value = '';
  if(data.session){session=data.session;await refreshAccount();finishAccess(next);return}
  notify('Revisa tu correo y abre el enlace para confirmar tu cuenta.');
});
submit($('recover'),async()=>{await get(db.auth.resetPasswordForEmail(accessEmail.value.trim(),{redirectTo:callback()}));notify('Si existe la cuenta, recibirás un enlace para cambiar tu contraseña.');});
submit($('password'),async f=>{await get(db.auth.updateUser(f));$('password').reset();location.hash='#cuenta';notify('Contraseña actualizada.');});
$('logout').onclick=async()=>{try{await get(db.auth.signOut());session=null;sessionStorage.removeItem(returnKey);await refreshAccount();next='#cuenta';location.hash='#acceso';notify('Sesión cerrada.')}catch(e){feedback(e)}};
function defaults() {
  const search=new URLSearchParams(location.search), f=filters.elements;
  for(const k of ['q','categoria','municipio','dia'])if(search.has(k))f[k].value=search.get(k);
  if(search.has('fin'))filters.dataset.weekend='1';
  f.municipio.onchange();
  if(search.has('zona')){const zone=search.get('zona'),found=[...f.zona.options].find(x=>normalize(x.value)===normalize(zone));if(found)f.zona.value=found.value;else f.q.value=[f.q.value,zone].filter(Boolean).join(' ');}
}
async function route() {
  const version=++routeVersion;
  const [name,id]=location.hash.slice(1).split('/');
  if (name==='acceso') {
    if (session) { finishAccess(next);return; }
    if (!['buscar','actividad'].some(page=>!$(page).hidden)) {
      for (const page of ui) $(page).hidden = page!=='buscar';
      search().catch(feedback);
    }
    showAccess();
    return;
  }
  if (access.open) access.close();
  const view=ui.includes(name)?name:'buscar';
  if (view==='buscar'||view==='actividad') publicView=location.hash||'#buscar';
  if(!session&&['cuenta','publicar','admin','clave'].includes(view))return sign('#'+name+(id?'/'+id:''));
  if(view==='admin'&&!admin){location.hash='#cuenta';notify('Acceso restringido.');return}
  for(const page of ui)$(page).hidden=page!==view;
  if(view==='buscar')await search();
  else if(view==='actividad')await detail(id||'',version);
  else if(view==='cuenta')await dashboard(version);
  else if(view==='publicar')await publish(id,version);
  else if(view==='admin')await administration(version);
}
let recovering=false;
db.auth.onAuthStateChange((event,current)=>{
  if(event==='PASSWORD_RECOVERY'){recovering=true;session=current;location.hash='#clave';}
  if(event==='SIGNED_OUT'&&session){session=null;person=null;admin=false;$('admin-link').hidden=true;route().catch(feedback)}
});
(async()=>{
  session=(await get(db.auth.getSession())).session;
  await refreshAccount();
  await metadata();
  defaults();
  if(recovering) {
    sessionStorage.removeItem(returnKey);
    location.hash='#clave';
  } else if(session) {
    const pending=sessionStorage.getItem(returnKey);
    if(pending && /^#(?:cuenta|publicar(?:\/[a-f0-9-]{36})?|actividad\/[a-f0-9-]{36})$/i.test(pending)) finishAccess(pending);
  }
  window.addEventListener('hashchange',()=>route().catch(feedback));
  await route();
})().catch(feedback);
