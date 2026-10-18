import { categoryPath, employerPath, jobPath, listPublicJobs, locationPath, siteOrigin, uniqueTaxonomy } from "./_lib/public-seo.js";
function xml(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
export async function onRequestGet(context){
  const origin=siteOrigin(context); const jobs=await listPublicJobs(context.env,{limit:5000}); const {categories,locations}=uniqueTaxonomy(jobs); const employers=[...new Set(jobs.map(j=>j.employer_id))];
  const entries=[{loc:`${origin}/jobs`}];
  for(const job of jobs) entries.push({loc:`${origin}${jobPath(job)}`,lastmod:String(job.created_at||"").slice(0,10)});
  for(const id of employers) entries.push({loc:`${origin}${employerPath(id)}`});
  for(const v of categories.values()) entries.push({loc:`${origin}${categoryPath(v)}`});
  for(const v of locations.values()) entries.push({loc:`${origin}${locationPath(v)}`});
  const body=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(e=>`<url><loc>${xml(e.loc)}</loc>${e.lastmod?`<lastmod>${xml(e.lastmod)}</lastmod>`:""}</url>`).join("\n")}\n</urlset>`;
  return new Response(body,{headers:{"Content-Type":"application/xml; charset=utf-8","Cache-Control":"public, max-age=300, s-maxage=1800"}});
}
