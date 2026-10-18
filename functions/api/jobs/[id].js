import { json, err, requireUser } from "../../_lib/db.js";

async function getOwnedJob(env, jobId, employerId) {
  const job = await env.DB.prepare(
    "SELECT * FROM jobs WHERE id=?"
  ).bind(jobId).first();

  if (!job) return { error: err("Job not found", 404) };
  if (job.employer_id !== employerId) return { error: err("Not your job posting", 403) };
  return { job };
}

function text(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;

  const owned = await getOwnedJob(env, params.id, user.id);
  if (owned.error) return owned.error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const action = String(body.action || "").toLowerCase();
  if (action) {
    if (!["pause", "reopen", "close"].includes(action)) {
      return err("Action must be pause, reopen or close");
    }

    let nextStatus = owned.job.status;
    if (action === "pause") {
      if (owned.job.status !== "active") return err("Only an active job can be paused");
      nextStatus = "paused";
    } else if (action === "reopen") {
      if (!["paused", "closed"].includes(owned.job.status)) return err("This job is already active");
      nextStatus = "active";
    } else if (action === "close") {
      if (owned.job.status === "closed") return err("This job is already closed");
      nextStatus = "closed";
    }

    await env.DB.prepare("UPDATE jobs SET status=? WHERE id=?")
      .bind(nextStatus, params.id).run();
    return json({ ok: true, status: nextStatus });
  }

  if (String(body.mode || "") !== "edit") return err("Specify a job action or edit mode");

  const title = text(body.title, 160);
  if (!title) return err("Job title is required");
  const employmentType = text(body.employmentType, 80) || "Part-time";
  const minAge = Number(body.minAge) === 18 ? 18 : 16;
  const payMin = body.payMin === "" || body.payMin === null || body.payMin === undefined
    ? null : Number(body.payMin);
  if (payMin !== null && !Number.isFinite(payMin)) return err("Hourly rate must be a number");

  await env.DB.prepare(
    `UPDATE jobs
     SET title=?, location=?, pay=?, hours=?, experience=?, start_date=?, description=?, tags=?,
         employment_type=?, min_age=?, pay_min=?, schedule_tags=?
     WHERE id=? AND employer_id=?`
  ).bind(
    title,
    text(body.location, 160),
    text(body.pay, 100),
    text(body.hours, 120),
    text(body.experience, 60) || "None",
    text(body.startDate, 80),
    text(body.description, 5000),
    JSON.stringify(Array.isArray(body.tags) ? body.tags.slice(0, 10).map(x => text(x, 80)) : []),
    employmentType,
    minAge,
    payMin,
    JSON.stringify(Array.isArray(body.scheduleTags) ? body.scheduleTags.slice(0, 20).map(x => text(x, 80)) : []),
    params.id,
    user.id
  ).run();

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;

  const owned = await getOwnedJob(env, params.id, user.id);
  if (owned.error) return owned.error;

  await env.DB.prepare("UPDATE jobs SET status='closed' WHERE id=?").bind(params.id).run();
  return json({ ok: true, status: "closed" });
}
