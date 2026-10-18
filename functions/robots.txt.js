import { siteOrigin } from "./_lib/public-seo.js";
export function onRequestGet(context){const origin=siteOrigin(context);return new Response(`User-agent: *\nAllow: /jobs\nAllow: /employers\nDisallow: /api/\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`,{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"public, max-age=3600"}})}
