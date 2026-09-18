/* CodeNova — perfil (US06, US45, US46) y configuración de plataforma (US15). */
(function () {
  'use strict';
  const CN = window.CN, esc = CN.esc, ic = CN.icon;
  const ANY = { roles: ['admin', 'resident', 'company', 'platform'] };

  CN.route('/profile', ANY, (p, u) => {
    const isAdmin = u.role === 'admin';
    const sub = u.role === 'resident' ? esc((CN.building(u.buildingId) || {}).name || '') + ' · Depto. ' + esc(u.unit) : esc(CN.userLabel(u));
    const bs = isAdmin ? CN.buildingsOf(u) : [];
    const wrap = u.role === 'resident' ? 'phone-pad' : '';
    return {
      title: 'Perfil',
      html: '<div class="' + wrap + '">' + CN.pageHead('PERFIL', 'Editar datos de perfil', sub) +
        '<div class="card form-card"><form id="fp" class="stack">' + CN.field({ id: 'name', label: 'Nombre completo', value: u.name }) + CN.field({ id: 'phone', label: 'Teléfono', value: u.phone, required: false, type: 'tel', placeholder: 'Ej. 987 654 321' }) +
        CN.field({ id: 'email', label: 'Correo electrónico', type: 'email', value: u.email }) + CN.btn('Guardar cambios', { type: 'submit', icon: 'check' }) + '</form></div>' +
        // US45
        '<div class="card form-card"><div class="card-head"><h3>Preferencias de notificación</h3></div><form id="fn" class="stack">' +
        '<label class="switch-row"><span><b>Notificaciones push</b><small class="muted">Avisos inmediatos en pantalla cuando hay una alerta crítica o cambia tu solicitud.</small></span><input type="checkbox" name="push" class="switch"' + (u.prefs.push ? ' checked' : '') + '></label>' +
        '<label class="switch-row"><span><b>Notificaciones por correo</b><small class="muted">' + (isAdmin ? 'Incluye el resumen semanal de tus edificios.' : 'Recibe un correo con las novedades.') + '</small></span><input type="checkbox" name="email" class="switch"' + (u.prefs.email ? ' checked' : '') + '></label>' +
        '<p class="muted small" id="pushnote"></p>' + CN.btn('Guardar preferencias', { type: 'submit', icon: 'check' }) + '</form></div>' +
        // US46
        (isAdmin && bs.length ? '<div class="card"><div class="card-head"><h3>Resumen semanal por correo</h3>' + CN.buildingSelect(u, CN.selectedBuilding(u).id, 'wsel') + '</div><div id="mail" class="mail-prev"></div><div class="btn-row"><button class="btn btn-outline" id="sendmail">' + ic('mail', 18) + '<span>Enviar resumen ahora</span></button></div></div>' : '') +
        '<div class="card form-card"><div class="card-head"><h3>Cambiar contraseña</h3></div><form id="fw" class="stack">' + CN.field({ id: 'cur', label: 'Contraseña actual', type: 'password' }) + CN.field({ id: 'new', label: 'Nueva contraseña', type: 'password', hint: 'Mínimo 8 caracteres.', autocomplete: 'new-password' }) + CN.btn('Actualizar contraseña', { type: 'submit', icon: 'key', cls: 'btn-outline' }) + '</form></div>' +
        '<div class="card"><div class="card-head"><h3>Sesión y datos de demostración</h3></div><div class="btn-row"><button class="btn btn-outline" id="out">' + ic('logout', 18) + '<span>Cerrar sesión</span></button><button class="btn btn-outline danger-o" id="reset">' + ic('refresh', 18) + '<span>Restablecer datos de demo</span></button></div><p class="muted small">Toda la información se guarda solo en este navegador. Restablecer borra tus cambios y devuelve los datos de ejemplo.</p></div></div>',
      mount(root) {
        CN.bindForm(root.querySelector('#fp'), (v, fail) => {
          if (!CN.isEmail(v.email)) { fail('email', 'Ingresa un correo válido.'); return; }
          if (CN.db().users.some((x) => x.id !== u.id && x.email.toLowerCase() === v.email.trim().toLowerCase())) { fail('email', 'Este correo ya está en uso.'); return; }
          if (v.phone.trim() && !/^[+\d][\d\s-]{6,}$/.test(v.phone.trim())) { fail('phone', 'Ingresa un teléfono válido.'); return; }
          Object.assign(u, { name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim() }); CN.save();
          CN.toast('Datos de perfil actualizados.'); shellRefresh();
        });
        const fn = root.querySelector('#fn'), note = root.querySelector('#pushnote');
        const notePaint = () => { note.textContent = window.Notification ? (Notification.permission === 'denied' ? 'Tu navegador bloqueó las notificaciones del sistema; verás los avisos dentro de la app.' : Notification.permission === 'granted' ? 'Las notificaciones del sistema están activadas para este navegador.' : '') : ''; };
        notePaint();
        fn.push.addEventListener('change', () => { if (fn.push.checked && window.Notification && Notification.permission === 'default') Notification.requestPermission().then(notePaint).catch(() => {}); });
        fn.addEventListener('submit', (e) => { e.preventDefault(); u.prefs = { push: fn.push.checked, email: fn.email.checked }; CN.save(); CN.toast('Preferencias guardadas.'); });
        CN.bindForm(root.querySelector('#fw'), (v, fail) => {
          if (v.cur !== u.password) { fail('cur', 'La contraseña actual no es correcta.'); return; }
          if (v.new.length < 8) { fail('new', 'La contraseña debe tener al menos 8 caracteres.'); return; }
          u.password = v.new; CN.save(); root.querySelector('#fw').reset(); CN.toast('Contraseña actualizada.');
        });
        root.querySelector('#out').addEventListener('click', () => { CN.logout(); CN.go('/login'); CN.toast('Sesión cerrada.', 'info'); });
        root.querySelector('#reset').addEventListener('click', () => CN.confirm('Restablecer datos de demo', 'Se borrarán todos los cambios hechos en este navegador y volverás a iniciar sesión.', 'Restablecer', () => { CN.resetDemo(); CN.go('/login'); CN.render(); CN.toast('Datos de demostración restablecidos.', 'info'); }, true));
        const mail = root.querySelector('#mail');
        if (mail) {
          const paint = () => {
            const sel = root.querySelector('#wsel'); const b = sel ? CN.building(sel.value) : CN.selectedBuilding(u);
            const s = CN.weeklySummary(b.id);
            mail.innerHTML = '<p class="muted small">De: CodeNova &lt;resumen@codenova.pe&gt;</p><h4>Tu resumen semanal · ' + esc(b.name) + '</h4><div class="grid-3 mini"><div><h2>' + s.alerts + '</h2><p>Alertas nuevas</p></div><div><h2>' + s.visits + '</h2><p>Visita' + (s.visits === 1 ? '' : 's') + ' realizada' + (s.visits === 1 ? '' : 's') + '</p></div><div><h2>' + s.incidents + '</h2><p>Incidente' + (s.incidents === 1 ? '' : 's') + ' reportado' + (s.incidents === 1 ? '' : 's') + '</p></div></div>';
          };
          const sel = root.querySelector('#wsel'); if (sel) sel.addEventListener('change', paint);
          paint();
          root.querySelector('#sendmail').addEventListener('click', () => { if (!u.prefs.email) CN.toast('Activa las notificaciones por correo para recibir el resumen.', 'err', 5000); else CN.toast('Resumen enviado a ' + u.email + ' (simulado).'); });
        }
      },
    };
  });
  function shellRefresh() { const el = document.querySelector('.side-user b'); if (el) el.textContent = CN.session().name; const av = document.querySelector('.side-user .avatar'); if (av) av.textContent = CN.initials(CN.session().name); }

  // US15: rangos esperados por tipo de equipo (administrador de plataforma)
  CN.route('/config', { roles: ['platform'] }, () => {
    const db = CN.db();
    let demos = [];
    try { demos = JSON.parse(CN.store.get(CN.DEMO_KEY) || '[]'); } catch (e) { demos = []; }
    return {
      title: 'Configuración',
      html: CN.pageHead('CONFIGURACIÓN DEL SISTEMA', 'Rangos esperados por tipo de equipo', 'Valores de referencia para detectar lecturas fuera de lo normal') +
        '<div class="grid-3">' + CN.stat('building', db.buildings.length, 'Edificios') + CN.stat('cpu', db.equipment.length, 'Equipos registrados') + CN.stat('alert', CN.activeAlerts().length, 'Alertas activas') + '</div>' +
        '<div class="card"><form id="f" class="stack"><div class="table-wrap"><table class="rtable"><thead><tr><th>Tipo de equipo</th><th>Variable</th><th>Mínimo</th><th>Máximo</th></tr></thead><tbody>' +
        db.ranges.map((r) => '<tr><td data-label="Tipo de equipo"><b>' + esc(r.type) + '</b></td><td data-label="Variable">' + esc(r.label) + '</td><td data-label="Mínimo"><div class="range-row"><input type="number" step="0.1" name="min_' + r.id + '" value="' + r.min + '" aria-label="Mínimo"> <span>' + CN.VARS[r.variable].unit + '</span></div></td><td data-label="Máximo"><div class="range-row"><input type="number" step="0.1" name="max_' + r.id + '" value="' + r.max + '" aria-label="Máximo"> <span>' + CN.VARS[r.variable].unit + '</span></div></td></tr>').join('') +
        '</tbody></table></div><small class="err" id="rerr"></small>' + CN.btn('Guardar rangos', { type: 'submit', icon: 'check' }) + '</form></div>' +
        '<div class="card"><div class="card-head"><h3>Solicitudes de demo desde la landing</h3></div>' + (demos.length ? CN.responsiveTable(['Fecha', 'Nombre', 'Correo', 'Perfil'], demos.slice().reverse().map((d) => ({ cells: [CN.fmtDateTime(d.ts), esc(d.name), esc(d.email), esc(d.profile)] }))) : '<p class="muted pad">Todavía no hay solicitudes. Aparecen cuando alguien completa el formulario “Solicitar demo” de la página principal.</p>') + '</div>',
      mount(root) {
        const f = root.querySelector('#f');
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          const err = root.querySelector('#rerr');
          for (const r of db.ranges) {
            const mn = parseFloat(f['min_' + r.id].value), mx = parseFloat(f['max_' + r.id].value);
            if (isNaN(mn) || isNaN(mx) || mn < 0 || mn >= mx) { err.textContent = 'Revisa “' + r.type + ' · ' + r.label + '”: el mínimo debe ser menor que el máximo.'; return; }
          }
          err.textContent = '';
          db.ranges.forEach((r) => { r.min = parseFloat(f['min_' + r.id].value); r.max = parseFloat(f['max_' + r.id].value); });
          CN.save(); CN.toast('Rangos esperados guardados.');
        });
      },
    };
  });
})();
