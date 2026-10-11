import { err, requireUser } from "../../../_lib/db.js";

function contentDisposition(name) {
  const safe = String(name || "file").replace(/["\r\n]/g, "_");
  return `attachment; filename="${safe}"`;
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  if (!env.FILES) return err("R2 storage is not configured", 500);

  const kind = String(params.kind || "");
  const targetUserId = String(params.userId || "");
  let key = null;
  let fallbackName = "file";
  let isPrivateDocument = false;

  if (kind === "profile-photo") {
    const row = await env.DB.prepare(
      "SELECT photo_key FROM jobseeker_profiles WHERE user_id=?"
    ).bind(targetUserId).first();
    key = row?.photo_key || null;
  } else if (kind === "business-logo") {
    const row = await env.DB.prepare(
      "SELECT logo_key FROM employer_profiles WHERE user_id=?"
    ).bind(targetUserId).first();
    key = row?.logo_key || null;
  } else if (kind === "cv") {
    isPrivateDocument = true;

    let allowed = user.isAdmin || (user.role === "jobseeker" && user.id === targetUserId);

    if (!allowed && user.role === "employer") {
      const access = await env.DB.prepare(
        `SELECT 1 AS ok
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         WHERE a.jobseeker_id=? AND j.employer_id=?
         LIMIT 1`
      ).bind(targetUserId, user.id).first();
      allowed = Boolean(access);
    }

    if (!allowed) return err("You do not have permission to access this CV", 403);

    const row = await env.DB.prepare(
      "SELECT cv_key, cv_filename FROM jobseeker_profiles WHERE user_id=?"
    ).bind(targetUserId).first();
    key = row?.cv_key || null;
    fallbackName = row?.cv_filename || "cv";
  } else {
    return err("Unsupported file type", 404);
  }

  if (!key) return err("File not found", 404);

  const object = await env.FILES.get(key);
  if (!object) return err("File not found", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);

  if (isPrivateDocument) {
    headers.set("Cache-Control", "private, no-store");
    headers.set(
      "Content-Disposition",
      contentDisposition(object.customMetadata?.originalName || fallbackName)
    );
  } else {
    headers.set("Cache-Control", "private, max-age=3600");
  }

  return new Response(object.body, { headers });
}
