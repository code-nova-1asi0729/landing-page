/* FleetCare app — núcleo: plantillas, utilidades, almacenamiento, UI compartida */
(function (global) {
  'use strict';

  const R = (global.FleetCare = { ui: {}, actions: {}, forms: {}, inputs: {}, changes: {} });

  /* ---------- Plantillas HTML con escape automático ---------- */
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  R.esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
  R.raw = (s) => new Raw(s);
  const rend = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(rend).join('') : v == null || v === false ? '' : R.esc(v));
  R.html = (s, ...v) => new Raw(s.reduce((a, x, i) => a + x + (i < v.length ? rend(v[i]) : ''), ''));
  R.$ = (sel, root) => (root || document).querySelector(sel);
  R.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- Utilidades ---------- */
  R.uid = (p) => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  R.clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  R.pad = (n) => String(n).padStart(2, '0');
  R.ymd = (d) => `${d.getFullYear()}-${R.pad(d.getMonth() + 1)}-${R.pad(d.getDate())}`;
  R.today = () => R.ymd(new Date());
  R.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  R.parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  R.daysBetween = (a, b) => Math.round((R.parseYmd(b) - R.parseYmd(a)) / 86400000);
  R.fmtDate = (s) => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
  R.fmtNum = (n, dec = 0) => Number(n).toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  R.money = (n) => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  R.ago = (ts) => {
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return 'Hace un momento';
    if (m < 60) return `Hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `Hace ${h} h`;
    const d = Math.round(h / 24);
    if (d < 30) return `Hace ${d} ${d === 1 ? 'día' : 'días'}`;
    const mo = Math.round(d / 30);
    return `Hace ${mo} ${mo === 1 ? 'mes' : 'meses'}`;
  };
  R.initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  R.normPlate = (p) => {
    const s = String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return s.length >= 6 ? s.slice(0, 3) + '-' + s.slice(3) : s;
  };
  R.validPlate = (p) => /^[A-Z0-9]{3}-[A-Z0-9]{3,4}$/.test(p);
  R.validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  R.download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  R.readImage = (file, max = 900, q = 0.72) => new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error('Selecciona un archivo de imagen.'));
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('No se pudo leer la imagen.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('La imagen no es válida.'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', q));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });

  // Hash de contraseña. SHA-256 cuando está disponible; es un prototipo sin backend.
  R.hash = async (text) => {
    const salted = 'fleetcare:' + text;
    if (global.crypto && global.crypto.subtle && global.TextEncoder) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < salted.length; i++) {
      const c = salted.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    return 'f' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  };

  /* ---------- Almacenamiento ---------- */
  const KEY = 'fleetcare.app.v1';
  const SKEY = 'fleetcare.session.v1';
  let state = null;

  R.state = () => state;
  R.setState = (s) => { state = s; };
  R.load = () => {
    try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; }
    if (state && state.v !== 1) state = null;
    return state;
  };
  R.save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) {
      R.toast('No se pudo guardar: el almacenamiento del navegador está lleno. Quita fotos antiguas.', 'error');
      return false;
    }
  };
  R.session = {
    get() { try { return localStorage.getItem(SKEY); } catch (e) { return null; } },
    set(id) { try { localStorage.setItem(SKEY, id); } catch (e) { /* sin persistencia */ } R._sid = id; },
    clear() { try { localStorage.removeItem(SKEY); } catch (e) { /* noop */ } R._sid = null; },
  };
  R.me = () => {
    const id = R.session.get();
    return id && state ? state.users.find((u) => u.id === id && u.active !== false) || null : null;
  };
  R.db = () => { const u = R.me(); return u ? state.companies[u.companyId] : null; };
  R.userById = (id) => state.users.find((u) => u.id === id);

  /* ---------- Iconos ---------- */
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    truck: '<path d="M1 6h13v10H1z"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="m9 14 2 2 4-4"/>',
    gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 4-5"/>',
    alert: '<path d="M12 3 22 20H2z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    fuel: '<path d="M4 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17"/><path d="M3 21h12"/><path d="M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/><path d="M7 8h4"/>',
    incident: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5h.01"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5c2.4.6 4 2.5 4 5.5"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="m16 8 4 4-4 4"/><path d="M20 12H9"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 9"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    back: '<path d="M15 6 9 12l6 6"/>',
    download: '<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    logo: '<path d="m4 12 5 6L20 5"/>',
  };
  R.ico = (n, s = 20) => R.raw(`<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`);

  /* ---------- Componentes de UI ---------- */
  const STATUS = { bueno: 'Bueno', alerta: 'Alerta', critico: 'Crítico' };
  R.statusLabel = (s) => STATUS[s] || s;
  R.pill = (cls, label) => R.html`<span class="pill pill-${cls}"><i class="dot"></i>${label}</span>`;
  R.statusPill = (s) => R.pill(s, STATUS[s]);
  const PRIO = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };
  R.prioPill = (p) => R.pill('p-' + p, PRIO[p] || p);
  const FSTATE = { pendiente: 'Pendiente', en_proceso: 'En proceso', resuelta: 'Resuelta' };
  R.faultStates = FSTATE;
  R.faultPill = (s) => R.pill('f-' + s, FSTATE[s] || s);

  R.field = ({ label, name, type = 'text', value = '', placeholder = '', attrs = {}, hint = '', options = null, rows = 3 }) => {
    const id = 'f-' + name + '-' + Math.random().toString(36).slice(2, 5);
    const at = Object.entries(attrs).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${R.esc(v)}"`)).join('');
    let control;
    if (options) {
      control = R.html`<select id="${id}" name="${name}"${R.raw(at)}>${options.map((o) => R.html`<option value="${o.value}" ${String(o.value) === String(value) ? R.raw('selected') : ''}>${o.label}</option>`)}</select>`;
    } else if (type === 'textarea') {
      control = R.html`<textarea id="${id}" name="${name}" rows="${rows}" placeholder="${placeholder}"${R.raw(at)}>${value}</textarea>`;
    } else {
      control = R.html`<input id="${id}" name="${name}" type="${type}" value="${value}" placeholder="${placeholder}"${R.raw(at)}>`;
    }
    return R.html`<div class="field"><label for="${id}">${label}</label>${control}${hint ? R.html`<span class="hint">${hint}</span>` : ''}<span class="field-error" data-err="${name}" role="alert"></span></div>`;
  };

  R.formData = (form) => {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
    return o;
  };
  R.setErrors = (form, errs) => {
    R.$$('.field', form).forEach((f) => f.classList.remove('has-error'));
    R.$$('[data-err]', form).forEach((e) => { e.textContent = ''; });
    const names = Object.keys(errs || {});
    names.forEach((n) => {
      const e = R.$(`[data-err="${n}"]`, form);
      if (e) { e.textContent = errs[n]; e.closest('.field') && e.closest('.field').classList.add('has-error'); }
    });
    if (names.length) {
      const first = form.elements[names[0]];
      if (first && first.focus) first.focus();
    }
    return names.length > 0;
  };

  R.empty = (title, text, action) => R.html`<div class="empty"><div class="empty-ico">${R.ico('search', 26)}</div><h3>${title}</h3>${text ? R.html`<p>${text}</p>` : ''}${action || ''}</div>`;

  /* ---------- Toasts ---------- */
  R.toast = (msg, type = 'ok', title) => {
    const root = R.$('#toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const icon = type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'check';
    el.innerHTML = `<span class="toast-ico">${R.ico(icon, 16).s}</span><div><strong>${R.esc(title || (type === 'error' ? 'Error' : type === 'warn' ? 'Atención' : 'Listo'))}</strong><p>${R.esc(msg)}</p></div><button class="toast-x" aria-label="Cerrar">${R.ico('x', 14).s}</button>`;
    root.appendChild(el);
    while (root.children.length > 4) root.firstChild.remove();
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    el.querySelector('.toast-x').onclick = kill;
    setTimeout(kill, type === 'error' ? 7000 : 4800);
  };

  /* ---------- Modales ---------- */
  let modalResolve = null;
  let lastFocus = null;
  R.modal = (content, opts = {}) => {
    const root = R.$('#modal-root');
    lastFocus = document.activeElement;
    root.innerHTML = `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal ${opts.wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${content.s}</div></div>`;
    document.body.classList.add('modal-open');
    const f = R.$('.modal input:not([type=hidden]), .modal select, .modal textarea', root) || R.$('.modal .btn-primary, .modal .btn-danger', root);
    if (f) f.focus();
  };
  R.closeModal = (result) => {
    R.$('#modal-root').innerHTML = '';
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* noop */ } }
    const r = modalResolve; modalResolve = null;
    if (r) r(!!result);
  };
  R.confirm = ({ title, text, confirm = 'Confirmar', cancel = 'Cancelar', danger = false }) => new Promise((resolve) => {
    modalResolve = resolve;
    R.modal(R.html`<h3 id="modal-title">${title}</h3><p class="modal-text">${text}</p><div class="modal-actions"><button type="button" class="btn btn-outline" data-action="modal-cancel">${cancel}</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="modal-ok">${confirm}</button></div>`);
  });
  R.actions['modal-ok'] = () => R.closeModal(true);
  R.actions['modal-cancel'] = () => R.closeModal(false);
  R.actions['modal-close'] = () => R.closeModal(false);
  R.actions['modal-backdrop'] = (el, ev) => { if (ev.target === el) R.closeModal(false); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && R.$('#modal-root .modal')) R.closeModal(false); });
})(window);
