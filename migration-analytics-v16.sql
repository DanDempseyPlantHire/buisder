-- Deas Jobs v16 — Analytics + Pilot Measurement
-- Run once in the live D1 database before deploying v16.
-- No ALTER TABLE statements are used.


CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_role TEXT,
  event_type TEXT NOT NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  event_key TEXT UNIQUE,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created
ON analytics_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
ON analytics_events(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_job_created
ON analytics_events(job_id, created_at);


-- Backfill recoverable historical events so the first v16 dashboard
-- is useful immediately. Historical skips that were later undone/applied
-- cannot be reconstructed because older versions deleted those skip rows.

INSERT OR IGNORE INTO analytics_events
(id, user_id, user_role, event_type, event_key, created_at)
SELECT
  'legacy-signup-' || id,
  id,
  role,
  'user_signup',
  'user_signup:' || id,
  created_at
FROM users
WHERE id <> 'seed-employer';

INSERT OR IGNORE INTO analytics_events
(id, user_id, user_role, event_type, job_id, event_key, created_at)
SELECT
  'legacy-job-' || id,
  employer_id,
  'employer',
  'job_posted',
  id,
  'job_posted:' || id,
  created_at
FROM jobs
WHERE employer_id <> 'seed-employer';

INSERT OR IGNORE INTO analytics_events
(id, user_id, user_role, event_type, job_id, application_id, event_key, created_at)
SELECT
  'legacy-application-' || a.id,
  a.jobseeker_id,
  'jobseeker',
  'application_submitted',
  a.job_id,
  a.id,
  'application:' || a.id || ':submitted',
  a.created_at
FROM applications a
JOIN jobs j ON j.id=a.job_id
WHERE j.employer_id <> 'seed-employer';

INSERT OR IGNORE INTO analytics_events
(id, user_id, user_role, event_type, job_id, event_key, created_at)
SELECT
  'legacy-skip-' || s.jobseeker_id || '-' || s.job_id,
  s.jobseeker_id,
  'jobseeker',
  'job_skip',
  s.job_id,
  'job_skip:' || s.jobseeker_id || ':' || s.job_id,
  s.created_at
FROM skips s
JOIN jobs j ON j.id=s.job_id
WHERE j.employer_id <> 'seed-employer';


SELECT
  (SELECT COUNT(*) FROM analytics_events) AS analytics_events,
  (SELECT COUNT(*) FROM analytics_events WHERE event_type='application_submitted') AS application_events,
  (SELECT COUNT(*) FROM analytics_events WHERE event_type='job_skip') AS skip_events;
