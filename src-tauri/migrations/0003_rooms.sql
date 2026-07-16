CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('dm', 'group')),
  name TEXT,
  topic TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  last_message_at INTEGER
);

CREATE TABLE room_members (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at INTEGER NOT NULL,
  last_read_seq INTEGER NOT NULL DEFAULT 0,
  notifications_muted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, contact_id)
);
