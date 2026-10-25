// Consolidated Pages Functions routes. Generated for Deas Jobs v24.4 compact deployment.
import { err, getUser, json, newId, requireUser } from "../../_lib/db.js";
import { pushConfigured, sendPushToUser } from "../../_lib/push.js";

// Source route: config.js
const route0 = (() => {
  async function onRequestGet(context){
    const user=await getUser(context);
    let enabled=true,subscribed=false;
    if(user){
      try{
        const pref=await context.env.DB.prepare('SELECT enabled FROM push_preferences WHERE user_id=?').bind(user.id).first();
        if(pref) enabled=Boolean(pref.enabled);
        const sub=await context.env.DB.prepare('SELECT 1 AS yes FROM push_subscriptions WHERE user_id=? AND disabled_at IS NULL LIMIT 1').bind(user.id).first();
        subscribed=Boolean(sub);
      }catch{}
    }
    return json({configured:pushConfigured(context.env),publicKey:pushConfigured(context.env)?context.env.VAPID_PUBLIC_KEY:'',enabled,subscribed});
  }
  return { onRequestGet };
})();

// Source route: subscriptions.js
const route1 = (() => {
  async function onRequestPost(context){
    const {user,error}=await requireUser(context); if(error)return error;
    const b=await context.request.json().catch(()=>null); const s=b?.subscription;
    if(!s?.endpoint||!s?.keys?.p256dh||!s?.keys?.auth) return err('Invalid push subscription');
    await context.env.DB.prepare(
      `INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,user_agent,disabled_at,updated_at)
       VALUES (?,?,?,?,?,?,NULL,CURRENT_TIMESTAMP)
       ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,disabled_at=NULL,failure_count=0,updated_at=CURRENT_TIMESTAMP`
    ).bind(newId(),user.id,s.endpoint,s.keys.p256dh,s.keys.auth,context.request.headers.get('User-Agent')||null).run();
    await context.env.DB.prepare(
      `INSERT INTO push_preferences(user_id,enabled) VALUES (?,1)
       ON CONFLICT(user_id) DO UPDATE SET enabled=1,updated_at=CURRENT_TIMESTAMP`
    ).bind(user.id).run();
    return json({ok:true});
  }
  async function onRequestDelete(context){
    const {user,error}=await requireUser(context); if(error)return error;
    const b=await context.request.json().catch(()=>({}));
    if(b.endpoint) await context.env.DB.prepare('UPDATE push_subscriptions SET disabled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND endpoint=?').bind(user.id,b.endpoint).run();
    else await context.env.DB.prepare('UPDATE push_subscriptions SET disabled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').bind(user.id).run();
    await context.env.DB.prepare(
      `INSERT INTO push_preferences(user_id,enabled) VALUES (?,0)
       ON CONFLICT(user_id) DO UPDATE SET enabled=0,updated_at=CURRENT_TIMESTAMP`
    ).bind(user.id).run();
    return json({ok:true});
  }
  return { onRequestDelete, onRequestPost };
})();

// Source route: test.js
const route2 = (() => {
  async function onRequestPost(context){
    const {user,error}=await requireUser(context); if(error)return error;
    try{await sendPushToUser(context.env,user.id,{title:'Deas Jobs notifications are on',body:'You can now receive important recruitment updates when Deas Jobs is closed.',url:'/'});return json({ok:true});}
    catch(e){return err(e.message||'Push test failed',503);}
  }
  return { onRequestPost };
})();

const ROUTES = [
  { segments: ["config"], handlers: route0 }, // config.js
  { segments: ["subscriptions"], handlers: route1 }, // subscriptions.js
  { segments: ["test"], handlers: route2 }, // test.js
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

export async function onRequestDelete(context) { return dispatch(context, "onRequestDelete"); }
export async function onRequestGet(context) { return dispatch(context, "onRequestGet"); }
export async function onRequestPost(context) { return dispatch(context, "onRequestPost"); }
