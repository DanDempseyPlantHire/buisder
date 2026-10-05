-- Buisder v5 job matching / filtering migration
-- Run once against the existing D1 database.

ALTER TABLE jobs ADD COLUMN employment_type TEXT NOT NULL DEFAULT 'Part-time';
ALTER TABLE jobs ADD COLUMN min_age INTEGER NOT NULL DEFAULT 16;
ALTER TABLE jobs ADD COLUMN pay_min REAL;
ALTER TABLE jobs ADD COLUMN schedule_tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE jobs ADD COLUMN latitude REAL;
ALTER TABLE jobs ADD COLUMN longitude REAL;

ALTER TABLE jobseeker_profiles ADD COLUMN max_distance_km INTEGER NOT NULL DEFAULT 25;
ALTER TABLE jobseeker_profiles ADD COLUMN min_pay REAL;
ALTER TABLE jobseeker_profiles ADD COLUMN preferred_employment_type TEXT NOT NULL DEFAULT 'Any';
ALTER TABLE jobseeker_profiles ADD COLUMN latitude REAL;
ALTER TABLE jobseeker_profiles ADD COLUMN longitude REAL;

-- Populate pay_min for the three original seed jobs if they exist.
UPDATE jobs SET pay_min=14.20, employment_type='Part-time', min_age=16, schedule_tags='["Saturday","Evenings"]'
WHERE id='seed-job-1';
UPDATE jobs SET pay_min=13.90, employment_type='Part-time', min_age=16, schedule_tags='["Saturday","Sunday"]'
WHERE id='seed-job-2';
UPDATE jobs SET pay_min=15.00, employment_type='Temporary / Seasonal', min_age=18, schedule_tags='["Evenings","Saturday","Sunday"]'
WHERE id='seed-job-3';
