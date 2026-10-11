import { json, err, requireUser } from "../../_lib/db.js";

export async function onRequestPost(context) {
  const { env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;
  if (user.role !== "employer") return err("Employer account required", 403);

  const profile = await env.DB.prepare(
    `SELECT company_name, legal_name, location, phone, website, registration_number, logo_data,
            verification_status
     FROM employer_profiles WHERE user_id=?`
  ).bind(user.id).first();

  if (!profile) return err("Business profile not found", 404);

  const missing = [];
  if (!profile.company_name) missing.push("business name");
  if (!profile.legal_name) missing.push("legal business name");
  if (!profile.location) missing.push("business location");
  if (!profile.phone) missing.push("phone number");
  if (!profile.registration_number) missing.push("company/registration number");

  if (missing.length) {
    return err("Complete these fields before submitting: " + missing.join(", "), 400);
  }

  if (profile.verification_status === "verified") {
    return json({ ok: true, status: "verified" });
  }

  await env.DB.prepare(
    `UPDATE employer_profiles
     SET verification_status='pending',
         verification_submitted_at=datetime('now'),
         verification_note=NULL
     WHERE user_id=?`
  ).bind(user.id).run();

  return json({ ok: true, status: "pending" });
}
