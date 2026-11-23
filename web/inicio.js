const word=document.querySelector('#rotar'), words=['Teatro','Gastronomía','Deporte','Música'];let index=0;
if(!matchMedia('(prefers-reduced-motion: reduce)').matches)setInterval(()=>{index=(index+1)%words.length;word.textContent=words[index];word.animate([{opacity:0,transform:'translateY(.13em)'},{opacity:1,transform:'none'}],{duration:340})},3200);
document.querySelector('.filters').onclick=e=>{const btn=e.target.closest('button');if(!btn)return;document.querySelectorAll('.filters button').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));document.querySelectorAll('#catalog .plan').forEach(c=>c.hidden=btn.textContent!=='Todas'&&btn.textContent!==c.dataset.cat)};
async function weekend(){
 const response=await fetch('/api/mercado');if(!response.ok)return;const {listings}=await response.json();
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'});const start=new Date(day.format(new Date())+'T12:00:00Z');let weekday=start.getUTCDay();start.setUTCDate(start.getUTCDate()+(weekday===0?-2:weekday===6?-1:5-weekday));const end=new Date(start);end.setUTCDate(end.getUTCDate()+2);
 const offers=listings.filter(l=>l.approved&&l.active&&l.available>0&&Date.parse(l.starts)>Date.now()&&day.format(new Date(l.starts))>=day.format(start)&&day.format(new Date(l.starts))<=day.format(end));
 document.querySelector('#estado').textContent=offers.length?'Experiencias con entradas disponibles.':'Todavía no hay entradas disponibles para este fin de semana.';
 for(const l of offers.slice(0,6)){const a=document.createElement('a'),pic=new Image(),title=document.createElement('strong'),meta=document.createElement('small');a.className='plan';a.href='/experiencias#oferta-'+encodeURIComponent(l.id);pic.src='/api/foto?id='+encodeURIComponent(l.id);pic.alt='';title.textContent=l.title;meta.textContent=l.area+' · '+new Intl.NumberFormat('es-VE',{style:'currency',currency:'USD'}).format(l.price/100);a.append(pic,title,meta);document.querySelector('#week').append(a)}
}
weekend().catch(()=>{});
