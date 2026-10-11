# MapMates: Use Cases

## 1. Actors

| Actor | Description |
| --- | --- |
| Visitor | Not authenticated user. |
| User | Authenticated user. |
| Member | A user participating in a trip (role per trip). |
| Organizer | A member who owns the trip (role per trip). Inherits all member use cases. |
| Geocoding service | External system (Nominatim) that resolves place searches. |

## 2. Use case diagram

```mermaid
flowchart LR
    V([Visitor])
    U([User])
    M([Member])
    O([Organizer])
    G([Geocoding service])

    V --> UC01(UC-01 Register)
    V --> UC02(UC-02 Log in)

    U --> UC03(UC-03 Log out)
    U --> UC04(UC-04 Create trip)
    U --> UC05(UC-05 List my trips)
    U --> UC06(UC-06 Join trip via invitation link)

    M --> UC07(UC-07 Leave trip)
    M --> UC08(UC-08 Create proposal)
    M --> UC09(UC-09 Vote on proposal)
    M --> UC10(UC-10 View proposals feed)
    M --> UC11(UC-11 View itinerary and map)
    M --> UC12(UC-12 Export itinerary)
    M --> UC16(UC-16 Remove proposal)

    O --> UC13(UC-13 Edit or delete trip)
    O --> UC14(UC-14 Manage invitation link)
    O --> UC15(UC-15 Close voting early and resolve tie)

    UC08 -.->|uses| G
```

## 3. Traceability: use cases and requirements

| Use case | Related requirements |
| --- | --- |
| UC-01 Register | FR-01, NFR-01, NFR-02 |
| UC-02 Log in | FR-02, NFR-01, NFR-04 |
| UC-03 Log out | FR-02 |
| UC-04 Create trip | FR-03, FR-13 |
| UC-05 List my trips | FR-04 |
| UC-06 Join trip via invitation link | FR-07, FR-08, BR-07, BR-08 |
| UC-07 Leave trip | FR-07 |
| UC-08 Create proposal | FR-09, FR-13, FR-23, BR-06, BR-09, BR-10, NFR-06 |
| UC-09 Vote on proposal | FR-10, BR-02, BR-03 |
| UC-10 View proposals feed | FR-16 |
| UC-11 View itinerary and map | FR-14, FR-17, FR-18 |
| UC-12 Export itinerary | FR-20, FR-21 |
| UC-13 Edit or delete trip | FR-05, FR-15 |
| UC-14 Manage invitation link | FR-06, BR-07 |
| UC-15 Close voting early and resolve tie | FR-11, FR-12, FR-14, BR-04, BR-11 |
| UC-16 Remove proposal | FR-19 |

## 4. Detailed use cases

### UC-06: Join trip via invitation link

| Field | Description |
| --- | --- |
| Actor | User |
| Preconditions | The trip is collaborative and has an active invitation link. |
| Trigger | The user opens an invitation link. |
| Main flow | 1. The system verifies the user is authenticated. 2. The system finds the invitation by its token. 3. The system verifies the link is not expired or revoked. 4. The system verifies the user is not already a member. 5. The system verifies the trip has not reached its maximum number of members. 6. The system adds the user to the trip with the role `member`. 7. The system redirects the user to the trip. |
| Alternative flows | A1. The user is already a member (step 4): no change is made and the user is redirected to the trip. A2. The user is not authenticated (step 1): the system sends the user to log in or register and, afterwards, returns to the invitation link. |
| Exceptions | E1. Token not found, expired or revoked: 404 (same response for all three, to avoid revealing information). E2. Trip is full: 409. E3. Malformed token: 400. |
| Postconditions | The user is a member of the trip with the role `member`. The trip's member count increased by one. |
| Related | FR-07, FR-08, BR-07, BR-08 |

### UC-09: Vote on proposal

| Field | Description |
| --- | --- |
| Actor | Member |
| Preconditions | The user is authenticated and is a member of the trip. The proposal exists and its voting is open. |
| Trigger | The member selects "for" or "against" on a proposal. |
| Main flow | 1. The system checks the user is a member of the trip. 2. The system checks voting is still open. 3. The system records the vote (or replaces the previous one). 4. The system updates and shows the vote count. |
| Alternative flows | A1. The user already voted the same option: the vote is withdrawn. |
| Exceptions | E1. Not authenticated: 401. E2. Not a member of the trip: 403. E3. Voting closed: 409 (or 422). E4. Proposal not found: 404. |
| Postconditions | At most one vote per user exists for the proposal. |
| Related | FR-10, BR-02, BR-03 |

### UC-16-: Schedule activity

| Field | Description |
| --- | --- |
| Actor | Member |
| Preconditions | The user is authenticated and is a member of the trip. The proposal exists and its voting is open. |
| Trigger | The member selects "for" or "against" on a proposal. |
| Main flow | 1. The system checks the user is a member of the trip. 2. The system checks voting is still open. 3. The system records the vote (or replaces the previous one). 4. The system updates and shows the vote count. |
| Alternative flows | A1. The user already voted the same option: the vote is withdrawn. |
| Exceptions | E1. Not authenticated: 401. E2. Not a member of the trip: 403. E3. Voting closed: 409 (or 422). E4. Proposal not found: 404. |
| Postconditions | At most one vote per user exists for the proposal. |
| Related | FR-10, BR-02, BR-03 |


## 5. Summary of the remaining use cases

| ID | Name | Actor | Description | Main errors |
| --- | --- | --- | --- | --- |
| UC-01 | Register | Visitor | The visitor creates an account with name, email and password. The password is stored hashed. | 400 invalid data, 409 email already registered |
| UC-02 | Log in | Visitor | The visitor authenticates with email and password and receives a session. | 400 invalid data, 401 wrong credentials |
| UC-03 | Log out | User | The user ends the current session. | 401 not authenticated |
| UC-04 | Create trip | User | The user creates a trip (name, destination, dates, type). The creator becomes organizer. | 400 invalid data (e.g. end date before start date), 401 |
| UC-05 | List my trips | User | The user sees the trips they own or participate in. | 401 |
| UC-07 | Leave trip | Member | A member leaves a trip. The organizer cannot leave without deleting the trip. | 401, 403, 404 |
| UC-10 | View proposals feed | Member | The member sees proposals with category, place, remaining time and votes. | 401, 403, 404 |
| UC-11 | View itinerary and map | Member | The member sees the itinerary by day and the places on the map. | 401, 403, 404 |
| UC-12 | Export itinerary | Member | The member downloads the itinerary as an `.ics` file. | 401, 403, 404 |
| UC-14 | Manage invitation link | Organizer | The organizer generates, regenerates or revokes the invitation link. | 401, 403, 404 |
| UC-16 | Remove proposal | Member / Organizer | The author of a proposal or the organizer removes it. | 401, 403, 404 |