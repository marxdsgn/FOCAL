/** Forward only an already-verified user's credential to this project's Edge API. */
export function createSupabaseApiProxy({
  functionUrl,
  supabaseUrl,
  anonKey,
  fetchImpl = fetch,
}) {
  const endpoint = new URL(functionUrl);
  const project = new URL(supabaseUrl);
  if (
    endpoint.origin !== project.origin ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !/^\/functions\/v1\/[a-zA-Z0-9_-]+\/?$/.test(endpoint.pathname)
  )
    throw Error(
      "The Edge API URL must be a function on your Supabase project.",
    );
  if (
    endpoint.protocol !== "https:" &&
    !(
      endpoint.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(endpoint.hostname)
    )
  )
    throw Error("The Edge API must use HTTPS.");
  const base = endpoint.href.replace(/\/$/, "");
  return async function forward(request, { token }) {
    if (!token)
      return Response.json({ error: "Sign in required." }, { status: 401 });
    const source = new URL(request.url);
    const headers = new Headers({
      Authorization: "Bearer " + token,
      apikey: anonKey,
    });
    const type = request.headers.get("content-type");
    if (type) headers.set("content-type", type);
    try {
      const response = await fetchImpl(base + source.pathname + source.search, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : await request.arrayBuffer(),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      const outgoing = new Headers({ "Cache-Control": "no-store" });
      for (const key of ["content-type", "x-content-type-options"])
        if (response.headers.has(key))
          outgoing.set(key, response.headers.get(key));
      return new Response(response.body, {
        status: response.status,
        headers: outgoing,
      });
    } catch {
      return Response.json(
        {
          error: "Shared rooms are temporarily unavailable. Please try again.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
