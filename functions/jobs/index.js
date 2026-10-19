import { categoryPath, escapeHtml, jobCard, layout, listPublicJobs, locationPath, pageResponse, siteOrigin, uniqueTaxonomy } from "../_lib/public-seo.js";

export async function onRequestGet(context) {
  const origin = siteOrigin(context);
  const jobs = await listPublicJobs(context.env, { limit: 200 });
  const { categories, locations } = uniqueTaxonomy(jobs);
  const body = `
    <section class="hero"><h1>Find your next job</h1><p>Browse current opportunities from verified employers on DEASJobs.</p></section>
    ${jobs.length ? `<section class="grid">${jobs.map(jobCard).join("")}</section>` : `<section class="card"><h2>Jobs are being added</h2><p>There are no public jobs available right now. DEASJobs is open for young job seekers and employers, and verified employers can publish jobs and work experience opportunities.</p><a class="btn" href="/">Create an account or sign in</a></section>`}
    ${categories.size ? `<h2 class="section-title">Browse by category</h2><div class="link-grid">${[...categories.values()].sort().map(v=>`<a class="text-link" href="${categoryPath(v)}">${escapeHtml(v)}</a>`).join("")}</div>` : ""}
    ${locations.size ? `<h2 class="section-title">Browse by location</h2><div class="link-grid">${[...locations.values()].sort().map(v=>`<a class="text-link" href="${locationPath(v)}">${escapeHtml(v)}</a>`).join("")}</div>` : ""}<section class="card" style="margin-top:18px"><h2>About DEASJobs jobs</h2><p>DEASJobs helps young people discover local jobs and work experience opportunities from participating employers. Create an account to use the swipe-based job feed and manage your applications.</p><a class="btn secondary" href="/">Sign in or create an account</a></section>`;
  const html = layout({
    title: "Jobs | DEASJobs",
    description: "Browse current jobs from verified employers on DEASJobs.",
    canonical: `${origin}/jobs`,
    body
  });
  return pageResponse(html);
}
