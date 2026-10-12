import { json, err, hashPassword, sessionCookie } from "../../_lib/db.js";
import {
  getValidAuthToken,
  markAuthTokenUsed,
  passwordProblem
} from "../../_lib/security.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const rawToken = String(body.token || "");
  const password = String(body.password || "");

  const token = await getValidAuthToken(env, rawToken, "reset_password");
  if (!token) return err("This password reset link is invalid or has expired.", 400);

  const user = await env.DB.prepare(
    "SELECT id, email FROM users WHERE id=?"
  ).bind(token.user_id).first();
  if (!user) return err("Account not found", 404);

  const problem = passwordProblem(password, user.email);
  if (problem) return err(problem);

  const { hash, salt } = await hashPassword(password);

  await env.DB.prepare(
    "UPDATE users SET password_hash=?, password_salt=? WHERE id=?"
  ).bind(hash, salt, user.id).run();

  await markAuthTokenUsed(env, token.id);
  await env.DB.prepare(
    "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_at IS NULL"
  ).bind(user.id).run();

  // Reset proves control of the email address.
  await env.DB.prepare(
    "INSERT OR IGNORE INTO verified_emails (user_id) VALUES (?)"
  ).bind(user.id).run();

  // Sign out every existing device after a password reset.
  await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id).run();

  return json(
    { ok: true, message: "Password reset. You can now log in." },
    { headers: { "Set-Cookie": sessionCookie("", 0), "Cache-Control": "no-store" } }
  );
}
