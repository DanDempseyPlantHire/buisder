import { json, err, requireUser } from "../../_lib/db.js";

async function getOwnedJob(env, jobId, employerId) {
  const job = await env.DB.prepare(
    "SELECT id, employer_id, title, status FROM jobs WHERE id=?"
  ).bind(jobId).first();

  if (!job) return { error: err("Job not found", 404) };
  if (job.employer_id !== employerId) return { error: err("Not your job posting", 403) };
  return { job };
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;

  const owned = await getOwnedJob(env, params.id, user.id);
  if (owned.error) return owned.error;

  const body = await request.json().catch(() => null);
  const action = String(body?.action || "").toLowerCase();
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

  await env.DB.prepare(
    "UPDATE jobs SET status=? WHERE id=?"
  ).bind(nextStatus, params.id).run();

  return json({ ok: true, status: nextStatus });
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
