import { ApiError, redirectToLogin, requestJson } from './api.js';

const joinForm = document.getElementById('joinTripForm');
const invitationLinkInput = document.getElementById('invitationLinkInput');
const previewTripButton = document.getElementById('previewTripButton');
const joinPageStatus = document.getElementById('joinPageStatus');
const joinDialog = document.getElementById('joinDialog');
const joinDialogStatus = document.getElementById('joinDialogStatus');
const confirmJoinButton = document.getElementById('confirmJoinButton');
const cancelJoinButton = document.getElementById('cancelJoinButton');
let invitationToken = null;

function showPageStatus(message, kind = '') {
  joinPageStatus.textContent = message;
  joinPageStatus.className = `message join-page-status ${kind}`;
}

function showDialogStatus(message, kind = '') {
  joinDialogStatus.textContent = message;
  joinDialogStatus.className = `message ${kind}`;
}

function getInvitationToken(value) {
  try {
    const url = new URL(value.trim(), window.location.origin);
    const tokens = url.searchParams.getAll('token');
    const onlyTokenParameter = Array.from(url.searchParams.keys()).every(
      (key) => key === 'token',
    );

    if (
      url.origin !== window.location.origin ||
      url.pathname !== '/join.html' ||
      url.hash ||
      !onlyTokenParameter ||
      tokens.length !== 1 ||
      !/^[A-Za-z0-9_-]{43}$/.test(tokens[0])
    ) {
      return null;
    }

    return tokens[0];
  } catch {
    return null;
  }
}

function formatTripDates(startDate, endDate) {
  function formatDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function displayTripPreview(trip) {
  document.getElementById('previewTripName').textContent = trip.name;
  document.getElementById('previewDestination').textContent = trip.destination;
  document.getElementById('previewDates').textContent = formatTripDates(
    trip.startDate,
    trip.endDate,
  );
  document.getElementById('previewType').textContent =
    trip.type === 'collaborative' ? 'Group trip' : 'Solo trip';

  showDialogStatus('Review the trip details before joining.');
  joinDialog.showModal();
  confirmJoinButton.focus();
}

async function previewInvitation(token) {
  previewTripButton.disabled = true;
  showPageStatus('Loading trip details…');

  try {
    const trip = await requestJson(`/invitations/${encodeURIComponent(token)}`);
    invitationToken = token;
    displayTripPreview(trip);
    showPageStatus('');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin(`/join.html?token=${encodeURIComponent(token)}`);
      return;
    }

    if (error instanceof ApiError && error.status === 404) {
      showPageStatus(
        'This invitation link is invalid or has expired.',
        'error',
      );
    } else {
      showPageStatus(
        error instanceof Error ? error.message : 'Unable to load trip details.',
        'error',
      );
    }
  } finally {
    previewTripButton.disabled = false;
  }
}

async function handlePreviewSubmit(event) {
  event.preventDefault();
  const token = getInvitationToken(invitationLinkInput.value);

  if (!token) {
    invitationLinkInput.setAttribute('aria-invalid', 'true');
    showPageStatus('Enter a valid MapMates invitation link.', 'error');
    invitationLinkInput.focus();
    return;
  }

  invitationLinkInput.removeAttribute('aria-invalid');
  await previewInvitation(token);
}

async function pasteInvitationLink() {
  if (!navigator.clipboard?.readText) {
    invitationLinkInput.focus();
    showPageStatus('Paste the invitation link into the field.', 'error');
    return;
  }

  try {
    const link = await navigator.clipboard.readText();
    if (!link.trim()) {
      showPageStatus('Your clipboard is empty.', 'error');
      return;
    }

    invitationLinkInput.value = link.trim();
    invitationLinkInput.removeAttribute('aria-invalid');
    showPageStatus('Invitation link pasted.', 'success');
  } catch {
    invitationLinkInput.focus();
    showPageStatus(
      'Clipboard access is unavailable. Paste the link into the field.',
      'error',
    );
  }
}

async function confirmJoin() {
  if (!invitationToken) {
    joinDialog.close();
    showPageStatus('Enter an invitation link to preview the trip.', 'error');
    return;
  }

  confirmJoinButton.disabled = true;
  cancelJoinButton.disabled = true;
  showDialogStatus('Joining trip…');

  try {
    const result = await requestJson(
      `/invitations/${encodeURIComponent(invitationToken)}/join`,
      { method: 'POST' },
    );
    const destination = result.joined ? 'joined=1' : 'alreadyMember=1';
    window.location.assign(`/trips.html?${destination}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin(
        `/join.html?token=${encodeURIComponent(invitationToken)}`,
      );
      return;
    }

    if (error instanceof ApiError && error.status === 404) {
      joinDialog.close();
      invitationToken = null;
      showPageStatus(
        'This invitation link is invalid or has expired.',
        'error',
      );
    } else if (error instanceof ApiError && error.code === 'TRIP_FULL') {
      showDialogStatus('This trip has reached its member limit.', 'error');
    } else {
      showDialogStatus(
        error instanceof Error ? error.message : 'Unable to join this trip.',
        'error',
      );
    }
  } finally {
    confirmJoinButton.disabled = false;
    cancelJoinButton.disabled = false;
  }
}

joinForm.addEventListener('submit', handlePreviewSubmit);
document
  .getElementById('pasteInvitationButton')
  .addEventListener('click', pasteInvitationLink);
confirmJoinButton.addEventListener('click', confirmJoin);
cancelJoinButton.addEventListener('click', () => joinDialog.close());

const initialParams = new URLSearchParams(window.location.search);
const initialTokens = initialParams.getAll('token');
const hasInitialInvitation = initialParams.has('token');
const hasOnlyInitialToken = Array.from(initialParams.keys()).every(
  (key) => key === 'token',
);

if (
  hasInitialInvitation &&
  (initialTokens.length !== 1 || !hasOnlyInitialToken)
) {
  showPageStatus('This invitation link is invalid or has expired.', 'error');
} else if (initialTokens.length === 1) {
  const [initialToken] = initialTokens;
  if (!/^[A-Za-z0-9_-]{43}$/.test(initialToken)) {
    showPageStatus('This invitation link is invalid or has expired.', 'error');
  } else {
    invitationLinkInput.value = new URL(
      '/join.html',
      window.location.origin,
    ).toString();
    const inviteUrl = new URL(invitationLinkInput.value);
    inviteUrl.searchParams.set('token', initialToken);
    invitationLinkInput.value = inviteUrl.toString();
    previewInvitation(initialToken);
  }
}
