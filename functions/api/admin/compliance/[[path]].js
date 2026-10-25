// Consolidated Pages Functions routes. Generated for Deas Jobs v24.4 compact deployment.
import { err, json, newId, requireAdmin } from "../../../_lib/db.js";

// Source route: checklist/[itemKey].js
const route0 = (() => {
  async function onRequestPost(context){ const {request,env,params}=context; const {user,error}=await requireAdmin(context); if(error)return error; const body=await request.json().catch(()=>null); const status=String(body?.status||''); if(!['incomplete','complete','not_applicable'].includes(status))return err('Invalid status'); const row=await env.DB.prepare('SELECT item_key FROM compliance_checklist WHERE item_key=?').bind(params.itemKey).first(); if(!row)return err('Checklist item not found',404); const note=String(body?.evidenceNote||'').trim().slice(0,3000); await env.DB.prepare(`UPDATE compliance_checklist SET status=?,evidence_note=?,completed_by=CASE WHEN ?='complete' THEN ? ELSE NULL END,completed_at=CASE WHEN ?='complete' THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE item_key=?`).bind(status,note,status,user.id,status,params.itemKey).run(); await env.DB.prepare(`INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,details) VALUES(?,?, 'compliance_checklist_updated','compliance_checklist',?,?)`).bind(newId(),user.id,params.itemKey,JSON.stringify({status,note})).run(); return json({ok:true}); }
  return { onRequestPost };
})();

// Source route: complaints/[id].js
const route1 = (() => {
  async function onRequestPost(context){ const {request,env,params}=context; const {user,error}=await requireAdmin(context); if(error)return error; const body=await request.json().catch(()=>null); const status=String(body?.status||''); if(!['open','in_progress','resolved','closed'].includes(status))return err('Invalid status'); const response=String(body?.adminResponse||'').trim().slice(0,5000); const row=await env.DB.prepare('SELECT id FROM compliance_complaints WHERE id=?').bind(params.id).first(); if(!row)return err('Complaint not found',404); await env.DB.prepare(`UPDATE compliance_complaints SET status=?,admin_response=?,assigned_to=?,updated_at=CURRENT_TIMESTAMP,resolved_at=CASE WHEN ? IN ('resolved','closed') THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?`).bind(status,response,user.id,status,params.id).run(); await env.DB.prepare(`INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,details) VALUES(?,?, 'compliance_complaint_updated','compliance_complaint',?,?)`).bind(newId(),user.id,params.id,JSON.stringify({status})).run(); return json({ok:true}); }
  return { onRequestPost };
})();

