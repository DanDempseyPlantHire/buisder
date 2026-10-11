import { json, err, newId, verifyPassword, sessionCookie } from "../../_lib/db.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");
  const { email, password } = body;
  if (!email || !password) return err("Email and password are required");

  const cleanEmail = String(email).toLowerCase().trim();
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.role, u.name, u.password_hash, u.password_salt, u.is_suspended,
            CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS is_admin
     FROM users u
     LEFT JOIN admin_users au ON au.user_id = u.id
     WHERE u.email = ?`
  ).bind(cleanEmail).first();
  if (!row) return err("Incorrect email or password", 401);
  if (row.is_suspended) return err("This account has been suspended", 403);

  const ok = await verifyPassword(password, row.password_hash, row.password_salt);
  if (!ok) return err("Incorrect email or password", 401);

  const token = newId();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, row.id, expires).run();

  return json(
    { user: { id: row.id, email: row.email, role: row.role, name: row.name, isAdmin: Boolean(row.is_admin) } },
    { headers: { "Set-Cookie": sessionCookie(token, 30 * 24 * 3600) } }
  );
}
