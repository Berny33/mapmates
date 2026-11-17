CREATE TABLE proposals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    place_name      TEXT NOT NULL CHECK (char_length(place_name) BETWEEN 1 AND 200),
    lat             NUMERIC(9, 6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lon             NUMERIC(9, 6) NOT NULL CHECK (lon BETWEEN -180 AND 180),
    category        TEXT NOT NULL CHECK (
                        category IN (
                            'food',
                            'sightseeing',
                            'culture',
                            'nature',
                            'nightlife',
                            'shopping',
                            'transport',
                            'other'
                        )
                    ),
    day             DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL CHECK (end_time > start_time),
    note            TEXT CHECK (note IS NULL OR char_length(note) <= 280),
    voting_deadline TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL CHECK (
                        status IN (
                            'open',
                            'tied',
                            'approved',
                            'rejected',
                            'rejected_conflict'
                        )
                    ),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX proposals_trip_day_status_idx
    ON proposals (trip_id, day, status);
