
CREATE TABLE IF NOT EXISTS legal_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, terms_version, privacy_version)
);

CREATE INDEX IF NOT EXISTS idx_legal_consents_user
ON legal_consents(user_id, accepted_at);

CREATE TABLE IF NOT EXISTS privacy_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  share_email INTEGER NOT NULL DEFAULT 1,
  share_cv INTEGER NOT NULL DEFAULT 1,
  share_photo INTEGER NOT NULL DEFAULT 1,
  share_location INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_blocks (
  id TEXT PRIMARY KEY,
  blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_user_id, blocked_user_id),
  CHECK(blocker_user_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker
ON user_blocks(blocker_user_id);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
ON user_blocks(blocked_user_id);

CREATE TABLE IF NOT EXISTS safety_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('job','employer','applicant')),
  target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('scam_fraud','misleading','inappropriate','harassment','discrimination','unsafe','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','dismissed')),
  admin_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_safety_reports_status
ON safety_reports(status, created_at);

CREATE INDEX IF NOT EXISTS idx_safety_reports_reporter
ON safety_reports(reporter_user_id, created_at);


-- Existing accounts retain current visibility defaults.
INSERT OR IGNORE INTO privacy_preferences (user_id)
SELECT id FROM users;

-- Existing accounts are deliberately NOT inserted into legal_consents.
-- They can review and accept the current pilot terms/privacy summary in Account & Privacy.

SELECT name
FROM sqlite_master
WHERE type='table'
  AND name IN ('legal_consents','privacy_preferences','user_blocks','safety_reports')
ORDER BY name;
