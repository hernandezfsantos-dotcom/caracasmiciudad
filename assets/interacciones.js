(() => {
 const words=['Teatro','Música','Gastronomía','Deporte','Taller'];
 const word=document.querySelector('#rotating-plan');let i=0;
 if(word&&!matchMedia('(prefers-reduced-motion: reduce)').matches)setInterval(()=>{
   const next=word.cloneNode(false);i=(i+1)%words.length;next.textContent=words[i];
   document.querySelector('#rotating-plan').replaceWith(next);
 },2200);
 const destinations={Entrar:'market/#cuenta',Precios:'web/comision.html',Ayuda:'web/ayuda.html',App:'market/#cuenta'};
 for(const anchor of document.querySelectorAll('a')){
   const label=anchor.textContent.trim();
   if (destinations[label]) anchor.href=destinations[label];
   if(anchor.closest('footer')&&label==='Eventos')anchor.href='#week';
   if(['Contacto','Privacidad','Términos'].includes(label))anchor.href='web/ayuda.html';
 }
})();

document.getElementById('copiar-mercado').addEventListener('click',async()=>{
 const url=new URL('market/#buscar', location.href).href,status=document.getElementById('copia-estado');
 try{await navigator.clipboard.writeText(url);status.textContent='Enlace copiado.'}
 catch{status.textContent='Copia este enlace: '+url;status.style.overflowWrap='anywhere'}
});
