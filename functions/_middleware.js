export async function onRequest(context) {
  const response = await context.next();
  const secured = new Response(response.body, response);

  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("X-Frame-Options", "DENY");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)"
  );

  if (new URL(context.request.url).pathname.startsWith("/api/auth/")) {
    secured.headers.set("Cache-Control", "no-store");
  }

  return secured;
}
