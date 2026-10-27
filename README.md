# MapMates

Web platform to plan trips together or alone: propose places and activities, vote on them and see the resulting itinerary day by day on an interactive map.

Course project for Web Systems Programming (Universidad Autonoma de Aguascalientes).

## Status

| Sprint | Scope | State |
| --- | --- | --- |
| 1 | Planning: requirements, use cases, ER model, user stories, architecture, security plan, GitHub setup | Done |
| 2 | US-01 Register, US-02 Log in and out, US-03 Create trip, US-04 List my trips | Done |
| 3 | Invitation links, proposals, voting, frontend, deployment, CI/CD and E2E tests | Planned |

## Stack

- Backend: Node.js 24, Express 5, TypeScript (ESM)
- Database: PostgreSQL (`pg` driver, parameterized queries)
- Sessions: `express-session` stored in PostgreSQL
- Validation: Zod
- Tests: Vitest and Supertest
- Frontend (Sprint 3): HTML, CSS, JavaScript and Leaflet.js
- External API (Sprint 3): Nominatim (OpenStreetMap)

## Prerequisites

- Node.js 24 or later (npm is included)
- PostgreSQL 13 or later, with the `psql` command available in the terminal
- Git

Check them with:

```powershell
node --version
npm --version
psql --version
git --version
```

## Getting started

### 1. Clone and install

```powershell
git clone https://github.com/Berny33/mapmates.git
cd mapmates
npm ci
```

`npm ci` installs exactly the versions recorded in `package-lock.json`.

### 2. Create the databases

Open `psql` as the PostgreSQL superuser:

```powershell
psql -U postgres
```

and run, replacing the password:

```sql
CREATE ROLE mapmates_app WITH LOGIN PASSWORD '<choose-a-password>';
CREATE DATABASE mapmates OWNER mapmates_app;
CREATE DATABASE mapmates_test OWNER mapmates_app;
```

Use only letters and digits in the password: symbols such as `@`, `:`, `/` or `#` break the connection URL. Type `\q` to leave `psql`.

The application uses `mapmates`; the tests use `mapmates_test`, which they empty before every test.

### 3. Configure the environment

```powershell
Copy-Item .env.example .env
```

(On Linux or macOS: `cp .env.example .env`.) Then edit `.env`:

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default 3000) |
| `NODE_ENV` | `development`, `test` or `production` |
| `DATABASE_URL` | Connection URL of the `mapmates` database |
| `TEST_DATABASE_URL` | Connection URL of the `mapmates_test` database. Its name must end with `_test` |
| `SESSION_SECRET` | Long random value that signs the session cookie |
| `BCRYPT_ROUNDS` | Password hashing cost (optional, default 12) |
| `AUTH_RATE_LIMIT` | Login and registration attempts per 15 minutes (optional, default 10) |
| `GEOCODING_USER_AGENT` | Identification sent to Nominatim (used from Sprint 3) |

Connection URLs look like `postgres://mapmates_app:<password>@localhost:5432/mapmates`.

Generate a value for `SESSION_SECRET`:

```powershell
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('hex'))"
```

`.env` is ignored by Git. Never commit it, and never put real values in `.env.example`.

### 4. Apply the migrations

```powershell
npm run migrate
```

It prints `Applied: 001_initial_schema.sql` the first time and `Database is up to date` afterwards.

### 5. Run the application

```powershell
npm run dev
```

Open `http://localhost:3000/api/health`: it answers `{"status":"ok"}`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the server with automatic reload |
| `npm run migrate` | Applies the pending database migrations |
| `npm test` | Runs the integration tests |
| `npm run test:coverage` | Runs the tests and prints the coverage report (minimum 80%) |
| `npm run typecheck` | Checks the TypeScript types |
| `npm run lint` | Runs ESLint |
| `npm run format` | Formats the code with Prettier |
| `npm run build` | Compiles the application to `dist/` |

## Tests

The integration tests run against a real PostgreSQL database, not mocks, so database rules (keys, constraints, transactions) are tested too.

1. Create the `mapmates_test` database and set `TEST_DATABASE_URL` in `.env` (steps 2 and 3).
2. Run:

```powershell
npm test
npm run test:coverage
```

Safety guard: before any test starts, the test scripts stop with an error unless the database name in `TEST_DATABASE_URL` ends with `_test`. The test database is migrated automatically and emptied before every test.

Each endpoint is tested for the successful flow, invalid input and access restrictions. The tests are named after the user stories and the security test cases (`ST-xx`) of the security plan.

### Test results

Last verified run (Sprint 2):

```
Test Files  8 passed (8)
Tests  78 passed (78)
```

Coverage report (`npm run test:coverage`):

