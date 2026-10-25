import { escapeHtml, employerPath, jobCard, layout, pageResponse, siteOrigin } from "../_lib/public-seo.js";

export async function onRequestGet(context) {
  const origin=siteOrigin(context), id=String(context.params.id||"");
  const employer=await context.env.DB.prepare(`SELECT ep.user_id,ep.company_name,ep.location,ep.description,ep.website,ep.logo_key FROM employer_profiles ep JOIN users u ON u.id=ep.user_id WHERE ep.user_id=? AND ep.verification_status='verified' AND u.is_suspended=0 LIMIT 1`).bind(id).first();
  if(!employer) return pageResponse(layout({title:"Employer not found | Deas Jobs",description:"This employer is not publicly available.",canonical:`${origin}${new URL(context.request.url).pathname}`,noindex:true,body:`<div class="empty"><h1>Employer not available</h1><a class="btn" href="/jobs">Browse jobs</a></div>`}),404);
  const rows=await context.env.DB.prepare(`SELECT j.*, ep.company_name FROM jobs j JOIN employer_profiles ep ON ep.user_id=j.employer_id WHERE j.employer_id=? AND j.status='active' ORDER BY j.created_at DESC LIMIT 100`).bind(id).all();
  const jobs=rows.results||[];
  const logo=employer.logo_key?`<img class="company-logo" src="/public/logo/${encodeURIComponent(id)}" alt="">`:"";
  const website=/^https?:\/\//i.test(String(employer.website||""))?`<p><a href="${escapeHtml(employer.website)}" rel="nofollow noopener">Employer website</a></p>`:"";
  const body=`<div class="breadcrumbs"><a href="/jobs">Jobs</a> / Employer</div><section class="hero"><div class="company-head">${logo}<div><h1>${escapeHtml(employer.company_name||"Employer")}</h1><p>${escapeHtml(employer.location||"Verified Deas Jobs employer")}</p></div></div></section><section class="card">${employer.description?`<p>${escapeHtml(employer.description)}</p>`:""}${website}</section><h2 class="section-title">Current jobs</h2>${jobs.length?`<section class="grid">${jobs.map(jobCard).join("")}</section>`:`<div class="empty">No active public jobs at the moment.</div>`}`;
  return pageResponse(layout({title:`${employer.company_name||"Employer"} jobs | Deas Jobs`,description:`View current jobs from ${employer.company_name||"this verified employer"} on Deas Jobs.`,canonical:`${origin}${employerPath(id)}`,body,jsonLd:{"@context":"https://schema.org","@type":"Organization",name:employer.company_name||"Employer",url:`${origin}${employerPath(id)}`}}));
}
