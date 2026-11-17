CREATE TABLE proposal_votes (
    proposal_id UUID NOT NULL REFERENCES proposals (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    value       TEXT NOT NULL CHECK (value IN ('for', 'against')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (proposal_id, user_id)
);
