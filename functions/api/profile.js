import { json, err, requireUser } from "../_lib/db.js";

export async function onRequestPut(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  if (body.name !== undefined) {
    await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(body.name || "", user.id).run();
  }

  if (user.role === "jobseeker") {
    const { ageBand, phone, location, about, skills, education, experience, availability, interests, transport, cvFilename, photoData, onboardingComplete } = body;
    await env.DB.prepare(
      `UPDATE jobseeker_profiles
       SET age_band=?, phone=?, location=?, about=?, skills=?, education=?, experience=?, availability=?, interests=?, transport=?, cv_filename=?, photo_data=?, onboarding_complete=?
       WHERE user_id=?`
    ).bind(
      ageBand || "", phone || "", location || "", about || "", skills || "",
      education || "", experience || "", availability || "", interests || "",
      transport || "", cvFilename || "", photoData || "", onboardingComplete ? 1 : 0, user.id
    ).run();
  } else {
    const { companyName, location, description } = body;
    await env.DB.prepare(
      `UPDATE employer_profiles SET company_name=?, location=?, description=? WHERE user_id=?`
    ).bind(companyName || "", location || "", description || "", user.id).run();
  }

  return json({ ok: true });
}
