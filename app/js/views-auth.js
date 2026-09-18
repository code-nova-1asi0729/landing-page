/* CodeNova — login, registros y recuperación de contraseña (US01–US05). */
(function () {
  'use strict';
  const CN = window.CN, esc = CN.esc, ic = CN.icon;

  function authShell(inner) {
    return '<div class="auth"><aside class="auth-side"><div class="auth-brand">' + CN.logoTile(56) + '<h1>CodeNova</h1><p>Mantenimiento preventivo inteligente para edificios y condominios.</p></div>' +
      '<a class="auth-back" href="../index.html">' + ic('back', 18) + ' Volver al sitio</a></aside>' +
      '<section class="auth-main"><div class="auth-card">' + inner + '</div></section></div>';
  }
  const submit = (label, icon) => '<button type="submit" class="btn btn-primary btn-block">' + ic(icon || 'key', 22) + '<span>' + label + '</span></button>';

  function emailTaken(email) { return CN.db().users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()); }
  function checkCommon(v, fail) {
    let ok = true;
    if (!CN.isEmail(v.email)) { fail('email', 'Ingresa un correo válido.'); ok = false; }
    else if (emailTaken(v.email)) { fail('email', 'Ya existe una cuenta con este correo.'); ok = false; }
    if (v.password.length < 8) { fail('password', 'La contraseña debe tener al menos 8 caracteres.'); ok = false; }
    return ok;
  }
  function enter(user, msg) {
    CN.login(user);
    CN.toast(msg || 'Bienvenido/a, ' + user.name.split(' ')[0] + '.');
    CN.go(CN.homeFor(user));
  }

  // ---------- US02: inicio de sesión por rol ----------
  CN.route('/login', { public: true }, () => ({
    title: 'Iniciar sesión',
    html: authShell(
      '<p class="eyebrow">INICIAR SESIÓN</p><h1>Bienvenido de vuelta</h1>' +
      '<form id="f" class="stack">' +
      CN.field({ id: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'tu@correo.com', attrs: 'autocomplete="username"' }) +
      CN.field({ id: 'password', label: 'Contraseña', type: 'password' }) +
      '<div class="row-between"><span></span><a href="#/forgot" class="link">¿Olvidaste tu contraseña?</a></div>' +
      '<p class="err form-err" id="ferr" role="alert"></p>' +
      submit('Iniciar sesión') + '</form>' +
      '<p class="muted small">El sistema te redirige automáticamente a tu dashboard según tu rol (administrador, residente o empresa de mantenimiento).</p>' +
      '<div class="demo-box"><b>Cuentas de demostración</b><p class="muted small">Contraseña: <code>demo1234</code></p><div class="demo-chips">' +
      '<button type="button" class="chip-btn" data-demo="admin@demo.pe">Administrador</button>' +
      '<button type="button" class="chip-btn" data-demo="residente@demo.pe">Residente</button>' +
      '<button type="button" class="chip-btn" data-demo="empresa@demo.pe">Empresa</button>' +
      '<button type="button" class="chip-btn" data-demo="plataforma@demo.pe">Plataforma</button></div></div>' +
      '<div class="reg-links"><span>¿No tienes cuenta?</span> <a href="#/register/admin">Administrador</a> · <a href="#/register/resident">Residente</a> · <a href="#/register/company">Empresa</a></div>'
    ),
    mount(root) {
      const f = root.querySelector('#f');
      CN.bindForm(f, (v) => {
        const u = CN.db().users.find((x) => x.email.toLowerCase() === v.email.trim().toLowerCase() && x.password === v.password);
        if (!u) { root.querySelector('#ferr').textContent = 'Correo o contraseña incorrectos.'; return; }
        enter(u);
      });
      root.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
        f.email.value = b.dataset.demo; f.password.value = 'demo1234'; f.requestSubmit();
      }));
    },
  }));

  // ---------- US01: registro de administrador ----------
  CN.route('/register/admin', { public: true }, () => ({
    title: 'Crear cuenta',
    html: authShell(
      '<p class="eyebrow">CREAR CUENTA · ADMINISTRADOR</p><h1>Registra tu cuenta y tu edificio</h1>' +
      '<form id="f" class="stack">' +
      CN.field({ id: 'name', label: 'Nombre completo', autocomplete: 'name' }) +
      CN.field({ id: 'email', label: 'Correo electrónico', type: 'email' }) +
      CN.field({ id: 'password', label: 'Contraseña', type: 'password', hint: 'Mínimo 8 caracteres.', autocomplete: 'new-password' }) +
      CN.field({ id: 'building', label: 'Nombre del edificio' }) +
      CN.field({ id: 'address', label: 'Dirección del edificio' }) +
      submit('Crear cuenta') + '</form>' +
      '<p class="muted">¿Ya tienes cuenta? <a href="#/login" class="link">Inicia sesión</a></p>'
    ),
    mount(root) {
      CN.bindForm(root.querySelector('#f'), (v, fail) => {
        let ok = checkCommon(v, fail);
        const dup = CN.db().buildings.some((b) => b.name.trim().toLowerCase() === v.building.trim().toLowerCase() && b.address.trim().toLowerCase() === v.address.trim().toLowerCase());
        if (dup) { fail('building', 'Este edificio ya está registrado.'); ok = false; }
        if (!ok) return;
        const db = CN.db();
        const u = { id: CN.uid('u'), role: 'admin', name: v.name.trim(), email: v.email.trim(), password: v.password, phone: '', prefs: { push: true, email: true }, onboardingDone: false };
        db.users.push(u);
        CN.addBuilding(u, { name: v.building, address: v.address });
        CN.save();
        enter(u, 'Cuenta creada. ¡Bienvenido/a a CodeNova!');
      });
    },
  }));

  // ---------- US04: registro de residente ----------
  CN.route('/register/resident', { public: true }, () => ({
    title: 'Crear cuenta',
    html: authShell(
      '<p class="eyebrow">CREAR CUENTA · RESIDENTE</p><h1>Regístrate en tu edificio</h1>' +
      '<form id="f" class="stack">' +
      CN.field({ id: 'name', label: 'Nombre completo' }) +
      CN.field({ id: 'email', label: 'Correo electrónico', type: 'email' }) +
      CN.field({ id: 'password', label: 'Contraseña', type: 'password', hint: 'Mínimo 8 caracteres.', autocomplete: 'new-password' }) +
      CN.field({ id: 'code', label: 'Código de edificio', placeholder: 'Ej. SF240', hint: 'Pídeselo a tu administrador. Para la demo usa <code>SF240</code>.' }) +
      CN.field({ id: 'unit', label: 'Número de departamento', placeholder: 'Ej. 502' }) +
      submit('Registrarme') + '</form>' +
      '<p class="muted">¿Ya tienes cuenta? <a href="#/login" class="link">Inicia sesión</a></p>'
    ),
    mount(root) {
      CN.bindForm(root.querySelector('#f'), (v, fail) => {
        let ok = checkCommon(v, fail);
        const b = CN.db().buildings.find((x) => x.code.toLowerCase() === v.code.trim().toLowerCase());
        if (!b) { fail('code', 'No encontramos un edificio con ese código.'); ok = false; }
        else if (b.units && /^\d+$/.test(v.unit.trim()) && b.units < 1) { ok = false; }
        if (!ok) return;
        const u = { id: CN.uid('u'), role: 'resident', name: v.name.trim(), email: v.email.trim(), password: v.password, phone: '', buildingId: b.id, unit: v.unit.trim(), prefs: { push: true, email: false } };
        CN.db().users.push(u); CN.save();
        enter(u, 'Cuenta creada. Estás vinculado/a a ' + b.name + '.');
      });
    },
  }));

  // ---------- US05: registro de empresa de mantenimiento ----------
  CN.route('/register/company', { public: true }, () => ({
    title: 'Crear cuenta',
    html: authShell(
      '<p class="eyebrow">CREAR CUENTA · EMPRESA DE MANTENIMIENTO</p><h1>Registra tu empresa</h1>' +
      '<form id="f" class="stack">' +
      CN.field({ id: 'name', label: 'Nombre de la empresa' }) +
      CN.field({ id: 'ruc', label: 'RUC', attrs: 'inputmode="numeric" maxlength="11"', placeholder: '11 dígitos' }) +
      CN.field({ id: 'email', label: 'Correo electrónico', type: 'email' }) +
      CN.field({ id: 'password', label: 'Contraseña', type: 'password', hint: 'Mínimo 8 caracteres.', autocomplete: 'new-password' }) +
      CN.multiSelect('buildings', 'Edificios asignados', CN.db().buildings.map((b) => ({ value: b.id, label: b.name + ' · ' + b.district })), 'Selecciona uno o más edificios') +
      submit('Registrar empresa') + '</form>' +
      '<p class="muted">¿Ya tienes cuenta? <a href="#/login" class="link">Inicia sesión</a></p>'
    ),
    mount(root) {
      const vals = CN.bindMultiSelect(root, 'buildings', 'Selecciona uno o más edificios');
      CN.bindForm(root.querySelector('#f'), (v, fail) => {
        let ok = checkCommon(v, fail);
        if (!/^(10|15|17|20)\d{9}$/.test(v.ruc.trim())) { fail('ruc', 'El RUC debe tener 11 dígitos (ej. 20601234567).'); ok = false; }
        else if (CN.db().companies.some((c) => c.ruc === v.ruc.trim())) { fail('ruc', 'Ya existe una empresa con este RUC.'); ok = false; }
        const bids = vals();
        if (!bids.length) { fail('buildings', 'Selecciona al menos un edificio.'); ok = false; }
        if (!ok) return;
        const db = CN.db();
        const c = { id: CN.uid('c'), name: v.name.trim(), ruc: v.ruc.trim(), email: v.email.trim(), baseVisits: 0, baseAvg: 0, hours: [] };
        db.companies.push(c);
        bids.forEach((id) => { const b = CN.building(id); if (b && !b.companyIds.includes(c.id)) b.companyIds.push(c.id); });
        const u = { id: CN.uid('u'), role: 'company', name: v.name.trim(), email: v.email.trim(), password: v.password, phone: '', companyId: c.id, prefs: { push: true, email: true } };
        db.users.push(u); CN.save();
        enter(u, 'Empresa registrada correctamente.');
      });
    },
  }));

  // ---------- US03: recuperación de contraseña ----------
  CN.route('/forgot', { public: true }, () => ({
    title: 'Recuperar acceso',
    html: authShell(
      '<p class="eyebrow">RECUPERAR ACCESO</p><h1>¿Olvidaste tu contraseña?</h1>' +
      '<div id="body"><form id="f" class="stack">' +
      CN.field({ id: 'email', label: 'Correo electrónico registrado', type: 'email' }) +
      submit('Enviar enlace de recuperación', 'send') + '</form>' +
      '<p class="muted">Te enviaremos un enlace válido por 24 horas.</p></div>' +
      '<p class="muted"><a href="#/login" class="link">← Volver a iniciar sesión</a></p>'
    ),
    mount(root) {
      CN.bindForm(root.querySelector('#f'), (v, fail) => {
        if (!CN.isEmail(v.email)) { fail('email', 'Ingresa un correo válido.'); return; }
        const u = CN.db().users.find((x) => x.email.toLowerCase() === v.email.trim().toLowerCase());
        let link = '';
        if (u) {
          const token = CN.uid('tk') + Math.random().toString(36).slice(2, 8);
          CN.db().resets.push({ token, userId: u.id, expires: Date.now() + 24 * CN.H, used: false });
          CN.save();
          link = '<div class="mail-sim"><b>' + ic('mail', 18) + ' Correo simulado</b><p>Para: ' + esc(u.email) + '</p><p>Asunto: Recupera tu acceso a CodeNova</p><a class="btn btn-outline" href="#/reset/' + token + '">Restablecer mi contraseña</a><small class="muted">Este enlace solo aparece aquí porque la demo no envía correos reales.</small></div>';
        }
        root.querySelector('#body').innerHTML = '<div class="notice ok">' + ic('checkCircle', 22) + '<div><b>Revisa tu correo</b><p>Si el correo está registrado, te enviamos un enlace de recuperación válido por 24 horas.</p></div></div>' + link;
      });
    },
  }));

  CN.route('/reset/:token', { public: true }, (p) => {
    const rec = CN.db().resets.find((r) => r.token === p.token);
    const valid = rec && !rec.used && rec.expires > Date.now();
    return {
      title: 'Nueva contraseña',
      html: authShell(valid
        ? '<p class="eyebrow">RECUPERAR ACCESO</p><h1>Crea una nueva contraseña</h1><form id="f" class="stack">' +
          CN.field({ id: 'password', label: 'Nueva contraseña', type: 'password', hint: 'Mínimo 8 caracteres.', autocomplete: 'new-password' }) +
          CN.field({ id: 'confirm', label: 'Repite la contraseña', type: 'password', autocomplete: 'new-password' }) +
          submit('Guardar contraseña', 'check') + '</form>'
        : '<p class="eyebrow">RECUPERAR ACCESO</p><h1>Enlace no válido</h1><p class="muted">El enlace expiró o ya fue usado. Solicita uno nuevo.</p><a class="btn btn-primary" href="#/forgot">Solicitar otro enlace</a>'),
      mount(root) {
        if (!valid) return;
        CN.bindForm(root.querySelector('#f'), (v, fail) => {
          if (v.password.length < 8) { fail('password', 'La contraseña debe tener al menos 8 caracteres.'); return; }
          if (v.password !== v.confirm) { fail('confirm', 'Las contraseñas no coinciden.'); return; }
          CN.userById(rec.userId).password = v.password; rec.used = true; CN.save();
          CN.toast('Contraseña actualizada. Ya puedes iniciar sesión.'); CN.go('/login');
        });
      },
    };
  });
})();
