-- DEASJobs v8 R2 storage migration
-- Run ONCE in Cloudflare D1 before deploying v8.
--
-- Your Pages project must already have an R2 binding:
--   Variable name: FILES
--   Bucket: buisder-files

ALTER TABLE jobseeker_profiles ADD COLUMN photo_key TEXT;
ALTER TABLE jobseeker_profiles ADD COLUMN cv_key TEXT;
ALTER TABLE jobseeker_profiles ADD COLUMN cv_content_type TEXT;
ALTER TABLE jobseeker_profiles ADD COLUMN cv_size INTEGER;

ALTER TABLE employer_profiles ADD COLUMN logo_key TEXT;

-- Existing base64 profile photos and logos are intentionally left in place.
-- They remain as a legacy fallback until the user uploads a new image to R2.
--
-- Existing "CV filenames" also remain. A real CV file is created in R2
-- the next time the job seeker selects a CV and saves their profile.
