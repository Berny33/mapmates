import { ApiError, getReturnTo, requestJson } from './api.js';

const form = document.getElementById('authForm');
const formMessage = document.getElementById('formMessage');

if (form) {
  const nameField = document.getElementById('nameField');
  const nameInput = document.getElementById('nameInput');
  const passwordInput = document.getElementById('passwordInput');
  const submitButton = document.getElementById('authSubmit');
  const tabs = document.querySelectorAll('[data-auth-tab]');
  let mode = document.body.dataset.authMode === 'register' ? 'register' : 'login';

  function showMessage(text, kind = '') {
    formMessage.textContent = text;
    formMessage.className = `message ${kind}`;
  }

  function clearFieldErrors() {
    form.querySelectorAll('[data-error-for]').forEach((errorNode) => {
      errorNode.textContent = '';
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach((input) => {
      input.removeAttribute('aria-invalid');
    });
  }

  function showFieldErrors(details) {
    if (!Array.isArray(details)) {
      return;
    }

    details.forEach((detail) => {
      if (typeof detail.field !== 'string' || typeof detail.message !== 'string') {
        return;
      }

      const input = form.elements.namedItem(detail.field);
      const errorNode = Array.from(form.querySelectorAll('[data-error-for]')).find(
        (node) => node.dataset.errorFor === detail.field,
      );

      if (input instanceof HTMLInputElement && errorNode) {
        input.setAttribute('aria-invalid', 'true');
        errorNode.textContent = detail.message;
      }
    });
  }

  function setMode(nextMode) {
    mode = nextMode;
    const isRegister = mode === 'register';
    nameField.hidden = !isRegister;
    nameInput.required = isRegister;
    passwordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
    submitButton.textContent = isRegister ? 'Create account' : 'Log in';

    tabs.forEach((tab) => {
      const selected = tab.dataset.authTab === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    clearFieldErrors();
    showMessage('');
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      setMode(tab.dataset.authTab);
    });
  });

  const registered = new URLSearchParams(window.location.search).get('registered') === '1';
  if (registered) {
    mode = 'login';
  }

  setMode(mode);
  if (registered) {
    showMessage('Account created. Please log in.', 'success');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors();

    if (!form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);
    const payload = {
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || ''),
    };

    if (mode === 'register') {
      payload.name = String(formData.get('name') || '').trim();
    }

    submitButton.disabled = true;
    showMessage(mode === 'register' ? 'Creating your account…' : 'Signing in…');

    try {
      if (mode === 'register') {
        await requestJson('/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const returnTo = getReturnTo();
        window.location.assign(`/login.html?registered=1&returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }

      await requestJson('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      window.location.assign(getReturnTo());
    } catch (error) {
      if (error instanceof ApiError) {
        showFieldErrors(error.details);
      }

      const message = error instanceof Error ? error.message : 'Unable to continue.';
      showMessage(message, 'error');
    } finally {
      submitButton.disabled = false;
    }
  });
}
