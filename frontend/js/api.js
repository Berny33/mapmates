const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function messageFor(code, fallback) {
  const messages = {
    EMAIL_ALREADY_REGISTERED: 'An account with this email already exists. Try logging in.',
    INVALID_CREDENTIALS: 'The email or password is incorrect.',
    TOO_MANY_REQUESTS: 'Too many attempts. Please wait a moment and try again.',
  };

  return messages[code] || fallback;
}

export async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const apiError = data?.error;
    const fallback = `Request failed with status ${response.status}.`;
    throw new ApiError(messageFor(apiError?.code, apiError?.message || fallback), {
      status: response.status,
      code: apiError?.code,
      details: apiError?.details,
    });
  }

  return data;
}

export function getCurrentUser() {
  return requestJson('/auth/me');
}

export async function logout() {
  await requestJson('/auth/logout', { method: 'POST' });
  window.location.assign('/login.html');
}

export function redirectToLogin(returnTo = window.location.pathname) {
  const allowedDestinations = ['/trips.html', '/create-trip.html'];
  const safeReturnTo = allowedDestinations.includes(returnTo) ? returnTo : '/trips.html';
  window.location.assign(`/login.html?returnTo=${encodeURIComponent(safeReturnTo)}`);
}

export function getReturnTo() {
  const requested = new URLSearchParams(window.location.search).get('returnTo');
  const allowedDestinations = ['/trips.html', '/create-trip.html'];
  return allowedDestinations.includes(requested) ? requested : '/trips.html';
}
