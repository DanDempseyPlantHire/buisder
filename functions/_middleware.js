export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();
  if (host === "buisder.com" || host === "www.buisder.com" || host === "www.deasjobs.com") {
    url.protocol = "https:";
    url.hostname = "deasjobs.com";
    url.port = "";
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
