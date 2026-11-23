(async () => {
  const grid = document.getElementById('featured-track');
  const state = await transaction();
  const now = Date.now();
  const promoted = state.offers.filter(offer =>
    offer.active && offer.promotedUntil > now && Date.parse(offer.date + ':00-04:00') > now
  );
  const examples = ['teatro', 'jazz', 'cafe', 'padel', 'taller']
    .map(key => state.offers.find(offer => offer.key === key));
  const seen = new Set();
  for (const offer of [...promoted, ...examples]) {
    if (!offer || seen.has(offer.key)) continue;
    seen.add(offer.key);
    const card = document.createElement('article');
    const image = new Image();
    image.alt = '';
    image.loading = 'lazy';
    image.src = 'assets/' + offer.image;
    const title = document.createElement('strong');
    title.textContent = offer.title;
    const info = document.createElement('p');
    info.textContent = offer.area + ' · ' + money(offer.price);
    const buy = document.createElement('a');
    buy.className = 'demo-buy';
    buy.href = 'demo.html?plan=' + encodeURIComponent(offer.key);
    buy.textContent = 'Comprar';
    card.append(image, title, info, buy);
    grid.append(card);
  }
})().catch(() => {
  document.getElementById('featured-track').textContent = 'Consulta los planes en el mercado de prueba.';
});
