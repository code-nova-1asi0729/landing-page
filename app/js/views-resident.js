/* CodeNova — residente: reportar incidente, seguimiento y calificación (US23–US27, US47). */
(function () {
  'use strict';
  const CN = window.CN, esc = CN.esc, ic = CN.icon;
  const R = { roles: ['resident'] };

  // US23 + US24: reporte de incidente con foto opcional
  CN.route('/home', R, (p, u) => {
    const b = CN.building(u.buildingId);
    const pending = CN.db().incidents.filter((i) => i.residentId === u.id && i.status === 'resuelto' && !i.rating);
    return {
      title: 'Reportar incidente',
      html: '<div class="phone-pad"><p class="eyebrow">REPORTAR INCIDENTE</p><h1>Cuéntanos qué pasó</h1><p class="muted small">' + esc(b ? b.name : '') + ' · Depto. ' + esc(u.unit) + '</p>' +
        (pending.length ? '<a class="notice info" href="#/requests/' + pending[0].id + '">' + ic('star', 20) + '<div><b>¿Cómo fue la atención?</b><p>Califica “' + esc(pending[0].title) + '”</p></div></a>' : '') +
        '<form id="f" class="stack">' + CN.field({ id: 'type', label: 'Tipo de incidente', type: 'select', options: CN.INCIDENT_TYPES.map((t) => t.v), placeholder: 'Selecciona una opción' }) +
        CN.field({ id: 'description', label: 'Descripción breve', type: 'textarea', rows: 4, attrs: 'maxlength="400"', placeholder: 'Ej. Hay agua filtrándose desde el techo del baño.' }) +
        '<div class="field"><label>Agrega una foto (opcional)</label><label class="photo-drop" id="drop" for="photo">' + ic('camera', 26) + '<span id="ptxt">Tomar o elegir foto</span></label><input type="file" id="photo" name="photo" accept="image/*" hidden><div id="pprev" class="photo-prev" hidden></div><small class="err" data-err="photo"></small></div>' +
        CN.btn('Enviar reporte', { type: 'submit', icon: 'send', cls: 'btn-primary btn-block' }) + '</form></div>',
      mount(root) {
        const input = root.querySelector('#photo'), prev = root.querySelector('#pprev'), txt = root.querySelector('#ptxt');
        let photo = null;
        input.addEventListener('change', async () => {
          const f = input.files[0]; if (!f) return;
          const err = root.querySelector('[data-err="photo"]'); err.textContent = '';
          if (!/^image\//.test(f.type)) { err.textContent = 'El archivo debe ser una imagen.'; input.value = ''; return; }
          if (f.size > 10 * 1024 * 1024) { err.textContent = 'La imagen supera los 10 MB.'; input.value = ''; return; }
          try { photo = await CN.readImage(f, 720); } catch (e) { err.textContent = 'No se pudo leer la imagen.'; return; }
          prev.hidden = false; prev.innerHTML = '<img src="' + photo + '" alt="Vista previa de la foto"><button type="button" class="icon-btn sm" id="rm" aria-label="Quitar foto">' + ic('x', 16) + '</button>';
          txt.textContent = 'Cambiar foto';
          prev.querySelector('#rm').onclick = () => { photo = null; input.value = ''; prev.hidden = true; prev.innerHTML = ''; txt.textContent = 'Tomar o elegir foto'; };
        });
        CN.bindForm(root.querySelector('#f'), (v, fail) => {
          if (v.description.trim().length < 10) { fail('description', 'Cuéntanos un poco más (mínimo 10 caracteres).'); return; }
          const i = CN.reportIncident(u, { type: v.type, description: v.description, photo });
          CN.toast('Reporte enviado. Te avisaremos cuando cambie su estado.');
          CN.go('/requests');
        });
      },
    };
  });

  // US25: seguimiento
  CN.route('/requests', R, (p, u) => {
    const list = CN.db().incidents.filter((i) => i.residentId === u.id).sort((a, b) => b.createdAt - a.createdAt);
    return {
      title: 'Mis solicitudes',
      html: '<div class="phone-pad"><h1 class="caps">Mis solicitudes</h1>' +
        (list.length ? list.map((i) => '<a class="card req" href="#/requests/' + i.id + '"><div class="req-top"><b>' + esc(i.title) + '</b>' + ic('chevronR', 18) + '</div>' + CN.incStatusChip(i.status) + '<p class="muted small">Reportado ' + CN.timeAgo(i.createdAt).toLowerCase() + '</p>' +
          (i.status === 'resuelto' ? (i.rating ? '<div>' + CN.stars(i.rating.stars, 16) + '</div>' : '<span class="link">Calificar atención</span>') : '') + '</a>').join('')
          : CN.empty('message', 'Aún no reportas incidentes', 'Cuando reportes un problema podrás seguir su estado aquí.', '<a class="btn btn-primary" href="#/home">Reportar incidente</a>')) + '</div>',
    };
  });

  // Detalle + US27: calificación
  CN.route('/requests/:id', R, (p, u) => {
    const i = CN.incident(p.id);
    if (!i || i.residentId !== u.id) return { html: '<div class="phone-pad">' + CN.empty('message', 'Solicitud no encontrada', '', '<a class="btn btn-primary" href="#/requests">Volver</a>') + '</div>' };
    const v = i.visitId && CN.visit(i.visitId);
    const steps = ['reportado', 'en_gestion', 'resuelto'];
    const idx = steps.indexOf(i.status);
    const at = (s) => { const h = i.history.find((x) => x.status === s); return h ? CN.fmtDateTime(h.ts) : ''; };
    return {
      title: i.title,
      html: '<div class="phone-pad"><a class="back" href="#/requests">' + ic('back', 18) + ' Mis solicitudes</a><p class="eyebrow">DETALLE DE SOLICITUD</p><h1>' + esc(i.title) + '</h1>' + CN.incStatusChip(i.status) +
        '<p>' + esc(i.description) + '</p>' + (i.photo ? '<img class="inc-photo" src="' + i.photo + '" alt="Foto del incidente">' : '') +
        '<ol class="timeline">' + steps.map((s, k) => '<li class="' + (k <= idx ? 'done' : '') + '"><i>' + (k <= idx ? ic('check', 14) : '') + '</i><div><b>' + CN.INC_STATUS[s] + '</b><span>' + (k <= idx ? at(s) : 'Pendiente') + '</span></div></li>').join('') + '</ol>' +
        (v && v.status !== 'cancelada' ? '<div class="notice info">' + ic('calendar', 20) + '<div><b>Visita de mantenimiento</b><p>' + (v.status === 'realizada' ? 'Realizada el ' + CN.fmtDate(v.intervention.ts) : 'Programada para el ' + CN.fmtDateTime(v.date)) + '</p></div></div>' : '') +
        (i.status === 'resuelto' ? (i.rating ? '<div class="card"><p class="eyebrow">TU CALIFICACIÓN</p>' + CN.stars(i.rating.stars, 24) + (i.rating.comment ? '<p class="muted">“' + esc(i.rating.comment) + '”</p>' : '') + '</div>'
          : '<div class="card"><p class="eyebrow">CALIFICAR ATENCIÓN</p><h3>' + esc(i.type) + ' · Resuelto</h3><form id="fr" class="stack"><div class="star-input" id="stars" role="radiogroup" aria-label="Calificación">' + [1, 2, 3, 4, 5].map((n) => '<button type="button" role="radio" aria-checked="false" aria-label="' + n + ' estrellas" data-s="' + n + '">' + ic('star', 34, '#CBD3D9') + '</button>').join('') + '</div><small class="err" data-err="stars"></small>' +
            CN.field({ id: 'comment', label: 'Comentario (opcional)', type: 'textarea', rows: 3, required: false }) + CN.btn('Enviar calificación', { type: 'submit', icon: 'send', cls: 'btn-primary btn-block' }) + '</form></div>') : '') + '</div>',
      mount(root) {
        const fr = root.querySelector('#fr'); if (!fr) return;
        let val = 0;
        const paint = () => root.querySelectorAll('#stars button').forEach((b) => {
          const on = +b.dataset.s <= val;
          b.setAttribute('aria-checked', String(+b.dataset.s === val));
          b.innerHTML = ic('star', 34, on ? '#F4B400' : '#CBD3D9').replace('fill="none"', 'fill="' + (on ? '#F4B400' : 'none') + '"');
        });
        CN.delegate(root, 'click', '#stars button', (e, t) => { val = +t.dataset.s; paint(); root.querySelector('[data-err="stars"]').textContent = ''; });
        CN.bindForm(fr, (v) => {
          if (!val) { root.querySelector('[data-err="stars"]').textContent = 'Elige de 1 a 5 estrellas.'; return; }
          CN.rateIncident(i, val, v.comment); CN.toast('¡Gracias por tu calificación!'); CN.render();
        });
      },
    };
  });
})();
