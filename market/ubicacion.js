const limpio = texto => (texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const municipios=['Baruta','Chacao','El Hatillo','Libertador','Sucre'];
export function ubicacionEditorial(lugar,zonasActivas=[]){
  const texto=limpio(lugar);
  const zonas=[...zonasActivas,{nombre:'La Castellana',municipio:'Chacao'},
    ...[['Los Caobos','Libertador'],['Bellas Artes','Libertador'],['Montalbán','Libertador'],['Manzanares','Baruta'],['La Trinidad','Baruta'],['Bello Monte','Baruta'],['Terrazas del Ávila','Sucre']].map(([nombre,municipio])=>({nombre,municipio}))];
  if(texto.includes('plaza de los museos'))return {nombre:'Bellas Artes',municipio:'Libertador'};
  if(texto.includes('ucv'))return {nombre:'Ciudad Universitaria',municipio:'Libertador'};
  if(texto.includes('los galpones'))return {nombre:'Los Chorros',municipio:'Sucre'};
  return zonas.sort((a,b)=>b.nombre.length-a.nombre.length).find(z=>texto.includes(limpio(z.nombre))) ||
    {nombre:'Zona por confirmar',municipio:municipios.find(m=>texto.includes(limpio(m)))||''};
}

export function direccionEditorial(lugar, zonas) {
  const {municipio}=ubicacionEditorial(lugar,zonas);
  const partes=lugar.split(',').map(parte=>parte.trim());
  if(municipio && limpio(partes.at(-1))===limpio(municipio) && partes.length>1) partes.pop();
  return partes.join(', ')+(municipio?' · Municipio: '+municipio:'');
}
