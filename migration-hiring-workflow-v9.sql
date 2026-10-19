-- DEASJobs v9 — shortlisting + formal interview workflow
-- Run ONCE in the same Cloudflare D1 database used by DEASJobs.

ALTER TABLE applications ADD COLUMN shortlisted_at TEXT;
ALTER TABLE applications ADD COLUMN interview_invited_at TEXT;
ALTER TABLE applications ADD COLUMN interview_accepted_at TEXT;
ALTER TABLE applications ADD COLUMN interview_declined_at TEXT;
ALTER TABLE applications ADD COLUMN interview_completed_at TEXT;
ALTER TABLE applications ADD COLUMN updated_at TEXT;

UPDATE applications
SET updated_at=COALESCE(updated_at, created_at, datetime('now'));

CREATE TABLE IF NOT EXISTS application_status_history (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_application_status_history_app
ON application_status_history(application_id);

-- Normalise the older v8 interview status name.
UPDATE applications
SET status='interview_invited',
    interview_invited_at=COALESCE(interview_invited_at, updated_at, created_at),
    updated_at=datetime('now')
WHERE status='invited';

UPDATE applications
SET interview_accepted_at=COALESCE(interview_accepted_at, updated_at, created_at)
WHERE status='interview_accepted';

UPDATE applications
SET interview_declined_at=COALESCE(interview_declined_at, updated_at, created_at)
WHERE status='interview_declined';

-- Add one baseline history row for existing applications.
INSERT INTO application_status_history
(id, application_id, status, actor_user_id, note, created_at)
SELECT
  lower(hex(randomblob(16))),
  a.id,
  a.status,
  NULL,
  'Existing application imported into v9 workflow',
  COALESCE(a.updated_at, a.created_at)
FROM applications a
WHERE NOT EXISTS (
  SELECT 1
  FROM application_status_history h
  WHERE h.application_id=a.id
);
