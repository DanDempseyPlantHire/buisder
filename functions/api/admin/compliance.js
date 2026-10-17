import { json, requireAdmin } from "../../_lib/db.js";

async function all(env, sql, args=[]) { const { results } = await env.DB.prepare(sql).bind(...args).all(); return results || []; }
async function first(env, sql, args=[]) { return await env.DB.prepare(sql).bind(...args).first(); }

export async function onRequestGet(context) {
  const { env } = context;
  const { error } = await requireAdmin(context);
  if (error) return error;

  const settingsRows = await all(env, "SELECT setting_key AS key, setting_value AS value, updated_at AS updatedAt FROM legal_settings ORDER BY setting_key");
  const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));
  const checklist = await all(env, `SELECT item_key AS itemKey, category, label, status, evidence_note AS evidenceNote, completed_at AS completedAt FROM compliance_checklist ORDER BY category,label`);
  const rightsRequests = await all(env, `SELECT r.id,r.user_id AS userId,r.requestor_email AS email,r.request_type AS requestType,r.details,r.status,r.due_at AS dueAt,r.admin_response AS adminResponse,r.created_at AS createdAt,r.completed_at AS completedAt,u.name FROM data_rights_requests r LEFT JOIN users u ON u.id=r.user_id ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, datetime(r.due_at), datetime(r.created_at) DESC LIMIT 100`);
  const complaints = await all(env, `SELECT c.id,c.user_id AS userId,c.requestor_email AS email,c.category,c.details,c.status,c.due_at AS dueAt,c.admin_response AS adminResponse,c.created_at AS createdAt,c.resolved_at AS resolvedAt,u.name FROM compliance_complaints c LEFT JOIN users u ON u.id=c.user_id ORDER BY CASE c.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, datetime(c.due_at), datetime(c.created_at) DESC LIMIT 100`);
  const processors = await all(env, `SELECT id,provider,service,data_categories AS dataCategories,purpose,location_notes AS locationNotes,contract_status AS contractStatus,transfer_review_status AS transferReviewStatus,active,updated_at AS updatedAt FROM processor_register ORDER BY provider`);
  const lawfulBasis = await all(env, `SELECT id,processing_activity AS processingActivity,purpose,data_subjects AS dataSubjects,data_categories AS dataCategories,lawful_basis AS lawfulBasis,article_ref AS articleRef,children_consideration AS childrenConsideration,review_status AS reviewStatus,updated_at AS updatedAt FROM lawful_basis_register ORDER BY processing_activity`);
  const retention = await all(env, `SELECT id,data_category AS dataCategory,system,proposed_rule AS proposedRule,deletion_method AS deletionMethod,rationale,review_status AS reviewStatus,updated_at AS updatedAt FROM retention_register ORDER BY data_category`);
  const incidents = await all(env, `SELECT id,title,discovered_at AS discoveredAt,breach_confirmed AS breachConfirmed,risk_level AS riskLevel,affects_children AS affectsChildren,dpc_notification_required AS dpcNotificationRequired,dpc_notified_at AS dpcNotifiedAt,subjects_notified_at AS subjectsNotifiedAt,summary,actions_taken AS actionsTaken,status,created_at AS createdAt,updated_at AS updatedAt FROM compliance_incidents ORDER BY datetime(discovered_at) DESC LIMIT 100`);
  const counts = await first(env, `SELECT
    (SELECT COUNT(*) FROM data_rights_requests WHERE status IN ('open','in_progress')) AS openRights,
    (SELECT COUNT(*) FROM data_rights_requests WHERE status IN ('open','in_progress') AND datetime(due_at) < datetime('now')) AS overdueRights,
    (SELECT COUNT(*) FROM compliance_complaints WHERE status IN ('open','in_progress')) AS openComplaints,
    (SELECT COUNT(*) FROM compliance_incidents WHERE status <> 'closed') AS openIncidents,
    (SELECT COUNT(*) FROM compliance_checklist WHERE status='complete') AS checklistComplete,
    (SELECT COUNT(*) FROM compliance_checklist) AS checklistTotal`);

  const identityComplete = Boolean(settings.controller_name && settings.controller_address && settings.privacy_email);
  return json({ settings, identityComplete, checklist, rightsRequests, complaints, processors, lawfulBasis, retention, incidents, counts: counts || {} }, { headers:{"Cache-Control":"no-store"} });
}
