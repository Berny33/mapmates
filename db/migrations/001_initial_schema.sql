-- Initial schema for Sprint 2 (users, trips, trip members and sessions)

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    email         TEXT NOT NULL UNIQUE
                  CHECK (char_length(email) <= 254 AND email = lower(email)),
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trips (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    destination TEXT NOT NULL CHECK (char_length(destination) BETWEEN 1 AND 100),
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('solo', 'collaborative')),
    max_members INT NOT NULL DEFAULT 15 CHECK (max_members > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE TABLE trip_members (
    trip_id   UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role      TEXT NOT NULL CHECK (role IN ('organizer', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (trip_id, user_id)
);

-- Exactly one organizer per trip (BR-01)
CREATE UNIQUE INDEX one_organizer_per_trip
    ON trip_members (trip_id)
    WHERE role = 'organizer';

-- Speeds up "list my trips" (lookup by user)
CREATE INDEX trip_members_user_id_idx ON trip_members (user_id);

-- Table used by the session store (connect-pg-simple). It is infrastructure,
-- not part of the domain model.
CREATE TABLE session (
    sid    VARCHAR PRIMARY KEY,
    sess   JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX session_expire_idx ON session (expire);