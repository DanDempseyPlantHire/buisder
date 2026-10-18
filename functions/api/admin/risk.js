import { json, requireAdmin } from '../../_lib/db.js';
import { runRiskSweep } from '../../_lib/risk.js';
export async function onRequestGet(context){
  const {error}=await requireAdmin(context); if(error)return error;
  await runRiskSweep(context.env);
  const {results}=await context.env.DB.prepare(
    `SELECT rf.*,u.email,u.name,u.role,j.title AS jobTitle
     FROM risk_flags rf LEFT JOIN users u ON u.id=rf.subject_user_id LEFT JOIN jobs j ON j.id=rf.subject_job_id
     ORDER BY CASE rf.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
              CASE rf.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,rf.created_at DESC LIMIT 200`
  ).all();
  const summary=await context.env.DB.prepare(
    `SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status='open' AND severity IN ('high','critical') THEN 1 ELSE 0 END) AS highOpen
     FROM risk_flags`
  ).first();
  const {results:messageReports}=await context.env.DB.prepare(
    `SELECT mr.id,mr.reason,mr.details,mr.status,mr.created_at AS createdAt,am.body,
            sender.email AS senderEmail,reporter.email AS reporterEmail
     FROM message_reports mr JOIN application_messages am ON am.id=mr.message_id
     JOIN users sender ON sender.id=am.sender_user_id LEFT JOIN users reporter ON reporter.id=mr.reporter_user_id
     ORDER BY mr.created_at DESC LIMIT 100`
  ).all();
  return json({summary:summary||{},flags:results||[],messageReports:messageReports||[]});
}
