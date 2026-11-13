import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../server/app.js";
const bucket = { get: async () => null };
const opts = {
  bucket,
  origin: "https://focal.example",
  publicConfig: {
    supabaseUrl: "https://project.supabase.co",
    anonKey: "public-only",
  },
  verifyUser: async (token) =>
    token === "valid" ? { id: "verified-user" } : null,
  production: true,
};
const req = (url, options = {}) =>
  new Request("https://focal.example" + url, options);
test("standalone API ignores spoofed identities and requires verified account tokens", async () => {
  const handle = createHandler(opts);
  const r = await handle(
    req("/api/me", {
      headers: {
        "x-focal-user-id": "victim",
        "oai-authenticated-user-id": "victim",
      },
    }),
  );
  assert.equal(r.status, 401);
  const valid = await handle(
    req("/api/me", {
      headers: { authorization: "Bearer valid", "x-focal-user-id": "victim" },
    }),
  );
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).name, "Photographer");
});
test("public config never includes the backend key", async () => {
  const r = await createHandler(opts)(req("/api/config"));
  assert.deepEqual(await r.json(), opts.publicConfig);
});
test("same-origin session cookies are secure and cross-site writes are blocked", async () => {
  const handle = createHandler(opts);
  const denied = await handle(
    req("/api/auth/session", {
      method: "POST",
      headers: {
        authorization: "Bearer valid",
        origin: "https://evil.example",
      },
    }),
  );
  assert.equal(denied.status, 403);
  const accepted = await handle(
    req("/api/auth/session", {
      method: "POST",
      headers: {
        authorization: "Bearer valid",
        origin: "https://focal.example",
      },
    }),
  );
  assert.equal(accepted.status, 200);
  assert.match(
    accepted.headers.get("set-cookie"),
    /HttpOnly; SameSite=Lax; Max-Age=3600; Secure/,
  );
  const cookie = accepted.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await handle(req("/api/me", { headers: { cookie } }))).status,
    200,
  );
  const logout = await handle(
    req("/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://focal.example" },
    }),
  );
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
});
test("static traversal and mutating requests without an origin are rejected", async () => {
  const handle = createHandler(opts);
  assert.equal((await handle(req("/%2e%2e%2f.env"))).status, 404);
  assert.equal(
    (
      await handle(
        req("/api/profile", {
          method: "POST",
          headers: { authorization: "Bearer valid" },
          body: "{}",
        }),
      )
    ).status,
    403,
  );
});
