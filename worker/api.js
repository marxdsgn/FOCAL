const FIVE_MINUTES = 300000,
  VOTING_TIME = 90000;
const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export function normalizeRoom(room, now = Date.now()) {
  if (room.status === "finished") return room;
  const a = room.players.a,
    b = room.players.b;
  if (!b) {
    if ((!a.photo && now >= a.deadline) || now > room.created + 86400000) {
      room.status = "finished";
      room.outcome = "expired";
      room.finishedAt = now;
    }
    return room;
  }
  if (room.status === "preparing") {
    const expired = Object.values(room.players).some(
      (p) => !p.photo && now >= p.deadline,
    );
    if (expired) {
      room.status = "finished";
      room.finishedAt = now;
      room.outcome =
        a.photo && !b.photo ? "a" : b.photo && !a.photo ? "b" : "draw";
      room.reason = "Submission time expired";
      return room;
    }
    if (a.photo && b.photo) {
      room.status = "voting";
      room.closesAt = now + VOTING_TIME;
    }
  }
  if (room.status === "voting" && now >= room.closesAt) {
    const votes = Object.values(room.votes);
    const av = votes.filter((v) => v === "a").length,
      bv = votes.length - av;
    room.status = "finished";
    room.finishedAt = now;
    room.outcome = av > bv ? "a" : bv > av ? "b" : "draw";
    room.reason = votes.length ? "Community vote" : "No votes cast";
  }
  return room;
}
async function read(bucket, key, fallback) {
  const obj = await bucket.get(key);
  return obj ? await obj.json() : fallback;
}
async function change(bucket, key, initial, fn) {
  for (let attempt = 0; attempt < 7; attempt++) {
    const obj = await bucket.get(key);
    const value = obj ? await obj.json() : structuredClone(initial);
    const next = await fn(value);
    const saved = await bucket.put(key, JSON.stringify(next), {
      onlyIf: obj ? { etagMatches: obj.etag } : { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "application/json" },
    });
    if (saved) return next;
  }
  fail("Room is busy. Please try again.", 409);
}
async function summarize(bucket, room) {
  const { id, theme, created, status, finishedAt } = room;
  await bucket.put(
    "summaries/" + id,
    JSON.stringify({
      id,
      theme,
      created,
      status,
      finishedAt,
      players: Object.fromEntries(
        Object.entries(room.players).map(([side, p]) => [
          side,
          p ? { name: p.name } : null,
        ]),
      ),
    }),
  );
}
const initialProfile = () => ({
  name: "Photographer",
  onboarded: false,
  publicId: null,
  bio: "",
  links: {},
  character: {},
  wins: 0,
  losses: 0,
  settled: [],
  history: [],
});
async function settle(bucket, room) {
  if (room.status !== "finished" || ["expired", "draw"].includes(room.outcome))
    return;
  await Promise.all(
    Object.entries(room.players)
      .filter(([, p]) => p)
      .map(([side, p]) =>
        change(bucket, "profiles/" + p.uid, initialProfile(), (profile) => {
          if (profile.settled.includes(room.id)) return profile;
          const won = room.outcome === side;
          return {
            ...profile,
            wins: profile.wins + (won ? 1 : 0),
            losses: profile.losses + (won ? 0 : 1),
            settled: [...profile.settled, room.id],
            history: [
              { id: room.id, theme: room.theme, won, date: room.finishedAt },
              ...profile.history,
            ].slice(0, 100),
          };
        }),
      ),
  );
}
function publicRoom(room, uid) {
  const players = Object.fromEntries(
    Object.entries(room.players).map(([side, p]) => [
      side,
      p
        ? {
            name: p.name,
            photo: p.photo,
            deadline: p.deadline,
            isMe: p.uid === uid,
          }
        : null,
    ]),
  );
  const values = Object.values(room.votes);
  return {
    ...room,
    players,
    votes: undefined,
    counts: {
      a: values.filter((v) => v === "a").length,
      b: values.filter((v) => v === "b").length,
    },
    myVote: room.votes[uid] || null,
    messages: room.messages.map(({ uid: sender, ...m }) => ({
      ...m,
      isMe: sender === uid,
    })),
    isParticipant: Object.values(room.players).some((p) => p?.uid === uid),
    serverNow: Date.now(),
  };
}
async function body(request) {
  if (Number(request.headers.get("content-length")) > 700000)
    fail("Request too large.", 413);
  const raw = await request.text();
  if (raw.length > 700000) fail("Request too large.", 413);
  try {
    return JSON.parse(raw || "{}");
  } catch {
    fail("Invalid JSON.");
  }
}
function validPhoto(p) {
  return (
    p &&
    typeof p.name === "string" &&
    p.name.length <= 100 &&
    typeof p.url === "string" &&
    p.url.length <= 500000 &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.url)
  );
}
function publicProfile(p) {
  return {
    publicId: p.publicId,
    name: p.name,
    bio: p.bio || "",
    links: p.links || {},
    character: p.character || {},
    wins: p.wins,
    losses: p.losses,
    onboarded: Boolean(p.onboarded),
  };
}
function cleanCharacter(c) {
  if (!c || typeof c !== "object") fail("Choose your character.");
  const out = {};
  for (const key of ["skin", "hair", "outfit", "background"]) {
    if (!/^#[0-9a-fA-F]{6}$/.test(c[key] || ""))
      fail("Choose valid character colors.");
    out[key] = c[key];
  }
  if (
    !["crop", "curly", "long"].includes(c.style) ||
    !["camera", "headphones", "cap"].includes(c.accessory)
  )
    fail("Choose valid character features.");
  return { ...out, style: c.style, accessory: c.accessory };
}
function cleanLinks(links) {
  if (!links || typeof links !== "object" || Array.isArray(links))
    fail("Add valid social links.");
  const out = {};
  for (const key of ["instagram", "tiktok", "youtube", "website"]) {
    const raw = String(links[key] || "").trim();
    if (!raw) continue;
    if (raw.length > 300) fail("Social link is too long.");
    let url;
    try {
      url = new URL(raw);
    } catch {
      fail("Social links must be full https:// URLs.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      fail("Use secure https:// social links.");
    out[key] = url.href;
  }
  return out;
}
function publicGroup(g, uid) {
  return {
    ...g,
    createdBy: undefined,
    isOwner: g.createdBy === uid,
    messages: g.messages.map(({ uid: sender, ...m }) => ({
      ...m,
      isMe: sender === uid,
    })),
  };
}
async function groupSummary(bucket, g) {
  await bucket.put(
    "group-summaries/" + g.id,
    JSON.stringify({
      id: g.id,
      name: g.name,
      topic: g.topic,
      kind: g.kind,
      created: g.created,
      lastActive: g.lastActive || g.created,
      messages: g.messages.length,
      host: g.host,
    }),
  );
}
async function communityApi(request, bucket, uid, path, method) {
  const player = path.match(/^\/api\/players\/([a-zA-Z0-9-]+)$/);
  if (player && method === "GET") {
    const index = await read(bucket, "player-index/" + player[1], null);
    if (!index) fail("Player not found.", 404);
    return json(
      publicProfile(
        await read(bucket, "profiles/" + index.uid, initialProfile()),
      ),
    );
  }
  if (path === "/api/groups" && method === "GET") {
    const listing = await bucket.list({
      prefix: "group-summaries/",
      limit: 100,
    });
    const groups = await Promise.all(
      listing.objects.map((o) => read(bucket, o.key, null)),
    );
    return json(
      groups.filter(Boolean).sort((a, b) => b.lastActive - a.lastActive),
    );
  }
  if (path === "/api/groups" && method === "POST") {
    const data = await body(request),
      profile = await read(bucket, "profiles/" + uid, initialProfile());
    const name = String(data.name || "").trim(),
      topic = String(data.topic || "").trim();
    if (name.length < 2 || name.length > 40 || topic.length > 160)
      fail(
        "Choose a room name (2–40 characters) and a topic under 160 characters.",
      );
    if (!["general", "feedback"].includes(data.kind))
      fail("Choose a room type.");
    const now = Date.now(),
      id = crypto.randomUUID(),
      g = {
        id,
        name,
        topic,
        kind: data.kind,
        createdBy: uid,
        host: profile.name,
        created: now,
        lastActive: now,
        messages: [],
      };
    await bucket.put("groups/" + id, JSON.stringify(g));
    await groupSummary(bucket, g);
    return json(publicGroup(g, uid), 201);
  }
  if (path === "/api/community-photos" && method === "POST") {
    const data = await body(request);
    if (!validPhoto(data.photo)) fail("Choose a valid photograph.");
    const id = crypto.randomUUID(),
      mime = data.photo.url.match(/^data:(image\/[a-z]+);/)[1],
      bytes = Uint8Array.from(atob(data.photo.url.split(",")[1]), (c) =>
        c.charCodeAt(0),
      );
    await bucket.put("community-photos/" + id, bytes, {
      httpMetadata: { contentType: mime },
      customMetadata: { owner: uid },
    });
    return json(
      { url: "/api/community-photos/" + id, name: data.photo.name },
      201,
    );
  }
  const photo = path.match(/^\/api\/community-photos\/([a-zA-Z0-9-]+)$/);
  if (photo && method === "GET") {
    const object = await bucket.get("community-photos/" + photo[1]);
    if (!object) fail("Photo not found.", 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const found = path.match(/^\/api\/groups\/([a-zA-Z0-9-]+)(?:\/(messages))?$/);
  if (!found) return null;
  const [, id, action] = found,
    key = "groups/" + id;
  if (method === "GET" && !action) {
    const group = await read(bucket, key, null);
    if (!group) fail("Room not found.", 404);
    return json(publicGroup(group, uid));
  }
  if (method === "POST" && action === "messages") {
    const data = await body(request),
      profile = await read(bucket, "profiles/" + uid, initialProfile());
    const text = String(data.text || "").trim();
    if (text.length > 1000 || (!text && !data.photo))
      fail("Write a message or share a photo.");
    if (
      data.photo &&
      (!/^\/api\/community-photos\/[a-zA-Z0-9-]+$/.test(data.photo.url || "") ||
        typeof data.photo.name !== "string" ||
        data.photo.name.length > 100)
    )
      fail("Choose a shared photograph.");
    if (data.photo) {
      const obj = await bucket.get(data.photo.url.slice(5));
      if (!obj || obj.customMetadata?.owner !== uid)
        fail("Upload your own photo before sharing it.", 403);
    }
    const group = await change(bucket, key, null, (g) => {
      if (!g) fail("Room not found.", 404);
      const now = Date.now();
      if (
        g.messages.filter((m) => m.uid === uid && now - m.time < 10000)
          .length >= 5
      )
        fail("Give others a moment before sending another message.", 429);
      if (data.replyTo && !g.messages.some((m) => m.id === data.replyTo))
        fail("That message is no longer in the room.");
      g.messages.push({
        id: crypto.randomUUID(),
        uid,
        name: profile.name,
        publicId: profile.publicId || null,
        character: profile.character || null,
        text,
        photo: data.photo
          ? { url: data.photo.url, name: data.photo.name }
          : null,
        replyTo: data.replyTo || null,
        time: now,
      });
      g.messages = g.messages.slice(-150);
      g.lastActive = now;
      return g;
    });
    await groupSummary(bucket, group);
    return json(publicGroup(group, uid));
  }
  fail("Method not allowed.", 405);
}

async function worldSnapshot(bucket, uid) {
  const now = Date.now();
  const listing = await bucket.list({ prefix: "world-presence/", limit: 100 });
  const records = await Promise.all(
    listing.objects.map((o) => read(bucket, o.key, null)),
  );
  const players = records
    .filter((p) => p && now - p.lastSeen < 20000)
    .map(({ uid: owner, lastSeen, ...p }) => ({ ...p, isMe: owner === uid }));
  const chat = await read(bucket, "world-chat", { messages: [] });
  return {
    players,
    messages: chat.messages.map(({ uid: owner, ...m }) => ({
      ...m,
      isMe: owner === uid,
    })),
  };
}
async function worldApi(request, bucket, uid, path, method) {
  if (!path.startsWith("/api/world")) return null;
  if (path === "/api/world" && method === "GET")
    return json(await worldSnapshot(bucket, uid));
  if (method !== "POST") fail("Not found.", 404);
  const profile = await read(bucket, "profiles/" + uid, initialProfile());
  if (!profile.onboarded || !profile.publicId)
    fail("Create your player before joining the world.", 403);
  const data = await body(request);
  if (path === "/api/world/presence") {
    if (
      !["x", "z", "yaw"].every(
        (k) => typeof data[k] === "number" && Number.isFinite(data[k]),
      )
    )
      fail("Invalid world position.");
    if (
      data.height !== undefined &&
      (typeof data.height !== "number" || !Number.isFinite(data.height))
    )
      fail("Invalid jump position.");
    const position = {
      height: Math.max(0, Math.min(3, data.height || 0)),
      x: Math.max(-34, Math.min(34, data.x)),
      z: Math.max(-34, Math.min(34, data.z)),
      yaw: Math.atan2(Math.sin(data.yaw), Math.cos(data.yaw)),
    };
    await bucket.put(
      "world-presence/" + profile.publicId,
      JSON.stringify({
        uid,
        publicId: profile.publicId,
        name: profile.name,
        character: profile.character,
        position,
        lastSeen: Date.now(),
      }),
    );
    return json(await worldSnapshot(bucket, uid));
  }
  if (path === "/api/world/chat") {
    const text = String(data.text || "").trim();
    if (!text || text.length > 300)
      fail("Write a message under 300 characters.");
    const chat = await change(bucket, "world-chat", { messages: [] }, (c) => {
      const now = Date.now();
      if (
        c.messages.filter((m) => m.uid === uid && now - m.time < 10000)
          .length >= 5
      )
        fail("Give the plaza a moment before sending another message.", 429);
      c.messages.push({
        id: crypto.randomUUID(),
        uid,
        publicId: profile.publicId,
        name: profile.name,
        text,
        time: now,
      });
      c.messages = c.messages.slice(-50);
      return c;
    });
    return json({
      messages: chat.messages.map(({ uid: owner, ...m }) => ({
        ...m,
        isMe: owner === uid,
      })),
    });
  }
  fail("Not found.", 404);
}

export async function api(request, env) {
  try {
    if (
      new URL(request.url).pathname === "/api/health" &&
      request.method === "GET"
    )
      return json({ storageReady: Boolean(env.BUCKET), version: 2 });
    const uid = request.headers.get("x-focal-user-id");
    if (!uid)
      return json({ error: "Sign in to join shared battle rooms." }, 401);
    const bucket = env.BUCKET;
    if (!bucket)
      return json(
        {
          error:
            "Shared rooms are not available yet. Practice mode is ready to play.",
        },
        503,
      );
    const path = new URL(request.url).pathname,
      method = request.method;
    if (
      method !== "GET" &&
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      fail("Invalid request origin.", 403);
    if (path === "/api/me")
      return json(await read(bucket, "profiles/" + uid, initialProfile()));
    if (path === "/api/profile" && method === "POST") {
      const data = await body(request);
      if (!/^[a-zA-Z0-9_]{1,18}$/.test(data.name || ""))
        fail("Choose a username using letters, numbers or underscores.");
      const update = { name: data.name };
      if (data.bio !== undefined) {
        if (typeof data.bio !== "string" || data.bio.length > 240)
          fail("Keep your bio under 240 characters.");
        update.bio = data.bio;
      }
      if (data.character !== undefined)
        update.character = cleanCharacter(data.character);
      if (data.links !== undefined) update.links = cleanLinks(data.links);
      if (data.onboarded === true) update.onboarded = true;
      const profile = await change(
        bucket,
        "profiles/" + uid,
        initialProfile(),
        (p) => ({
          ...initialProfile(),
          ...p,
          ...update,
          publicId: p.publicId || crypto.randomUUID(),
        }),
      );
      await bucket.put(
        "player-index/" + profile.publicId,
        JSON.stringify({ uid }),
      );
      return json(profile);
    }
    const worldResult = await worldApi(request, bucket, uid, path, method);
    if (worldResult) return worldResult;
    const communityResult = await communityApi(
      request,
      bucket,
      uid,
      path,
      method,
    );
    if (communityResult) return communityResult;
    if (path === "/api/rooms" && method === "GET") {
      const listed = await bucket.list({ prefix: "summaries/", limit: 100 });
      const rooms = await Promise.all(
        listed.objects.map((item) => read(bucket, item.key, null)),
      );
      return json(
        rooms
          .filter(Boolean)
          .filter(
            (r) =>
              r.status !== "finished" || Date.now() - r.finishedAt < 3600000,
          )
          .sort((a, b) => b.created - a.created)
          .slice(0, 40),
      );
    }
    if (path === "/api/rooms" && method === "POST") {
      const data = await body(request);
      const profile = await read(bucket, "profiles/" + uid, initialProfile());
      if (!["existing", "shoot"].includes(data.entryMode))
        fail("Choose your entry mode.");
      if (data.entryMode === "existing" && !validPhoto(data.photo))
        fail("Upload or select your photograph first.");
      const id = crypto.randomUUID();
      const now = Date.now();
      const room = {
        id,
        theme: String(data.theme || "Open perspective").slice(0, 100),
        created: now,
        status: "preparing",
        players: {
          a: {
            uid,
            name: profile.name,
            photo: data.entryMode === "existing" ? data.photo : null,
            deadline: now + FIVE_MINUTES,
          },
          b: null,
        },
        votes: {},
        messages: [
          {
            id: crypto.randomUUID(),
            system: true,
            text: "Room opened. A challenger can join, and spectators can chat.",
            time: now,
          },
        ],
      };
      await bucket.put("rooms/" + id, JSON.stringify(room));
      await summarize(bucket, room);
      return json(publicRoom(room, uid), 201);
    }
    const match = path.match(
      /^\/api\/rooms\/([a-zA-Z0-9-]+)(?:\/(join|submit|chat|vote))?$/,
    );
    if (!match) return json({ error: "Not found" }, 404);
    const [, id, action] = match;
    const key = "rooms/" + id;
    if (method === "GET" && !action) {
      const room = await change(bucket, key, null, (r) => {
        if (!r) fail("Room not found.", 404);
        return normalizeRoom(r);
      });
      await settle(bucket, room);
      await summarize(bucket, room);
      return json(publicRoom(room, uid));
    }
    if (method !== "POST") fail("Method not allowed", 405);
    const data = await body(request);
    const profile = await read(bucket, "profiles/" + uid, initialProfile());
    const room = await change(bucket, key, null, (r) => {
      if (!r) fail("Room not found.", 404);
      normalizeRoom(r);
      const now = Date.now();
      const own = Object.entries(r.players).find(([, p]) => p?.uid === uid);
      if (action === "join") {
        if (r.status === "finished" || r.players.b)
          fail("This room is no longer open for a challenger.", 409);
        if (own) fail("You are already in this battle.");
        if (!["existing", "shoot"].includes(data.entryMode))
          fail("Choose an entry mode.");
        if (data.entryMode === "existing" && !validPhoto(data.photo))
          fail("Choose a photograph first.");
        if (!r.players.a.photo && now >= r.players.a.deadline)
          fail("The host’s shooting window expired. Choose another room.", 409);
        r.players.b = {
          uid,
          name: profile.name,
          photo: data.entryMode === "existing" ? data.photo : null,
          deadline: now + FIVE_MINUTES,
        };
        r.messages.push({
          id: crypto.randomUUID(),
          system: true,
          text: profile.name + " joined the battle.",
          time: now,
        });
      } else if (action === "submit") {
        if (!own) fail("Only participants can submit.", 403);
        if (r.status !== "preparing" || own[1].photo || now >= own[1].deadline)
          fail("The submission window is closed.", 409);
        if (!validPhoto(data.photo)) fail("Choose a valid photograph.");
        own[1].photo = data.photo;
      } else if (action === "chat") {
        const text = String(data.text || "").trim();
        if (!text || text.length > 500)
          fail("Write a message under 500 characters.");
        if (
          r.messages.filter((m) => m.uid === uid && now - m.time < 10000)
            .length >= 5
        )
          fail("Give the room a moment before sending more messages.", 429);
        r.messages.push({
          id: crypto.randomUUID(),
          uid,
          name: profile.name,
          text,
          time: now,
        });
      } else if (action === "vote") {
        if (r.status !== "voting" || now >= r.closesAt)
          fail("Voting is closed.", 409);
        if (own) fail("Players cannot vote in their own battle.", 403);
        if (r.votes[uid]) fail("Your vote is already locked.", 409);
        if (!["a", "b"].includes(data.choice)) fail("Choose A or B.");
        r.votes[uid] = data.choice;
        r.messages.push({
          id: crypto.randomUUID(),
          system: true,
          text: profile.name + " locked in a vote.",
          time: now,
        });
      } else fail("Not found", 404);
      r.messages = r.messages.slice(-200);
      return normalizeRoom(r);
    });
    await settle(bucket, room);
    await summarize(bucket, room);
    return json(publicRoom(room, uid));
  } catch (error) {
    return json(
      {
        error: error.status
          ? error.message
          : "Could not update the room. Please retry.",
      },
      error.status || 500,
    );
  }
}
