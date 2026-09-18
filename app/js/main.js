/* CodeNova — router, layouts (sidebar / celular) y notificaciones. */
(function () {
  'use strict';
  const CN = window.CN, esc = CN.esc, ic = CN.icon;

  // ---------- rutas ----------
  const routes = [];
  CN.route = function (path, opts, fn) {
    const keys = [];
    const re = new RegExp('^' + path.replace(/:([a-z]+)/gi, (m, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    routes.push({ path, re, keys, opts: opts || {}, fn });
  };
  const leaveFns = [];
  CN.onLeave = (fn) => leaveFns.push(fn);

  const HOME = { admin: '/dashboard', company: '/week', resident: '/home', platform: '/config' };
  CN.homeFor = (u) => HOME[u.role];
  CN.go = (path) => { location.hash = '#' + path; };

  const NAV = {
    admin: [
      { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { path: '/buildings', label: 'Edificios', icon: 'home', also: ['/equipment'] },
      { path: '/alerts', label: 'Alertas', icon: 'alert' },
      { path: '/incidents', label: 'Incidentes', icon: 'message' },
      { path: '/visits', label: 'Visitas', icon: 'wrench' },
      { path: '/reports', label: 'Reportes', icon: 'book' },
      { path: '/profile', label: 'Perfil', icon: 'users' },
    ],
    company: [
      { path: '/week', label: 'Mi semana', icon: 'calendar', also: ['/visits'] },
      { path: '/alerts', label: 'Alertas', icon: 'alert' },
      { path: '/clients', label: 'Clientes', icon: 'building' },
      { path: '/technicians', label: 'Técnicos', icon: 'wrench' },
      { path: '/profile', label: 'Perfil', icon: 'users' },
    ],
    platform: [
      { path: '/config', label: 'Configuración', icon: 'sliders' },
      { path: '/profile', label: 'Perfil', icon: 'users' },
    ],
    resident: [
      { path: '/home', label: 'Inicio', icon: 'home' },
      { path: '/requests', label: 'Mis solicitudes', icon: 'message' },
      { path: '/profile', label: 'Perfil', icon: 'users' },
    ],
  };
  const isActive = (item, path) => [item.path].concat(item.also || []).some((p) => path === p || path.startsWith(p + '/'));

  // ---------- render ----------
  const app = () => document.getElementById('app');
  let shellKey = null;

  function shellFor(u) {
    if (u.role === 'resident') {
      return '<div class="res-stage"><div class="phone"><header class="phone-top"><a class="brand" href="#/home">' + CN.logoTile(30) + '<b>CodeNova</b></a><div id="bell-slot"></div></header>' +
        '<main id="view" class="phone-view" tabindex="-1"></main><nav class="tabbar" id="tabbar"></nav></div></div>';
    }
    return '<div class="app"><aside class="sidebar" id="sidebar"><a class="brand" href="#' + HOME[u.role] + '">' + CN.logoTile(32) + '<b>CodeNova</b></a><nav id="sidenav"></nav><div class="grow"></div>' +
      '<div class="side-user"><div class="avatar">' + esc(CN.initials(u.name)) + '</div><div><b>' + esc(u.name) + '</b><span>' + esc(CN.userLabel(u)) + '</span></div></div>' +
      '<button class="side-logout" id="logout">' + ic('logout', 20) + '<span>Cerrar sesión</span></button></aside><div class="sb-backdrop" id="sb-backdrop"></div>' +
      '<div class="main"><header class="topbar"><button class="icon-btn menu-btn" id="menu-btn" aria-label="Abrir menú">' + ic('menu', 24) + '</button><a class="brand mobile-brand" href="#' + HOME[u.role] + '">' + CN.logoTile(28) + '<b>CodeNova</b></a><div class="grow"></div><div id="bell-slot"></div></header>' +
      '<main id="view" class="view" tabindex="-1"></main></div></div>';
  }

  function renderNav(u, path) {
    const items = NAV[u.role];
    if (u.role === 'resident') {
      document.getElementById('tabbar').innerHTML = items.map((i) => '<a href="#' + i.path + '" class="' + (isActive(i, path) ? 'on' : '') + '">' + ic(i.icon, 24) + '<span>' + i.label + '</span></a>').join('');
    } else {
      document.getElementById('sidenav').innerHTML = items.map((i) => '<a href="#' + i.path + '" class="' + (isActive(i, path) ? 'on' : '') + '">' + ic(i.icon, 22) + '<span>' + i.label + '</span></a>').join('');
    }
  }

  // ---------- campana de notificaciones ----------
  function renderBell() {
    const slot = document.getElementById('bell-slot');
    const u = CN.session();
    if (!slot || !u) return;
    const n = CN.unread(u.id);
    slot.innerHTML = '<div class="bell"><button class="icon-btn" id="bell-btn" aria-label="Notificaciones" aria-expanded="false">' + ic('bell', 22) + (n ? '<i class="badge-n">' + (n > 9 ? '9+' : n) + '</i>' : '') + '</button><div class="bell-panel" id="bell-panel" hidden></div></div>';
    const btn = document.getElementById('bell-btn'), panel = document.getElementById('bell-panel');
    const paint = () => {
      const list = CN.notifsOf(u.id).slice(0, 12);
      panel.innerHTML = '<div class="bp-head"><b>Notificaciones</b>' + (n ? '<button class="link" id="mark-read">Marcar todo como leído</button>' : '') + '</div>' +
        (list.length ? list.map((x) => '<a class="bp-item' + (x.read ? '' : ' unread') + '" href="' + (x.link || '#') + '" data-nid="' + x.id + '">' + (x.sev ? '<i style="background:' + CN.SEV[x.sev].color + '"></i>' : '<i class="neutral"></i>') + '<div><b>' + esc(x.title) + '</b><span>' + esc(x.body) + '</span><em>' + CN.timeAgo(x.ts) + '</em></div></a>').join('') : '<p class="muted pad">No tienes notificaciones.</p>');
      const mr = panel.querySelector('#mark-read');
      if (mr) mr.onclick = (e) => { e.stopPropagation(); CN.notifsOf(u.id).forEach((x) => (x.read = true)); CN.save(); renderBell(); };
      panel.querySelectorAll('.bp-item').forEach((a) => a.addEventListener('click', () => {
        const rec = CN.db().notifications.find((x) => x.id === a.dataset.nid); if (rec) { rec.read = true; CN.save(); }
        panel.hidden = true; setTimeout(renderBell, 50);
      }));
    };
    btn.onclick = (e) => {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      btn.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) paint();
    };
    document.addEventListener('click', function close(e) {
      if (!document.body.contains(panel)) { document.removeEventListener('click', close); return; }
      if (!panel.contains(e.target)) panel.hidden = true;
    });
  }
  CN.refreshBell = renderBell;

  CN.on('notify', (n) => {
    const u = CN.session();
    if (!u || n.userId !== u.id) return;
    renderBell();
    if (n.kind === 'push') CN.push(n);
    else CN.toast(n.title + ' — ' + n.body, 'info', 5000);
  });
  CN.on('storage-error', () => CN.toast('No se pudo guardar en el navegador (almacenamiento lleno o bloqueado).', 'err', 6000));

  // ---------- navegación ----------
  function currentPath() {
    const h = location.hash.replace(/^#/, '') || '/';
    return h.split('?')[0] || '/';
  }

  function render() {
    leaveFns.splice(0).forEach((f) => { try { f(); } catch (e) { /* noop */ } });
    const path = currentPath();
    let user = CN.session();
    let match = null, params = {};
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) { match = r; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); break; }
    }
    if (path === '/' || !match) { CN.go(user ? HOME[user.role] : '/login'); return; }
    const o = match.opts;
    if (!o.public && !user) { CN.go('/login'); return; }
    if (o.public && user && !o.always) { CN.go(HOME[user.role]); return; }
    if (o.roles && user && !o.roles.includes(user.role)) { CN.go(HOME[user.role]); return; }

    let res = match.fn(params, user) || {};
    if (typeof res === 'string') res = { html: res };
    document.title = (res.title ? res.title + ' · ' : '') + 'CodeNova';
    const host = app();

    if (o.public) {
      shellKey = null;
      host.innerHTML = res.html;
      window.scrollTo(0, 0);
    } else {
      const key = user.id + ':' + user.role;
      if (shellKey !== key || !document.getElementById('view')) {
        host.innerHTML = shellFor(user); shellKey = key;
        const lo = document.getElementById('logout');
        if (lo) lo.onclick = () => { CN.logout(); CN.go('/login'); CN.toast('Sesión cerrada.', 'info'); };
        const mb = document.getElementById('menu-btn'), sb = document.getElementById('sidebar');
        if (mb) {
          mb.onclick = () => document.body.classList.toggle('nav-open');
          document.getElementById('sb-backdrop').onclick = () => document.body.classList.remove('nav-open');
        }
        renderBell();
      }
      document.body.classList.remove('nav-open');
      renderNav(user, path);
      // Contenedor nuevo en cada render: descarta los listeners de la pantalla anterior.
      const stale = document.getElementById('view');
      const view = stale.cloneNode(false);
      stale.replaceWith(view);
      view.innerHTML = res.html;
      const scroller = user.role === 'resident' ? view : window;
      if (scroller.scrollTo) scroller.scrollTo(0, 0);
      renderBell();
    }
    if (res.mount) res.mount(document.getElementById('view') || host, params, user);
  }

  CN.render = render;

  // ---------- arranque ----------
  function boot() {
    CN.load();
    CN.checkSensors();
    setInterval(() => { CN.checkSensors(); }, 60 * 1000);
    window.addEventListener('hashchange', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
