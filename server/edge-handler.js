const MAX_BODY = 750000;
const json = (error, status) =>
  Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );

async function boundedBody(request) {
  if (["GET", "HEAD"].includes(request.method)) return undefined;
  if (Number(request.headers.get("content-length")) > MAX_BODY)
    throw new RangeError("Request too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw new RangeError("Request too large.");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}

/** Edge business API: only a verified user JWT can reach privileged persistence. */
export function createEdgeHandler({ api, bucket, verifyUser }) {
  return async function handle(request) {
    try {
      const token = request.headers
        .get("authorization")
        ?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return json("Sign in required.", 401);
      const user = await verifyUser(token);
      if (!user?.id) return json("Sign in required.", 401);
      const source = new URL(request.url);
      const marker = "/focal-api";
      const index = source.pathname.indexOf(marker);
      const pathname =
        index >= 0
          ? source.pathname.slice(index + marker.length)
          : source.pathname;
      if (!pathname.startsWith("/api/")) return json("Not found.", 404);
      const body = await boundedBody(request);
      // The caller cannot supply a trusted identity, cookie, Origin or proxy header.
      const headers = new Headers({
        "x-focal-user-id": user.id,
        origin: source.origin,
      });
      const contentType = request.headers.get("content-type");
      if (contentType) headers.set("content-type", contentType);
      return await api(
        new Request(new URL(pathname + source.search, source.origin), {
          method: request.method,
          headers,
          body,
        }),
        { BUCKET: bucket },
      );
    } catch (error) {
      return json(
        error instanceof RangeError
          ? "Request too large."
          : "The shared service could not complete this request.",
        error instanceof RangeError ? 413 : 500,
      );
    }
  };
}
