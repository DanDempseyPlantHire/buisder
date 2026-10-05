# Buisder interview scheduling v2

Employer flow now shows interview scheduling directly on each applicant card:
- date
- time
- place / meeting method
- optional message
- Send interview invitation

Job seeker receives:
- prominent in-app new interview alert
- interview card under Applications
- Accept interview / Decline buttons
- optional browser notification permission and notification while the web app is open/backgrounded
- 20-second polling for new invitations while signed in

Before deployment to an existing Cloudflare D1 database, run migration-interviews.sql once in the D1 console.
