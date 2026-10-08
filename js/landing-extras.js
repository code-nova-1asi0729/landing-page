// ---------- Pricing: monthly/yearly toggle + carousel ----------
(function () {
  const track = document.getElementById('price-track');
  if (!track) return;
  const carousel = track.closest('.pricing-carousel');
  const prev = document.getElementById('price-prev');
  const next = document.getElementById('price-next');
  const dotsBox = document.getElementById('price-dots');
  const plans = Array.from(track.querySelectorAll('.plan'));

  // Billing toggle
  document.querySelectorAll('[data-billing]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.billing;
      document.querySelectorAll('[data-billing]').forEach((b) => b.classList.toggle('on', b === btn));
      track.querySelectorAll('.amount[data-monthly]').forEach((el) => { el.textContent = el.dataset[mode]; });
      track.querySelectorAll('.plan-billed[data-monthly-text]').forEach((el) => {
        el.textContent = mode === 'yearly' ? el.dataset.yearlyText : el.dataset.monthlyText;
      });
    });
  });

  // Carousel
  plans.forEach((_, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.setAttribute('aria-label', 'Go to plan ' + (i + 1));
    d.addEventListener('click', () => goTo(i));
    dotsBox.appendChild(d);
  });
  const dots = Array.from(dotsBox.children);

  function step() { return plans[0].offsetWidth + 24; }
  function goTo(i, instant) {
    const p = plans[Math.max(0, Math.min(plans.length - 1, i))];
    track.scrollTo({ left: p.offsetLeft - (track.clientWidth - p.offsetWidth) / 2, behavior: instant ? 'instant' : 'smooth' });
  }
  function current() {
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0, dist = Infinity;
    plans.forEach((p, i) => {
      const d = Math.abs(p.offsetLeft + p.offsetWidth / 2 - center);
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  }
  function update() {
    const scrollable = track.scrollWidth > track.clientWidth + 4;
    carousel.classList.toggle('scrollable', scrollable);
    dotsBox.classList.toggle('show', scrollable);
    prev.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    const c = current();
    dots.forEach((d, i) => d.classList.toggle('on', i === c));
  }
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', update, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
  });
  window.addEventListener('resize', update);

  // Mouse drag (touch screens already have native swipe)
  let down = false, startX = 0, startLeft = 0;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.target.closest('a,button')) return;
    down = true; startX = e.clientX; startLeft = track.scrollLeft;
    track.style.scrollBehavior = 'auto'; track.style.scrollSnapType = 'none';
  });
  window.addEventListener('pointermove', (e) => { if (down) track.scrollLeft = startLeft - (e.clientX - startX); });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false; track.style.scrollBehavior = ''; track.style.scrollSnapType = '';
    goTo(current());
  });

  update();
  // On narrow screens, start centered on the popular plan
  if (track.scrollWidth > track.clientWidth + 4) {
    goTo(1, true);
    update();
  }
})();
