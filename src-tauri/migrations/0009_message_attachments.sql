ALTER TABLE messages ADD COLUMN attachment_id TEXT;
ALTER TABLE messages ADD COLUMN attachment_name TEXT;
ALTER TABLE messages ADD COLUMN attachment_size INTEGER;
ALTER TABLE messages ADD COLUMN attachment_type TEXT;

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  data BLOB NOT NULL
);
