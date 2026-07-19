CREATE VIRTUAL TABLE messages_fts USING fts5(
  body, content='messages', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2');

INSERT INTO messages_fts(rowid, body)
  SELECT rowid, body FROM messages WHERE body IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER messages_fts_ai AFTER INSERT ON messages
WHEN new.body IS NOT NULL AND new.deleted_at IS NULL BEGIN
  INSERT INTO messages_fts(rowid, body) VALUES (new.rowid, new.body);
END;

CREATE TRIGGER messages_fts_ad AFTER DELETE ON messages
WHEN old.body IS NOT NULL AND old.deleted_at IS NULL BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, body) VALUES ('delete', old.rowid, old.body);
END;

CREATE TRIGGER messages_fts_au AFTER UPDATE OF body, deleted_at ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, body)
    SELECT 'delete', old.rowid, old.body
     WHERE old.body IS NOT NULL AND old.deleted_at IS NULL;
  INSERT INTO messages_fts(rowid, body)
    SELECT new.rowid, new.body
     WHERE new.body IS NOT NULL AND new.deleted_at IS NULL;
END;
