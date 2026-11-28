import {eventCard} from './event-card.js';
import {db,value,money,date} from './client.js';
const form=document.getElementById('buscar-planes'),period=document.getElementById('periodo'),day=document.getElementById('dia');
const startDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift=(s,n)=>new Date(Date.parse(s+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
day.value=day.min=startDate;
period.onchange=()=>{document.getElementById('dia-label').hidden=period.value!=='fecha';day.required=period.value==='fecha'};
form.onsubmit=e=>{
  e.preventDefault();
  const params=new URLSearchParams({zona:document.getElementById('zona').value,categoria:document.getElementById('tipo').value});
  if(period.value==='hoy')params.set('dia',startDate);
  if(period.value==='manana')params.set('dia',shift(startDate,1));
  if(period.value==='fecha')params.set('dia',day.value);
  if(period.value==='fin')params.set('fin','1');
  location.assign('market/?'+params+'#buscar');
};
async function show(){
  const [cats,zones,rows]=await Promise.all([
    db.from('categorias').select('nombre').eq('activa',true).order('nombre'),
    db.from('zonas').select('nombre').eq('activa',true).order('nombre'),
    db.from('anuncios').select('id,titulo,categoria,organizador,zona,municipio,moneda,precio,fecha_inicio,imagenes').eq('estado','publicado').gt('fecha_inicio',new Date().toISOString()).order('fecha_inicio').limit(6)
  ]);
  document.getElementById('tipo').replaceChildren(new Option('Todas',''),...value(cats).map(x=>new Option(x.nombre)));
  document.getElementById('zonas-caracas').replaceChildren(...value(zones).map(x=>new Option(x.nombre)));
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
  const crear=(tag,text,clase)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(clase)e.className=clase;return e;};
  for(const a of datos){
    const mes=a.desde.slice(0,7);
    if(!meses.has(mes)){
      const grupo=crear('section',null,'free-plan-month'), grid=crear('div',null,'free-plan-grid');
      const nombre=new Intl.DateTimeFormat('es-VE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(a.desde+'T12:00:00Z'));
      grupo.id='agenda-'+mes;grupo.append(crear('h3',nombre,'free-plan-month-title'),grid);
      const salto=crear('a',nombre);salto.href='#'+grupo.id;nav.append(salto);meses.set(mes,{grupo,grid});
    }
    const previo=anteriores.get(a.imagen), card=crear('article',null,'free-plan'),figure=crear('figure'),img=crear('img',null,'free-plan-image');
    img.src=a.imagen;img.alt=previo?.querySelector('img')?.alt||'';img.loading='lazy';img.width=432;img.height=288;
    figure.append(img,crear('figcaption','Imagen ilustrativa'),crear('span',a.categoria,'agenda-category'));
    const body=crear('div',null,'free-plan-body'),badge=crear('small'),detalle=crear('details'),enlaces=crear('div',null,'free-plan-links'),fuente=crear('a','Consultar la fuente del evento');
    fuente.href=a.fuente;enlaces.append(fuente);
    const organizador=previo?.querySelector('.free-plan-links a:nth-child(2)');
    if(organizador)enlaces.append(organizador.cloneNode(true));
    detalle.append(crear('summary','Más información'),crear('p',a.descripcion),enlaces);
    badge.append(crear('span',a.etiqueta));body.append(badge,crear('p',a.horario,'free-plan-when'),crear('p',a.lugar,'free-plan-venue'),crear('h3',a.titulo),detalle);
    card.append(figure,body);meses.get(mes).grid.append(card);
  }
  seccion.replaceChildren(titulo,nav,...Array.from(meses.values(),m=>m.grupo));
  if(!datos.length)seccion.append(crear('p','Pronto publicaremos más planes gratuitos.'));
}
cargarAgendaEditorial().catch(()=>{document.getElementById('resultado').textContent='No pudimos actualizar la agenda editorial.';});
