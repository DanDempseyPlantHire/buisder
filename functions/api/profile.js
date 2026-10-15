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
    const {
      ageBand, phone, location, about, skills, education, experience, availability, interests,
      transport, onboardingComplete,
      maxDistanceKm, minPay, preferredEmploymentType, latitude, longitude
    } = body;
    await env.DB.prepare(
      `UPDATE jobseeker_profiles
       SET age_band=?, phone=?, location=?, about=?, skills=?, education=?, experience=?, availability=?, interests=?,
           transport=?, onboarding_complete=?,
           max_distance_km=?, min_pay=?, preferred_employment_type=?, latitude=?, longitude=?
       WHERE user_id=?`
    ).bind(
      ageBand || "", phone || "", location || "", about || "", skills || "",
      education || "", experience || "", availability || "", interests || "",
      transport || "", onboardingComplete ? 1 : 0,
      Number.isFinite(Number(maxDistanceKm)) ? Number(maxDistanceKm) : 25,
      minPay === "" || minPay === null || minPay === undefined ? null : Number(minPay),
      preferredEmploymentType || "Any",
      latitude === "" || latitude === null || latitude === undefined ? null : Number(latitude),
      longitude === "" || longitude === null || longitude === undefined ? null : Number(longitude),
      user.id
    ).run();

    if (ageBand === "16–17") {
      await env.DB.prepare(
        `INSERT INTO privacy_preferences
         (user_id, share_email, share_cv, share_photo, share_location, updated_at)
         VALUES (?, 0, 0, 0, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           share_email=0,
           share_cv=0,
           share_photo=0,
           updated_at=CURRENT_TIMESTAMP`
      ).bind(user.id).run();
    }

  } else {
    const {
      companyName, legalName, location, description, phone, website,
      registrationNumber
    } = body;

    await env.DB.prepare(
      `UPDATE employer_profiles
       SET company_name=?, legal_name=?, location=?, description=?, phone=?, website=?,
           registration_number=?
       WHERE user_id=?`
    ).bind(
      companyName || "",
      legalName || "",
      location || "",
      description || "",
      phone || "",
      website || "",
      registrationNumber || "",
      user.id
    ).run();
  }

  return json({ ok: true });
}
