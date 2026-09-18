/* CodeNova — empresa de mantenimiento: mi semana, clientes y técnicos. */
(function () {
  'use strict';
  const CN = window.CN, esc = CN.esc, ic = CN.icon;
  const CO = { roles: ['company'] };

  // US29 + US32: visitas de la semana priorizadas por severidad y zona
  CN.route('/week', CO, (p, u) => {
    const ids = CN.buildingsOf(u).map((b) => b.id);
    const mine = CN.db().visits.filter((v) => v.companyId === u.companyId && ids.includes(v.buildingId));
    const open = mine.filter((v) => ['propuesta', 'contrapropuesta', 'confirmada'].includes(v.status));
    const sevOf = (v) => { const a = CN.activeAlertFor(v.equipId); return a ? a.severity : 'baja'; };
    const zone = (v) => CN.building(v.buildingId).district || '—';
    open.sort((a, b) => CN.sevRank(sevOf(b)) - CN.sevRank(sevOf(a)) || zone(a).localeCompare(zone(b)) || a.date - b.date);
    const proposals = open.filter((v) => v.status === 'propuesta');
    const critical = CN.activeAlerts(ids).filter((a) => a.severity === 'critica').length;
    return {
      title: 'Mi semana',
      html: CN.pageHead('MI SEMANA', 'Mi semana', esc(CN.company(u.companyId).name)) +
        '<div class="grid-3">' + CN.stat('calendar', proposals.length, 'Visitas por confirmar') + CN.stat('wrench', open.filter((v) => v.status === 'confirmada').length, 'Visitas confirmadas') + CN.stat('alert', critical, 'Alertas críticas activas', ' data-go="#/alerts"') + '</div>' +
        (proposals.length ? '<div class="card"><div class="card-head"><h3>Visitas propuestas</h3></div>' + proposals.map((v) => {
          const e = CN.equip(v.equipId), b = CN.building(v.buildingId);
          return '<div class="proposal"><div><b>Visita propuesta · ' + esc(b.name) + '</b><p class="muted">' + esc(CN.equipName(e)) + ' · Propuesta: ' + CN.fmtShort(v.date) + ', ' + CN.fmtTime(v.date) + '</p></div><div class="btn-row"><button class="btn btn-primary" data-confirm="' + v.id + '">' + ic('check', 18) + '<span>Confirmar</span></button><button class="btn btn-outline" data-other="' + v.id + '">Proponer otra fecha</button></div></div>';
        }).join('') + '</div>' : '') +
        '<div class="card"><div class="card-head"><h3>Visitas ordenadas por severidad y zona</h3></div>' +
        (open.length ? CN.responsiveTable(['Edificio', 'Equipo', 'Severidad', 'Zona', 'Fecha', 'Estado'], open.map((v) => ({ link: '#/visits/' + v.id, cells: ['<b>' + esc(CN.building(v.buildingId).name) + '</b>', esc(CN.equipShort(CN.equip(v.equipId))), CN.sev(sevOf(v)), esc(zone(v)), CN.dayLabel(v.date) + '<br><span class="muted small">' + CN.fmtTime(v.date) + '</span>', CN.visitStatusChip(v.status)] })))
          : CN.empty('calendar', 'Sin visitas pendientes', 'Cuando un administrador programe una visita aparecerá aquí.')) + '</div>',
      mount(root) {
        CN.bindRowLinks(root);
        root.querySelectorAll('[data-go]').forEach((c) => c.addEventListener('click', () => (location.hash = c.dataset.go)));
        CN.delegate(root, 'click', '[data-confirm]', (e, t) => { CN.confirmVisit(CN.visit(t.dataset.confirm)); CN.toast('Visita confirmada. El administrador fue notificado.'); CN.render(); });
        CN.delegate(root, 'click', '[data-other]', (e, t) => {
          const v = CN.visit(t.dataset.other);
          CN.modal({
            title: 'Proponer otra fecha', html: '<p class="muted">' + esc(CN.equipName(CN.equip(v.equipId))) + ' · ' + esc(CN.building(v.buildingId).name) + '</p><form id="fo" class="stack">' + CN.field({ id: 'date', label: 'Nueva fecha y hora', type: 'datetime-local', value: CN.toLocalInput(v.date + CN.D), attrs: 'min="' + CN.toLocalInput(Date.now() + CN.H) + '"' }) + '<div class="modal-actions"><button type="button" class="btn btn-outline" data-close>Cancelar</button>' + CN.btn('Proponer fecha', { type: 'submit', icon: 'send' }) + '</div></form>',
            onMount(w, close) { CN.bindForm(w.querySelector('#fo'), (val, fail) => { const ts = new Date(val.date).getTime(); if (isNaN(ts) || ts < Date.now()) { fail('date', 'Elige una fecha futura.'); return; } CN.counterPropose(v, ts); close(); CN.toast('Nueva fecha propuesta al administrador.'); CN.render(); }); },
          });
        });
      },
    };
  });

  // US40: clientes e historial de intervenciones
  CN.route('/clients', CO, (p, u) => {
    const bs = CN.buildingsOf(u);
    return {
      title: 'Clientes',
      html: CN.pageHead('CLIENTES', 'Mis clientes', 'Edificios que atiendes') + (bs.length ? '<div class="grid-3 cards-b">' + bs.map((b) => {
        const n = CN.activeAlerts([b.id]).length;
        const done = CN.db().visits.filter((v) => v.buildingId === b.id && v.companyId === u.companyId && v.status === 'realizada').length;
        return '<a class="card bcard" href="#/clients/' + b.id + '"><div class="bc-top"><span class="stat-ic">' + ic('building', 24) + '</span>' + (n ? '<span class="chip" style="background:#FDEBEA;color:#E53935">' + n + ' alerta' + (n > 1 ? 's' : '') + '</span>' : '<span class="chip" style="background:#E6F4EC;color:#2E9E6D">Sin alertas</span>') + '</div><h3>' + esc(b.name) + '</h3><p class="muted">' + esc(b.address) + (b.district ? ' · ' + esc(b.district) : '') + '</p><div class="bc-meta"><span>' + CN.equipmentOf(b.id).length + ' equipos</span><span>' + done + ' intervenciones</span></div></a>';
      }).join('') + '</div>' : CN.empty('building', 'Aún no atiendes edificios', 'Un administrador debe vincular tu empresa a su edificio.')),
    };
  });

  CN.route('/clients/:id', CO, (p, u) => {
    const b = CN.building(p.id);
    if (!b || !CN.canSee(u, b.id)) return { html: CN.empty('building', 'Cliente no encontrado', '', '<a class="btn btn-primary" href="#/clients">Volver</a>') };
    const rows = CN.db().visits.filter((v) => v.buildingId === b.id && v.companyId === u.companyId && v.status === 'realizada').sort((a, c) => c.intervention.ts - a.intervention.ts);
    const alerts = CN.activeAlerts([b.id]);
    return {
      title: b.name,
      html: '<a class="back" href="#/clients">' + ic('back', 18) + ' Clientes</a>' + CN.pageHead('CLIENTES · ' + esc(b.name.toUpperCase()), 'Historial de intervenciones', esc(b.address) + (b.district ? ' · ' + esc(b.district) : '')) +
        '<div class="card">' + (rows.length ? CN.responsiveTable(['Fecha', 'Equipo', 'Descripción'], rows.map((v) => ({ link: '#/visits/' + v.id, cells: [CN.fmtShort(v.date), esc(CN.equipShort(CN.equip(v.equipId))), esc(v.intervention.desc)] }))) : '<p class="muted pad">Aún no registraste intervenciones en este edificio.</p>') + '</div>' +
        '<div class="card"><div class="card-head"><h3>Equipos del edificio</h3></div>' + CN.responsiveTable(['Equipo', 'Ubicación', 'Estado'], CN.equipmentOf(b.id).map((e) => ({ cells: ['<b>' + esc(CN.equipName(e)) + '</b>', esc(e.location), CN.equipStatusChip(e)] }))) + '</div>' +
        (alerts.length ? '<p class="muted small">' + alerts.length + ' alerta(s) activa(s) · <a class="link" href="#/alerts">ver alertas</a></p>' : ''),
      mount(root) { CN.bindRowLinks(root); },
    };
  });

  // US41: técnicos
  CN.route('/technicians', CO, (p, u) => {
    const techs = CN.db().technicians.filter((t) => t.companyId === u.companyId);
    const count = (t) => CN.db().visits.filter((v) => v.techId === t.id && ['propuesta', 'contrapropuesta', 'confirmada'].includes(v.status)).length;
    return {
      title: 'Técnicos',
      html: CN.pageHead('MIS TÉCNICOS', 'Gestionar técnicos') +
        '<div class="card">' + (techs.length ? CN.responsiveTable(['Nombre', 'Especialidad', 'Visitas asignadas', ''], techs.map((t) => ({ cells: ['<b>' + esc(t.name) + '</b><br><span class="muted small">' + esc(t.email) + '</span>', esc(t.specialty), String(count(t)), '<button class="icon-btn sm" data-del="' + t.id + '" aria-label="Eliminar técnico">' + ic('trash', 18) + '</button>'] }))) : CN.empty('wrench', 'Sin técnicos', 'Agrega a tu equipo para asignarles visitas.')) + '</div>' +
        '<div class="card form-card"><div class="card-head"><h3>Agregar técnico</h3></div><form id="f" class="stack">' + CN.field({ id: 'name', label: 'Nombre del técnico' }) + CN.field({ id: 'specialty', label: 'Especialidad', placeholder: 'Ej. Electricidad industrial' }) + CN.field({ id: 'email', label: 'Correo electrónico', type: 'email' }) + CN.btn('Agregar técnico', { type: 'submit', icon: 'plus' }) + '</form></div>',
      mount(root) {
        CN.bindForm(root.querySelector('#f'), (v, fail) => {
          if (!CN.isEmail(v.email)) { fail('email', 'Ingresa un correo válido.'); return; }
          CN.db().technicians.push({ id: CN.uid('t'), companyId: u.companyId, name: v.name.trim(), specialty: v.specialty.trim(), email: v.email.trim() });
          CN.save(); CN.toast('Técnico agregado.'); CN.render();
        });
        CN.delegate(root, 'click', '[data-del]', (e, t) => {
          const tech = CN.tech(t.dataset.del);
          if (count(tech)) { CN.toast('No puedes eliminar un técnico con visitas asignadas. Reasígnalas primero.', 'err', 5000); return; }
          CN.confirm('Eliminar técnico', '¿Eliminar a <b>' + esc(tech.name) + '</b> de tu equipo?', 'Eliminar', () => { const db = CN.db(); db.technicians = db.technicians.filter((x) => x.id !== tech.id); CN.save(); CN.toast('Técnico eliminado.', 'info'); CN.render(); }, true);
        });
      },
    };
  });
})();
