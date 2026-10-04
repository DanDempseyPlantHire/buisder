import { json, err, newId, hashPassword, sessionCookie } from "../../_lib/db.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");
  const { email, password, role, name } = body;
  if (!email || !password || !role) return err("Email, password and role are required");
  if (!["jobseeker", "employer"].includes(role)) return err("Role must be jobseeker or employer");
  if (password.length < 8) return err("Password must be at least 8 characters");

  const cleanEmail = String(email).toLowerCase().trim();
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(cleanEmail).first();
  if (existing) return err("An account with that email already exists", 409);

  const { hash, salt } = await hashPassword(password);
  const id = newId();
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, password_salt, role, name) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, cleanEmail, hash, salt, role, name || "").run();

  if (role === "jobseeker") {
    await env.DB.prepare("INSERT INTO jobseeker_profiles (user_id) VALUES (?)").bind(id).run();
  } else {
    await env.DB.prepare("INSERT INTO employer_profiles (user_id, company_name) VALUES (?, ?)").bind(id, name || "").run();
  }

  const token = newId();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, id, expires).run();

  return json(
    { user: { id, email: cleanEmail, role, name: name || "" } },
    { headers: { "Set-Cookie": sessionCookie(token, 30 * 24 * 3600) } }
  );
}
