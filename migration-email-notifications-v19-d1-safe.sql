CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  recruitment_emails INTEGER NOT NULL DEFAULT 1,
  application_updates INTEGER NOT NULL DEFAULT 1,
  interviews INTEGER NOT NULL DEFAULT 1,
  interview_reminders INTEGER NOT NULL DEFAULT 1,
  offers INTEGER NOT NULL DEFAULT 1,
  outcomes INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_delivery_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  sent_at TEXT,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_user_created
ON email_delivery_log(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_email_delivery_status_created
ON email_delivery_log(status, created_at);

CREATE TABLE IF NOT EXISTS email_scheduler_state (
  job_key TEXT PRIMARY KEY,
  last_run_at TEXT
);

INSERT OR IGNORE INTO notification_preferences (user_id)
SELECT id FROM users;

INSERT OR IGNORE INTO email_scheduler_state (job_key, last_run_at)
VALUES ('interview_reminders', NULL);

INSERT OR IGNORE INTO pilot_launch_checklist (item_key, label)
VALUES ('recruitment_emails_tested', 'Recruitment email notifications and preferences tested');
