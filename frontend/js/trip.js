import {
  ApiError,
  getCurrentUser,
  logout,
  redirectToLogin,
  requestJson,
} from './api.js';

const tripId = new URLSearchParams(window.location.search).get('id');
const tripName = document.getElementById('tripName');
const tripSummary = document.getElementById('tripSummary');
const tripPageStatus = document.getElementById('tripPageStatus');
const placeSearchForm = document.getElementById('placeSearchForm');
const placeSearchInput = document.getElementById('placeSearchInput');
const searchPlacesButton = document.getElementById('searchPlacesButton');
const placeSearchStatus = document.getElementById('placeSearchStatus');
const placeResults = document.getElementById('placeResults');
const selectedPlaceNode = document.getElementById('selectedPlace');
const proposalForm = document.getElementById('proposalForm');
const proposalWorkspace = document.getElementById('proposalWorkspace');
const proposalStatus = document.getElementById('proposalStatus');
const createProposalButton = document.getElementById('createProposalButton');
const proposalResult = document.getElementById('proposalResult');
const itinerarySection = document.getElementById('itinerarySection');
const itineraryStatus = document.getElementById('itineraryStatus');
const approvedActivities = document.getElementById('approvedActivities');
const userName = document.getElementById('userName');

let trip = null;
let selectedPlace = null;

function showStatus(node, message, kind = '') {
  node.textContent = message;
  node.className = `message ${kind}`;
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

function setTripDetails(details) {
  trip = details;
  tripName.textContent = trip.name;
  tripSummary.textContent = `${trip.destination} · ${formatTripDates(
    trip.startDate,
    trip.endDate,
  )} · ${trip.type === 'collaborative' ? 'Group trip' : 'Solo trip'}`;

  const proposalDay = document.getElementById('proposalDay');
  proposalDay.min = trip.startDate;
  proposalDay.max = trip.endDate;
}

function selectPlace(place, button) {
  selectedPlace = place;
  placeResults.querySelectorAll('button').forEach((resultButton) => {
    resultButton.setAttribute('aria-pressed', String(resultButton === button));
  });
  selectedPlaceNode.textContent = `Selected place: ${place.placeName}`;
  selectedPlaceNode.className = 'selected-place success';
}

function renderPlaceResults(places) {
  placeResults.replaceChildren();

  if (places.length === 0) {
    showStatus(placeSearchStatus, 'No places found. Try a different search.');
    return;
  }

  places.forEach((place) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'place-result';
    button.type = 'button';
    button.textContent = place.placeName;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectPlace(place, button));
    item.appendChild(button);
    placeResults.appendChild(item);
  });

  showStatus(
    placeSearchStatus,
    `${places.length} place(s) found. Select one to continue.`,
  );
}

async function searchPlaces(event) {
  event.preventDefault();
  const query = placeSearchInput.value.trim();

  placeResults.replaceChildren();
  selectedPlace = null;
  selectedPlaceNode.textContent = '';
  selectedPlaceNode.className = 'selected-place';

  if (query.length < 2) {
    showStatus(
      placeSearchStatus,
      'Enter at least 2 characters to search.',
      'error',
    );
    placeSearchInput.focus();
    return;
  }

  searchPlacesButton.disabled = true;
  showStatus(placeSearchStatus, 'Searching places…');

  try {
    const places = await requestJson(
      `/places/search?q=${encodeURIComponent(query)}`,
    );
    renderPlaceResults(places);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin(`/trip.html?id=${encodeURIComponent(tripId)}`);
      return;
    }

    const message =
      error instanceof ApiError && error.status === 429
        ? 'Please wait a moment before searching again.'
        : error instanceof Error
          ? error.message
          : 'Unable to search places.';
    showStatus(placeSearchStatus, message, 'error');
  } finally {
    searchPlacesButton.disabled = false;
  }
}

function clearFieldErrors() {
  proposalForm.querySelectorAll('[data-error-for]').forEach((node) => {
    node.textContent = '';
  });
  proposalForm.querySelectorAll('[aria-invalid="true"]').forEach((input) => {
    input.removeAttribute('aria-invalid');
  });
}

function showFieldErrors(details) {
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

    const input = proposalForm.elements.namedItem(detail.field);
    const errorNode = Array.from(
      proposalForm.querySelectorAll('[data-error-for]'),
    ).find((node) => node.dataset.errorFor === detail.field);

    if (input instanceof HTMLElement && errorNode) {
      input.setAttribute('aria-invalid', 'true');
      errorNode.textContent = detail.message;
    }
  });
}

function formatDeadline(value) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function renderProposalResult(proposal) {
  const heading = document.createElement('h2');
  heading.textContent = 'Your proposal';

  const place = document.createElement('p');
  place.className = 'proposal-result-place';
  place.textContent = proposal.placeName;

  const schedule = document.createElement('p');
  schedule.textContent = `${proposal.day} · ${proposal.startTime}–${proposal.endTime}`;

  const status = document.createElement('p');
  status.className = 'message success';
  status.textContent =
    proposal.status === 'approved'
      ? 'Approved and added to the itinerary.'
      : `Open for voting until ${formatDeadline(proposal.votingDeadline)}.`;

  proposalResult.replaceChildren(heading, place, schedule, status);
  proposalResult.hidden = false;
}

