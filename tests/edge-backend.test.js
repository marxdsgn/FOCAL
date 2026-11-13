import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../server/app.js";
import { createSupabaseApiProxy } from "../server/edge-proxy.js";
import { createEdgeHandler } from "../server/edge-handler.js";
const url = "https://project.supabase.co/functions/v1/focal-api";
const origin = "https://focal.example";
const verifyUser = async (token) =>
  token === "valid" ? { id: "verified-player" } : null;

test("remote backend receives only a verified credential and normalized request", async () => {
  let forwarded;
  const proxy = createSupabaseApiProxy({
    functionUrl: url,
    supabaseUrl: "https://project.supabase.co",
    anonKey: "public-key",
    fetchImpl: async (target, options) => {
      forwarded = { target, options };
      return Response.json(
        { ok: true },
        { headers: { "Set-Cookie": "provider=never-forward" } },
      );
    },
  });
  const handler = createHandler({
    origin,
    verifyUser,
    apiHandler: proxy,
    publicConfig: {},
  });
  const r = await handler(
    new Request(origin + "/api/profile", {
      method: "POST",
      headers: {
        origin,
        cookie: "focal_access=valid",
        "x-focal-user-id": "victim",
        "Content-Type": "application/json",
      },
      body: '{"name":"Player"}',
    }),
  );
  assert.equal(r.status, 200);
  assert.equal(forwarded.target, url + "/api/profile");
  assert.equal(forwarded.options.headers.get("authorization"), "Bearer valid");
  assert.equal(forwarded.options.headers.get("apikey"), "public-key");
  assert.equal(forwarded.options.headers.has("cookie"), false);
  assert.equal(forwarded.options.headers.has("x-focal-user-id"), false);
  assert.equal(forwarded.options.redirect, "error");
  assert.equal(r.headers.has("set-cookie"), false);
  assert.equal(
    (await (await handler(new Request(origin + "/api/health"))).json())
      .storageReady,
    true,
  );
});

test("remote proxy cannot send a player credential to another project", () => {
  assert.throws(() =>
    createSupabaseApiProxy({
      functionUrl: "https://other.example/functions/v1/focal-api",
      supabaseUrl: "https://project.supabase.co",
      anonKey: "public",
    }),
  );
});

test("Edge verifies user tokens before privileged rules and discards spoofed identity headers", async () => {
  let seen;
  const edge = createEdgeHandler({
    verifyUser,
    bucket: {},
    api: async (request) => {
      seen = request;
      return Response.json({ ok: true });
    },
  });
  const request = (token) =>
    new Request(url + "/api/me", {
      headers: {
        ...(token ? { authorization: "Bearer " + token } : {}),
        "x-focal-user-id": "victim",
        cookie: "focal_access=valid",
      },
    });
  assert.equal((await edge(request())).status, 401);
  assert.equal((await edge(request("public-key"))).status, 401);
  assert.equal(seen, undefined);
  assert.equal((await edge(request("valid"))).status, 200);
  assert.equal(new URL(seen.url).pathname, "/api/me");
  assert.equal(seen.headers.get("x-focal-user-id"), "verified-player");
  assert.equal(seen.headers.has("cookie"), false);
  assert.equal(seen.headers.has("authorization"), false);
});

test("Edge limits oversized bodies before executing game rules", async () => {
  let called = false;
  const edge = createEdgeHandler({
    verifyUser,
    bucket: {},
    api: async () => {
      called = true;
      return Response.json({});
    },
  });
  const r = await edge(
    new Request(url + "/api/profile", {
      method: "POST",
      headers: { authorization: "Bearer valid" },
      body: "x".repeat(750001),
    }),
  );
  assert.equal(r.status, 413);
  assert.equal(called, false);
});
