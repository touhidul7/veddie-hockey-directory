CREATE TABLE rinkcircuit.request_limits (
  key_hash TEXT PRIMARY KEY,
  hits INTEGER NOT NULL CHECK (hits > 0),
  expires_at BIGINT NOT NULL
);
CREATE INDEX idx_request_limits_expiry ON rinkcircuit.request_limits(expires_at);
ALTER TABLE rinkcircuit.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rinkcircuit.request_limits FROM PUBLIC;
