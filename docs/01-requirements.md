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

Priority: **M** = Must, **S** = Should, **C** = Could.

| ID | Requirement | Priority |
| --- | --- | :---: |
| FR-01 | A visitor can register with name, email and password. | M |
| FR-02 | A user can log in and log out. | M |
| FR-03 | A user can create a trip with name, destination, start date, end date and type (`solo` or `collaborative`). | M |
| FR-04 | A user can list the trips they own or participate in. | M |
| FR-05 | The organizer can edit a trip's name, destination and dates, or delete the trip. The trip type cannot be changed. | M |
| FR-06 | The organizer can generate an invitation link/code for a collaborative trip, and can revoke it. | M |
| FR-07 | A user with a valid invitation link can join the trip; a member can leave the trip. | M |
| FR-08 | A trip has a maximum number of members (default 15). | S |
| FR-09 | A member can search a place by name (external geocoding service) and create a proposal with place, category, proposed day, start time, end time, optional short note, and a voting duration. | M |
| FR-10 | Each member can vote **for** or **against** each open proposal once, and can change or withdraw the vote while voting is open. | M |
| FR-11 | Voting closes automatically at the proposal's deadline; the organizer can close it earlier. | M |
| FR-12 | If a closed proposal ends in a tie, the organizer decides whether it is approved. | M |
| FR-13 | In a solo trip, proposals are confirmed directly, without voting. | S |
| FR-14 | When voting closes with a proposal approved, the proposal becomes part of the itinerary at its proposed day and time. | M |
| FR-15 | If the trip dates change, proposals whose proposed day falls outside the new range are deleted, after the system shows how many would be removed and the organizer confirms. | M |
| FR-16 | A member can view the trip's proposals as a feed showing category, place, remaining voting time and current votes. | M |
| FR-17 | A member can view the itinerary day by day. | M |
| FR-18 | The itinerary is displayed on an interactive map with one marker per place, filterable by day. | M |
| FR-19 | The author of a proposal can remove it while its voting is open; the organizer can remove any proposal. | S |
| FR-20 | A member can export the itinerary as an iCalendar (`.ics`) file. | S |
| FR-21 | A member can export the itinerary as a printable/PDF view. | C |
| FR-22 | A user can reset a forgotten password by email. | C |
| FR-23 | The system prevents overlapping activities: a proposal cannot be created if its time interval overlaps an already approved activity of the trip. | M |

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

## 6. Business rules

- BR-01: Roles are per trip (`organizer`, `member`). A solo trip has exactly one member, the organizer.
- BR-02: A user has at most one vote per proposal.
- BR-03: Votes are only accepted while the proposal's voting is open (before its deadline and not closed early).
- BR-04: A proposal is approved when "for" votes exceed "against" votes at close, unless it conflicts with an approved activity (BR-11); on a tie, the organizer decides.
- BR-05: Only approved proposals appear in the itinerary.
- BR-06: A proposal's day must fall within the trip's date range when it is created.
- BR-07: Invitation links are random and unguessable, can expire, and can be revoked by the organizer.
- BR-08: A trip cannot exceed the maximum number of members.
- BR-09: An activity occupies the interval from its start time to its end time (end exclusive). The end time must be later than the start time and fall on the same day.
- BR-10: Approved activities of the same trip cannot overlap. Open proposals may overlap each other, since they compete for the same slot.
- BR-11: If a proposal is approved at closing but overlaps an activity approved earlier, it is rejected due to conflict.
- BR-12: The author of a proposal can remove it only while its voting is open. The organizer can remove any proposal at any time. Removing a proposal also removes its votes and, if it was approved, its place in the itinerary.
- BR-13: The trip type (`solo` or `collaborative`) cannot be changed after the trip is created.
- BR-14: A proposal's note has at most 280 characters.
- BR-15: A proposal's voting duration is between 1 hour and 3 days.