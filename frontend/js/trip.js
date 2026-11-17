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
const proposalsSection = document.getElementById('proposalsSection');
const proposalsStatus = document.getElementById('proposalsStatus');
const proposalFeed = document.getElementById('proposalFeed');
const itinerarySection = document.getElementById('itinerarySection');
const itineraryStatus = document.getElementById('itineraryStatus');
const approvedActivities = document.getElementById('approvedActivities');
const userName = document.getElementById('userName');

let trip = null;
let selectedPlace = null;
let proposalData = [];
let proposalCountdownInterval = null;

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

function renderProposals(proposals) {
  proposalFeed.replaceChildren();

  if (proposals.length === 0) {
    showStatus(proposalsStatus, 'No proposals yet.');
    return;
  }

  showStatus(proposalsStatus, '');
  proposals.forEach((proposal) => {
    const item = document.createElement('li');
    const heading = document.createElement('h3');
    heading.textContent = proposal.placeName;

    const schedule = document.createElement('p');
    schedule.textContent = `${proposal.day} · ${proposal.startTime}–${proposal.endTime}`;

    const category = document.createElement('p');
    category.className = 'proposal-category';
    category.textContent = proposal.category;

    const counts = document.createElement('p');
    counts.className = 'proposal-vote-counts';
    counts.textContent = `For: ${proposal.forVotes} · Against: ${proposal.againstVotes}`;

    const remainingTime = getRemainingVotingTime(proposal.votingDeadline);
    const votingIsOpen = proposal.status === 'open' && remainingTime !== null;
    const status = document.createElement('p');
    status.className = 'proposal-status';
    status.textContent = getProposalStatusLabel(proposal.status, votingIsOpen);
    item.append(heading, schedule, category, counts, status);

    if (votingIsOpen) {
      const remaining = document.createElement('p');
      remaining.className = 'proposal-remaining';
      remaining.dataset.proposalRemaining = proposal.id;
      remaining.textContent = `Time remaining: ${remainingTime}`;
      item.appendChild(remaining);

      const actions = document.createElement('div');
      actions.className = 'proposal-vote-actions';

      ['for', 'against'].forEach((value) => {
        const button = document.createElement('button');
        button.className = 'button button-secondary';
        button.type = 'button';
        button.textContent = `Vote ${value}`;
        button.setAttribute(
          'aria-pressed',
          String(proposal.userVote === value),
        );
        button.addEventListener('click', () => castVote(proposal.id, value));
        actions.appendChild(button);
      });

      item.appendChild(actions);
    } else {
      const closed = document.createElement('p');
      closed.className = 'proposal-closed';
      closed.textContent = 'Voting is closed.';
      item.appendChild(closed);
    }

    proposalFeed.appendChild(item);
  });
}

function getRemainingVotingTime(deadline) {
  const remainingMinutes = Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / 60_000,
  );
  if (remainingMinutes <= 0) {
    return null;
  }

  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  const minutes = remainingMinutes % 60;
  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(' ');
}

function getProposalStatusLabel(status, votingIsOpen) {
  if (status === 'open') {
    return votingIsOpen ? 'Voting open' : 'Voting deadline passed';
  }
  if (status === 'tied') {
    return 'Tied · organizer decision pending';
  }
  if (status === 'approved') {
    return 'Approved';
  }
  if (status === 'rejected_conflict') {
    return 'Rejected · schedule conflict';
  }
  return 'Rejected';
}

async function loadProposals() {
  try {
    proposalData = await requestJson(
      `/trips/${encodeURIComponent(tripId)}/proposals`,
    );
    renderProposals(proposalData);
    proposalsSection.hidden = false;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin(`/trip.html?id=${encodeURIComponent(tripId)}`);
      return;
    }

    showStatus(
      proposalsStatus,
      error instanceof Error ? error.message : 'Unable to load proposals.',
      'error',
    );
    proposalsSection.hidden = false;
  }
}

async function updateProposalCountdowns() {
  let deadlineReached = false;

  proposalFeed
    .querySelectorAll('[data-proposal-remaining]')
    .forEach((remainingNode) => {
      const proposal = proposalData.find(
        (item) => item.id === remainingNode.dataset.proposalRemaining,
      );
      if (!proposal) {
        return;
      }

      const remaining = getRemainingVotingTime(proposal.votingDeadline);
      if (remaining === null) {
        deadlineReached = true;
      } else {
        remainingNode.textContent = `Time remaining: ${remaining}`;
      }
    });

  if (deadlineReached) {
    await loadProposals();
    await loadApprovedActivities();
  }
}

async function castVote(proposalId, value) {
  proposalFeed.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });

  try {
    const result = await requestJson(
      `/trips/${encodeURIComponent(tripId)}/proposals/${encodeURIComponent(
        proposalId,
      )}/vote`,
      {
        method: 'POST',
        body: JSON.stringify({ value }),
      },
    );

    proposalData = proposalData.map((proposal) =>
      proposal.id === proposalId ? { ...proposal, ...result } : proposal,
    );
    renderProposals(proposalData);
    showStatus(
      proposalsStatus,
      result.userVote === null ? 'Your vote was withdrawn.' : 'Your vote was recorded.',
      'success',
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin(`/trip.html?id=${encodeURIComponent(tripId)}`);
      return;
    }

    const message =
      error instanceof Error ? error.message : 'Unable to submit your vote.';
    if (error instanceof ApiError && error.status === 409) {
      await loadProposals();
      await loadApprovedActivities();
    }
    showStatus(proposalsStatus, message, 'error');
  } finally {
    proposalFeed.querySelectorAll('button').forEach((button) => {
      button.disabled = false;
    });
  }
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
    await loadProposals();
    await loadApprovedActivities();
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
    await loadProposals();
    await loadApprovedActivities();
    if (proposalCountdownInterval === null) {
      proposalCountdownInterval = window.setInterval(
        updateProposalCountdowns,
        60_000,
      );
    }
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
