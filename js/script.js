// Mobile menu toggle
const header = document.getElementById('header');
const menuToggle = document.getElementById('menu-toggle');
const mainNav = document.getElementById('main-nav');

menuToggle.addEventListener('click', () => {
  const isOpen = header.classList.toggle('nav-open');
  menuToggle.classList.toggle('open', isOpen);
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

mainNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    header.classList.remove('nav-open');
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

// FAQ accordion
document.querySelectorAll('.faq-item').forEach((item) => {
  const question = item.querySelector('.faq-question');
  question.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');

    document.querySelectorAll('.faq-item.open').forEach((openItem) => {
      if (openItem !== item) {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      }
    });

    item.classList.toggle('open', !isOpen);
    question.setAttribute('aria-expanded', String(!isOpen));
  });
});

// Contact form validation + simulated submit
const form = document.getElementById('contact-form');
const feedback = document.getElementById('form-feedback');

function setError(field, message) {
  const wrapper = field.closest('.form-field');
  const errorEl = wrapper ? wrapper.querySelector('.field-error') : null;
  if (wrapper) wrapper.classList.toggle('has-error', Boolean(message));
  if (errorEl) errorEl.textContent = message || '';
}

function validateForm() {
  let isValid = true;

  const firstname = form.firstname;
  const lastname = form.lastname;
  const email = form.email;
  const subject = form.subject;
  const message = form.message;
  const terms = form.terms;

  [firstname, lastname, subject].forEach((field) => {
    if (!field.value.trim()) {
      setError(field, 'Este campo es obligatorio.');
      isValid = false;
    } else {
      setError(field, '');
    }
  });

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.value.trim()) {
    setError(email, 'Este campo es obligatorio.');
    isValid = false;
  } else if (!emailPattern.test(email.value.trim())) {
    setError(email, 'Ingresa un correo válido.');
    isValid = false;
  } else {
    setError(email, '');
  }

  if (!message.value.trim()) {
    setError(message, 'Escribe tu mensaje.');
    isValid = false;
  } else {
    setError(message, '');
  }

  if (!terms.checked) {
    feedback.textContent = 'Debes aceptar los términos y condiciones.';
    feedback.className = 'form-feedback error';
    isValid = false;
  }

  return isValid;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!validateForm()) {
    if (form.terms.checked) {
      feedback.textContent = 'Revisa los campos marcados en rojo.';
      feedback.className = 'form-feedback error';
    }
    return;
  }

  feedback.textContent = '¡Gracias! Tu mensaje fue enviado. Te contactaremos pronto.';
  feedback.className = 'form-feedback success';
  form.reset();
});
