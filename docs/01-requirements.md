# MapMates: Requirements

## 1. Purpose

MapMates is a web platform for planning trips. A user can plan a trip alone
or together with other users: they propose places and activities, vote on
them, and see the resulting itinerary distributed day by day on an
interactive map.

## 2. Scope

**In scope:** user accounts, trips (solo and collaborative), place search,
proposals, voting, day-by-day itinerary, interactive map.

**Out of scope (for now):** payments, booking of flights or hotels,
real-time chat, native mobile apps.

## 3. Actors and roles

| Actor | Description |
| --- | --- |
| Visitor | Not authenticated. Can only register or log in. |
| User | Authenticated. Can create trips and join trips by invitation. |
| Organizer | A user's role **within a specific trip**: the creator of the trip. Manages members, closes voting, assigns days. |
| Member | A user's role **within a specific trip**: can propose places and vote. |

Roles are **per trip**, not global. In a solo trip, the creator is
automatically the organizer and the only member.

## 4. Functional requirements

Priority: **M** = Must (needed for Sprint 2-3), **S** = Should, **C** = Could.

| ID | Requirement | Priority |
| --- | --- | :---: |
| FR-01 | A visitor can register with name, email and password. | M |
| FR-02 | A user can log in and log out. | M |
| FR-03 | A user can create a trip with name, destination, start date, end date and type (`solo` or `collaborative`). | M |
| FR-04 | A user can list the trips they own or participate in. | M |
| FR-05 | The organizer can edit or delete a trip. | M |
| FR-06 | In a collaborative trip, the organizer can invite users and members can leave the trip. | M |
| FR-07 | A member can search a place by name (external geocoding service) and propose it as an activity of the trip. | M |
| FR-08 | A member can vote once per proposal; the vote can be withdrawn. | M |
| FR-09 | In a solo trip, proposals are confirmed directly, without voting. | S |
| FR-10 | The organizer can close voting and assign approved proposals to specific days of the trip. | M |
| FR-11 | A member can view the itinerary day by day. | M |
| FR-12 | The itinerary is displayed on an interactive map with one marker per place, filterable by day. | M |
| FR-13 | The author of a proposal or the organizer can remove a proposal. | S |
| FR-14 | The organizer can reorder the places within a day. | C |

## 5. Non-functional requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-01 | Security | Passwords are stored hashed (bcrypt or argon2), never in plain text. |
| NFR-02 | Security | All input is validated on the server; responses use correct HTTP status codes. |
| NFR-03 | Security | Secrets (database credentials, session/JWT key) live in environment variables and are never committed. |
| NFR-04 | Security | Every protected endpoint checks authentication and authorization (role within the trip). |
| NFR-05 | Usability | The UI is responsive (desktop, tablet, mobile), minimalist, dark tones with a single accent color. |
| NFR-06 | Constraints | The external geocoding service (Nominatim) is used respecting its usage policy: at most 1 request per second and an identifying `User-Agent`; no search-as-you-type without debouncing. |
| NFR-07 | Constraints | Only services with a real free tier and no credit card required. |
| NFR-08 | Quality | Automated integration and E2E tests; at least 90% coverage at final delivery. |
| NFR-09 | Maintainability | Separation of responsibilities (routes, controllers, models, middlewares) and Gitflow branching. |