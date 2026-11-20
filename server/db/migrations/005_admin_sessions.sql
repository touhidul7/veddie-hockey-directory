CREATE TABLE rinkcircuit.admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  credential_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_sessions_expiry ON rinkcircuit.admin_sessions(expires_at);
ALTER TABLE rinkcircuit.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rinkcircuit.admin_sessions FROM PUBLIC;
