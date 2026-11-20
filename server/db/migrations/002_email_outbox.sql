CREATE TABLE IF NOT EXISTS rinkcircuit.email_outbox (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES rinkcircuit.leads(id),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  sent_at TEXT
);
ALTER TABLE rinkcircuit.email_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_outbox_status ON rinkcircuit.email_outbox(status);
