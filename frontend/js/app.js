import { ApiError, getCurrentUser } from './api.js';

const homeMessage = document.getElementById('homeMessage');

try {
  await getCurrentUser();
  window.location.replace('/trips.html');
} catch (error) {
  if (!(error instanceof ApiError) || error.status !== 401) {
    if (homeMessage) {
      homeMessage.textContent = 'Sign in is temporarily unavailable. You can still explore MapMates.';
    }
  }
}