-- Run this ONCE in Cloudflare D1 Console for an existing Deas Jobs database.
ALTER TABLE jobseeker_profiles ADD COLUMN photo_data TEXT;
ALTER TABLE jobseeker_profiles ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0;
