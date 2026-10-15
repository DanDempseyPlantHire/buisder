import {
  json, err, requireUser, verifyPassword, clearSessionCookie
} from "../../_lib/db.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  if (user.isAdmin) {
    return err("Admin accounts cannot be deleted through self-service.", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");
  if (String(body.confirm || "") !== "DELETE") {
    return err('Type DELETE to confirm permanent account deletion.');
  }

  const account = await env.DB.prepare(
    "SELECT password_hash, password_salt FROM users WHERE id=?"
  ).bind(user.id).first();
  if (!account) return err("Account not found", 404);

  const passwordOk = await verifyPassword(
    String(body.password || ""),
    account.password_hash,
    account.password_salt
  );
  if (!passwordOk) return err("Password is incorrect", 401);

  const keys = [];

  if (user.role === "jobseeker") {
    const p = await env.DB.prepare(
      "SELECT photo_key, cv_key FROM jobseeker_profiles WHERE user_id=?"
    ).bind(user.id).first();
    if (p?.photo_key) keys.push(p.photo_key);
    if (p?.cv_key) keys.push(p.cv_key);
  } else {
    const p = await env.DB.prepare(
      "SELECT logo_key FROM employer_profiles WHERE user_id=?"
    ).bind(user.id).first();
    if (p?.logo_key) keys.push(p.logo_key);
  }

  if (keys.length && env.FILES) {
    try {
      for (const key of keys) await env.FILES.delete(key);
    } catch {
      return err("Stored files could not be deleted. Account deletion was stopped; try again.", 500);
    }
  }

  // Preserve moderation reports without retaining the deleting user's identity.
  await env.DB.prepare(
    "UPDATE safety_reports SET reporter_user_id=NULL WHERE reporter_user_id=?"
  ).bind(user.id).run();
  await env.DB.prepare(
    "UPDATE safety_reports SET target_user_id=NULL WHERE target_user_id=?"
  ).bind(user.id).run();

  // Cascading foreign keys remove profile, sessions, applications/jobs,
  // auth records, preferences, blocks and consent rows.
  await env.DB.prepare("DELETE FROM users WHERE id=?").bind(user.id).run();

  return json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": clearSessionCookie(),
        "Cache-Control": "no-store"
      }
    }
  );
}
