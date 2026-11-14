
    -- Organisations (large operators like ASHL, True North, Municipalities, or Independent)
    CREATE TABLE IF NOT EXISTS rinkcircuit.organisations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      aliases TEXT,
      official_domain TEXT,
      operator_type TEXT,
      is_plaionn_owned INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- League programmes
    CREATE TABLE IF NOT EXISTS rinkcircuit.league_programmes (
      id TEXT PRIMARY KEY,
      organisation_id TEXT REFERENCES rinkcircuit.organisations(id),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      area TEXT NOT NULL,
      municipality TEXT NOT NULL,
      category TEXT NOT NULL,
      sport_type TEXT DEFAULT 'ice_hockey', -- 'ice_hockey' or 'ball_hockey'
      description TEXT,
      publication_status TEXT DEFAULT 'draft', -- 'draft', 'review', 'published', 'archived'
      verification_status TEXT DEFAULT 'unverified', -- 'unverified', 'research_checked', 'operator_confirmed', 'needs_review'
      claimed_status TEXT DEFAULT 'unclaimed', -- 'unclaimed', 'pending_claim', 'claimed'
      owner_disclosure TEXT,
      is_sponsored INTEGER DEFAULT 0,
      priority_score INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Season offerings (Winter, Summer, etc.)
    CREATE TABLE IF NOT EXISTS rinkcircuit.season_offerings (
      id TEXT PRIMARY KEY,
      programme_id TEXT NOT NULL REFERENCES rinkcircuit.league_programmes(id) ON DELETE CASCADE,
      season_label TEXT NOT NULL,
      skill_labels TEXT,
      nights TEXT, -- JSON array of strings e.g. ["Monday", "Wednesday"]
      age_eligibility TEXT,
      registration_modes TEXT, -- e.g. "Team & Individual"
      registration_status TEXT DEFAULT 'unknown', -- 'open', 'limited', 'waitlist', 'closed', 'unknown'
      fee_amount DOUBLE PRECISION,
      fee_currency TEXT DEFAULT 'CAD',
      fee_unit TEXT DEFAULT 'per team',
      fee_notes TEXT,
      registration_url TEXT,
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Arenas / Facilities
    CREATE TABLE IF NOT EXISTS rinkcircuit.arenas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT NOT NULL,
      province TEXT DEFAULT 'ON',
      postal_code TEXT,
      created_at TEXT NOT NULL
    );

    -- Offering to Arenas junction
    CREATE TABLE IF NOT EXISTS rinkcircuit.offering_arenas (
      offering_id TEXT NOT NULL REFERENCES rinkcircuit.season_offerings(id) ON DELETE CASCADE,
      arena_id TEXT NOT NULL REFERENCES rinkcircuit.arenas(id) ON DELETE CASCADE,
      PRIMARY KEY (offering_id, arena_id)
    );

    -- Source evidence (URLs, check dates, audit trail of facts)
    CREATE TABLE IF NOT EXISTS rinkcircuit.source_evidence (
      id TEXT PRIMARY KEY,
      programme_id TEXT NOT NULL REFERENCES rinkcircuit.league_programmes(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      source_type TEXT DEFAULT 'official_website',
      retrieved_at TEXT,
      checked_at TEXT,
      evidence_summary TEXT,
      created_at TEXT NOT NULL
    );

    -- Slug redirects (for Acceptance Test A18)
    CREATE TABLE IF NOT EXISTS rinkcircuit.slug_redirects (
      old_slug TEXT PRIMARY KEY,
      new_slug TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Teams (Approved public team identities)
    CREATE TABLE IF NOT EXISTS rinkcircuit.teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      city TEXT NOT NULL,
      division_label TEXT,
      home_league_id TEXT REFERENCES rinkcircuit.league_programmes(id),
      home_league_name TEXT,
      publication_status TEXT DEFAULT 'published', -- 'pending_review', 'published', 'rejected'
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Events & Tournaments
    CREATE TABLE IF NOT EXISTS rinkcircuit.events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'tournament', -- 'tournament', 'champions_league', 'showcase'
      lifecycle_state TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'interest-only', 'registration-open', 'full', 'completed'
      start_date TEXT,
      end_date TEXT,
      timezone TEXT DEFAULT 'America/Toronto',
      location_name TEXT,
      city TEXT NOT NULL,
      divisions TEXT,
      price_amount DOUBLE PRECISION,
      price_currency TEXT DEFAULT 'CAD',
      price_unit TEXT DEFAULT 'per team',
      guaranteed_games INTEGER,
      registration_deadline TEXT,
      format TEXT,
      policy_url TEXT,
      registration_url TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Private CRM Leads (Contact info strictly isolated from public views)
    CREATE TABLE IF NOT EXISTS rinkcircuit.leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'player',
      city TEXT,
      verification_status TEXT DEFAULT 'pending', -- 'pending', 'verified'
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Interests (Captains, Champions League, Tournaments, Request-a-league)
    CREATE TABLE IF NOT EXISTS rinkcircuit.interests (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES rinkcircuit.leads(id),
      interest_type TEXT NOT NULL, -- 'captain_team', 'champions_league', 'tournament', 'request_a_league'
      team_name TEXT,
      team_id TEXT REFERENCES rinkcircuit.teams(id),
      event_id TEXT REFERENCES rinkcircuit.events(id),
      league_id TEXT REFERENCES rinkcircuit.league_programmes(id),
      city TEXT,
      preferred_nights TEXT,
      skill_description TEXT,
      registration_mode TEXT,
      division TEXT,
      roster_size_estimate INTEGER,
      home_league_or_independent TEXT,
      additional_notes TEXT,
      dedupe_key TEXT UNIQUE,
      created_at TEXT NOT NULL
    );

    -- Email verification tokens
    CREATE TABLE IF NOT EXISTS rinkcircuit.email_verifications (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      lead_id TEXT NOT NULL REFERENCES rinkcircuit.leads(id),
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    -- Explicit Consents (CASL compliance)
    CREATE TABLE IF NOT EXISTS rinkcircuit.consents (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES rinkcircuit.leads(id),
      purpose TEXT NOT NULL, -- 'service_communication', 'public_team_profile', 'marketing'
      consent_text TEXT NOT NULL,
      granted INTEGER NOT NULL, -- 0 or 1
      created_at TEXT NOT NULL
    );

    -- Listing correction, claim, addition requests
    CREATE TABLE IF NOT EXISTS rinkcircuit.listing_requests (
      id TEXT PRIMARY KEY,
      request_type TEXT NOT NULL, -- 'claim', 'correction', 'new_addition', 'removal'
      programme_id TEXT REFERENCES rinkcircuit.league_programmes(id),
      suggested_name TEXT,
      requester_name TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      requester_role TEXT,
      evidence_url TEXT,
      message TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      admin_notes TEXT,
      decision_date TEXT,
      created_at TEXT NOT NULL
    );

    -- Staged Import Batches
    CREATE TABLE IF NOT EXISTS rinkcircuit.import_batches (
      id TEXT PRIMARY KEY,
      filename TEXT,
      source_name TEXT,
      total_rows INTEGER DEFAULT 0,
      approved_rows INTEGER DEFAULT 0,
      status TEXT DEFAULT 'staged', -- 'staged', 'committed', 'rolled_back'
      created_at TEXT NOT NULL
    );

    -- Staged Import Rows
    CREATE TABLE IF NOT EXISTS rinkcircuit.import_rows (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES rinkcircuit.import_batches(id) ON DELETE CASCADE,
      row_key TEXT,
      raw_data_json TEXT NOT NULL,
      candidate_programme_name TEXT,
      candidate_area TEXT,
      candidate_category TEXT,
      evidence_url TEXT,
      flags TEXT, -- JSON array of strings e.g. ["applicant_lead", "duplicate_candidate", "missing_fields"]
      status TEXT DEFAULT 'pending_review', -- 'pending_review', 'approved', 'skipped', 'rejected'
      created_at TEXT NOT NULL
    );

    -- Audit Logs (Actors, actions, timestamps, diffs)
    CREATE TABLE IF NOT EXISTS rinkcircuit.audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL
    );

    -- Indices for search performance
    CREATE INDEX IF NOT EXISTS idx_programme_slug ON rinkcircuit.league_programmes(slug);
    CREATE INDEX IF NOT EXISTS idx_programme_municipality ON rinkcircuit.league_programmes(municipality);
    CREATE INDEX IF NOT EXISTS idx_programme_status ON rinkcircuit.league_programmes(publication_status);
    CREATE INDEX IF NOT EXISTS idx_offering_programme ON rinkcircuit.season_offerings(programme_id);
    CREATE INDEX IF NOT EXISTS idx_events_slug ON rinkcircuit.events(slug);
    CREATE INDEX IF NOT EXISTS idx_teams_slug ON rinkcircuit.teams(slug);
    CREATE INDEX IF NOT EXISTS idx_interests_lead ON rinkcircuit.interests(lead_id);
    CREATE INDEX IF NOT EXISTS idx_verifications_token ON rinkcircuit.email_verifications(token);
  
-- Private schema: all access goes through the authenticated application API.
REVOKE ALL ON SCHEMA rinkcircuit FROM PUBLIC;
ALTER TABLE rinkcircuit.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.league_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.season_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.offering_arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.source_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.slug_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.listing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinkcircuit.audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
REVOKE ALL ON SCHEMA rinkcircuit FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA rinkcircuit FROM anon;
END IF;
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
REVOKE ALL ON SCHEMA rinkcircuit FROM authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA rinkcircuit FROM authenticated;
END IF;
END $$;
