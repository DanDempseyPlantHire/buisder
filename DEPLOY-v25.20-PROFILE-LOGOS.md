# Deas Jobs v25.20 — profile/logo repair

Changes: capped employer job-card logos to 64×64 pixels; added drag-to-position and zoom adjustment for chosen images; made R2 profile image responses non-cached to show employer photo changes; removed square/black framing around Deas Jobs logos.

## Installation
Unzip into the existing GitHub repository; replace **only** the corresponding files. Commit/push with GitHub Desktop. No database migration.

## Test
1. Test employer logo upload with a different image, crop and save; confirm updated logo in the employer profile and jobseeker job card.
2. Test crop/zoom/cancel with a jobseeker profile photo.
3. Test swipe cards on mobile (image should never expand beyond 64px).
4. Verify circular brand logo in login and app header.
