CREATE TABLE friend_requests (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  from_pubkey TEXT NOT NULL,
  display_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_friend_requests_status ON friend_requests(direction, status);
