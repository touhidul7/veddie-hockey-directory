ALTER TABLE rinkcircuit.interests
  ADD COLUMN publication_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN publication_consent_text TEXT,
  ADD COLUMN publication_consent_at TEXT,
  ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending','approved','rejected')),
  ADD COLUMN moderated_at TEXT;
UPDATE rinkcircuit.interests SET moderation_status='approved' WHERE team_id IS NOT NULL;
ALTER TABLE rinkcircuit.listing_requests ADD COLUMN evidence_reviewed BOOLEAN NOT NULL DEFAULT false;
