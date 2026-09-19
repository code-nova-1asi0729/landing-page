/* FleetCare app — modelo de datos, reglas de negocio y datos demo */
(function () {
  'use strict';
  const R = window.FleetCare;

  R.PRICE_PER_VEHICLE = 25; // tarifa referencial de la demo (S/ por vehículo al mes)
  R.LITERS_PER_GALLON = 3.785;
  R.WARN_PCT = 0.9;
  R.NEAR_PCT = 0.75;
  R.TIME_ALERT_DAYS = 90;
  R.DEMO_PASSWORD = 'fleetcare123';

  const defaultItems = () => ['Nivel de aceite', 'Frenos', 'Llantas', 'Luces', 'Fugas visibles'].map((name) => ({ id: R.uid('i'), name, required: true }));
  const defaultServices = () => [
    { id: 'sv_oil', name: 'Cambio de aceite', km: 5000 },
    { id: 'sv_brk', name: 'Revisión de frenos', km: 10000 },
    { id: 'sv_tyr', name: 'Rotación de llantas', km: 8000 },
  ];
  R.blankDb = (company) => ({
    company, items: defaultItems(), services: defaultServices(), vehicles: [], kmLogs: [], checklists: [],
    faults: [], fuel: [], maintLog: [], notifications: [], notifiedKeys: [], invites: [], subscription: null,
  });

  /* ---------- Accesos ---------- */
  R.activeVehicles = (db) => db.vehicles.filter((v) => v.active !== false);
  R.vehicle = (db, id) => db.vehicles.find((v) => v.id === id);
  R.driverOf = (db, v) => (v && v.driverId ? R.userById(v.driverId) : null);
  R.vehicleOfDriver = (db, u) => db.vehicles.find((v) => v.active !== false && v.driverId === u.id) || null;
  R.kmLogsOf = (db, vid) => db.kmLogs.filter((l) => l.vehicleId === vid).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts));
  R.faultOpen = (f) => f.status !== 'resuelta';

  R.avgDaily = (db, v) => {
    const logs = R.kmLogsOf(db, v.id).slice(-15);
    if (logs.length < 2) return 100;
    const span = Math.max(1, R.daysBetween(logs[0].date, logs[logs.length - 1].date));
    return Math.max(20, (logs[logs.length - 1].km - logs[0].km) / span);
  };

  /* ---------- Alertas de mantenimiento y salud ---------- */
  R.vehicleAlerts = (db, v) => {
    const out = [];
    const daily = R.avgDaily(db, v);
    let newest = null;
    db.services.forEach((s) => {
      const st = (v.services && v.services[s.id]) || { lastKm: v.kmInitial, lastDate: (v.createdAt || R.today()) };
      if (!newest || st.lastDate > newest) newest = st.lastDate;
      const used = v.km - st.lastKm;
      const pct = used / s.km;
      const level = pct >= 1 ? 'critico' : pct >= R.WARN_PCT ? 'alerta' : pct >= R.NEAR_PCT ? 'proximo' : null;
      if (level) {
        const remaining = s.km - used;
        out.push({
          id: v.id + ':' + s.id, kind: 'km', vehicleId: v.id, plate: v.plate, serviceId: s.id, service: s.name,
          pct, remainingKm: remaining, days: remaining <= 0 ? 0 : Math.ceil(remaining / daily), level, key: `${v.id}:${s.id}:${st.lastKm}`,
        });
      }
    });
    if (newest) {
      const since = R.daysBetween(newest, R.today());
      if (since >= R.TIME_ALERT_DAYS) {
        out.push({
          id: v.id + ':tiempo', kind: 'tiempo', vehicleId: v.id, plate: v.plate, service: 'Mantenimiento general',
          pct: since / R.TIME_ALERT_DAYS, daysSince: since, days: 0, level: 'alerta', key: `${v.id}:tiempo:${newest}`,
        });
      }
    }
    return out.sort((a, b) => a.days - b.days);
  };

  R.vehicleHealth = (db, v) => {
    const alerts = R.vehicleAlerts(db, v);
    const faults = db.faults.filter((f) => f.vehicleId === v.id && R.faultOpen(f));
    const causes = [];
    let status = 'bueno';
    const raise = (s) => { if (s === 'critico' || (s === 'alerta' && status === 'bueno')) status = s; };
    alerts.forEach((a) => {
      if (a.level === 'critico') { raise('critico'); causes.push({ type: 'Mantenimiento vencido', detail: a.service, level: 'critico', link: '/mantenimiento' }); }
      else if (a.level === 'alerta') {
        raise('alerta');
        causes.push(a.kind === 'tiempo'
          ? { type: 'Sin mantenimiento reciente', detail: `${a.daysSince} días desde el último servicio`, level: 'alerta', link: '/mantenimiento' }
          : { type: 'Mantenimiento próximo', detail: `${a.service} (${Math.round(a.pct * 100)}% del intervalo)`, level: 'alerta', link: '/mantenimiento' });
      }
    });
    faults.forEach((f) => {
      if (f.priority === 'alta') { raise('critico'); causes.push({ type: 'Falla sin resolver', detail: f.title, level: 'critico', link: '/fallas/' + f.id }); }
      else if (f.priority === 'media') { raise('alerta'); causes.push({ type: 'Falla sin resolver', detail: f.title, level: 'alerta', link: '/fallas/' + f.id }); }
    });
    causes.sort((a, b) => (a.level === b.level ? 0 : a.level === 'critico' ? -1 : 1));
    return { status, causes, alerts, openFaults: faults };
  };

  R.upcomingAlerts = (db) => {
    const all = [];
    R.activeVehicles(db).forEach((v) => R.vehicleAlerts(db, v).forEach((a) => all.push(a)));
    return all.sort((a, b) => a.days - b.days || b.pct - a.pct);
  };

  R.dueText = (a) => {
    if (a.kind === 'tiempo') return `Han pasado ${a.daysSince} días`;
    if (a.remainingKm <= 0) return `Vencido por ${R.fmtNum(-a.remainingKm)} km`;
    if (a.days <= 0) return 'Vence hoy';
    return `Vence en ${a.days} ${a.days === 1 ? 'día' : 'días'}`;
  };

  R.attendAlert = (db, alertId) => {
    const [vid, sid] = alertId.split(':');
    const v = R.vehicle(db, vid);
    if (!v) return null;
    v.services = v.services || {};
    const today = R.today();
    let name;
    if (sid === 'tiempo') {
      db.services.forEach((s) => { v.services[s.id] = { lastKm: (v.services[s.id] || {}).lastKm ?? v.kmInitial, lastDate: today }; });
      name = 'Mantenimiento general';
    } else {
      const s = db.services.find((x) => x.id === sid);
      if (!s) return null;
      v.services[sid] = { lastKm: v.km, lastDate: today };
      name = s.name;
    }
    db.maintLog.push({ id: R.uid('m'), vehicleId: v.id, service: name, date: today, km: v.km, ts: Date.now() });
    return { vehicle: v, name };
  };

  /* ---------- Notificaciones ---------- */
  R.notify = (db, n) => {
    db.notifications.unshift(Object.assign({ id: R.uid('n'), ts: Date.now(), read: false, toasted: false }, n));
    db.notifications.length = Math.min(db.notifications.length, 60);
  };
  R.checkAlerts = (db, v, silent) => {
    R.vehicleAlerts(db, v).forEach((a) => {
      if (a.level === 'proximo' || db.notifiedKeys.includes(a.key)) return;
      db.notifiedKeys.push(a.key);
      if (silent) return;
      const text = a.kind === 'tiempo'
        ? `Han pasado ${a.daysSince} días desde el último mantenimiento de ${v.plate}`
        : a.pct >= 1
          ? `${v.plate} superó el kilometraje definido para ${a.service.toLowerCase()}`
          : `${v.plate} alcanzó el ${Math.round(a.pct * 100)}% del kilometraje definido para ${a.service.toLowerCase()}`;
      R.notify(db, { type: 'mantenimiento', title: 'Alerta de mantenimiento', text, vehicleId: v.id, link: '/mantenimiento' });
    });
    if (db.notifiedKeys.length > 400) db.notifiedKeys = db.notifiedKeys.slice(-200);
  };
  R.checkAllAlerts = (db) => R.activeVehicles(db).forEach((v) => R.checkAlerts(db, v));

  /* ---------- Kilometraje ---------- */
  // Registra (o reemplaza el del día) el kilometraje de una unidad. Devuelve {ok, error, replaced}
  R.logKm = (db, v, km, by, byId) => {
    const today = R.today();
    const logs = R.kmLogsOf(db, v.id);
    const before = logs.filter((l) => l.date < today).pop();
    if (before && km < before.km) return { ok: false, error: `El kilometraje no puede ser menor al último registrado (${R.fmtNum(before.km)} km).` };
    const same = logs.find((l) => l.date === today);
    if (same) { same.km = km; same.by = by; same.byId = byId; same.ts = Date.now(); }
    else db.kmLogs.push({ id: R.uid('k'), vehicleId: v.id, date: today, km, by, byId, ts: Date.now() });
    v.km = km;
    R.checkAlerts(db, v);
    return { ok: true, replaced: !!same };
  };
  R.syncVehicleKm = (db, v) => {
    const logs = R.kmLogsOf(db, v.id);
    if (logs.length) v.km = logs[logs.length - 1].km;
  };

  /* ---------- Combustible ---------- */
  R.fuelSeries = (db, vid) => {
    const rows = db.fuel.filter((f) => f.vehicleId === vid).sort((a, b) => a.km - b.km || a.ts - b.ts);
    return rows.map((f, i) => {
      const gal = f.liters / R.LITERS_PER_GALLON;
      const dist = i > 0 ? f.km - rows[i - 1].km : 0;
      return Object.assign({}, f, { gal, kmpg: i > 0 && dist > 0 && gal > 0 ? dist / gal : null });
    });
  };
  R.fuelStats = (db, vid) => {
    const s = R.fuelSeries(db, vid).filter((r) => r.kmpg != null);
    if (!s.length) return { avg: null, last: null, variation: null, count: 0 };
    const avg = s.reduce((a, r) => a + r.kmpg, 0) / s.length;
    const last = s[s.length - 1].kmpg;
    const prev = s.slice(0, -1);
    const base = prev.length ? prev.reduce((a, r) => a + r.kmpg, 0) / prev.length : null;
    return { avg, last, variation: base ? ((last - base) / base) * 100 : null, count: s.length };
  };

  /* ---------- Sesión / cuentas ---------- */
  R.newCompanyId = () => R.uid('c_');

  /* ---------- Datos demo ---------- */
  function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }

  R.buildSeed = async () => {
    const rand = rng(7);
    const T = new Date();
    const dayStr = (n) => R.ymd(R.addDays(T, -n));
    const tsAgo = (days, hours = 0) => Date.now() - days * 86400000 - hours * 3600000;
    const cid = 'c_demo';
    const pass = await R.hash(R.DEMO_PASSWORD);

    const users = [
      { id: 'u_mgr', name: 'Carlos Mendoza', email: 'jefe@fleetcare.pe', passHash: pass, role: 'manager', companyId: cid, active: true },
      { id: 'u_d1', name: 'Luis Quispe', email: 'conductor@fleetcare.pe', passHash: pass, role: 'driver', companyId: cid, active: true },
      { id: 'u_d2', name: 'Marco Rojas', email: 'marco.rojas@transportesandes.pe', passHash: pass, role: 'driver', companyId: cid, active: true },
    ];

    const db = R.blankDb({ name: 'Transportes Andes SAC', ruc: '20601234567', address: 'Av. Argentina 1450, Callao', email: 'contacto@transportesandes.pe' });
    const items = db.items;

    const spec = [
      { id: 'v1', plate: 'ABC-123', brand: 'Hyundai', model: 'H100', km: 84210, daily: 118, eff: 8.3, driverId: 'u_d1', skipToday: true, pct: { sv_oil: 0.55, sv_brk: 0.4, sv_tyr: 0.62 } },
      { id: 'v2', plate: 'DEF-456', brand: 'Toyota', model: 'Hiace', km: 132480, daily: 152, eff: 7.4, driverId: 'u_d2', pct: { sv_oil: 0.5, sv_brk: 0.94, sv_tyr: 0.7 } },
      { id: 'v3', plate: 'GHI-789', brand: 'Isuzu', model: 'NHR', km: 210950, daily: 181, eff: 6.5, driverId: null, pct: { sv_oil: 1.08, sv_brk: 0.3, sv_tyr: 0.82 } },
    ];

    spec.forEach((s) => {
      const v = { id: s.id, plate: s.plate, brand: s.brand, model: s.model, kmInitial: s.km - s.daily * 30, km: s.km, active: true, driverId: s.driverId, createdAt: dayStr(45), services: {} };
      // Kilometraje diario de los últimos 30 días (uno por día, algunos omitidos)
      let cur = s.km - s.daily * 29;
      const logs = [];
      for (let d = 29; d >= (s.skipToday ? 1 : 0); d--) {
        if (d !== 29 && d !== 0 && d !== 1 && rand() < 0.12) { cur += s.daily; continue; }
        cur = Math.round(cur + (d === 29 ? 0 : s.daily * (0.85 + rand() * 0.3)));
        logs.push({ id: R.uid('k'), vehicleId: s.id, date: dayStr(d), km: cur, by: s.driverId === 'u_d1' ? 'Luis Quispe' : 'Marco Rojas', byId: s.driverId || 'u_d2', ts: tsAgo(d) });
      }
      const last = logs[logs.length - 1];
      last.km = s.km; v.km = s.km;
      for (let i = logs.length - 2; i >= 0; i--) if (logs[i].km >= logs[i + 1].km) logs[i].km = logs[i + 1].km - 40;
      v.kmInitial = logs[0].km - 20;
      db.kmLogs.push(...logs);

      // Servicios: último mantenimiento según % consumido
      db.services.forEach((sv) => {
        const used = Math.round(sv.km * s.pct[sv.id]);
        const daysAgo = Math.min(80, Math.round(used / s.daily));
        v.services[sv.id] = { lastKm: s.km - used, lastDate: dayStr(daysAgo) };
        db.maintLog.push({ id: R.uid('m'), vehicleId: s.id, service: sv.name, date: dayStr(daysAgo), km: s.km - used, ts: tsAgo(daysAgo) });
      });

      // Combustible: una carga cada ~3.5 días
      const fl = [];
      for (let d = 28; d >= 1; d -= 4) {
        const near = logs.filter((l) => l.date <= dayStr(d)).pop();
        if (near) fl.push({ d, km: near.km });
      }
      fl.forEach((f, i) => {
        const prev = i > 0 ? fl[i - 1].km : f.km - s.daily * 3.5;
        const eff = s.eff * (s.id === 'v3' && i >= fl.length - 2 ? 0.83 : 1) * (0.94 + rand() * 0.12);
        const liters = Math.max(15, Math.round(((f.km - prev) / eff) * 10) / 10);
        db.fuel.push({ id: R.uid('g'), vehicleId: s.id, date: dayStr(f.d), km: f.km, liters, amount: Math.round(liters * 4.75 * 100) / 100, by: s.driverId ? (s.driverId === 'u_d1' ? 'Luis Quispe' : 'Marco Rojas') : 'Marco Rojas', ts: tsAgo(f.d) });
      });
      db.vehicles.push(v);
    });

    // Checklists de los últimos días
    const mk = (vid, d, driverName, driverId, failIdx, comment) => ({
      id: R.uid('cl'), vehicleId: vid, date: dayStr(d), ts: tsAgo(d, 1), driverId, driverName,
      results: items.map((it, i) => ({ name: it.name, status: i === failIdx ? 'falla' : 'bueno', comment: i === failIdx ? comment : '' })),
    });
    for (let d = 1; d <= 9; d++) {
      db.checklists.push(mk('v1', d, 'Luis Quispe', 'u_d1', d === 6 ? 3 : -1, 'Luz de freno izquierda no enciende.'));
      db.checklists.push(mk('v2', d - 1, 'Marco Rojas', 'u_d2', d === 4 ? 1 : -1, 'Se siente el pedal blando.'));
    }
    [2, 3, 5, 8].forEach((d) => db.checklists.push(mk('v3', d, 'Marco Rojas', 'u_d2', d === 2 ? 1 : -1, 'Ruido metálico al frenar en bajadas.')));

    // Fallas
    const F = (vid, title, desc, prio, status, by, byId, days, comments) => ({ id: R.uid('f'), vehicleId: vid, title, description: desc, photos: [], priority: prio, status, reportedBy: by, reportedById: byId, date: dayStr(days), ts: tsAgo(days, 2), comments: comments || [] });
    db.faults.push(
      F('v3', 'Frenos con ruido', 'Se escucha un ruido metálico al frenar en bajadas. El pedal se siente más duro de lo normal.', 'alta', 'pendiente', 'Marco Rojas', 'u_d2', 1, [{ id: R.uid('c'), by: 'Carlos Mendoza', role: 'manager', text: 'Programa la revisión en taller hoy. No salir a ruta larga hasta revisarlo.', ts: Date.now() - 2 * 3600000 }]),
      F('v2', 'Fuga de aceite', 'Se observan manchas de aceite bajo el motor al estacionar.', 'media', 'en_proceso', 'Marco Rojas', 'u_d2', 4, [{ id: R.uid('c'), by: 'Carlos Mendoza', role: 'manager', text: 'Cotizando cambio de empaquetadura.', ts: tsAgo(3) }]),
      F('v1', 'Luz de freno', 'La luz de freno izquierda no enciende a veces.', 'baja', 'pendiente', 'Luis Quispe', 'u_d1', 2),
      F('v1', 'Espejo lateral flojo', 'El espejo derecho vibra y se mueve solo.', 'baja', 'resuelta', 'Luis Quispe', 'u_d1', 15),
      F('v1', 'Claxon intermitente', 'El claxon a veces no suena.', 'media', 'resuelta', 'Luis Quispe', 'u_d1', 29),
      F('v2', 'Llanta delantera desgastada', 'Desgaste irregular en la llanta delantera derecha.', 'media', 'resuelta', 'Marco Rojas', 'u_d2', 20),
    );

    // Notificaciones iniciales (sin leer)
    db.notifications.push(
      { id: R.uid('n'), type: 'falla', title: 'Nueva falla reportada', text: 'GHI-789 · Frenos con ruido', vehicleId: 'v3', link: '/fallas/' + db.faults[0].id, ts: tsAgo(1, 2), read: false, toasted: false },
      { id: R.uid('n'), type: 'mantenimiento', title: 'Alerta de mantenimiento', text: 'DEF-456 alcanzó el 94% del kilometraje definido para revisión de frenos', vehicleId: 'v2', link: '/mantenimiento', ts: tsAgo(0, 3), read: false, toasted: false },
    );
    db.vehicles.forEach((v) => R.checkAlerts(db, v, true));

    db.invites.push({ id: R.uid('inv'), email: 'jose.perez@transportesandes.pe', ts: tsAgo(2) });
    db.subscription = { plan: 'Suscripción mensual', vehicles: 3, price: R.PRICE_PER_VEHICLE, start: dayStr(40), card: '4242', status: 'activa' };

    return { v: 1, users, companies: { [cid]: db } };
  };

  /* ---------- Próxima fecha de cobro ---------- */
  R.nextCharge = (sub) => {
    const start = R.parseYmd(sub.start);
    const now = new Date();
    let d = new Date(start);
    let i = 0;
    while (d <= now && i < 240) { i++; d = new Date(start.getFullYear(), start.getMonth() + i, Math.min(start.getDate(), 28)); }
    return R.ymd(d);
  };
})();
