import { categoryPath, employerPath, escapeHtml, formatDate, getPublicJob, jobPath, layout, mapEmploymentType, pageResponse, parseJsonArray, siteOrigin } from "../_lib/public-seo.js";

export async function onRequestGet(context) {
  const origin = siteOrigin(context);
  const job = await getPublicJob(context.env, String(context.params.id || ""));
  if (!job) {
    return pageResponse(layout({ title:"Job not found | DEASJobs", description:"This job is no longer publicly available.", canonical:`${origin}${new URL(context.request.url).pathname}`, noindex:true, body:`<div class="breadcrumbs"><a href="/jobs">Jobs</a></div><div class="empty"><h1>Job not available</h1><p>This role may have closed or is not currently public.</p><a class="btn" href="/jobs">Browse current jobs</a></div>` }), 404);
  }
  const company = job.company_name || job.company || "Employer";
  const tags = parseJsonArray(job.tags);
  const employmentType = mapEmploymentType(job.employment_type);
  const jsonLd = {
    "@context":"https://schema.org",
    "@type":"JobPosting",
    title: job.title,
    description: job.description || `${job.title} at ${company}`,
    identifier:{"@type":"PropertyValue",name:"DEASJobs",value:job.id},
    datePosted:String(job.created_at || "").slice(0,10),
    hiringOrganization:{"@type":"Organization",name:company,url:`${origin}${employerPath(job.employer_id)}`},
    ...(employmentType ? {employmentType} : {}),
    ...(job.location ? {jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:job.location,addressCountry:"IE"}}} : {}),
    directApply:false,
    url:`${origin}${jobPath(job)}`
  };
  const body = `
    <div class="breadcrumbs"><a href="/jobs">Jobs</a> / ${escapeHtml(job.title)}</div>
    <section class="hero"><h1>${escapeHtml(job.title)}</h1><p>${escapeHtml(company)}${job.location ? ` · ${escapeHtml(job.location)}` : ""}</p></section>
    <section class="card"><div class="meta">${job.employment_type ? `<span class="pill">${escapeHtml(job.employment_type)}</span>` : ""}${job.hours ? `<span class="pill">${escapeHtml(job.hours)}</span>` : ""}${job.pay ? `<span class="pill">${escapeHtml(job.pay)}</span>` : ""}${job.min_age ? `<span class="pill">Age ${escapeHtml(job.min_age)}+</span>` : ""}</div>${job.start_date ? `<p class="muted"><strong>Start:</strong> ${escapeHtml(job.start_date)}</p>` : ""}${job.experience ? `<p><strong>Experience:</strong> ${escapeHtml(job.experience)}</p>` : ""}<h2>About the job</h2><div class="description">${escapeHtml(job.description || "Contact the employer through DEASJobs for further details.")}</div>${tags.length ? `<div class="meta">${tags.map(t=>`<a class="pill" href="${categoryPath(t)}">${escapeHtml(t)}</a>`).join("")}</div>` : ""}<p class="muted">Posted ${escapeHtml(formatDate(job.created_at))}</p><a class="btn" href="/?job=${encodeURIComponent(job.id)}">Apply through DEASJobs</a></section>
    <section class="card"><h2>About ${escapeHtml(company)}</h2>${job.company_description ? `<p>${escapeHtml(job.company_description)}</p>` : ""}<a class="btn secondary" href="${employerPath(job.employer_id)}">View employer</a></section>`;
  return pageResponse(layout({ title:`${job.title} at ${company} | DEASJobs`, description:`${job.title}${job.location ? ` in ${job.location}` : ""} at ${company}. View the role and apply through DEASJobs.`, canonical:`${origin}${jobPath(job)}`, body, jsonLd }));
}
