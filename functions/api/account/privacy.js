import { json, err, requireUser } from "../../_lib/db.js";

function flag(value) {
  return value === true || value === 1 || value === "1";
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  let shareEmail = flag(body.shareEmail) ? 1 : 0;
  let shareCv = flag(body.shareCv) ? 1 : 0;
  let sharePhoto = flag(body.sharePhoto) ? 1 : 0;
  const shareLocation = flag(body.shareLocation) ? 1 : 0;

  // Extra default protection for 16–17-year-old job seekers.
  // They can still use the in-app interview/offer workflow without exposing
  // direct email, profile photo or CV to employers.
  if (user.role === "jobseeker") {
    const profile = await env.DB.prepare(
      "SELECT age_band FROM jobseeker_profiles WHERE user_id=?"
    ).bind(user.id).first();

    if (profile?.age_band === "16–17") {
      shareEmail = 0;
      shareCv = 0;
      sharePhoto = 0;
    }
  }

  await env.DB.prepare(
    `INSERT INTO privacy_preferences
     (user_id, share_email, share_cv, share_photo, share_location, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       share_email=excluded.share_email,
       share_cv=excluded.share_cv,
       share_photo=excluded.share_photo,
       share_location=excluded.share_location,
       updated_at=CURRENT_TIMESTAMP`
  ).bind(user.id, shareEmail, shareCv, sharePhoto, shareLocation).run();

  return json({
    ok: true,
    privacy: {
      shareEmail: Boolean(shareEmail),
      shareCv: Boolean(shareCv),
      sharePhoto: Boolean(sharePhoto),
      shareLocation: Boolean(shareLocation)
    }
  });
}
