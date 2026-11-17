CREATE TABLE invitations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id    UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE
               CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX invitations_one_unrevoked_per_trip
    ON invitations (trip_id)
    WHERE revoked_at IS NULL;

CREATE INDEX invitations_trip_id_idx ON invitations (trip_id);
