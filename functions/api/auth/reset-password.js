import { json, err, hashPassword, sessionCookie } from "../../_lib/db.js";
import {
  getValidAuthToken,
  markAuthTokenUsed,
  passwordProblem
} from "../../_lib/security.js";

function setupError(e) {
  const msg = String(e?.message || e || "");
  if (/no such table: (auth_tokens|verified_emails)/i.test(msg)) {
    return "Buisder security database setup is incomplete. Run migration-security-v13.sql in the live D1 database.";
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");

    const rawToken = String(body.token || "").trim();
    const password = String(body.password || "");

    if (!rawToken) return err("Password reset token is missing.");

    const token = await getValidAuthToken(env, rawToken, "reset_password");
    if (!token) {
      return err("This password reset link is invalid or has expired.", 400);
    }

    const user = await env.DB.prepare(
      "SELECT id, email FROM users WHERE id=?"
    ).bind(token.user_id).first();

    if (!user) return err("Account not found", 404);

    const problem = passwordProblem(password, user.email);
    if (problem) return err(problem);

    const { hash, salt } = await hashPassword(password);

    // D1 batch keeps the account update and token/session changes together.
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET password_hash=?, password_salt=? WHERE id=?"
      ).bind(hash, salt, user.id),

      env.DB.prepare(
        "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(token.id),

      env.DB.prepare(
        "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_at IS NULL"
      ).bind(user.id),

      env.DB.prepare(
        "INSERT OR IGNORE INTO verified_emails (user_id) VALUES (?)"
      ).bind(user.id),

      env.DB.prepare(
        "DELETE FROM sessions WHERE user_id=?"
      ).bind(user.id)
    ]);

    return json(
      { ok: true, message: "Password reset. You can now log in." },
      {
        headers: {
          "Set-Cookie": sessionCookie("", 0),
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (e) {
    const setup = setupError(e);
    return json({
      error: setup || "Password could not be reset on the server.",
      detail: setup ? undefined : String(e?.message || e)
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
