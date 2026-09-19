/* FleetCare app — conductor (móvil): inicio, checklist, kilometraje, fallas, combustible */
(function () {
  'use strict';
  const R = window.FleetCare;
  const { html, ico } = R;
  const MAX_PHOTOS = 5;

  const ctx = () => { const me = R.me(); const db = R.db(); return { me, db, v: R.vehicleOfDriver(db, me) }; };
  const noVehicle = (title) => ({ title, html: R.empty('Sin vehículo asignado', 'Tu jefe de flota aún no te asignó una unidad. Pídele que te asigne una para usar la app.') });
  const todayChecklist = (db, v) => db.checklists.find((c) => c.vehicleId === v.id && c.date === R.today());
  const vehCard = (v) => html`<div class="pcard veh-chip"><span class="veh-ico">${ico('truck', 22)}</span><div><strong>${v.plate}</strong><small>${v.brand} ${v.model}</small></div></div>`;
  const notifyManager = (db, n) => R.notify(db, n);

  /* ---------- Inicio (HU-10) ---------- */
  R.route('/c/inicio', 'driver', () => {
    const { me, db, v } = ctx();
    if (!v) return noVehicle('Inicio');
    const done = todayChecklist(db, v);
    const kmToday = R.kmLogsOf(db, v.id).find((l) => l.date === R.today());
    const open = db.faults.filter((f) => f.vehicleId === v.id && R.faultOpen(f)).length;
    return {
      title: 'Inicio',
      html: html`<p class="hello">Hola, <strong>${me.name.split(' ')[0]}</strong></p>${vehCard(v)}
        ${done ? '' : html`<div class="reminder" role="alert"><span class="reminder-ico">${ico('bell', 18)}</span><div><small>Recordatorio</small><strong>Aún no completas tu checklist de hoy</strong></div><a class="btn btn-accent btn-sm" href="#/c/checklist">Completar ahora</a></div>`}
        <section class="pcard"><h3>Resumen de hoy</h3><dl class="sum-list">
          <div><dt>Kilometraje</dt><dd>${R.fmtNum(v.km)} km ${kmToday ? R.pill('bueno', 'Registrado hoy') : R.pill('alerta', 'Sin registrar')}</dd></div>
          <div><dt>Checklist</dt><dd>${done ? R.pill('bueno', 'Completado') : R.pill('alerta', 'Pendiente')}</dd></div>
          <div><dt>Fallas abiertas</dt><dd>${open ? R.pill('alerta', String(open)) : R.pill('bueno', 'Ninguna')}</dd></div></dl></section>
        <div class="quick">${[['/c/checklist', 'clipboard', 'Checklist'], ['/c/kilometraje', 'gauge', 'Kilometraje'], ['/c/fallas/nueva', 'alert', 'Reportar falla'], ['/c/combustible', 'fuel', 'Combustible']].map(([p, i, l]) => html`<a href="#${p}"><span>${ico(i, 22)}</span>${l}</a>`)}</div>`,
    };
  });

  /* ---------- Checklist de salida (HU-06/07) ---------- */
  R.route('/c/checklist', 'driver', () => {
    const { db, v } = ctx();
    if (!v) return noVehicle('Checklist de salida');
    const done = todayChecklist(db, v);
    R.ui.ckPhotos = {};
    if (done) {
      const bad = done.results.filter((r) => r.status === 'falla').length;
      return {
        title: 'Checklist de salida',
        html: html`${vehCard(v)}<section class="pcard done-card"><span class="done-ico">${ico('check', 26)}</span><h3>Ya completaste tu checklist de hoy</h3><p>${bad ? `Reportaste ${bad} ${bad === 1 ? 'ítem con falla' : 'ítems con falla'}. Tu jefe de flota fue notificado.` : 'Todo en orden. ¡Buen viaje!'}</p></section>
          <section class="pcard"><h3>Resumen enviado</h3><ul class="ck-summary">${done.results.map((r) => html`<li><span>${r.name}</span>${r.status === 'falla' ? R.pill('critico', 'Falla') : r.status === 'bueno' ? R.pill('bueno', 'Bueno') : R.pill('gray', 'N/A')}</li>`)}</ul></section>`,
      };
    }
    return {
      title: 'Checklist de salida',
      html: html`${vehCard(v)}<form class="pcard ck-form" data-form="checklist" novalidate><ul class="ck-list">${db.items.map((it) => html`<li class="ck-item" data-item="${it.id}"><div class="ck-row"><span class="ck-name">${it.name}${it.required ? '' : html` <small>(opcional)</small>`}</span>
          <label class="radio"><input type="radio" name="i_${it.id}" value="bueno" data-change="ck-radio"><span>Bueno</span></label><label class="radio radio-bad"><input type="radio" name="i_${it.id}" value="falla" data-change="ck-radio"><span>Falla</span></label></div>
          <div class="ck-fail" hidden>${R.field({ label: 'Comentario de la falla', name: 'c_' + it.id, type: 'textarea', rows: 2, attrs: { maxlength: 300 } })}
            <div class="photo-row"><button type="button" class="btn btn-outline btn-sm" data-action="ck-photo" data-id="${it.id}">${ico('camera', 16)} Adjuntar foto</button><span class="pv" id="pv-${it.id}"></span></div></div>
          <span class="field-error" data-err="i_${it.id}" role="alert"></span></li>`)}</ul>
        <input type="file" id="ck-file" accept="image/*" capture="environment" hidden data-change="ck-file">
        <button class="btn btn-primary btn-block" type="submit">Enviar checklist</button></form>`,
    };
  });
  R.changes['ck-radio'] = (el) => {
    const li = el.closest('.ck-item');
    const bad = el.value === 'falla';
    li.querySelector('.ck-fail').hidden = !bad;
    li.classList.toggle('is-bad', bad);
    li.querySelector('[data-err]').textContent = '';
    if (bad) { const t = li.querySelector('textarea'); if (t) t.focus({ preventScroll: true }); }
  };
  R.actions['ck-photo'] = (el) => { R.ui.ckItem = el.getAttribute('data-id'); R.$('#ck-file').click(); };
  R.changes['ck-file'] = async (el) => {
    const file = el.files[0];
    el.value = '';
    if (!file) return;
    try {
      const url = await R.readImage(file);
      const id = R.ui.ckItem;
      R.ui.ckPhotos[id] = url;
      R.$('#pv-' + id).innerHTML = `<img src="${url}" alt="Foto adjunta"><button type="button" class="pv-x" data-action="ck-photo-x" data-id="${R.esc(id)}" aria-label="Quitar foto">×</button>`;
    } catch (e) { R.toast(e.message, 'error', 'Foto no válida'); }
  };
  R.actions['ck-photo-x'] = (el) => { const id = el.getAttribute('data-id'); delete R.ui.ckPhotos[id]; R.$('#pv-' + id).innerHTML = ''; };

  R.forms.checklist = (form) => {
    const { me, db, v } = ctx();
    if (todayChecklist(db, v)) return R.rerender();
    const errs = {};
    const results = db.items.map((it) => {
      const sel = form.querySelector(`input[name="i_${it.id}"]:checked`);
      const status = sel ? sel.value : it.required ? null : 'na';
      const comment = form.elements['c_' + it.id] ? form.elements['c_' + it.id].value.trim() : '';
      if (!status) errs['i_' + it.id] = 'Marca “Bueno” o “Falla”.';
      else if (status === 'falla' && !comment) errs['c_' + it.id] = 'Describe brevemente la falla.';
      return { name: it.name, status, comment: status === 'falla' ? comment : '', photo: status === 'falla' ? R.ui.ckPhotos[it.id] || null : null, itemId: it.id };
    });
    if (R.setErrors(form, errs)) return;
    const now = Date.now();
    const cl = { id: R.uid('cl'), vehicleId: v.id, date: R.today(), ts: now, driverId: me.id, driverName: me.name, results: results.map(({ name, status, comment }) => ({ name, status, comment })) };
    const newFaults = results.filter((r) => r.status === 'falla').map((r) => ({
      id: R.uid('f'), vehicleId: v.id, title: r.name, description: r.comment, photos: r.photo ? [r.photo] : [], priority: 'media', status: 'pendiente',
      reportedBy: me.name, reportedById: me.id, date: R.today(), ts: now, comments: [], fromChecklist: cl.id,
    }));
    db.checklists.push(cl);
    db.faults.push(...newFaults);
    newFaults.forEach((f) => notifyManager(db, { type: 'falla', title: 'Nueva falla reportada', text: `${v.plate} · ${f.title}`, vehicleId: v.id, link: '/fallas/' + f.id }));
    if (!R.save()) { db.checklists.pop(); db.faults.splice(db.faults.length - newFaults.length, newFaults.length); db.notifications.splice(0, newFaults.length); return; }
    R.toast(newFaults.length ? `Se avisó a tu jefe de flota de ${newFaults.length} ${newFaults.length === 1 ? 'falla' : 'fallas'}.` : 'Todo en orden. ¡Buen viaje!', 'ok', 'Checklist enviado');
    R.rerender();
  };

  /* ---------- Kilometraje (HU-11) ---------- */
  R.route('/c/kilometraje', 'driver', () => {
    const { db, v } = ctx();
    if (!v) return noVehicle('Registrar kilometraje');
    const logs = R.kmLogsOf(db, v.id).slice().reverse().slice(0, 5);
    const today = logs.find((l) => l.date === R.today());
    return {
      title: 'Registrar kilometraje',
      html: html`${vehCard(v)}<form class="pcard" data-form="km" novalidate><div class="last-km"><small>Último kilometraje registrado</small><strong>${R.fmtNum(v.km)} km</strong></div>
        ${R.field({ label: 'Kilometraje actual', name: 'km', type: 'number', value: '', placeholder: String(v.km), attrs: { min: v.km, step: 1, inputmode: 'numeric' } })}
        ${today ? html`<p class="hint block">Ya registraste hoy (${R.fmtNum(today.km)} km). Guardar reemplazará ese registro.</p>` : ''}
        <button class="btn btn-primary btn-block" type="submit">Guardar registro</button></form>
        <section class="pcard"><h3>Registros recientes</h3><ul class="plain-list tight">${logs.map((l) => html`<li><span>${R.fmtDate(l.date)}</span><strong>${R.fmtNum(l.km)} km</strong></li>`)}</ul></section>`,
    };
  });
  R.forms.km = async (form) => {
    const { me, db, v } = ctx();
    const raw = form.elements.km.value;
    const km = Number(raw);
    let err = '';
    if (raw === '' || !Number.isInteger(km) || km < 0) err = 'Ingresa el kilometraje como número entero.';
    else if (km < v.km && R.kmLogsOf(db, v.id).some((l) => l.date === R.today()) === false) err = `No puede ser menor al último registrado (${R.fmtNum(v.km)} km).`;
    if (R.setErrors(form, err ? { km: err } : {})) return;
    if (km - v.km > 3000) {
      const ok = await R.confirm({ title: '¿Es correcto el kilometraje?', text: `Ingresaste ${R.fmtNum(km)} km, ${R.fmtNum(km - v.km)} km más que tu último registro.`, confirm: 'Sí, es correcto' });
      if (!ok) return;
    }
    const r = R.logKm(db, v, km, me.name, me.id);
    if (!r.ok) return R.setErrors(form, { km: r.error });
    R.save();
    R.toast(r.replaced ? 'Actualizaste el registro de hoy.' : `${R.fmtNum(km)} km registrados.`, 'ok', 'Kilometraje guardado');
    R.rerender();
  };

  /* ---------- Fallas (HU-14/15) ---------- */
  R.route('/c/fallas', 'driver', () => {
    const { db, v } = ctx();
    if (!v) return noVehicle('Fallas');
    const mine = db.faults.filter((f) => f.vehicleId === v.id).sort((a, b) => b.ts - a.ts).slice(0, 15);
    return {
      title: 'Fallas',
      html: html`${vehCard(v)}<a class="btn btn-primary btn-block" href="#/c/fallas/nueva">${ico('plus', 16)} Reportar falla</a>
        <section class="pcard"><h3>Fallas de tu unidad</h3>${mine.length ? html`<ul class="fault-list">${mine.map((f) => html`<li><a href="#/c/fallas/${f.id}"><div><strong>${f.title}</strong><small>${R.fmtDate(f.date)} · ${f.reportedBy}</small></div>${R.faultPill(f.status)}</a></li>`)}</ul>` : html`<p class="muted">No hay fallas registradas.</p>`}</section>`,
    };
  });

  R.route('/c/fallas/nueva', 'driver', () => {
    const { v } = ctx();
    if (!v) return noVehicle('Reportar falla');
    R.ui.faultPhotos = [];
    return {
      title: 'Reportar falla', navKey: '/c/fallas',
      html: html`<a class="back" href="#/c/fallas">${ico('back', 16)} Volver</a>${vehCard(v)}<form class="pcard" data-form="fault" novalidate>
        ${R.field({ label: 'Descripción de la falla', name: 'description', type: 'textarea', rows: 4, placeholder: 'Ej. Ruido metálico al frenar en bajadas', attrs: { maxlength: 400 } })}
        <div id="photo-box">${photoBox([])}</div>
        <input type="file" id="fault-file" accept="image/*" capture="environment" multiple hidden data-change="fault-file">
        <button class="btn btn-primary btn-block" type="submit">Enviar reporte</button></form>`,
    };
  });
  const photoBox = (photos) => photos.length
    ? html`<p class="photo-count">Fotos adjuntas (${photos.length}/${MAX_PHOTOS})</p><div class="thumbs">${photos.map((p, i) => html`<div class="thumb"><img src="${p}" alt="Foto ${i + 1}"><button type="button" class="pv-x" data-action="fault-photo-x" data-i="${i}" aria-label="Quitar foto ${i + 1}">×</button></div>`)}</div>${photos.length < MAX_PHOTOS ? html`<button type="button" class="btn btn-outline btn-sm" data-action="fault-photo">${ico('plus', 16)} Agregar otra foto</button>` : ''}`
    : html`<button type="button" class="dropzone" data-action="fault-photo">${ico('image', 26)}<span>Adjuntar foto</span></button>`;
  R.actions['fault-photo'] = () => R.$('#fault-file').click();
  R.actions['fault-photo-x'] = (el) => { R.ui.faultPhotos.splice(Number(el.getAttribute('data-i')), 1); R.$('#photo-box').innerHTML = photoBox(R.ui.faultPhotos).s; };
  R.changes['fault-file'] = async (el) => {
    const files = Array.from(el.files);
    el.value = '';
    for (const f of files) {
      if (R.ui.faultPhotos.length >= MAX_PHOTOS) { R.toast(`Puedes adjuntar hasta ${MAX_PHOTOS} fotos.`, 'warn'); break; }
      try { R.ui.faultPhotos.push(await R.readImage(f)); } catch (e) { R.toast(e.message, 'error', 'Foto no válida'); }
    }
    R.$('#photo-box').innerHTML = photoBox(R.ui.faultPhotos).s;
  };
  R.forms.fault = (form) => {
    const { me, db, v } = ctx();
    const desc = form.elements.description.value.trim();
    if (R.setErrors(form, desc.length >= 5 ? {} : { description: 'Describe la falla (mínimo 5 caracteres).' })) return;
    const first = desc.split(/[.\n]/)[0].trim();
    const title = (first.length > 50 ? first.slice(0, 47).trim() + '…' : first).replace(/^./, (c) => c.toUpperCase());
    const f = { id: R.uid('f'), vehicleId: v.id, title, description: desc, photos: R.ui.faultPhotos.slice(), priority: 'media', status: 'pendiente', reportedBy: me.name, reportedById: me.id, date: R.today(), ts: Date.now(), comments: [] };
    db.faults.push(f);
    notifyManager(db, { type: 'falla', title: 'Nueva falla reportada', text: `${v.plate} · ${f.title}`, vehicleId: v.id, link: '/fallas/' + f.id });
    if (!R.save()) { db.faults.pop(); db.notifications.shift(); return; }
    R.toast('Tu jefe de flota recibió el reporte.', 'ok', 'Falla reportada');
    R.go('/c/fallas');
  };

  R.route('/c/fallas/:id', 'driver', ({ id }) => {
    const { db, v } = ctx();
    const f = db.faults.find((x) => x.id === id && v && x.vehicleId === v.id);
    if (!f) return { redirect: '/c/fallas' };
    return {
      title: 'Detalle de falla', navKey: '/c/fallas',
      html: html`<a class="back" href="#/c/fallas">${ico('back', 16)} Volver</a><section class="pcard"><div class="fault-head"><h3>${f.title}</h3>${R.faultPill(f.status)}</div><small class="muted">${R.fmtDate(f.date)} · ${f.reportedBy}</small><p class="fault-desc">${f.description}</p>
        ${f.photos.length ? html`<div class="thumbs">${f.photos.map((p, i) => html`<div class="thumb"><img src="${p}" alt="Foto ${i + 1}"></div>`)}</div>` : ''}</section>
        <section class="pcard"><h3>Comentarios</h3>${f.comments.filter((c) => !c.sys).length ? html`<ul class="comments">${f.comments.filter((c) => !c.sys).map((c) => html`<li><p>${c.text}</p><small>${c.by} · ${R.ago(c.ts)}</small></li>`)}</ul>` : html`<p class="muted">Sin comentarios todavía.</p>`}
        <form class="comment-form" data-form="d-comment" data-id="${f.id}" novalidate>${R.field({ label: 'Agregar un comentario', name: 'text', type: 'textarea', rows: 2, attrs: { maxlength: 300 } })}<button class="btn btn-outline btn-block" type="submit">Comentar</button></form></section>`,
    };
  });
  R.forms['d-comment'] = (form) => {
    const { me, db } = ctx();
    const f = db.faults.find((x) => x.id === form.getAttribute('data-id'));
    const text = form.elements.text.value.trim();
    if (R.setErrors(form, text ? {} : { text: 'Escribe un comentario.' })) return;
    f.comments.push({ id: R.uid('c'), by: me.name, role: 'driver', text, ts: Date.now() });
    R.save();
    R.rerender();
  };

  /* ---------- Combustible (HU-28) ---------- */
  R.route('/c/combustible', 'driver', () => {
    const { db, v } = ctx();
    if (!v) return noVehicle('Registrar combustible');
    const rows = R.fuelSeries(db, v.id).slice().reverse().slice(0, 5);
    return {
      title: 'Registrar combustible',
      html: html`${vehCard(v)}<form class="pcard" data-form="fuel" novalidate>
        ${R.field({ label: 'Litros cargados', name: 'liters', type: 'number', placeholder: '0.0', attrs: { min: 0, step: '0.1', inputmode: 'decimal' } })}
        ${R.field({ label: 'Monto pagado (S/)', name: 'amount', type: 'number', placeholder: '0.00', attrs: { min: 0, step: '0.01', inputmode: 'decimal' } })}
        <p class="hint block">Se registra con tu kilometraje actual (${R.fmtNum(v.km)} km). Actualízalo antes si ya recorriste más.</p>
        <button class="btn btn-primary btn-block" type="submit">Guardar registro</button></form>
        <section class="pcard"><h3>Cargas recientes</h3>${rows.length ? html`<ul class="plain-list tight">${rows.map((r) => html`<li><span>${R.fmtDate(r.date)} · ${R.fmtNum(r.liters, 1)} L</span><strong>${r.kmpg == null ? R.money(r.amount) : R.fmtNum(r.kmpg, 1) + ' km/gal'}</strong></li>`)}</ul>` : html`<p class="muted">Aún no registraste cargas.</p>`}</section>`,
    };
  });
  R.forms.fuel = (form) => {
    const { me, db, v } = ctx();
    const liters = Number(form.elements.liters.value);
    const amount = Number(form.elements.amount.value);
    const errs = {};
    if (!form.elements.liters.value || !(liters > 0) || liters > 300) errs.liters = 'Ingresa los litros (entre 0.1 y 300).';
    if (!form.elements.amount.value || !(amount > 0) || amount > 5000) errs.amount = 'Ingresa el monto pagado (mayor a 0).';
    if (R.setErrors(form, errs)) return;
    db.fuel.push({ id: R.uid('g'), vehicleId: v.id, date: R.today(), km: v.km, liters: Math.round(liters * 10) / 10, amount: Math.round(amount * 100) / 100, by: me.name, ts: Date.now() });
    R.save();
    R.toast(`${R.fmtNum(liters, 1)} L · ${R.money(amount)}`, 'ok', 'Combustible registrado');
    R.rerender();
  };
})();
