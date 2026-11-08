const tripList = document.getElementById('tripList');

async function loadTrips() {
  try {
    const response = await fetch('/api/trips');

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const trips = await response.json();

    if (!Array.isArray(trips)) {
      throw new Error('Unexpected response format');
    }

    if (!tripList) {
      return;
    }

    tripList.innerHTML = '';

    if (trips.length === 0) {
      tripList.innerHTML = '<p>No trips available.</p>';
      return;
    }

    trips.forEach((trip) => {
      const item = document.createElement('article');
      item.className = 'trip-item';

      const title = document.createElement('h2');
      title.textContent = trip.name ?? 'Trip';

      const destination = document.createElement('p');
      destination.textContent = `Destination: ${trip.destination ?? 'Unknown'}`;

      const dates = document.createElement('p');
      dates.textContent = `Dates: ${trip.startDate ?? '-'} to ${trip.endDate ?? '-'}`;

      item.append(title, destination, dates);
      tripList.appendChild(item);
    });
  } catch (error) {
    if (!tripList) {
      return;
    }

    tripList.innerHTML = `<p>Error loading trips: ${error.message}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('loadTripsButton');

  if (button) {
    button.addEventListener('click', loadTrips);
  }
});