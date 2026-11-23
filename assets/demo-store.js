const seeds=[
 ['teatro','Monólogo a media luz','Sala de prueba, La Castellana',1400,'plan-teatro.webp'],
 ['taller','Cerámica en el barrio','Estudio de prueba, La Floresta',2200,'plan-taller.webp'],
 ['cafe','Cata de café venezolano','Los Palos Grandes, Chacao',1200,'plan-cena.webp'],
 ['avila','Caminata guiada por el Ávila','Sabás Nieves, Altamira',1800,'avila.webp'],
 ['cine','Cine al aire libre','Plaza Los Palos Grandes',800,'plan-cine.webp'],
 ['jazz','Jazz en vivo','Las Mercedes, Baruta',2500,'plan-jazz.webp'],
 ['padel','Clase de pádel','La Trinidad, Baruta',1600,'plan-padel.webp']
];
const money=n=>'US$ '+(n/100).toFixed(2),fee=n=>Math.round(n*.15);
const initial=()=>({accounts:[],sales:[],offers:seeds.map(([key,title,area,price,image],i)=>({key,title,area,price,image,capacity:20,active:true,owner:null,date:new Date(Date.now()+(i+1)*86400000).toISOString().slice(0,10)+'T18:00'}))});
const database=new Promise((resolve,reject)=>{const r=indexedDB.open('caracas-hoy-demo',1);r.onupgradeneeded=()=>r.result.createObjectStore('market');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function transaction(change){
 const db=await database;
 return new Promise((resolve,reject)=>{const tx=db.transaction('market','readwrite'),store=tx.objectStore('market'),req=store.get('state');let state,error;
 req.onsuccess=()=>{try{state=req.result||initial();for(const item of initial().offers){if(!state.offers.some(o=>o.key===item.key))state.offers.push(item)}
 if(change)change(state);store.put(state,'state')}catch(e){error=e;tx.abort()}};
 tx.oncomplete=()=>resolve(state);tx.onabort=()=>reject(error||tx.error)});
}
