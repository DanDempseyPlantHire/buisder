import { escapeHtml, jobCard, layout, listPublicJobs, pageResponse, siteOrigin, slugify } from "../../_lib/public-seo.js";

export async function onRequestGet(context) {
  const origin = siteOrigin(context);
  const slug = String(context.params.slug || "");
  const all = await listPublicJobs(context.env, { limit: 500 });
  const jobs = all.filter(job => {
    try { return JSON.parse(job.tags || "[]").some(tag => slugify(tag) === slug); } catch { return false; }
  });
  let label = slug.replace(/-/g," ");
  for (const job of jobs) { try { const found=JSON.parse(job.tags||"[]").find(tag=>slugify(tag)===slug); if(found){label=String(found);break;} } catch {} }
  const canonical=`${origin}/jobs/category/${encodeURIComponent(slug)}`;
  const body=`<div class="breadcrumbs"><a href="/jobs">Jobs</a> / Category</div><section class="hero"><h1>${escapeHtml(label)} jobs</h1><p>Current ${escapeHtml(label)} opportunities from verified employers on Buisder.</p></section>${jobs.length?`<section class="grid">${jobs.map(jobCard).join("")}</section>`:`<div class="empty">No current jobs in this category. <a href="/jobs">Browse all jobs</a>.</div>`}`;
  return pageResponse(layout({title:`${label} jobs | Buisder`,description:`Browse current ${label} jobs on Buisder.`,canonical,body,noindex:!jobs.length}),jobs.length?200:404);
}