// Source route: incidents/[id].js
const route2 = (() => {
  async function onRequestPost(context){ const {request,env,params}=context; const {user,error}=await requireAdmin(context); if(error)return error; const body=await request.json().catch(()=>null); const status=String(body?.status||'open'),risk=String(body?.riskLevel||'under_review'); if(!['open','investigating','contained','closed'].includes(status))return err('Invalid status'); if(!['under_review','low','medium','high','severe'].includes(risk))return err('Invalid risk level'); const dpcReq=body?.dpcNotificationRequired===null||body?.dpcNotificationRequired===undefined?null:(body.dpcNotificationRequired?1:0); await env.DB.prepare(`UPDATE compliance_incidents SET breach_confirmed=?,risk_level=?,affects_children=?,dpc_notification_required=?,dpc_notified_at=?,subjects_notified_at=?,summary=?,actions_taken=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(body?.breachConfirmed?1:0,risk,body?.affectsChildren?1:0,dpcReq,body?.dpcNotifiedAt||null,body?.subjectsNotifiedAt||null,String(body?.summary||'').trim().slice(0,5000),String(body?.actionsTaken||'').trim().slice(0,5000),status,params.id).run(); await env.DB.prepare(`INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,details) VALUES(?,?, 'compliance_incident_updated','compliance_incident',?,?)`).bind(newId(),user.id,params.id,JSON.stringify({status,risk})).run(); return json({ok:true}); }
  return { onRequestPost };
})();

// Source route: incidents/index.js
const route3 = (() => {
  async function onRequestPost(context){ const {request,env}=context; const {user,error}=await requireAdmin(context); if(error)return error; const body=await request.json().catch(()=>null); const title=String(body?.title||'').trim().slice(0,300); if(!title)return err('Incident title is required'); const id=newId(); await env.DB.prepare(`INSERT INTO compliance_incidents(id,title,discovered_at,breach_confirmed,risk_level,affects_children,summary,actions_taken,status,created_by) VALUES(?,?,COALESCE(?,CURRENT_TIMESTAMP),?,?,?,?,?,'open',?)`).bind(id,title,body?.discoveredAt||null,body?.breachConfirmed?1:0,String(body?.riskLevel||'under_review'),body?.affectsChildren?1:0,String(body?.summary||'').trim().slice(0,5000),String(body?.actionsTaken||'').trim().slice(0,5000),user.id).run(); return json({ok:true,id},{status:201}); }
  return { onRequestPost };
})();

// Source route: register.js
const route4 = (() => {
  const MAP={
    processor:{table:'processor_register',fields:{service:'service',dataCategories:'data_categories',purpose:'purpose',locationNotes:'location_notes',contractStatus:'contract_status',transferReviewStatus:'transfer_review_status',active:'active'}},
    lawful:{table:'lawful_basis_register',fields:{purpose:'purpose',dataSubjects:'data_subjects',dataCategories:'data_categories',lawfulBasis:'lawful_basis',articleRef:'article_ref',childrenConsideration:'children_consideration',reviewStatus:'review_status'}},
    retention:{table:'retention_register',fields:{proposedRule:'proposed_rule',deletionMethod:'deletion_method',rationale:'rationale',reviewStatus:'review_status'}}
  };
  async function onRequestPost(context){ const {request,env}=context; const {user,error}=await requireAdmin(context); if(error)return error; const body=await request.json().catch(()=>null); const type=String(body?.type||''),id=String(body?.id||''); const cfg=MAP[type]; if(!cfg||!id)return err('Invalid register update'); const sets=[],vals=[]; for(const [api,col] of Object.entries(cfg.fields)){ if(Object.prototype.hasOwnProperty.call(body,api)){ sets.push(`${col}=?`); vals.push(api==='active'?(body[api]?1:0):String(body[api]??'').trim().slice(0,4000)); }} if(!sets.length)return err('No fields to update'); sets.push('updated_at=CURRENT_TIMESTAMP'); vals.push(id); const result=await env.DB.prepare(`UPDATE ${cfg.table} SET ${sets.join(',')} WHERE id=?`).bind(...vals).run(); if(!result.meta?.changes)return err('Register row not found',404); await env.DB.prepare(`INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,details) VALUES(?,?, 'compliance_register_updated',?,?,?)`).bind(newId(),user.id,type,id,JSON.stringify({fields:Object.keys(body).filter(k=>k!=='type'&&k!=='id')})).run(); return json({ok:true}); }
  return { onRequestPost };
})();

// Source route: requests/[id].js
const route5 = (() => {
  async function onRequestPost(context){ const {request,env,params}=context; const {user,error}=await requireAdmin(context); if(error)return error; const body=await request.json().catch(()=>null); const status=String(body?.status||''); if(!['open','in_progress','completed','refused'].includes(status))return err('Invalid status'); const response=String(body?.adminResponse||'').trim().slice(0,5000); const row=await env.DB.prepare('SELECT id FROM data_rights_requests WHERE id=?').bind(params.id).first(); if(!row)return err('Request not found',404); await env.DB.prepare(`UPDATE data_rights_requests SET status=?,admin_response=?,assigned_to=?,updated_at=CURRENT_TIMESTAMP,completed_at=CASE WHEN ? IN ('completed','refused') THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?`).bind(status,response,user.id,status,params.id).run(); await env.DB.prepare(`INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,details) VALUES(?,?, 'data_rights_request_updated','data_rights_request',?,?)`).bind(newId(),user.id,params.id,JSON.stringify({status})).run(); return json({ok:true}); }
  return { onRequestPost };
})();

// Source route: settings.js
const route6 = (() => {
  const ALLOWED = new Set(["controller_name","controller_address","company_registration","privacy_email","support_email","dpo_email","dsa_contact_email","country"]);
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireAdmin(context); if (error) return error;
    const body = await request.json().catch(()=>null); if(!body?.settings) return err("settings are required");
    let changed=0;
    for (const [key,value] of Object.entries(body.settings)) {
      if(!ALLOWED.has(key)) continue;
      await env.DB.prepare(`INSERT INTO legal_settings(setting_key,setting_value,updated_by,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(key,String(value||'').trim().slice(0,1000),user.id).run(); changed++;
    }
    await env.DB.prepare(`INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,details) VALUES(?,?, 'legal_settings_updated','compliance','legal-settings',?)`).bind(newId(),user.id,JSON.stringify({changed})).run();
    return json({ok:true,changed});
  }
  return { onRequestPost };
})();

const ROUTES = [
  { segments: ["checklist", "[itemKey]"], handlers: route0 }, // checklist/[itemKey].js
  { segments: ["complaints", "[id]"], handlers: route1 }, // complaints/[id].js
  { segments: ["incidents", "[id]"], handlers: route2 }, // incidents/[id].js
  { segments: ["incidents"], handlers: route3 }, // incidents/index.js
  { segments: ["register"], handlers: route4 }, // register.js
  { segments: ["requests", "[id]"], handlers: route5 }, // requests/[id].js
  { segments: ["settings"], handlers: route6 }, // settings.js
];

function tailParts(context) {
  const raw = context.params?.path;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (raw === undefined || raw === null || raw === '') return [];
  return String(raw).split('/').filter(Boolean);
}

function matchSegments(pattern, actual) {
  if (pattern.length !== actual.length) return null;
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    const a = actual[i];
    const m = /^\[([^\]]+)\]$/.exec(p);
    if (m) params[m[1]] = a;
    else if (p !== a) return null;
  }
  return params;
}

async function dispatch(context, method) {
  const actual = tailParts(context);
  for (const route of ROUTES) {
    const extra = matchSegments(route.segments, actual);
    if (!extra) continue;
    const handler = route.handlers[method];
    if (!handler) return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'content-type': 'application/json; charset=utf-8' } });
    const nextContext = { ...context, params: { ...(context.params || {}), ...extra } };
    return handler(nextContext);
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function onRequestPost(context) { return dispatch(context, "onRequestPost"); }
