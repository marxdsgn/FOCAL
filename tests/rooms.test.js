import test from "node:test";
import assert from "node:assert/strict";
import { api, normalizeRoom } from "../worker/api.js";
class Bucket {
  data = new Map();
  version = 0;
  async get(key) {
    const record = this.data.get(key);
    return record
      ? {
          etag: record.etag,
          body: record.body,
          httpMetadata: record.httpMetadata,
          customMetadata: record.customMetadata,
          json: async () => structuredClone(JSON.parse(record.body)),
        }
      : null;
  }
  async put(key, body, options = {}) {
    const old = this.data.get(key),
      cond = options.onlyIf;
    if (
      (cond?.etagMatches && old?.etag !== cond.etagMatches) ||
      (cond?.etagDoesNotMatch === "*" && old)
    )
      return null;
    const etag = String(++this.version);
    this.data.set(key, {
      body,
      etag,
      httpMetadata: options.httpMetadata,
      customMetadata: options.customMetadata,
    });
    return { etag };
  }
  async list({ prefix }) {
    return {
      objects: [...this.data.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
    };
  }
}
const photo = {
  name: "Previously taken photograph",
  url: "data:image/jpeg;base64,YWJj",
};
const call = async (bucket, uid, path, body) => {
  const r = await api(
    new Request("https://focal.test/api" + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(uid ? { "x-focal-user-id": uid } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { BUCKET: bucket },
  );
  return { status: r.status, data: await r.json() };
};
async function twoPlayers(bucket) {
  await call(bucket, "alice", "/profile", { name: "Alice" });
  await call(bucket, "bob", "/profile", { name: "Bob" });
  const { data: room } = await call(bucket, "alice", "/rooms", {
    entryMode: "existing",
    photo,
    theme: "Old favorites",
  });
  const result = await call(bucket, "bob", "/rooms/" + room.id + "/join", {
    entryMode: "existing",
    photo: { ...photo, name: "Second entry" },
  });
  assert.equal(result.data.status, "voting");
  return result.data;
}
test("identity required and missing cloud binding is explicit", async () => {
  assert.equal((await call(new Bucket(), null, "/me")).status, 401);
  const r = await api(
    new Request("https://focal.test/api/me", {
      headers: { "x-focal-user-id": "one" },
    }),
    {},
  );
  assert.equal(r.status, 503);
});
test("existing photos are accepted, chat is shared, players cannot vote, duplicate votes blocked", async () => {
  const bucket = new Bucket(),
    room = await twoPlayers(bucket);
  assert.equal(room.players.a.photo.name, photo.name);
  assert.equal(
    (
      await call(bucket, "alice", "/rooms/" + room.id + "/vote", {
        choice: "a",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(bucket, "spectator", "/rooms/" + room.id + "/vote", {
        choice: "a",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(bucket, "spectator", "/rooms/" + room.id + "/vote", {
        choice: "b",
      })
    ).status,
    409,
  );
  await call(bucket, "bob", "/rooms/" + room.id + "/chat", {
    text: "Great frame!",
  });
  const { data } = await call(bucket, "alice", "/rooms/" + room.id);
  assert.equal(data.counts.a, 1);
  assert.equal(data.messages.at(-1).text, "Great frame!");
  assert.equal(data.players.b.uid, undefined);
  assert.equal(data.votes, undefined);
});
test("shoot-now deadline is exactly five minutes and late submissions are rejected", async () => {
  const bucket = new Bucket();
  const { data: r } = await call(bucket, "alice", "/rooms", {
    entryMode: "shoot",
    theme: "Motion",
  });
  assert.equal(r.players.a.deadline - r.created, 300000);
  let raw = await (await bucket.get("rooms/" + r.id)).json();
  raw.players.a.deadline = Date.now() - 1;
  await bucket.put("rooms/" + r.id, JSON.stringify(raw));
  assert.equal(
    (await call(bucket, "alice", "/rooms/" + r.id + "/submit", { photo }))
      .status,
    409,
  );
});
test("shoot-now accepts submission within the window and locks it after entry", async () => {
  const bucket = new Bucket();
  const { data: r } = await call(bucket, "alice", "/rooms", {
    entryMode: "shoot",
  });
  assert.equal(
    (await call(bucket, "alice", "/rooms/" + r.id + "/submit", { photo }))
      .status,
    200,
  );
  assert.equal(
    (await call(bucket, "alice", "/rooms/" + r.id + "/submit", { photo }))
      .status,
    409,
  );
  assert.equal(
    (await call(bucket, "intruder", "/rooms/" + r.id + "/submit", { photo }))
      .status,
    403,
  );
});
test("server closes votes on deadline and awards a community win only once", async () => {
  const bucket = new Bucket(),
    room = await twoPlayers(bucket);
  await call(bucket, "spectator", "/rooms/" + room.id + "/vote", {
    choice: "b",
  });
  const raw = await (await bucket.get("rooms/" + room.id)).json();
  raw.closesAt = Date.now() - 1;
  await bucket.put("rooms/" + room.id, JSON.stringify(raw));
  assert.equal(
    (await call(bucket, "late", "/rooms/" + room.id + "/vote", { choice: "a" }))
      .status,
    409,
  );
  await call(bucket, "bob", "/rooms/" + room.id);
  await call(bucket, "bob", "/rooms/" + room.id);
  assert.equal((await call(bucket, "bob", "/me")).data.wins, 1);
  assert.equal((await call(bucket, "alice", "/me")).data.losses, 1);
});
test("no-vote matches draw and expired capture forfeits to the submitted entry", () => {
  const room = {
    created: 0,
    status: "voting",
    players: { a: { photo }, b: { photo } },
    votes: {},
    closesAt: 5,
  };
  assert.equal(normalizeRoom(room, 6).outcome, "draw");
  const r = {
    created: 0,
    status: "preparing",
    players: { a: { photo, deadline: 300 }, b: { photo: null, deadline: 300 } },
    votes: {},
  };
  assert.equal(normalizeRoom(r, 300).outcome, "a");
});
test("concurrent spectator votes survive conditional writes", async () => {
  const bucket = new Bucket(),
    room = await twoPlayers(bucket);
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      call(bucket, "voter" + i, "/rooms/" + room.id + "/vote", { choice: "a" }),
    ),
  );
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(
    (await call(bucket, "alice", "/rooms/" + room.id)).data.counts.a,
    5,
  );
});
test("invalid uploads and chat floods are rejected", async () => {
  const bucket = new Bucket();
  assert.equal(
    (
      await call(bucket, "one", "/rooms", {
        entryMode: "existing",
        photo: { name: "bad", url: "javascript:alert(1)" },
      })
    ).status,
    400,
  );
  const room = await twoPlayers(bucket);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await call(bucket, "talker", "/rooms/" + room.id + "/chat", {
          text: "Hello",
        })
      ).status,
      200,
    );
  assert.equal(
    (
      await call(bucket, "talker", "/rooms/" + room.id + "/chat", {
        text: "Too fast",
      })
    ).status,
    429,
  );
});

test("signup persists a character, bio and safe social links; public cards omit internal account data", async () => {
  const bucket = new Bucket();
  const character = {
    skin: "#c98f6a",
    hair: "#302538",
    outfit: "#ac8ae8",
    background: "#342241",
    style: "curly",
    accessory: "camera",
  };
  const saved = await call(bucket, "alice", "/profile", {
    name: "Alice",
    bio: "Street photographer",
    character,
    links: { instagram: "https://instagram.com/alice" },
    onboarded: true,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.onboarded, true);
  await call(bucket, "alice", "/profile", { name: "Alice2" });
  const { data: p } = await call(
    bucket,
    "bob",
    "/players/" + saved.data.publicId,
  );
  assert.equal(p.bio, "Street photographer");
  assert.equal(p.character.accessory, "camera");
  assert.equal(p.name, "Alice2");
  assert.equal(p.links.instagram, "https://instagram.com/alice");
  assert.equal(p.settled, undefined);
  assert.equal(p.history, undefined);
  assert.equal(
    (
      await call(bucket, "alice", "/profile", {
        name: "Alice",
        links: { website: "javascript:alert(1)" },
      })
    ).status,
    400,
  );
});
test("players create shared chat rooms and give feedback with direct replies", async () => {
  const bucket = new Bucket();
  await call(bucket, "alice", "/profile", { name: "Alice" });
  await call(bucket, "bob", "/profile", { name: "Bob" });
  const { data: g } = await call(bucket, "alice", "/groups", {
    name: "Honest feedback",
    topic: "Help each other improve",
    kind: "feedback",
  });
  const posted = await call(bucket, "alice", "/groups/" + g.id + "/messages", {
    text: "What could I do better?",
  });
  assert.equal(posted.status, 200);
  const original = posted.data.messages[0];
  await call(bucket, "bob", "/groups/" + g.id + "/messages", {
    text: "What works: the light. Try this: a tighter crop.",
    replyTo: original.id,
  });
  const { data: seen } = await call(bucket, "alice", "/groups/" + g.id);
  assert.equal(seen.messages.length, 2);
  assert.equal(seen.messages[1].replyTo, original.id);
  assert.equal(seen.messages[1].name, "Bob");
  assert.equal(seen.createdBy, undefined);
  assert.equal(
    (await call(bucket, "bob", "/groups")).data[0].name,
    "Honest feedback",
  );
  assert.equal(
    (
      await call(bucket, "bob", "/groups/" + g.id + "/messages", {
        text: "Invalid reply",
        replyTo: "missing",
      })
    ).status,
    400,
  );
});
test("feedback photos are stored separately and cannot be submitted by a different user", async () => {
  const bucket = new Bucket();
  const { data: g } = await call(bucket, "alice", "/groups", {
    name: "Feedback",
    kind: "feedback",
  });
  const uploaded = await call(bucket, "alice", "/community-photos", { photo });
  assert.equal(uploaded.status, 201);
  assert.match(uploaded.data.url, /^\/api\/community-photos\//);
  assert.equal(
    (
      await call(bucket, "bob", "/groups/" + g.id + "/messages", {
        text: "Not mine",
        photo: uploaded.data,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(bucket, "alice", "/groups/" + g.id + "/messages", {
        text: "An older photo I took",
        photo: uploaded.data,
      })
    ).status,
    200,
  );
  const response = await api(
    new Request("https://focal.test" + uploaded.data.url, {
      headers: { "x-focal-user-id": "bob" },
    }),
    { BUCKET: bucket },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.equal(await response.text(), "abc");
});
