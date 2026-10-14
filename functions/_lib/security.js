import { newId } from "./db.js";

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value));
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

function base64Url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomToken(bytes = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP")
    || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
    || "unknown";
}

export async function consumeRateLimit(env, rateKey, limit, windowSeconds) {
  const now = Date.now();
  const row = await env.DB.prepare(
    `SELECT rate_key, attempts, window_start, blocked_until
     FROM auth_rate_limits WHERE rate_key=?`
  ).bind(rateKey).first();

  if (row?.blocked_until) {
    const blockedUntil = Date.parse(row.blocked_until);
    if (Number.isFinite(blockedUntil) && blockedUntil > now) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((blockedUntil - now) / 1000))
      };
    }
  }

  const windowStart = row?.window_start ? Date.parse(row.window_start) : NaN;
  const expired = !Number.isFinite(windowStart) || now - windowStart >= windowSeconds * 1000;

  if (!row || expired) {
    await env.DB.prepare(
      `INSERT INTO auth_rate_limits
       (rate_key, attempts, window_start, blocked_until, updated_at)
       VALUES (?, 1, ?, NULL, CURRENT_TIMESTAMP)
       ON CONFLICT(rate_key) DO UPDATE SET
         attempts=1,
         window_start=excluded.window_start,
         blocked_until=NULL,
         updated_at=CURRENT_TIMESTAMP`
    ).bind(rateKey, new Date(now).toISOString()).run();

    return { allowed: true, remaining: Math.max(0, limit - 1) };
  }

  const attempts = Number(row.attempts || 0) + 1;
  if (attempts > limit) {
    const blockedUntil = new Date(now + windowSeconds * 1000).toISOString();
    await env.DB.prepare(
      `UPDATE auth_rate_limits
       SET attempts=?, blocked_until=?, updated_at=CURRENT_TIMESTAMP
       WHERE rate_key=?`
    ).bind(attempts, blockedUntil, rateKey).run();

    return { allowed: false, retryAfter: windowSeconds };
  }

  await env.DB.prepare(
    `UPDATE auth_rate_limits
     SET attempts=?, updated_at=CURRENT_TIMESTAMP
     WHERE rate_key=?`
  ).bind(attempts, rateKey).run();

  return { allowed: true, remaining: Math.max(0, limit - attempts) };
}

export async function clearRateLimit(env, rateKey) {
  await env.DB.prepare("DELETE FROM auth_rate_limits WHERE rate_key=?").bind(rateKey).run();
}

export async function verifyTurnstile(env, request, token) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, enforced: false };

  // Always call Cloudflare Siteverify when Turnstile is enabled.
  // This makes configuration failures visible and avoids the browser
  // preventing the server-side verification request from happening.
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", String(token || ""));
  const ip = clientIp(request);
  if (ip && ip !== "unknown") form.append("remoteip", ip);

  let response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form
    });
  } catch {
    return {
      ok: false,
      enforced: true,
      error: "Turnstile Siteverify could not be reached. Try again."
    };
  }

  const data = await response.json().catch(() => null);
  const codes = Array.isArray(data?.["error-codes"]) ? data["error-codes"] : [];

  if (data?.success) {
    return {
      ok: true,
      enforced: true,
      hostname: data.hostname || null,
      action: data.action || null
    };
  }

  const friendly = {
    "missing-input-secret": "Turnstile secret key is missing.",
    "invalid-input-secret": "Turnstile secret key is invalid.",
    "missing-input-response": "The Turnstile widget did not produce a token.",
    "invalid-input-response": "The Turnstile token was invalid or expired.",
    "bad-request": "Cloudflare rejected the Turnstile verification request.",
    "timeout-or-duplicate": "The Turnstile check expired. Complete it again.",
    "internal-error": "Cloudflare had a temporary Turnstile error."
  };

  const detail = codes.length
    ? codes.map(code => friendly[code] || `Turnstile error: ${code}`).join(" ")
    : "Turnstile validation failed.";

  return {
    ok: false,
    enforced: true,
    error: detail,
    errorCodes: codes
  };
}

export function emailDeliveryConfigured(env) {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function emailVerificationRequired(env) {
  return String(env.EMAIL_VERIFICATION_REQUIRED || "").toLowerCase() === "true";
}

export async function sendEmail(env, { to, subject, html, text }) {
  if (!emailDeliveryConfigured(env)) {
    return { ok: false, configured: false };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      html,
      text
    })
  });

  if (!response.ok) {
    return {
      ok: false,
      configured: true,
      status: response.status,
      detail: await response.text().catch(() => "")
    };
  }

  return { ok: true, configured: true };
}

export async function createAuthToken(env, userId, purpose, lifetimeSeconds) {
  await env.DB.prepare(
    `DELETE FROM auth_tokens
     WHERE user_id=? AND purpose=? AND used_at IS NULL`
  ).bind(userId, purpose).run();

  const raw = randomToken(32);
  const hash = await sha256Hex(raw);
  const expiresAt = new Date(Date.now() + lifetimeSeconds * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO auth_tokens
     (id, user_id, purpose, token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(newId(), userId, purpose, hash, expiresAt).run();

  return raw;
}

export async function getValidAuthToken(env, rawToken, purpose) {
  if (!rawToken) return null;
  const hash = await sha256Hex(rawToken);

  return await env.DB.prepare(
    `SELECT id, user_id, purpose, expires_at, used_at
     FROM auth_tokens
     WHERE token_hash=?
       AND purpose=?
       AND used_at IS NULL
       AND expires_at > datetime('now')`
  ).bind(hash, purpose).first();
}

export async function markAuthTokenUsed(env, tokenId) {
  await env.DB.prepare(
    "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?"
  ).bind(tokenId).run();
}

export function appOrigin(env, request) {
  const configured = String(env.APP_URL || "").trim().replace(/\/+$/g, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

export function passwordProblem(password, email = "") {
  const value = String(password || "");
  if (value.length < 10) return "Password must be at least 10 characters";
  if (value.length > 128) return "Password is too long";
  if (/^(password|password123|1234567890|qwerty12345|letmein123)$/i.test(value)) {
    return "Choose a less common password";
  }
  const local = String(email || "").split("@")[0].toLowerCase();
  if (local.length >= 4 && value.toLowerCase().includes(local)) {
    return "Password should not contain your email name";
  }
  return null;
}