function renderApprovedActivities(proposals) {
  approvedActivities.replaceChildren();

  if (proposals.length === 0) {
    showStatus(itineraryStatus, 'No approved activities yet.');
    return;
  }

  proposals.forEach((proposal) => {
    const item = document.createElement('li');
    const heading = document.createElement('h3');
    heading.textContent = proposal.placeName;

    const schedule = document.createElement('p');
    schedule.textContent = `${proposal.day} · ${proposal.startTime}–${proposal.endTime}`;

    const category = document.createElement('p');
    category.className = 'activity-category';
    category.textContent = proposal.category;

    item.append(heading, schedule, category);
    approvedActivities.appendChild(item);
  });

  showStatus(itineraryStatus, '');
}

async function loadApprovedActivities() {
  try {
    const proposals = await requestJson(
      `/trips/${encodeURIComponent(tripId)}/itinerary`,
    );
    renderApprovedActivities(proposals);
    itinerarySection.hidden = false;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin(`/trip.html?id=${encodeURIComponent(tripId)}`);
      return;
    }

    showStatus(
      itineraryStatus,
      error instanceof Error
        ? error.message
        : 'Unable to load approved activities.',
      'error',
    );
    itinerarySection.hidden = false;
  }
}

async function createProposal(event) {
  event.preventDefault();
  clearFieldErrors();

  if (!selectedPlace) {
    showStatus(proposalStatus, 'Search for and select a place first.', 'error');
    placeSearchInput.focus();
    return;
  }

  if (!proposalForm.reportValidity()) {
    return;
  }

  const formData = new FormData(proposalForm);
  const payload = {
    placeName: selectedPlace.placeName,
    latitude: selectedPlace.latitude,
    longitude: selectedPlace.longitude,
    category: String(formData.get('category') || ''),
    day: String(formData.get('day') || ''),
    startTime: String(formData.get('startTime') || ''),
    endTime: String(formData.get('endTime') || ''),
    note: String(formData.get('note') || ''),
    votingDurationHours: Number(formData.get('votingDurationHours')),
  };

  createProposalButton.disabled = true;
  showStatus(proposalStatus, 'Creating proposal…');

  try {
    const proposal = await requestJson(
      `/trips/${encodeURIComponent(tripId)}/proposals`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    const confirmation =
      proposal.status === 'approved'
        ? 'Activity approved and added to the itinerary.'
        : `Proposal created. Voting is open until ${formatDeadline(
            proposal.votingDeadline,
          )}.`;
    showStatus(proposalStatus, confirmation, 'success');
    renderProposalResult(proposal);
    if (proposal.status === 'approved') {
      await loadApprovedActivities();
    }
    proposalForm.reset();
    document.getElementById('votingDurationHours').value = '24';
    selectedPlace = null;
    selectedPlaceNode.textContent = '';
    selectedPlaceNode.className = 'selected-place';
    placeResults.replaceChildren();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin(`/trip.html?id=${encodeURIComponent(tripId)}`);
      return;
    }

    if (error instanceof ApiError) {
      showFieldErrors(error.details);
    }
    const message =
      error instanceof Error ? error.message : 'Unable to create the proposal.';
    showStatus(proposalStatus, message, 'error');
  } finally {
    createProposalButton.disabled = false;
  }
}

async function initialize() {
  const logoutButton = document.getElementById('logoutButton');
  logoutButton.addEventListener('click', async () => {
    try {
      await logout();
    } catch (error) {
      showStatus(
        tripPageStatus,
        error instanceof Error ? error.message : 'Unable to log out.',
        'error',
      );
    }
  });

  if (
    !tripId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      tripId,
    )
  ) {
    showStatus(tripPageStatus, 'Trip not found.', 'error');
    return;
  }

  try {
    const user = await getCurrentUser();
    userName.textContent = user.name;
    const trips = await requestJson('/trips');
    const currentTrip = trips.find((item) => item.id === tripId);

    if (!currentTrip) {
      showStatus(
        tripPageStatus,
        'Trip not found or you are not a member.',
        'error',
      );
      proposalForm.hidden = true;
      return;
    }

    setTripDetails(currentTrip);
    proposalWorkspace.hidden = false;
    placeSearchForm.addEventListener('submit', searchPlaces);
    proposalForm.addEventListener('submit', createProposal);
    await loadApprovedActivities();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin(`/trip.html?id=${encodeURIComponent(tripId)}`);
      return;
    }

    showStatus(
      tripPageStatus,
      error instanceof Error ? error.message : 'Unable to load this trip.',
      'error',
    );
    proposalForm.hidden = true;
  }
}

initialize();
