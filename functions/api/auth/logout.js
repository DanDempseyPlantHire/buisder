import { json, parseCookies, clearSessionCookie } from "../../_lib/db.js";

export async function onRequestPost({ request, env }) {
  const { session } = parseCookies(request);
  if (session) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(session).run();
  }
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
