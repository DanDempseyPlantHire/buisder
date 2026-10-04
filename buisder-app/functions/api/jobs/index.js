import { json, err, newId, requireUser } from "../../_lib/db.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");
  const { title, location, pay, hours, experience, startDate, description, tags } = body;
  if (!title) return err("Job title is required");

  const profile = await env.DB.prepare(
    "SELECT company_name FROM employer_profiles WHERE user_id = ?"
  ).bind(user.id).first();
  const company = (profile && profile.company_name) || user.name || "Employer";

  const id = newId();
  await env.DB.prepare(
    `INSERT INTO jobs (id, employer_id, title, company, location, pay, hours, experience, start_date, description, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, user.id, title, company, location || "", pay || "", hours || "",
    experience || "", startDate || "", description || "", JSON.stringify(tags || [])
  ).run();

  return json({ id }, { status: 201 });
}
