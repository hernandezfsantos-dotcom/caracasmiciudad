const fecha = document.querySelector('#funcion');
const cantidad = document.querySelector('#cantidad');
const comprar = document.querySelector('#entradas-teatro .purchase');
const local = new Intl.DateTimeFormat('sv-SE', {timeZone: 'America/Caracas'});
const formato = new Intl.DateTimeFormat('es-VE', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Caracas'
});
const sesiones = ['2026-11-22','2026-11-28','2026-11-29','2026-12-05','2026-12-06','2026-12-12','2026-12-13'].map(dia => new Date(dia + 'T15:00:00-04:00'));
const teatro = comprar.closest('article');
const tarjetas = Array.from(document.querySelectorAll('.events article'));
const filtros = Array.from(document.querySelectorAll('.filters button'));
let categoria = 'Todos';
let soloFinDeSemana = false;

function actualizarAgenda() {
  const ahora = new Date();
  const siguientes = sesiones.filter(sesion => sesion > ahora);
  const seleccion = fecha.value;
  fecha.replaceChildren(new Option('Consultar fechas', ''));
  for (const sesion of siguientes) {
    const etiqueta = formato.format(sesion);
    fecha.add(new Option(etiqueta, etiqueta));
  }
  if (Array.from(fecha.options).some(opcion => opcion.value === seleccion)) fecha.value = seleccion;
  teatro.dataset.session = siguientes[0]?.toISOString() || '';
  if (siguientes.length) {
    const dia = local.format(siguientes[0]).slice(-2);
    const resto = new Intl.DateTimeFormat('es-VE', {weekday:'short',month:'short',timeZone:'America/Caracas'}).format(siguientes[0]);
    const pequeno = document.createElement('small');
    pequeno.textContent = resto;
    teatro.querySelector('.date').replaceChildren(dia, pequeno);
  }
  const domingo = new Date(local.format(ahora) + 'T23:59:59-04:00');
  const diaLocal = new Date(local.format(ahora) + 'T12:00:00Z').getUTCDay();
  domingo.setUTCDate(domingo.getUTCDate() + (7 - diaLocal) % 7);
  const sabado = domingo.getTime() - 2 * 86400000 + 1000;
  for (const tarjeta of tarjetas) {
    const sesion = Date.parse(tarjeta.dataset.session);
    const coincide = categoria === 'Todos' || tarjeta.dataset.category.includes(categoria);
    tarjeta.hidden = !(sesion > ahora && coincide && (!soloFinDeSemana || (sesion >= sabado && sesion <= domingo)));
  }
  document.querySelector('#sin-planes').hidden = tarjetas.some(tarjeta => !tarjeta.hidden);
  for (const boton of filtros) boton.setAttribute('aria-pressed', String(boton.textContent === categoria));
  document.querySelector('#agenda h2').textContent = soloFinDeSemana ? 'Este fin de semana' : 'Próximos planes';
  actualizarPedido();
}
for (const boton of filtros) boton.addEventListener('click', () => {
  categoria = boton.textContent;
  soloFinDeSemana = false;
  actualizarAgenda();
});
for (const enlace of document.querySelectorAll('[data-filter]')) enlace.addEventListener('click', () => {
  categoria = enlace.dataset.filter;
  soloFinDeSemana = categoria === 'Todos';
  actualizarAgenda();
});
window.addEventListener('pageshow', actualizarAgenda);
function actualizarPedido() {
  const unidades = cantidad.value === '1' ? '1 entrada' : cantidad.value + ' entradas';
  const mensaje = 'Hola, quisiera comprar ' + unidades + ' para La Cenicienta y el Príncipe Vanidoso.' +
    (fecha.value ? ' ¿Hay disponibilidad para el ' + fecha.value + ' a las 3:00 p. m.?' : ' ¿Qué funciones tienen disponibles?');
  const destino = new URL(comprar.href);
  destino.searchParams.set('text', mensaje);
  comprar.href = destino.href;
}
fecha.addEventListener('change', actualizarPedido);
cantidad.addEventListener('change', actualizarPedido);
actualizarAgenda();
