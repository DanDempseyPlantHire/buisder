-- DEASJobs v6 business verification + business profile image
-- Run ONCE on your existing D1 database before deploying v6.

ALTER TABLE employer_profiles ADD COLUMN legal_name TEXT;
ALTER TABLE employer_profiles ADD COLUMN phone TEXT;
ALTER TABLE employer_profiles ADD COLUMN website TEXT;
ALTER TABLE employer_profiles ADD COLUMN registration_number TEXT;
ALTER TABLE employer_profiles ADD COLUMN logo_data TEXT;
ALTER TABLE employer_profiles ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE employer_profiles ADD COLUMN verification_submitted_at TEXT;
ALTER TABLE employer_profiles ADD COLUMN verification_reviewed_at TEXT;
ALTER TABLE employer_profiles ADD COLUMN verification_note TEXT;

-- Optional: keep the built-in demo employer marked as verified.
UPDATE employer_profiles
SET verification_status='verified',
    verification_reviewed_at=datetime('now')
WHERE user_id='seed-employer';

-- MANUAL BETA APPROVAL EXAMPLE:
-- 1) Find pending businesses:
-- SELECT ep.user_id, u.email, ep.company_name, ep.legal_name, ep.registration_number,
--        ep.website, ep.phone, ep.verification_submitted_at
-- FROM employer_profiles ep
-- JOIN users u ON u.id=ep.user_id
-- WHERE ep.verification_status='pending';
--
-- 2) Approve one business after you have checked it:
-- UPDATE employer_profiles
-- SET verification_status='verified',
--     verification_reviewed_at=datetime('now'),
--     verification_note='Manually verified for beta'
-- WHERE user_id='PASTE-USER-ID-HERE';
--
-- 3) Reject if needed:
-- UPDATE employer_profiles
-- SET verification_status='rejected',
--     verification_reviewed_at=datetime('now'),
--     verification_note='Reason for rejection'
-- WHERE user_id='PASTE-USER-ID-HERE';