```
----------------|---------|----------|---------|---------|-------------------
File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------|---------|----------|---------|---------|-------------------
All files       |     100 |    88.37 |     100 |     100 |                   
 src            |     100 |      100 |     100 |     100 |                   
  app.ts        |     100 |      100 |     100 |     100 |                   
 src/config     |     100 |    83.33 |     100 |     100 |                   
  db.ts         |     100 |      100 |     100 |     100 |                   
  session.ts    |     100 |       75 |     100 |     100 | 31                
 ...controllers |     100 |       50 |     100 |     100 |                   
  ...troller.ts |     100 |       50 |     100 |     100 | 11-17             
  ...troller.ts |     100 |      100 |     100 |     100 |                   
 ...middlewares |     100 |      100 |     100 |     100 |                   
  ...Handler.ts |     100 |      100 |     100 |     100 |                   
  rateLimit.ts  |     100 |      100 |     100 |     100 |                   
  ...ireAuth.ts |     100 |      100 |     100 |     100 |                   
  validate.ts   |     100 |      100 |     100 |     100 |                   
 src/models     |     100 |      100 |     100 |     100 |                   
  trip.model.ts |     100 |      100 |     100 |     100 |                   
  user.model.ts |     100 |      100 |     100 |     100 |                   
 src/routes     |     100 |       50 |     100 |     100 |                   
  ....routes.ts |     100 |       50 |     100 |     100 | 16                
  ....routes.ts |     100 |      100 |     100 |     100 |                   
 src/services   |     100 |    92.85 |     100 |     100 |                   
  ...service.ts |     100 |       90 |     100 |     100 | 10                
  ...service.ts |     100 |      100 |     100 |     100 |                   
 src/utils      |     100 |      100 |     100 |     100 |                   
  AppError.ts   |     100 |      100 |     100 |     100 |                   
  dbErrors.ts   |     100 |      100 |     100 |     100 |                   
  session.ts    |     100 |      100 |     100 |     100 |                   
 src/validators |     100 |      100 |     100 |     100 |                   
  ...idators.ts |     100 |      100 |     100 |     100 |                   
  ...idators.ts |     100 |      100 |     100 |     100 |                   
----------------|---------|----------|---------|---------|-------------------
```

## API

| Method and path | Auth | Description | Success |
| --- | --- | --- | --- |
| `GET /api/health` | No | Health check | 200 |
| `POST /api/auth/register` | No | Create an account | 201 |
| `POST /api/auth/login` | No | Log in and start a session | 200 |
| `POST /api/auth/logout` | Yes | Destroy the session | 204 |
| `GET /api/auth/me` | Yes | Current user | 200 |
| `POST /api/trips` | Yes | Create a solo or collaborative trip; the creator becomes its organizer | 201 |
| `GET /api/trips` | Yes | List the trips of the user with their role | 200 |

Errors use a single format: `{ "error": { "code": "...", "message": "..." } }`.

Quick manual check (PowerShell, with the server running):

```powershell
$body = '{"name":"Ana","email":"ana@example.com","password":"correct-horse-9"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/register -ContentType 'application/json' -Body $body

$login = '{"email":"ana@example.com","password":"correct-horse-9"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body $login -SessionVariable s

$trip = '{"name":"Paris","destination":"Paris, France","startDate":"2026-12-01","endDate":"2026-12-05","type":"collaborative"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/trips -ContentType 'application/json' -Body $trip -WebSession $s

Invoke-RestMethod -Uri http://localhost:3000/api/trips -WebSession $s
```

The Thunder Client extension for VS Code works too; it keeps cookies between requests.

## Security controls in place

- Passwords hashed with bcrypt (cost 12); the hash is never returned by any endpoint.
- Server-side sessions stored in PostgreSQL; cookie `httpOnly` and `SameSite=Lax`, `Secure` in production. Logging out destroys the session on the server.
- Wrong password and unknown email give the same error, and take a similar time.
- All input is validated with Zod; fields that are not part of a schema are discarded.
- Parameterized SQL queries only.
- Every trip route requires a session; the user and the role always come from the session, never from the request body.
- `helmet` headers, a 10 KB body limit and a rate limit on login and registration.
- Secrets live in environment variables; `.env` is ignored by Git.

## Project structure

```
db/
|-- migrate.ts, migrate-cli.ts    migration runner
|-- migrations/                   numbered SQL files
docs/                             project documentation
src/
|-- app.ts, server.ts             Express app and HTTP server
|-- config/                       database pool and session
|-- routes/                       one file per resource
|-- middlewares/                  auth, validation, rate limit, errors
|-- controllers/                  HTTP layer
|-- services/                     business rules
|-- models/                       SQL queries
|-- validators/                   Zod schemas
|-- utils/                        errors and helpers
tests/
|-- setup/, helpers/, integration/
```

## Documentation

| Document | Content |
| --- | --- |
| [Requirements](docs/01-requirements.md) | Functional and non-functional requirements, business rules |
| [Use cases](docs/02-use-cases.md) | Actors, diagram, traceability, detailed use cases, proposal statuses |
| [Data model](docs/03-er-model.md) | ER diagram, tables and constraints |
| [Architecture](docs/04-architecture.md) | Structure, layers, routes, controllers, models and middlewares |
| [Security plan](docs/05-security.md) | Validations, role-based access, secrets and security tests |

## Workflow

- Gitflow: `main` (stable), `develop` (integration) and `feature/*` for each story or task.
- Every change enters through a pull request linked to an issue.
- Planning lives in GitHub: one milestone per sprint, issues for user stories and tasks, and a project board.