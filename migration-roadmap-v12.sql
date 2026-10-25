-- Deas Jobs v12
-- Application timeline + employer controls + in-app notifications
--
-- Only the notification centre needs new database objects.
-- No ALTER TABLE statements are used.

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  application_id TEXT,
  job_id TEXT,
  event_key TEXT UNIQUE,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON notifications(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id, read_at);

-- Check:
SELECT name
FROM sqlite_master
WHERE type='table' AND name='notifications';
