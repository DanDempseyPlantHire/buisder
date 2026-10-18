import { json, err, newId, requireUser } from "../../_lib/db.js";
import { recordAnalyticsEvent } from "../../_lib/analytics.js";
import { assessJobRisk } from "../../_lib/risk.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");
  const {
    title, location, pay, hours, experience, startDate, description, tags,
    employmentType, minAge, payMin, scheduleTags, latitude, longitude
  } = body;
  if (!title) return err("Job title is required");

  const profile = await env.DB.prepare(
    "SELECT company_name FROM employer_profiles WHERE user_id = ?"
  ).bind(user.id).first();

  const company = (profile && profile.company_name) || user.name || "Employer";

  const id = newId();
  await env.DB.prepare(
    `INSERT INTO jobs
      (id, employer_id, title, company, location, pay, hours, experience, start_date, description, tags,
       employment_type, min_age, pay_min, schedule_tags, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, user.id, title, company, location || "", pay || "", hours || "",
    experience || "", startDate || "", description || "", JSON.stringify(tags || []),
    employmentType || "Part-time",
    Number.isFinite(Number(minAge)) ? Number(minAge) : 16,
    payMin === "" || payMin === null || payMin === undefined ? null : Number(payMin),
    JSON.stringify(scheduleTags || []),
    latitude === "" || latitude === null || latitude === undefined ? null : Number(latitude),
    longitude === "" || longitude === null || longitude === undefined ? null : Number(longitude)
  ).run();

  await recordAnalyticsEvent(env, {
    userId: user.id,
    userRole: "employer",
    eventType: "job_posted",
    jobId: id,
    eventKey: `job_posted:${id}`,
    metadata: { employmentType: employmentType || "Part-time", minAge: Number(minAge) || 16 }
  });
  await assessJobRisk(env, user.id, id);

  return json({ id }, { status: 201 });
}
