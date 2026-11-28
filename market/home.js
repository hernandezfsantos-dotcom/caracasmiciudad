import {ubicacionEditorial} from './ubicacion.js';
import {eventCard} from './event-card.js';
import {db,value,money,date} from './client.js';
const form=document.getElementById('buscar-planes'),period=document.getElementById('periodo'),day=document.getElementById('dia');
const startDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift=(s,n)=>new Date(Date.parse(s+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
day.value=day.min=startDate;
period.onchange=()=>{document.getElementById('dia-label').hidden=period.value!=='fecha';day.required=period.value==='fecha'};
  const crear=(tag,text,clase)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(clase)e.className=clase;return e;};
function ficha(a,previo){
    const card=crear('article',null,'free-plan'),figure=crear('figure'),img=crear('img',null,'free-plan-image');
    img.src=a.imagen;img.alt=previo?.querySelector('img')?.alt||'';img.loading='lazy';img.width=432;img.height=288;
    figure.append(img,crear('figcaption','Imagen ilustrativa'),crear('span',a.categoria,'agenda-category'));
    const body=crear('div',null,'free-plan-body'),badge=crear('small'),detalle=crear('details'),enlaces=crear('div',null,'free-plan-links'),fuente=crear('a','Consultar la fuente del evento');
    fuente.href=a.fuente;enlaces.append(fuente);
    const organizador=previo?.querySelector('.free-plan-links a:nth-child(2)');
    if(organizador)enlaces.append(organizador.cloneNode(true));
    detalle.append(crear('summary','Más información'),crear('p',a.descripcion),enlaces);
    badge.append(crear('span',a.etiqueta));body.append(badge,crear('p',a.horario,'free-plan-when'),crear('p',a.lugar,'free-plan-venue'),crear('p','Municipio: '+(ubicacionEditorial(a.lugar,zonasActivas).municipio||'Por confirmar'),'free-plan-venue'),crear('h3',a.titulo),detalle);
    card.append(figure,body);return card;
}
const limpio = texto => (texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
let zonasActivas=[];
let consulta=0;
async function buscar(desplazar=false){
  const version=++consulta, salida=document.getElementById('planes-reales'), estado=document.getElementById('resultado');
  salida.replaceChildren();estado.textContent='Buscando planes…';
  const zona=limpio(document.getElementById('zona').value),categoria=document.getElementById('tipo').value;
  const filtrado=!!(zona||categoria||period.value);
  document.getElementById('restablecer-planes').hidden=!filtrado;
  for(const id of ['planes-gratis','destacados'])document.getElementById(id).hidden=filtrado;
  const fechas=[];
  if(period.value==='hoy')fechas.push(startDate);
  if(period.value==='manana')fechas.push(shift(startDate,1));
  if(period.value==='fecha')fechas.push(day.value);
  if(period.value==='fin'){
    const hoy=new Date(startDate+'T12:00:00Z').getUTCDay();
    for(let i=0;i<=(7-hoy)%7;i++)if([0,5,6].includes((hoy+i)%7))fechas.push(shift(startDate,i));
  }
  try{
    const [editoriales,anuncios]=await Promise.all([
      db.from('agenda_editorial').select('*').eq('publicada',true).gte('hasta',startDate),
      db.from('anuncios').select('id,titulo,categoria,organizador,zona,municipio,direccion,moneda,precio,fecha_inicio,imagenes').eq('estado','publicado').gt('fecha_inicio',new Date().toISOString())
    ]);
    if(version!==consulta)return;
    const planes=[];
    const equivalentes={Exposición:'Artes y cultura',Teatro:'Artes y cultura',Literatura:'Lectura'};
    for(const a of value(editoriales)){
      if(categoria && categoria!==a.categoria && categoria!==equivalentes[a.categoria])continue;
      const lugar=ubicacionEditorial(a.lugar,zonasActivas);
      if(zona && ![limpio(lugar.municipio),limpio(lugar.nombre)].includes(zona))continue;
      const dias=a.dias.filter(d=>d>=startDate && (!fechas.length||fechas.includes(d))).sort();
      if(fechas.length&&!dias.length)continue;
      planes.push({fecha:dias[0]||a.desde,zona:lugar.nombre,municipio:lugar.municipio,card:ficha(a)});
    }
    for(const a of value(anuncios)){
      const fecha=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Caracas'}).format(new Date(a.fecha_inicio));
      if(categoria && categoria!==a.categoria || (zona && ![limpio(a.municipio),limpio(a.zona)].includes(zona)) || fechas.length&&!fechas.includes(fecha))continue;
      planes.push({fecha,zona:a.zona||"Zona por confirmar",municipio:a.municipio,card:eventCard(a,'market/#actividad/'+a.id)});
    }
    planes.sort((a,b)=>a.fecha.localeCompare(b.fecha));
    const grupos=new Map();
    for(const p of planes){
      const nombre=[p.zona,p.municipio].filter(Boolean).join(' · ');
      if(!grupos.has(nombre))grupos.set(nombre,[]);
      grupos.get(nombre).push(p.card);
    }
    for(const nombre of [...grupos.keys()].sort((a,b)=>a.localeCompare(b,'es'))){
      const bloque=crear('section'), grid=crear('div',null,'free-plan-grid');
      grid.append(...grupos.get(nombre));bloque.append(crear('h3',nombre,'free-plan-month-title'),grid);
      salida.append(bloque);
    }
    estado.textContent=planes.length===1?'1 plan encontrado.':planes.length?planes.length+' planes encontrados.':'No encontramos planes. Prueba con otra zona, fecha o categoría.';
    if(desplazar)estado.scrollIntoView({block:'center'});
  }catch{if(version===consulta)estado.textContent='No pudimos cargar los planes. Vuelve a intentarlo.';}
};
form.onsubmit=e=>{e.preventDefault();buscar(true)};
form.addEventListener('change',()=>buscar());
document.getElementById('restablecer-planes').onclick=()=>{
  document.getElementById('zona').value='';
  document.getElementById('tipo').value='';
  period.value='';day.value=startDate;day.required=false;
  document.getElementById('dia-label').hidden=true;
  document.getElementById('zona').focus();
  buscar();
};
async function show(){
  const [cats,zones,rows]=await Promise.all([
    db.from('categorias').select('nombre').eq('activa',true).order('nombre'),
    db.from('zonas').select('nombre,municipio').eq('activa',true).order('nombre'),
    db.from('anuncios').select('id,titulo,categoria,organizador,zona,municipio,direccion,moneda,precio,fecha_inicio,imagenes').eq('estado','publicado').gt('fecha_inicio',new Date().toISOString()).order('fecha_inicio').limit(6)
  ]);
  document.getElementById('tipo').replaceChildren(new Option('Todas',''),...value(cats).map(x=>new Option(x.nombre)));
  zonasActivas=value(zones);
  const selector=document.getElementById('zona');
  for(const municipio of [...new Set(zonasActivas.map(z=>z.municipio))]){
    const grupo=document.createElement('optgroup');grupo.label='Zonas de '+municipio;
    for(const z of zonasActivas.filter(z=>z.municipio===municipio && z.nombre!==municipio))grupo.append(new Option(z.nombre,z.nombre));
    if(grupo.children.length)selector.append(grupo);
  }
  cargarAgendaEditorial().catch(()=>{});
  buscar();
  const grid=document.getElementById('featured-track'),items=value(rows);
  if(!items.length){grid.textContent='Las próximas actividades aparecerán aquí cuando el equipo apruebe los anuncios.';return}
  for (const a of items) grid.append(eventCard(a,'market/#actividad/'+a.id));
}
show().catch(()=>document.getElementById('featured-track').textContent='No se pudo cargar la agenda. Intenta recargar la página.');

async function cargarAgendaEditorial() {
  const datos=value(await db.from('agenda_editorial').select('*').eq('publicada',true).gte('hasta',startDate).order('desde').order('titulo'));
  const seccion=document.getElementById('planes-gratis');
  const anteriores=new Map([...seccion.querySelectorAll('.free-plan')].map(card=>[card.querySelector('img')?.getAttribute('src'),card]));
  const titulo=document.getElementById('planes-gratis-title');
  const nav=document.createElement('nav');nav.className='free-plan-months';nav.setAttribute('aria-label','Mes de la agenda');
  const meses=new Map();

  for(const a of datos){
    const mes=a.desde.slice(0,7);
    if(!meses.has(mes)){
      const grupo=crear('section',null,'free-plan-month'), grid=crear('div',null,'free-plan-grid');
      const nombre=new Intl.DateTimeFormat('es-VE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(a.desde+'T12:00:00Z'));
      grupo.id='agenda-'+mes;grupo.append(crear('h3',nombre,'free-plan-month-title'),grid);
      const salto=crear('a',nombre);salto.href='#'+grupo.id;nav.append(salto);meses.set(mes,{grupo,grid});
    }
    meses.get(mes).grid.append(ficha(a,anteriores.get(a.imagen)));
  }
  seccion.replaceChildren(titulo,nav,...Array.from(meses.values(),m=>m.grupo));
  if(!datos.length)seccion.append(crear('p','Pronto publicaremos más planes gratuitos.'));
}
