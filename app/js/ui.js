/* CodeNova — componentes de interfaz reutilizables. */
(function () {
  'use strict';
  const CN = window.CN;
  const esc = CN.esc;

  // ---------- íconos (trazos estilo Lucide, tomados del mockup) ----------
  const ICONS = {
    zap: '<polygon points="13 2 3 14 11 14 10 22 21 10 13 10 13 2"/>',
    dashboard: '<line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-7h5v7"/>',
    alert: '<path d="M10.3 4.3 1.9 19a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="12" y1="17.5" x2="12" y2="17.5"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.6-3.6a6 6 0 0 1-7.9 7.9L6.5 20.5a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9Z"/>',
    book: '<path d="M4.5 19.5A2.5 2.5 0 0 1 7 17h13"/><path d="M7 2h13v20H7a2.5 2.5 0 0 1-2.5-2.5v-15A2.5 2.5 0 0 1 7 2Z"/>',
    users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M17 3.5a4 4 0 0 1 0 7.6"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    key: '<circle cx="8" cy="15" r="4.2"/><path d="M11 12 20 3"/><path d="M17 6l3 3"/><path d="M14 9l2 2"/>',
    send: '<path d="M21.5 2.5 10.5 13.5"/><path d="M21.5 2.5 15 21.5l-4.5-8-8-4.5Z"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    menu: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
    cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
    savings: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    chevronR: '<path d="m9 18 6-6-6-6"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    wifiOff: '<line x1="2" y1="2" x2="22" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  };
  CN.icon = function (name, size, color, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) + '" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  };
  const ic = CN.icon;

  CN.logoTile = (size) => '<span class="logo-tile" style="width:' + (size || 32) + 'px;height:' + (size || 32) + 'px">' + ic('zap', Math.round((size || 32) * 0.56), '#fff') + '</span>';

  // ---------- fragmentos ----------
  CN.sev = function (s) {
    const d = CN.SEV[s] || CN.SEV.normal;
    return '<span class="sev" style="color:' + d.text + '"><i style="background:' + d.color + '"></i>' + d.label + '</span>';
  };
  CN.sevChip = function (s, withIcon) {
    const d = CN.SEV[s] || CN.SEV.normal;
    return '<span class="chip" style="background:' + d.bg + ';color:' + d.text + '">' + (withIcon ? ic(s === 'sin_datos' ? 'wifiOff' : 'alert', 16) : '') + d.label + '</span>';
  };
  CN.statusChip = function (label, kind) {
    const map = { ok: ['#E6F4EC', '#2E9E6D'], warn: ['#FFF4D6', '#8A6100'], info: ['#E1EEF3', '#0F5C78'], bad: ['#FDEBEA', '#E53935'], mute: ['#F4F6F8', '#5C6B76'] };
    const c = map[kind] || map.mute;
    return '<span class="chip" style="background:' + c[0] + ';color:' + c[1] + '">' + esc(label) + '</span>';
  };
  CN.alertStatusChip = (s) => CN.statusChip(CN.ALERT_STATUS[s], s === 'resuelta' ? 'ok' : s === 'en_gestion' ? 'info' : 'warn');
  CN.incStatusChip = (s) => CN.statusChip(CN.INC_STATUS[s], s === 'resuelto' ? 'ok' : s === 'en_gestion' ? 'info' : 'warn');
  CN.visitStatusChip = (s) => CN.statusChip(CN.VISIT_STATUS[s], { propuesta: 'warn', contrapropuesta: 'warn', confirmada: 'info', realizada: 'ok', cancelada: 'mute' }[s]);
  CN.equipStatusChip = function (e) {
    const s = CN.equipStatus(e);
    if (s === 'baja_equipo') return CN.statusChip('De baja', 'mute');
    if (s === 'sin_sensor') return '<span class="sev" style="color:#5C6B76"><i style="background:#9AA7B0"></i>Sin sensor</span>';
    if (s === 'normal') return CN.sev('normal');
    return '<span class="sev" style="color:' + CN.SEV[s].text + '"><i style="background:' + CN.SEV[s].color + '"></i>' + (s === 'sin_datos' ? 'Sin datos' : 'Severidad ' + CN.SEV[s].label) + '</span>';
  };

  CN.pageHead = function (eyebrow, title, sub, actions) {
    return '<div class="page-head"><div>' + (eyebrow ? '<p class="eyebrow">' + eyebrow + '</p>' : '') + '<h1>' + title + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</div>';
  };
  CN.empty = (icon, title, text, action) => '<div class="empty">' + ic(icon || 'activity', 34) + '<h3>' + title + '</h3><p>' + (text || '') + '</p>' + (action || '') + '</div>';
  CN.stat = (icon, value, label, extra) => '<div class="card stat"' + (extra || '') + '><span class="stat-ic">' + ic(icon, 26) + '</span><h2>' + value + '</h2><p>' + label + '</p></div>';

  // ---------- formularios ----------
  CN.field = function (o) {
    const id = o.id;
    const common = 'id="' + id + '" name="' + id + '"' + (o.required === false ? '' : ' required') + (o.attrs ? ' ' + o.attrs : '') + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '');
    let control;
    if (o.type === 'textarea') control = '<textarea ' + common + ' rows="' + (o.rows || 4) + '">' + esc(o.value || '') + '</textarea>';
    else if (o.type === 'select') {
      control = '<div class="select-wrap"><select ' + common + '>' + (o.placeholder ? '<option value="">' + esc(o.placeholder) + '</option>' : '') +
        o.options.map((x) => { const v = typeof x === 'object' ? x.value : x, l = typeof x === 'object' ? x.label : x; return '<option value="' + esc(v) + '"' + (String(v) === String(o.value) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>' + ic('chevron', 18) + '</div>';
    } else control = '<input ' + common + ' type="' + (o.type || 'text') + '" value="' + esc(o.value || '') + '"' + (o.type === 'password' ? ' autocomplete="' + (o.autocomplete || 'current-password') + '"' : '') + '>';
    return '<div class="field' + (o.cls ? ' ' + o.cls : '') + '"><label for="' + id + '">' + o.label + '</label>' + control + (o.hint ? '<small class="hint">' + o.hint + '</small>' : '') + '<small class="err" data-err="' + id + '"></small></div>';
  };
  CN.btn = (label, o) => {
    o = o || {};
    return '<button type="' + (o.type || 'button') + '" class="btn ' + (o.cls || 'btn-primary') + '"' + (o.attrs ? ' ' + o.attrs : '') + '>' + (o.icon ? ic(o.icon, 20) : '') + '<span>' + label + '</span></button>';
  };

  // Enlaza un formulario: handler(values, fail) → fail(id, msg) muestra el error bajo el campo.
  CN.bindForm = function (form, handler) {
    if (!form) return;
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      form.querySelectorAll('.err').forEach((n) => (n.textContent = ''));
      form.querySelectorAll('.field.bad').forEach((n) => n.classList.remove('bad'));
      let failed = false, first = null;
      const fail = (id, msg) => {
        failed = true;
        const el = form.querySelector('[data-err="' + id + '"]');
        if (el) { el.textContent = msg; el.closest('.field').classList.add('bad'); }
        if (!first) first = form.querySelector('[name="' + id + '"]');
      };
      const values = {};
      Array.from(form.elements).forEach((el) => {
        if (!el.name) return;
        if (el.type === 'checkbox') values[el.name] = el.checked;
        else if (el.type === 'file') values[el.name] = el.files && el.files[0];
        else values[el.name] = el.value;
        if (el.required && el.type !== 'checkbox' && !String(el.value).trim()) fail(el.name, 'Este campo es obligatorio.');
      });
      if (failed) { if (first) first.focus(); return; }
      handler(values, fail);
      if (failed && first) first.focus();
    });
  };
  CN.isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());

  // Selector múltiple desplegable (edificios asignados, US05)
  CN.multiSelect = function (id, label, options, placeholder) {
    return '<div class="field" data-ms="' + id + '"><label>' + label + '</label>' +
      '<button type="button" class="ms-btn" aria-haspopup="true" aria-expanded="false"><span class="ms-text">' + esc(placeholder) + '</span>' + ic('chevron', 18) + '</button>' +
      '<div class="ms-panel" hidden>' + (options.length ? options.map((o) => '<label class="ms-opt"><input type="checkbox" value="' + esc(o.value) + '"> <span>' + esc(o.label) + '</span></label>').join('') : '<p class="muted pad">No hay edificios registrados todavía.</p>') + '</div>' +
      '<small class="err" data-err="' + id + '"></small></div>';
  };
  CN.bindMultiSelect = function (root, id, placeholder) {
    const box = root.querySelector('[data-ms="' + id + '"]');
    if (!box) return () => [];
    const btn = box.querySelector('.ms-btn'), panel = box.querySelector('.ms-panel'), text = box.querySelector('.ms-text');
    const vals = () => Array.from(panel.querySelectorAll('input:checked')).map((i) => i.value);
    btn.addEventListener('click', () => { panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); });
    panel.addEventListener('change', () => {
      const n = vals().length;
      text.textContent = n ? n + (n === 1 ? ' edificio seleccionado' : ' edificios seleccionados') : placeholder;
    });
    document.addEventListener('click', (e) => { if (!box.contains(e.target)) panel.hidden = true; });
    return vals;
  };

  // ---------- toasts / push ----------
  function toastHost() {
    let h = document.getElementById('toasts');
    if (!h) { h = document.createElement('div'); h.id = 'toasts'; h.setAttribute('aria-live', 'polite'); document.body.appendChild(h); }
    return h;
  }
  CN.toast = function (msg, kind, timeout) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || 'ok');
    t.innerHTML = ic(kind === 'err' ? 'alert' : kind === 'info' ? 'bell' : 'checkCircle', 20) + '<span>' + esc(msg) + '</span>';
    toastHost().appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, timeout || 3800);
  };
  CN.push = function (n) {
    const t = document.createElement('div');
    t.className = 'toast push';
    const sev = CN.SEV[n.sev];
    t.innerHTML = '<div class="push-top">' + CN.logoTile(20) + '<span>CodeNova · ahora</span><button class="push-x" aria-label="Cerrar">' + ic('x', 16) + '</button></div>' +
      '<strong>' + esc(n.title) + '</strong><p>' + esc(n.body) + '</p>' + (sev ? '<i class="push-bar" style="background:' + sev.color + '"></i>' : '');
    t.addEventListener('click', (e) => { if (e.target.closest('.push-x')) { t.remove(); return; } if (n.link) location.hash = n.link.replace('#', ''); t.remove(); });
    toastHost().appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 7000);
    try {
      const u = CN.session();
      if (u && u.prefs && u.prefs.push && window.Notification && Notification.permission === 'granted' && document.hidden) new Notification(n.title, { body: n.body });
    } catch (e) { /* sin permiso */ }
  };

  // ---------- modal ----------
  CN.modal = function (o) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><div class="modal-head"><h3>' + o.title + '</h3><button class="icon-btn" data-close aria-label="Cerrar">' + ic('x', 20) + '</button></div><div class="modal-body">' + o.html + '</div></div>';
    document.body.appendChild(wrap);
    document.body.classList.add('modal-open');
    const close = () => { wrap.remove(); document.body.classList.remove('modal-open'); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
    const first = wrap.querySelector('input,select,textarea,button:not([data-close])');
    if (first) setTimeout(() => first.focus(), 30);
    if (o.onMount) o.onMount(wrap, close);
    return { el: wrap, close };
  };
  CN.confirm = function (title, text, okLabel, onOk, danger) {
    CN.modal({
      title, html: '<p class="muted">' + text + '</p><div class="modal-actions"><button class="btn btn-outline" data-close>Cancelar</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + okLabel + '</button></div>',
      onMount: (w, close) => w.querySelector('[data-ok]').addEventListener('click', () => { close(); onOk(); }),
    });
  };

  // ---------- estrellas ----------
  CN.stars = function (n, size) { let s = ''; for (let i = 1; i <= 5; i++) s += ic('star', size || 18, i <= n ? '#F4B400' : '#CBD3D9').replace('fill="none"', 'fill="' + (i <= n ? '#F4B400' : 'none') + '"'); return '<span class="stars-static">' + s + '</span>'; };

  // ---------- gráfico de líneas (SVG) ----------
  CN.lineChart = function (points, o) {
    // points: [{ts, value}] cronológico. o: {min, max (rango esperado), unit, dec}
    const W = 720, Ht = 240, pl = 46, pr = 16, pt = 16, pb = 30;
    if (!points.length) return '<div class="chart-empty">Sin lecturas todavía. Usa “Simular lectura” para enviar datos.</div>';
    const vals = points.map((p) => p.value).concat(o.min != null ? [o.min] : [], o.max != null ? [o.max] : []);
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const nonNeg = lo >= 0;
    const padv = (hi - lo || 1) * 0.15; lo -= padv; hi += padv;
    if (nonNeg && lo < 0) lo = 0;
    const t0 = points[0].ts, t1 = points[points.length - 1].ts || t0 + 1;
    const x = (t) => pl + ((t - t0) / (t1 - t0 || 1)) * (W - pl - pr);
    const y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (Ht - pt - pb);
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) * i) / 4, yy = y(v); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="grid"/><text x="' + (pl - 8) + '" y="' + (yy + 4) + '" text-anchor="end" class="axis">' + v.toFixed(o.dec == null ? 1 : o.dec) + '</text>'; }
    const band = o.min != null && o.max != null ? '<rect x="' + pl + '" y="' + y(o.max) + '" width="' + (W - pl - pr) + '" height="' + Math.max(0, y(o.min) - y(o.max)) + '" class="band"/><text x="' + (W - pr - 4) + '" y="' + (y(o.max) - 5) + '" text-anchor="end" class="band-l">Máx. esperado ' + o.max + ' ' + o.unit + '</text>' : '';
    const line = points.map((p) => x(p.ts).toFixed(1) + ',' + y(p.value).toFixed(1)).join(' ');
    const area = pl + ',' + (Ht - pb) + ' ' + line + ' ' + x(t1).toFixed(1) + ',' + (Ht - pb);
    const last = points[points.length - 1];
    const ticks = [0, 0.5, 1].map((f) => { const t = t0 + (t1 - t0) * f; return '<text x="' + x(t).toFixed(1) + '" y="' + (Ht - 8) + '" text-anchor="' + (f === 0 ? 'start' : f === 1 ? 'end' : 'middle') + '" class="axis">' + CN.fmtTime(t) + '</text>'; }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + Ht + '" class="linechart" role="img" aria-label="Gráfico de lecturas">' + g + band + '<polygon points="' + area + '" class="area"/><polyline points="' + line + '" class="ln"/><circle cx="' + x(last.ts).toFixed(1) + '" cy="' + y(last.value).toFixed(1) + '" r="5" class="dot"/>' + ticks + '</svg>';
  };

  // ---------- utilidades ----------
  CN.delegate = (root, type, sel, fn) => root.addEventListener(type, (e) => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });
  CN.equipName = (e) => e.type + ' ' + e.code;
  CN.equipShort = (e) => ({ 'Bomba hidroneumática': 'Bomba', 'Tablero eléctrico': 'Tablero', 'Ascensor': 'Ascensor', 'Aire acondicionado': 'Aire acond.' }[e.type] || e.type) + ' ' + e.code;
  CN.techShort = (t) => { if (!t) return '—'; const p = t.name.split(' '); return p[0][0] + '. ' + p.slice(1).join(' '); };
  CN.copyText = function (text) {
    const done = () => CN.toast('Copiado: ' + text, 'info', 2200);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* noop */ } t.remove(); done(); }
  };
  // ¿el usuario administra/atiende este edificio?
  CN.canSee = (u, bid) => CN.buildingsOf(u).some((b) => b.id === bid);
  CN.downloadFile = function (name, text, mime) {
    const blob = new Blob(['﻿' + text], { type: mime || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  CN.readImage = function (file, maxDim) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const k = Math.min(1, (maxDim || 720) / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.72));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };
  CN.responsiveTable = function (heads, rows, o) {
    o = o || {};
    return '<div class="table-wrap"><table class="rtable' + (o.cls ? ' ' + o.cls : '') + '"><thead><tr>' + heads.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map((r) => '<tr' + (r.attrs ? ' ' + r.attrs : '') + (r.link ? ' data-href="' + r.link + '" tabindex="0"' : '') + '>' + r.cells.map((c, i) => '<td data-label="' + esc(heads[i].replace(/<[^>]+>/g, '')) + '">' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  };
  // filas clicables
  CN.bindRowLinks = function (root) {
    root.querySelectorAll('tr[data-href]').forEach((tr) => {
      const go = (e) => { if (e.target.closest('button,a,select,input,label')) return; location.hash = tr.dataset.href.replace('#', ''); };
      tr.addEventListener('click', go);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(e); });
    });
  };
})();
