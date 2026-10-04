import { json, err, newId, verifyPassword, sessionCookie } from "../../_lib/db.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");
  const { email, password } = body;
  if (!email || !password) return err("Email and password are required");

  const cleanEmail = String(email).toLowerCase().trim();
  const row = await env.DB.prepare(
    "SELECT id, email, role, name, password_hash, password_salt FROM users WHERE email = ?"
  ).bind(cleanEmail).first();
  if (!row) return err("Incorrect email or password", 401);

  const ok = await verifyPassword(password, row.password_hash, row.password_salt);
  if (!ok) return err("Incorrect email or password", 401);

  const token = newId();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, row.id, expires).run();

  return json(
    { user: { id: row.id, email: row.email, role: row.role, name: row.name } },
    { headers: { "Set-Cookie": sessionCookie(token, 30 * 24 * 3600) } }
  );
}
