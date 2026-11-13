import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { api } from "../worker/api.js";
const json = (value, status = 200, headers = {}) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
function cookies(raw = "") {
  return Object.fromEntries(
    raw
      .split(";")
      .map((part) => part.trim().split(/=(.*)/s))
      .filter((p) => p[0])
      .map(([k, v]) => [k, v || ""]),
  );
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
export function createHandler({
  bucket,
  apiHandler,
  verifyUser,
  origin,
  publicConfig,
  staticRoot = path.resolve("dist"),
  production = false,
}) {
  const expected = new URL(origin).origin;
  function sessionCookie(value, maxAge) {
    return `focal_access=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${production ? "; Secure" : ""}`;
  }
  return async function handle(request) {
    try {
      const url = new URL(request.url),
        isApi = url.pathname.startsWith("/api/");
      if (isApi && !["GET", "HEAD"].includes(request.method)) {
        const from = request.headers.get("origin");
        if (from !== expected)
          return json({ error: "Invalid request origin." }, 403);
        if (request.headers.get("sec-fetch-site") === "cross-site")
          return json({ error: "Invalid request origin." }, 403);
      }
      if (url.pathname === "/api/config") return json(publicConfig);
      if (url.pathname === "/api/health")
        return json({
          ok: true,
          version: 3,
          storageReady: Boolean(bucket || apiHandler),
        });
      if (url.pathname === "/api/auth/logout" && request.method === "POST")
        return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
      if (isApi) {
        const bearer = request.headers
          .get("authorization")
          ?.match(/^Bearer (.+)$/i)?.[1];
        const token =
          bearer || cookies(request.headers.get("cookie") || "").focal_access;
        const user = token ? await verifyUser(token) : null;
        if (!user)
          return json(
            {
              error:
                "Sign in to your FOCAL account to join rooms, vote, and chat.",
              code: "SIGN_IN_REQUIRED",
            },
            401,
          );
        if (url.pathname === "/api/auth/session" && request.method === "POST")
          return json({ ok: true }, 200, {
            "Set-Cookie": sessionCookie(token, 3600),
          });
        const headers = new Headers(request.headers);
        headers.delete("x-focal-user-id");
        headers.delete("oai-authenticated-user-id");
        headers.delete("oai-authenticated-user-email");
        headers.set("x-focal-user-id", user.id);
        headers.set("origin", expected);
        const authenticatedRequest = new Request(
          new URL(url.pathname + url.search, expected),
          {
            method: request.method,
            headers,
            body: ["GET", "HEAD"].includes(request.method)
              ? undefined
              : await request.arrayBuffer(),
          },
        );
        return apiHandler
          ? apiHandler(authenticatedRequest, { token, user })
          : api(authenticatedRequest, { BUCKET: bucket });
      }
      if (!["GET", "HEAD"].includes(request.method))
        return new Response("Method not allowed", { status: 405 });
      let name;
      try {
        name = decodeURIComponent(url.pathname);
      } catch {
        return new Response("Not found", { status: 404 });
      }
      const target = path.resolve(
        staticRoot,
        "." + (name === "/" ? "/index.html" : name),
      );
      if (!target.startsWith(staticRoot + path.sep))
        return new Response("Not found", { status: 404 });
      let content;
      try {
        content = await fs.readFile(target);
      } catch {
        return new Response("Not found", { status: 404 });
      }
      return new Response(request.method === "HEAD" ? null : content, {
        headers: {
          "Content-Type":
            mime[path.extname(target)] || "application/octet-stream",
          "Cache-Control": name.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      });
    } catch {
      return json(
        {
          error:
            "The server could not complete this request. Please try again.",
        },
        500,
      );
    }
  };
}
export function serve(handler, { port = 3000, host = "127.0.0.1" } = {}) {
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of incoming) {
        length += chunk.length;
        if (length > 750000) {
          outgoing.writeHead(413, { "Content-Type": "application/json" });
          outgoing.end(JSON.stringify({ error: "Request too large." }));
          return;
        }
        chunks.push(chunk);
      }
      const request = new Request("http://localhost" + incoming.url, {
        method: incoming.method,
        headers: incoming.headers,
        body: ["GET", "HEAD"].includes(incoming.method)
          ? undefined
          : Buffer.concat(chunks),
      });
      const response = await handler(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
      else outgoing.end();
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(500);
      outgoing.end("Request failed.");
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return server.listen(port, host);
}
