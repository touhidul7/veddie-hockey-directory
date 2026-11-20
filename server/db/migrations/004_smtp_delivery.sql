ALTER TABLE rinkcircuit.email_outbox
  ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN locked_until TIMESTAMPTZ,
  ADD COLUMN last_error TEXT,
  ADD COLUMN message_id TEXT,
  ADD COLUMN verification_id TEXT REFERENCES rinkcircuit.email_verifications(id),
  ADD COLUMN expires_at TIMESTAMPTZ;
UPDATE rinkcircuit.email_outbox AS mail SET
  verification_id = verification.id, expires_at = verification.expires_at::timestamptz
FROM rinkcircuit.email_verifications AS verification
WHERE mail.lead_id = verification.lead_id AND position(verification.token IN mail.body) > 0;
CREATE INDEX idx_outbox_due ON rinkcircuit.email_outbox(status, next_attempt_at);
