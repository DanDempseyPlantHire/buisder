-- Deas Jobs v13 — authentication and security
-- Run ONCE in the same D1 database used by the live Deas Jobs Pages project.
-- This migration uses CREATE TABLE / INSERT only. No ALTER TABLE statements.

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

-- Grandfather all accounts that already existed before v13.
-- New v13 signups follow the new email-verification rules.
INSERT OR IGNORE INTO verified_emails (user_id)
SELECT id FROM users;

-- Verification
SELECT
  (SELECT COUNT(*) FROM verified_emails) AS verified_existing_accounts,
  (SELECT COUNT(*) FROM users) AS total_existing_accounts;
