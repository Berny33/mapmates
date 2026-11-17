import {
  ApiError,
  getCurrentUser,
  logout,
  redirectToLogin,
  requestJson,
} from './api.js';

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

  if (trip.type === 'collaborative' && trip.role === 'organizer') {
    card.appendChild(createInvitationControls(trip.id));
  }

  return card;
}

function formatInvitationExpiry(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function createInvitationControls(tripId) {
  const controls = document.createElement('section');
  controls.className = 'invitation-controls';
  controls.setAttribute('aria-label', 'Invitation link management');

  const toggleButton = document.createElement('button');
  toggleButton.className = 'button button-secondary invitation-toggle';
  toggleButton.type = 'button';
  toggleButton.textContent = 'Manage invitation';
  toggleButton.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('div');
  panel.className = 'invitation-panel';
  panel.hidden = true;

  const status = document.createElement('p');
  status.className = 'invitation-status';
  status.setAttribute('aria-live', 'polite');

  const linkLabel = document.createElement('label');
  linkLabel.className = 'invitation-link-label';
  linkLabel.textContent = 'Invitation link';

  const linkRow = document.createElement('div');
  linkRow.className = 'invitation-link-row';
  linkRow.hidden = true;

  const linkInput = document.createElement('input');
  linkInput.className = 'input invitation-link';
  linkInput.type = 'text';
  linkInput.readOnly = true;
  linkInput.setAttribute('aria-label', 'Generated invitation link');

  const copyButton = document.createElement('button');
  copyButton.className = 'button button-secondary invitation-copy';
  copyButton.type = 'button';
  copyButton.textContent = 'Copy';

  const actions = document.createElement('div');
  actions.className = 'invitation-actions';

  const generateButton = document.createElement('button');
  generateButton.className = 'button button-primary invitation-generate';
  generateButton.type = 'button';
  generateButton.textContent = 'Generate link';

  const revokeButton = document.createElement('button');
  revokeButton.className = 'button button-secondary invitation-revoke';
  revokeButton.type = 'button';
  revokeButton.textContent = 'Revoke';
  revokeButton.hidden = true;

  linkRow.append(linkInput, copyButton);
  actions.append(generateButton, revokeButton);
  panel.append(status, linkLabel, linkRow, actions);
  controls.append(toggleButton, panel);

  const invitationUrl = `/trips/${encodeURIComponent(tripId)}/invitation`;
  let loaded = false;
  let active = false;

  function showPanelStatus(message, kind = '') {
    status.textContent = message;
    status.className = `invitation-status ${kind}`;
  }

  function updateActiveState(isActive, expiresAt) {
    active = isActive;
    generateButton.textContent = active ? 'Regenerate link' : 'Generate link';
    revokeButton.hidden = !active;
    linkLabel.hidden = !linkInput.value;
    linkRow.hidden = !linkInput.value;

    if (active && expiresAt) {
      showPanelStatus(
        `An invitation link is active until ${formatInvitationExpiry(expiresAt)}. Regenerate it to copy a fresh link.`,
      );
    } else {
      showPanelStatus('No active invitation link.');
    }
  }

  async function loadInvitationStatus() {
    showPanelStatus('Checking invitation status…');

    try {
      const invitation = await requestJson(invitationUrl);
      loaded = true;
      updateActiveState(invitation.active, invitation.expiresAt);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirectToLogin('/trips.html');
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load invitation status.';
      showPanelStatus(message, 'error');
    }
  }

  toggleButton.addEventListener('click', () => {
    const expanded = toggleButton.getAttribute('aria-expanded') === 'true';
    toggleButton.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;

    if (!expanded && !loaded) {
      loadInvitationStatus();
    }
  });

  generateButton.addEventListener('click', async () => {
    generateButton.disabled = true;
    linkInput.value = '';
    linkLabel.hidden = true;
    linkRow.hidden = true;
    showPanelStatus(
      active ? 'Regenerating invitation link…' : 'Generating invitation link…',
    );

    try {
      const invitation = await requestJson(invitationUrl, { method: 'POST' });
      const link = new URL('/join.html', window.location.origin);
      link.searchParams.set('token', invitation.token);
      linkInput.value = link.toString();
      loaded = true;
      active = true;
      linkLabel.hidden = false;
      linkRow.hidden = false;
      revokeButton.hidden = false;
      generateButton.textContent = 'Regenerate link';
      showPanelStatus(
        `Link ready. It expires ${formatInvitationExpiry(invitation.expiresAt)}. Regenerating it invalidates this link.`,
        'success',
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirectToLogin('/trips.html');
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to generate invitation link.';
      showPanelStatus(message, 'error');
    } finally {
      generateButton.disabled = false;
    }
  });

  revokeButton.addEventListener('click', async () => {
    revokeButton.disabled = true;
    showPanelStatus('Revoking invitation link…');

    try {
      await requestJson(invitationUrl, { method: 'DELETE' });
      active = false;
      linkInput.value = '';
      updateActiveState(false, null);
      showPanelStatus('Invitation link revoked.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirectToLogin('/trips.html');
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to revoke invitation link.';
      showPanelStatus(message, 'error');
    } finally {
      revokeButton.disabled = false;
    }
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(linkInput.value);
      showPanelStatus('Invitation link copied.', 'success');
    } catch {
      linkInput.focus();
      linkInput.select();
      showPanelStatus('Select and copy the invitation link.', 'error');
    }
  });

  return controls;
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
    if (
      typeof detail.field !== 'string' ||
      typeof detail.message !== 'string'
    ) {
      return;
    }

    const input = form.elements.namedItem(detail.field);
    const errorNode = Array.from(
      form.querySelectorAll('[data-error-for]'),
    ).find((node) => node.dataset.errorFor === detail.field);

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

    const query = new URLSearchParams(window.location.search);
    if (query.get('joined') === '1') {
      showStatus('You joined the trip. It is now in your trips.', 'success');
    } else if (query.get('alreadyMember') === '1') {
      showStatus('You were already a member of this trip.', 'success');
    } else if (query.get('created') === '1') {
      showStatus('Trip created successfully.', 'success');
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin('/trips.html');
      return;
    }

    const message =
      error instanceof Error ? error.message : 'Unable to load trips.';
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

    const message =
      error instanceof Error ? error.message : 'Unable to create trip.';
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

    const message =
      error instanceof Error ? error.message : 'Unable to verify your session.';
    showStatus(message, 'error');
    return;
  }

  const logoutButton = document.getElementById('logoutButton');
  logoutButton?.addEventListener('click', async () => {
    try {
      await logout();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to log out.';
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
