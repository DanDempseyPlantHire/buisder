-- Deas Jobs v7 admin dashboard migration
-- Run ONCE in Cloudflare D1 before deploying v7.

ALTER TABLE users ADD COLUMN is_suspended INTEGER NOT NULL DEFAULT 0;

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

-- Grant admin access to the existing Deas Jobs support account.
-- This does NOT store or change the account password.
INSERT OR IGNORE INTO admin_users (user_id)
SELECT id
FROM users
WHERE lower(email) = lower('buisdersupport@gmail.com');

-- Check that the admin grant worked:
SELECT u.id, u.email, u.role, au.created_at AS admin_since
FROM users u
JOIN admin_users au ON au.user_id = u.id
WHERE lower(u.email) = lower('buisdersupport@gmail.com');
