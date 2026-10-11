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

### UC-08: Create proposal

| Field | Description |
| --- | --- |
| Actor | Member |
| Preconditions | The user is authenticated and is a member of the trip. |
| Trigger | The member submits the form to create a new activity proposal. |
| Main flow | 1. The member searches for a place using the external geocoding service (Nominatim). 2. The member selects the place, fills in category, proposed day, start time, end time, and voting duration. 3. The system validates that the proposed day falls within the trip's date range (BR-06) 4. The system validates that the end time is later than the start time and falls on the same day (BR-09). 5. The system verifies the time interval does not overlap with any already approved activity in the itinerary (FR-23, BR-10). 6. The system creates the proposal with an 'open' status and records its voting deadline. |
| Alternative flows | A1. Solo trip (FR-13): If the trip type is `solo`, the proposal bypasses the voting process, is directly marked as 'approved', and is added to the itinerary. |
| Exceptions | E1. Proposed day is outside the trip's date range: 422 Unprocessable Entity. E2. Invalid time range (end time before start time): 400 Bad Request. E3. Time interval overlaps with an already approved activity: 409 Conflict. E4. External geocoding service unavailable or rate limit exceeded: 503 Service Unavailable / 429 Too Many Requests (NFR-06). |
| Postconditions | A new proposal is created in the trip. If collaborative, voting is open; if solo, it is added to the itinerary. |
| Related | FR-09, FR-13, FR-23, BR-06, BR-09, BR-10, NFR-06 |

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

### UC-13: Edit or delete trip

| Field | Description |
| --- | --- |
| Actor | Organizer |
| Preconditions | The user is authenticated and is the organizer of the trip. |
| Trigger | The organizer submits the edit trip form or clicks the delete trip button. |
| Main flow | 1. The organizer updates the trip details (name, destination, dates) and submits. 2. The system detects a change in the start or end dates. 3. The system identifies any existing proposals (open or approved) whose proposed day now falls outside the new date range. 4. The system warns the organizer about the number of proposals that will be deleted and requests confirmation (FR-15). 5. The organizer confirms the action. 6. The system updates the trip dates and deletes the out-of-bounds proposals. |
| Alternative flows | A1. Delete trip: The organizer chooses to delete the trip. The system permanently deletes the trip and cascades the deletion to all associated members, proposals, and votes (FR-05). A2. No date conflict: The organizer changes dates, but all existing proposals still fall within the new range. The system saves the changes without asking for deletion confirmation. |
| Exceptions | E1. User is not the organizer: 403 Forbidden. E2. New end date is before the new start date: 400 Bad Request. |
| Postconditions | The trip details are updated and invalid proposals are removed, OR the trip and all its data are entirely removed from the system. |
| Related | FR-05, FR-15 |

### UC-15: Close voting early and resolve tie

| Field | Description |
| --- | --- |
| Actor | Organizer |
| Preconditions | The user is authenticated and is the organizer of the trip. The proposal status is 'open'. |
| Trigger | The organizer clicks the option to close voting for a specific proposal before its deadline. |
| Main flow | 1. The system verifies the user is the organizer. 2. The system tallies the current "for" and "against" votes. 3. The "for" votes strictly exceed the "against" votes (BR-04). 4. The system checks if the proposal's time interval overlaps with any other activity that was approved while this proposal was in the open state (BR-11). 5. The system marks the proposal as 'approved' and adds it to the day's itinerary (FR-14). |
| Alternative flows | A1. Tie resolution (FR-12): The "for" and "against" votes are equal. The system prompts the organizer to manually choose whether to approve or reject the proposal. A2. Rejected: The "against" votes exceed the "for" votes. The system marks the proposal as 'rejected'. A3. Overlap conflict (BR-11): The proposal won the vote, but its time slot was taken by another activity approved earlier. The system marks it as 'rejected' due to conflict and notifies the organizer. |
| Exceptions | E1. User is not the organizer: 403. E2. Proposal not found: 404. E3. Proposal is already closed: 409. |
| Postconditions | The proposal status changes to 'approved' or 'rejected'. If approved, it is officially scheduled in the itinerary. |
| Related | FR-11, FR-12, FR-14, BR-04, BR-11 |

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