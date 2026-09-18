// ---------- Precios: toggle mensual/anual + carrusel ----------
(function () {
  const track = document.getElementById('price-track');
  if (!track) return;
  const carousel = track.closest('.pricing-carousel');
  const prev = document.getElementById('price-prev');
  const next = document.getElementById('price-next');
  const dotsBox = document.getElementById('price-dots');
  const plans = Array.from(track.querySelectorAll('.plan'));

  // Toggle de facturación
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

  // Carrusel
  plans.forEach((_, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.setAttribute('aria-label', 'Ir al plan ' + (i + 1));
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

  // Arrastrar con el mouse (en pantallas táctiles ya funciona el deslizamiento nativo)
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
  // En pantallas angostas empieza centrado en el plan popular
  if (track.scrollWidth > track.clientWidth + 4) {
    goTo(1, true);
    update();
  }
})();

// ---------- Solicitar demo (US49) ----------
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
      '<button type="button" class="demo-close" aria-label="Cerrar">&times;</button>' +
      '<div id="demo-body"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) close(); });
    modal.querySelector('.demo-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  }

  function formView() {
    document.getElementById('demo-body').innerHTML =
      '<h2 id="demo-title">Solicita una demo</h2>' +
      '<p>Cuéntanos quién eres y te contactaremos para mostrarte CodeNova en acción.</p>' +
      '<form class="demo-form" novalidate>' +
      '<div class="form-field"><label for="demo-name">Nombre</label><input type="text" id="demo-name" name="name" autocomplete="name"><span class="field-error"></span></div>' +
      '<div class="form-field"><label for="demo-email">Correo electrónico</label><input type="email" id="demo-email" name="email" autocomplete="email"><span class="field-error"></span></div>' +
      '<div class="form-field"><label for="demo-profile">Perfil</label><select id="demo-profile" name="profile">' +
      '<option>Administrador de edificio</option><option>Residente</option><option>Empresa de mantenimiento</option><option>Otro</option></select></div>' +
      '<button type="submit" class="btn btn-primary">Solicitar demo</button></form>' +
      '<p class="app-link-box">¿Prefieres explorarla ahora? <a href="app/index.html#/login">Entra con una cuenta de demostración</a></p>';

    const form = document.querySelector('.demo-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.name.value.trim(), email = form.email.value.trim(), profile = form.profile.value;
      const errs = form.querySelectorAll('.field-error');
      let ok = true;
      form.querySelectorAll('.form-field').forEach((f) => f.classList.remove('has-error'));
      errs.forEach((x) => (x.textContent = ''));
      if (!name) { errs[0].textContent = 'Este campo es obligatorio.'; errs[0].parentNode.classList.add('has-error'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errs[1].textContent = 'Ingresa un correo válido.'; errs[1].parentNode.classList.add('has-error'); ok = false; }
      if (!ok) { (name ? form.email : form.name).focus(); return; }
      try {
        const list = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
        list.push({ ts: Date.now(), name, email, profile });
        localStorage.setItem(DEMO_KEY, JSON.stringify(list));
      } catch (err) { /* sin almacenamiento: igual confirmamos */ }
      document.getElementById('demo-body').innerHTML =
        '<div class="demo-success"><div class="tick">✓</div><h2 id="demo-title">¡Solicitud enviada!</h2>' +
        '<p>Gracias, ' + clean(name) + '. Te escribiremos pronto a ' + clean(email) + '.</p>' +
        '<button type="button" class="btn btn-primary" id="demo-done">Cerrar</button></div>';
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
