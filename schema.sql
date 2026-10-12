-- Buisder database schema (Cloudflare D1 / SQLite)
-- Run with: wrangler d1 execute buisder-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('jobseeker','employer')),
  name TEXT,
  is_suspended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS verified_emails (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose
ON auth_tokens(user_id, purpose);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS admin_users (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);

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
  cv_filename TEXT,
  photo_data TEXT,
  photo_key TEXT,
  cv_key TEXT,
  cv_content_type TEXT,
  cv_size INTEGER,
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  max_distance_km INTEGER NOT NULL DEFAULT 25,
  min_pay REAL,
  preferred_employment_type TEXT NOT NULL DEFAULT 'Any',
  latitude REAL,
  longitude REAL
);

CREATE TABLE IF NOT EXISTS employer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT,
  legal_name TEXT,
  location TEXT,
  description TEXT,
  phone TEXT,
  website TEXT,
  registration_number TEXT,
  logo_data TEXT,
  logo_key TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  verification_submitted_at TEXT,
  verification_reviewed_at TEXT,
  verification_note TEXT
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
  employment_type TEXT NOT NULL DEFAULT 'Part-time',
  min_age INTEGER NOT NULL DEFAULT 16,
  pay_min REAL,
  schedule_tags TEXT NOT NULL DEFAULT '[]',
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'active',  -- active | closed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  jobseeker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied',
  shortlisted_at TEXT,
  interview_invited_at TEXT,
  interview_accepted_at TEXT,
  interview_declined_at TEXT,
  interview_completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(job_id, jobseeker_id)
);

CREATE TABLE IF NOT EXISTS application_status_history (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);



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

CREATE INDEX IF NOT EXISTS idx_job_offers_employer ON job_offers(employer_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_jobseeker ON job_offers(jobseeker_id);

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
CREATE INDEX IF NOT EXISTS idx_application_status_history_app ON application_status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_skips_jobseeker ON skips(jobseeker_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_invites_application ON interview_invites(application_id);

-- A few seed jobs so the swipe feed isn't empty on a fresh database.
-- Safe to delete these rows once real employers start posting.
INSERT OR IGNORE INTO users (id, email, password_hash, password_salt, role, name)
VALUES ('seed-employer', 'seed@buisder.app', 'x', 'x', 'employer', 'Buisder Demo Employer');
INSERT OR IGNORE INTO employer_profiles
(user_id, company_name, legal_name, location, description, verification_status, verification_reviewed_at)
VALUES
('seed-employer', 'Harbour Sports', 'Harbour Sports Ltd', 'Cork',
 'Demo listings to preview the swipe feed.', 'verified', datetime('now'));

INSERT OR IGNORE INTO jobs
(id, employer_id, title, company, location, pay, hours, experience, start_date, description, tags,
 employment_type, min_age, pay_min, schedule_tags)
VALUES
('seed-job-1','seed-employer','Retail Assistant','Harbour Sports','Cork City Centre','€14.20/hr','Sat + 2 evenings','None','Next week','Fast-paced store role with customers and stock support.','["Retail"]','Part-time',16,14.20,'["Saturday","Evenings"]'),
('seed-job-2','seed-employer','Café Team Member','Bean & Co.','Douglas','€13.90/hr','Weekend shifts','None','Immediate','Friendly front-of-house role with coffee and customer service.','["Hospitality"]','Part-time',16,13.90,'["Saturday","Sunday"]'),
('seed-job-3','seed-employer','Event Crew','LiveWorks','Cork City Centre','€15.00/hr','Flexible evenings','None','This month','Set-up support for live events, venues and promotions.','["Events"]','Temporary / Seasonal',18,15.00,'["Evenings","Saturday","Sunday"]');


-- Existing built-in demo account is trusted for fresh development databases.
INSERT OR IGNORE INTO verified_emails (user_id)
VALUES ('seed-employer');
