export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "other";
}

export function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function siteOrigin(context) {
  const configured = String(context.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(configured)) return configured;
  return new URL(context.request.url).origin;
}

export function jobPath(job) {
  return `/jobs/${encodeURIComponent(job.id)}`;
}

export function employerPath(employerId) {
  return `/employers/${encodeURIComponent(employerId)}`;
}

export function categoryPath(category) {
  return `/jobs/category/${encodeURIComponent(slugify(category))}`;
}

export function locationPath(location) {
  return `/jobs/location/${encodeURIComponent(slugify(location))}`;
}

export function mapEmploymentType(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("full")) return "FULL_TIME";
  if (v.includes("part")) return "PART_TIME";
  if (v.includes("intern")) return "INTERN";
  if (v.includes("temporary") || v.includes("temp")) return "TEMPORARY";
  if (v.includes("contract")) return "CONTRACTOR";
  return undefined;
}

export function formatDate(value) {
  if (!value) return "";
  const d = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Dublin" }).format(d);
}

export function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function pageResponse(html, status = 200, extraHeaders = {}) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=300, s-maxage=900" : "public, max-age=60",
      ...extraHeaders
    }
  });
}

export function publicStyles() {
  return `
    :root{--ink:#211f1b;--paper:#fffdf8;--panel:#fff;--accent:#b45f33;--accent2:#8f4726;--line:#ddd6c9;--muted:#575146;--soft:#f6f1e8}
    *{box-sizing:border-box}html{background:#f1ece3}body{margin:0;color:var(--ink);background:#f1ece3;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    a{color:inherit}.shell{width:min(100%,860px);margin:0 auto;min-height:100vh;background:var(--paper);box-shadow:0 0 0 1px rgba(33,31,27,.06)}
    header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;background:var(--ink);color:#fff;position:sticky;top:0;z-index:10}
    .brand{font-size:21px;font-weight:900;letter-spacing:-.03em;text-decoration:none}.header-link{color:#fff;font-size:13px;font-weight:800;text-decoration:none;border:1px solid rgba(255,255,255,.42);padding:8px 11px;border-radius:9px}
    main{padding:24px}.hero{background:var(--ink);color:#fff;border-radius:18px;padding:24px;margin-bottom:18px}.hero h1{margin:0 0 8px;font-size:clamp(27px,5vw,42px);line-height:1.05;letter-spacing:-.035em}.hero p{margin:0;color:#eee8de;max-width:680px}
    .card{background:#fff;border:1px solid var(--line);border-radius:15px;padding:17px;margin-bottom:12px;min-width:0}.card h2,.card h3{margin:0 0 7px;line-height:1.2}.muted{color:var(--muted);font-size:13px}.meta{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.pill{display:inline-flex;padding:5px 8px;border-radius:999px;background:var(--soft);border:1px solid #e6ded0;font-size:11px;font-weight:800;color:#3c372f}
    .btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 14px;border-radius:9px;border:1px solid var(--accent);background:var(--accent);color:#fff;text-decoration:none;font-weight:900;font-size:13px}.btn:hover{background:var(--accent2)}.btn.secondary{background:#fff;color:var(--ink);border-color:#bbb2a3}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.job{display:flex;flex-direction:column}.job .actions{margin-top:auto;padding-top:11px}.breadcrumbs{font-size:12px;color:var(--muted);margin-bottom:13px}.breadcrumbs a{color:var(--muted)}
    .description{white-space:pre-wrap;overflow-wrap:anywhere}.company-head{display:flex;align-items:center;gap:14px}.company-logo{width:58px;height:58px;border-radius:12px;object-fit:cover;background:var(--soft);border:1px solid var(--line)}
    .empty{padding:36px;text-align:center;background:var(--soft);border-radius:15px;color:var(--muted)}.section-title{margin:24px 0 10px;font-size:20px}.link-grid{display:flex;gap:8px;flex-wrap:wrap}.text-link{display:inline-block;border:1px solid var(--line);border-radius:9px;padding:7px 10px;text-decoration:none;background:#fff;font-size:12px;font-weight:800;color:#3c372f}
    footer{padding:22px;color:var(--muted);font-size:11px;border-top:1px solid var(--line)}
    @media(max-width:600px){header{padding:14px 16px}main{padding:16px}.hero{padding:20px}.grid{grid-template-columns:1fr}.company-head{align-items:flex-start}}
  `;
}

export function layout({ title, description, canonical, body, jsonLd = null, noindex = false }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description || "Find jobs with Buisder.");
  const safeCanonical = escapeHtml(canonical);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title><meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeCanonical}"><meta name="robots" content="${noindex ? "noindex,nofollow" : "index,follow"}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Buisder"><meta property="og:title" content="${safeTitle}"><meta property="og:description" content="${safeDescription}"><meta property="og:url" content="${safeCanonical}">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${safeTitle}"><meta name="twitter:description" content="${safeDescription}">
<style>${publicStyles()}</style>${jsonLd ? `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>` : ""}</head>
<body><div class="shell"><header><a class="brand" href="/jobs">Buisder</a><a class="header-link" href="/">Sign in / join</a></header><main>${body}</main><footer>Buisder connects job seekers and employers. Public job information is supplied by participating employers.</footer></div></body></html>`;
}

export async function listPublicJobs(env, { limit = 100 } = {}) {
  const result = await env.DB.prepare(
    `SELECT j.*, ep.company_name, ep.description AS company_description, ep.website, ep.location AS company_location,
            ep.logo_key, ep.verification_status
     FROM jobs j
     JOIN users u ON u.id=j.employer_id
     JOIN employer_profiles ep ON ep.user_id=j.employer_id
     WHERE j.status='active' AND u.is_suspended=0 AND ep.verification_status='verified'
     ORDER BY j.created_at DESC
     LIMIT ?`
  ).bind(limit).all();
  return result.results || [];
}

export async function getPublicJob(env, id) {
  return env.DB.prepare(
    `SELECT j.*, ep.company_name, ep.description AS company_description, ep.website, ep.location AS company_location,
            ep.logo_key, ep.verification_status
     FROM jobs j
     JOIN users u ON u.id=j.employer_id
     JOIN employer_profiles ep ON ep.user_id=j.employer_id
     WHERE j.id=? AND j.status='active' AND u.is_suspended=0 AND ep.verification_status='verified'
     LIMIT 1`
  ).bind(id).first();
}

export function jobCard(job) {
  const tags = parseJsonArray(job.tags).slice(0, 5);
  return `<article class="card job"><h2>${escapeHtml(job.title)}</h2><div class="muted"><strong>${escapeHtml(job.company_name || job.company || "Employer")}</strong>${job.location ? ` · ${escapeHtml(job.location)}` : ""}</div><div class="meta">${job.employment_type ? `<span class="pill">${escapeHtml(job.employment_type)}</span>` : ""}${job.hours ? `<span class="pill">${escapeHtml(job.hours)}</span>` : ""}${job.pay ? `<span class="pill">${escapeHtml(job.pay)}</span>` : ""}${tags.map(t => `<span class="pill">${escapeHtml(t)}</span>`).join("")}</div><div class="actions"><a class="btn secondary" href="${jobPath(job)}">View job</a></div></article>`;
}

export function uniqueTaxonomy(jobs) {
  const categories = new Map();
  const locations = new Map();
  for (const job of jobs) {
    for (const tag of parseJsonArray(job.tags)) {
      const text = String(tag || "").trim();
      if (text) categories.set(slugify(text), text);
    }
    const loc = String(job.location || "").trim();
    if (loc) locations.set(slugify(loc), loc);
  }
  return { categories, locations };
}
