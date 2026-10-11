# Buisder v8 — Cloudflare R2 file storage

## What changed

Buisder now stores new uploads in the private `buisder-files` R2 bucket.

### R2 files
- Job-seeker profile photos
- Employer business logos/photos
- Real CV files

### D1 now stores
- R2 object keys
- CV filename
- CV content type
- CV size
- normal profile/business data

It no longer stores newly uploaded image bodies as base64.

## Privacy / access

The R2 bucket remains private.

Files are served through authenticated Buisder Functions:

- profile photo: signed-in Buisder users
- business logo: signed-in Buisder users
- CV: only:
  - the job seeker who owns it
  - an employer who has received an application from that job seeker
  - a Buisder admin

Employers cannot browse arbitrary CVs.

## Existing images

Existing base64 profile photos and business logos are not deleted by the migration.
They remain visible as a fallback.

When the user next uploads a new photo/logo, Buisder stores it in R2 and clears the old base64 copy.

## Existing CV entries

Older profiles may contain only a CV filename because the previous version did not store the actual file.

Those users should:

1. Open Profile.
2. Select their CV again.
3. Save Profile.

The real file will then be uploaded to R2.

## Deployment

1. Confirm Cloudflare Pages has:
   - R2 binding variable: `FILES`
   - bucket: `buisder-files`
2. Run `migration-r2-storage-v8.sql` ONCE in the same D1 database used by Buisder.
3. Commit/deploy the v8 files.
4. Redeploy Cloudflare Pages.
5. Test with a job-seeker account:
   - upload/change profile photo
   - upload PDF CV
   - save
   - reopen Profile
6. Check Cloudflare R2 > `buisder-files` for:
   - `profile-photos/<USER_ID>/current`
   - `cvs/<USER_ID>/current`
7. Test an employer:
   - upload/change business logo
   - view a candidate who applied
   - open that candidate's CV
8. Check that a different employer with no application cannot access that CV.

## Limits

- Images: 5 MB before client compression
- CVs: 10 MB
- CV formats: PDF, DOC, DOCX
- Image formats: JPG, PNG, WebP
