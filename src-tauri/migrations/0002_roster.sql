CREATE TABLE roster (
  identity_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_path TEXT,
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  last_known_peer_id TEXT,
  updated_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER,
  revoked_by TEXT
);
CREATE INDEX idx_roster_revoked ON roster(revoked);

CREATE TABLE pending_invites (
  token TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  consumed_by TEXT
);
