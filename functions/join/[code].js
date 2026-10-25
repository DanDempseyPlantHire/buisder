export async function onRequestGet({ request, params }) {
  const incoming = new URL(request.url);
  const target = new URL("/login.html", incoming.origin);
  target.searchParams.set("signup", "1");
  target.searchParams.set("ref", String(params.code || "").slice(0, 40));
  for (const key of ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"]) {
    const value = incoming.searchParams.get(key);
    if (value) target.searchParams.set(key, value.slice(0, 180));
  }
  return Response.redirect(target.toString(), 302);
}
