-- Deas Jobs v10 — Job offer workflow
-- Run ONCE in the same Cloudflare D1 database used by Deas Jobs.
-- This migration only CREATES a new table/indexes. It does not alter existing columns.

CREATE TABLE IF NOT EXISTS job_offers (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jobseeker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  pay TEXT NOT NULL,
  start_date TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_offers_employer
ON job_offers(employer_id);

CREATE INDEX IF NOT EXISTS idx_job_offers_jobseeker
ON job_offers(jobseeker_id);

-- Verification:
SELECT name
FROM sqlite_master
WHERE type='table' AND name='job_offers';
