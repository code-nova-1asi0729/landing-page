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

// ---------- Request a demo (US49) ----------
(function () {
  const DEMO_KEY = 'codenova_demo_requests_v1';
  const clean = (s) => s.replace(/[<>&"]/g, '');
  let modal = null;
  let lastFocus = null;

  function build() {
    modal = document.createElement('div');
    modal.className = 'demo-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="demo-dialog" role="dialog" aria-modal="true" aria-labelledby="demo-title">' +
      '<button type="button" class="demo-close" aria-label="Close">&times;</button>' +
      '<div id="demo-body"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) close(); });
    modal.querySelector('.demo-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  }

  function formView() {
    document.getElementById('demo-body').innerHTML =
      '<h2 id="demo-title">Request a demo</h2>' +
      '<p>Tell us who you are and we’ll reach out to show you Vigilia in action.</p>' +
      '<form class="demo-form" novalidate>' +
      '<div class="form-field"><label for="demo-name">Name</label><input type="text" id="demo-name" name="name" autocomplete="name"><span class="field-error"></span></div>' +
      '<div class="form-field"><label for="demo-email">Email</label><input type="email" id="demo-email" name="email" autocomplete="email"><span class="field-error"></span></div>' +
      '<div class="form-field"><label for="demo-profile">Profile</label><select id="demo-profile" name="profile">' +
      '<option>Building administrator</option><option>Resident</option><option>Maintenance company</option><option>Other</option></select></div>' +
      '<button type="submit" class="btn btn-primary">Request a demo</button></form>';

    const form = document.querySelector('.demo-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.name.value.trim(), email = form.email.value.trim(), profile = form.profile.value;
      const errs = form.querySelectorAll('.field-error');
      let ok = true;
      form.querySelectorAll('.form-field').forEach((f) => f.classList.remove('has-error'));
      errs.forEach((x) => (x.textContent = ''));
      if (!name) { errs[0].textContent = 'This field is required.'; errs[0].parentNode.classList.add('has-error'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errs[1].textContent = 'Enter a valid email address.'; errs[1].parentNode.classList.add('has-error'); ok = false; }
      if (!ok) { (name ? form.email : form.name).focus(); return; }
      try {
        const list = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
        list.push({ ts: Date.now(), name, email, profile });
        localStorage.setItem(DEMO_KEY, JSON.stringify(list));
      } catch (err) { /* no storage available: still confirm */ }
      document.getElementById('demo-body').innerHTML =
        '<div class="demo-success"><div class="tick">✓</div><h2 id="demo-title">Request sent!</h2>' +
        '<p>Thanks, ' + clean(name) + '. We’ll email you soon at ' + clean(email) + '.</p>' +
        '<button type="button" class="btn btn-primary" id="demo-done">Close</button></div>';
      document.getElementById('demo-done').addEventListener('click', close);
    });
  }

  function open() {
    if (!modal) build();
    lastFocus = document.activeElement;
    formView();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(() => { const f = document.getElementById('demo-name'); if (f) f.focus(); }, 30);
  }
  function close() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-demo]');
    if (!t) return;
    e.preventDefault();
    const hd = document.getElementById('header');
    if (hd) hd.classList.remove('nav-open');
    open();
  });
})();
