CREATE TABLE identity (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  identity_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_path TEXT,
  status_message TEXT,
  created_at INTEGER NOT NULL
);
