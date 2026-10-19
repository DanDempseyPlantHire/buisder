import { categoryPath, escapeHtml, jobCard, layout, listPublicJobs, locationPath, pageResponse, siteOrigin, uniqueTaxonomy } from "../_lib/public-seo.js";

export async function onRequestGet(context) {
  const origin = siteOrigin(context);
  const jobs = await listPublicJobs(context.env, { limit: 200 });
  const { categories, locations } = uniqueTaxonomy(jobs);
  const workExperience = jobs.filter(job => String(job.employment_type || "").trim().toLowerCase() === "work experience");
  const regularJobs = jobs.filter(job => String(job.employment_type || "").trim().toLowerCase() !== "work experience");
  const body = `
    <section class="hero"><h1>Jobs and work experience</h1><p>Browse jobs and work experience opportunities separately from verified employers on DEASJobs.</p></section>
    <nav class="link-grid" aria-label="Opportunity sections"><a class="text-link" href="#jobs">Jobs (${regularJobs.length})</a><a class="text-link" href="#work-experience">Work experience (${workExperience.length})</a></nav>
    <h2 class="section-title" id="jobs">Jobs</h2>
    ${regularJobs.length ? `<section class="grid">${regularJobs.map(jobCard).join("")}</section>` : `<section class="card"><p>There are no regular jobs available at the moment.</p></section>`}
    <h2 class="section-title" id="work-experience">Work experience</h2>
    ${workExperience.length ? `<section class="grid">${workExperience.map(jobCard).join("")}</section>` : `<section class="card"><p>There are no work experience opportunities available at the moment. Check back for new placements.</p></section>`}
    ${categories.size ? `<h2 class="section-title">Browse by category</h2><div class="link-grid">${[...categories.values()].sort().map(v=>`<a class="text-link" href="${categoryPath(v)}">${escapeHtml(v)}</a>`).join("")}</div>` : ""}
    ${locations.size ? `<h2 class="section-title">Browse by location</h2><div class="link-grid">${[...locations.values()].sort().map(v=>`<a class="text-link" href="${locationPath(v)}">${escapeHtml(v)}</a>`).join("")}</div>` : ""}<section class="card" style="margin-top:18px"><h2>About DEASJobs jobs</h2><p>DEASJobs helps young people discover local jobs and work experience opportunities from participating employers. Create an account to use the swipe-based job feed and manage your applications.</p><a class="btn secondary" href="/">Sign in or create an account</a></section>`;
  const html = layout({
    title: "Jobs and work experience | DEASJobs",
    description: "Browse regular jobs and work experience placements separately from verified employers on DEASJobs.",
    canonical: `${origin}/jobs`,
    body
  });
  return pageResponse(html);
}
