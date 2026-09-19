/* FleetCare app — jefe de flota: fallas, incidencias, mantenimiento, conductores, suscripción, reportes, configuración */
(function () {
  'use strict';
  const R = window.FleetCare;
  const { html, ico } = R;

  const PRIO_ORDER = ['alta', 'media', 'baja'];
  const liveFaults = (db) => db.faults.filter((f) => { const v = R.vehicle(db, f.vehicleId); return v && v.active !== false; });
  const sortByPrio = (a, b) => PRIO_ORDER.indexOf(a.priority) - PRIO_ORDER.indexOf(b.priority) || b.ts - a.ts;

  /* =====================================================
     FALLAS + INCIDENCIAS (HU-16/17/18/31/32/33)
     ===================================================== */
  R.route('/fallas', 'manager', () => {
    const db = R.db();
    const vid = R.ui.fallaVeh || '';
    const st = R.ui.fallaState || 'todos';
    const list = liveFaults(db).filter((f) => (!vid || f.vehicleId === vid) && (st === 'todos' || f.status === st)).sort((a, b) => b.ts - a.ts);
    const chip = (val, l) => html`<button type="button" class="chip ${st === val ? 'on' : ''}" data-action="falla-state" data-value="${val}">${l}</button>`;
    const v = vid && R.vehicle(db, vid);
    return {
      eyebrow: 'Fallas', title: v ? `Historial de fallas — ${v.plate}` : 'Historial de fallas',
      html: html`<div class="toolbar">${R.vehSelect(db, 'fallaVeh', vid, true)}<div class="chips">${chip('todos', 'Todas')}${chip('pendiente', 'Pendientes')}${chip('en_proceso', 'En proceso')}${chip('resuelta', 'Resueltas')}</div></div>
        ${list.length ? html`<div class="table-wrap"><table class="table resp"><thead><tr><th>Fecha</th><th>Unidad</th><th>Descripción</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>
          ${list.map((f) => html`<tr class="row-link" data-href="/fallas/${f.id}?from=fallas" tabindex="0"><td data-label="Fecha">${R.fmtDate(f.date)}</td><td data-label="Unidad"><strong>${R.vehicle(db, f.vehicleId).plate}</strong></td><td data-label="Descripción">${f.title}</td><td data-label="Prioridad">${R.prioPill(f.priority)}</td><td data-label="Estado">${R.faultPill(f.status)}</td></tr>`)}</tbody></table></div>` : R.empty('Sin fallas', 'No hay fallas que coincidan con los filtros.')}`,
    };
  });
  R.actions['falla-state'] = (el) => { R.ui.fallaState = el.getAttribute('data-value'); R.rerender(); };

  R.route('/incidencias', 'manager', () => {
    const db = R.db();
    const vid = R.ui.incVeh || '';
    const list = liveFaults(db).filter((f) => R.faultOpen(f) && (!vid || f.vehicleId === vid)).sort(sortByPrio);
    return {
      eyebrow: 'Incidencias', title: 'Incidencias activas',
      html: html`<div class="toolbar">${R.vehSelect(db, 'incVeh', vid, true)}<span class="muted">${list.length} ${list.length === 1 ? 'incidencia activa' : 'incidencias activas'}</span></div>
        ${list.length ? html`<ul class="inc-list">${list.map((f) => html`<li><a class="inc-card prio-${f.priority}" href="#/fallas/${f.id}?from=incidencias"><div class="inc-main"><strong>${R.vehicle(db, f.vehicleId).plate} · ${f.title}</strong><small>${f.description}</small><em>Reportada por ${f.reportedBy} · ${R.ago(f.ts)}${f.comments.length ? ` · ${f.comments.filter((c) => !c.sys).length} comentarios` : ''}</em></div><div class="inc-side">${R.prioPill(f.priority)}${R.faultPill(f.status)}</div></a></li>`)}</ul>` : R.empty('Sin incidencias activas', vid ? 'Esta unidad no tiene incidencias abiertas.' : 'Todas las fallas reportadas están resueltas.')}`,
    };
  });

  R.route('/fallas/:id', 'manager', ({ id }) => {
    const db = R.db();
    const f = db.faults.find((x) => x.id === id);
    if (!f) return { redirect: '/fallas' };
    const v = R.vehicle(db, f.vehicleId);
    const from = R.query.from === 'incidencias' ? 'incidencias' : 'fallas';
    const seg = (action, cur, opts) => html`<div class="seg" role="group">${opts.map(([val, l]) => html`<button type="button" class="${cur === val ? 'on' : ''}" aria-pressed="${cur === val}" data-action="${action}" data-id="${f.id}" data-value="${val}">${l}</button>`)}</div>`;
    return {
      eyebrow: from === 'incidencias' ? 'Incidencias' : 'Fallas', title: `Incidencia — ${f.title}`, navKey: '/' + from,
      html: html`<a class="back" href="#/${from}">${ico('back', 16)} Volver a ${from === 'incidencias' ? 'incidencias' : 'fallas'}</a>
        <div class="grid grid-2 detail-grid">
          <div class="stack">
            ${R.card('Detalle', html`<dl class="dl"><div><dt>Unidad</dt><dd><a href="#/vehiculos/${v.id}">${v.plate}</a> · ${v.brand} ${v.model}</dd></div><div><dt>Reportado por</dt><dd>${f.reportedBy} · ${R.ago(f.ts)}</dd></div><div><dt>Descripción</dt><dd>${f.description || 'Sin descripción.'}</dd></div></dl>
              ${f.photos.length ? html`<div class="photos">${f.photos.map((p, i) => html`<button type="button" class="photo" data-action="photo" data-fault="${f.id}" data-i="${i}" aria-label="Ver foto ${i + 1}"><img src="${p}" alt="Foto ${i + 1} de la falla"></button>`)}</div>` : html`<p class="muted">Sin fotos adjuntas.</p>`}`)}
            ${R.card('Estado y prioridad', html`<h4 class="sub-h">Estado</h4>${seg('fault-state', f.status, [['pendiente', 'Pendiente'], ['en_proceso', 'En proceso'], ['resuelta', 'Resuelta']])}<h4 class="sub-h">Prioridad</h4>${seg('fault-prio', f.priority, [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']])}`)}
          </div>
          ${R.card('Comentarios', html`${f.comments.length ? html`<ul class="comments">${f.comments.map((c) => html`<li class="${c.sys ? 'sys' : ''}"><p>${c.text}</p><small>${c.by}${c.role === 'driver' ? ' · Conductor' : c.sys ? '' : ' · Jefe de flota'} · ${R.ago(c.ts)}</small></li>`)}</ul>` : html`<p class="muted">Aún no hay comentarios.</p>`}
            <form class="comment-form" data-form="comment" data-id="${f.id}" novalidate>${R.field({ label: 'Nuevo comentario', name: 'text', type: 'textarea', rows: 3, placeholder: 'Escribe una actualización o instrucción…', attrs: { maxlength: 400 } })}<button class="btn btn-primary" type="submit">Comentar</button></form>`)}
        </div>`,
    };
  });
  const sysComment = (f, text) => f.comments.push({ id: R.uid('c'), by: R.me().name, role: 'manager', text, ts: Date.now(), sys: true });
  R.actions['fault-state'] = (el) => {
    const f = R.db().faults.find((x) => x.id === el.getAttribute('data-id'));
    const val = el.getAttribute('data-value');
    if (f.status === val) return;
    f.status = val;
    sysComment(f, `Estado cambiado a “${R.faultStates[val]}”.`);
    R.save();
    R.toast(`La falla ahora está “${R.faultStates[val]}”.`, 'ok', 'Estado actualizado');
    R.rerender();
  };
  R.actions['fault-prio'] = (el) => {
    const f = R.db().faults.find((x) => x.id === el.getAttribute('data-id'));
    const val = el.getAttribute('data-value');
    if (f.priority === val) return;
    f.priority = val;
    sysComment(f, `Prioridad cambiada a “${val}”.`);
    R.save();
    R.toast(`Prioridad ${val} asignada.`, 'ok', 'Prioridad actualizada');
    R.rerender();
  };
  R.forms.comment = (form) => {
    const f = R.db().faults.find((x) => x.id === form.getAttribute('data-id'));
    const text = form.elements.text.value.trim();
    if (R.setErrors(form, text ? {} : { text: 'Escribe un comentario.' })) return;
    f.comments.push({ id: R.uid('c'), by: R.me().name, role: 'manager', text, ts: Date.now() });
    R.save();
    R.rerender();
  };
  R.actions.photo = (el) => {
    const f = R.db().faults.find((x) => x.id === el.getAttribute('data-fault'));
    R.modal(html`<div class="lightbox"><img src="${f.photos[Number(el.getAttribute('data-i'))]}" alt="Foto de la falla ampliada"><button class="btn btn-outline" data-action="modal-close">Cerrar</button></div>`, { wide: true });
  };

  /* =====================================================
     MANTENIMIENTO (HU-20/21/22/23/24)
     ===================================================== */
  R.route('/mantenimiento', 'manager', () => {
    const db = R.db();
    const tab = R.query.tab === 'intervalos' ? 'intervalos' : 'alertas';
    const tabs = html`<div class="tabs" role="tablist"><a role="tab" aria-selected="${tab === 'alertas'}" class="${tab === 'alertas' ? 'on' : ''}" href="#/mantenimiento">Alertas</a><a role="tab" aria-selected="${tab === 'intervalos'}" class="${tab === 'intervalos' ? 'on' : ''}" href="#/mantenimiento?tab=intervalos">Intervalos</a></div>`;
    if (tab === 'intervalos') {
      return {
        eyebrow: 'Mantenimiento', title: 'Intervalos de mantenimiento',
        html: html`${tabs}<p class="lead-sm">Define cada cuántos kilómetros se debe realizar cada servicio. FleetCare avisará al llegar al ${Math.round(R.WARN_PCT * 100)}% del intervalo.</p>
          <form class="card form-card" data-form="intervals" novalidate><div class="form-grid">${db.services.map((s) => R.field({ label: `${s.name} — intervalo (km)`, name: 'km_' + s.id, type: 'number', value: s.km, attrs: { min: 500, step: 100, inputmode: 'numeric' } }))}</div>
            <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar cambios</button></div></form>`,
      };
    }
    const alerts = R.upcomingAlerts(db);
    const recent = db.maintLog.filter((m) => { const v = R.vehicle(db, m.vehicleId); return v && v.active !== false; }).sort((a, b) => b.ts - a.ts).slice(0, 6);
    return {
      eyebrow: 'Mantenimiento', title: 'Alertas próximas a vencer',
      html: html`${tabs}${alerts.length ? html`<ul class="alert-list">${alerts.map((a) => html`<li class="alert-card lvl-${a.level}"><div class="alert-main"><strong>${a.plate} · ${a.service}</strong><span class="due ${a.level === 'critico' ? 'txt-red' : a.level === 'alerta' ? 'txt-orange' : ''}">${R.dueText(a)}</span>
          ${a.kind === 'km' ? html`<div class="progress" role="img" aria-label="${Math.round(a.pct * 100)}% del intervalo consumido"><i style="width:${Math.min(100, a.pct * 100).toFixed(0)}%"></i></div><small>${Math.round(a.pct * 100)}% del intervalo · ${a.remainingKm > 0 ? R.fmtNum(a.remainingKm) + ' km restantes' : 'intervalo superado'}</small>` : ''}</div>
          <button class="btn btn-outline" data-action="attend" data-id="${a.id}">${ico('check', 16)} Marcar como atendida</button></li>`)}</ul>` : R.empty('Todo al día', 'Ninguna unidad está próxima a un mantenimiento.')}
        ${R.card('Mantenimientos atendidos recientemente', recent.length ? html`<ul class="timeline">${recent.map((m) => html`<li><strong>${R.vehicle(db, m.vehicleId).plate} · ${m.service}</strong><span>${R.fmtNum(m.km)} km · ${R.fmtDate(m.date)}</span></li>`)}</ul>` : html`<p class="muted">Aún no hay mantenimientos registrados.</p>`)}`,
    };
  });
  R.actions.attend = async (el) => {
    const db = R.db();
    const [vid, sid] = el.getAttribute('data-id').split(':');
    const v = R.vehicle(db, vid);
    const name = sid === 'tiempo' ? 'el mantenimiento general' : db.services.find((s) => s.id === sid).name.toLowerCase();
    const ok = await R.confirm({ title: '¿Marcar como atendida?', text: `Se registrará ${name} de ${v.plate} a ${R.fmtNum(v.km)} km y el contador del servicio se reiniciará.`, confirm: 'Marcar como atendida' });
    if (!ok) return;
    const r = R.attendAlert(db, el.getAttribute('data-id'));
    R.save();
    R.toast(`${r.name} de ${r.vehicle.plate} quedó registrado.`, 'ok', 'Alerta atendida');
    R.rerender();
  };
  R.forms.intervals = (form) => {
    const db = R.db();
    const errs = {};
    const vals = {};
    db.services.forEach((s) => {
      const raw = form.elements['km_' + s.id].value;
      const n = Number(raw);
      if (raw === '' || !Number.isInteger(n) || n < 500 || n > 100000) errs['km_' + s.id] = 'Ingresa un intervalo entre 500 y 100 000 km.';
      else vals[s.id] = n;
    });
    if (R.setErrors(form, errs)) return;
    db.services.forEach((s) => { s.km = vals[s.id]; });
    R.checkAllAlerts(db);
    R.save();
    R.toast('Los intervalos de mantenimiento se actualizaron.', 'ok', 'Cambios guardados');
    R.flushToasts();
  };

  /* =====================================================
     CONDUCTORES (HU-45/46/47)
     ===================================================== */
  const drivers = (db) => R.state().users.filter((u) => u.role === 'driver' && u.companyId === R.me().companyId);
  R.route('/conductores', 'manager', () => {
    const db = R.db();
    const ds = drivers(db);
    const active = ds.filter((d) => d.active !== false);
    const vs = R.activeVehicles(db);
    const assigned = (d) => R.vehicleOfDriver(db, d);
    return {
      eyebrow: 'Conductores', title: 'Conductores',
      html: html`<div class="grid grid-2 detail-grid">
          ${R.card('Invitar conductor', html`<form data-form="invite" novalidate>${R.field({ label: 'Correo electrónico del conductor', name: 'email', type: 'email', placeholder: 'conductor@empresa.pe', attrs: { inputmode: 'email', autocomplete: 'off' } })}<button class="btn btn-primary" type="submit">${ico('mail', 16)} Enviar invitación</button></form>
            <h4 class="sub-h">Invitaciones pendientes</h4>${db.invites.length ? html`<ul class="plain-list">${db.invites.map((i) => html`<li><div><strong>${i.email}</strong><small>Enviada ${R.ago(i.ts).toLowerCase()}</small></div><div class="li-actions"><button class="btn btn-sm btn-outline" data-action="invite-accept" data-id="${i.id}">Simular aceptación</button><button class="btn btn-sm btn-danger-outline" data-action="invite-cancel" data-id="${i.id}">Cancelar</button></div></li>`)}</ul>` : html`<p class="muted">No hay invitaciones pendientes.</p>`}`)}
          ${R.card('Asignar conductor', active.length && vs.length ? html`<form data-form="assign" novalidate>${R.field({ label: 'Conductor', name: 'driver', options: [{ value: '', label: 'Selecciona un conductor' }, ...active.map((d) => ({ value: d.id, label: d.name }))] })}
            ${R.field({ label: 'Vehículo', name: 'vehicle', options: [{ value: '', label: 'Selecciona un vehículo' }, { value: 'none', label: 'Sin asignar (quitar asignación)' }, ...vs.map((v) => ({ value: v.id, label: R.vehLabel(v) }))] })}<button class="btn btn-primary" type="submit">Asignar</button></form>` : html`<p class="muted">${!vs.length ? 'Registra al menos un vehículo' : 'Invita a un conductor'} para poder hacer asignaciones.</p>`)}
        </div>
        ${R.card('Conductores', ds.length ? html`<div class="table-wrap"><table class="table resp"><thead><tr><th>Conductor</th><th>Correo</th><th>Asignación</th><th>Acceso</th><th></th></tr></thead><tbody>
          ${ds.map((d) => { const v = assigned(d); return html`<tr><td data-label="Conductor"><span class="cell-user"><span class="avatar sm">${R.initials(d.name)}</span><strong>${d.name}</strong></span></td><td data-label="Correo">${d.email}</td><td data-label="Asignación">${d.active === false ? '—' : v ? html`Asignado a <a href="#/vehiculos/${v.id}"><strong>${v.plate}</strong></a>` : html`<span class="muted">Sin vehículo</span>`}</td><td data-label="Acceso">${d.active === false ? R.pill('critico', 'Revocado') : R.pill('bueno', 'Activo')}</td><td class="td-actions">${d.active === false ? '' : html`<button class="btn btn-sm btn-danger-outline" data-action="driver-revoke" data-id="${d.id}">Revocar acceso</button>`}</td></tr>`; })}</tbody></table></div>` : html`<p class="muted">Todavía no tienes conductores. Envía una invitación para comenzar.</p>`)}`,
    };
  });
  R.forms.invite = (form) => {
    const db = R.db();
    const email = form.elements.email.value.trim().toLowerCase();
    let err = '';
    if (!R.validEmail(email)) err = 'Ingresa un correo válido.';
    else if (R.state().users.some((u) => u.email.toLowerCase() === email)) err = 'Ya existe una cuenta con este correo.';
    else if (db.invites.some((i) => i.email.toLowerCase() === email)) err = 'Ya enviaste una invitación a este correo.';
    if (R.setErrors(form, err ? { email: err } : {})) return;
    db.invites.unshift({ id: R.uid('inv'), email, ts: Date.now() });
    R.save();
    R.toast(`Invitación enviada a ${email}.`, 'ok', 'Invitación enviada');
    R.rerender();
  };
  R.actions['invite-cancel'] = (el) => { const db = R.db(); db.invites = db.invites.filter((i) => i.id !== el.getAttribute('data-id')); R.save(); R.toast('Invitación cancelada.'); R.rerender(); };
  R.actions['invite-accept'] = (el) => {
    const inv = R.db().invites.find((i) => i.id === el.getAttribute('data-id'));
    R.modal(html`<h3 id="modal-title">Aceptar invitación</h3><p class="modal-text">Simulación de lo que haría el conductor <strong>${inv.email}</strong> al abrir su enlace de invitación.</p>
      <form data-form="invite-accept" data-id="${inv.id}" novalidate>${R.field({ label: 'Nombre completo', name: 'name', attrs: { autocomplete: 'off' } })}${R.field({ label: 'Contraseña', name: 'password', type: 'password', value: R.DEMO_PASSWORD, attrs: { autocomplete: 'new-password' } })}
      <div class="modal-actions"><button type="button" class="btn btn-outline" data-action="modal-close">Cancelar</button><button type="submit" class="btn btn-primary">Crear cuenta de conductor</button></div></form>`);
  };
  R.forms['invite-accept'] = async (form) => {
    const db = R.db();
    const inv = db.invites.find((i) => i.id === form.getAttribute('data-id'));
    const d = R.formData(form);
    const errs = {};
    if (d.name.length < 3) errs.name = 'Ingresa el nombre del conductor.';
    if (d.password.length < 6) errs.password = 'Mínimo 6 caracteres.';
    if (R.setErrors(form, errs)) return;
    R.state().users.push({ id: R.uid('u_'), name: d.name, email: inv.email, passHash: await R.hash(d.password), role: 'driver', companyId: R.me().companyId, active: true });
    db.invites = db.invites.filter((i) => i.id !== inv.id);
    R.save();
    R.closeModal(false);
    R.toast(`${d.name} ya puede iniciar sesión con ${inv.email}.`, 'ok', 'Conductor registrado');
    R.rerender();
  };
  R.forms.assign = (form) => {
    const db = R.db();
    const d = R.formData(form);
    const errs = {};
    if (!d.driver) errs.driver = 'Selecciona un conductor.';
    if (!d.vehicle) errs.vehicle = 'Selecciona un vehículo o “Sin asignar”.';
    if (R.setErrors(form, errs)) return;
    const drv = R.userById(d.driver);
    db.vehicles.forEach((v) => { if (v.driverId === drv.id) v.driverId = null; });
    if (d.vehicle === 'none') { R.save(); R.toast(`${drv.name} ya no tiene un vehículo asignado.`); return R.rerender(); }
    const v = R.vehicle(db, d.vehicle);
    const prev = v.driverId && R.userById(v.driverId);
    v.driverId = drv.id;
    R.save();
    R.toast(`${drv.name} fue asignado a ${v.plate}.${prev && prev.id !== drv.id ? ` ${prev.name} quedó sin vehículo.` : ''}`, 'ok', 'Conductor asignado');
    R.rerender();
  };
  R.actions['driver-revoke'] = async (el) => {
    const db = R.db();
    const u = R.userById(el.getAttribute('data-id'));
    const ok = await R.confirm({ title: '¿Revocar el acceso de este conductor?', text: `${u.name} dejará de poder usar la app con su cuenta de inmediato.`, confirm: 'Revocar acceso', danger: true });
    if (!ok) return;
    u.active = false;
    db.vehicles.forEach((v) => { if (v.driverId === u.id) v.driverId = null; });
    R.save();
    R.toast(`Se revocó el acceso de ${u.name}.`, 'ok', 'Acceso revocado');
    R.rerender();
  };

  /* =====================================================
     SUSCRIPCIÓN (HU-42/43/44)
     ===================================================== */
  const luhn = (num) => { let s = 0, alt = false; for (let i = num.length - 1; i >= 0; i--) { let n = Number(num[i]); if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return s % 10 === 0; };
  R.inputs['card-mask'] = (el) => { el.value = el.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim(); };
  R.inputs['exp-mask'] = (el) => { const d = el.value.replace(/\D/g, '').slice(0, 4); el.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; };

  R.route('/suscripcion', 'manager', () => {
    const db = R.db();
    const n = R.activeVehicles(db).length;
    const sub = db.subscription;
    if (!sub) {
      return {
        eyebrow: 'Suscripción', title: 'Suscribirme a FleetCare',
        html: html`<div class="grid grid-2 detail-grid">
          ${R.card('Resumen del plan', html`<dl class="dl"><div><dt>Plan</dt><dd>Suscripción mensual por vehículo</dd></div><div><dt>Vehículos en tu flota</dt><dd>${n}</dd></div><div><dt>Precio por vehículo</dt><dd>${R.money(R.PRICE_PER_VEHICLE)} / mes <small class="muted">· tarifa referencial de la demostración; la cotización real es personalizada</small></dd></div></dl>
            <div class="total-box"><span>Total mensual estimado</span><strong>${R.money(n * R.PRICE_PER_VEHICLE)}</strong></div>
            ${n ? '' : html`<p class="form-alert show">Registra al menos un vehículo para suscribirte. <a href="#/vehiculos/nuevo">Registrar vehículo</a></p>`}`)}
          ${R.card('Método de pago', html`<form data-form="subscribe" novalidate>${R.field({ label: 'Número de tarjeta', name: 'card', placeholder: '4242 4242 4242 4242', attrs: { inputmode: 'numeric', autocomplete: 'cc-number', 'data-input': 'card-mask' } })}
            <div class="form-grid">${R.field({ label: 'Vencimiento (MM/AA)', name: 'exp', placeholder: '08/28', attrs: { inputmode: 'numeric', autocomplete: 'cc-exp', maxlength: 5, 'data-input': 'exp-mask' } })}${R.field({ label: 'CVC', name: 'cvc', placeholder: '123', attrs: { inputmode: 'numeric', autocomplete: 'cc-csc', maxlength: 4 } })}</div>
            <p class="demo-note">Simulación: no se realiza ningún cobro y solo se guardan los últimos 4 dígitos.</p>
            <button class="btn btn-primary btn-block" type="submit" ${n ? '' : R.raw('disabled')}>Confirmar suscripción</button></form>`)}</div>`,
      };
    }
    const cnt = R.ui.subCount == null ? sub.vehicles : R.ui.subCount;
    const dirty = cnt !== sub.vehicles;
    return {
      eyebrow: 'Suscripción', title: 'Mi suscripción',
      html: html`${n > sub.vehicles ? html`<div class="banner banner-warn">${ico('alert', 20)}<div><strong>Tienes ${n} vehículos activos y tu plan cubre ${sub.vehicles}.</strong> Actualiza el número de vehículos suscritos.</div></div>` : ''}
        <div class="grid grid-2 detail-grid">
          ${R.card('Plan actual', html`<dl class="dl"><div><dt>Plan actual</dt><dd>${sub.plan}</dd></div><div><dt>Estado</dt><dd>${R.pill('bueno', 'Activa')}</dd></div><div><dt>Monto</dt><dd>${R.money(sub.vehicles * sub.price)} / mes <small class="muted">(${sub.vehicles} × ${R.money(sub.price)})</small></dd></div><div><dt>Próximo cobro</dt><dd>${R.fmtDate(R.nextCharge(sub))}</dd></div><div><dt>Método de pago</dt><dd>Tarjeta •••• ${sub.card}</dd></div></dl>`)}
          ${R.card('Vehículos suscritos', html`<p class="lead-sm">Vehículos incluidos en el plan</p>
            <div class="stepper"><button class="icon-btn" data-action="sub-step" data-d="-1" aria-label="Quitar un vehículo" ${cnt <= Math.max(1, n) ? R.raw('disabled') : ''}>${ico('minus', 18)}</button><output aria-live="polite">${cnt}</output><button class="icon-btn" data-action="sub-step" data-d="1" aria-label="Agregar un vehículo" ${cnt >= 500 ? R.raw('disabled') : ''}>${ico('plus', 18)}</button></div>
            <div class="total-box"><span>Monto actualizado</span><strong>${R.money(cnt * sub.price)} <small>/ mes</small></strong></div>
            <small class="muted">Mínimo: ${Math.max(1, n)} (vehículos activos en tu flota).</small>
            <div class="form-actions"><button class="btn btn-primary" data-action="sub-save" ${dirty ? '' : R.raw('disabled')}>Guardar cambios</button></div>`)}
        </div>`,
    };
  });
  R.actions['sub-step'] = (el) => {
    const db = R.db();
    const cur = R.ui.subCount == null ? db.subscription.vehicles : R.ui.subCount;
    R.ui.subCount = R.clamp(cur + Number(el.getAttribute('data-d')), Math.max(1, R.activeVehicles(db).length), 500);
    R.rerender();
  };
  R.actions['sub-save'] = () => {
    const db = R.db();
    db.subscription.vehicles = R.ui.subCount;
    R.ui.subCount = null;
    R.save();
    R.toast(`Tu plan ahora incluye ${db.subscription.vehicles} vehículos (${R.money(db.subscription.vehicles * db.subscription.price)} / mes).`, 'ok', 'Suscripción actualizada');
    R.rerender();
  };
  R.forms.subscribe = (form) => {
    const db = R.db();
    const d = R.formData(form);
    const num = d.card.replace(/\s/g, '');
    const errs = {};
    if (!/^\d{13,19}$/.test(num) || !luhn(num)) errs.card = 'Ingresa un número de tarjeta válido.';
    const m = /^(\d{2})\/(\d{2})$/.exec(d.exp);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) errs.exp = 'Usa el formato MM/AA.';
    else { const now = new Date(); if (2000 + Number(m[2]) < now.getFullYear() || (2000 + Number(m[2]) === now.getFullYear() && Number(m[1]) < now.getMonth() + 1)) errs.exp = 'La tarjeta está vencida.'; }
    if (!/^\d{3,4}$/.test(d.cvc)) errs.cvc = 'Ingresa el CVC (3 o 4 dígitos).';
    const n = R.activeVehicles(db).length;
    if (!n) return R.toast('Registra al menos un vehículo antes de suscribirte.', 'warn');
    if (R.setErrors(form, errs)) return;
    db.subscription = { plan: 'Suscripción mensual', vehicles: n, price: R.PRICE_PER_VEHICLE, start: R.today(), card: num.slice(-4), status: 'activa' };
    R.ui.subCount = null;
    R.save();
    R.toast(`Tu plan cubre ${n} ${n === 1 ? 'vehículo' : 'vehículos'}.`, 'ok', '¡Suscripción activa!');
    R.rerender();
  };

  /* =====================================================
     REPORTES (HU-48/49)
     ===================================================== */
  R.route('/reportes', 'manager', () => {
    const db = R.db();
    const vs = R.activeVehicles(db);
    const from = R.ymd(R.addDays(new Date(), -30));
    return {
      eyebrow: 'Reportes', title: 'Reportes y exportaciones',
      html: html`<div class="grid grid-2 detail-grid">
        ${R.card('Exportar reporte de mantenimiento', html`<form data-form="report-pdf" novalidate><h4 class="sub-h">Rango de fechas</h4><div class="form-grid">${R.field({ label: 'Desde', name: 'from', type: 'date', value: from, attrs: { max: R.today() } })}${R.field({ label: 'Hasta', name: 'to', type: 'date', value: R.today(), attrs: { max: R.today() } })}</div>
          ${R.field({ label: 'Unidad', name: 'vehicle', options: [{ value: '', label: 'Todas las unidades' }, ...vs.map((v) => ({ value: v.id, label: R.vehLabel(v) }))] })}
          <p class="hint block">Se abrirá el diálogo de impresión: elige “Guardar como PDF”.</p><button class="btn btn-primary" type="submit" ${vs.length ? '' : R.raw('disabled')}>${ico('download', 16)} Exportar PDF</button></form>`)}
        ${R.card('Exportar historial de combustible', html`<form data-form="report-xlsx" novalidate><h4 class="sub-h">Selecciona unidades</h4>${vs.length ? html`<div class="check-grid">${vs.map((v) => html`<label class="check-card"><input type="checkbox" name="units" value="${v.id}" checked><span><strong>${v.plate}</strong><small>${v.brand} ${v.model}</small></span></label>`)}</div><span class="field-error" data-err="units" role="alert"></span>` : html`<p class="muted">No hay unidades registradas.</p>`}
          <button class="btn btn-primary" type="submit" ${vs.length ? '' : R.raw('disabled')}>${ico('download', 16)} Exportar Excel</button></form>`)}
      </div>`,
    };
  });
  R.forms['report-pdf'] = (form) => {
    const db = R.db();
    const d = R.formData(form);
    const errs = {};
    if (!d.from) errs.from = 'Elige la fecha inicial.';
    if (!d.to) errs.to = 'Elige la fecha final.';
    if (d.from && d.to && d.from > d.to) errs.to = 'La fecha final debe ser posterior a la inicial.';
    if (R.setErrors(form, errs)) return;
    const r = R.exportMaintenancePdf(db, d.from, d.to, d.vehicle);
    R.toast(`Reporte listo: ${r.done} mantenimientos y ${r.faults} fallas en el periodo.`, 'ok', 'Generando PDF');
  };
  R.forms['report-xlsx'] = (form) => {
    const db = R.db();
    const ids = Array.from(form.querySelectorAll('input[name=units]:checked')).map((i) => i.value);
    if (R.setErrors(form, ids.length ? {} : { units: 'Selecciona al menos una unidad.' })) return;
    const n = R.exportFuelXlsx(db, ids);
    if (!n) return R.toast('Las unidades seleccionadas no tienen cargas de combustible.', 'warn', 'Sin datos');
    R.toast(`Se exportaron ${n} cargas de combustible.`, 'ok', 'Excel descargado');
  };

  /* =====================================================
     CONFIGURACIÓN (HU-50)
     ===================================================== */
  R.route('/configuracion', 'manager', () => {
    const db = R.db();
    const c = db.company;
    return {
      eyebrow: 'Configuración', title: 'Datos de la empresa',
      html: html`<form class="card form-card" data-form="company" novalidate><h3>Datos de la empresa</h3><div class="form-grid">
        ${R.field({ label: 'Nombre de la empresa', name: 'name', value: c.name })}${R.field({ label: 'RUC', name: 'ruc', value: c.ruc, placeholder: '11 dígitos', attrs: { inputmode: 'numeric', maxlength: 11 } })}
        ${R.field({ label: 'Dirección', name: 'address', value: c.address })}${R.field({ label: 'Correo de contacto', name: 'email', type: 'email', value: c.email })}</div>
        <div class="form-actions"><a class="btn btn-outline" href="#/configuracion" data-action="cfg-cancel">Cancelar</a><button class="btn btn-primary" type="submit">Guardar cambios</button></div></form>`,
    };
  });
  R.actions['cfg-cancel'] = (el, ev) => { ev.preventDefault(); R.rerender(); };
  R.forms.company = (form) => {
    const db = R.db();
    const d = R.formData(form);
    const errs = {};
    if (d.name.length < 2) errs.name = 'Ingresa el nombre de la empresa.';
    if (d.ruc && !/^\d{11}$/.test(d.ruc)) errs.ruc = 'El RUC debe tener 11 dígitos.';
    if (d.email && !R.validEmail(d.email)) errs.email = 'Ingresa un correo válido.';
    if (R.setErrors(form, errs)) return;
    Object.assign(db.company, { name: d.name, ruc: d.ruc, address: d.address, email: d.email });
    R.save();
    R.refreshChrome();
    R.toast('Los datos de tu empresa se actualizaron.', 'ok', 'Cambios guardados');
  };
})();
