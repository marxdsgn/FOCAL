import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  Clock,
  ImagePlus,
  Send,
  Star,
  ArrowLeft,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Countdown } from "./LiveRooms.jsx";
import { useStored, preparePhoto } from "./storage.js";
export function useModalKeyboard(onClose) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement;
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    const dialog = dialogs.at(-1);
    if (!dialog) return;
    const focusable = () =>
      [
        ...dialog.querySelectorAll(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
    focusable()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const list = focusable();
        if (!list.length) {
          e.preventDefault();
          return;
        }
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    dialog.addEventListener("keydown", key);
    return () => {
      dialog.removeEventListener("keydown", key);
      before?.focus?.();
    };
  }, []);
}
export const missions = [
  {
    id: "ordinary",
    title: "Extraordinary ordinary",
    prompt: "Find beauty in an ordinary object. Make us look twice.",
    category: "Open",
    tag: "DAILY INSPIRATION",
    titleReward: "Everyday Alchemist",
    image: "./photos/sample-2.jpg",
  },
  {
    id: "motion",
    title: "Life in motion",
    prompt:
      "Capture movement: a passing cyclist, flowing water, or a busy street.",
    category: "Street",
    tag: "CREATIVE MISSION",
    titleReward: "Motion Seeker",
    image: "./photos/street-1.jpg",
  },
  {
    id: "quiet",
    title: "The quiet between",
    prompt: "Find a moment of stillness in a landscape or your neighborhood.",
    category: "Landscape",
    tag: "CREATIVE MISSION",
    titleReward: "Quiet Observer",
    image: "./photos/sample-3.jpg",
  },
  {
    id: "night",
    title: "After the light fades",
    prompt:
      "Make a photograph after dark. Follow a glow, a shadow, or a reflection.",
    category: "Street",
    tag: "CREATIVE MISSION",
    titleReward: "Night Owl",
    image: "./photos/street-0.jpg",
  },
  {
    id: "nature",
    title: "Small worlds",
    prompt: "Look closely. Frame a tiny detail from the natural world.",
    category: "Nature",
    tag: "CREATIVE MISSION",
    titleReward: "Detail Hunter",
    image: "./photos/sample-5.jpg",
  },
];
export function weeklyMission(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const n = (k) => Number(parts.find((p) => p.type === k).value);
  const day = new Date(Date.UTC(n("year"), n("month") - 1, n("day")));
  const week = Math.floor(
    (day.getTime() - ((day.getUTCDay() + 6) % 7) * 86400000) / 604800000,
  );
  const selected =
    missions[((week % missions.length) + missions.length) % missions.length];
  return {
    ...selected,
    id: "weekly-" + week,
    tag: "THIS WEEK’S FEATURE",
    weekly: true,
    titleReward: "Weekly Explorer",
  };
}
export function MissionBoard({ completed, onEnter, compact = false }) {
  const weekly = weeklyMission();
  return (
    <section className="missions">
      <div className="sectionhead">
        <div>
          <span className="eyebrow">A REASON TO PICK UP YOUR CAMERA</span>
          <h2>
            {compact ? "Your next story starts here." : "Creative missions"}
          </h2>
        </div>
        <span>{completed.length} missions completed</span>
      </div>
      <article className="weekly-feature">
        <img src={weekly.image} alt="Weekly photographic inspiration" />
        <div>
          <span className="pill">{weekly.tag}</span>
          <h2>{weekly.title}</h2>
          <p>{weekly.prompt}</p>
          <button className="primary" onClick={() => onEnter(weekly)}>
            TAKE THE CHALLENGE →
          </button>
          <small>Weekly theme changes Monday · Eastern Time</small>
        </div>
      </article>
      {!compact && (
        <div className="mission-grid">
          {missions.map((m) => (
            <article className="mission-card" key={m.id}>
              <img src={m.image} alt={m.title} />
              <div>
                <span className="eyebrow">
                  {completed.includes(m.id) ? "COMPLETED ✓" : m.tag}
                </span>
                <h3>{m.title}</h3>
                <p>{m.prompt}</p>
                <span className="reward">✦ Unlock “{m.titleReward}”</span>
                <button className="primary" onClick={() => onEnter(m)}>
                  {completed.includes(m.id) ? "SHOOT AGAIN" : "ACCEPT MISSION"}{" "}
                  →
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
export function MissionEntry({
  mission,
  uploads,
  onExisting,
  onCapture,
  onClose,
  onAdd,
  busy,
}) {
  useModalKeyboard(onClose);
  const [selected, setSelected] = useState(uploads[0]?.id || "");
  useEffect(() => {
    if (!selected && uploads[0]) setSelected(uploads[0].id);
  }, [uploads]);
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="missionTitle"
        className="mission-modal"
      >
        <button
          className="close-modal"
          aria-label="Close mission"
          onClick={onClose}
        >
          ×
        </button>
        <span className="eyebrow">YOUR CREATIVE BRIEF</span>
        <h2 id="missionTitle">{mission.title}</h2>
        <p>{mission.prompt}</p>
        <div className="entry-options">
          <div>
            <ImagePlus />
            <h3>Already have the shot?</h3>
            <p>
              Photos you’ve taken before are welcome. Choose one from your
              library or add an existing photo.
            </p>
            <select
              aria-label="Mission library photo"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select a photograph</option>
              {uploads.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="uploadbtn">
              ADD AN EXISTING PHOTO
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={busy}
                onChange={onAdd}
              />
            </label>
            <button
              className="primary"
              disabled={!selected || busy}
              onClick={() =>
                onExisting(
                  uploads.find((p) => p.id === selected),
                  mission,
                )
              }
            >
              USE THIS PHOTO
            </button>
          </div>
          <div>
            <Camera />
            <h3>Go find your frame.</h3>
            <p>
              No photo yet? Start a five-minute photo hunt, capture your
              interpretation, and upload it before time runs out.
            </p>
            <span className="time-big">05:00</span>
            <button className="primary" onClick={() => onCapture(mission)}>
              START FIVE-MINUTE HUNT
            </button>
          </div>
        </div>
        <p className="fineprint">
          Missions lead into practice matches. Choose Live Rooms for real
          players, chat, and votes.
        </p>
      </section>
    </div>
  );
}
export function PhotoHunt({ hunt, onSubmit, onCancel, uploads }) {
  useModalKeyboard(onCancel);
  const [now, setNow] = useState(Date.now()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState("");
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const expired = now >= hunt.deadline;
  async function load(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const p = await preparePhoto(file);
      if (Date.now() >= hunt.deadline)
        throw Error(
          "The five-minute window has ended. Start a new hunt to try again.",
        );
      onSubmit(p, hunt.mission);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="huntTitle"
        className="mission-modal hunt-modal"
      >
        <span className="eyebrow">FIVE MINUTES. YOUR PERSPECTIVE.</span>
        <h2 id="huntTitle">{hunt.mission.title}</h2>
        <p>{hunt.mission.prompt}</p>
        <Countdown deadline={hunt.deadline} />
        <progress
          max="300000"
          value={Math.max(0, hunt.deadline - now)}
          aria-label="Photo hunt time remaining"
        />
        {expired ? (
          <div role="alert">
            <h3>Time’s up. Your next frame is waiting.</h3>
            <p>
              No photo was submitted. Start again when you’re ready, or use a
              photo you already have.
            </p>
          </div>
        ) : (
          <>
            <p>
              Your timer keeps running if you leave or refresh. Capture a photo,
              then submit it here before 00:00.
            </p>
            <label className="uploadbtn">
              <Camera size={17} /> Take a photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                hidden
                disabled={busy}
                onChange={load}
              />
            </label>
            <label className="uploadbtn secondary">
              <ImagePlus size={17} /> Upload from your device
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={busy}
                onChange={load}
              />
            </label>
            {uploads.length > 0 && (
              <>
                <select
                  aria-label="Photo hunt library"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">Or select a library photo</option>
                  {uploads.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  className="primary"
                  disabled={!selected || busy}
                  onClick={() => {
                    if (Date.now() < hunt.deadline)
                      onSubmit(
                        uploads.find((p) => p.id === selected),
                        hunt.mission,
                      );
                  }}
                >
                  SUBMIT SELECTED FRAME
                </button>
              </>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <button className="back" onClick={onCancel}>
          {expired ? "CLOSE HUNT" : "CANCEL HUNT"}
        </button>
      </section>
    </div>
  );
}
const reactions = [
  "The light in A tells a story.",
  "B has such a strong composition.",
  "That little detail makes the whole frame.",
  "Love seeing two takes on the same brief.",
  "The colors here are incredible.",
  "A quieter frame, but it stays with you.",
  "This one is close!",
];
export function PracticeRoom({
  battle,
  username,
  onComplete,
  onAgain,
  onBack,
  sound,
}) {
  const [stage, setStage] = useState(battle.finished ? "finished" : "ready"),
    [votes, setVotes] = useState([]),
    [messages, setMessages] = useState([
      {
        id: "welcome",
        name: "ROOM HOST",
        text: "Welcome to the practice room. Panel members and votes are simulated.",
      },
    ]),
    [draft, setDraft] = useState("");
  const panel = useRef(null),
    completion = useRef(false),
    end = useRef(null);
  useEffect(() => {
    if (stage !== "voting") return;
    if (!panel.current)
      panel.current = Array.from({ length: 15 }, () =>
        Math.random() < 0.5 ? "a" : "b",
      );
    let count = votes.length;
    const timer = setInterval(() => {
      const vote = panel.current[count];
      count++;
      setVotes(panel.current.slice(0, count));
      if (count % 3 === 0)
        setMessages((m) => [
          ...m,
          {
            id: "panel-" + count,
            name: "SIMULATED PANEL",
            text: reactions[Math.floor(Math.random() * reactions.length)],
          },
        ]);
      sound("tick");
      if (count === 15) {
        clearInterval(timer);
        const mine = panel.current.filter((v) => v === "a").length;
        setStage("finished");
        if (!completion.current) {
          completion.current = true;
          onComplete({ mine, opponent: 15 - mine, won: mine > 7 });
          sound(mine > 7 ? "win" : "end");
        }
      }
    }, 850);
    return () => clearInterval(timer);
  }, [stage]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length]);
  const a = battle.finished
      ? battle.result.mine
      : votes.filter((v) => v === "a").length,
    b = battle.finished ? battle.result.opponent : votes.length - a;
  return (
    <>
      <button className="back" onClick={onBack}>
        <ArrowLeft size={16} /> Practice Arena
      </button>
      <div className="pageintro centered">
        <span className="eyebrow">
          {battle.mode.toUpperCase()} · PRACTICE ROOM · SIMULATED PANEL
        </span>
        <h1>{battle.mission?.title || "Photo showdown"}</h1>
        <p>
          {battle.mission?.prompt ||
            "Two perspectives. Let the frames do the talking."}
        </p>
      </div>
      <div className="live-layout">
        <div>
          <div className="room-photos">
            {[
              ["a", battle.a],
              ["b", battle.b],
            ].map(([side, p]) => (
              <article
                key={side}
                className={
                  "live-entry " +
                  (stage === "finished" && battle.result?.won === (side === "a")
                    ? "victor"
                    : "")
                }
              >
                <div className="entry-image">
                  <img src={p.url} alt={p.name} />
                  <span className="entry-letter">{side.toUpperCase()}</span>
                </div>
                <div className="photofooter">
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {side === "a"
                        ? "@" + username
                        : stage === "finished"
                          ? p.by
                          : "Sample opponent"}
                    </small>
                  </div>
                  <span>{side === "a" ? a : b} votes</span>
                </div>
              </article>
            ))}
          </div>
          <div className="vote-meter">
            <div
              style={{
                width: (votes.length ? (a / votes.length) * 100 : 50) + "%",
              }}
            />
          </div>
          {stage === "ready" && (
            <div className="matchaction">
              <button
                className="primary big"
                onClick={() => {
                  sound("start");
                  setStage("voting");
                }}
              >
                START LIVE-STYLE REVEAL
              </button>
              <p>
                A 15-vote simulated panel · join the room chat while votes
                arrive
              </p>
            </div>
          )}
          {stage === "voting" && (
            <div className="voting-banner">
              <span className="live-dot" /> PANEL VOTING{" "}
              <strong>{votes.length}/15</strong>
              <p>Watch the votes roll in. Your photo is in the spotlight.</p>
            </div>
          )}
          {stage === "finished" && (
            <div className="result">
              <Trophy />
              <div>
                <h2>
                  {battle.result?.won
                    ? "Your frame takes the spotlight."
                    : "A close to this chapter."}
                </h2>
                <p>
                  {battle.result?.mine ?? a}–{battle.result?.opponent ?? b}{" "}
                  simulated votes ·{" "}
                  {battle.mode === "Ranked"
                    ? battle.result?.won
                      ? "1 practice win earned"
                      : "No practice win earned"
                    : "Casual: no rank changes"}
                </p>
              </div>
              <button className="primary" onClick={onAgain}>
                PLAY AGAIN
              </button>
            </div>
          )}
        </div>
        <aside className="battle-chat">
          <div className="chathead">
            <strong>
              <span className="live-dot" /> Practice room chat
            </strong>
            <small>
              Panel comments are simulated · your messages stay local
            </small>
          </div>
          <div
            className="live-messages"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((m) => (
              <div className="room-message" key={m.id}>
                <strong>{m.name}</strong>
                <p>{m.text}</p>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form
            className="chatinput"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) {
                setMessages((m) =>
                  [
                    ...m,
                    {
                      id: crypto.randomUUID(),
                      name: "@" + username,
                      text: draft.trim(),
                    },
                  ].slice(-100),
                );
                setDraft("");
              }
            }}
          >
            <input
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Practice battle chat message"
              placeholder="Talk about the frames…"
            />
            <button aria-label="Send practice message" disabled={!draft.trim()}>
              <Send size={18} />
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
export function Identity({ uploads, identity, setIdentity, completed, wins }) {
  const titles = [
    "Curious Eye",
    ...missions
      .filter((m) => completed.includes(m.id))
      .map((m) => m.titleReward),
    ...(completed.some((id) => id.startsWith("weekly-"))
      ? ["Weekly Explorer"]
      : []),
    ...(wins >= 3 ? ["Rising Challenger"] : []),
    ...(wins >= 25 ? ["Arena Regular"] : []),
  ];
  return (
    <section className="identity-tools">
      <div className="sectionhead">
        <h2>Make it yours.</h2>
        <span>Titles are earned through missions and wins</span>
      </div>
      <div className="identity-layout">
        <div className="identity-preview">
          {identity.best && uploads.find((p) => p.id === identity.best) ? (
            <img
              src={uploads.find((p) => p.id === identity.best).url}
              alt="Your signature photograph"
            />
          ) : (
            <div className="identity-gradient" />
          )}
          <div>
            <span className="identity-avatar">{identity.avatar}</span>
            <strong>{identity.title}</strong>
          </div>
        </div>
        <div>
          <label className="fieldlabel">Your avatar</label>
          <div className="avatar-options">
            {["📸", "🌙", "🦊", "🦉", "🌿", "⚡", "🌄", "🪐"].map((a) => (
              <button
                key={a}
                aria-label={"Avatar " + a}
                aria-pressed={identity.avatar === a}
                onClick={() => setIdentity((i) => ({ ...i, avatar: a }))}
              >
                {a}
              </button>
            ))}
          </div>
          <label className="fieldlabel" htmlFor="identityTitle">
            Your earned title
          </label>
          <select
            id="identityTitle"
            value={
              titles.includes(identity.title) ? identity.title : "Curious Eye"
            }
            onChange={(e) =>
              setIdentity((i) => ({ ...i, title: e.target.value }))
            }
          >
            {titles.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <label className="fieldlabel" htmlFor="signaturePhoto">
            Signature photograph
          </label>
          <select
            id="signaturePhoto"
            value={identity.best}
            onChange={(e) =>
              setIdentity((i) => ({ ...i, best: e.target.value }))
            }
          >
            <option value="">Choose your best shot</option>
            {uploads.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="fineprint">
            Complete a creative mission to unlock its title. Your identity is
            saved on this browser.
          </p>
        </div>
      </div>
    </section>
  );
}
export function Journal({ uploads, setUploads, onUpload, busy }) {
  const [notes, setNotes] = useStored("focal_journal", {});
  return (
    <section>
      <div className="pageintro">
        <span className="eyebrow">YOUR PERSONAL PHOTO JOURNAL</span>
        <h1>
          The stories
          <br />
          <em>behind your frames.</em>
        </h1>
        <p>Old favorites and new discoveries, all welcome here.</p>
      </div>
      <label className="uploadbtn">
        <ImagePlus size={18} /> ADD PHOTOS YOU’VE ALREADY TAKEN
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          disabled={busy}
          onChange={onUpload}
        />
      </label>
      <div className="journal-grid">
        {uploads.map((p) => (
          <article className="journal-card" key={p.id}>
            <img src={p.url} alt={p.name} />
            <div>
              <input
                aria-label={"Photo title " + p.name}
                maxLength={100}
                value={p.name}
                onChange={(e) =>
                  setUploads((old) =>
                    old.map((photo) =>
                      photo.id === p.id
                        ? { ...photo, name: e.target.value }
                        : photo,
                    ),
                  )
                }
              />
              <span className="eyebrow">
                {p.addedAt
                  ? new Date(p.addedAt).toLocaleDateString(undefined, {
                      timeZone: "America/New_York",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "FROM YOUR LIBRARY"}
              </span>
              <textarea
                aria-label={"Story behind " + p.name}
                placeholder="What caught your eye? Tell the story behind this frame…"
                maxLength={1000}
                value={notes[p.id] || ""}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [p.id]: e.target.value }))
                }
              />
            </div>
          </article>
        ))}
      </div>
      {!uploads.length && (
        <div className="empty">
          <Camera />
          <h3>Your story starts with a single frame.</h3>
          <p>
            Add photos from your camera roll or computer. There’s no requirement
            to take a new photo.
          </p>
        </div>
      )}
    </section>
  );
}
export function Celebration({ value, onClose }) {
  useModalKeyboard(onClose);
  useEffect(() => {
    function key(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <div className="modal-backdrop celebration-backdrop">
      <section
        className="celebration"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebrationTitle"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <i
            className="confetti"
            key={i}
            style={{
              left: ((i * 37) % 100) + "%",
              animationDelay: (i % 7) * 0.12 + "s",
              background: ["#bda7ff", "#e7ce8b", "#93e7bb"][i % 3],
            }}
          />
        ))}
        <span className="celebration-medal">✦</span>
        <span className="eyebrow">A MOMENT WORTH REMEMBERING</span>
        <h2 id="celebrationTitle">{value.title}</h2>
        <p>{value.detail}</p>
        <button autoFocus className="primary big" onClick={onClose}>
          KEEP CREATING →
        </button>
      </section>
    </div>
  );
}
