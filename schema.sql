-- Buisder database schema (Cloudflare D1 / SQLite)
-- Run with: wrangler d1 execute buisder-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('jobseeker','employer')),
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobseeker_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age_band TEXT,
  phone TEXT,
  location TEXT,
  about TEXT,
  skills TEXT,
  education TEXT,
  experience TEXT,
  availability TEXT,
  interests TEXT,
  transport TEXT,
  cv_filename TEXT
);

CREATE TABLE IF NOT EXISTS employer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT,
  location TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  pay TEXT,
  hours TEXT,
  experience TEXT,
  start_date TEXT,
  description TEXT,
  tags TEXT,                              -- JSON array, stored as text, e.g. ["Retail"]
  status TEXT NOT NULL DEFAULT 'active',  -- active | closed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  jobseeker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied', -- applied | invited
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(job_id, jobseeker_id)
);

CREATE TABLE IF NOT EXISTS skips (
  jobseeker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (jobseeker_id, job_id)
);

CREATE TABLE IF NOT EXISTS interview_invites (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  interview_at TEXT NOT NULL,
  location TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_employer ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_jobseeker ON applications(jobseeker_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_skips_jobseeker ON skips(jobseeker_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_invites_application ON interview_invites(application_id);

-- A few seed jobs so the swipe feed isn't empty on a fresh database.
-- Safe to delete these rows once real employers start posting.
INSERT OR IGNORE INTO users (id, email, password_hash, password_salt, role, name)
VALUES ('seed-employer', 'seed@buisder.app', 'x', 'x', 'employer', 'Buisder Demo Employer');
INSERT OR IGNORE INTO employer_profiles (user_id, company_name, location, description)
VALUES ('seed-employer', 'Harbour Sports', 'Cork', 'Demo listings to preview the swipe feed.');

INSERT OR IGNORE INTO jobs (id, employer_id, title, company, location, pay, hours, experience, start_date, description, tags)
VALUES
('seed-job-1','seed-employer','Retail Assistant','Harbour Sports','Cork City Centre','€14.20/hr','Sat + 2 evenings','None','Next week','Fast-paced store role with customers and stock support.','["Retail"]'),
('seed-job-2','seed-employer','Café Team Member','Bean & Co.','Douglas','€13.90/hr','Weekend shifts','None','Immediate','Friendly front-of-house role with coffee and customer service.','["Hospitality"]'),
('seed-job-3','seed-employer','Event Crew','LiveWorks','Cork City Centre','€15.00/hr','Flexible evenings','None','This month','Set-up support for live events, venues and promotions.','["Events"]');
