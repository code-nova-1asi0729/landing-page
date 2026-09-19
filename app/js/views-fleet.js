/* FleetCare app — jefe de flota: dashboard, vehículos, checklists, kilometraje, combustible */
(function () {
  'use strict';
  const R = window.FleetCare;
  const { html, ico } = R;

  /* ---------- Helpers compartidos ---------- */
  R.vehLabel = (v) => `${v.plate} · ${v.brand} ${v.model}`;
  R.pickVehicle = (db, key) => {
    const vs = R.activeVehicles(db);
    let v = vs.find((x) => x.id === R.ui[key]);
    if (!v) { v = vs[0] || null; R.ui[key] = v ? v.id : null; }
    return v;
  };
  R.vehSelect = (db, key, selected, all) => R.field({
    label: 'Unidad', name: key, value: selected || '', attrs: { 'data-change': 'pick-veh', 'data-key': key },
    options: [...(all ? [{ value: '', label: 'Todas las unidades' }] : []), ...R.activeVehicles(db).map((v) => ({ value: v.id, label: R.vehLabel(v) }))],
  });
  R.changes['pick-veh'] = (el) => { R.ui[el.getAttribute('data-key')] = el.value; R.rerender(); };
  R.noVehicles = () => R.empty('Aún no tienes vehículos', 'Registra tu primera unidad para empezar a recibir alertas y checklists.', html`<a class="btn btn-primary" href="#/vehiculos/nuevo">${ico('plus', 16)} Registrar vehículo</a>`);
  R.card = (title, body, opts = {}) => html`<section class="card ${opts.cls || ''}">${title ? html`<div class="card-head"><h3>${title}</h3>${opts.action || ''}</div>` : ''}${body}</section>`;

  /* =====================================================
     DASHBOARD (HU-19/20/23/25/26/27)
     ===================================================== */
  R.route('/dashboard', 'manager', () => {
    const db = R.db();
    const rows = R.activeVehicles(db).map((v) => ({ v, h: R.vehicleHealth(db, v) }));
    const f = R.ui.dashFilter || 'todos';
    const count = (s) => rows.filter((r) => r.h.status === s).length;
    const shown = f === 'todos' ? rows : rows.filter((r) => r.h.status === f);
    const chip = (val, label, n) => html`<button type="button" class="chip ${f === val ? 'on' : ''}" data-action="dash-filter" data-value="${val}" aria-pressed="${f === val}">${label} <span class="chip-n">${n}</span></button>`;
    const alerts = R.upcomingAlerts(db).slice(0, 3);
    const incs = db.faults.filter((x) => R.faultOpen(x) && R.vehicle(db, x.vehicleId) && R.vehicle(db, x.vehicleId).active !== false).sort((a, b) => ['alta', 'media', 'baja'].indexOf(a.priority) - ['alta', 'media', 'baja'].indexOf(b.priority) || b.ts - a.ts).slice(0, 3);
    const byDate = {};
    db.fuel.forEach((x) => { const s = R.fuelSeries(db, x.vehicleId).find((y) => y.id === x.id); if (s && s.kmpg != null) (byDate[x.date] = byDate[x.date] || []).push(s.kmpg); });
    const dates = Object.keys(byDate).sort();
    const fleetAvg = dates.map((d) => byDate[d].reduce((a, b) => a + b, 0) / byDate[d].length);
    const sub = db.subscription;
    const n = rows.length;
    let banner = '';
    if (!sub) banner = html`<div class="banner banner-info">${ico('card', 20)}<div><strong>Aún no tienes un plan activo.</strong> Suscríbete para cubrir tu flota.</div><a class="btn btn-sm btn-primary" href="#/suscripcion">Suscribirme</a></div>`;
    else if (n > sub.vehicles) banner = html`<div class="banner banner-warn">${ico('alert', 20)}<div><strong>Tu flota (${n}) supera los vehículos de tu plan (${sub.vehicles}).</strong> Actualiza tu suscripción.</div><a class="btn btn-sm btn-outline" href="#/suscripcion">Actualizar plan</a></div>`;

    return {
      eyebrow: 'Dashboard', title: 'Estado de salud de la flota',
      html: html`${banner}
        ${n ? html`<div class="chips" role="group" aria-label="Filtrar por estado">${chip('todos', 'Todos', n)}${chip('bueno', 'Bueno', count('bueno'))}${chip('alerta', 'Alerta', count('alerta'))}${chip('critico', 'Crítico', count('critico'))}</div>
          ${shown.length ? html`<div class="grid grid-3 unit-grid">${shown.map(({ v, h }) => {
            const d = R.driverOf(db, v);
            const c = h.causes[0];
            return html`<a class="unit-card is-${h.status}" href="#/dashboard/unidad/${v.id}"><div class="unit-top"><strong class="unit-plate">${v.plate}</strong>${R.statusPill(h.status)}</div>
              <p class="unit-model">${v.brand} ${v.model}</p><dl class="mini-dl"><div><dt>Kilometraje</dt><dd>${R.fmtNum(v.km)} km</dd></div><div><dt>Conductor</dt><dd>${d ? d.name : 'Sin asignar'}</dd></div></dl>
              <p class="unit-cause ${c ? 'has' : ''}">${c ? html`${ico('alert', 14)} ${c.type} · ${c.detail}` : html`${ico('check', 14)} Sin novedades`}</p></a>`;
          })}</div>` : R.empty('Sin unidades en este estado', 'Prueba con otro filtro.')}
          <div class="grid grid-3 dash-panels">
            ${R.card('Próximos mantenimientos', alerts.length ? html`<ul class="mini-list">${alerts.map((a) => html`<li><a href="#/mantenimiento"><strong>${a.plate} · ${a.service}</strong><small class="${a.level === 'critico' ? 'txt-red' : a.level === 'alerta' ? 'txt-orange' : ''}">${R.dueText(a)}</small></a></li>`)}</ul>` : html`<p class="muted">Ninguna unidad está próxima a vencer.</p>`, { action: html`<a class="link-btn" href="#/mantenimiento">Ver todo</a>` })}
            ${R.card('Incidencias activas', incs.length ? html`<ul class="mini-list">${incs.map((x) => html`<li><a href="#/fallas/${x.id}"><strong>${R.vehicle(db, x.vehicleId).plate} · ${x.title}</strong><small>${R.prioPill(x.priority)}</small></a></li>`)}</ul>` : html`<p class="muted">No hay incidencias activas.</p>`, { action: html`<a class="link-btn" href="#/incidencias">Ver todo</a>` })}
            ${R.card('Combustible', html`<div class="fuel-card">${fleetAvg.length > 1 ? html`<strong class="big">${R.fmtNum(fleetAvg[fleetAvg.length - 1], 1)} <small>km/gal</small></strong><p class="muted">Rendimiento promedio de la flota</p>${R.spark(fleetAvg.slice(-14))}` : html`<p class="muted">Registra cargas de combustible para ver el rendimiento.</p>`}</div>`, { action: html`<a class="link-btn" href="#/combustible">Detalle</a>` })}
          </div>` : R.noVehicles()}`,
    };
  });
  R.actions['dash-filter'] = (el) => { R.ui.dashFilter = el.getAttribute('data-value'); R.rerender(); };

  R.route('/dashboard/unidad/:id', 'manager', ({ id }) => {
    const db = R.db();
    const v = R.vehicle(db, id);
    if (!v || v.active === false) return { redirect: '/dashboard' };
    const h = R.vehicleHealth(db, v);
    const d = R.driverOf(db, v);
    return {
      eyebrow: 'Dashboard', title: `Detalle de unidad — ${v.plate}`, navKey: '/dashboard',
      html: html`<a class="back" href="#/dashboard">${ico('back', 16)} Volver al dashboard</a>
        <div class="grid grid-2 detail-grid">
          ${R.card('Estado actual', html`<div class="state-hero is-${h.status}"><span>Estado</span><strong>${R.statusLabel(h.status)}</strong></div>
            <dl class="dl"><div><dt>Vehículo</dt><dd>${v.brand} ${v.model}</dd></div><div><dt>Kilometraje</dt><dd>${R.fmtNum(v.km)} km</dd></div><div><dt>Conductor</dt><dd>${d ? d.name : 'Sin asignar'}</dd></div></dl>
            <div class="row-actions"><a class="btn btn-outline" href="#/vehiculos/${v.id}">Ver ficha</a><a class="btn btn-outline" href="#/kilometraje" data-action="pick-km" data-id="${v.id}">Ver kilometraje</a></div>`)}
          ${R.card('Causas del estado', h.causes.length ? html`<ul class="cause-list">${h.causes.map((c) => html`<li class="is-${c.level}"><a href="#${c.link}"><span class="cause-ico">${ico(c.type.startsWith('Falla') ? 'alert' : 'wrench', 16)}</span><span><strong>${c.type}</strong><small>${c.detail}</small></span>${ico('chev', 16)}</a></li>`)}</ul>` : html`<p class="muted ok-line">${ico('check', 16)} La unidad no presenta alertas ni fallas sin resolver.</p>`)}
        </div>`,
    };
  });
  R.actions['pick-km'] = (el) => { R.ui.kmVeh = el.getAttribute('data-id'); };

  /* =====================================================
     VEHÍCULOS (HU-01/02/03/04/05)
     ===================================================== */
  const vehRows = (db, q) => {
    const term = R.normPlate(q).replace(/-/g, '');
    const list = R.activeVehicles(db).filter((v) => !term || v.plate.replace(/-/g, '').includes(term)).sort((a, b) => a.plate.localeCompare(b.plate));
    if (!list.length) return q ? R.empty('Sin resultados', `No encontramos vehículos con la placa “${q}”.`) : R.noVehicles();
    return html`<div class="table-wrap"><table class="table resp"><thead><tr><th>Placa</th><th>Marca / Modelo</th><th>Kilometraje</th><th>Estado</th></tr></thead><tbody>
      ${list.map((v) => html`<tr class="row-link" data-href="/vehiculos/${v.id}" tabindex="0"><td data-label="Placa"><strong>${v.plate}</strong></td><td data-label="Marca / Modelo">${v.brand} ${v.model}</td><td data-label="Kilometraje">${R.fmtNum(v.km)} km</td><td data-label="Estado">${R.statusPill(R.vehicleHealth(db, v).status)}</td></tr>`)}</tbody></table></div>`;
  };

  R.route('/vehiculos', 'manager', () => {
    const db = R.db();
    const q = R.ui.vehQ || '';
    return {
      eyebrow: 'Vehículos', title: 'Vehículos',
      html: html`<div class="toolbar"><form class="search" data-form="veh-search" role="search"><span class="search-ico">${ico('search', 18)}</span><input type="search" name="q" value="${q}" placeholder="Buscar por placa" aria-label="Buscar por placa" data-input="veh-search" autocomplete="off"><button class="btn btn-primary" type="submit">Buscar</button></form>
        <a class="btn btn-primary" href="#/vehiculos/nuevo">${ico('plus', 16)} Registrar vehículo</a></div>
        <div id="veh-results">${vehRows(db, q)}</div>`,
    };
  });
  const refreshVeh = (v) => { R.ui.vehQ = v; const box = R.$('#veh-results'); if (box) box.innerHTML = vehRows(R.db(), v).s; };
  R.inputs['veh-search'] = (el) => refreshVeh(el.value);
  R.forms['veh-search'] = (form) => refreshVeh(form.elements.q.value.trim());

  const vehForm = (v) => {
    const isEdit = !!v;
    return html`<form class="card form-card" data-form="${isEdit ? 'veh-edit' : 'veh-new'}" ${isEdit ? R.raw(`data-id="${R.esc(v.id)}"`) : ''} novalidate>
      <h3>Datos del vehículo</h3>
      <div class="form-grid">
        ${R.field({ label: 'Placa', name: 'plate', value: isEdit ? v.plate : '', placeholder: 'ABC-123', attrs: { maxlength: 8, autocapitalize: 'characters', autocomplete: 'off' } })}
        ${R.field({ label: 'Marca', name: 'brand', value: isEdit ? v.brand : '', placeholder: 'Hyundai' })}
        ${R.field({ label: 'Modelo', name: 'model', value: isEdit ? v.model : '', placeholder: 'H100' })}
        ${R.field({ label: isEdit ? 'Kilometraje actual' : 'Kilometraje inicial', name: 'km', type: 'number', value: isEdit ? v.km : '', placeholder: '0', attrs: { min: 0, step: 1, inputmode: 'numeric' } })}
      </div>
      <div class="form-actions"><a class="btn btn-outline" href="#/vehiculos${isEdit ? '/' + v.id : ''}">Cancelar</a><button class="btn btn-primary" type="submit">${isEdit ? 'Guardar cambios' : 'Registrar vehículo'}</button></div></form>`;
  };
  const vehValidate = (db, d, selfId) => {
    const errs = {};
    d.plate = R.normPlate(d.plate);
    if (!d.plate) errs.plate = 'Ingresa la placa.';
    else if (!R.validPlate(d.plate)) errs.plate = 'Formato de placa no válido (ej. ABC-123).';
    else if (R.activeVehicles(db).some((v) => v.plate === d.plate && v.id !== selfId)) errs.plate = 'Ya existe un vehículo activo con esta placa.';
    if (!d.brand) errs.brand = 'Ingresa la marca.';
    if (!d.model) errs.model = 'Ingresa el modelo.';
    const km = Number(d.km);
    if (d.km === '' || !Number.isFinite(km) || km < 0 || !Number.isInteger(km)) errs.km = 'Ingresa un kilometraje válido (número entero, 0 o más).';
    return errs;
  };

  R.route('/vehiculos/nuevo', 'manager', () => ({ eyebrow: 'Vehículos', title: 'Registrar vehículo', navKey: '/vehiculos', html: vehForm(null) }));
  R.forms['veh-new'] = (form) => {
    const db = R.db();
    const d = R.formData(form);
    if (R.setErrors(form, vehValidate(db, d))) return;
    const km = Number(d.km);
    const today = R.today();
    const v = { id: R.uid('v'), plate: d.plate, brand: d.brand, model: d.model, km, kmInitial: km, active: true, driverId: null, createdAt: today, services: {} };
    db.services.forEach((s) => { v.services[s.id] = { lastKm: km, lastDate: today }; });
    db.vehicles.push(v);
    db.kmLogs.push({ id: R.uid('k'), vehicleId: v.id, date: today, km, by: R.me().name, byId: R.me().id, ts: Date.now() });
    if (!R.save()) { db.vehicles.pop(); db.kmLogs.pop(); return; }
    R.toast(`${v.plate} se registró correctamente.`, 'ok', 'Vehículo registrado');
    const n = R.activeVehicles(db).length;
    if (db.subscription && n > db.subscription.vehicles) setTimeout(() => R.toast(`Tu flota (${n}) supera los vehículos de tu plan (${db.subscription.vehicles}). Actualiza tu suscripción.`, 'warn'), 400);
    R.go('/vehiculos/' + v.id);
  };

  R.route('/vehiculos/:id/editar', 'manager', ({ id }) => {
    const v = R.vehicle(R.db(), id);
    if (!v || v.active === false) return { redirect: '/vehiculos' };
    return { eyebrow: 'Vehículos', title: `Editar vehículo — ${v.plate}`, navKey: '/vehiculos', html: vehForm(v) };
  });
  R.forms['veh-edit'] = (form) => {
    const db = R.db();
    const v = R.vehicle(db, form.getAttribute('data-id'));
    const d = R.formData(form);
    if (R.setErrors(form, vehValidate(db, d, v.id))) return;
    const km = Number(d.km);
    if (km !== v.km) {
      const r = R.logKm(db, v, km, R.me().name, R.me().id);
      if (!r.ok) return R.setErrors(form, { km: r.error });
    }
    Object.assign(v, { plate: d.plate, brand: d.brand, model: d.model });
    R.save();
    R.toast('Los datos del vehículo se actualizaron.', 'ok', 'Cambios guardados');
    R.go('/vehiculos/' + v.id);
  };

  R.route('/vehiculos/:id', 'manager', ({ id }) => {
    const db = R.db();
    const v = R.vehicle(db, id);
    if (!v || v.active === false) return { redirect: '/vehiculos' };
    const h = R.vehicleHealth(db, v);
    const d = R.driverOf(db, v);
    const ev = [];
    db.checklists.filter((c) => c.vehicleId === v.id).forEach((c) => { const n = c.results.filter((r) => r.status === 'falla').length; ev.push({ ts: c.ts, t: 'Checklist de salida', s: n ? `${n} ${n === 1 ? 'ítem' : 'ítems'} con falla` : 'Sin novedades' }); });
    R.kmLogsOf(db, v.id).forEach((k) => ev.push({ ts: k.ts, t: 'Registro de kilometraje', s: `${R.fmtNum(k.km)} km` }));
    db.maintLog.filter((m) => m.vehicleId === v.id).forEach((m) => ev.push({ ts: m.ts, t: 'Mantenimiento atendido', s: m.service }));
    db.faults.filter((f) => f.vehicleId === v.id).forEach((f) => ev.push({ ts: f.ts, t: 'Falla reportada', s: f.title }));
    ev.sort((a, b) => b.ts - a.ts);
    return {
      eyebrow: 'Vehículos', title: `Ficha del vehículo — ${v.plate}`, navKey: '/vehiculos',
      html: html`<a class="back" href="#/vehiculos">${ico('back', 16)} Volver a vehículos</a>
        <div class="grid grid-2 detail-grid">
          ${R.card('Datos generales', html`<dl class="dl"><div><dt>Placa</dt><dd>${v.plate}</dd></div><div><dt>Marca / Modelo</dt><dd>${v.brand} ${v.model}</dd></div><div><dt>Kilometraje</dt><dd>${R.fmtNum(v.km)} km</dd></div>
            <div><dt>Estado</dt><dd>${R.statusPill(h.status)}</dd></div><div><dt>Conductor asignado</dt><dd>${d ? d.name : html`Sin asignar · <a href="#/conductores">asignar</a>`}</dd></div><div><dt>Registrado</dt><dd>${R.fmtDate(v.createdAt)}</dd></div></dl>
            <div class="row-actions"><a class="btn btn-outline" href="#/vehiculos/${v.id}/editar">${ico('edit', 16)} Editar</a><button class="btn btn-danger-outline" data-action="veh-baja" data-id="${v.id}">Dar de baja unidad</button></div>`)}
          ${R.card('Historial reciente', ev.length ? html`<ul class="timeline">${ev.slice(0, 6).map((e) => html`<li><strong>${e.t}</strong><span>${e.s}</span><em>${R.ago(e.ts)}</em></li>`)}</ul>` : html`<p class="muted">Aún no hay actividad registrada.</p>`)}
        </div>`,
    };
  });
  R.actions['veh-baja'] = async (el) => {
    const db = R.db();
    const v = R.vehicle(db, el.getAttribute('data-id'));
    const ok = await R.confirm({ title: '¿Dar de baja esta unidad?', text: `${v.plate} dejará de recibir alertas y checklists asociados a esta unidad. Esta acción no se puede deshacer desde la app.`, confirm: 'Dar de baja', danger: true });
    if (!ok) return;
    v.active = false;
    v.driverId = null;
    R.save();
    R.toast(`${v.plate} fue dada de baja.`, 'ok', 'Unidad dada de baja');
    R.go('/vehiculos');
  };

  /* =====================================================
     CHECKLISTS (HU-08/09)
     ===================================================== */
  R.route('/checklists', 'manager', () => {
    const db = R.db();
    const tab = R.query.tab === 'items' ? 'items' : 'historial';
    const tabs = html`<div class="tabs" role="tablist"><a role="tab" aria-selected="${tab === 'historial'}" class="${tab === 'historial' ? 'on' : ''}" href="#/checklists">Historial</a><a role="tab" aria-selected="${tab === 'items'}" class="${tab === 'items' ? 'on' : ''}" href="#/checklists?tab=items">Ítems del checklist</a></div>`;
    if (tab === 'items') {
      return {
        eyebrow: 'Checklists', title: 'Ítems del checklist',
        html: html`${tabs}<p class="lead-sm">Estos ítems aparecen en el checklist de salida de todos tus conductores. Los obligatorios deben responderse para enviarlo.</p>
          ${R.card('', html`<ul class="item-list">${db.items.map((it) => html`<li><span class="item-name">${it.name}</span><button type="button" class="tag ${it.required ? 'tag-blue' : 'tag-gray'}" data-action="item-req" data-id="${it.id}" aria-pressed="${it.required}" title="Cambiar entre obligatorio y opcional">${it.required ? 'Obligatorio' : 'Opcional'}</button><button class="btn btn-sm btn-danger-outline" data-action="item-del" data-id="${it.id}">Quitar</button></li>`)}</ul>
            <form class="inline-form" data-form="item-add" novalidate>${R.field({ label: 'Nuevo ítem', name: 'name', placeholder: 'Ej. Nivel de refrigerante', attrs: { maxlength: 40 } })}<label class="check-inline"><input type="checkbox" name="required" checked> Obligatorio</label><button class="btn btn-primary" type="submit">${ico('plus', 16)} Agregar ítem</button></form>`)}`,
      };
    }
    const v = R.pickVehicle(db, 'clVeh');
    const list = v ? db.checklists.filter((c) => c.vehicleId === v.id).sort((a, b) => b.ts - a.ts).slice(0, 30) : [];
    return {
      eyebrow: 'Checklists', title: v ? `Historial de checklists — ${v.plate}` : 'Historial de checklists',
      html: html`${tabs}${v ? html`<div class="toolbar">${R.vehSelect(db, 'clVeh', v.id)}</div>
        ${list.length ? html`<div class="acc-list"><div class="acc-head" aria-hidden="true"><span>Fecha</span><span>Conductor</span><span>Resultado</span></div>${list.map((c) => {
          const bad = c.results.filter((r) => r.status === 'falla');
          return html`<details class="acc"><summary><span data-label="Fecha">${R.fmtDate(c.date)}</span><span data-label="Conductor">${c.driverName}</span><span data-label="Resultado">${bad.length ? R.pill('alerta', `${bad.length} ${bad.length === 1 ? 'ítem' : 'ítems'} con falla`) : R.pill('bueno', 'Sin novedades')}</span></summary>
            <ul class="acc-body">${c.results.map((r) => html`<li><span>${r.name}</span>${r.status === 'falla' ? R.pill('critico', 'Falla') : r.status === 'bueno' ? R.pill('bueno', 'Bueno') : R.pill('gray', 'Sin responder')}${r.comment ? html`<em>“${r.comment}”</em>` : ''}</li>`)}</ul></details>`;
        })}</div>` : R.empty('Sin checklists', 'Esta unidad aún no tiene checklists de salida registrados.')}` : R.noVehicles()}`,
    };
  });
  R.actions['item-req'] = (el) => { const it = R.db().items.find((i) => i.id === el.getAttribute('data-id')); it.required = !it.required; R.save(); R.rerender(); };
  R.actions['item-del'] = async (el) => {
    const db = R.db();
    if (db.items.length <= 1) return R.toast('El checklist debe tener al menos un ítem.', 'warn');
    const it = db.items.find((i) => i.id === el.getAttribute('data-id'));
    const ok = await R.confirm({ title: `¿Quitar “${it.name}”?`, text: 'Dejará de aparecer en los próximos checklists. El historial existente se conserva.', confirm: 'Quitar', danger: true });
    if (!ok) return;
    db.items = db.items.filter((i) => i.id !== it.id);
    R.save();
    R.toast(`Se quitó “${it.name}”.`);
    R.rerender();
  };
  R.forms['item-add'] = (form) => {
    const db = R.db();
    const d = R.formData(form);
    const errs = {};
    if (!d.name) errs.name = 'Escribe el nombre del ítem.';
    else if (db.items.some((i) => i.name.toLowerCase() === d.name.toLowerCase())) errs.name = 'Ese ítem ya existe.';
    if (R.setErrors(form, errs)) return;
    db.items.push({ id: R.uid('i'), name: d.name, required: form.elements.required.checked });
    R.save();
    R.toast(`Se agregó “${d.name}” al checklist.`);
    R.rerender();
  };

  /* =====================================================
     KILOMETRAJE (HU-12/13)
     ===================================================== */
  R.route('/kilometraje', 'manager', () => {
    const db = R.db();
    const v = R.pickVehicle(db, 'kmVeh');
    if (!v) return { eyebrow: 'Kilometraje', title: 'Kilometraje', html: R.noVehicles() };
    const range = R.ui.kmRange || 30;
    const logs = R.kmLogsOf(db, v.id);
    const since = R.ymd(R.addDays(new Date(), -range));
    const pts = logs.filter((l) => range === 0 || l.date >= since).map((l) => ({ label: l.date.slice(8) + '/' + l.date.slice(5, 7), value: l.km, tip: `${R.fmtDate(l.date)}: ${R.fmtNum(l.km)} km` }));
    const month = R.today().slice(0, 7);
    const inMonth = logs.filter((l) => l.date.startsWith(month));
    const before = logs.filter((l) => l.date < month + '-01').pop();
    const base = before || inMonth[0];
    const total = inMonth.length && base ? inMonth[inMonth.length - 1].km - base.km : 0;
    const rangeBtn = (n, l) => html`<button type="button" class="chip ${range === n ? 'on' : ''}" data-action="km-range" data-value="${n}">${l}</button>`;
    return {
      eyebrow: 'Kilometraje', title: `Evolución de kilometraje — ${v.plate}`,
      html: html`<div class="toolbar">${R.vehSelect(db, 'kmVeh', v.id)}<div class="chips">${rangeBtn(30, '30 días')}${rangeBtn(90, '90 días')}${rangeBtn(0, 'Todo')}</div></div>
        ${R.card('Kilometraje en el tiempo', html`${R.lineChart(pts, { label: 'Kilometraje en el tiempo' })}
          <dl class="stats-row"><div><dt>Promedio diario</dt><dd>${R.fmtNum(R.avgDaily(db, v))} km</dd></div><div><dt>Total del mes</dt><dd>${R.fmtNum(total)} km</dd></div><div><dt>Kilometraje actual</dt><dd>${R.fmtNum(v.km)} km</dd></div></dl>`)}
        ${R.card('Historial de kilometraje', logs.length ? html`<div class="table-wrap"><table class="table resp"><thead><tr><th>Fecha</th><th>Kilometraje</th><th>Registrado por</th><th></th></tr></thead><tbody>
          ${logs.slice().reverse().slice(0, 40).map((l) => html`<tr><td data-label="Fecha">${R.fmtDate(l.date)}</td><td data-label="Kilometraje">${R.fmtNum(l.km)} km ${l.corrected ? html`<span class="tag tag-orange">Corregido</span>` : ''}</td><td data-label="Registrado por">${l.by || '—'}</td><td class="td-actions"><button class="btn btn-sm btn-outline" data-action="km-fix" data-id="${l.id}">Corregir</button></td></tr>`)}</tbody></table></div>` : html`<p class="muted">Sin registros.</p>`)}`,
    };
  });
  R.actions['km-range'] = (el) => { R.ui.kmRange = Number(el.getAttribute('data-value')); R.rerender(); };
  R.actions['km-fix'] = (el) => {
    const db = R.db();
    const log = db.kmLogs.find((l) => l.id === el.getAttribute('data-id'));
    R.modal(html`<h3 id="modal-title">Corregir registro</h3><form data-form="km-fix" data-id="${log.id}" novalidate>
      ${R.field({ label: 'Fecha', name: 'date', value: R.fmtDate(log.date), attrs: { readonly: true } })}
      ${R.field({ label: 'Kilometraje corregido', name: 'km', type: 'number', value: log.km, attrs: { min: 0, step: 1, inputmode: 'numeric' } })}
      <div class="modal-actions"><button type="button" class="btn btn-outline" data-action="modal-close">Cancelar</button><button type="submit" class="btn btn-primary">Guardar corrección</button></div></form>`);
  };
  R.forms['km-fix'] = (form) => {
    const db = R.db();
    const log = db.kmLogs.find((l) => l.id === form.getAttribute('data-id'));
    const km = Number(form.elements.km.value);
    const logs = R.kmLogsOf(db, log.vehicleId);
    const i = logs.findIndex((l) => l.id === log.id);
    const prev = logs[i - 1], next = logs[i + 1];
    let err = '';
    if (form.elements.km.value === '' || !Number.isInteger(km) || km < 0) err = 'Ingresa un kilometraje válido (número entero).';
    else if (prev && km < prev.km) err = `No puede ser menor al registro anterior (${R.fmtNum(prev.km)} km).`;
    else if (next && km > next.km) err = `No puede ser mayor al registro siguiente (${R.fmtNum(next.km)} km).`;
    else if (km === log.km) err = 'El valor es igual al actual. Ingresa el kilometraje corregido.';
    if (R.setErrors(form, err ? { km: err } : {})) return;
    log.km = km; log.corrected = true;
    const v = R.vehicle(db, log.vehicleId);
    R.syncVehicleKm(db, v);
    R.save();
    R.closeModal(false);
    R.toast('El registro de kilometraje fue corregido.', 'ok', 'Corrección guardada');
    R.rerender();
  };

  /* =====================================================
     COMBUSTIBLE (HU-29/30)
     ===================================================== */
  R.route('/combustible', 'manager', () => {
    const db = R.db();
    const v = R.pickVehicle(db, 'fuelVeh');
    if (!v) return { eyebrow: 'Combustible', title: 'Combustible', html: R.noVehicles() };
    const series = R.fuelSeries(db, v.id);
    const st = R.fuelStats(db, v.id);
    const pts = series.filter((s) => s.kmpg != null).map((s) => ({ label: s.date.slice(8) + '/' + s.date.slice(5, 7), value: Math.round(s.kmpg * 10) / 10, tip: `${R.fmtDate(s.date)}: ${R.fmtNum(s.kmpg, 1)} km/gal` }));
    const compare = R.activeVehicles(db).map((x) => ({ x, s: R.fuelStats(db, x.id) })).filter((r) => r.s.avg != null).map((r) => ({ label: r.x.plate, value: r.s.avg, sub: `${r.x.brand} ${r.x.model}`, active: r.x.id === v.id })).sort((a, b) => b.value - a.value);
    const spend = series.filter((s) => s.date.startsWith(R.today().slice(0, 7))).reduce((a, s) => a + s.amount, 0);
    const vari = st.variation;
    return {
      eyebrow: 'Combustible', title: `Rendimiento de combustible — ${v.plate}`,
      html: html`<div class="toolbar">${R.vehSelect(db, 'fuelVeh', v.id)}</div>
        <div class="grid grid-2 detail-grid">
          ${R.card('Rendimiento promedio', st.count ? html`${R.lineChart(pts, { label: 'Rendimiento por carga', color: '#3AA76D', fmt: (n) => R.fmtNum(n, 1), width: 420, height: 260 })}
            <dl class="stats-row"><div><dt>Promedio</dt><dd>${R.fmtNum(st.avg, 1)} km/gal</dd></div><div><dt>Variación última carga</dt><dd class="${vari == null ? '' : vari < -8 ? 'txt-red' : vari < 0 ? 'txt-orange' : 'txt-green'}">${vari == null ? '—' : (vari > 0 ? '+' : '') + R.fmtNum(vari, 1) + '%'}</dd></div><div><dt>Gasto del mes</dt><dd>${R.money(spend)}</dd></div></dl>` : R.empty('Sin datos suficientes', 'Se necesitan al menos dos cargas de combustible para calcular el rendimiento.'))}
          ${R.card('Comparar rendimiento', compare.length ? R.bars(compare, 'km/gal') : html`<p class="muted">Aún no hay datos para comparar.</p>`)}
        </div>
        ${R.card('Cargas registradas', series.length ? html`<div class="table-wrap"><table class="table resp"><thead><tr><th>Fecha</th><th>Litros</th><th>Monto</th><th>Kilometraje</th><th>Rendimiento</th></tr></thead><tbody>${series.slice().reverse().slice(0, 20).map((s) => html`<tr><td data-label="Fecha">${R.fmtDate(s.date)}</td><td data-label="Litros">${R.fmtNum(s.liters, 1)} L</td><td data-label="Monto">${R.money(s.amount)}</td><td data-label="Kilometraje">${R.fmtNum(s.km)} km</td><td data-label="Rendimiento">${s.kmpg == null ? '—' : R.fmtNum(s.kmpg, 1) + ' km/gal'}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">Los conductores registran las cargas desde su app.</p>`)}`,
    };
  });
})();
