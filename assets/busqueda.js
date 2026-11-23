(()=>{const $=id=>document.getElementById(id),form=$('buscar-planes'),period=$('periodo'),day=$('dia'),cat=$('tipo'),status=$('resultado'),grid=$('planes-reales');
const zone=$('zona');
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const home='https://caracas-mi-ciudad.hernandezfsantos.chatgpt.site';
const local=location.protocol==='file:'||location.hostname.endsWith('github.io');
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'});
const today=()=>fmt.format(Date.now()), shift=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
day.value=today();day.min=today();
period.onchange=()=>{$('dia-label').hidden=period.value!=='fecha';day.required=period.value==='fecha'};
let pending=0;
async function search(){
 const ticket=++pending;grid.replaceChildren();let start=today(),end=start;
 if(period.value==='manana')start=end=shift(start,1);
 if(period.value==='fecha')start=end=day.value;
 if(period.value==='fin'){const w=new Date(start+'T12:00:00Z').getUTCDay();end=shift(start,(7-w)%7);start=w===0||w===6?start:shift(start,5-w)}
 const query=new URLSearchParams({periodo:period.value,dia:day.value,categoria:cat.value,zona:zone.value.trim()});
 if(local){const link=document.createElement('a');link.href=home+'/?'+query+'#week';link.textContent='Ver resultados en la agenda en línea';status.replaceChildren(link);return}
 status.textContent='Buscando actividades…';
 try{const r=await fetch('/api/mercado');if(!r.ok)throw Error();const {listings}=await r.json();if(ticket!==pending)return;
 const rows=listings.filter(l=>l.approved&&l.active&&Date.parse(l.starts)>Date.now()&&fmt.format(new Date(l.starts))>=start&&fmt.format(new Date(l.starts))<=end&&normalize([l.zone,l.area].filter(Boolean).join(' ')).includes(normalize(zone.value))&&(!cat.value||l.category===cat.value)).sort((a,b)=>Date.parse(a.starts)-Date.parse(b.starts));
 status.textContent=rows.length?rows.length+' actividad'+(rows.length===1?'':'es')+' para tu selección.':'Todavía no hay actividades publicadas para esta selección.';
 for(const l of rows){const a=document.createElement('a'),img=new Image(),title=document.createElement('strong'),meta=document.createElement('small');a.href='/experiencias#oferta-'+encodeURIComponent(l.id);img.src='/api/foto?id='+encodeURIComponent(l.id);img.alt='';title.textContent=l.title;meta.textContent=new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(l.starts))+' · '+[l.zone,l.area].filter(Boolean).join(', ')+' · US$'+(l.price/100).toFixed(2);a.append(img,title,meta);grid.append(a)}
 }catch{if(ticket===pending)status.textContent='No se pudo cargar la agenda. Pulsa «Ver planes» para volver a intentar.'}}
const q=new URLSearchParams(location.search);zone.value=q.get('zona')||'';if(q.has('periodo')){period.value=q.get('periodo');if(!period.value)period.value='hoy';if(/^\d{4}-\d{2}-\d{2}$/.test(q.get('dia')))day.value=q.get('dia');cat.value=q.get('categoria')||'';period.onchange()}
form.onsubmit=e=>{e.preventDefault();search()};search();
})();
