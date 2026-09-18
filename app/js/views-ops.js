/* CodeNova — operación: alertas, incidentes, visitas y reportes. */
(function () {
  'use strict';
  const CN = window.CN, esc = CN.esc, ic = CN.icon;
  const AC = { roles: ['admin', 'company'] };
  CN.query = () => { const h = location.hash, i = h.indexOf('?'); return new URLSearchParams(i >= 0 ? h.slice(i + 1) : ''); };

  // =============== ALERTAS ===============
  CN.route('/alerts', AC, (p, u) => {
    const bs = CN.buildingsOf(u);
    const filt = CN.store.get('cn_alert_filter') || 'activas';
    const bsel = CN.store.get('cn_alert_building') || '';
    const ids = bsel && bs.some((b) => b.id === bsel) ? [bsel] : bs.map((b) => b.id);
    let list = CN.db().alerts.filter((a) => ids.includes(a.buildingId));
    if (filt === 'activas') list = list.filter((a) => a.status !== 'resuelta');
    if (filt === 'resueltas') list = list.filter((a) => a.status === 'resuelta');
    list.sort((a, b) => (a.status === 'resuelta') - (b.status === 'resuelta') || CN.sevRank(b.severity) - CN.sevRank(a.severity) || b.createdAt - a.createdAt);
    return {
      title: 'Alertas',
      html: CN.pageHead('ALERTAS', 'Alertas por severidad', u.role === 'company' ? 'Alertas de los edificios que atiendes' : null) +
        '<div class="card"><div class="filters">' +
        '<div class="seg" role="tablist">' + [['activas', 'Activas'], ['resueltas', 'Resueltas'], ['todas', 'Todas']].map((x) => '<button role="tab" data-f="' + x[0] + '" class="' + (filt === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
        (bs.length > 1 ? '<div class="select-wrap inline"><select id="ab" aria-label="Edificio"><option value="">Todos los edificios</option>' + bs.map((b) => '<option value="' + b.id + '"' + (b.id === bsel ? ' selected' : '') + '>' + esc(b.name) + '</option>').join('') + '</select>' + ic('chevron', 18) + '</div>' : '') + '</div>' +
        (list.length ? CN.responsiveTable(['Equipo', 'Edificio', 'Severidad', 'Estado', 'Detectado'], list.map((a) => { const e = CN.equip(a.equipId); return { link: '#/alerts/' + a.id, cells: ['<b>' + esc(CN.equipName(e)) + '</b>' + (a.kind === 'sin_datos' ? '<br><span class="muted small">Sensor desconectado</span>' : ''), esc(CN.building(a.buildingId).name), CN.sev(a.severity), CN.alertStatusChip(a.status), CN.timeAgo(a.createdAt)] }; }))
          : CN.empty('checkCircle', 'Sin alertas', filt === 'activas' ? 'No hay alertas activas. Todo opera con normalidad.' : 'No hay alertas para mostrar.')) + '</div>',
      mount(root) {
        CN.bindRowLinks(root);
        CN.delegate(root, 'click', '[data-f]', (e, t) => { CN.store.set('cn_alert_filter', t.dataset.f); CN.render(); });
        const s = root.querySelector('#ab'); if (s) s.addEventListener('change', () => { CN.store.set('cn_alert_building', s.value); CN.render(); });
      },
    };
  });

  CN.route('/alerts/:id', AC, (p, u) => {
    const a = CN.alert(p.id);
    if (!a || !CN.canSee(u, a.buildingId)) return { html: CN.empty('alert', 'Alerta no encontrada', '', '<a class="btn btn-primary" href="#/alerts">Volver</a>') };
    const e = CN.equip(a.equipId), b = CN.building(a.buildingId);
    const isAdmin = u.role === 'admin';
    const disc = a.kind === 'sin_datos';
    const multi = a.history.length > 1;
    const notified = a.notifiedCompany;
    const visits = CN.db().visits.filter((v) => v.equipId === e.id && !['realizada', 'cancelada'].includes(v.status));
    return {
      title: 'Alerta',
      html: '<a class="back" href="#/alerts">' + ic('back', 18) + ' Alertas</a>' +
        CN.pageHead('ALERTAS · ' + esc(b.name.toUpperCase()), disc ? 'Sensor desconectado' : multi ? 'Alerta actualizada · ' + esc(CN.equipShort(e)) : 'Alerta generada') +
        '<div class="card"><div class="alert-line">' + CN.sevChip(a.severity, true) + '<h2>' + esc(CN.equipName(e)) + '</h2>' + CN.alertStatusChip(a.status) + '</div>' +
        '<p class="muted">' + (disc ? 'Sin lecturas hace ' + CN.hoursWithoutData(a) + ' horas. El monitoreo de este equipo está interrumpido.' : esc(a.message)) + '</p>' +
        '<p class="muted small">' + esc(e.location) + ' · ' + esc(b.name) + ' · Detectada ' + CN.timeAgo(a.createdAt).toLowerCase() + '</p>' +
        '<div class="btn-row">' +
        (isAdmin && disc && a.status !== 'resuelta' ? (notified ? '<span class="chip" style="background:#E6F4EC;color:#2E9E6D">' + ic('check', 16) + 'Empresa notificada</span>' : '<button class="btn btn-primary" id="notify">' + ic('send', 20) + '<span>Notificar a empresa de mantenimiento</span></button>') : '') +
        (isAdmin ? '<a class="btn btn-outline" href="#/equipment/' + e.id + '/' + (disc ? 'sensors' : 'live') + '">' + ic('cpu', 18) + '<span>Ver detalle del equipo</span></a>' : '') +
        (isAdmin && a.status !== 'resuelta' ? '<a class="btn btn-outline" href="#/visits/new?equip=' + e.id + '&alert=' + a.id + '">' + ic('calendar', 18) + '<span>Programar visita</span></a>' : '') + '</div></div>' +
        (multi ? '<div class="card"><div class="card-head"><h3>Evolución de la alerta</h3></div>' + CN.responsiveTable(['Fecha', 'Lectura', 'Severidad'], a.history.slice().sort((x, y) => x.ts - y.ts).map((h) => ({ cells: [CN.fmtDateTime(h.ts), CN.fmtVal(h.value, a.variable), CN.sev(h.severity)] }))) + '<p class="muted small">La alerta existente se actualiza a la severidad más alta en lugar de crear una nueva.</p></div>' : '') +
        (visits.length ? '<div class="card"><div class="card-head"><h3>Visitas relacionadas</h3></div>' + visits.map((v) => '<a class="list-row link-row" href="#/visits/' + v.id + '"><div><b>' + CN.fmtDateTime(v.date) + '</b> <span class="muted">· ' + esc(CN.company(v.companyId).name) + '</span></div>' + CN.visitStatusChip(v.status) + '</a>').join('') + '</div>' : '') +
        '<div class="card form-card"><div class="card-head"><h3>Estado de la alerta</h3></div><form id="fs" class="stack">' + CN.field({ id: 'status', label: 'Estado', type: 'select', options: Object.keys(CN.ALERT_STATUS).map((k) => ({ value: k, label: CN.ALERT_STATUS[k] })), value: a.status }) + CN.btn('Guardar estado', { type: 'submit', icon: 'check' }) + '</form></div>',
      mount(root) {
        const n = root.querySelector('#notify');
        if (n) n.addEventListener('click', () => { CN.notifyCompaniesOfAlert(a); if (!(b.companyIds || []).length) CN.toast('Este edificio no tiene empresas vinculadas.', 'err'); else CN.toast('Empresa de mantenimiento notificada.'); CN.render(); });
        CN.bindForm(root.querySelector('#fs'), (v) => { CN.setAlertStatus(a, v.status); CN.toast('Estado actualizado a “' + CN.ALERT_STATUS[v.status] + '”.'); CN.render(); });
        CN.bindRowLinks(root);
      },
    };
  });

  // =============== INCIDENTES (admin) ===============
  CN.route('/incidents', { roles: ['admin'] }, (p, u) => {
    const bs = CN.buildingsOf(u), ids = bs.map((b) => b.id);
    const list = CN.db().incidents.filter((i) => ids.includes(i.buildingId)).sort((a, b) => (a.status === 'resuelto') - (b.status === 'resuelto') || b.createdAt - a.createdAt);
    return {
      title: 'Incidentes',
      html: CN.pageHead('INCIDENTES', 'Incidentes reportados', 'Reportes enviados por los residentes de tus edificios') +
        '<div class="card">' + (list.length ? CN.responsiveTable(['Incidente', 'Reportado por', 'Estado', 'Fecha', 'Visita', ''], list.map((i) => {
          const v = i.visitId && CN.visit(i.visitId);
          return { cells: ['<b>' + esc(i.title) + '</b>' + (i.rating ? '<br>' + CN.stars(i.rating.stars, 14) : ''), 'Depto. ' + esc(i.unit) + '<br><span class="muted small">' + esc(CN.building(i.buildingId).name) + '</span>', CN.incStatusChip(i.status), CN.timeAgo(i.createdAt), v ? '<a class="link" href="#/visits/' + v.id + '">' + CN.fmtShort(v.date) + '</a>' : '—', '<button class="btn btn-outline btn-sm" data-i="' + i.id + '">Gestionar</button>'] };
        })) : CN.empty('message', 'Sin incidentes', 'Cuando un residente reporte un problema aparecerá aquí.')) + '</div>',
      mount(root) { CN.delegate(root, 'click', '[data-i]', (e, t) => manageIncident(CN.incident(t.dataset.i))); },
    };
  });

  function manageIncident(i) {
    const b = CN.building(i.buildingId);
    const open = CN.db().visits.filter((v) => v.buildingId === b.id && ['propuesta', 'contrapropuesta', 'confirmada'].includes(v.status));
    const canAssign = i.status !== 'resuelto' && b.companyIds.length;
    CN.modal({
      title: esc(i.title.replace(' - ', ' · ')),
      html: '<p class="muted">Reportado por: Depto. ' + esc(i.unit) + ' · ' + CN.timeAgo(i.createdAt) + '</p><p>' + esc(i.description) + '</p>' + (i.photo ? '<img class="inc-photo" src="' + i.photo + '" alt="Foto del incidente">' : '') +
        (i.rating ? '<p>Calificación del residente: ' + CN.stars(i.rating.stars) + (i.rating.comment ? '<br><span class="muted">“' + esc(i.rating.comment) + '”</span>' : '') + '</p>' : '') +
        (canAssign ? '<form id="fa" class="stack">' + CN.field({ id: 'visit', label: 'Asociar a visita', type: 'select', options: [{ value: 'new', label: 'Nueva visita de mantenimiento' }].concat(open.map((v) => ({ value: v.id, label: CN.equipShort(CN.equip(v.equipId)) + ' · ' + CN.fmtDateTime(v.date) }))), value: i.visitId || 'new' }) +
          '<div class="modal-actions">' + CN.btn('Confirmar asignación', { type: 'submit', icon: 'check' }) + '</div></form>' : (i.status !== 'resuelto' ? '<div class="notice warn">' + ic('alert', 20) + '<div><b>Sin empresa vinculada</b><p>Vincula una empresa de mantenimiento al edificio para asignar visitas.</p></div></div>' : '')) +
        '<form id="fs" class="stack top-gap">' + CN.field({ id: 'status', label: 'Estado del incidente', type: 'select', options: Object.keys(CN.INC_STATUS).map((k) => ({ value: k, label: CN.INC_STATUS[k] })), value: i.status }) +
        '<div class="modal-actions"><button type="button" class="btn btn-outline" data-close>Cerrar</button>' + CN.btn('Guardar estado', { type: 'submit', cls: 'btn-outline', icon: 'check' }) + '</div></form>',
      onMount(w, close) {
        const fa = w.querySelector('#fa');
        if (fa) CN.bindForm(fa, (v) => {
          const r = CN.assignIncident(i, v.visit, CN.session());
          if (r.error) { CN.toast(r.error, 'err'); return; }
          close(); CN.toast('Incidente asociado a la visita del ' + CN.fmtDateTime(r.visit.date) + '. El residente fue notificado.'); CN.render();
        });
        CN.bindForm(w.querySelector('#fs'), (v) => { CN.setIncidentStatus(i, v.status); close(); CN.toast('Estado actualizado. El residente fue notificado.'); CN.render(); });
      },
    });
  }

  // =============== VISITAS ===============
  CN.route('/visits', { roles: ['admin'] }, (p, u) => {
    const ids = CN.buildingsOf(u).map((b) => b.id);
    const filt = CN.store.get('cn_visit_filter') || 'proximas';
    let list = CN.db().visits.filter((v) => ids.includes(v.buildingId));
    if (filt === 'proximas') list = list.filter((v) => ['propuesta', 'contrapropuesta', 'confirmada'].includes(v.status)).sort((a, b) => a.date - b.date);
    else if (filt === 'historial') list = list.filter((v) => ['realizada', 'cancelada'].includes(v.status)).sort((a, b) => b.date - a.date);
    else list.sort((a, b) => b.date - a.date);
    return {
      title: 'Visitas',
      html: CN.pageHead('VISITAS', 'Visitas de mantenimiento', null, '<a class="btn btn-primary" href="#/visits/new">' + ic('plus', 20) + '<span>Programar visita</span></a>') +
        '<div class="card"><div class="filters"><div class="seg">' + [['proximas', 'Próximas'], ['historial', 'Historial'], ['todas', 'Todas']].map((x) => '<button data-f="' + x[0] + '" class="' + (filt === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div></div>' +
        (list.length ? CN.responsiveTable(['Equipo', 'Edificio', 'Empresa', 'Fecha', 'Técnico', 'Estado'], list.map((v) => ({ link: '#/visits/' + v.id, cells: ['<b>' + esc(CN.equipShort(CN.equip(v.equipId))) + '</b>' + (v.type === 'correctiva' ? '<br><span class="muted small">Correctiva</span>' : ''), esc(CN.building(v.buildingId).name), esc(CN.company(v.companyId).name), CN.fmtDateTime(v.date), esc(CN.techShort(CN.tech(v.techId))), CN.visitStatusChip(v.status)] })))
          : CN.empty('calendar', 'No hay visitas', 'Programa una visita de mantenimiento preventivo.', '<a class="btn btn-primary" href="#/visits/new">Programar visita</a>')) + '</div>',
      mount(root) { CN.bindRowLinks(root); CN.delegate(root, 'click', '[data-f]', (e, t) => { CN.store.set('cn_visit_filter', t.dataset.f); CN.render(); }); },
    };
  });

  // US28: programar visita preventiva
  CN.route('/visits/new', { roles: ['admin'] }, (p, u) => {
    const bs = CN.buildingsOf(u).filter((b) => b.companyIds.length && CN.equipmentOf(b.id).length);
    const q = CN.query();
    const pre = q.get('equip') && CN.equip(q.get('equip'));
    const firstB = pre ? CN.building(pre.buildingId) : bs[0];
    const min = CN.toLocalInput(Date.now() + CN.H);
    return {
      title: 'Programar visita',
      html: '<a class="back" href="#/visits">' + ic('back', 18) + ' Visitas</a>' + CN.pageHead('VISITAS', 'Programar visita preventiva') +
        (bs.length ? '<div class="card form-card"><form id="f" class="stack">' +
          (bs.length > 1 ? CN.field({ id: 'building', label: 'Edificio', type: 'select', options: bs.map((b) => ({ value: b.id, label: b.name })), value: firstB.id }) : '<input type="hidden" name="building" id="building" value="' + firstB.id + '">') +
          '<div id="dyn"></div>' + CN.field({ id: 'date', label: 'Fecha propuesta', type: 'datetime-local', value: CN.toLocalInput(Math.ceil((Date.now() + 2 * CN.D) / CN.H) * CN.H), attrs: 'min="' + min + '"' }) +
          CN.field({ id: 'notes', label: 'Notas para la empresa (opcional)', type: 'textarea', rows: 3, required: false }) +
          CN.btn('Programar visita', { type: 'submit', icon: 'calendar' }) + '</form></div>'
          : CN.empty('wrench', 'Aún no puedes programar visitas', 'Necesitas un edificio con al menos un equipo y una empresa de mantenimiento vinculada.', '<a class="btn btn-primary" href="#/buildings">Ir a edificios</a>')),
      mount(root) {
        const f = root.querySelector('#f'); if (!f) return;
        const dyn = root.querySelector('#dyn');
        const alertId = q.get('alert');
        const paint = () => {
          const b = CN.building(f.building.value);
          const eqs = CN.equipmentOf(b.id);
          dyn.innerHTML = CN.field({ id: 'equip', label: 'Equipo', type: 'select', options: eqs.map((e) => ({ value: e.id, label: CN.equipName(e) })), value: pre && pre.buildingId === b.id ? pre.id : eqs[0].id }) +
            CN.field({ id: 'company', label: 'Empresa de mantenimiento', type: 'select', options: b.companyIds.map((id) => CN.company(id)).map((c) => ({ value: c.id, label: c.name })) });
        };
        f.building.addEventListener('change', paint); paint();
        CN.bindForm(f, (v, fail) => {
          const ts = new Date(v.date).getTime();
          if (isNaN(ts) || ts < Date.now()) { fail('date', 'Elige una fecha y hora futuras.'); return; }
          const e = CN.equip(v.equip);
          const al = alertId && CN.alert(alertId);
          const vis = CN.scheduleVisit({ buildingId: v.building, equipId: v.equip, companyId: v.company, date: ts, notes: v.notes, alertId: al && al.equipId === e.id ? al.id : null, type: al ? 'correctiva' : 'preventiva' });
          CN.toast('Visita programada. La empresa fue notificada.'); CN.go('/visits/' + vis.id);
        });
      },
    };
  });

  // Detalle de visita (admin y empresa): US29, US30, US31, US33, US42
  CN.route('/visits/:id', AC, (p, u) => {
    const v = CN.visit(p.id);
    if (!v || !CN.canSee(u, v.buildingId)) return { html: CN.empty('wrench', 'Visita no encontrada', '', '<a class="btn btn-primary" href="#/' + (u.role === 'admin' ? 'visits' : 'week') + '">Volver</a>') };
    if (u.role === 'company' && v.companyId !== u.companyId) return { html: CN.empty('wrench', 'Visita no encontrada') };
    const e = CN.equip(v.equipId), b = CN.building(v.buildingId), comp = CN.company(v.companyId);
    const isAdmin = u.role === 'admin', isCo = u.role === 'company';
    const open = ['propuesta', 'contrapropuesta', 'confirmada'].includes(v.status);
    const techs = CN.db().technicians.filter((t) => t.companyId === v.companyId);
    const prev = CN.db().visits.filter((x) => x.equipId === e.id && x.status === 'realizada' && x.id !== v.id).sort((a, c) => c.intervention.ts - a.intervention.ts);
    const alertA = CN.activeAlertFor(e.id);
    const primary = CN.TYPE_VARS[e.type][0];
    const lr = CN.latestReading(e, primary);
    const tech = v.techId && CN.tech(v.techId);
    const back = isAdmin ? '#/visits' : '#/week';
    let actions = '';
    if (isAdmin && open) {
      actions += (v.status === 'contrapropuesta' ? '<button class="btn btn-primary" id="accept">' + ic('check', 20) + '<span>Aceptar nueva fecha</span></button>' : '') + '<button class="btn btn-outline danger-o" id="cancel">' + ic('x', 18) + '<span>Cancelar visita</span></button>';
    }
    if (isCo && v.status === 'propuesta') actions += '<button class="btn btn-primary" id="confirm">' + ic('check', 20) + '<span>Confirmar</span></button><button class="btn btn-outline" id="other">' + ic('calendar', 18) + '<span>Proponer otra fecha</span></button>';
    if (isCo && v.status === 'contrapropuesta') actions += '<span class="chip" style="background:#FFF4D6;color:#8A6100">Esperando respuesta del administrador</span>';
    return {
      title: 'Visita',
      html: '<a class="back" href="' + back + '">' + ic('back', 18) + ' ' + (isAdmin ? 'Visitas' : 'Mi semana') + '</a>' +
        CN.pageHead('VISITA · ' + esc(b.name.toUpperCase()), esc(CN.equipName(e)), null, CN.visitStatusChip(v.status)) +
        '<div class="card"><div class="detail-grid">' +
        '<div><p class="muted">Fecha ' + (v.status === 'propuesta' ? 'propuesta' : v.status === 'contrapropuesta' ? 'propuesta por la empresa' : '') + '</p><h3>' + CN.dayLabel(v.date) + ', ' + CN.fmtDateTime(v.date) + '</h3></div>' +
        '<div><p class="muted">Empresa</p><h3>' + esc(comp.name) + '</h3></div><div><p class="muted">Técnico asignado</p><h3>' + (tech ? esc(tech.name) : 'Sin asignar') + '</h3></div>' +
        '<div><p class="muted">Tipo</p><h3>' + (v.type === 'correctiva' ? 'Correctiva' : 'Preventiva') + '</h3></div></div>' +
        (v.notes ? '<p class="muted">Notas: ' + esc(v.notes) + '</p>' : '') + (v.status === 'cancelada' ? '<div class="notice bad">' + ic('x', 20) + '<div><b>Visita cancelada</b><p>Motivo: ' + esc(v.cancelReason) + '</p></div></div>' : '') +
        (v.incidentIds.length ? '<p class="muted">Incidentes asociados: ' + v.incidentIds.map((id) => esc(CN.incident(id).title)).join(', ') + '</p>' : '') +
        (actions ? '<div class="btn-row">' + actions + '</div>' : '') + '</div>' +
        // US30: datos técnicos previos
        '<div class="card"><div class="card-head"><h3>Datos técnicos previos: ' + esc(CN.equipShort(e)) + '</h3></div><div class="grid-3 mini">' +
        '<div class="card stat flat"><h2>' + (lr ? CN.fmtVal(lr.value, primary) : '—') + '</h2><p>Última ' + CN.varLabel(e.type, primary).toLowerCase() + '</p></div>' +
        '<div class="card stat flat"><h2>' + (alertA ? CN.sev(alertA.severity) : CN.sev('normal')) + '</h2><p>Severidad actual</p></div>' +
        '<div class="card stat flat"><h2>' + prev.length + '</h2><p>Intervenciones previas</p></div></div>' +
        (prev.length ? CN.responsiveTable(['Fecha', 'Técnico', 'Descripción'], prev.slice(0, 5).map((x) => ({ cells: [CN.fmtShort(x.date), esc(CN.techShort(CN.tech(x.techId))), esc(x.intervention.desc)] }))) : '') + '</div>' +
        (isCo && open ? '<div class="card form-card"><div class="card-head"><h3>Asignar técnico</h3></div>' + (techs.length ? '<form id="ft" class="stack">' + CN.field({ id: 'tech', label: 'Técnico disponible', type: 'select', options: techs.map((t) => ({ value: t.id, label: t.name + ' · ' + t.specialty })), value: v.techId || techs[0].id }) + CN.btn('Asignar visita', { type: 'submit', icon: 'check' }) + '</form>' : '<p class="muted">Aún no tienes técnicos. <a class="link" href="#/technicians">Agrega uno</a>.</p>') + '</div>' : '') +
        (isCo && v.status === 'confirmada' ? '<div class="card form-card"><div class="card-head"><h3>Registrar intervención: ' + esc(CN.equipShort(e)) + '</h3></div><form id="fi" class="stack">' + CN.field({ id: 'desc', label: 'Descripción del trabajo realizado', type: 'textarea', rows: 4 }) + CN.field({ id: 'mats', label: 'Materiales usados', type: 'textarea', rows: 3, required: false, placeholder: 'Ej. Rodamiento 6205, grasa industrial' }) + CN.btn('Guardar intervención', { type: 'submit', icon: 'check' }) + '</form></div>' : '') +
        (isCo && v.status === 'propuesta' ? '<p class="muted small">Confirma la visita para poder registrar la intervención realizada.</p>' : '') +
        (v.intervention ? '<div class="card"><div class="card-head"><h3>Intervención realizada</h3>' + CN.statusChip(CN.fmtDateTime(v.intervention.ts), 'ok') + '</div><p>' + esc(v.intervention.desc) + '</p><p class="muted">Materiales: ' + esc(v.intervention.materials) + '</p>' + (v.saving ? '<p><b>Ahorro estimado:</b> ' + CN.money(v.saving) + '</p>' : '') + '</div>' : ''),
      mount(root) {
        const on = (id, fn) => { const el = root.querySelector(id); if (el) el.addEventListener('click', fn); };
        on('#confirm', () => { CN.confirmVisit(v); CN.toast('Visita confirmada. El administrador fue notificado.'); CN.render(); });
        on('#accept', () => { CN.confirmVisit(v); CN.toast('Nueva fecha aceptada. Visita confirmada.'); CN.render(); });
        on('#other', () => CN.modal({
          title: 'Proponer otra fecha', html: '<form id="fo" class="stack">' + CN.field({ id: 'date', label: 'Nueva fecha y hora', type: 'datetime-local', value: CN.toLocalInput(v.date + CN.D), attrs: 'min="' + CN.toLocalInput(Date.now() + CN.H) + '"' }) + '<div class="modal-actions"><button type="button" class="btn btn-outline" data-close>Cancelar</button>' + CN.btn('Proponer fecha', { type: 'submit', icon: 'send' }) + '</div></form>',
          onMount(w, close) { CN.bindForm(w.querySelector('#fo'), (val, fail) => { const ts = new Date(val.date).getTime(); if (isNaN(ts) || ts < Date.now()) { fail('date', 'Elige una fecha futura.'); return; } CN.counterPropose(v, ts); close(); CN.toast('Nueva fecha propuesta al administrador.'); CN.render(); }); },
        }));
        on('#cancel', () => CN.modal({
          title: 'Cancelar visita: ' + esc(CN.equipShort(e)), html: '<p class="muted">Programada para el ' + CN.fmtDateTime(v.date) + ' con ' + esc(comp.name) + '</p><form id="fc" class="stack">' + CN.field({ id: 'reason', label: 'Motivo de cancelación', type: 'textarea', rows: 3 }) + '<div class="modal-actions"><button type="button" class="btn btn-outline" data-close>Volver</button>' + CN.btn('Cancelar visita', { type: 'submit', cls: 'btn-danger', icon: 'x' }) + '</div></form>',
          onMount(w, close) { CN.bindForm(w.querySelector('#fc'), (val) => { CN.cancelVisit(v, val.reason.trim()); close(); CN.toast('Visita cancelada. La empresa fue notificada.', 'info'); CN.render(); }); },
        }));
        const ft = root.querySelector('#ft'); if (ft) CN.bindForm(ft, (val) => { CN.assignTech(v, val.tech); CN.toast('Visita asignada a ' + CN.tech(val.tech).name + '.'); CN.render(); });
        const fi = root.querySelector('#fi'); if (fi) CN.bindForm(fi, (val) => { CN.registerIntervention(v, val.desc.trim(), val.mats.trim()); CN.toast('Intervención registrada. Ahorro estimado ' + CN.money(v.saving) + '.'); CN.render(); });
      },
    };
  });

  // =============== REPORTES (US36, US43) ===============
  CN.route('/reports', { roles: ['admin'] }, (p, u) => {
    const bs = CN.buildingsOf(u);
    const rank = CN.ranking();
    return {
      title: 'Reportes',
      html: CN.pageHead('REPORTES', 'Generar reporte para la junta', 'Resume alertas, intervenciones y ahorro del período') +
        (bs.length ? '<div class="card"><div class="filters">' +
          CN.field({ id: 'rb', label: 'Edificio', type: 'select', options: bs.map((b) => ({ value: b.id, label: b.name })), value: CN.selectedBuilding(u).id, cls: 'fit' }) +
          CN.field({ id: 'rr', label: 'Rango de fechas', type: 'select', options: [{ value: '30', label: 'Último mes' }, { value: '90', label: 'Último trimestre' }, { value: '365', label: 'Último año' }], value: '90', cls: 'fit' }) +
          '<div class="field fit btn-field"><button class="btn btn-primary" id="pdf">' + ic('printer', 20) + '<span>Generar reporte PDF</span></button></div></div>' +
          '<p class="muted small">Se abrirá el diálogo de impresión: elige “Guardar como PDF” como destino.</p></div>' +
          '<div class="card"><div class="card-head"><h3>Vista previa</h3></div><div id="sheet" class="report-sheet"></div></div>' : CN.empty('book', 'Sin edificios', 'Registra un edificio para generar reportes.')) +
        '<div class="card"><div class="card-head"><h3>Ranking de empresas por tiempo de respuesta</h3></div>' + CN.responsiveTable(['#', 'Empresa', 'Tiempo promedio de respuesta', 'Visitas completadas'], rank.map((r, i) => ({ cells: [String(i + 1), '<b>' + esc(r.company.name) + '</b>', r.visits && r.avg ? r.avg.toFixed(1) + ' horas' : '—', String(r.visits)] }))) + '</div>',
      mount(root) {
        const sheet = root.querySelector('#sheet'); if (!sheet) return;
        const paint = () => {
          const b = CN.building(root.querySelector('#rb').value), days = +root.querySelector('#rr').value;
          const st = CN.stats([b.id], days);
          const label = { 30: 'Último mes', 90: 'Último trimestre', 365: 'Último año' }[days];
          const bySev = ['critica', 'alta', 'media', 'baja', 'sin_datos'].map((s) => [s, st.alerts.filter((a) => a.severity === s).length]).filter((x) => x[1]);
          sheet.innerHTML = '<div class="rs-head"><div>' + CN.logoTile(34) + '<b>CodeNova</b></div><div class="rs-meta"><b>Reporte de mantenimiento preventivo</b><span>' + esc(b.name) + ' · ' + esc(b.address) + '</span><span>' + label + ' · Generado el ' + CN.fmtDate(Date.now()) + '</span></div></div>' +
            '<div class="grid-4 rs-kpis"><div><h2>' + st.alerts.length + '</h2><p>Alertas generadas</p></div><div><h2>' + st.critical + '</h2><p>Alertas críticas</p></div><div><h2>' + st.visits.length + '</h2><p>Intervenciones</p></div><div><h2>' + CN.money(st.saving) + '</h2><p>Ahorro estimado</p></div></div>' +
            '<h4>Alertas por severidad</h4>' + (bySev.length ? '<div class="tags">' + bySev.map((x) => CN.sevChip(x[0]).replace('</span>', ': ' + x[1] + '</span>')).join('') + '</div>' : '<p class="muted">Sin alertas en el período.</p>') +
            '<h4>Intervenciones realizadas</h4>' + (st.visits.length ? CN.responsiveTable(['Fecha', 'Equipo', 'Técnico', 'Descripción', 'Ahorro'], st.visits.sort((a, c) => c.intervention.ts - a.intervention.ts).map((v) => ({ cells: [CN.fmtShort(v.intervention.ts), esc(CN.equipShort(CN.equip(v.equipId))), esc(CN.techShort(CN.tech(v.techId))), esc(v.intervention.desc), CN.money(v.saving)] }))) : '<p class="muted">No se registraron intervenciones en el período. Los ahorros acumulados anteriores suman ' + CN.money(CN.buildingSavings(b.id)) + '.</p>') +
            '<h4>Incidentes de residentes</h4><p>' + st.incidents.length + ' reportados · ' + st.incidents.filter((i) => i.status === 'resuelto').length + ' resueltos</p>' +
            '<p class="muted small rs-foot">Ahorro acumulado histórico del edificio: ' + CN.money(CN.buildingSavings(b.id)) + ' frente a mantenimiento correctivo.</p>';
        };
        root.querySelector('#rb').addEventListener('change', paint); root.querySelector('#rr').addEventListener('change', paint);
        root.querySelector('#pdf').addEventListener('click', () => { document.body.classList.add('printing-report'); const done = () => document.body.classList.remove('printing-report'); window.addEventListener('afterprint', done, { once: true }); setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50); });
        paint();
      },
    };
  });
})();
