/* CodeNova — núcleo: datos, motor de alertas, notificaciones.
   Sin backend: todo se guarda en localStorage (con respaldo en memoria). */
(function () {
  'use strict';
  const CN = (window.CN = {});
  const M = 60e3, H = 3600e3, D = 24 * H;
  CN.M = M; CN.H = H; CN.D = D;

  const DB_KEY = 'codenova_db_v1';
  const SES_KEY = 'codenova_session_v1';
  CN.DEMO_KEY = 'codenova_demo_requests_v1';
  const DB_VERSION = 3;

  let db = null;
  const mem = {}; // respaldo si localStorage está bloqueado
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } },
  };
  CN.store = store;

  // ---------- eventos simples ----------
  const handlers = {};
  CN.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
  CN.emit = (ev, data) => (handlers[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });

  CN.uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  CN.now = () => Date.now();

  // ---------- catálogos ----------
  CN.EQUIP_TYPES = ['Bomba hidroneumática', 'Tablero eléctrico', 'Ascensor', 'Aire acondicionado'];
  CN.TYPE_VARS = {
    'Bomba hidroneumática': ['vibracion', 'temperatura', 'consumo'],
    'Tablero eléctrico': ['consumo', 'temperatura'],
    'Ascensor': ['temperatura', 'vibracion'],
    'Aire acondicionado': ['consumo', 'temperatura'],
  };
  CN.VARS = {
    vibracion: { label: 'Vibración', unit: 'mm/s', dec: 1 },
    temperatura: { label: 'Temperatura', unit: '°C', dec: 0 },
    consumo: { label: 'Consumo eléctrico', unit: 'A', dec: 1 },
  };
  const BASE = {
    'Bomba hidroneumática': { vibracion: 2.1, temperatura: 58, consumo: 10.2 },
    'Tablero eléctrico': { consumo: 12, temperatura: 42 },
    'Ascensor': { temperatura: 48, vibracion: 1.1 },
    'Aire acondicionado': { consumo: 7, temperatura: 24 },
  };
  CN.SEV = {
    normal: { label: 'Normal', rank: 0, color: '#2E9E6D', text: '#2E9E6D', bg: '#E6F4EC' },
    baja: { label: 'Baja', rank: 1, color: '#F4B400', text: '#8A6100', bg: '#FFF4D6' },
    media: { label: 'Media', rank: 2, color: '#F2994A', text: '#8A6100', bg: '#FDF0E0' },
    alta: { label: 'Alta', rank: 3, color: '#E8590C', text: '#B34700', bg: '#FDE9DC' },
    critica: { label: 'Crítica', rank: 4, color: '#E53935', text: '#E53935', bg: '#FDEBEA' },
    sin_datos: { label: 'Sin datos', rank: 3, color: '#E53935', text: '#E53935', bg: '#FDEBEA' },
  };
  CN.sevRank = (s) => (CN.SEV[s] ? CN.SEV[s].rank : 0);
  CN.ALERT_STATUS = { nueva: 'Nueva', en_gestion: 'En gestión', resuelta: 'Resuelta' };
  CN.INC_STATUS = { reportado: 'Reportado', en_gestion: 'En gestión', resuelto: 'Resuelto' };
  CN.VISIT_STATUS = {
    propuesta: 'Propuesta',
    contrapropuesta: 'Nueva fecha propuesta',
    confirmada: 'Confirmada',
    realizada: 'Realizada',
    cancelada: 'Cancelada',
  };
  CN.INCIDENT_TYPES = [
    { v: 'Fuga de agua', type: 'Bomba hidroneumática' },
    { v: 'Ascensor con ruido', type: 'Ascensor' },
    { v: 'Falla eléctrica', type: 'Tablero eléctrico' },
    { v: 'Aire acondicionado', type: 'Aire acondicionado' },
    { v: 'Otro', type: null },
  ];
  const SAVING_BY_TYPE = { 'Bomba hidroneumática': 1200, 'Tablero eléctrico': 800, 'Ascensor': 1500, 'Aire acondicionado': 500 };

  // ---------- semilla (datos demo) ----------
  function at(days, h, mi) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(h, mi || 0, 0, 0);
    return d.getTime();
  }

  function seed() {
    const now = Date.now();
    const s = {
      v: DB_VERSION,
      users: [], buildings: [], equipment: [], sensors: [], readings: [], alerts: [],
      incidents: [], visits: [], companies: [], technicians: [], notifications: [], resets: [],
      ranges: [
        { id: 'r1', type: 'Bomba hidroneumática', variable: 'vibracion', label: 'Vibración', min: 0.5, max: 4.0 },
        { id: 'r2', type: 'Bomba hidroneumática', variable: 'temperatura', label: 'Temperatura', min: 20, max: 70 },
        { id: 'r3', type: 'Bomba hidroneumática', variable: 'consumo', label: 'Consumo eléctrico', min: 5, max: 12 },
        { id: 'r4', type: 'Tablero eléctrico', variable: 'consumo', label: 'Consumo eléctrico', min: 5, max: 18 },
        { id: 'r5', type: 'Tablero eléctrico', variable: 'temperatura', label: 'Temperatura', min: 10, max: 60 },
        { id: 'r6', type: 'Ascensor', variable: 'temperatura', label: 'Temperatura motor', min: 20, max: 65 },
        { id: 'r7', type: 'Ascensor', variable: 'vibracion', label: 'Vibración', min: 0.2, max: 3.0 },
        { id: 'r8', type: 'Aire acondicionado', variable: 'consumo', label: 'Consumo eléctrico', min: 3, max: 12 },
        { id: 'r9', type: 'Aire acondicionado', variable: 'temperatura', label: 'Temperatura', min: 5, max: 45 },
      ],
      savingsBase: { b1: 4200, b2: 1850, b3: 900 },
    };

    s.companies = [
      { id: 'c1', name: 'Hernando Diaz E.I.R.L.', ruc: '20601234567', email: 'contacto@hernandodiaz.pe', baseVisits: 18, baseAvg: 3.2, hours: [] },
      { id: 'c2', name: 'Servicios Renzo SAC', ruc: '20607654321', email: 'ventas@serviciosrenzo.pe', baseVisits: 11, baseAvg: 5.8, hours: [] },
    ];
    s.users = [
      { id: 'u_admin', role: 'admin', name: 'Ana Torres', email: 'admin@demo.pe', password: 'demo1234', phone: '987 654 321', prefs: { push: true, email: true }, onboardingDone: true },
      { id: 'u_res', role: 'resident', name: 'Luis Paredes', email: 'residente@demo.pe', password: 'demo1234', phone: '955 111 222', buildingId: 'b1', unit: '502', prefs: { push: true, email: false } },
      { id: 'u_comp', role: 'company', name: 'Hernando Díaz', email: 'empresa@demo.pe', password: 'demo1234', phone: '944 333 444', companyId: 'c1', prefs: { push: true, email: true } },
      { id: 'u_root', role: 'platform', name: 'Admin Plataforma', email: 'plataforma@demo.pe', password: 'demo1234', phone: '', prefs: { push: true, email: true } },
    ];
    s.buildings = [
      { id: 'b1', name: 'San Felipe 240', address: 'Av. San Felipe 240', district: 'San Isidro', units: 60, code: 'SF240', adminId: 'u_admin', companyIds: ['c1'], thresholds: { baja: 3.0, media: 4.0, critica: 5.5 }, createdAt: now - 300 * D },
      { id: 'b2', name: 'Los Álamos', address: 'Calle Los Álamos 118', district: 'Miraflores', units: 48, code: 'LA118', adminId: 'u_admin', companyIds: ['c1', 'c2'], thresholds: { baja: 3.0, media: 4.0, critica: 5.5 }, createdAt: now - 250 * D },
      { id: 'b3', name: 'Vista Mar', address: 'Jr. Vista Mar 300', district: 'San Isidro', units: 80, code: 'VM300', adminId: 'u_admin', companyIds: ['c1'], thresholds: { baja: 3.0, media: 4.0, critica: 5.5 }, createdAt: now - 200 * D },
    ];
    s.technicians = [
      { id: 't1', companyId: 'c1', name: 'Renzo Farfán', specialty: 'Electricidad industrial', email: 'rfarfan@hernandodiaz.pe' },
      { id: 't2', companyId: 'c1', name: 'Julio Quispe', specialty: 'Bombas hidroneumáticas', email: 'jquispe@hernandodiaz.pe' },
      { id: 't3', companyId: 'c2', name: 'Carlos Rojas', specialty: 'Ascensores', email: 'crojas@serviciosrenzo.pe' },
    ];

    // Equipos: San Felipe 240 (13 equipos, 12 con sensor)
    const eq = (id, b, type, loc, code) => ({ id, buildingId: b, type, location: loc, code, active: true, createdAt: now - 280 * D });
    s.equipment = [
      eq('e1', 'b1', 'Bomba hidroneumática', 'Sótano 1', 'B-01'),
      eq('e2', 'b1', 'Tablero eléctrico', 'Azotea', 'T-02'),
      eq('e3', 'b1', 'Ascensor', 'Hall principal', 'A-01'),
      eq('e4', 'b1', 'Aire acondicionado', 'Piso 5', 'AC-03'),
      eq('e5', 'b1', 'Bomba hidroneumática', 'Sótano 2', 'B-02'),
      eq('e6', 'b1', 'Bomba hidroneumática', 'Azotea', 'B-03'),
      eq('e7', 'b1', 'Tablero eléctrico', 'Sótano 1', 'T-01'),
      eq('e8', 'b1', 'Tablero eléctrico', 'Piso 3', 'T-03'),
      eq('e9', 'b1', 'Tablero eléctrico', 'Piso 8', 'T-05'),
      eq('e10', 'b1', 'Ascensor', 'Torre B', 'A-02'),
      eq('e11', 'b1', 'Ascensor', 'Servicio', 'A-03'),
      eq('e12', 'b1', 'Aire acondicionado', 'Piso 1', 'AC-01'),
      eq('e13', 'b1', 'Aire acondicionado', 'Piso 3', 'AC-02'),
      eq('e14', 'b2', 'Tablero eléctrico', 'Sótano', 'T-04'),
      eq('e15', 'b2', 'Bomba hidroneumática', 'Cisterna', 'B-01'),
      eq('e16', 'b3', 'Ascensor', 'Torre norte', 'A-02'),
      eq('e17', 'b3', 'Bomba hidroneumática', 'Sótano 1', 'B-01'),
    ];
    let n = 1000;
    const sensor = (equipId, extra) => s.sensors.push(Object.assign({ id: 'SN-' + (n++), equipmentId: equipId, createdAt: now - 200 * D, lastReadingAt: now - 4 * M, offline: false }, extra || {}));
    s.equipment.forEach((e) => { if (e.id !== 'e4') sensor(e.id); });
    sensor('e3'); // A-01 con 2 sensores

    // Lecturas destacadas: escalada de vibración en la bomba B-01
    const rd = (equipId, variable, value, ts) => s.readings.push({ id: CN.uid('rd'), equipId, variable, value, ts });
    rd('e1', 'vibracion', 3.5, now - 270 * M);
    rd('e1', 'vibracion', 5.1, now - 120 * M);
    rd('e1', 'vibracion', 6.2, now - 10 * M);
    rd('e2', 'consumo', 20.5, now - 3 * H);
    rd('e3', 'temperatura', 67, now - 20 * H);
    rd('e14', 'consumo', 20.2, now - 5 * H);

    const al = (id, b, equipId, sev, variable, created, msg, hist, status) => s.alerts.push({
      id, buildingId: b, equipId, kind: 'lectura', variable, severity: sev, status: status || 'nueva',
      createdAt: created, updatedAt: hist[hist.length - 1].ts, message: msg, history: hist, notifiedCompany: sev === 'critica' || sev === 'alta',
    });
    al('a1', 'b1', 'e1', 'critica', 'vibracion', now - 10 * M,
      'Lectura de vibración (6.2 mm/s) superó el umbral crítico configurado (5.5 mm/s).',
      [{ ts: now - 270 * M, value: 3.5, severity: 'baja' }, { ts: now - 120 * M, value: 5.1, severity: 'alta' }, { ts: now - 10 * M, value: 6.2, severity: 'critica' }]);
    al('a2', 'b1', 'e2', 'media', 'consumo', now - 3 * H,
      'Lectura de consumo eléctrico (20.5 A) fuera del rango esperado (5–18 A).',
      [{ ts: now - 3 * H, value: 20.5, severity: 'media' }]);
    al('a3', 'b1', 'e3', 'baja', 'temperatura', now - 20 * H,
      'Lectura de temperatura motor (67 °C) fuera del rango esperado (20–65 °C).',
      [{ ts: now - 20 * H, value: 67, severity: 'baja' }]);
    al('a4', 'b2', 'e14', 'media', 'consumo', now - 5 * H,
      'Lectura de consumo eléctrico (20.2 A) fuera del rango esperado (5–18 A).',
      [{ ts: now - 5 * H, value: 20.2, severity: 'media' }]);

    // Incidentes
    s.incidents = [
      { id: 'i1', buildingId: 'b1', unit: '502', residentId: 'u_res', type: 'Fuga de agua', title: 'Fuga de agua - Piso 5', description: 'Hay agua filtrándose desde el techo del baño principal.', photo: null, status: 'en_gestion', createdAt: now - 2 * D, visitId: null, rating: null, history: [{ ts: now - 2 * D, status: 'reportado' }, { ts: now - 1.5 * D, status: 'en_gestion' }] },
      { id: 'i2', buildingId: 'b1', unit: '502', residentId: 'u_res', type: 'Ascensor con ruido', title: 'Ascensor con ruido - Piso 5', description: 'El ascensor principal hace un ruido metálico al subir.', photo: null, status: 'resuelto', createdAt: now - 7 * D, visitId: null, rating: null, history: [{ ts: now - 7 * D, status: 'reportado' }, { ts: now - 6 * D, status: 'en_gestion' }, { ts: now - 5 * D, status: 'resuelto' }] },
    ];

    // Visitas
    const hist = (id, b, equipId, tech, date, desc, mats, comp) => s.visits.push({
      id, buildingId: b, equipId, companyId: comp || 'c1', techId: tech, date, status: 'realizada', type: 'preventiva',
      incidentIds: [], alertId: null, createdAt: date - 3 * D, notes: '', cancelReason: '', saving: 0,
      intervention: { desc, materials: mats, ts: date + 2 * H, by: tech },
    });
    hist('vh1', 'b1', 'e1', 't1', new Date(2026, 6, 10, 10, 0).getTime(), 'Cambio de rodamiento', 'Rodamiento 6205, grasa industrial');
    hist('vh2', 'b1', 'e1', 't1', new Date(2026, 3, 2, 10, 0).getTime(), 'Lubricación preventiva', 'Grasa multipropósito');
    hist('vh3', 'b1', 'e1', 't2', new Date(2026, 0, 15, 9, 0).getTime(), 'Revisión de consumo eléctrico', '—');
    hist('vh4', 'b1', 'e2', 't1', new Date(2026, 4, 22, 11, 0).getTime(), 'Revisión de consumo', 'Ajuste de borneras');
    const nextHour = Math.ceil((now + 3 * H) / H) * H;
    s.visits.push(
      { id: 'v1', buildingId: 'b1', equipId: 'e1', companyId: 'c1', techId: null, date: nextHour, status: 'propuesta', type: 'correctiva', incidentIds: [], alertId: 'a1', createdAt: now - 8 * M, notes: 'Vibración crítica detectada.', cancelReason: '', intervention: null, saving: 0 },
      { id: 'v2', buildingId: 'b2', equipId: 'e14', companyId: 'c1', techId: 't1', date: at(1, 9, 0), status: 'confirmada', type: 'correctiva', incidentIds: [], alertId: 'a4', createdAt: now - 4 * H, notes: '', cancelReason: '', intervention: null, saving: 0 },
      { id: 'v3', buildingId: 'b3', equipId: 'e16', companyId: 'c1', techId: null, date: at(3, 15, 0), status: 'propuesta', type: 'preventiva', incidentIds: [], alertId: null, createdAt: now - 1 * D, notes: 'Mantenimiento trimestral.', cancelReason: '', intervention: null, saving: 0 },
    );
    s.incidents[0].visitId = null;

    s.notifications = [
      { id: CN.uid('n'), userId: 'u_admin', title: 'Alerta crítica en San Felipe 240', body: 'Bomba hidroneumática B-01 requiere atención inmediata.', ts: now - 10 * M, read: false, kind: 'push', sev: 'critica', link: '#/alerts/a1' },
      { id: CN.uid('n'), userId: 'u_comp', title: 'Nueva alerta priorizada', body: 'Bomba hidroneumática B-01 · San Felipe 240. Vibración fuera de rango.', ts: now - 10 * M, read: false, kind: 'push', sev: 'critica', link: '#/week' },
      { id: CN.uid('n'), userId: 'u_res', title: 'Tu solicitud fue actualizada', body: '"Ascensor con ruido - Piso 5" ahora está Resuelto', ts: now - 5 * D, read: false, kind: 'incident', link: '#/requests' },
    ];
    return s;
  }

  // ---------- persistencia ----------
  CN.load = function () {
    if (db) return db;
    try {
      const raw = store.get(DB_KEY);
      if (raw) { const parsed = JSON.parse(raw); if (parsed && parsed.v === DB_VERSION) { db = parsed; return db; } }
    } catch (e) { /* datos corruptos: se reinicia */ }
    db = seed();
    CN.save();
    return db;
  };
  CN.save = function () {
    try { store.set(DB_KEY, JSON.stringify(db)); }
    catch (e) { CN.emit('storage-error', e); }
  };
  CN.db = () => db;
  CN.resetDemo = function () { store.del(DB_KEY); store.del(SES_KEY); db = null; CN.load(); };

  // ---------- sesión ----------
  CN.session = function () {
    const id = store.get(SES_KEY);
    return id ? db.users.find((u) => u.id === id) || null : null;
  };
  CN.login = (user) => store.set(SES_KEY, user.id);
  CN.logout = () => store.del(SES_KEY);

  // ---------- consultas ----------
  const find = (list, id) => db[list].find((x) => x.id === id);
  CN.building = (id) => find('buildings', id);
  CN.equip = (id) => find('equipment', id);
  CN.alert = (id) => find('alerts', id);
  CN.visit = (id) => find('visits', id);
  CN.incident = (id) => find('incidents', id);
  CN.company = (id) => find('companies', id);
  CN.tech = (id) => find('technicians', id);
  CN.userById = (id) => find('users', id);

  CN.buildingsOf = function (u) {
    if (!u) return [];
    if (u.role === 'admin') return db.buildings.filter((b) => b.adminId === u.id);
    if (u.role === 'company') return db.buildings.filter((b) => (b.companyIds || []).includes(u.companyId));
    if (u.role === 'resident') return db.buildings.filter((b) => b.id === u.buildingId);
    return db.buildings.slice();
  };
  CN.equipmentOf = (bid, includeInactive) => db.equipment.filter((e) => e.buildingId === bid && (includeInactive || e.active));
  CN.sensorsOf = (eid) => db.sensors.filter((s) => s.equipmentId === eid);
  CN.activeAlerts = (ids) => db.alerts.filter((a) => a.status !== 'resuelta' && (!ids || ids.includes(a.buildingId)));
  CN.activeAlertFor = (eid, kind) => db.alerts.find((a) => a.equipId === eid && a.status !== 'resuelta' && (!kind || a.kind === kind));
  CN.monitoredCount = (bid) => CN.equipmentOf(bid).filter((e) => CN.sensorsOf(e.id).length > 0).length;
  CN.companyUsers = (companyId) => db.users.filter((u) => u.role === 'company' && u.companyId === companyId);
  CN.buildingSavings = function (bid) {
    const base = (db.savingsBase && db.savingsBase[bid]) || 0;
    return base + db.visits.filter((v) => v.buildingId === bid && v.saving).reduce((a, v) => a + v.saving, 0);
  };
  CN.equipStatus = function (e) {
    if (!e.active) return 'baja_equipo';
    const a = CN.activeAlertFor(e.id);
    if (a) return a.severity;
    if (CN.sensorsOf(e.id).length === 0) return 'sin_sensor';
    return 'normal';
  };
  CN.userLabel = (u) => ({ admin: 'Administrador', resident: 'Residente', company: 'Empresa de mantenimiento', platform: 'Administrador de plataforma' }[u.role]);
  CN.initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  CN.buildingCode = function (name) {
    const base = (name || 'ED').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    const letters = base.split(/[^A-Z0-9]+/).filter(Boolean).map((w) => (/^\d+$/.test(w) ? w : w[0])).join('').slice(0, 6) || 'ED';
    let code = letters, i = 1;
    while (db.buildings.some((b) => b.code === code)) code = letters + (++i);
    return code;
  };

  // ---------- lecturas (generadas de forma determinista + guardadas) ----------
  function hash01(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const round = (v, variable) => { const d = CN.VARS[variable].dec; const f = Math.pow(10, d); return Math.round(v * f) / f; };
  CN.baseValue = (e, variable) => (BASE[e.type][variable] || 10) * (0.92 + hash01(e.id + variable) * 0.16);
  CN.genValue = (e, variable, hourIdx) => round(CN.baseValue(e, variable) * (1 + (hash01(e.id + variable + hourIdx) - 0.5) * 0.12), variable);
  CN.range = (type, variable) => db.ranges.find((r) => r.type === type && r.variable === variable);
  CN.varLabel = (type, variable) => { const r = CN.range(type, variable); return r ? r.label : CN.VARS[variable].label; };
  CN.fmtVal = (v, variable) => v + ' ' + CN.VARS[variable].unit;

  CN.severityFor = function (building, type, variable, value) {
    const r = CN.range(type, variable);
    if (!r) return 'normal';
    if (variable === 'vibracion') {
      const t = building.thresholds;
      if (value >= t.critica) return 'critica';
      if (value >= (t.media + t.critica) / 2) return 'alta';
      if (value >= t.media) return 'media';
      if (value >= t.baja) return 'baja';
      return 'normal';
    }
    const dev = value > r.max ? (value - r.max) / r.max : value < r.min ? (r.min - value) / r.min : 0;
    if (dev <= 0) return 'normal';
    if (dev >= 0.4) return 'critica';
    if (dev >= 0.25) return 'alta';
    if (dev >= 0.1) return 'media';
    return 'baja';
  };
  CN.alertMessage = function (b, e, variable, value, sev) {
    const r = CN.range(e.type, variable);
    const label = r.label.toLowerCase();
    if (variable === 'vibracion') {
      const t = b.thresholds;
      const thr = { baja: t.baja, media: t.media, alta: (t.media + t.critica) / 2, critica: t.critica }[sev];
      return 'Lectura de ' + label + ' (' + CN.fmtVal(value, variable) + ') superó el umbral ' + CN.SEV[sev].label.toLowerCase() + ' configurado (' + CN.fmtVal(thr, variable) + ').';
    }
    return 'Lectura de ' + label + ' (' + CN.fmtVal(value, variable) + ') fuera del rango esperado (' + r.min + '–' + r.max + ' ' + CN.VARS[variable].unit + ').';
  };

  // Lecturas de un equipo (más recientes primero).
  CN.readingsFor = function (e, days, onlyVar) {
    const sensors = CN.sensorsOf(e.id);
    const out = [];
    const now = Date.now();
    if (sensors.length) {
      const start = Math.max(Math.min.apply(null, sensors.map((s) => s.createdAt)), now - days * D);
      const end = Math.min(now, Math.max.apply(null, sensors.map((s) => s.lastReadingAt || 0)));
      const vars = onlyVar ? [onlyVar] : CN.TYPE_VARS[e.type];
      for (let h = Math.floor(end / H); h * H >= start - H; h--) {
        vars.forEach((v) => {
          const ts = h * H + Math.floor(hash01(e.id + v + 'm' + h) * 55) * M;
          if (ts > end || ts < start) return;
          out.push({ ts, variable: v, value: CN.genValue(e, v, h), gen: true });
        });
      }
    }
    db.readings.filter((r) => r.equipId === e.id && r.ts >= now - days * D && (!onlyVar || r.variable === onlyVar))
      .forEach((r) => out.push({ ts: r.ts, variable: r.variable, value: r.value, gen: false }));
    out.sort((a, b) => b.ts - a.ts);
    return out;
  };
  CN.latestReading = (e, variable) => CN.readingsFor(e, 3, variable)[0] || null;
  CN.readingStatus = (e, r) => CN.severityFor(CN.building(e.buildingId), e.type, r.variable, r.value);

  // ---------- notificaciones ----------
  CN.notify = function (userId, n) {
    const rec = Object.assign({ id: CN.uid('n'), userId, ts: Date.now(), read: false, kind: 'info' }, n);
    db.notifications.unshift(rec);
    if (db.notifications.length > 200) db.notifications.length = 200;
    CN.save();
    CN.emit('notify', rec);
    return rec;
  };
  CN.notifsOf = (uid) => db.notifications.filter((n) => n.userId === uid);
  CN.unread = (uid) => CN.notifsOf(uid).filter((n) => !n.read).length;

  function notifyAlert(a, escalated) {
    const b = CN.building(a.buildingId), e = CN.equip(a.equipId);
    const name = e.type + ' ' + e.code;
    const sevL = CN.SEV[a.severity].label;
    if (b.adminId) {
      const admin = CN.userById(b.adminId);
      const push = a.severity === 'critica' || a.severity === 'sin_datos';
      CN.notify(b.adminId, {
        title: push ? 'Alerta ' + sevL.toLowerCase() + ' en ' + b.name : (escalated ? 'Alerta actualizada' : 'Nueva alerta') + ' · ' + sevL,
        body: name + (push ? ' requiere atención inmediata.' : ' · ' + b.name), kind: push && admin.prefs.push ? 'push' : 'alert', sev: a.severity, link: '#/alerts/' + a.id,
      });
    }
    if (a.severity === 'alta' || a.severity === 'critica') notifyCompanies(b, a, name);
  }
  function notifyCompanies(b, a, name) {
    (b.companyIds || []).forEach((cid) => {
      CN.companyUsers(cid).forEach((u) => CN.notify(u.id, {
        title: 'Nueva alerta priorizada', body: name + ' · ' + b.name + '. ' + (a.kind === 'sin_datos' ? 'Sin lecturas del sensor.' : 'Vibración o consumo fuera de rango.'),
        kind: 'push', sev: a.severity, link: '#/week',
      }));
    });
    a.notifiedCompany = true;
  }
  CN.notifyCompaniesOfAlert = function (a) {
    const b = CN.building(a.buildingId), e = CN.equip(a.equipId);
    notifyCompanies(b, a, e.type + ' ' + e.code); CN.save();
  };

  // ---------- motor de alertas (US12, US17, US18) ----------
  CN.ingestReading = function (equipId, variable, value, ts) {
    const e = CN.equip(equipId);
    if (!e || !e.active) return { error: 'El equipo está dado de baja.' };
    const sensors = CN.sensorsOf(e.id);
    if (!sensors.length) return { error: 'El equipo no tiene sensores asociados.' };
    ts = ts || Date.now();
    const b = CN.building(e.buildingId);
    db.readings.push({ id: CN.uid('rd'), equipId, variable, value, ts });
    sensors.forEach((s) => { s.lastReadingAt = ts; s.offline = false; });
    // Un sensor que vuelve a reportar cierra la alerta "sin datos".
    db.alerts.filter((a) => a.equipId === e.id && a.kind === 'sin_datos' && a.status !== 'resuelta').forEach((a) => { a.status = 'resuelta'; a.updatedAt = ts; });
    const sev = CN.severityFor(b, e.type, variable, value);
    if (sev === 'normal') { CN.save(); return { severity: 'normal' }; }
    let a = db.alerts.find((x) => x.equipId === e.id && x.kind === 'lectura' && x.status !== 'resuelta');
    if (a) {
      a.history.push({ ts, value, severity: sev });
      a.updatedAt = ts;
      if (CN.sevRank(sev) > CN.sevRank(a.severity)) {
        a.severity = sev; a.variable = variable; a.message = CN.alertMessage(b, e, variable, value, sev);
        CN.save(); notifyAlert(a, true);
        return { severity: sev, alert: a, updated: true };
      }
      CN.save();
      return { severity: sev, alert: a, updated: false };
    }
    a = { id: CN.uid('a'), buildingId: b.id, equipId: e.id, kind: 'lectura', variable, severity: sev, status: 'nueva', createdAt: ts, updatedAt: ts, message: CN.alertMessage(b, e, variable, value, sev), history: [{ ts, value, severity: sev }], notifiedCompany: false };
    db.alerts.unshift(a);
    CN.save(); notifyAlert(a, false);
    return { severity: sev, alert: a, created: true };
  };

  // Sensor desconectado (US13): sin lecturas por más de 24 h.
  CN.checkSensors = function () {
    const now = Date.now();
    let changed = false;
    db.sensors.forEach((s) => {
      const e = CN.equip(s.equipmentId);
      if (!e || !e.active) return;
      if (now - s.lastReadingAt > 24 * H) {
        if (!s.offline) { s.offline = true; changed = true; }
        const ex = db.alerts.find((a) => a.equipId === e.id && a.kind === 'sin_datos' && a.status !== 'resuelta');
        if (!ex) {
          const a = { id: CN.uid('a'), buildingId: e.buildingId, equipId: e.id, kind: 'sin_datos', variable: null, severity: 'sin_datos', status: 'nueva', createdAt: now, updatedAt: now, sensorId: s.id, message: '', history: [], notifiedCompany: false };
          db.alerts.unshift(a); changed = true;
          notifyAlert(a, false);
        }
      }
    });
    if (changed) CN.save();
  };
  CN.hoursWithoutData = (a) => {
    const s = db.sensors.find((x) => x.id === a.sensorId) || CN.sensorsOf(a.equipId)[0];
    return s ? Math.max(1, Math.round((Date.now() - s.lastReadingAt) / H)) : 0;
  };
  CN.simulateDisconnect = function (sensorId) {
    const s = db.sensors.find((x) => x.id === sensorId);
    if (!s) return;
    s.lastReadingAt = Date.now() - 26 * H;
    CN.save(); CN.checkSensors();
  };

  CN.setAlertStatus = function (a, status) {
    a.status = status; a.updatedAt = Date.now(); CN.save();
  };

  // ---------- altas de entidades ----------
  CN.addBuilding = function (admin, data) {
    const b = { id: CN.uid('b'), name: data.name.trim(), address: data.address.trim(), district: (data.district || '').trim(), units: parseInt(data.units, 10) || 0, code: CN.buildingCode(data.name), adminId: admin.id, companyIds: [], thresholds: { baja: 3.0, media: 4.0, critica: 5.5 }, createdAt: Date.now() };
    db.buildings.push(b); db.savingsBase[b.id] = 0; CN.save(); return b;
  };
  CN.addEquipment = function (bid, data) {
    const e = { id: CN.uid('e'), buildingId: bid, type: data.type, location: data.location.trim(), code: data.code.trim().toUpperCase(), active: true, createdAt: Date.now() };
    db.equipment.push(e); CN.save(); return e;
  };
  CN.addSensor = function (equipId, sid) {
    const s = { id: sid.trim().toUpperCase(), equipmentId: equipId, createdAt: Date.now(), lastReadingAt: Date.now(), offline: false };
    db.sensors.push(s); CN.save(); return s;
  };

  // ---------- visitas ----------
  CN.scheduleVisit = function (data) {
    const admin = CN.userById(CN.building(data.buildingId).adminId);
    const v = { id: CN.uid('v'), buildingId: data.buildingId, equipId: data.equipId, companyId: data.companyId, techId: null, date: data.date, status: 'propuesta', type: data.type || 'preventiva', incidentIds: data.incidentIds || [], alertId: data.alertId || null, createdAt: Date.now(), notes: data.notes || '', cancelReason: '', intervention: null, saving: 0 };
    db.visits.unshift(v); CN.save();
    const b = CN.building(v.buildingId), e = CN.equip(v.equipId);
    CN.companyUsers(v.companyId).forEach((u) => CN.notify(u.id, { title: 'Nueva visita propuesta', body: e.type + ' ' + e.code + ' · ' + b.name + ' · ' + CN.fmtDateTime(v.date), kind: 'visit', link: '#/visits/' + v.id }));
    return v;
  };
  CN.confirmVisit = function (v) {
    v.status = 'confirmada'; CN.save();
    const b = CN.building(v.buildingId), e = CN.equip(v.equipId);
    if (b.adminId) CN.notify(b.adminId, { title: 'Visita confirmada', body: e.type + ' ' + e.code + ' · ' + CN.fmtDateTime(v.date), kind: 'visit', link: '#/visits/' + v.id });
  };
  CN.counterPropose = function (v, date) {
    v.date = date; v.status = 'contrapropuesta'; CN.save();
    const b = CN.building(v.buildingId), e = CN.equip(v.equipId);
    if (b.adminId) CN.notify(b.adminId, { title: 'La empresa propuso otra fecha', body: e.type + ' ' + e.code + ' · ' + CN.fmtDateTime(date), kind: 'visit', link: '#/visits/' + v.id });
  };
  CN.cancelVisit = function (v, reason) {
    v.status = 'cancelada'; v.cancelReason = reason; CN.save();
    const b = CN.building(v.buildingId), e = CN.equip(v.equipId);
    CN.companyUsers(v.companyId).forEach((u) => CN.notify(u.id, { title: 'Visita cancelada', body: e.type + ' ' + e.code + ' · ' + b.name + '. Motivo: ' + reason, kind: 'visit', link: '#/visits/' + v.id }));
    v.incidentIds.forEach((iid) => { const i = CN.incident(iid); if (i && i.status !== 'resuelto') i.visitId = null; });
    CN.save();
  };
  CN.assignTech = function (v, techId) { v.techId = techId; CN.save(); };

  CN.registerIntervention = function (v, desc, materials) {
    const now = Date.now();
    v.status = 'realizada';
    v.intervention = { desc, materials: materials || '—', ts: now, by: v.techId };
    const e = CN.equip(v.equipId), b = CN.building(v.buildingId);
    // ahorro frente a mantenimiento correctivo
    const hadAlert = v.alertId && CN.alert(v.alertId);
    v.saving = Math.round((SAVING_BY_TYPE[e.type] || 600) * (hadAlert ? 1 : 0.6));
    // tiempo de respuesta de la empresa
    const c = CN.company(v.companyId);
    const since = hadAlert ? hadAlert.createdAt : v.createdAt;
    if (c) c.hours.push(Math.max(0.5, Math.round(((now - since) / H) * 10) / 10));
    // cierra alertas del equipo y devuelve lecturas a la normalidad
    db.alerts.filter((a) => a.equipId === e.id && a.status !== 'resuelta').forEach((a) => { a.status = 'resuelta'; a.updatedAt = now; });
    CN.TYPE_VARS[e.type].forEach((variable) => db.readings.push({ id: CN.uid('rd'), equipId: e.id, variable, value: CN.genValue(e, variable, Math.floor(now / H)), ts: now }));
    // incidentes asociados
    v.incidentIds.forEach((iid) => CN.setIncidentStatus(CN.incident(iid), 'resuelto', true));
    CN.save();
    if (b.adminId) CN.notify(b.adminId, { title: 'Intervención registrada', body: e.type + ' ' + e.code + ' · ' + b.name + '. Ahorro estimado S/ ' + v.saving, kind: 'visit', link: '#/visits/' + v.id });
  };

  // ---------- incidentes ----------
  CN.reportIncident = function (user, data) {
    const num = parseInt(user.unit, 10);
    const floor = !isNaN(num) && num >= 100 ? Math.floor(num / 100) : user.unit;
    const i = { id: CN.uid('i'), buildingId: user.buildingId, unit: user.unit, residentId: user.id, type: data.type, title: data.type + ' - Piso ' + floor, description: data.description.trim(), photo: data.photo || null, status: 'reportado', createdAt: Date.now(), visitId: null, rating: null, history: [{ ts: Date.now(), status: 'reportado' }] };
    db.incidents.unshift(i); CN.save();
    const b = CN.building(i.buildingId);
    if (b && b.adminId) CN.notify(b.adminId, { title: 'Nuevo incidente reportado', body: i.title + ' · Depto. ' + i.unit, kind: 'incident', link: '#/incidents' });
    return i;
  };
  CN.setIncidentStatus = function (i, status, silent) {
    if (i.status === status) return;
    i.status = status; i.history.push({ ts: Date.now(), status }); CN.save();
    if (!silent || true) CN.notify(i.residentId, { title: 'Tu solicitud fue actualizada', body: '"' + i.title + '" ahora está ' + CN.INC_STATUS[status], kind: 'incident', link: '#/requests/' + i.id });
  };
  CN.assignIncident = function (i, visitId, admin) {
    let v = visitId === 'new' ? null : CN.visit(visitId);
    if (!v) {
      const b = CN.building(i.buildingId);
      const t = CN.INCIDENT_TYPES.find((x) => x.v === i.type);
      const eqs = CN.equipmentOf(b.id);
      const eq = eqs.find((e) => t && e.type === t.type) || eqs[0];
      const cid = (b.companyIds || [])[0];
      if (!eq || !cid) return { error: 'El edificio necesita al menos un equipo y una empresa vinculada.' };
      v = CN.scheduleVisit({ buildingId: b.id, equipId: eq.id, companyId: cid, date: Math.ceil((Date.now() + 26 * H) / H) * H, type: 'correctiva', incidentIds: [i.id], notes: 'Generada desde el incidente: ' + i.title });
    } else if (!v.incidentIds.includes(i.id)) { v.incidentIds.push(i.id); }
    i.visitId = v.id; CN.save();
    CN.setIncidentStatus(i, 'en_gestion');
    return { visit: v };
  };
  CN.rateIncident = function (i, stars, comment) { i.rating = { stars, comment: comment || '', ts: Date.now() }; CN.save(); };

  // ---------- estadísticas / reportes ----------
  CN.stats = function (bids, days) {
    const from = Date.now() - days * D;
    const alerts = db.alerts.filter((a) => bids.includes(a.buildingId) && a.createdAt >= from);
    const visits = db.visits.filter((v) => bids.includes(v.buildingId) && v.status === 'realizada' && v.intervention && v.intervention.ts >= from);
    const incidents = db.incidents.filter((i) => bids.includes(i.buildingId) && i.createdAt >= from);
    const saving = visits.reduce((a, v) => a + (v.saving || 0), 0);
    return { alerts, visits, incidents, saving, critical: alerts.filter((a) => a.severity === 'critica').length };
  };
  CN.ranking = function () {
    return db.companies.map((c) => {
      const n = c.hours.length, total = c.baseVisits + n;
      const avg = (c.baseAvg * c.baseVisits + c.hours.reduce((a, b) => a + b, 0)) / total;
      return { company: c, avg: Math.round(avg * 10) / 10, visits: total };
    }).sort((a, b) => a.avg - b.avg);
  };
  CN.weeklySummary = function (bid) {
    const from = Date.now() - 7 * D;
    return {
      alerts: db.alerts.filter((a) => a.buildingId === bid && a.createdAt >= from).length,
      visits: db.visits.filter((v) => v.buildingId === bid && v.status === 'realizada' && v.intervention.ts >= from).length,
      incidents: db.incidents.filter((i) => i.buildingId === bid && i.createdAt >= from).length,
    };
  };

  // ---------- onboarding (US50) ----------
  CN.onboarding = function (u) {
    const bs = CN.buildingsOf(u);
    const eqs = bs.flatMap((b) => CN.equipmentOf(b.id));
    const steps = [
      { title: 'Registra tu primer edificio', desc: 'Crea tu edificio con su dirección y número de unidades.', done: bs.length > 0, href: '#/buildings/new' },
      { title: 'Registra tus equipos críticos', desc: 'Bombas, tableros eléctricos, ascensores y aire acondicionado.', done: eqs.length > 0, href: bs[0] ? '#/buildings/' + bs[0].id + '/equipment/new' : '#/buildings/new' },
      { title: 'Asocia sensores a tus equipos', desc: 'Cada sensor envía lecturas y activa las alertas por severidad.', done: eqs.some((e) => CN.sensorsOf(e.id).length > 0), href: eqs[0] ? '#/equipment/' + eqs[0].id + '/sensors' : '#/buildings/new' },
    ];
    return steps;
  };

  // ---------- formato ----------
  const p2 = (n) => String(n).padStart(2, '0');
  CN.fmtDate = (ts) => { const d = new Date(ts); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); };
  CN.fmtShort = (ts) => { const d = new Date(ts); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1); };
  CN.fmtTime = (ts) => { const d = new Date(ts); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  CN.fmtDateTime = (ts) => CN.fmtShort(ts) + ', ' + CN.fmtTime(ts);
  CN.timeAgo = function (ts) {
    const diff = Date.now() - ts;
    if (diff < 60 * M) return 'Hace ' + Math.max(1, Math.round(diff / M)) + ' min';
    if (diff < 24 * H) { const h = Math.round(diff / H); return 'Hace ' + h + (h === 1 ? ' hora' : ' horas'); }
    const startToday = new Date().setHours(0, 0, 0, 0);
    if (ts >= startToday - D) return 'Ayer';
    const days = Math.round(diff / D);
    if (days < 7) return 'Hace ' + days + ' días';
    if (days < 14) return 'Hace 1 semana';
    if (days < 30) return 'Hace ' + Math.round(days / 7) + ' semanas';
    return CN.fmtDate(ts);
  };
  CN.dayLabel = function (ts) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const d1 = new Date(ts); d1.setHours(0, 0, 0, 0);
    const diff = Math.round((d1 - d0) / D);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff > 1 && diff < 7) { const w = new Date(ts).toLocaleDateString('es-PE', { weekday: 'long' }); return w[0].toUpperCase() + w.slice(1); }
    return CN.fmtShort(ts);
  };
  CN.money = (n) => 'S/ ' + Math.round(n).toLocaleString('en-US');
  CN.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  CN.toLocalInput = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
})();
