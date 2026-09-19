/* FleetCare app — autenticación: HU-38 registro, HU-39 login, HU-40 recuperar contraseña */
(function () {
  'use strict';
  const R = window.FleetCare;
  const { html, ico } = R;

  const brand = html`<a class="auth-brand" href="#/login"><img class="logo-img" src="../img/fleetcare-logo-128.png" alt="" width="40" height="40"><span>FleetCare</span></a>`;
  const pw = (label, name, auto, extra = '') => html`<div class="field"><label for="pw-${name}">${label}</label>
    <div class="pw"><input id="pw-${name}" name="${name}" type="password" autocomplete="${auto}" ${R.raw(extra)}><button type="button" class="pw-toggle" data-action="toggle-pass" aria-label="Mostrar contraseña">${ico('eye', 18)}</button></div>
    <span class="field-error" data-err="${name}" role="alert"></span></div>`;
  const shellAuth = (inner, aside) => html`<div class="auth-card">${brand}${inner}</div>${aside || ''}<a class="auth-back" href="../index.html">← Volver al sitio de FleetCare</a>`;

  R.actions['toggle-pass'] = (el) => {
    const i = el.parentElement.querySelector('input');
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    el.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  };

  /* ----- Login ----- */
  R.route('/login', null, () => ({
    title: 'Inicia sesión',
    html: shellAuth(html`<h2>Inicia sesión</h2><p class="auth-sub">Accede al panel de tu flota o a tu app de conductor.</p>
      <form data-form="login" novalidate>
        ${R.field({ label: 'Correo electrónico', name: 'email', type: 'email', attrs: { autocomplete: 'email', inputmode: 'email' } })}
        ${pw('Contraseña', 'password', 'current-password')}
        <p class="form-alert" data-err="form" role="alert"></p>
        <button class="btn btn-primary btn-block" type="submit">Iniciar sesión</button>
      </form>
      <div class="auth-links"><a href="#/recuperar">¿Olvidaste tu contraseña?</a><a href="#/registro">Crear cuenta</a></div>`,
    html`<div class="demo-box"><strong>Cuentas de demostración</strong><p>Explora la app con datos de ejemplo (contraseña <code>${R.DEMO_PASSWORD}</code>).</p>
      <div class="demo-btns"><button class="btn btn-outline btn-sm" data-action="demo-login" data-role="manager">Entrar como jefe de flota</button><button class="btn btn-outline btn-sm" data-action="demo-login" data-role="driver">Entrar como conductor</button></div>
      <button class="link-btn" data-action="reset-demo">Restablecer datos de demostración</button></div>`),
  }));

  R.actions['demo-login'] = (el) => {
    const f = R.$('form[data-form="login"]');
    f.elements.email.value = el.getAttribute('data-role') === 'manager' ? 'jefe@fleetcare.pe' : 'conductor@fleetcare.pe';
    f.elements.password.value = R.DEMO_PASSWORD;
    f.requestSubmit();
  };
  R.actions['reset-demo'] = async () => {
    const ok = await R.confirm({ title: '¿Restablecer datos de demostración?', text: 'Se borrarán todos los datos guardados en este navegador (incluidas las cuentas que hayas creado) y se cargarán los datos de ejemplo.', confirm: 'Restablecer', danger: true });
    if (!ok) return;
    await R.resetDemo();
    R.toast('Datos de demostración restablecidos.');
    R.dispatch();
  };

  R.forms.login = async (form) => {
    const d = R.formData(form);
    const errs = {};
    if (!R.validEmail(d.email)) errs.email = 'Ingresa un correo válido.';
    if (!d.password) errs.password = 'Ingresa tu contraseña.';
    if (R.setErrors(form, errs)) return;
    const btn = R.$('button[type=submit]', form);
    btn.disabled = true;
    const u = R.state().users.find((x) => x.email.toLowerCase() === d.email.toLowerCase());
    const h = await R.hash(d.password);
    btn.disabled = false;
    if (!u || u.passHash !== h) return R.setErrors(form, { form: 'Correo o contraseña incorrectos.' });
    if (u.active === false) return R.setErrors(form, { form: 'Tu acceso fue revocado. Contacta a tu jefe de flota.' });
    R.session.set(u.id);
    R.toast(`Hola, ${u.name.split(' ')[0]}.`, 'ok', 'Sesión iniciada');
    R.go(R.home(u));
  };

  /* ----- Registro (jefe de flota) ----- */
  R.route('/registro', null, () => ({
    title: 'Crea tu cuenta',
    html: shellAuth(html`<h2>Crea tu cuenta</h2><p class="auth-sub">Regístrate como jefe de flota y empieza a anticipar el mantenimiento.</p>
      <form data-form="register" novalidate>
        ${R.field({ label: 'Nombre completo', name: 'name', attrs: { autocomplete: 'name' } })}
        ${R.field({ label: 'Correo electrónico', name: 'email', type: 'email', attrs: { autocomplete: 'email', inputmode: 'email' } })}
        ${R.field({ label: 'Empresa de transporte', name: 'company', attrs: { autocomplete: 'organization' } })}
        ${pw('Contraseña', 'password', 'new-password')}
        <span class="hint">Mínimo 6 caracteres.</span>
        <p class="form-alert" data-err="form" role="alert"></p>
        <button class="btn btn-primary btn-block" type="submit">Crear cuenta</button>
      </form>
      <div class="auth-links"><a href="#/login">¿Ya tienes cuenta? Inicia sesión</a></div>`),
  }));

  R.forms.register = async (form) => {
    const d = R.formData(form);
    const errs = {};
    if (d.name.length < 3) errs.name = 'Ingresa tu nombre completo.';
    if (!R.validEmail(d.email)) errs.email = 'Ingresa un correo válido.';
    else if (R.state().users.some((u) => u.email.toLowerCase() === d.email.toLowerCase())) errs.email = 'Ya existe una cuenta con este correo.';
    if (d.company.length < 2) errs.company = 'Ingresa el nombre de tu empresa.';
    if (d.password.length < 6) errs.password = 'La contraseña debe tener al menos 6 caracteres.';
    if (R.setErrors(form, errs)) return;
    const st = R.state();
    const cid = R.newCompanyId();
    st.companies[cid] = R.blankDb({ name: d.company, ruc: '', address: '', email: d.email });
    const user = { id: R.uid('u_'), name: d.name, email: d.email, passHash: await R.hash(d.password), role: 'manager', companyId: cid, active: true };
    st.users.push(user);
    if (!R.save()) return;
    R.session.set(user.id);
    R.toast('Empieza registrando tus vehículos.', 'ok', '¡Cuenta creada!');
    R.go('/dashboard');
  };

  /* ----- Recuperar contraseña ----- */
  R.route('/recuperar', null, () => {
    if (R.query.paso === 'nueva') {
      return {
        title: 'Nueva contraseña',
        html: shellAuth(html`<h2>Nueva contraseña</h2><p class="auth-sub">Elige una contraseña nueva para <strong>${R.ui.resetEmail || 'tu cuenta'}</strong>.</p>
          <form data-form="reset" novalidate>${pw('Nueva contraseña', 'password', 'new-password')}${pw('Repite la contraseña', 'again', 'new-password')}
            <p class="form-alert" data-err="form" role="alert"></p><button class="btn btn-primary btn-block" type="submit">Guardar contraseña</button></form>`),
      };
    }
    return {
      title: 'Recuperar contraseña',
      html: shellAuth(html`<h2>Recuperar contraseña</h2><p class="auth-sub">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
        <form data-form="recover" novalidate>${R.field({ label: 'Correo electrónico', name: 'email', type: 'email', attrs: { autocomplete: 'email', inputmode: 'email' } })}
          <button class="btn btn-primary btn-block" type="submit">Enviar enlace de recuperación</button></form>
        <div class="sent" id="recover-sent" hidden><strong>Revisa tu correo</strong><p>Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.</p>
          <p class="demo-note">Esta demostración no envía correos reales.</p><a class="btn btn-outline btn-block" href="#/recuperar?paso=nueva">Abrir enlace de demostración</a></div>
        <div class="auth-links"><a href="#/login">← Volver a iniciar sesión</a></div>`),
    };
  });

  R.forms.recover = (form) => {
    const d = R.formData(form);
    if (R.setErrors(form, R.validEmail(d.email) ? {} : { email: 'Ingresa un correo válido.' })) return;
    R.ui.resetEmail = d.email;
    form.hidden = true;
    R.$('#recover-sent').hidden = false;
  };

  R.forms.reset = async (form) => {
    const d = R.formData(form);
    const errs = {};
    if (d.password.length < 6) errs.password = 'Debe tener al menos 6 caracteres.';
    if (d.again !== d.password) errs.again = 'Las contraseñas no coinciden.';
    if (R.setErrors(form, errs)) return;
    const u = R.state().users.find((x) => x.email.toLowerCase() === String(R.ui.resetEmail || '').toLowerCase());
    if (!u) return R.setErrors(form, { form: 'El enlace no es válido o ya expiró. Solicita uno nuevo.' });
    u.passHash = await R.hash(d.password);
    R.save();
    R.toast('Ya puedes iniciar sesión con tu nueva contraseña.', 'ok', 'Contraseña actualizada');
    R.go('/login');
  };
})();
