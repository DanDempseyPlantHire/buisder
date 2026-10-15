import { json, err, newId, requireUser } from "../../_lib/db.js";
import { TERMS_VERSION, PRIVACY_VERSION } from "../../_lib/policy.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body?.accepted) return err("Acceptance is required");

  await env.DB.prepare(
    `INSERT OR IGNORE INTO legal_consents
     (id, user_id, terms_version, privacy_version)
     VALUES (?, ?, ?, ?)`
  ).bind(newId(), user.id, TERMS_VERSION, PRIVACY_VERSION).run();

  return json({
    ok: true,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION
  });
}
