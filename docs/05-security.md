# MapMates: Security Plan

## 1. Principles

- Every protected endpoint authenticates the user and authorizes the action on the server.
- Every input is validated on the server, whatever the frontend does.
- Every database query is parameterized.
- Secrets live in environment variables and never in the repository.
- Business rules are referenced by id (BR-xx) in `docs/01-requirements.md`.

## 2. Authentication

| Control | Decision |
| --- | --- |
| Password storage | bcrypt, cost factor 12; the hash is never returned by any endpoint |
| Session | `express-session` stored in PostgreSQL; cookie with `httpOnly`, `SameSite=Lax` and `Secure` in production |
| Logout | Destroys the session on the server (later requests receive 401) |
| Login errors | One generic message for wrong email or wrong password |
| Brute force | Rate limit on login and registration (429) |
| CSRF | `SameSite` cookie plus an `Origin` header check on state-changing requests |

## 3. Role-based access

Roles are per trip (BR-01): `organizer` and `member`. A user who is not in the trip has no role in it.

| Action | Who can do it | If not allowed |
| --- | --- | --- |
| Register, log in | Visitor | n/a |
| Create trip, list my trips | Authenticated user | 401 |
| Read trip, proposals, itinerary; export | Member of the trip | 401, 403, 404 if the trip does not exist |
| Join a trip | Authenticated user with a valid link | 401, 404 |
| Leave a trip | Member who is not the organizer | 403 |
| Create proposal, vote | Member | 403 |
| Remove proposal | Author while it is `open`; organizer at any time | 403, 409 |
| Edit or delete trip | Organizer | 403 |
| Manage invitation link | Organizer | 403 |
| Close voting early, resolve a tie | Organizer | 403 |

The user id, the author and the role always come from the session, never from the request body.

## 4. Input validation

All fields are validated on the server and invalid input answers 400.

| Field | Rule |
| --- | --- |
| Any id in a path | Valid UUID |
| Invitation token | Fixed-length base64url string (32 random bytes) |
| `name` (user) | 1 to 60 characters |
| `email` | Valid format, at most 254 characters, stored in lowercase |
| `password` | 8 to 72 characters (72 is the bcrypt limit) |
| Trip `name`, `destination` | 1 to 100 characters |
| Trip `start_date`, `end_date` | Valid dates; end not before start |
| Trip `type` | `solo` or `collaborative`; cannot be changed after creation (BR-13) |
| Place `place_name` | 1 to 200 characters |
| `lat`, `lon` | Numbers within -90 to 90 and -180 to 180 |
| `category` | One of `food`, `sightseeing`, `culture`, `nature`, `nightlife`, `shopping`, `transport`, `other` |
| Proposal `day` | Valid date within the trip dates (BR-06) |
| `start_time`, `end_time` | `HH:MM`; end later than start, same day (BR-09) |
| `note` | At most 280 characters (BR-14) |
| Voting duration | From 1 hour to 3 days (BR-15) |
| Vote `value` | `for` or `against` |
| Search term `q` | 2 to 100 characters |

Output handling: user text (names, notes, place names) is inserted into pages with `textContent`, never `innerHTML`, and is escaped in `.ics` files. `helmet` sets a Content Security Policy.

## 5. Secrets protection

- Secrets (database URL, session secret, geocoding contact) are read from environment variables.
- `.env` is listed in `.gitignore`; `.env.example` contains only placeholders.
- CI secrets are stored as GitHub Actions secrets, never in the workflow files.
- Documentation and configuration files do not include real credentials.
- If a secret is ever committed, it is rotated immediately; removing it from the history is not enough.
- Logs never contain passwords, session ids or invitation tokens.
- `npm audit` is run on dependencies and a secret scan is added to CI in Sprint 3.

## 6. Critical failures from the project rules

| Critical failure | How it is prevented |
| --- | --- |
| Exposed credentials | Section 5; scan of the repository before each review |
| Protected resource without authentication | `requireAuth` on every protected route; tests ST-03 |
| Access to another user's data | Membership and role checks on every trip route; tests ST-04 to ST-08 |
| Exploitable SQL injection | Parameterized queries only; test ST-12 |

## 7. Security test cases

| ID | Test case | Expected result |
| --- | --- | --- |
| ST-01 | Register with an email that already exists | 409, no account created |
| ST-02 | Log in with a wrong password and with an unknown email | 401, same message in both cases |
| ST-03 | Call a protected endpoint without a session | 401 |
| ST-04 | A user who is not a member reads a trip, its proposals or its itinerary | 403 |
| ST-05 | A member tries to edit or delete a trip | 403 |
| ST-06 | A member tries to close voting or resolve a tie | 403 |
| ST-07 | A member removes a proposal written by another member | 403 |
| ST-08 | A member tries to generate or revoke the invitation link | 403 |
| ST-09 | A path id that is not a UUID | 400 |
| ST-10 | Join with an expired, a revoked and a nonexistent token | 404, identical response |
| ST-11 | Join a trip that reached its member limit | 409 |
| ST-12 | SQL injection strings in text fields and query parameters | No data leak or change; value stored or rejected as plain text |
| ST-13 | A note with an HTML or script payload | Shown as text, not executed |
| ST-14 | A note of 281 characters | 400 |
| ST-15 | A voting duration of 30 minutes and of 4 days | 400 |
| ST-16 | End time not later than start time; day outside the trip dates | 400 |
| ST-17 | A proposal that overlaps an approved activity | 409 |
| ST-18 | Vote after the deadline or on a closed proposal | 409 |
| ST-19 | Try to change the trip type | 400 |
| ST-20 | Any response of register, login or user endpoints | Contains no password or hash |
| ST-21 | More login attempts than the limit allows | 429 |
| ST-22 | Search of `.env` and secrets in the repository and its history | Nothing found |