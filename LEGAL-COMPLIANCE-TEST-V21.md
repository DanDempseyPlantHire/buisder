# Buisder v21 Test Plan

## Migration and build
1. Back up production D1.
2. Run `migration-legal-compliance-v21-d1-safe.sql`.
3. Deploy the complete v21 package, including all files under `functions/_lib/`.
4. Confirm Cloudflare Pages Functions builds without unresolved imports.

## Admin compliance
1. Sign in as admin and open Compliance.
2. Enter test/confirmed controller details and save.
3. Open `/privacy.html` and confirm the controller/contact values appear.
4. Update one compliance checklist item and confirm it persists.
5. Create a test personal-data incident and update its risk/status.
6. Confirm admin audit-log entries are created for compliance actions.

## User rights
1. Sign in as a disposable job-seeker account.
2. Open Account & Privacy -> Terms, privacy & your rights.
3. Submit an access request.
4. Submit a test complaint.
5. Confirm both appear in Admin -> Compliance.
6. Add an admin response and complete/resolve them.
7. Confirm the user can see the response.
8. Confirm personal-data export includes rights requests and complaints.

## Legal documents
Open and review on mobile and desktop:
- Privacy Notice
- Terms of Use
- Young Users Privacy Guide
- Cookies & Device Storage
- Your Data Protection Rights

## Analytics redesign
Test Admin Analytics and Employer Analytics at:
- narrow mobile width
- tablet width
- desktop width

Confirm:
- no overlapping bars/labels
- no grey/light text that is difficult to read on white cards
- job ranking cards wrap rather than overflow
- date/activity rows stack on small screens
- period selectors remain usable
- CSV export still works for admin analytics
