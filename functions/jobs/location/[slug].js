import { escapeHtml, jobCard, layout, listPublicJobs, pageResponse, siteOrigin, slugify } from "../../_lib/public-seo.js";

export async function onRequestGet(context) {
  const origin = siteOrigin(context);
  const slug = String(context.params.slug || "");
  const all = await listPublicJobs(context.env, { limit: 500 });
  const jobs = all.filter(job => slugify(job.location) === slug);
  const label = jobs[0]?.location || slug.replace(/-/g," ");
  const canonical=`${origin}/jobs/location/${encodeURIComponent(slug)}`;
  const body=`<div class="breadcrumbs"><a href="/jobs">Jobs</a> / Location</div><section class="hero"><h1>Jobs in ${escapeHtml(label)}</h1><p>Current opportunities in ${escapeHtml(label)} from verified employers on DEASJobs.</p></section>${jobs.length?`<section class="grid">${jobs.map(jobCard).join("")}</section>`:`<div class="empty">No current jobs in this location. <a href="/jobs">Browse all jobs</a>.</div>`}`;
  return pageResponse(layout({title:`Jobs in ${label} | DEASJobs`,description:`Browse current jobs in ${label} on DEASJobs.`,canonical,body,noindex:!jobs.length}),jobs.length?200:404);
}
