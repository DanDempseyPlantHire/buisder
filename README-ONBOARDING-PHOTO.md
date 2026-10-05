# Buisder onboarding + profile photo upgrade

Changes:
- First-time job seekers are prompted to complete their profile before browsing jobs.
- The onboarding form collects name, location, about, skills, availability and job interests.
- Users can attach a profile picture.
- The profile page also lets users change their picture later.
- Completing onboarding sets `onboardingComplete = true`.

Important:
This implementation stores the selected image as a browser data URL in the current front-end state/local storage.
For a production multi-device app, move profile images to Cloudflare R2 or another object store and save the image URL in D1.
