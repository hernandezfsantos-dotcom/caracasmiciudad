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
