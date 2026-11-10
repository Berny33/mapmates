import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';

describe('static frontend pages', () => {
  it.each([
    ['/', 'Plan trips together.'],
    ['/login', 'Log in'],
    ['/login.html', 'Log in'],
    ['/register', 'Sign up'],
    ['/register.html', 'Sign up'],
    ['/trips', 'My trips'],
    ['/trips.html', 'My trips'],
    ['/create-trip', 'New trip'],
    ['/create-trip.html', 'New trip'],
  ])('serves %s from the frontend', async (path, expectedText) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain(expectedText);
  });

  it('serves the shared stylesheet and JavaScript modules', async () => {
    const stylesheet = await request(app).get('/css/styles.css');
    const apiModule = await request(app).get('/js/api.js');

    expect(stylesheet.status).toBe(200);
    expect(stylesheet.text).toContain('--accent: #3b82f6');
    expect(apiModule.status).toBe(200);
    expect(apiModule.text).toContain("const API_BASE = '/api'");
  });
});
