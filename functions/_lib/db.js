import { sendPushToUser } from "./push.js";
// Shared helpers for the Deas Jobs API (Cloudflare Pages Functions + D1)

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) }
  });
}

export function err(message, status = 400) {
  return json({ error: message }, { status });
}

export function newId() {
  return crypto.randomUUID();
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPassword(password, hashHex, saltHex) {
  const { hash } = await hashPassword(password, saltHex);
  return hash === hashHex;
}

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  header.split(";").forEach(part => {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  });
  return out;
}

export function sessionCookie(token, maxAgeSeconds) {
  return `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function getUser(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const token = cookies.session;
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.role, u.name, u.is_suspended,
            CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS is_admin,
            CASE WHEN ve.user_id IS NULL THEN 0 ELSE 1 END AS email_verified
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN admin_users au ON au.user_id = u.id
     LEFT JOIN verified_emails ve ON ve.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first();
  if (!row || row.is_suspended) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    isAdmin: Boolean(row.is_admin),
    emailVerified: Boolean(row.email_verified)
  };
}

export async function requireUser(context, role) {
  const user = await getUser(context);
  if (!user) return { error: err("Not signed in", 401) };
  if (role && user.role !== role) return { error: err(`Only ${role}s can do this`, 403) };
  return { user };
}

export async function requireAdmin(context) {
  const user = await getUser(context);
  if (!user) return { error: err("Not signed in", 401) };
  if (!user.isAdmin) return { error: err("Admin access required", 403) };
  return { user };
}


export async function createNotification(env, {
  userId,
  type,
  title,
  body,
  applicationId = null,
  jobId = null,
  eventKey = null
}) {
  if (!userId) return;

  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO notifications
     (id, user_id, type, title, body, application_id, job_id, event_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    newId(),
    userId,
    type || "general",
    title || "Deas Jobs update",
    body || "",
    applicationId,
    jobId,
    eventKey
  ).run();

  // A unique event_key de-duplicates both the in-app item and background push.
  if (eventKey && Number(inserted?.meta?.changes || 0) === 0) return;

  try {
    await sendPushToUser(env, userId, {
      title: title || "Deas Jobs update",
      body: body || "",
      type: type || "general",
      applicationId,
      jobId,
      url: applicationId ? "/?tab=applications" : "/"
    });
  } catch (e) {
    // Push delivery is best-effort and must never block the underlying action.
  }
}
