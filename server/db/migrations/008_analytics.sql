CREATE TABLE rinkcircuit.analytics_daily (
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  event_name TEXT NOT NULL,
  count BIGINT NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY(day,event_name)
);
ALTER TABLE rinkcircuit.analytics_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rinkcircuit.analytics_daily FROM PUBLIC;
CREATE INDEX IF NOT EXISTS offerings_programme_idx ON rinkcircuit.season_offerings(programme_id);
CREATE INDEX IF NOT EXISTS programme_public_city_idx ON rinkcircuit.league_programmes(publication_status,municipality);
