CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_seq INTEGER NOT NULL,
  hlc TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'system')),
  body TEXT,
  attachment_path TEXT,
  reply_to_id TEXT REFERENCES messages(id),
  sent_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted_at INTEGER,
  sig TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed'))
);
CREATE UNIQUE INDEX idx_messages_author ON messages(room_id, author_id, author_seq);
CREATE INDEX idx_messages_room_time ON messages(room_id, sent_at);
