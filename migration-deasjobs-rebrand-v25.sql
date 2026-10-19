-- DEASJobs v25 rebrand migration
-- Safe to run more than once against the existing buisder-db database.
-- The underlying D1 database and R2 bucket names are intentionally retained to avoid data migration.

UPDATE commercial_plans
SET description = replace(description, 'Buisder', 'DEASJobs'), updated_at=CURRENT_TIMESTAMP
WHERE description LIKE '%Buisder%';

UPDATE pilot_settings
SET pilot_name = replace(pilot_name, 'Buisder', 'DEASJobs'), updated_at=CURRENT_TIMESTAMP
WHERE pilot_name LIKE '%Buisder%';

UPDATE notifications
SET title = replace(title, 'Buisder', 'DEASJobs'),
    body = replace(body, 'Buisder', 'DEASJobs')
WHERE title LIKE '%Buisder%' OR body LIKE '%Buisder%';

UPDATE lawful_basis_register
SET processing_activity=replace(processing_activity,'Buisder','DEASJobs'),
    purpose=replace(purpose,'Buisder','DEASJobs'),
    data_categories=replace(data_categories,'Buisder','DEASJobs'),
    children_consideration=replace(children_consideration,'Buisder','DEASJobs'),
    updated_at=CURRENT_TIMESTAMP
WHERE processing_activity LIKE '%Buisder%' OR purpose LIKE '%Buisder%' OR data_categories LIKE '%Buisder%' OR children_consideration LIKE '%Buisder%';

UPDATE retention_register
SET data_category=replace(data_category,'Buisder','DEASJobs'),
    system=replace(system,'Buisder','DEASJobs'),
    proposed_rule=replace(proposed_rule,'Buisder','DEASJobs'),
    deletion_method=replace(deletion_method,'Buisder','DEASJobs'),
    rationale=replace(rationale,'Buisder','DEASJobs'),
    updated_at=CURRENT_TIMESTAMP
WHERE data_category LIKE '%Buisder%' OR system LIKE '%Buisder%' OR proposed_rule LIKE '%Buisder%' OR deletion_method LIKE '%Buisder%' OR rationale LIKE '%Buisder%';

UPDATE compliance_checklist
SET label=replace(label,'Buisder','DEASJobs'), updated_at=CURRENT_TIMESTAMP
WHERE label LIKE '%Buisder%';

UPDATE processor_register
SET service=replace(service,'Buisder','DEASJobs'),
    data_categories=replace(data_categories,'Buisder','DEASJobs'),
    purpose=replace(purpose,'Buisder','DEASJobs'),
    location_notes=replace(location_notes,'Buisder','DEASJobs'),
    updated_at=CURRENT_TIMESTAMP
WHERE service LIKE '%Buisder%' OR data_categories LIKE '%Buisder%' OR purpose LIKE '%Buisder%' OR location_notes LIKE '%Buisder%';

UPDATE legal_settings
SET setting_value=replace(setting_value,'@buisder.com','@deasjobs.com'), updated_at=CURRENT_TIMESTAMP
WHERE setting_value LIKE '%@buisder.com%';
