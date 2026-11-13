import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  Send,
  Users,
  Clock,
  Swords,
  ImagePlus,
  Copy,
  ArrowLeft,
} from "lucide-react";
import { preparePhoto, useStored } from "./storage.js";
import { rankFor, progression } from "./game.js";
import { accessToken } from "./auth.js";
export async function request(path, method = "GET", body) {
  const token = await accessToken();
  const response = await fetch("/api" + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error(
      "Shared rooms are available on the hosted site. Use Practice Arena locally.",
    );
  }
  if (!response.ok) throw Error(data.error || "Connection interrupted.");
  return data;
}
export function Countdown({ deadline, offset = 0 }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.ceil((deadline - now - offset) / 1000));
  return (
    <span className={"clock " + (left <= 30 ? "urgent" : "")}>
      <Clock size={16} />
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}
export default function LiveRooms({
  uploads,
  setUploads,
  username,
  flash,
  sound,
  celebrate,
}) {
  const [roomId, setRoomId] = useStored(
      "focal_live_room",
      new URLSearchParams(location.search).get("room") || "",
    ),
    [room, setRoom] = useState(null),
    [rooms, setRooms] = useState([]),
    [profile, setProfile] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(""),
    [entryMode, setEntryMode] = useState("existing"),
    [photoId, setPhotoId] = useState(uploads[0]?.id || ""),
    [theme, setTheme] = useState("Light in unexpected places"),
    [offset, setOffset] = useState(0);
  const end = useRef(null),
    seen = useRef(new Set()),
    previousRank = useRef(null);
  useEffect(() => {
    const linked = new URLSearchParams(location.search).get("room");
    if (linked && /^[a-zA-Z0-9-]+$/.test(linked)) setRoomId(linked);
  }, []);
  useEffect(() => {
    let active = true;
    let running = false;
    async function poll() {
      if (running) return;
      running = true;
      try {
        const [me, data] = await Promise.all([
          request("/me"),
          request(roomId ? "/rooms/" + roomId : "/rooms"),
        ]);
        if (active) {
          setProfile(me);
          const nextRank = rankFor(me.wins);
          if (previousRank.current && previousRank.current !== nextRank)
            celebrate(
              nextRank + " unlocked",
              "A community promotion. Your photos earned this.",
            );
          previousRank.current = nextRank;
          if (roomId) {
            setRoom(data);
            setOffset(data.serverNow - Date.now());
            if (data.status === "finished" && !seen.current.has(data.id)) {
              seen.current.add(data.id);
              if (
                Object.entries(data.players).some(
                  ([side, p]) => p?.isMe && side === data.outcome,
                )
              ) {
                celebrate("Battle won", "Your community voted you to victory.");
                sound("win");
              }
            }
          } else {
            setRooms(data);
            setRoom(null);
          }
          setError("");
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        running = false;
      }
    }
    poll();
    const timer = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [roomId]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [room?.messages.length]);
  const myEntry = room && Object.entries(room.players).find(([, p]) => p?.isMe);
  const participant = Boolean(myEntry);
  const chosen = uploads.find((p) => p.id === photoId);
  async function act(path, data) {
    if (busy) return;
    setBusy(true);
    try {
      await request("/profile", "POST", { name: username || "you" });
      const result = await request(path, "POST", data);
      setRoom(result);
      if (result.id) setRoomId(result.id);
      setError("");
      return result;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function entryData() {
    if (entryMode === "existing" && !chosen) {
      setError("Select an existing photo or upload one first.");
      return null;
    }
    return {
      entryMode,
      photo: chosen ? { name: chosen.name, url: chosen.url } : undefined,
    };
  }
  async function addFile(e, submit = false) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const photo = await preparePhoto(file);
      setUploads((prev) => [photo, ...prev].slice(0, 8));
      setPhotoId(photo.id);
      if (submit) {
        const result = await request("/rooms/" + roomId + "/submit", "POST", {
          photo: { name: photo.name, url: photo.url },
        });
        setRoom(result);
      } else flash("Photo added. Previously taken photos are welcome.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const entryPicker = (
    <div className="entry-picker">
      <div className="modegrid">
        <button
          className={"mode " + (entryMode === "existing" ? "chosen" : "")}
          onClick={() => setEntryMode("existing")}
        >
          <ImagePlus />
          <strong>Use an existing photo</strong>
          <span>
            Choose any shot from your library. Older photos are welcome.
          </span>
        </button>
        <button
          className={"mode " + (entryMode === "shoot" ? "chosen" : "")}
          onClick={() => setEntryMode("shoot")}
        >
          <Camera />
          <strong>Shoot it now</strong>
          <span>You have 5 minutes to capture and submit your frame.</span>
        </button>
      </div>
      {entryMode === "existing" && (
        <>
          <label className="fieldlabel" htmlFor="livePhoto">
            Your photo library
          </label>
          <select
            id="livePhoto"
            value={photoId}
            onChange={(e) => setPhotoId(e.target.value)}
          >
            <option value="">Select a photograph</option>
            {uploads.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {chosen && (
            <img className="entry-thumb" src={chosen.url} alt={chosen.name} />
          )}
          <label className="uploadbtn">
            <ImagePlus size={16} /> Add a photo you already took
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => addFile(e)}
              disabled={busy}
            />
          </label>
        </>
      )}
    </div>
  );
  const leave = () => {
    setRoomId("");
    setRoom(null);
    const url = new URL(location.href);
    url.searchParams.delete("room");
    history.replaceState(null, "", url);
  };
  return (
    <section>
      <div className="pageintro">
        <span className="eyebrow">
          <span className="live-dot" /> COMMUNITY BATTLE ROOMS
        </span>
        <h1>
          Every frame.
          <br />
          <em>A live conversation.</em>
        </h1>
        <p>Two photographers. One theme. A room full of perspectives.</p>
      </div>
      {error && (
        <div role="alert" className="notice">
          {error}
        </div>
      )}
      {profile && (
        <div className="online-career">
          <strong>Community career · {rankFor(profile.wins)}</strong>
          <span>
            {profile.wins} wins · {profile.losses} losses
          </span>
          <progress
            aria-label="Community tier progress"
            max="100"
            value={progression(profile.wins).percent}
          />
          <small>
            Community wins are verified on the server, separate from practice.
          </small>
        </div>
      )}
      {!roomId ? (
        <>
          <div className="room-intro">
            <div>
              <h2>Open a battle room</h2>
              <p>
                Invite a challenger and spectators. Voting lasts 90 seconds once
                both photos are submitted. Chat stays open throughout.
              </p>
            </div>
            <span className="pill">REAL VOTES · REAL CHAT</span>
          </div>
          <div className="battle-settings">
            <label className="fieldlabel" htmlFor="liveTheme">
              Your creative prompt
            </label>
            <input
              className="focal-input"
              id="liveTheme"
              maxLength={100}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
            {entryPicker}
            <button
              className="primary big"
              disabled={busy || !theme.trim()}
              onClick={() => {
                const data = entryData();
                if (data) act("/rooms", { ...data, theme });
              }}
            >
              <Swords size={18} /> {busy ? "OPENING…" : "OPEN BATTLE ROOM"}
            </button>
            <p className="fineprint">
              The five-minute shooting clock starts when you open or join a
              room. No live players? Try Practice Arena.
            </p>
          </div>
          <div className="sectionhead">
            <h2>In the arena</h2>
            <span>{rooms.length} rooms</span>
          </div>
          <div className="room-grid">
            {rooms.length ? (
              rooms.map((r) => (
                <button
                  className="room-card"
                  key={r.id}
                  onClick={() => setRoomId(r.id)}
                >
                  <span className="pill">
                    {r.status === "voting"
                      ? "● VOTING LIVE"
                      : r.status === "finished"
                        ? "FINISHED"
                        : r.players.b
                          ? "PREPARING"
                          : "CHALLENGER WANTED"}
                  </span>
                  <h3>{r.theme}</h3>
                  <p>
                    {r.players.a.name} vs {r.players.b?.name || "you?"}
                  </p>
                  <span>Enter room →</span>
                </button>
              ))
            ) : (
              <div className="empty">
                <Users />
                <h3>The arena is yours.</h3>
                <p>Open the first room and invite a challenger.</p>
              </div>
            )}
          </div>
        </>
      ) : room ? (
        <>
          <div className="room-toolbar">
            <button className="back" onClick={leave}>
              <ArrowLeft size={16} /> All rooms
            </button>
            <button
              className="back"
              onClick={async () => {
                const url = new URL(location.href);
                url.searchParams.delete("chat");
                url.searchParams.set("room", room.id);
                try {
                  await navigator.clipboard.writeText(url.href);
                  flash(
                    "Room link copied. Anyone with the link can visit; sign in to join.",
                  );
                } catch {
                  flash(url.href);
                }
              }}
            >
              <Copy size={16} /> Copy room link
            </button>
            <span className="pill">{room.status.toUpperCase()}</span>
          </div>
          <h2>{room.theme}</h2>
          <div className="live-layout">
            <div>
              <div className="room-photos">
                {["a", "b"].map((side) => {
                  const p = room.players[side];
                  return (
                    <article
                      key={side}
                      className={
                        "live-entry " + (room.outcome === side ? "victor" : "")
                      }
                    >
                      <div className="entry-image">
                        {p?.photo ? (
                          <img src={p.photo.url} alt={p.photo.name} />
                        ) : (
                          <div className="entry-wait">
                            <Camera size={40} />
                            <strong>
                              {p
                                ? "Out chasing a frame"
                                : "Waiting for a challenger"}
                            </strong>
                            {p && !p.photo && (
                              <Countdown
                                deadline={p.deadline}
                                offset={offset}
                              />
                            )}
                          </div>
                        )}
                        <span className="entry-letter">
                          {side.toUpperCase()}
                        </span>
                      </div>
                      <div className="photofooter">
                        <strong>
                          {p?.name || "Open slot"}
                          {p?.isMe ? " · YOU" : ""}
                        </strong>
                        <span>{room.counts[side]} votes</span>
                      </div>
                      {room.status === "voting" && !participant && (
                        <button
                          className="primary"
                          disabled={Boolean(room.myVote) || busy}
                          onClick={() => {
                            sound("vote");
                            act("/rooms/" + roomId + "/vote", { choice: side });
                          }}
                        >
                          {room.myVote === side
                            ? "VOTE LOCKED ✓"
                            : "VOTE " + side.toUpperCase()}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              {room.status === "voting" && (
                <div className="voting-banner">
                  <span>
                    <span className="live-dot" /> VOTING IS LIVE
                  </span>
                  <Countdown deadline={room.closesAt} offset={offset} />
                  <p>
                    {participant
                      ? "Your photos are in the spotlight. Spectators decide the winner."
                      : room.myVote
                        ? "Your vote is locked. Stay for the reveal."
                        : "Pick a frame, lock your vote, and join the conversation."}
                  </p>
                </div>
              )}
              {room.status === "finished" && (
                <div className="result">
                  <div>
                    <h2>
                      {room.outcome === "draw"
                        ? "An even match."
                        : room.outcome === "expired"
                          ? "Room expired."
                          : `${room.players[room.outcome]?.name} wins!`}
                    </h2>
                    <p>
                      {room.reason || "This room is closed."} · {room.counts.a}–
                      {room.counts.b} votes
                    </p>
                  </div>
                </div>
              )}
              {myEntry &&
                !myEntry[1].photo &&
                room.status === "preparing" &&
                Date.now() + offset < myEntry[1].deadline && (
                  <div className="capture-panel">
                    <h3>Your five-minute photo mission</h3>
                    <p>
                      Capture your interpretation of “{room.theme}”. Upload
                      before the countdown reaches zero.
                    </p>
                    <Countdown deadline={myEntry[1].deadline} offset={offset} />
                    <label className="uploadbtn">
                      <Camera size={17} /> Capture or upload your frame
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        hidden
                        disabled={busy}
                        onChange={(e) => addFile(e, true)}
                      />
                    </label>
                    <label className="uploadbtn secondary">
                      Choose from files
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        disabled={busy}
                        onChange={(e) => addFile(e, true)}
                      />
                    </label>
                    <select
                      aria-label="Submit a library photo"
                      value={photoId}
                      onChange={(e) => setPhotoId(e.target.value)}
                    >
                      <option value="">Or choose a library photo</option>
                      {uploads.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="primary"
                      disabled={!chosen || busy}
                      onClick={() =>
                        act("/rooms/" + roomId + "/submit", {
                          photo: { name: chosen.name, url: chosen.url },
                        })
                      }
                    >
                      SUBMIT SELECTED PHOTO
                    </button>
                  </div>
                )}
              {!room.players.b &&
                !participant &&
                room.status !== "finished" && (
                  <div className="battle-settings">
                    <h3>Take the challenger slot</h3>
                    {entryPicker}
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => {
                        const data = entryData();
                        if (data) act("/rooms/" + roomId + "/join", data);
                      }}
                    >
                      JOIN THIS BATTLE
                    </button>
                  </div>
                )}
            </div>
            <aside className="battle-chat">
              <div className="chathead">
                <strong>
                  <span className="live-dot" /> Battle chat
                </strong>
                <small>Shared room · refreshes every 2.5 seconds</small>
              </div>
              <div
                className="live-messages"
                aria-live="polite"
                aria-relevant="additions"
              >
                {room.messages.map((m) => (
                  <div
                    key={m.id}
                    className={m.system ? "system-message" : "room-message"}
                  >
                    {!m.system && (
                      <strong>
                        {m.name}
                        {m.isMe ? " (you)" : ""}
                      </strong>
                    )}
                    <p>{m.text}</p>
                    <time>
                      {new Date(m.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                ))}
                <div ref={end} />
              </div>
              <form
                className="chatinput"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!draft.trim()) return;
                  const done = await act("/rooms/" + roomId + "/chat", {
                    text: draft.trim(),
                  });
                  if (done) setDraft("");
                }}
              >
                <input
                  aria-label="Battle chat message"
                  maxLength={500}
                  placeholder="React to the frames…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  aria-label="Send battle chat message"
                  disabled={busy || !draft.trim()}
                >
                  <Send size={18} />
                </button>
              </form>
              <small className="chat-caption">
                Participants chat. Spectators vote. One vote per person.
              </small>
            </aside>
          </div>
        </>
      ) : (
        <div className="empty">
          <p>Connecting to the room…</p>
          <button className="back" onClick={leave}>
            Return to all rooms
          </button>
        </div>
      )}
    </section>
  );
}
