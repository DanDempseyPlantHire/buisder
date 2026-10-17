# Buisder v23 Growth test plan

1. Run the v23 migration twice; the second run must succeed.
2. Admin: open Growth and create a partner, campaign, referral link and employer prospect.
3. Pause and reactivate each campaign/partner/referral link.
4. Open a generated `/join/CODE` link in a private browser session and confirm it opens signup with the code populated.
5. Create a candidate account and confirm the signup appears under Admin > Growth and the referring link's signup count increases.
6. Complete the candidate profile, apply to a job, progress to interview/hire and confirm the candidate funnel updates.
7. Repeat with an employer referral through verification and first job post.
8. Test a role-mismatched, paused, expired and maxed-out code; signup should explain the problem without creating an incorrectly attributed account.
9. Visit a UTM link such as `/?signup=1&utm_source=partner&utm_medium=referral&utm_campaign=test-key`, create an account and confirm first-touch campaign attribution.
10. Export the user's data and confirm the `growth` section contains attribution/referral data.
11. Mobile admin: confirm all 11 Admin bottom-navigation buttons are visible across three rows and none is cut off by the safe area.
12. Confirm no Google Analytics, Meta Pixel or other third-party growth tracker was added.
