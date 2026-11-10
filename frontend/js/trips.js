import { ApiError, getCurrentUser, logout, redirectToLogin, requestJson } from './api.js';

const tripList = document.getElementById('tripList');
const tripStatus = document.getElementById('tripStatus');
const tripForm = document.getElementById('tripForm');
const userName = document.getElementById('userName');

function showStatus(text, kind = '') {
  if (!tripStatus) {
    return;
  }

  tripStatus.textContent = text;
  tripStatus.className = `message ${kind}`;
}

function formatTripDates(startDate, endDate) {
  function formatDate(value) {
    const parts = value.split('-').map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      timeZone: 'UTC',
    }).format(date);
  }

  const start = formatDate(startDate);
  const end = formatDate(endDate);
  const endYear = endDate.slice(0, 4);
  const startYear = startDate.slice(0, 4);
  return `${start} – ${end}, ${startYear === endYear ? endYear : `${startYear} – ${endYear}`}`;
}

function createTripCard(trip) {
  const card = document.createElement('article');
  card.className = 'trip-card';

  const top = document.createElement('div');
  const header = document.createElement('div');
  header.className = 'trip-card-top';

  const name = document.createElement('h2');
  name.textContent = trip.name;

  const type = document.createElement('span');
  type.className = `trip-type${trip.type === 'collaborative' ? ' group' : ''}`;
  type.textContent = trip.type === 'collaborative' ? 'Group' : 'Solo';

  const dates = document.createElement('p');
  dates.className = 'trip-dates';
  dates.textContent = formatTripDates(trip.startDate, trip.endDate);

  const destination = document.createElement('p');
  destination.className = 'trip-destination';
  destination.textContent = trip.destination;

  header.append(name, type);
  top.append(header, dates, destination);

  const footer = document.createElement('div');
  footer.className = 'trip-card-footer';

  const role = document.createElement('span');
  role.className = 'trip-role';
  role.textContent = trip.role === 'organizer' ? 'Organizer' : 'Member';
  footer.appendChild(role);

  card.append(top, footer);
  return card;
}

function renderTrips(trips) {
  if (!tripList) {
    return;
  }

  tripList.replaceChildren();

  if (!Array.isArray(trips) || trips.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';

    const text = document.createElement('p');
    text.textContent = 'No trips yet. Start planning your first journey.';

    const link = document.createElement('a');
    link.className = 'button button-primary';
    link.href = '/create-trip.html';
    link.textContent = 'Create a trip';

    empty.append(text, link);
    tripList.appendChild(empty);
    return;
  }

  trips.forEach((trip) => {
    tripList.appendChild(createTripCard(trip));
  });
}

function clearFieldErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((node) => {
    node.textContent = '';
  });
  form.querySelectorAll('[aria-invalid="true"]').forEach((input) => {
    input.removeAttribute('aria-invalid');
  });
}

function showFieldErrors(form, details) {
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

async function loadTrips() {
  try {
    const trips = await requestJson('/trips');
    renderTrips(trips);

    if (new URLSearchParams(window.location.search).get('created') === '1') {
      showStatus('Trip created successfully.', 'success');
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin('/trips.html');
      return;
    }

    const message = error instanceof Error ? error.message : 'Unable to load trips.';
    showStatus(message, 'error');
  }
}

async function createTrip(event) {
  event.preventDefault();
  clearFieldErrors(tripForm);

  if (!tripForm.reportValidity()) {
    return;
  }

  const formData = new FormData(tripForm);
  const payload = {
    name: String(formData.get('name') || '').trim(),
    destination: String(formData.get('destination') || '').trim(),
    startDate: String(formData.get('startDate') || ''),
    endDate: String(formData.get('endDate') || ''),
    type: String(formData.get('type') || 'collaborative'),
  };
  const submitButton = document.getElementById('createTripButton');
  submitButton.disabled = true;
  showStatus('Creating trip…');

  try {
    await requestJson('/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    window.location.assign('/trips.html?created=1');
  } catch (error) {
    if (error instanceof ApiError) {
      showFieldErrors(tripForm, error.details);
    }

    const message = error instanceof Error ? error.message : 'Unable to create trip.';
    showStatus(message, 'error');
  } finally {
    submitButton.disabled = false;
  }
}

async function initialize() {
  try {
    const user = await getCurrentUser();
    if (userName) {
      userName.textContent = user.name;
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const returnTo = tripForm ? '/create-trip.html' : '/trips.html';
      redirectToLogin(returnTo);
      return;
    }

    const message = error instanceof Error ? error.message : 'Unable to verify your session.';
    showStatus(message, 'error');
    return;
  }

  const logoutButton = document.getElementById('logoutButton');
  logoutButton?.addEventListener('click', async () => {
    try {
      await logout();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log out.';
      showStatus(message, 'error');
    }
  });

  if (tripForm) {
    tripForm.addEventListener('submit', createTrip);
  } else {
    await loadTrips();
  }
}

initialize();
