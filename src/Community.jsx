import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  MessageCircle,
  Send,
  Plus,
  ArrowLeft,
  Copy,
  Users,
  ExternalLink,
} from "lucide-react";
import { request } from "./LiveRooms.jsx";
import { preparePhoto, useStored } from "./storage.js";
import { rankFor } from "./game.js";
import { useModalKeyboard } from "./Immersion.jsx";
export const defaultCharacter = {
  skin: "#c98f6a",
  hair: "#302538",
  outfit: "#ac8ae8",
  background: "#342241",
  style: "curly",
  accessory: "camera",
};
export function Character({ value = {}, label = "Player character" }) {
  const c = { ...defaultCharacter, ...value };
  return (
    <svg
      className="player-character"
      viewBox="0 0 160 160"
      role="img"
      aria-label={label}
    >
      <rect width="160" height="160" rx="32" fill={c.background} />
      <circle cx="80" cy="77" r="55" fill="#ffffff08" />
      <path d="M29 160v-15q0-35 51-35t51 35v15" fill={c.outfit} />
      <path d="M67 103v16q13 13 26 0v-16" fill={c.skin} />
      {c.style === "long" && (
        <path d="M43 59q0-43 38-43t37 43v65H43" fill={c.hair} />
      )}
      <ellipse cx="80" cy="68" rx="33" ry="42" fill={c.skin} />
      <ellipse cx="47" cy="76" rx="6" ry="11" fill={c.skin} />
      <ellipse cx="113" cy="76" rx="6" ry="11" fill={c.skin} />
      {c.style === "curly" ? (
        <g fill={c.hair}>
          {[
            [51, 40],
            [64, 28],
            [81, 25],
            [98, 29],
            [111, 41],
            [50, 55],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="15" />
          ))}
        </g>
      ) : (
        <path
          d="M46 63q-8-43 30-45 45-1 39 43-20-4-27-25-7 20-42 27"
          fill={c.hair}
        />
      )}
      <circle cx="66" cy="73" r="3" fill="#302034" />
      <circle cx="94" cy="73" r="3" fill="#302034" />
      <path
        d="M70 91q10 8 20 0"
        fill="none"
        stroke="#6d3c40"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {c.accessory === "camera" && (
        <g>
          <path d="M58 117l8 20m36-20-8 20" stroke="#241a2b" strokeWidth="5" />
          <rect x="58" y="130" width="44" height="27" rx="5" fill="#292136" />
          <circle cx="81" cy="143" r="10" fill="#6a5c89" />
          <circle cx="81" cy="143" r="6" fill="#191323" />
          <rect x="64" y="127" width="11" height="5" rx="2" fill="#493d5a" />
        </g>
      )}
      {c.accessory === "headphones" && (
        <g fill="none" stroke="#b9b5c2" strokeWidth="7">
          <path d="M43 77V58a37 37 0 0174 0v19" />
          <path d="M42 64v20m76-20v20" stroke="#4b3a60" strokeWidth="12" />
        </g>
      )}
      {c.accessory === "cap" && (
        <g fill={c.outfit}>
          <path d="M42 47q0-33 38-33t38 33z" />
          <path d="M38 46h91q7 11-13 13H45z" />
        </g>
      )}
    </svg>
  );
}
export function PlayerAccount({
  onSaved,
  onClose,
  initial = null,
  onSignOut,
  required = false,
}) {
  const [profile, setProfile] = useState(initial),
    [name, setName] = useState(initial?.name || ""),
    [bio, setBio] = useState(initial?.bio || ""),
    [character, setCharacter] = useState({
      ...defaultCharacter,
      ...initial?.character,
    }),
    [links, setLinks] = useState(initial?.links || {}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [signingOut, setSigningOut] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    let active = true;
    if (!initial)
      request("/me")
        .then((p) => {
          if (active) {
            setProfile(p);
            setName(p.name === "Photographer" ? "" : p.name);
            setBio(p.bio || "");
            setCharacter({ ...defaultCharacter, ...p.character });
            setLinks(p.links || {});
          }
        })
        .catch((e) => active && setError(e.message));
    const before = document.activeElement;
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = [
          ...root.current.querySelectorAll(
            "input,select,textarea,button,a[href]",
          ),
        ].filter((el) => !el.disabled && el.getClientRects().length);
        if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          list.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
          e.preventDefault();
          list[0]?.focus();
        }
      }
    };
    root.current?.addEventListener("keydown", key);
    root.current?.querySelector("button")?.focus();
    return () => {
      active = false;
      root.current?.removeEventListener("keydown", key);
      before?.focus?.();
    };
  }, []);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await request("/profile", "POST", {
        name,
        bio,
        character,
        links,
        onboarded: true,
      });
      onSaved(p);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function handleSignOut() {
    if (busy || signingOut) return;
    setSigningOut(true);
    setError("");
    try {
      await onSignOut();
    } catch (e) {
      setError(e.message || "Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        ref={root}
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accountTitle"
      >
        {!required && (
          <button
            className="close-modal"
            aria-label="Close player signup"
            onClick={onClose}
          >
            ×
          </button>
        )}
        <span className="eyebrow">YOUR PLACE IN THE CREATIVE WORLD</span>
        <h2 id="accountTitle">
          {profile?.onboarded
            ? "Your player. Your personality."
            : "Create your FOCAL player."}
        </h2>
        <p>
          Create your character and choose what other players see. Your profile
          is linked to your FOCAL account.
        </p>
        <form onSubmit={save}>
          <div className="character-builder">
            <div className="character-preview">
              <Character value={character} />
              <strong>@{name || "yourname"}</strong>
              <span>{bio || "Every photographer has a story."}</span>
            </div>
            <div>
              <label htmlFor="playerName">Player name</label>
              <input
                id="playerName"
                className="focal-input"
                required
                pattern="[A-Za-z0-9_]{1,18}"
                maxLength={18}
                autoComplete="nickname"
                value={name}
                placeholder="Your creative handle"
                onChange={(e) =>
                  setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))
                }
              />
              <label htmlFor="playerBio">Your bio</label>
              <textarea
                id="playerBio"
                maxLength={240}
                placeholder="What do you love to shoot?"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
              <div className="color-options">
                {[
                  ["skin", "Skin"],
                  ["hair", "Hair"],
                  ["outfit", "Outfit"],
                  ["background", "Backdrop"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      aria-label={label + " color"}
                      type="color"
                      value={character[key]}
                      onChange={(e) =>
                        setCharacter((c) => ({ ...c, [key]: e.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="character-selects">
                <label>
                  Hair style
                  <select
                    aria-label="Character hair style"
                    value={character.style}
                    onChange={(e) =>
                      setCharacter((c) => ({ ...c, style: e.target.value }))
                    }
                  >
                    <option value="curly">Curly</option>
                    <option value="crop">Cropped</option>
                    <option value="long">Long</option>
                  </select>
                </label>
                <label>
                  Your accessory
                  <select
                    aria-label="Character accessory"
                    value={character.accessory}
                    onChange={(e) =>
                      setCharacter((c) => ({ ...c, accessory: e.target.value }))
                    }
                  >
                    <option value="camera">Camera</option>
                    <option value="headphones">Headphones</option>
                    <option value="cap">Cap</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
          <div className="social-editor">
            <h3>Let people find your work.</h3>
            <p>
              Add optional social links. They’ll appear on your player card
              inside this site.
            </p>
            <div>
              {[
                ["instagram", "Instagram"],
                ["tiktok", "TikTok"],
                ["youtube", "YouTube"],
                ["website", "Portfolio / website"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="url"
                    placeholder="https://"
                    value={links[key] || ""}
                    onChange={(e) =>
                      setLinks((l) => ({ ...l, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          {error && (
            <div role="alert" className="notice">
              {error}
            </div>
          )}
          <div className="signup-actions">
            <button
              type="submit"
              className="primary big"
              disabled={busy || signingOut}
            >
              {busy
                ? "SAVING…"
                : profile?.onboarded
                  ? "SAVE MY PLAYER"
                  : "CREATE MY PLAYER →"}
            </button>
            {!required && (
              <button type="button" className="back" onClick={onClose}>
                Close
              </button>
            )}
            {onSignOut && (
              <button
                type="button"
                className="back"
                onClick={handleSignOut}
                disabled={busy || signingOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
export function PlayerCard({ id, onClose }) {
  useModalKeyboard(onClose);
  const [profile, setProfile] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request("/players/" + id)
      .then((p) => active && setProfile(p))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <div className="modal-backdrop">
      <section
        className="member-card"
        role="dialog"
        aria-modal="true"
        aria-label="Player profile"
      >
        <button
          className="close-modal"
          aria-label="Close player profile"
          onClick={onClose}
        >
          ×
        </button>
        {profile ? (
          <>
            <Character
              value={profile.character}
              label={profile.name + " character"}
            />
            <h2>@{profile.name}</h2>
            <span className="pill">
              {rankFor(profile.wins)} · {profile.wins} community wins
            </span>
            <p>{profile.bio || "A new perspective in the arena."}</p>
            <div className="social-links">
              {Object.entries(profile.links).map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {label}
                  <ExternalLink size={14} />
                </a>
              ))}
            </div>
          </>
        ) : (
          <p>{error || "Loading player…"}</p>
        )}
      </section>
    </div>
  );
}
export default function ChatRooms({
  uploads,
  setUploads,
  username,
  flash,
  onAccount,
}) {
  const [groups, setGroups] = useState([]),
    [groupId, setGroupId] = useStored(
      "focal_community_room",
      new URLSearchParams(location.search).get("chat") || "",
    ),
    [group, setGroup] = useState(null),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [topic, setTopic] = useState(""),
    [kind, setKind] = useState("feedback"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(""),
    [photoId, setPhotoId] = useState(""),
    [reply, setReply] = useState(null),
    [player, setPlayer] = useState(null);
  const end = useRef(null);
  useEffect(() => {
    const linked = new URLSearchParams(location.search).get("chat");
    if (linked && /^[a-zA-Z0-9-]+$/.test(linked)) setGroupId(linked);
  }, []);
  useEffect(() => {
    let active = true,
      running = false;
    async function poll() {
      if (running) return;
      running = true;
      try {
        const data = await request(groupId ? "/groups/" + groupId : "/groups");
        if (active) {
          if (groupId) setGroup(data);
          else {
            setGroups(data);
            setGroup(null);
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
    const timer = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [groupId]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [group?.messages.length]);
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await request("/profile", "POST", { name: username || "you" });
      const g = await request("/groups", "POST", { name, topic, kind });
      setGroup(g);
      setGroupId(g.id);
      setCreating(false);
      setName("");
      setTopic("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function addPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const photo = await preparePhoto(file);
      setUploads((prev) => [photo, ...prev].slice(0, 8));
      setPhotoId(photo.id);
      flash("Photo ready to share for feedback.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function send(e) {
    e.preventDefault();
    if (!draft.trim() && !photoId) return;
    setBusy(true);
    try {
      await request("/profile", "POST", { name: username || "you" });
      let photo;
      const chosen = uploads.find((p) => p.id === photoId);
      if (chosen)
        photo = await request("/community-photos", "POST", {
          photo: { name: chosen.name, url: chosen.url },
        });
      const g = await request("/groups/" + groupId + "/messages", "POST", {
        text: draft.trim(),
        photo,
        replyTo: reply?.id,
      });
      setGroup(g);
      setDraft("");
      setPhotoId("");
      setReply(null);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="pageintro">
        <span className="eyebrow">
          <MessageCircle size={15} /> CONVERSATIONS THAT MAKE YOU BETTER
        </span>
        <h1>
          Find your people.
          <br />
          <em>Share your perspective.</em>
        </h1>
        <p>
          Create a room for anything you love. Share a frame, ask for feedback,
          and help someone see a little differently.
        </p>
      </div>
      <div className="community-actions">
        <button
          className="primary"
          onClick={() => {
            setCreating((v) => !v);
            setGroupId("");
            setGroup(null);
          }}
        >
          <Plus size={17} /> CREATE A CHAT ROOM
        </button>
        <button className="back" onClick={onAccount}>
          <Users size={16} /> YOUR CHARACTER & SOCIAL LINKS
        </button>
      </div>
      {error && (
        <div role="alert" className="notice">
          {error}
        </div>
      )}
      {creating && (
        <form className="create-chat" onSubmit={create}>
          <h2>A room for your kind of conversation.</h2>
          <label htmlFor="roomName">Room name</label>
          <input
            id="roomName"
            className="focal-input"
            minLength={2}
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Honest feedback club"
            required
          />
          <label htmlFor="roomTopic">What’s it about?</label>
          <input
            id="roomTopic"
            className="focal-input"
            maxLength={160}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="A welcoming place to talk about…"
          />
          <div className="modegrid">
            <button
              type="button"
              className={"mode " + (kind === "feedback" ? "chosen" : "")}
              onClick={() => setKind("feedback")}
            >
              <strong>📷 Photo feedback</strong>
              <span>Share photographs and offer constructive critique.</span>
            </button>
            <button
              type="button"
              className={"mode " + (kind === "general" ? "chosen" : "")}
              onClick={() => setKind("general")}
            >
              <strong>💬 Anything goes</strong>
              <span>Gear, editing, everyday life, and everything between.</span>
            </button>
          </div>
          <button className="primary" disabled={busy}>
            OPEN ROOM →
          </button>
        </form>
      )}
      {!groupId ? (
        <>
          <div className="sectionhead">
            <h2>Community rooms</h2>
            <span>{groups.length} conversations</span>
          </div>
          <div className="room-grid">
            {groups.map((g) => (
              <button
                key={g.id}
                className="room-card"
                onClick={() => {
                  setGroupId(g.id);
                  setCreating(false);
                }}
              >
                <span className="pill">
                  {g.kind === "feedback"
                    ? "PHOTO FEEDBACK"
                    : "OPEN CONVERSATION"}
                </span>
                <h3>{g.name}</h3>
                <p>{g.topic || "All perspectives welcome."}</p>
                <small>
                  Created by {g.host} · {g.messages} messages
                </small>
                <span>Join the conversation →</span>
              </button>
            ))}
          </div>
          {!groups.length && (
            <div className="empty">
              <MessageCircle />
              <h3>Make the first connection.</h3>
              <p>
                Start a chat room about photography, feedback, or anything on
                your mind.
              </p>
            </div>
          )}
        </>
      ) : group ? (
        <>
          <div className="room-toolbar">
            <button
              className="back"
              onClick={() => {
                setGroupId("");
                setGroup(null);
                setReply(null);
                const url = new URL(location.href);
                url.searchParams.delete("chat");
                history.replaceState(null, "", url);
              }}
            >
              <ArrowLeft size={16} /> All chat rooms
            </button>
            <button
              className="back"
              onClick={async () => {
                const url = new URL(location.href);
                url.searchParams.delete("room");
                url.searchParams.set("chat", group.id);
                try {
                  await navigator.clipboard.writeText(url.href);
                  flash(
                    "Chat room link copied. Sign in to join the conversation.",
                  );
                } catch {
                  flash(url.href);
                }
              }}
            >
              <Copy size={16} /> Copy room link
            </button>
          </div>
          <section className="community-room">
            <div className="community-room-header">
              <div>
                <span className="pill">
                  {group.kind === "feedback"
                    ? "PHOTO FEEDBACK ROOM"
                    : "OPEN CONVERSATION"}
                </span>
                <h2>{group.name}</h2>
                <p>{group.topic || "Every perspective is welcome."}</p>
              </div>
              <span className="live-dot" />
            </div>
            {group.kind === "feedback" && (
              <div className="feedback-guide">
                <strong>Good feedback helps a photographer grow.</strong>
                <p>
                  Name something that works. Suggest one specific thing to try.
                  Be thoughtful about the person behind the frame.
                </p>
              </div>
            )}
            <div
              className="community-messages"
              aria-live="polite"
              aria-relevant="additions"
            >
              {!group.messages.length && (
                <div className="empty">
                  <Camera />
                  <h3>Break the ice.</h3>
                  <p>
                    {group.kind === "feedback"
                      ? "Share a photograph and tell the room what you’d like feedback on."
                      : "Say hello or start a conversation."}
                  </p>
                </div>
              )}
              {group.messages.map((m) => {
                const parent = group.messages.find((p) => p.id === m.replyTo);
                return (
                  <article className="community-message" key={m.id}>
                    <button
                      className="character-link"
                      aria-label={"View " + m.name + " profile"}
                      onClick={() =>
                        m.publicId
                          ? setPlayer(m.publicId)
                          : flash(
                              "This player has not finished their profile yet.",
                            )
                      }
                    >
                      <Character value={m.character || {}} />
                    </button>
                    <div>
                      <div className="community-message-meta">
                        <button
                          onClick={() => m.publicId && setPlayer(m.publicId)}
                        >
                          @{m.name}
                          {m.isMe ? " · YOU" : ""}
                        </button>
                        <time>
                          {new Date(m.time).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      {parent && (
                        <blockquote>
                          Replying to @{parent.name}:{" "}
                          {parent.text.slice(0, 110) || parent.photo?.name}
                        </blockquote>
                      )}
                      {m.photo && (
                        <a
                          href={m.photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            className="feedback-photo"
                            src={m.photo.url}
                            alt={m.photo.name}
                          />
                        </a>
                      )}
                      <p>{m.text}</p>
                      <button
                        className="text-reply"
                        onClick={() => {
                          setReply(m);
                          document.getElementById("communityDraft")?.focus();
                        }}
                      >
                        {group.kind === "feedback" ? "Give feedback" : "Reply"}{" "}
                        →
                      </button>
                    </div>
                  </article>
                );
              })}
              <div ref={end} />
            </div>
            <form className="community-composer" onSubmit={send}>
              {reply && (
                <div className="reply-banner">
                  Replying to @{reply.name}
                  <button
                    type="button"
                    aria-label="Cancel reply"
                    onClick={() => setReply(null)}
                  >
                    ×
                  </button>
                </div>
              )}
              {group.kind === "feedback" && (
                <div className="feedback-prompts">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => d + (d ? "\n" : "") + "What works: ")
                    }
                  >
                    ＋ What works
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => d + (d ? "\n" : "") + "Try this: ")
                    }
                  >
                    ＋ A suggestion
                  </button>
                </div>
              )}
              <textarea
                id="communityDraft"
                aria-label="Community message"
                maxLength={1000}
                placeholder={
                  group.kind === "feedback"
                    ? "Share your frame, ask a question, or give constructive feedback…"
                    : "What’s on your mind?"
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="composer-tools">
                <label className="uploadbtn secondary">
                  <ImagePlus size={16} /> ADD A PHOTO
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={busy}
                    onChange={addPhoto}
                  />
                </label>
                <select
                  aria-label="Share a photo from your library"
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
                  disabled={busy || (!draft.trim() && !photoId)}
                >
                  <Send size={16} />
                  {busy ? "SENDING…" : "SEND"}
                </button>
              </div>
              <small>
                Shared with players who can access this site · updates every 3
                seconds
              </small>
            </form>
          </section>
        </>
      ) : (
        <div className="empty">
          <p>Joining the conversation…</p>
          <button className="back" onClick={() => setGroupId("")}>
            Back to rooms
          </button>
        </div>
      )}
      {player && <PlayerCard id={player} onClose={() => setPlayer(null)} />}
    </section>
  );
}
