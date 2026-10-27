# Deas Jobs v25.19 — logos and profile photos

This is an **update-only** patch based on v25.18, including the most recent supplied DEAS JOBS logo.

## Updated features
- Removes black rectangular padding/background around the logo by using a transparent-outside-circle copy; artwork and lettering inside the circle are preserved.
- PWA icon assets have white surrounding the circular logo.
- Shows uploaded business logos on the jobseeker swipe cards, next to the employer details, at a larger size.
- Enlarges jobseeker profile photos on employer applicant lists and profile screens.
- Under-18 photo sharing remains off by default. A jobseeker aged 16–17 may explicitly opt in using **Privacy settings → Share my profile photo with employers I apply to**. Email and CV sharing remain disabled for under-18 jobseekers.
- Profile-photo file requests are protected: an employer must have a matching application and the jobseeker must have opted in; the owner or admin may access their photo.

## Deployment
1. Extract the patch ZIP.
2. Copy `public` and `functions` into the equivalent repository folders, replacing matching files. **Do not delete the original folders.**
3. Commit and push with GitHub Desktop.
4. Check Cloudflare Production deployment and test with two real accounts (one employer and one jobseeker).
5. Verify that the logo/icon updates load on the `.com` domain; installed PWAs may need to be closed and reopened to refresh icons.

## QA cases
- An employer with a logo: confirm it displays on swipe cards.
- An employer without a logo: confirm job cards still display normally.
- Jobseeker aged 16–17: photo sharing is initially disabled; toggle it on/off in Privacy settings, then check applicant list visibility with a separate employer account.
- Confirm unrelated employers cannot fetch an applicant photo.
- Confirm no changes to job descriptions, matching, applications, or other site content.

No D1 migration. No new Functions files. Production testing is still required.
