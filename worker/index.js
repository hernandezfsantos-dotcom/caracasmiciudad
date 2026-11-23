const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const used="COALESCE((SELECT SUM(qty) FROM bookings b WHERE b.listing=l.id AND b.status!='cancelada'),0)";
const categories=['Taller','Teatro','Deporte','Gastronomía','Música','Otro'];
function reject(message,status=400){throw Object.assign(new Error(message),{status});}
function field(v,max){if(typeof v!=='string'||!v.trim()||v.trim().length>max) reject('Revisa los campos del formulario.');return v.trim();}
function checkoutUrl(value){
 let url;
 try{url=new URL(field(value,1200))}catch{reject('Introduce un enlace de pago válido.')}
 if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.'))reject('El enlace de pago debe usar HTTPS.');
 return url.href;
}
function number(v,min,max){if(!Number.isSafeInteger(v)||v<min||v>max) reject('Precio, cantidad o cupos fuera de rango.');return v;}
export default {async fetch(req,env){
 try{
 const url=new URL(req.url),path=url.pathname;
 const user=req.headers.get('oai-authenticated-user-id'),email=req.headers.get('oai-authenticated-user-email');
 if(!path.startsWith('/api/')){
 const key=path==='/'?'/index.html':path==='/mercado'?'/mercado.html':Object.hasOwn(assets,path)?path:'/'+path.slice(1).replaceAll('/','--')+'.html';
 if(!Object.hasOwn(assets,key))return new Response('Página no encontrada',{status:404});
 const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css',webp:'image/webp',jpg:'image/jpeg',png:'image/png',ttf:'font/ttf'};
 return new Response(Uint8Array.from(atob(assets[key]),c=>c.charCodeAt(0)),{headers:{'Content-Type':types[key.split('.').pop()],'X-Content-Type-Options':'nosniff'}});
 }
 const sql=(q,...args)=>env.DB.prepare(q).bind(...args);
 const now=new Date().toISOString();
 const admin=email && Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.toLowerCase()))),x=>x.toString(16).padStart(2,'0')).join('')==='5be94e7add9a7f068ed858b59bd748de15f5d51ff17662f707d18630be1a4505';
 if(path==='/api/foto' && req.method==='GET'){
 const row=await sql('SELECT photo FROM listings WHERE id=?',url.searchParams.get('id')).first();
 if(!row)return new Response(null,{status:404});
 return new Response(Uint8Array.from(atob(row.photo),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=300'}});
 }
 const profile=async()=>user?await sql('SELECT nombre,tipo,empresa FROM perfiles WHERE user_id=?',user).first():null;
 if(path==='/api/perfil' && req.method==='GET')return json({signed:!!user,email:user?email:null,profile:await profile()});
 if(path==='/api/registros' && req.method==='GET'){
 if(!admin)reject('Acceso restringido.',403);
 return json({profiles:(await sql('SELECT nombre,email,tipo,empresa,creado FROM perfiles ORDER BY creado DESC').all()).results});
 }
 if(path==='/api/mercado' && req.method==='GET'){
 const current=await profile();
 const listings=(await sql('SELECT l.id,checkout,seller,title,category,zone,area,description,starts,price,capacity,active,approved,owner=? AS mine,capacity-'+used+' AS available FROM listings l WHERE (active=1 AND approved=1 AND starts>?) OR owner=? OR ?=1 ORDER BY starts',user,now,user,admin?1:0).all()).results;
 const bookings=user?(await sql('SELECT b.id,b.qty,b.total,b.fee,b.status,b.ticket,b.admitted,b.listing,l.area,l.checkout,l.title,l.seller,l.starts,l.owner=? AS managing,CASE WHEN l.owner=? THEN b.email END AS contact FROM bookings b JOIN listings l ON l.id=b.listing WHERE b.buyer=? OR l.owner=? ORDER BY b.created DESC',user,user,user,user).all()).results:[];
 const ledger=admin?(await sql("SELECT l.seller,l.title,b.id,b.total,b.fee FROM bookings b JOIN listings l ON b.listing=l.id WHERE b.status='pagada' ORDER BY b.created DESC").all()).results:[];
 if(!current&&!admin)for(const listing of listings)listing.checkout=listing.checkout?true:null;
 return json({signed:!!user,profile:current,admin:!!admin,listings,bookings,ledger});
 }
 if(req.method!=='POST')return json({error:'Ruta no disponible.'},404);
 if(!user||!email)reject('Inicia sesión para continuar.',401);
 if(req.headers.get('Origin')!==url.origin)reject('Origen no válido.',403);
 if(Number(req.headers.get('content-length'))>450000)reject('La foto es demasiado grande.',413);
 const raw=await req.text();if(raw.length>450000)reject('La foto es demasiado grande.',413);
 let b;try{b=JSON.parse(raw)}catch{reject('Datos inválidos.')}
 if(path==='/api/perfil'){
 const nombre=field(b.nombre,80),tipo=b.tipo;
 if(!['cliente','particular','empresa'].includes(tipo))reject('Selecciona un tipo de cuenta.');
 const empresa=tipo==='empresa'?field(b.empresa,80):'';
 await sql('INSERT INTO perfiles(user_id,email,nombre,tipo,empresa,creado,actualizado) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,nombre=excluded.nombre,tipo=excluded.tipo,empresa=excluded.empresa,actualizado=excluded.actualizado',user,email,nombre,tipo,empresa,now,now).run();
 return json({ok:true});
 }
 if(path==='/api/publicar'){
 const sellerProfile=await profile();
 if(!sellerProfile||sellerProfile.tipo==='cliente')reject('Completa tu perfil de anunciante para publicar.',403);
 if(b.commission!==true)reject('Acepta la comisión del 15 % para publicar.');
 const title=field(b.title,95),seller=sellerProfile.empresa||sellerProfile.nombre,category=field(b.category,25),zone=field(b.zone,80),area=field(b.area,100),description=field(b.description,850);
 if(!categories.includes(category)||!Number.isFinite(Date.parse(b.starts))||new Date(b.starts)<=new Date())reject('Selecciona una categoría y una fecha futura.');
 const photo=field(b.photo,420000);if(!/^\/9j\/[A-Za-z0-9+/]+=*$/.test(photo))reject('Adjunta una fotografía JPEG válida.');
 const id=crypto.randomUUID();await sql('INSERT INTO listings (id,owner,seller,title,category,zone,area,description,starts,price,capacity,photo,checkout) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',id,user,seller,title,category,zone,area,description,new Date(b.starts).toISOString(),number(b.price,1,10000000),number(b.capacity,1,5000),photo,checkoutUrl(b.checkout)).run();return json({id},201);
 }
 if(path==='/api/revisar'){
 if(!admin)reject('Acceso restringido.',403);
 await sql('UPDATE listings SET approved=? WHERE id=?',number(b.approved,0,1),b.id).run();return json({ok:true});
 }
 if(path==='/api/editar'){
 const capacity=number(b.capacity,1,5000),active=number(b.active,0,1);
 const r=await sql('UPDATE listings AS l SET capacity=?,active=? WHERE id=? AND owner=? AND ?>='+used,capacity,active,b.id,user,capacity).run();
 if(!r.meta.changes)reject('Los cupos deben cubrir las reservas existentes.',409);return json({ok:true});
 }
 if(path==='/api/reservar'){
 if(!await profile())reject('Completa tu registro antes de reservar.',403);
 const qty=number(b.qty,1,100);const id=field(b.key,60);
 const r=await sql("INSERT OR IGNORE INTO bookings(id,listing,buyer,email,qty,total,fee) SELECT ?,l.id,?,?,?,l.price*?,CAST((l.price*?*15+50)/100 AS INTEGER) FROM listings l WHERE l.id=? AND active=1 AND approved=1 AND starts>? AND owner<>? AND (l.checkout IS NULL OR ?=1) AND capacity-"+used+">=?",id,user,email,qty,qty,qty,b.id,now,user,qty,qty).run();
 if(!r.meta.changes && !await sql('SELECT id FROM bookings WHERE id=? AND buyer=? AND listing=? AND qty=?',id,user,b.id,qty).first())reject('Esta reserva ya no está disponible. Revisa los cupos.',409);
 return json({id});
 }
 if(path==='/api/admitir'){
 const token=field(b.ticket,64),listing=field(b.listing,64);
 const changed=await sql("UPDATE bookings SET admitted=? WHERE ticket=? AND listing=? AND status='pagada' AND admitted IS NULL AND EXISTS(SELECT 1 FROM listings WHERE id=? AND owner=?)",now,token,listing,listing,user).run();
 if(!changed.meta.changes)reject('Entrada no válida para este evento o ya utilizada.',409);
 return json({ok:true});
 }
 if(path==='/api/estado'){
 if(!['cancelada','pagada'].includes(b.status))reject('Estado inválido.');
 const r=await sql("UPDATE bookings SET status=?,ticket=CASE WHEN ?='pagada' THEN lower(hex(randomblob(16))) ELSE NULL END WHERE id=? AND status='pendiente' AND (listing IN (SELECT id FROM listings WHERE owner=?) OR (buyer=? AND ?='cancelada'))",b.status,b.status,b.id,user,user,b.status).run();
 if(!r.meta.changes)reject('Esta reserva ya cambió.',409);return json({ok:true});
 }
 return json({error:'Ruta no disponible.'},404);
 }catch(e){return json({error:e.status?e.message:'No se pudo completar la operación. Inténtalo de nuevo.'},e.status||500);}
}};
