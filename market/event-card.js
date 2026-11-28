import {db,date,money} from './client.js';

export function eventCard(event, href, available) {
  const node = (tag, cls, text) => {
    const element = document.createElement(tag);
    element.className = cls;
    if (text != null) element.textContent = text;
    return element;
  };
  const card = node('article','agenda-card');
  const cover = node('div','agenda-cover');
  const path = event.imagenes?.[0];
  if (path) db.storage.from('anuncios').createSignedUrl(path,300).then(({data})=>{
    if (!data?.signedUrl) return;
    const img = new Image();
    img.alt = '';
    img.loading = 'lazy';
    img.src = data.signedUrl;
    cover.prepend(img);
  }).catch(()=>{});
  if (event.categoria) cover.append(node('span','agenda-category',event.categoria));
  const body = node('div','agenda-body');
  const title = node('h3','',event.titulo);
  const link = node('a','agenda-action','Ver detalles y reservar');
  link.href = href;
  link.setAttribute('aria-label','Ver detalles y reservar: '+event.titulo);
  body.append(node('p','agenda-date',date(event.fecha_inicio)),node('p','agenda-place',[event.direccion,event.zona,event.municipio && 'Municipio: '+event.municipio].filter(Boolean).join(' · ')),title);
  if (event.organizador) body.append(node('p','agenda-host',event.organizador));
  body.append(node('strong','agenda-price',Number(event.precio)?money(event.precio,event.moneda):'Gratis'));
  if (available != null) body.append(node('small','',available+' cupos disponibles'));
  body.append(link);
  card.append(cover,body);
  return card;
}
