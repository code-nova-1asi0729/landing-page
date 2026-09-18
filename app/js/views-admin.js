/* CodeNova — administrador: dashboard, edificios, equipos y sensores. */
(function () {
  'use strict';
  const CN = window.CN, esc = CN.esc, ic = CN.icon;
  const A = { roles: ['admin'] };
  const SEL_KEY = 'cn_selected_building';

  function selectedBuilding(u) {
    const bs = CN.buildingsOf(u);
    let id = CN.store.get(SEL_KEY);
    if (!bs.some((b) => b.id === id)) id = bs[0] && bs[0].id;
    return bs.find((b) => b.id === id) || null;
  }
  CN.selectedBuilding = selectedBuilding;
  CN.setSelectedBuilding = (id) => CN.store.set(SEL_KEY, id);
  CN.buildingSelect = function (u, current, id) {
    const bs = CN.buildingsOf(u);
    if (bs.length < 2) return '';
    return '<div class="select-wrap inline"><select id="' + (id || 'bsel') + '" aria-label="Edificio">' + bs.map((b) => '<option value="' + b.id + '"' + (b.id === current ? ' selected' : '') + '>' + esc(b.name) + '</option>').join('') + '</select>' + ic('chevron', 18) + '</div>';
  };

  // =============== DASHBOARD (US19, US34, US37, US50) ===============
  CN.route('/dashboard', A, (p, u) => {
    const b = selectedBuilding(u);
    const steps = CN.onboarding(u);
    const pending = steps.findIndex((s) => !s.done);
    const showOnb = pending !== -1 && !u.onboardingDone;
    let html = '';
    if (showOnb) {
      const s = steps[pending];
      html += '<div class="card onboard"><div class="onb-main"><span class="pill">Paso ' + (pending + 1) + ' de 3</span>' +
        '<h2>' + (pending === 0 ? 'Aún no tienes edificios registrados' : 'Completa la configuración de tu edificio') + '</h2>' +
        '<h3>' + s.title + '</h3><p class="muted">' + (pending === 0 ? 'Te guiaremos paso a paso para crear tu edificio y registrar tus equipos críticos.' : s.desc) + '</p>' +
        '<div class="onb-actions"><button class="btn btn-primary" id="tour">' + ic('play', 18) + '<span>Comenzar recorrido guiado</span></button><button class="btn btn-ghost" id="skip">Omitir por ahora</button></div></div>' +
        '<ol class="onb-steps">' + steps.map((x, i) => '<li class="' + (x.done ? 'done' : i === pending ? 'now' : '') + '"><span>' + (x.done ? ic('check', 16) : i + 1) + '</span>' + x.title + '</li>').join('') + '</ol></div>';
    }
    if (!b) {
      return { title: 'Dashboard', html: CN.pageHead('DASHBOARD', 'Bienvenido a CodeNova') + html + (showOnb ? '' : CN.empty('building', 'Aún no tienes edificios registrados', 'Registra tu primer edificio para empezar a monitorear tus equipos.', '<a class="btn btn-primary" href="#/buildings/new">Registrar edificio</a>')), mount: mountDash };
    }
    const alerts = CN.activeAlerts([b.id]).sort((x, y) => CN.sevRank(y.severity) - CN.sevRank(x.severity) || y.createdAt - x.createdAt);
    const saving = CN.buildingSavings(b.id);
    const monitored = CN.monitoredCount(b.id);
    html = CN.pageHead('DASHBOARD', esc(b.name), esc(b.address) + ' · ' + esc(b.district || 'Lima'), CN.buildingSelect(u, b.id)) + html +
      '<div class="grid-3">' +
      CN.stat('alert', alerts.length, 'Alertas activas', ' data-go="#/alerts"') +
      CN.stat('savings', CN.money(saving), 'Ahorro acumulado', ' data-go="#/reports"') +
      CN.stat('cpu', monitored, 'Equipos monitoreados', ' data-go="#/buildings/' + b.id + '"') + '</div>' +
      '<div class="card"><div class="card-head"><h3>Alertas activas</h3><a class="link" href="#/alerts">Ver todas</a></div>' +
      (alerts.length ? CN.responsiveTable(['Equipo', 'Severidad', 'Detectado'], alerts.map((a) => { const e = CN.equip(a.equipId); return { link: '#/alerts/' + a.id, cells: [esc(CN.equipName(e)), CN.sev(a.severity), CN.timeAgo(a.createdAt)] }; }))
        : '<p class="muted pad">No hay alertas activas. Todos tus equipos operan con normalidad.</p>') + '</div>' +
      '<div class="card savings-card"><div><p class="eyebrow">AHORRO ACUMULADO</p><h2 class="big">' + CN.money(saving) + '</h2><p class="muted">Ahorro frente a mantenimiento correctivo</p></div>' +
      '<div class="sv-list">' + savingsRows(b.id) + '</div></div>';
    const bs = CN.buildingsOf(u);
    if (bs.length > 1) {
      html += '<div class="card"><div class="card-head"><h3>Panel comparativo entre edificios</h3></div>' + CN.responsiveTable(['Edificio', 'Alertas activas', 'Ahorro acumulado'],
        bs.map((x) => ({ link: '#/buildings/' + x.id, cells: ['<b>' + esc(x.name) + '</b>', String(CN.activeAlerts([x.id]).length), CN.money(CN.buildingSavings(x.id))] }))) + '</div>';
    }
    return { title: 'Dashboard', html, mount: mountDash };
  });

  function savingsRows(bid) {
    const rows = CN.db().visits.filter((v) => v.buildingId === bid && v.saving).sort((a, b) => b.intervention.ts - a.intervention.ts).slice(0, 4);
    if (!rows.length) return '<p class="muted small">Cada intervención preventiva registrada suma al ahorro estimado.</p>';
    return rows.map((v) => '<div class="sv-row"><span>' + esc(CN.equipShort(CN.equip(v.equipId))) + ' · ' + CN.fmtShort(v.intervention.ts) + '</span><b>+ ' + CN.money(v.saving) + '</b></div>').join('');
  }

  function mountDash(root, p, u) {
    const sel = root.querySelector('#bsel');
    if (sel) sel.addEventListener('change', () => { CN.setSelectedBuilding(sel.value); CN.render(); });
    CN.bindRowLinks(root);
    root.querySelectorAll('[data-go]').forEach((c) => { c.tabIndex = 0; c.addEventListener('click', () => (location.hash = c.dataset.go)); c.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = c.dataset.go; }); });
    const skip = root.querySelector('#skip');
    if (skip) skip.addEventListener('click', () => { u.onboardingDone = true; CN.save(); CN.render(); });
    const tour = root.querySelector('#tour');
    if (tour) tour.addEventListener('click', () => startTour(u));
  }

  // Recorrido guiado (US50)
  function startTour(u) {
    let i = Math.max(0, CN.onboarding(u).findIndex((s) => !s.done));
    const draw = (m) => {
      const steps = CN.onboarding(u), s = steps[i];
      m.querySelector('.modal-body').innerHTML = '<div class="tour"><div class="tour-dots">' + steps.map((x, k) => '<i class="' + (k === i ? 'on' : x.done ? 'done' : '') + '"></i>').join('') + '</div>' +
        '<span class="pill">Paso ' + (i + 1) + ' de 3</span><h3>' + s.title + '</h3><p class="muted">' + s.desc + '</p>' + (s.done ? '<div class="notice ok">' + ic('checkCircle', 20) + '<div><b>Paso completado</b></div></div>' : '') +
        '<div class="modal-actions"><button class="btn btn-outline" data-prev ' + (i === 0 ? 'disabled' : '') + '>Anterior</button>' +
        (i < 2 ? '<button class="btn btn-outline" data-next>Siguiente</button>' : '') +
        '<a class="btn btn-primary" href="' + s.href + '" data-close>' + (s.done ? 'Revisar' : 'Ir a este paso') + '</a></div></div>';
      m.querySelector('[data-prev]').onclick = () => { i--; draw(m); };
      const nx = m.querySelector('[data-next]'); if (nx) nx.onclick = () => { i++; draw(m); };
    };
    const m = CN.modal({ title: 'Recorrido guiado', html: '' });
    draw(m.el);
  }

  // =============== EDIFICIOS ===============
  CN.route('/buildings', A, (p, u) => {
    const bs = CN.buildingsOf(u);
    const head = CN.pageHead('EDIFICIOS', 'Mis edificios', null, '<a class="btn btn-primary" href="#/buildings/new">' + ic('plus', 20) + '<span>Registrar edificio</span></a>');
    if (!bs.length) return { title: 'Edificios', html: head + CN.empty('building', 'Aún no tienes edificios', 'Registra tu primer edificio para empezar.', '<a class="btn btn-primary" href="#/buildings/new">Registrar edificio</a>') };
    return {
      title: 'Edificios',
      html: head + '<div class="grid-3 cards-b">' + bs.map((b) => {
        const n = CN.activeAlerts([b.id]).length;
        return '<a class="card bcard" href="#/buildings/' + b.id + '"><div class="bc-top"><span class="stat-ic">' + ic('building', 24) + '</span>' + (n ? '<span class="chip" style="background:#FDEBEA;color:#E53935">' + n + ' alerta' + (n > 1 ? 's' : '') + '</span>' : '<span class="chip" style="background:#E6F4EC;color:#2E9E6D">Sin alertas</span>') + '</div>' +
          '<h3>' + esc(b.name) + '</h3><p class="muted">' + esc(b.address) + (b.district ? ' · ' + esc(b.district) : '') + '</p>' +
          '<div class="bc-meta"><span>' + CN.equipmentOf(b.id).length + ' equipos</span><span>' + (b.units || 0) + ' unidades</span><span>Código <b>' + esc(b.code) + '</b></span></div></a>';
      }).join('') + '</div>',
    };
  });

  // US07: registro de edificio
  CN.route('/buildings/new', A, () => ({
    title: 'Registrar edificio',
    html: '<a class="back" href="#/buildings">' + ic('back', 18) + ' Edificios</a>' + CN.pageHead('EDIFICIOS', 'Registrar edificio') +
      '<div class="card form-card"><form id="f" class="stack">' +
      CN.field({ id: 'name', label: 'Nombre del edificio' }) + CN.field({ id: 'address', label: 'Dirección' }) +
      '<div class="two">' + CN.field({ id: 'units', label: 'Número de unidades', type: 'number', attrs: 'min="1" max="2000"' }) + CN.field({ id: 'district', label: 'Distrito' }) + '</div>' +
      CN.btn('Guardar edificio', { type: 'submit', icon: 'check' }) + '</form></div>',
    mount(root, p, u) {
      CN.bindForm(root.querySelector('#f'), (v, fail) => {
        const n = parseInt(v.units, 10);
        let ok = true;
        if (!(n >= 1)) { fail('units', 'Ingresa un número de unidades válido.'); ok = false; }
        if (CN.db().buildings.some((b) => b.name.trim().toLowerCase() === v.name.trim().toLowerCase() && b.address.trim().toLowerCase() === v.address.trim().toLowerCase())) { fail('name', 'Este edificio ya está registrado.'); ok = false; }
        if (!ok) return;
        const b = CN.addBuilding(u, v);
        CN.setSelectedBuilding(b.id);
        CN.toast('Edificio registrado. Código para residentes: ' + b.code);
        CN.go('/buildings/' + b.id);
      });
    },
  }));

  // Detalle del edificio + listado de equipos (US11)
  CN.route('/buildings/:id', A, (p, u) => {
    const b = CN.building(p.id);
    if (!b || !CN.canSee(u, b.id)) return { html: CN.empty('building', 'Edificio no encontrado', '', '<a class="btn btn-primary" href="#/buildings">Volver</a>') };
    const showAll = CN.store.get('cn_show_inactive') === '1';
    const eqs = CN.equipmentOf(b.id, showAll);
    const inactive = CN.equipmentOf(b.id, true).length - CN.equipmentOf(b.id).length;
    const comps = b.companyIds.map((id) => CN.company(id)).filter(Boolean);
    return {
      title: b.name,
      html: '<a class="back" href="#/buildings">' + ic('back', 18) + ' Edificios</a>' +
        CN.pageHead('EDIFICIOS · ' + esc(b.name.toUpperCase()), esc(b.name), esc(b.address) + (b.district ? ' · ' + esc(b.district) : ''),
          '<button class="btn btn-outline" id="edit">' + ic('edit', 18) + '<span>Editar datos</span></button><a class="btn btn-outline" href="#/buildings/' + b.id + '/thresholds">' + ic('sliders', 18) + '<span>Umbrales</span></a><a class="btn btn-primary" href="#/buildings/' + b.id + '/equipment/new">' + ic('plus', 20) + '<span>Registrar equipo</span></a>') +
        '<div class="grid-3">' +
        '<div class="card info"><p class="muted">Código de edificio</p><h3 class="code">' + esc(b.code) + ' <button class="icon-btn sm" data-copy="' + esc(b.code) + '" aria-label="Copiar código">' + ic('copy', 18) + '</button></h3><small class="muted">Compártelo con tus residentes para que se registren.</small></div>' +
        '<div class="card info"><p class="muted">Unidades</p><h3>' + (b.units || 0) + '</h3><small class="muted">' + CN.equipmentOf(b.id).length + ' equipos registrados</small></div>' +
        '<div class="card info"><p class="muted">Empresas de mantenimiento</p>' + (comps.length ? '<div class="tags">' + comps.map((c) => '<span class="tag">' + esc(c.name) + '</span>').join('') + '</div>' : '<h3>Ninguna</h3>') + '<a class="link" href="#/buildings/' + b.id + '/companies">' + (comps.length ? 'Gestionar empresas' : 'Vincular empresa') + '</a></div></div>' +
        '<div class="card"><div class="card-head"><h3>Mis equipos</h3>' + (inactive || showAll ? '<label class="switch-l"><input type="checkbox" id="showInactive"' + (showAll ? ' checked' : '') + '> Mostrar equipos dados de baja</label>' : '') + '</div>' +
        (eqs.length ? CN.responsiveTable(['Tipo', 'Ubicación', 'Código', 'Estado', 'Sensores'], eqs.map((e) => {
          const n = CN.sensorsOf(e.id).filter((s) => !s.offline).length;
          return { link: '#/equipment/' + e.id, cells: ['<b>' + esc(e.type) + '</b>', esc(e.location), esc(e.code), CN.equipStatusChip(e), n + (n === 1 ? ' activo' : ' activos')] };
        })) : CN.empty('cpu', 'Sin equipos registrados', 'Registra bombas, tableros, ascensores y más para monitorearlos.', '<a class="btn btn-primary" href="#/buildings/' + b.id + '/equipment/new">Registrar equipo</a>')) + '</div>',
      mount(root) {
        CN.bindRowLinks(root);
        CN.delegate(root, 'click', '[data-copy]', (e, t) => CN.copyText(t.dataset.copy));
        const si = root.querySelector('#showInactive');
        if (si) si.addEventListener('change', () => { CN.store.set('cn_show_inactive', si.checked ? '1' : '0'); CN.render(); });
        root.querySelector('#edit').addEventListener('click', () => editBuilding(b));
      },
    };
  });

  function editBuilding(b) {
    CN.modal({
      title: 'Editar datos del edificio',
      html: '<form id="fe" class="stack">' + CN.field({ id: 'name', label: 'Nombre del edificio', value: b.name }) + CN.field({ id: 'address', label: 'Dirección', value: b.address }) +
        '<div class="two">' + CN.field({ id: 'units', label: 'Unidades', type: 'number', value: b.units, attrs: 'min="1"' }) + CN.field({ id: 'district', label: 'Distrito', value: b.district, required: false }) + '</div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-outline" data-close>Cancelar</button>' + CN.btn('Guardar cambios', { type: 'submit', icon: 'check' }) + '</div></form>',
      onMount(w, close) {
        CN.bindForm(w.querySelector('#fe'), (v, fail) => {
          const n = parseInt(v.units, 10);
          if (!(n >= 1)) { fail('units', 'Ingresa un número válido.'); return; }
          Object.assign(b, { name: v.name.trim(), address: v.address.trim(), units: n, district: v.district.trim() });
          CN.save(); close(); CN.toast('Datos del edificio actualizados.'); CN.render();
        });
      },
    });
  }

  // US22: umbrales de severidad
  CN.route('/buildings/:id/thresholds', A, (p, u) => {
    const b = CN.building(p.id);
    if (!b || !CN.canSee(u, b.id)) return CN.empty('building', 'Edificio no encontrado');
    const t = b.thresholds;
    return {
      title: 'Umbrales de severidad',
      html: '<a class="back" href="#/buildings/' + b.id + '">' + ic('back', 18) + ' ' + esc(b.name) + '</a>' + CN.pageHead('EDIFICIOS · ' + esc(b.name.toUpperCase()), 'Umbrales de severidad', 'Define a partir de qué vibración (mm/s) se genera cada nivel de alerta.') +
        '<div class="card"><form id="f" class="stack"><div class="table-wrap"><table class="rtable"><thead><tr><th>Severidad</th><th>Rango permitido</th></tr></thead><tbody>' +
        '<tr><td data-label="Severidad">' + CN.sev('baja') + '</td><td data-label="Rango permitido"><div class="range-row"><input name="baja" type="number" step="0.1" min="0" value="' + t.baja + '" aria-label="Inicio de severidad baja"> <span>–</span> <output id="o1">' + t.media + '</output> <span>mm/s</span></div></td></tr>' +
        '<tr><td data-label="Severidad">' + CN.sev('media').replace('Media', 'Media/Alta') + '</td><td data-label="Rango permitido"><div class="range-row"><input name="media" type="number" step="0.1" min="0" value="' + t.media + '" aria-label="Inicio de severidad media"> <span>–</span> <output id="o2">' + t.critica + '</output> <span>mm/s</span></div></td></tr>' +
        '<tr><td data-label="Severidad">' + CN.sev('critica') + '</td><td data-label="Rango permitido"><div class="range-row"><span>&gt;</span> <input name="critica" type="number" step="0.1" min="0" value="' + t.critica + '" aria-label="Inicio de severidad crítica"> <span>mm/s</span></div></td></tr>' +
        '</tbody></table></div><small class="err" data-err="baja"></small>' +
        '<p class="muted small">Los demás tipos de lectura (temperatura y consumo) usan la desviación porcentual sobre el rango esperado definido por la plataforma.</p>' +
        CN.btn('Guardar umbrales', { type: 'submit', icon: 'check' }) + '</form></div>',
      mount(root) {
        const f = root.querySelector('#f');
        const sync = () => { root.querySelector('#o1').textContent = f.media.value; root.querySelector('#o2').textContent = f.critica.value; };
        f.addEventListener('input', sync);
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          const a = parseFloat(f.baja.value), m = parseFloat(f.media.value), c = parseFloat(f.critica.value);
          const err = root.querySelector('[data-err="baja"]');
          if (!(a > 0 && a < m && m < c)) { err.textContent = 'Los valores deben ser crecientes: baja < media < crítica.'; return; }
          err.textContent = ''; b.thresholds = { baja: a, media: m, critica: c }; CN.save();
          CN.toast('Umbrales guardados.'); CN.go('/buildings/' + b.id);
        });
      },
    };
  });

  // US39: vincular empresa de mantenimiento
  CN.route('/buildings/:id/companies', A, (p, u) => {
    const b = CN.building(p.id);
    if (!b || !CN.canSee(u, b.id)) return CN.empty('building', 'Edificio no encontrado');
    return {
      title: 'Empresas vinculadas',
      html: '<a class="back" href="#/buildings/' + b.id + '">' + ic('back', 18) + ' ' + esc(b.name) + '</a>' + CN.pageHead('EDIFICIOS · ' + esc(b.name.toUpperCase()), 'Vincular empresa de mantenimiento') +
        '<div class="card"><div class="field"><label for="q">Buscar por RUC o nombre</label><div class="search"><span>' + ic('search', 18) + '</span><input id="q" type="search" placeholder="Ej. 20601234567 o Hernando" autocomplete="off"></div></div><div id="results"></div></div>' +
        '<div class="card"><div class="card-head"><h3>Empresas vinculadas</h3></div><div id="linked"></div></div>',
      mount(root) {
        const q = root.querySelector('#q'), res = root.querySelector('#results'), linked = root.querySelector('#linked');
        const paint = () => {
          const term = q.value.trim().toLowerCase();
          const all = CN.db().companies;
          const cands = all.filter((c) => !b.companyIds.includes(c.id) && (!term || c.name.toLowerCase().includes(term) || c.ruc.includes(term)));
          res.innerHTML = cands.length ? cands.map((c) => '<div class="list-row"><div><b>' + esc(c.name) + '</b><span class="muted"> · RUC ' + esc(c.ruc) + '</span></div><button class="btn btn-primary btn-sm" data-link="' + c.id + '">Vincular empresa</button></div>').join('')
            : '<p class="muted pad">' + (term ? 'No encontramos empresas con ese dato.' : 'No hay más empresas disponibles para vincular.') + '</p>';
          const ls = b.companyIds.map((id) => CN.company(id)).filter(Boolean);
          linked.innerHTML = ls.length ? ls.map((c) => '<div class="list-row"><div><b>' + esc(c.name) + '</b><span class="muted"> · RUC ' + esc(c.ruc) + '</span></div><button class="btn btn-outline btn-sm" data-unlink="' + c.id + '">Desvincular</button></div>').join('') : '<p class="muted pad">Aún no hay empresas vinculadas.</p>';
        };
        q.addEventListener('input', paint); paint();
        CN.delegate(root, 'click', '[data-link]', (e, t) => {
          b.companyIds.push(t.dataset.link); CN.save();
          const c = CN.company(t.dataset.link);
          CN.companyUsers(c.id).forEach((cu) => CN.notify(cu.id, { title: 'Nuevo cliente', body: 'Fuiste vinculado a ' + b.name + '.', kind: 'info', link: '#/clients' }));
          CN.toast(c.name + ' vinculada a ' + b.name + '.'); paint();
        });
        CN.delegate(root, 'click', '[data-unlink]', (e, t) => {
          const c = CN.company(t.dataset.unlink);
          CN.confirm('Desvincular empresa', '¿Quitar a <b>' + esc(c.name) + '</b> de ' + esc(b.name) + '? Dejará de recibir alertas de este edificio.', 'Desvincular', () => { b.companyIds = b.companyIds.filter((x) => x !== c.id); CN.save(); paint(); CN.toast('Empresa desvinculada.', 'info'); }, true);
        });
      },
    };
  });

  // =============== EQUIPOS (US08) ===============
  CN.route('/buildings/:id/equipment/new', A, (p, u) => {
    const b = CN.building(p.id);
    if (!b || !CN.canSee(u, b.id)) return CN.empty('building', 'Edificio no encontrado');
    return {
      title: 'Registrar equipo',
      html: '<a class="back" href="#/buildings/' + b.id + '">' + ic('back', 18) + ' ' + esc(b.name) + '</a>' + CN.pageHead('EDIFICIOS · ' + esc(b.name.toUpperCase()), 'Registrar equipo crítico') +
        '<div class="card form-card"><form id="f" class="stack">' + CN.field({ id: 'type', label: 'Tipo de equipo', type: 'select', options: CN.EQUIP_TYPES }) +
        CN.field({ id: 'location', label: 'Ubicación', placeholder: 'Ej. Sótano 1' }) + CN.field({ id: 'code', label: 'Código interno', placeholder: 'Ej. B-01' }) +
        CN.btn('Guardar equipo', { type: 'submit', icon: 'check' }) + '</form></div>',
      mount(root) {
        CN.bindForm(root.querySelector('#f'), (v, fail) => {
          if (CN.equipmentOf(b.id, true).some((e) => e.code.toLowerCase() === v.code.trim().toLowerCase())) { fail('code', 'Ya existe un equipo con este código en el edificio.'); return; }
          const e = CN.addEquipment(b.id, v);
          CN.toast('Equipo registrado. Ahora asócialo a un sensor.');
          CN.go('/equipment/' + e.id + '/sensors');
        });
      },
    };
  });

  // =============== DETALLE DE EQUIPO ===============
  const TABS = [['live', 'En vivo'], ['readings', 'Lecturas'], ['history', 'Historial'], ['sensors', 'Sensores'], ['interventions', 'Intervenciones'], ['edit', 'Editar']];
  function equipRoute(p, u) {
    const e = CN.equip(p.id);
    if (!e || !CN.canSee(u, e.buildingId)) return { html: CN.empty('cpu', 'Equipo no encontrado', '', '<a class="btn btn-primary" href="#/buildings">Volver</a>') };
    const b = CN.building(e.buildingId);
    const tab = TABS.some((t) => t[0] === p.tab) ? p.tab : 'live';
    const body = { live: tabLive, readings: tabReadings, history: tabHistory, sensors: tabSensors, interventions: tabInterventions, edit: tabEdit }[tab](e, b, u);
    return {
      title: CN.equipName(e),
      html: '<a class="back" href="#/buildings/' + b.id + '">' + ic('back', 18) + ' ' + esc(b.name) + '</a>' +
        CN.pageHead('EQUIPO · ' + esc(CN.equipShort(e).toUpperCase()), esc(CN.equipName(e)), esc(e.location) + ' · ' + esc(b.name), CN.equipStatusChip(e)) +
        '<div class="tabs" role="tablist">' + TABS.map((t) => '<a role="tab" href="#/equipment/' + e.id + '/' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + t[1] + '</a>').join('') + '</div>' + body.html,
      mount(root) { if (body.mount) body.mount(root, e, b, u); },
    };
  }
  CN.route('/equipment/:id', A, equipRoute);
  CN.route('/equipment/:id/:tab', A, equipRoute);

  // ---- En vivo (US16) ----
  function tabLive(e) {
    const vars = CN.TYPE_VARS[e.type];
    return {
      html: '<div class="card"><div class="card-head"><h3>Gráfico en tiempo real</h3><div class="select-wrap inline"><select id="lv" aria-label="Variable">' + vars.map((v) => '<option value="' + v + '">' + CN.varLabel(e.type, v) + '</option>').join('') + '</select>' + ic('chevron', 18) + '</div></div>' +
        '<div class="grid-3 mini" id="lstats"></div><div class="chart-box" id="chart"></div>' +
        (CN.sensorsOf(e.id).length ? '<p class="muted small live-note"><span class="live-dot"></span>Transmitiendo · se actualiza cada 3 segundos</p>' : '') + '</div>',
      mount(root) {
        const sel = root.querySelector('#lv');
        const fresh = CN.TYPE_VARS[e.type].map((v) => ({ v, r: CN.latestReading(e, v) })).filter((x) => x.r).sort((a, b) => b.r.ts - a.r.ts)[0];
        if (fresh && !CN.latestReading(e, CN.TYPE_VARS[e.type][0])) sel.value = fresh.v;
        let series = [], timer = null, lastTick = Date.now(), variable = sel.value;
        const r = () => CN.range(e.type, variable);
        const dec = () => CN.VARS[variable].dec;
        const start = () => {
          const lr = CN.latestReading(e, variable);
          if (!lr) { series = []; return; }
          const now = Date.now(); series = [];
          for (let k = 39; k >= 0; k--) {
            const noise = (Math.sin((now / 3000 - k) * 1.7) + Math.cos((now / 3000 - k) * 0.9)) * 0.012;
            series.push({ ts: now - k * 3000, value: +(lr.value * (1 + noise)).toFixed(dec() + 1) });
          }
          series[series.length - 1].value = lr.value; lastTick = lr.ts;
        };
        const paint = () => {
          const lr = CN.latestReading(e, variable);
          const vv = series.length ? series[series.length - 1].value : null;
          const other = vars_other();
          const ago = Math.max(0, Math.round((Date.now() - lastTick) / 1000));
          root.querySelector('#lstats').innerHTML =
            '<div class="card stat flat"><h2>' + (vv == null ? '—' : CN.fmtVal(+vv.toFixed(dec()), variable)) + '</h2><p>Última lectura de ' + CN.varLabel(e.type, variable).toLowerCase() + '</p></div>' +
            '<div class="card stat flat"><h2>' + (other ? CN.fmtVal(other.value, other.variable) : '—') + '</h2><p>' + (other ? CN.varLabel(e.type, other.variable) + ' actual' : 'Sin más variables') + '</p></div>' +
            '<div class="card stat flat"><h2>' + (lr ? (ago < 3 ? 'Ahora mismo' : ago < 120 ? 'Hace ' + ago + ' s' : CN.timeAgo(lastTick)) : '—') + '</h2><p>Última actualización</p></div>';
          root.querySelector('#chart').innerHTML = CN.lineChart(series, { min: r().min, max: r().max, unit: CN.VARS[variable].unit, dec: dec() });
        };
        const vars_other = () => { const ov = CN.TYPE_VARS[e.type].find((x) => x !== variable); return ov ? Object.assign({ variable: ov }, CN.latestReading(e, ov)) : null; };
        const tick = () => {
          if (!series.length || !CN.sensorsOf(e.id).some((s) => !s.offline)) return;
          const last = series[series.length - 1];
          const noise = (Math.random() - 0.5) * 0.03;
          series.push({ ts: Date.now(), value: +(last.value * (1 + noise)).toFixed(dec() + 1) });
          if (series.length > 40) series.shift();
          lastTick = Date.now(); paint();
        };
        sel.addEventListener('change', () => { variable = sel.value; start(); paint(); });
        start(); paint();
        timer = setInterval(tick, 3000);
        CN.onLeave(() => clearInterval(timer));
      },
    };
  }

  // ---- Lecturas recibidas + simulador (US12, US17, US18) ----
  function tabReadings(e, b) {
    const vars = CN.TYPE_VARS[e.type];
    const canSim = e.active && CN.sensorsOf(e.id).length > 0;
    return {
      html: '<div class="card"><div class="card-head"><h3>Simular lectura de sensor</h3></div><p class="muted small">En un edificio real los sensores envían estos datos automáticamente. Aquí puedes simularlos para ver cómo se generan y actualizan las alertas por severidad.</p>' +
        (canSim ? '<form id="sim" class="sim-form"><div class="field"><label for="sv">Tipo de lectura</label><div class="select-wrap"><select id="sv" name="variable">' + vars.map((v) => '<option value="' + v + '">' + CN.varLabel(e.type, v) + ' (' + CN.VARS[v].unit + ')</option>').join('') + '</select>' + ic('chevron', 18) + '</div></div>' +
          '<div class="field"><label for="val">Valor</label><input id="val" name="value" type="number" step="0.1" required></div><div class="field btn-field">' + CN.btn('Enviar lectura', { type: 'submit', icon: 'send' }) + '</div></form>' +
          '<div class="presets"><span class="muted small">Valores de ejemplo:</span> <button class="chip-btn" data-p="normal">Normal</button><button class="chip-btn" data-p="baja">Baja</button><button class="chip-btn" data-p="media">Media</button><button class="chip-btn" data-p="alta">Alta</button><button class="chip-btn" data-p="critica">Crítica</button></div><p id="simres" class="sim-res" role="status"></p>'
          : '<div class="notice warn">' + ic('alert', 20) + '<div><b>No se pueden simular lecturas</b><p>' + (e.active ? 'Asocia primero un sensor a este equipo.' : 'El equipo está dado de baja.') + '</p></div></div>') + '</div>' +
        '<div class="card"><div class="card-head"><h3>Lecturas recibidas</h3><div class="select-wrap inline"><select id="rf" aria-label="Filtrar">' + '<option value="">Todas</option>' + vars.map((v) => '<option value="' + v + '">' + CN.varLabel(e.type, v) + '</option>').join('') + '</select>' + ic('chevron', 18) + '</div></div><div id="rtable"></div><div class="center"><button class="btn btn-outline" id="more" hidden>Ver más lecturas</button></div></div>',
      mount(root) {
        let limit = 12;
        const paint = () => {
          const f = root.querySelector('#rf').value;
          const rows = CN.readingsFor(e, 14, f || null);
          root.querySelector('#rtable').innerHTML = rows.length ? CN.responsiveTable(['Fecha', 'Tipo de lectura', 'Valor', 'Estado'], rows.slice(0, limit).map((r) => ({ cells: [CN.fmtDateTime(r.ts), esc(CN.varLabel(e.type, r.variable)), CN.fmtVal(r.value, r.variable), CN.sev(CN.readingStatus(e, r))] }))) : '<p class="muted pad">Este equipo aún no recibe lecturas.</p>';
          root.querySelector('#more').hidden = rows.length <= limit;
        };
        root.querySelector('#rf').addEventListener('change', () => { limit = 12; paint(); });
        root.querySelector('#more').addEventListener('click', () => { limit += 24; paint(); });
        paint();
        const f = root.querySelector('#sim');
        if (!f) return;
        const sample = (sev) => {
          const v = f.variable.value, rg = CN.range(e.type, v);
          if (sev === 'normal') return +CN.baseValue(e, v).toFixed(1);
          if (v === 'vibracion') { const t = b.thresholds; return +({ baja: t.baja + 0.2, media: t.media + 0.2, alta: (t.media + t.critica) / 2 + 0.3, critica: t.critica + 0.7 }[sev]).toFixed(1); }
          return +(rg.max * { baja: 1.04, media: 1.13, alta: 1.28, critica: 1.46 }[sev]).toFixed(1);
        };
        root.querySelectorAll('[data-p]').forEach((bt) => bt.addEventListener('click', () => { f.value.value = sample(bt.dataset.p); }));
        f.addEventListener('submit', (ev) => {
          ev.preventDefault();
          const val = parseFloat(f.value.value);
          if (isNaN(val)) return;
          const res = CN.ingestReading(e.id, f.variable.value, val);
          const out = root.querySelector('#simres');
          if (res.error) { out.textContent = res.error; out.className = 'sim-res bad'; return; }
          if (res.severity === 'normal') { out.textContent = 'Lectura registrada: valor dentro del rango esperado (Normal).'; out.className = 'sim-res ok'; }
          else if (res.created) { out.innerHTML = 'Se generó una alerta <b>' + CN.SEV[res.severity].label + '</b>. <a class="link" href="#/alerts/' + res.alert.id + '">Ver alerta</a>'; out.className = 'sim-res bad'; }
          else if (res.updated) { out.innerHTML = 'La alerta existente se actualizó a <b>' + CN.SEV[res.severity].label + '</b> en lugar de crear una nueva. <a class="link" href="#/alerts/' + res.alert.id + '">Ver alerta</a>'; out.className = 'sim-res bad'; }
          else { out.innerHTML = 'Lectura registrada en la alerta activa (severidad sin cambios). <a class="link" href="#/alerts/' + res.alert.id + '">Ver alerta</a>'; out.className = 'sim-res warn'; }
          paint();
        });
      },
    };
  }

  // ---- Historial + exportación CSV (US14, US38) ----
  const RANGES = [['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días']];
  function csvFor(e, days, variable) {
    const rows = CN.readingsFor(e, days, variable || null);
    const head = 'Fecha,Hora,Equipo,Edificio,Tipo de lectura,Valor,Unidad,Estado';
    const b = CN.building(e.buildingId);
    const lines = rows.map((r) => [CN.fmtDate(r.ts), CN.fmtTime(r.ts), '"' + CN.equipName(e) + '"', '"' + b.name + '"', '"' + CN.varLabel(e.type, r.variable) + '"', r.value, CN.VARS[r.variable].unit, CN.SEV[CN.readingStatus(e, r)].label].join(','));
    return { csv: head + '\n' + lines.join('\n'), n: rows.length };
  }
  function tabHistory(e) {
    const vars = CN.TYPE_VARS[e.type];
    return {
      html: '<div class="card"><div class="card-head"><h3>Historial de lecturas</h3><button class="btn btn-outline" id="export">' + ic('download', 18) + '<span>Exportar a CSV</span></button></div>' +
        '<div class="filters">' + CN.field({ id: 'range', label: 'Rango de fechas', type: 'select', options: RANGES.map((r) => ({ value: r[0], label: r[1] })), value: '30', cls: 'fit' }) +
        CN.field({ id: 'hv', label: 'Tipo de lectura', type: 'select', options: [{ value: '', label: 'Todas' }].concat(vars.map((v) => ({ value: v, label: CN.varLabel(e.type, v) }))), required: false, cls: 'fit' }) + '</div>' +
        '<div id="htable"></div><div class="pager"><button class="btn btn-outline btn-sm" id="prev">Anterior</button><span id="pinfo" class="muted"></span><button class="btn btn-outline btn-sm" id="next">Siguiente</button></div></div>',
      mount(root) {
        let page = 0; const PS = 15;
        const paint = () => {
          const days = +root.querySelector('#range').value, v = root.querySelector('#hv').value;
          const rows = CN.readingsFor(e, days, v || null), pages = Math.max(1, Math.ceil(rows.length / PS));
          page = Math.min(page, pages - 1);
          root.querySelector('#htable').innerHTML = rows.length ? CN.responsiveTable(['Fecha', 'Tipo de lectura', 'Valor', 'Estado'], rows.slice(page * PS, page * PS + PS).map((r) => ({ cells: [CN.fmtDateTime(r.ts), esc(CN.varLabel(e.type, r.variable)), CN.fmtVal(r.value, r.variable), CN.sev(CN.readingStatus(e, r))] }))) : '<p class="muted pad">No hay lecturas en este rango.</p>';
          root.querySelector('#pinfo').textContent = 'Página ' + (page + 1) + ' de ' + pages + ' · ' + rows.length + ' lecturas';
          root.querySelector('#prev').disabled = page === 0; root.querySelector('#next').disabled = page >= pages - 1;
        };
        ['#range', '#hv'].forEach((s) => root.querySelector(s).addEventListener('change', () => { page = 0; paint(); }));
        root.querySelector('#prev').onclick = () => { page--; paint(); };
        root.querySelector('#next').onclick = () => { page++; paint(); };
        paint();
        root.querySelector('#export').addEventListener('click', () => CN.modal({
          title: 'Exportar historial de lecturas',
          html: '<form id="fx" class="stack"><p class="muted">' + esc(CN.equipName(e)) + '</p>' + CN.field({ id: 'xr', label: 'Rango de fechas', type: 'select', options: RANGES.map((r) => ({ value: r[0], label: r[1] })), value: '90' }) +
            '<div class="modal-actions"><button type="button" class="btn btn-outline" data-close>Cancelar</button>' + CN.btn('Exportar a CSV', { type: 'submit', icon: 'download' }) + '</div></form>',
          onMount(w, close) {
            w.querySelector('#fx').addEventListener('submit', (ev) => {
              ev.preventDefault();
              const days = +w.querySelector('#xr').value, out = csvFor(e, days);
              if (!out.n) { CN.toast('No hay lecturas para exportar en ese rango.', 'err'); return; }
              CN.downloadFile('lecturas-' + e.code + '-' + days + 'd.csv', out.csv);
              close(); CN.toast('Exportadas ' + out.n + ' lecturas a CSV.');
            });
          },
        }));
      },
    };
  }

  // ---- Sensores (US10) ----
  function tabSensors(e, b) {
    const sensors = CN.sensorsOf(e.id);
    const eqs = CN.equipmentOf(b.id);
    return {
      html: '<div class="card"><div class="card-head"><h3>Sensores asociados</h3></div>' +
        (sensors.length ? CN.responsiveTable(['Identificador', 'Estado', 'Última lectura', ''], sensors.map((s) => ({ cells: ['<b>' + esc(s.id) + '</b>', s.offline ? CN.statusChip('Desconectado', 'bad') : CN.statusChip('Activo', 'ok'), CN.timeAgo(s.lastReadingAt), s.offline ? '' : '<button class="btn btn-outline btn-sm" data-off="' + esc(s.id) + '">Simular desconexión</button>'] })))
          : '<p class="muted pad">Este equipo aún no tiene sensores. Asocia uno abajo para empezar a recibir lecturas.</p>') + '</div>' +
        '<div class="card form-card"><div class="card-head"><h3>Asociar sensor a equipo</h3></div>' + (e.active ? '<form id="f" class="stack">' + CN.field({ id: 'sid', label: 'Identificador de sensor', placeholder: 'Ej. SN-2045', hint: 'Lo encuentras impreso en el sensor.' }) +
          CN.field({ id: 'equip', label: 'Equipo a asociar', type: 'select', options: eqs.map((x) => ({ value: x.id, label: CN.equipName(x) })), value: e.id }) + CN.btn('Asociar sensor', { type: 'submit', icon: 'link' }) + '</form>' : '<p class="muted">El equipo está dado de baja.</p>') + '</div>',
      mount(root) {
        CN.delegate(root, 'click', '[data-off]', (ev, t) => { CN.simulateDisconnect(t.dataset.off); CN.toast('Sensor sin lecturas por 26 horas. Se generó una alerta de sensor desconectado.', 'info', 5000); CN.render(); });
        const f = root.querySelector('#f'); if (!f) return;
        CN.bindForm(f, (v, fail) => {
          const id = v.sid.trim().toUpperCase();
          if (!/^[A-Z0-9][A-Z0-9-]{2,}$/.test(id)) { fail('sid', 'Usa letras, números y guiones (mín. 3 caracteres).'); return; }
          if (CN.db().sensors.some((s) => s.id === id)) { fail('sid', 'Este sensor ya está asociado a un equipo.'); return; }
          CN.addSensor(v.equip, id);
          CN.toast('Sensor ' + id + ' asociado a ' + CN.equipName(CN.equip(v.equip)) + '.');
          CN.go('/equipment/' + v.equip + '/sensors');
        });
      },
    };
  }

  // ---- Intervenciones (US35) ----
  function tabInterventions(e) {
    const rows = CN.db().visits.filter((v) => v.equipId === e.id && v.status === 'realizada').sort((a, b) => b.intervention.ts - a.intervention.ts);
    return {
      html: '<div class="card"><div class="card-head"><h3>Historial de intervenciones</h3></div>' + (rows.length ? CN.responsiveTable(['Fecha', 'Técnico', 'Descripción'], rows.map((v) => ({ link: '#/visits/' + v.id, cells: [CN.fmtShort(v.date), esc(CN.techShort(CN.tech(v.techId))), esc(v.intervention.desc)] }))) : '<p class="muted pad">Todavía no hay intervenciones registradas para este equipo.</p>') + '</div>',
      mount(root) { CN.bindRowLinks(root); },
    };
  }

  // ---- Editar / dar de baja (US09) ----
  function tabEdit(e, b) {
    return {
      html: '<div class="card form-card"><div class="card-head"><h3>Editar equipo: ' + esc(CN.equipName(e)) + '</h3></div><form id="f" class="stack">' + CN.field({ id: 'type', label: 'Tipo de equipo', type: 'select', options: CN.EQUIP_TYPES, value: e.type }) +
        CN.field({ id: 'location', label: 'Ubicación', value: e.location }) + CN.field({ id: 'code', label: 'Código interno', value: e.code }) + CN.btn('Guardar cambios', { type: 'submit', icon: 'check' }) + '</form></div>' +
        '<div class="card danger-zone"><h3>Zona de riesgo</h3>' + (e.active ? '<p class="muted">Dar de baja este equipo detiene la generación de alertas, conservando su historial.</p><button class="btn btn-danger" id="baja">Dar de baja equipo</button>' : '<p class="muted">Este equipo está dado de baja. Puedes reactivarlo para volver a generar alertas.</p><button class="btn btn-primary" id="alta">Reactivar equipo</button>') + '</div>',
      mount(root) {
        CN.bindForm(root.querySelector('#f'), (v, fail) => {
          if (CN.equipmentOf(b.id, true).some((x) => x.id !== e.id && x.code.toLowerCase() === v.code.trim().toLowerCase())) { fail('code', 'Ya existe un equipo con este código.'); return; }
          if (v.type !== e.type && !CN.TYPE_VARS[v.type].every((x) => CN.TYPE_VARS[e.type].includes(x)) && CN.activeAlertFor(e.id)) { fail('type', 'Resuelve la alerta activa antes de cambiar el tipo.'); return; }
          Object.assign(e, { type: v.type, location: v.location.trim(), code: v.code.trim().toUpperCase() }); CN.save();
          CN.toast('Equipo actualizado.'); CN.render();
        });
        const baja = root.querySelector('#baja');
        if (baja) baja.addEventListener('click', () => CN.confirm('Dar de baja equipo', 'Se detendrá la generación de alertas de <b>' + esc(CN.equipName(e)) + '</b> y se cerrarán sus alertas activas. El historial se conserva.', 'Dar de baja', () => {
          e.active = false; CN.db().alerts.filter((a) => a.equipId === e.id && a.status !== 'resuelta').forEach((a) => { a.status = 'resuelta'; a.updatedAt = Date.now(); });
          CN.save(); CN.toast('Equipo dado de baja.', 'info'); CN.render();
        }, true));
        const alta = root.querySelector('#alta');
        if (alta) alta.addEventListener('click', () => { e.active = true; CN.save(); CN.toast('Equipo reactivado.'); CN.render(); });
      },
    };
  }
})();
