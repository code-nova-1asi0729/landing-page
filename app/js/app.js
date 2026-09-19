/* FleetCare app — enrutador, layouts, eventos globales, notificaciones y arranque */
(function () {
  'use strict';
  const R = window.FleetCare;
  const { html, ico } = R;

  /* ---------- Rutas ---------- */
  const routes = [];
  R.route = (pattern, role, fn) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ re, keys, role, fn });
  };
  const PUBLIC = ['/login', '/registro', '/recuperar'];
  R.home = (u) => (u.role === 'manager' ? '/dashboard' : '/c/inicio');
  R.go = (p) => { if (location.hash === '#' + p) R.dispatch(); else location.hash = '#' + p; };

  const MANAGER_NAV = [
    ['/dashboard', 'Dashboard', 'dashboard'], ['/vehiculos', 'Vehículos', 'truck'], ['/checklists', 'Checklists', 'clipboard'],
    ['/kilometraje', 'Kilometraje', 'gauge'], ['/fallas', 'Fallas', 'alert'], ['/mantenimiento', 'Mantenimiento', 'wrench'],
    ['/combustible', 'Combustible', 'fuel'], ['/incidencias', 'Incidencias', 'incident'], ['/conductores', 'Conductores', 'users'],
    ['/suscripcion', 'Suscripción', 'card'], ['/reportes', 'Reportes', 'file'], ['/configuracion', 'Configuración', 'settings'],
  ];
  const DRIVER_NAV = [
    ['/c/inicio', 'Inicio', 'home'], ['/c/checklist', 'Checklist', 'clipboard'], ['/c/kilometraje', 'Kilometraje', 'gauge'],
    ['/c/fallas', 'Fallas', 'alert'], ['/c/combustible', 'Combustible', 'fuel'],
  ];
  const logo = (cls = '') => html`<img class="logo-img ${cls}" src="../img/fleetcare-logo-128.png" alt="" width="36" height="36">`;

  /* ---------- Layouts ---------- */
  function shell(layout, me) {
    if (layout === 'auth') return '<div class="auth-wrap" id="view"></div>';
    if (layout === 'manager') {
      return html`<div class="shell" id="shell">
        <aside class="sidebar" aria-label="Navegación principal">
          <a class="brand" href="#/dashboard" aria-label="FleetCare — Dashboard">${logo()}<span>FleetCare</span></a>
          <nav class="side-nav" id="side-nav">${MANAGER_NAV.map(([p, l, i]) => html`<a href="#${p}" data-nav="${p}"><span class="nav-ico">${ico(i, 18)}</span><span class="nav-label">${l}</span><span class="nav-badge" data-badge="${p}" hidden></span></a>`)}</nav>
          <div class="side-user">
            <span class="avatar">${R.initials(me.name)}</span>
            <div class="side-user-txt"><strong>Jefe de flota</strong><small id="side-company"></small></div>
            <button class="icon-btn light" data-action="logout" aria-label="Cerrar sesión" title="Cerrar sesión">${ico('logout', 18)}</button>
          </div>
        </aside>
        <div class="scrim" data-action="close-nav"></div>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn hamb" data-action="open-nav" aria-label="Abrir menú">${ico('menu', 22)}</button>
            <div class="titleblock"><p class="eyebrow" id="tb-eyebrow"></p><h1 id="tb-title"></h1></div>
            <div class="top-actions">
              <div class="pop-wrap">
                <button class="icon-btn bell" data-action="toggle-bell" aria-label="Notificaciones" aria-haspopup="true">${ico('bell', 20)}<span class="bell-dot" id="bell-dot" hidden></span></button>
                <div class="popover" id="bell-pop" hidden></div>
              </div>
              <div class="pop-wrap">
                <button class="avatar avatar-btn" data-action="toggle-menu" aria-label="Menú de usuario" aria-haspopup="true">${R.initials(me.name)}</button>
                <div class="popover menu" id="user-pop" hidden>
                  <div class="menu-head"><strong>${me.name}</strong><small>${me.email}</small></div>
                  <a href="#/configuracion">${ico('settings', 16)} Configuración</a>
                  <button data-action="logout">${ico('logout', 16)} Cerrar sesión</button>
                </div>
              </div>
            </div>
          </header>
          <main class="content" id="view" tabindex="-1"></main>
        </div>
      </div>`.s;
    }
    return html`<div class="phone-stage"><div class="phone" id="phone">
      <header class="phone-head">${logo('sm')}<h1 id="ph-title"></h1>
        <div class="pop-wrap"><button class="icon-btn light" data-action="toggle-menu" aria-label="Menú de usuario" aria-haspopup="true">${ico('user', 20)}</button>
          <div class="popover menu" id="user-pop" hidden><div class="menu-head"><strong>${me.name}</strong><small id="ph-company"></small></div><button data-action="logout">${ico('logout', 16)} Cerrar sesión</button></div></div>
      </header>
      <main class="phone-body" id="view" tabindex="-1"></main>
      <nav class="tabbar" aria-label="Navegación del conductor">${DRIVER_NAV.map(([p, l, i]) => html`<a href="#${p}" data-nav="${p}">${ico(i, 22)}<span>${l}</span></a>`)}</nav>
    </div></div>`.s;
  }

  R.refreshChrome = () => {
    const me = R.me();
    const db = R.db();
    if (!me || !db) return;
    if (me.role === 'manager') {
      const unread = db.notifications.filter((n) => !n.read).length;
      const dot = R.$('#bell-dot');
      if (dot) { dot.hidden = !unread; dot.textContent = unread > 9 ? '9+' : unread; }
      const co = R.$('#side-company');
      if (co) co.textContent = db.company.name;
      const inc = db.faults.filter((f) => R.faultOpen(f) && R.vehicle(db, f.vehicleId) && R.vehicle(db, f.vehicleId).active !== false).length;
      const alerts = R.upcomingAlerts(db).filter((a) => a.level !== 'proximo').length;
      const set = (p, n) => { const b = R.$(`[data-badge="${p}"]`); if (b) { b.hidden = !n; b.textContent = n; } };
      set('/incidencias', inc); set('/mantenimiento', alerts);
    } else {
      const co = R.$('#ph-company');
      if (co) co.textContent = db.company.name;
    }
  };

  const bellHtml = (db) => {
    const list = db.notifications.slice(0, 8);
    return html`<div class="pop-head"><strong>Notificaciones</strong>${list.length ? html`<button class="link-btn" data-action="read-all">Marcar como leídas</button>` : ''}</div>
      ${list.length ? html`<ul class="notif-list">${list.map((n) => html`<li class="${n.read ? '' : 'unread'}"><a href="#${n.link || '/dashboard'}" data-action="close-pops"><span class="n-ico n-${n.type}">${ico(n.type === 'falla' ? 'alert' : 'wrench', 16)}</span><span><strong>${n.title}</strong><small>${n.text}</small><em>${R.ago(n.ts)}</em></span></a></li>`)}</ul>` : html`<p class="pop-empty">No tienes notificaciones.</p>`}`;
  };

  R.flushToasts = () => {
    const me = R.me();
    const db = R.db();
    if (!me || me.role !== 'manager') return;
    const fresh = db.notifications.filter((n) => !n.toasted && !n.read).slice(0, 3);
    if (!fresh.length) return;
    db.notifications.forEach((n) => { n.toasted = true; });
    R.save();
    fresh.reverse().forEach((n, i) => setTimeout(() => R.toast(n.text, n.type === 'falla' ? 'warn' : 'warn', n.title), i * 350));
  };

  /* ---------- Render ---------- */
  let current = null;
  R.dispatch = (keepScroll) => {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    R.query = Object.fromEntries(new URLSearchParams(qs || ''));
    const me = R.me();
    if (!me && R.session.get()) R.session.clear();
    if (!me && !PUBLIC.includes(path)) return R.go('/login');
    if (me && (PUBLIC.includes(path) || path === '/')) return R.go(R.home(me));

    let found = null;
    for (const r of routes) {
      const m = r.re.exec(path);
      if (m) { found = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }; break; }
    }
    if (!found) return R.go(me ? R.home(me) : '/login');
    if (me && found.r.role && found.r.role !== me.role) return R.go(R.home(me));

    const view = found.r.fn(found.params, me);
    if (!view) return R.go(me ? R.home(me) : '/login');
    if (view.redirect) return R.go(view.redirect);

    const layout = !me ? 'auth' : me.role;
    const app = R.$('#app');
    const sig = layout + ':' + (me ? me.id : '');
    if (current !== sig) { app.innerHTML = shell(layout, me); current = sig; }
    const body = R.$('#view');
    const scroller = layout === 'driver' ? R.$('.phone-body') : layout === 'manager' ? R.$('.content') : window;
    const prev = keepScroll && scroller && scroller !== window ? scroller.scrollTop : 0;

    body.innerHTML = view.html.s;
    if (layout === 'manager') {
      R.$('#tb-eyebrow').textContent = view.eyebrow || '';
      R.$('#tb-title').textContent = view.title || '';
      document.title = `${view.title} — FleetCare`;
    } else if (layout === 'driver') {
      R.$('#ph-title').textContent = view.title || '';
      document.title = `${view.title} — FleetCare`;
    } else {
      document.title = `${view.title || 'Acceso'} — FleetCare`;
    }
    R.$$('[data-nav]').forEach((a) => {
      const p = a.getAttribute('data-nav');
      const on = Boolean(path === p || path.startsWith(p + '/') || (view.navKey && view.navKey === p));
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const shellEl = R.$('#shell');
    if (shellEl) shellEl.classList.remove('nav-open');
    closePops();
    if (scroller) { if (scroller === window) window.scrollTo(0, 0); else scroller.scrollTop = prev; }
    if (view.mount) view.mount(body);
    R.refreshChrome();
    R.flushToasts();
    if (!keepScroll && !me) { const f = R.$('input:not([type=hidden])', body); if (f) f.focus({ preventScroll: true }); }
  };
  R.rerender = () => R.dispatch(true);

  function closePops() {
    R.$$('.popover').forEach((p) => { p.hidden = true; });
  }

  /* ---------- Acciones globales ---------- */
  Object.assign(R.actions, {
    'open-nav': () => R.$('#shell').classList.add('nav-open'),
    'close-nav': () => R.$('#shell').classList.remove('nav-open'),
    'close-pops': () => closePops(),
    'toggle-menu': (el) => { const p = R.$('#user-pop'); const open = p.hidden; closePops(); p.hidden = !open; },
    'toggle-bell': () => {
      const p = R.$('#bell-pop');
      const open = p.hidden;
      closePops();
      if (!open) return;
      p.innerHTML = bellHtml(R.db()).s;
      p.hidden = false;
    },
    'read-all': () => {
      const db = R.db();
      db.notifications.forEach((n) => { n.read = true; n.toasted = true; });
      R.save();
      R.$('#bell-pop').innerHTML = bellHtml(db).s;
      R.refreshChrome();
    },
    logout: async () => {
      closePops();
      const ok = await R.confirm({ title: '¿Cerrar sesión?', text: 'Deberás volver a iniciar sesión para acceder a tu cuenta.', confirm: 'Cerrar sesión', danger: false });
      if (!ok) return;
      R.session.clear();
      R.toast('Cerraste sesión correctamente.');
      R.go('/login');
    },
  });

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-action]');
    if (act) {
      const fn = R.actions[act.getAttribute('data-action')];
      if (fn) {
        if (act.tagName === 'A' && !act.getAttribute('href')) e.preventDefault();
        fn(act, e);
        return;
      }
    }
    const row = e.target.closest('[data-href]');
    if (row && !e.target.closest('a,button,input,select,textarea,label,summary')) { R.go(row.getAttribute('data-href')); return; }
    if (!e.target.closest('.pop-wrap')) closePops();
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = R.forms[f.getAttribute('data-form')];
    if (fn) fn(f, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && R.inputs[el.getAttribute('data-input')]) R.inputs[el.getAttribute('data-input')](el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && R.changes[el.getAttribute('data-change')]) R.changes[el.getAttribute('data-change')](el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePops(); const s = R.$('#shell'); if (s) s.classList.remove('nav-open'); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-href][tabindex]')) { e.preventDefault(); R.go(e.target.getAttribute('data-href')); }
  });
  window.addEventListener('hashchange', () => R.dispatch());

  // Sincronización entre pestañas (p. ej. el conductor reporta y el jefe lo ve al instante)
  window.addEventListener('storage', (e) => {
    if (e.key !== 'fleetcare.app.v1' && e.key !== 'fleetcare.session.v1') return;
    R.load();
    if (!R.me()) { current = null; R.dispatch(); return; }
    R.refreshChrome();
    R.flushToasts();
    const path = location.hash.replace(/^#/, '');
    if (!R.$('.modal') && !/\/(nuevo|editar)$/.test(path)) R.rerender();
  });

  /* ---------- Arranque ---------- */
  R.boot = async () => {
    if (!R.load()) { R.setState(await R.buildSeed()); R.save(); }
    const me = R.me();
    if (me && me.role === 'manager') { R.checkAllAlerts(R.db()); R.save(); }
    R.dispatch();
  };
  R.resetDemo = async () => {
    R.session.clear();
    R.setState(await R.buildSeed());
    R.save();
    current = null;
  };
})();
