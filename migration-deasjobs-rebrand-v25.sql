-- Deas Jobs v25 rebrand migration
-- Safe to run more than once against the existing buisder-db database.
-- The underlying D1 database and R2 bucket names are intentionally retained to avoid data migration.

UPDATE commercial_plans
SET description = replace(description, 'Buisder', 'Deas Jobs'), updated_at=CURRENT_TIMESTAMP
WHERE description LIKE '%Buisder%';

UPDATE pilot_settings
SET pilot_name = replace(pilot_name, 'Buisder', 'Deas Jobs'), updated_at=CURRENT_TIMESTAMP
WHERE pilot_name LIKE '%Buisder%';

UPDATE notifications
SET title = replace(title, 'Buisder', 'Deas Jobs'),
    body = replace(body, 'Buisder', 'Deas Jobs')
WHERE title LIKE '%Buisder%' OR body LIKE '%Buisder%';

UPDATE lawful_basis_register
SET processing_activity=replace(processing_activity,'Buisder','Deas Jobs'),
    purpose=replace(purpose,'Buisder','Deas Jobs'),
    data_categories=replace(data_categories,'Buisder','Deas Jobs'),
    children_consideration=replace(children_consideration,'Buisder','Deas Jobs'),
    updated_at=CURRENT_TIMESTAMP
WHERE processing_activity LIKE '%Buisder%' OR purpose LIKE '%Buisder%' OR data_categories LIKE '%Buisder%' OR children_consideration LIKE '%Buisder%';

UPDATE retention_register
SET data_category=replace(data_category,'Buisder','Deas Jobs'),
    system=replace(system,'Buisder','Deas Jobs'),
    proposed_rule=replace(proposed_rule,'Buisder','Deas Jobs'),
    deletion_method=replace(deletion_method,'Buisder','Deas Jobs'),
    rationale=replace(rationale,'Buisder','Deas Jobs'),
    updated_at=CURRENT_TIMESTAMP
WHERE data_category LIKE '%Buisder%' OR system LIKE '%Buisder%' OR proposed_rule LIKE '%Buisder%' OR deletion_method LIKE '%Buisder%' OR rationale LIKE '%Buisder%';

UPDATE compliance_checklist
SET label=replace(label,'Buisder','Deas Jobs'), updated_at=CURRENT_TIMESTAMP
WHERE label LIKE '%Buisder%';

UPDATE processor_register
SET service=replace(service,'Buisder','Deas Jobs'),
    data_categories=replace(data_categories,'Buisder','Deas Jobs'),
    purpose=replace(purpose,'Buisder','Deas Jobs'),
    location_notes=replace(location_notes,'Buisder','Deas Jobs'),
    updated_at=CURRENT_TIMESTAMP
WHERE service LIKE '%Buisder%' OR data_categories LIKE '%Buisder%' OR purpose LIKE '%Buisder%' OR location_notes LIKE '%Buisder%';

UPDATE legal_settings
SET setting_value=replace(setting_value,'@buisder.com','@deasjobs.com'), updated_at=CURRENT_TIMESTAMP
WHERE setting_value LIKE '%@buisder.com%';
