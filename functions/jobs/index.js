import { categoryPath, escapeHtml, jobCard, layout, listPublicJobs, locationPath, pageResponse, siteOrigin, uniqueTaxonomy } from "../_lib/public-seo.js";

export async function onRequestGet(context) {
  const origin = siteOrigin(context);
  const jobs = await listPublicJobs(context.env, { limit: 200 });
  const { categories, locations } = uniqueTaxonomy(jobs);
  const body = `
    <section class="hero"><h1>Find your next job</h1><p>Browse current opportunities from verified employers on Buisder.</p></section>
    ${jobs.length ? `<section class="grid">${jobs.map(jobCard).join("")}</section>` : `<div class="empty">There are no public jobs available right now.</div>`}
    ${categories.size ? `<h2 class="section-title">Browse by category</h2><div class="link-grid">${[...categories.values()].sort().map(v=>`<a class="text-link" href="${categoryPath(v)}">${escapeHtml(v)}</a>`).join("")}</div>` : ""}
    ${locations.size ? `<h2 class="section-title">Browse by location</h2><div class="link-grid">${[...locations.values()].sort().map(v=>`<a class="text-link" href="${locationPath(v)}">${escapeHtml(v)}</a>`).join("")}</div>` : ""}`;
  const html = layout({
    title: "Jobs | Buisder",
    description: "Browse current jobs from verified employers on Buisder.",
    canonical: `${origin}/jobs`,
    body
  });
  return pageResponse(html);
}
