# MapMates

Web platform to plan trips together or alone: propose places and activities, vote on them and see the resulting itinerary day by day on an interactive map.

Course project for Web Systems Programming.

## Stack

- Frontend: HTML, CSS, JavaScript, Leaflet.js
- Backend: Node.js with Express
- Database: PostgreSQL
- External API: Nominatim (OpenStreetMap)

## Documentation

| Document | Content |
| --- | --- |
| [Requirements](docs/01-requirements.md) | Functional and non-functional requirements, business rules |
| [Use cases](docs/02-use-cases.md) | Actors, diagram, traceability, detailed use cases, proposal statuses |
| [Data model](docs/03-er-model.md) | ER diagram, tables and constraints |
| [Architecture](docs/04-architecture.md) | Structure, layers, routes, controllers, models and middlewares |
| [Security plan](docs/05-security.md) | Validations, role-based access, secrets and security tests |

## Workflow

- Gitflow: `main` (stable), `develop` (integration), `feature/*` for each story or task.
- Every change enters through a pull request linked to an issue.
- Planning lives in GitHub: milestones per sprint, issues for user stories and tasks, and a project board.

## Running the project

Setup instructions will be added in Sprint 2.