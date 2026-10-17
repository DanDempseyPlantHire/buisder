# Buisder v21 D1 migration

Back up the production D1 database first. Then execute `migration-legal-compliance-v21-d1-safe.sql` against the existing production `buisder-db`.

The migration creates new compliance tables and seed registers only. It contains no `ALTER TABLE` statements.

After migration and deployment:
1. Open Admin -> Compliance.
2. Enter the confirmed legal controller name, address and privacy contact.
3. Review the compliance checklist.
4. Do not mark proposed lawful-basis or retention rows as legally approved until reviewed by qualified counsel/privacy lead.
5. Test a user data-rights request and complaint.
6. Test the incident register with a disposable example, then remove/close the test entry as appropriate.
