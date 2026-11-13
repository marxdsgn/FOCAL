import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Aperture,
  Swords,
  Trophy,
  Users,
  Camera,
  Home,
  ImagePlus,
  Flame,
  Send,
  ChevronRight,
  CheckCircle,
  Shield,
  Menu,
  X,
  ArrowLeft,
  Star,
  Medal,
  Upload,
  LogOut,
} from "lucide-react";
import "./style.css";
import "./immersion.css";
import LiveRooms, { request } from "./LiveRooms.jsx";
import ChatRooms, { Character } from "./Community.jsx";
import PlayerAccount from "./AccountAccess.jsx";
import {
  MissionBoard,
  MissionEntry,
  PhotoHunt,
  PracticeRoom,
  Identity,
  Journal,
  Celebration,
} from "./Immersion.jsx";
import {
  ranks,
  rankFor,
  progression,
  simulateVotes,
  applyResult,
} from "./game.js";
import { useStored, preparePhoto } from "./storage.js";
const demoPhotos = [
  {
    url: "./photos/street-0.jpg",
    name: "City Lights",
    by: "@cityframe",
    category: "Street",
  },
  {
    url: "./photos/street-1.jpg",
    name: "Urban Stories",
    by: "@streetlens",
    category: "Street",
  },
  {
    url: "./photos/sample-0.jpg",
    name: "Golden Hour",
    by: "@lenshunter",
    category: "Landscape",
  },
  {
    url: "./photos/sample-1.jpg",
    name: "Midnight Peaks",
    by: "@nightframe",
    category: "Landscape",
  },
  {
    url: "./photos/sample-2.jpg",
    name: "Through the Lens",
    by: "@visualstory",
    category: "Open",
  },
  {
    url: "./photos/sample-3.jpg",
    name: "Reflections",
    by: "@shutterpro",
    category: "Nature",
  },
  {
    url: "./photos/sample-4.jpg",
    name: "Alpine Escape",
    by: "@earthbound",
    category: "Landscape",
  },
  {
    url: "./photos/sample-5.jpg",
    name: "Last Light",
    by: "@lightchaser",
    category: "Nature",
  },
];
const channels = {
  General: ["general", "introductions", "announcements"],
  Sports: ["general", "game-day", "gear-talk"],
  Landscape: ["general", "share-your-shots", "editing-tips"],
  Portrait: ["general", "lighting", "feedback"],
  Street: ["general", "photo-walks", "feedback"],
  Wildlife: ["general", "field-notes", "share-your-shots"],
};
const starterMessages = {
  "General/general": [
    {
      who: "@focalteam",
      body: "Welcome to FOCAL! Share your favorite shot and meet other photographers.",
      time: "9:41 AM",
    },
    {
      who: "@shutterpro",
      body: "Who is ready for a photo battle? 📸",
      time: "9:44 AM",
    },
  ],
};
function App() {
  const [page, setPage] = useState(
      new URLSearchParams(location.search).has("room")
        ? "Live Rooms"
        : new URLSearchParams(location.search).has("chat")
          ? "Communities"
          : "Home",
    ),
    [mobile, setMobile] = useState(false),
    [username, setUsername] = useStored("focal_username", "you"),
    [stats, setStats] = useStored("focal_stats_v2", {
      rating: 0,
      wins: 0,
      losses: 0,
      history: [],
    }),
    [uploads, setUploads] = useStored("focal_uploads", []),
    [messages, setMessages] = useStored("focal_messages", starterMessages),
    [community, setCommunity] = useState("General"),
    [channel, setChannel] = useState("general"),
    [draft, setDraft] = useState(""),
    [battle, setBattle] = useState(null),
    [selected, setSelected] = useState(null),
    [mode, setMode] = useState("Ranked"),
    [genre, setGenre] = useState("Open"),
    [notification, setNotification] = useState(""),
    [entry, setEntry] = useState("sample"),
    [busy, setBusy] = useState(false),
    [confirmReset, setConfirmReset] = useState(false),
    [identity, setIdentity] = useStored("focal_identity", {
      avatar: "📸",
      title: "Curious Eye",
      best: "",
    }),
    [completed, setCompleted] = useStored("focal_completed_missions", []),
    [activeMission, setActiveMission] = useState(null),
    [hunt, setHunt] = useStored("focal_photo_hunt", null),
    [celebration, setCelebration] = useState(null),
    [soundEnabled, setSoundEnabled] = useStored("focal_sound", false);
  const [accountOpen, setAccountOpen] = useState(false),
    [cloudAccount, setCloudAccount] = useState(null);
  useEffect(() => {
    let active = true;
    request("/me")
      .then((p) => {
        if (active) {
          setCloudAccount(p);
          if (p.onboarded) setUsername(p.name);
          else if (!sessionStorage.getItem("focal_signup_seen"))
            setAccountOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const update = (event) => {
      if (event.detail.session) {
        request("/me")
          .then((p) => {
            setCloudAccount(p);
            if (p.onboarded) setUsername(p.name);
            else setAccountOpen(true);
          })
          .catch(() => {});
        if (event.detail.recovery) setAccountOpen(true);
      } else setCloudAccount(null);
    };
    window.addEventListener("focal-session-changed", update);
    return () => window.removeEventListener("focal-session-changed", update);
  }, []);
  function closeAccount() {
    setAccountOpen(false);
    try {
      sessionStorage.setItem("focal_signup_seen", "1");
    } catch {}
  }
  const soundFlag = useRef(soundEnabled);
  soundFlag.current = soundEnabled;
  const audio = useRef(null),
    lastRank = useRef(rankFor(stats.wins));
  function sound(kind) {
    if (!soundFlag.current) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      audio.current ||= new Context();
      const ctx = audio.current;
      ctx.resume();
      const notes =
        kind === "win"
          ? [523, 659, 784]
          : kind === "start"
            ? [392, 523]
            : [kind === "tick" ? 660 : 440];
      notes.forEach((frequency, i) => {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain(),
          time = ctx.currentTime + i * 0.12;
        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.045, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.18);
      });
    } catch {}
  }
  const celebrate = (title, detail) => setCelebration({ title, detail });
  useEffect(() => {
    const next = rankFor(stats.wins);
    if (next !== lastRank.current) {
      const before = lastRank.current;
      lastRank.current = next;
      if (
        stats.wins > 0 &&
        ranks.findIndex((r) => r[0] === next) >
          ranks.findIndex((r) => r[0] === before)
      )
        celebrate(
          next + " unlocked",
          "Your next chapter starts now. Keep pushing your perspective.",
        );
    }
  }, [stats.wins]);
  function beginHunt(mission) {
    setActiveMission(null);
    setHunt({ mission, deadline: Date.now() + 300000 });
    sound("start");
  }
  function submitHunt(photo, mission) {
    if (!hunt || Date.now() >= hunt.deadline) {
      flash("Time is up. Start a new photo hunt to try again.");
      return;
    }
    setUploads((prev) =>
      [photo, ...prev.filter((p) => p.id !== photo.id)].slice(0, 8),
    );
    setHunt(null);
    startBattle(photo, mission);
  }

  const { rating, wins, losses } = stats;
  const progress = progression(wins);
  useEffect(() => {
    const warn = () =>
      setNotification(
        "Browser storage is full or unavailable. Export your progress from My Profile before closing.",
      );
    window.addEventListener("focal-storage-error", warn);
    return () => window.removeEventListener("focal-storage-error", warn);
  }, []);
  const flash = (s) => {
    setNotification(s);
    setTimeout(() => setNotification(""), 3200);
  };
  const navigate = (s) => {
    setPage(s);
    setMobile(false);
    window.scrollTo(0, 0);
  };
  const battlePool = demoPhotos.filter(
    (p) => genre === "Open" || p.category === genre,
  );
  function startBattle(photoArg = null, missionArg = null) {
    const category = missionArg?.category || genre;
    const pool = demoPhotos.filter(
      (p) => category === "Open" || p.category === category,
    );
    const a = photoArg?.url
      ? photoArg
      : entry === "sample"
        ? { ...(pool[0] || demoPhotos[0]), by: "@" + username }
        : uploads.find((p) => p.id === entry);
    if (!a) {
      flash("Select a photograph first.");
      return;
    }
    const opponents = (pool.length ? pool : demoPhotos).filter(
      (p) => p.url !== a.url,
    );
    const b =
      opponents[Math.floor(Math.random() * opponents.length)] ||
      demoPhotos.find((p) => p.url !== a.url);
    setBattle({
      id: crypto.randomUUID(),
      a,
      b,
      mode,
      genre: category,
      mission: missionArg,
      finished: false,
    });
    if (
      missionArg &&
      (missionArg.id.startsWith("weekly-") ||
        ["ordinary", "motion", "quiet", "night", "nature"].includes(
          missionArg.id,
        ))
    ) {
      setCompleted((prev) =>
        prev.includes(missionArg.id) ? prev : [...prev, missionArg.id],
      );
      flash(
        "Mission submitted! " +
          (missionArg.titleReward
            ? "Title unlocked: " + missionArg.titleReward
            : "Your story continues."),
      );
    }
    setSelected(null);
    setActiveMission(null);
    sound("start");
    navigate("Battle");
  }
  function finishBattle(result) {
    if (!battle || battle.finished) return;
    setSelected(result.won ? "a" : "b");
    setBattle((prev) => ({ ...prev, finished: true, result }));
    setStats((prev) =>
      prev.history.some((h) => h.id === battle.id)
        ? prev
        : applyResult(prev, battle, result),
    );
  }
  async function uploadPhoto(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    let added = 0;
    try {
      const prepared = [];
      for (const file of files.slice(0, 8)) {
        prepared.push(await preparePhoto(file));
      }
      setUploads((prev) => [...prepared, ...prev].slice(0, 8));
      added = prepared.length;
      flash(
        `${added} photo${added === 1 ? "" : "s"} added. Your portfolio keeps the latest 8.`,
      );
    } catch (error) {
      flash(error.message || "Could not read that photo. Try another image.");
    } finally {
      setBusy(false);
    }
  }
  function exportProgress() {
    const data = {
      version: 1,
      username,
      stats,
      uploads,
      messages,
      identity,
      completed,
      journal: JSON.parse(localStorage.getItem("focal_journal") || "{}"),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "focal-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importProgress(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 6000000) throw Error("Backup is too large.");
      const data = JSON.parse(await file.text());
      if (
        data.version !== 1 ||
        typeof data.username !== "string" ||
        !/^[a-zA-Z0-9_]{1,18}$/.test(data.username) ||
        !data.stats ||
        !["rating", "wins", "losses"].every(
          (k) => Number.isSafeInteger(data.stats[k]) && data.stats[k] >= 0,
        ) ||
        !Array.isArray(data.stats.history) ||
        data.stats.history.length > 100 ||
        !data.stats.history.every(
          (h) =>
            h &&
            typeof h.id === "string" &&
            typeof h.date === "string" &&
            typeof h.photo === "string" &&
            typeof h.opponent === "string" &&
            typeof h.won === "boolean" &&
            ["Ranked", "Casual"].includes(h.mode) &&
            typeof h.genre === "string" &&
            Number.isInteger(h.votes) &&
            Number.isFinite(h.delta),
        ) ||
        !Array.isArray(data.uploads) ||
        data.uploads.length > 8 ||
        !data.uploads.every(
          (p) =>
            typeof p.name === "string" &&
            typeof p.id === "string" &&
            typeof p.url === "string" &&
            /^data:image\/(jpeg|png|webp);base64,/.test(p.url),
        )
      )
        throw Error("Invalid FOCAL backup.");
      localStorage.setItem("focal_import_check", JSON.stringify(data));
      localStorage.removeItem("focal_import_check");
      if (
        data.identity &&
        typeof data.identity.avatar === "string" &&
        typeof data.identity.title === "string" &&
        typeof data.identity.best === "string"
      )
        setIdentity(data.identity);
      if (
        Array.isArray(data.completed) &&
        data.completed.every((id) => typeof id === "string")
      )
        setCompleted(data.completed);
      if (
        data.journal &&
        typeof data.journal === "object" &&
        !Array.isArray(data.journal) &&
        Object.values(data.journal).every((n) => typeof n === "string")
      )
        localStorage.setItem("focal_journal", JSON.stringify(data.journal));
      setUsername(data.username);
      setStats(data.stats);
      setUploads(data.uploads);
      if (
        data.messages &&
        typeof data.messages === "object" &&
        !Array.isArray(data.messages)
      ) {
        const restored = {};
        for (const [key, list] of Object.entries(data.messages)) {
          if (Array.isArray(list) && key.includes("/"))
            restored[key] = list
              .filter(
                (m) =>
                  m &&
                  typeof m.who === "string" &&
                  typeof m.body === "string" &&
                  typeof m.time === "string",
              )
              .slice(-200);
        }
        setMessages(restored);
      }
      setEntry("sample");
      setBattle(null);
      flash("Progress restored.");
    } catch (error) {
      flash(error.message || "Could not restore this backup.");
    }
  }
  function sendMessage() {
    if (!draft.trim()) return;
    const key = community + "/" + channel;
    setMessages((prev) => ({
      ...prev,
      [key]: [
        ...(prev[key] || []),
        {
          who: "@" + username,
          body: draft.trim().slice(0, 500),
          time: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
        },
      ].slice(-200),
    }));
    setDraft("");
  }
  const nav = [
    ["Home", Home],
    ["Battle Arena", Swords],
    ["Live Rooms", Users],
    ["Missions", Star],
    ["Photo Journal", ImagePlus],
    ["Leaderboard", Trophy],
    ["Communities", Users],
    ["My Profile", Camera],
    ["Battle History", Medal],
  ];
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "show" : "")}>
        <div className="logo">
          <Aperture size={29} color="#a68cff" strokeWidth={2.5} />
          <span>
            FOCAL<span className="dot">.</span>
          </span>
        </div>
        <div className="sublogo">EVERY SHOT COUNTS</div>
        <div className="navlabel">EXPLORE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={
                page === name || (page === "Battle" && name === "Battle Arena")
                  ? "active"
                  : ""
              }
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebarbottom">
          <div className="rankpill">
            <Medal size={21} color="#b39cff" />
            <div>
              <strong>{rankFor(wins)}</strong>
              <small>{wins} wins</small>
            </div>
          </div>
          <div className="demo-tag">
            <Shield size={13} /> PRACTICE + COMMUNITY
          </div>
        </div>
      </aside>
      <div className="main">
        <header>
          <button className="mobilemenu" onClick={() => setMobile(!mobile)}>
            {mobile ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            FOCAL <ChevronRight size={14} /> <strong>{page}</strong>
          </div>
          <div className="headeruser">
            <button
              className="sound-toggle"
              aria-pressed={soundEnabled}
              aria-label={
                soundEnabled ? "Mute game sounds" : "Enable game sounds"
              }
              onClick={() => {
                setSoundEnabled((v) => !v);
                if (!soundEnabled) {
                  try {
                    const C = window.AudioContext || window.webkitAudioContext;
                    audio.current ||= new C();
                    audio.current.resume();
                  } catch {}
                }
              }}
            >
              {soundEnabled ? "♫ Sound on" : "♪ Sound off"}
            </button>
            <span className="online" /> @ {username}{" "}
            <button
              className="header-player"
              aria-label="Edit your player character and social links"
              onClick={() => setAccountOpen(true)}
            >
              {cloudAccount?.onboarded ? (
                <Character value={cloudAccount.character} />
              ) : (
                <span>{identity.avatar}</span>
              )}
            </button>
          </div>
        </header>
        <main>
          {page === "Home" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="eyebrow">
                    <Flame size={15} /> THE CREATIVE ARENA
                  </span>
                  <h1>
                    YOUR LENS.
                    <br />
                    <em>YOUR LEGACY.</em>
                  </h1>
                  <p>
                    Go head-to-head with photographers. Climb the ranks. Find
                    your community. Every shot counts.
                  </p>
                  <button
                    className="primary big"
                    onClick={() => navigate("Battle Arena")}
                  >
                    <Swords size={19} /> ENTER THE ARENA{" "}
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="hero-art">
                  <img
                    src={
                      demoPhotos.find((photo) => photo.category === "Landscape")
                        .url
                    }
                    alt="Mountain landscape"
                  />
                  <div className="hero-art-label">THE WORLD IS YOUR CANVAS</div>
                </div>
              </section>
              <div className="sectionhead">
                <h2>Welcome back, @{username}</h2>
                <span>Your creative journey</span>
              </div>
              <div className="statgrid">
                <div className="stat">
                  <small>CURRENT RANK</small>
                  <strong>{rankFor(wins)}</strong>
                  <span>
                    {progress.next
                      ? `${progress.next[1] - wins} wins to ${progress.next[0]}`
                      : "Top tier unlocked"}
                  </span>
                </div>
                <div className="stat">
                  <small>TOTAL WINS</small>
                  <strong>{wins}</strong>
                  <span>Keep the streak alive</span>
                </div>
                <div className="stat">
                  <small>WIN RATE</small>
                  <strong>
                    {Math.round((100 * wins) / (wins + losses || 1))}%
                  </strong>
                  <span>{wins + losses} ranked battles</span>
                </div>
                <div className="stat">
                  <small>YOUR PHOTOS</small>
                  <strong>{uploads.length}</strong>
                  <span>Saved in this browser</span>
                </div>
              </div>
              <div className="career-progress">
                <strong>
                  {rankFor(wins)} → {progress.next?.[0] || "Legend"}
                </strong>
                <progress
                  value={progress.percent}
                  max="100"
                  aria-label="Progress to next tier"
                />
                <span>
                  {progress.next
                    ? `${progress.next[1] - wins} more ranked wins to the next tier`
                    : "You reached the highest tier."}
                </span>
              </div>
              <div className="sectionhead">
                <h2>Discover FOCAL</h2>
              </div>
              <div className="featuregrid">
                <button
                  className="feature"
                  onClick={() => navigate("Battle Arena")}
                >
                  <Swords color="#b29cff" />
                  <h3>1v1 Photo Battles</h3>
                  <p>
                    Put your photography skills to the test in a head-to-head
                    showdown.
                  </p>
                  <span>PLAY NOW →</span>
                </button>
                <button
                  className="feature"
                  onClick={() => navigate("Communities")}
                >
                  <Users color="#b29cff" />
                  <h3>Find Your People</h3>
                  <p>
                    Join dedicated communities for every style of photography.
                  </p>
                  <span>EXPLORE CHATS →</span>
                </button>
                <button
                  className="feature"
                  onClick={() => navigate("Leaderboard")}
                >
                  <Trophy color="#b29cff" />
                  <h3>Rise Through the Ranks</h3>
                  <p>Earn wins, unlock tiers, and celebrate every promotion.</p>
                  <span>VIEW RANKINGS →</span>
                </button>
              </div>
            </>
          )}
          {page === "Home" && (
            <MissionBoard
              compact
              completed={completed}
              onEnter={setActiveMission}
            />
          )}
          {page === "Missions" && (
            <MissionBoard completed={completed} onEnter={setActiveMission} />
          )}
          {page === "Photo Journal" && (
            <Journal
              uploads={uploads}
              setUploads={setUploads}
              onUpload={uploadPhoto}
              busy={busy}
            />
          )}
          {page === "Live Rooms" && (
            <LiveRooms
              uploads={uploads}
              setUploads={setUploads}
              username={username}
              flash={flash}
              sound={sound}
              celebrate={celebrate}
            />
          )}
          {page === "Battle Arena" && (
            <>
              <div className="pageintro">
                <span className="eyebrow">COMPETE TO CREATE</span>
                <h1>
                  Battle Arena<span className="dot">.</span>
                </h1>
                <p>
                  Choose your game mode, pick a genre, and enter a photo
                  showdown.
                </p>
              </div>
              <div className="battle-settings">
                <div className="notice">
                  <strong>Looking for real people?</strong> Live Rooms has
                  shared chat, spectator voting, and server-verified community
                  wins. This arena is for practice.
                  <button
                    className="back"
                    onClick={() => navigate("Live Rooms")}
                  >
                    ENTER LIVE ROOMS →
                  </button>
                </div>
                <h2>Choose your mode</h2>
                <div className="modegrid">
                  {[
                    ["Ranked", "Win battles to climb the tier ladder."],
                    ["Casual", "Practice without risking your rating."],
                  ].map(([m, d]) => (
                    <button
                      key={m}
                      className={"mode " + (mode === m ? "chosen" : "")}
                      onClick={() => setMode(m)}
                    >
                      <strong>
                        {m === "Ranked" ? "🏆" : "⚡"} {m} Battle
                      </strong>
                      <span>{d}</span>
                    </button>
                  ))}
                </div>
                <h2>Photography category</h2>
                <div className="chips">
                  {["Open", "Landscape", "Street", "Nature"].map((g) => (
                    <button
                      className={genre === g ? "chosen" : ""}
                      key={g}
                      onClick={() => setGenre(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <div className="notice">
                  Practice against sample opponents. A simulated panel of 15
                  voters decides each match randomly; it does not analyze your
                  photo. Ranked wins count toward tiers, while Casual results
                  only appear in your history.
                </div>
                <h2>Your entry</h2>
                <label className="fieldlabel" htmlFor="entry">
                  Previously taken photos are welcome. Choose from your
                  portfolio or try a sample photo
                </label>
                <select
                  id="entry"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                >
                  <option value="sample">Use a sample entry</option>
                  {uploads.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button className="back" onClick={() => navigate("My Profile")}>
                  Add a photo you’ve already taken →
                </button>
                <div className="shoot-option">
                  <Camera size={20} />
                  <div>
                    <strong>Don’t have the photo yet?</strong>
                    <p>
                      Take a five-minute photo hunt, then bring your frame into
                      the arena.
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={() =>
                      beginHunt({
                        id: "free-shoot",
                        title: genre + " photo hunt",
                        prompt:
                          "Find a fresh perspective in " +
                          genre.toLowerCase() +
                          ". Capture and submit your frame within five minutes.",
                        category: genre,
                      })
                    }
                  >
                    SHOOT IT NOW · 5:00
                  </button>
                </div>
                <button className="primary big" onClick={() => startBattle()}>
                  <Swords size={20} /> START DEMO BATTLE{" "}
                  <ChevronRight size={18} />
                </button>
              </div>
            </>
          )}
          {page === "Battle" && battle && (
            <PracticeRoom
              key={battle.id}
              battle={battle}
              username={username}
              sound={sound}
              onComplete={finishBattle}
              onBack={() => navigate("Battle Arena")}
              onAgain={() => startBattle(battle.a, battle.mission)}
            />
          )}
          {page === "Leaderboard" && (
            <>
              <div className="pageintro">
                <span className="eyebrow">THE BEST OF THE BEST</span>
                <h1>
                  Leaderboard<span className="dot">.</span>
                </h1>
                <p>
                  Win your way through eight tiers and become a FOCAL Legend.
                </p>
              </div>
              <div className="notice">
                Illustrative leaderboard. Other players and their win totals are
                sample data, not live accounts.
              </div>
              <div className="leaderboard">
                <div className="tablehead">
                  <span>RANK</span>
                  <span>PHOTOGRAPHER</span>
                  <span>TIER</span>
                  <span>WINS</span>
                </div>
                {[
                  { name: "@lightchaser", wins: 465 },
                  { name: "@shutterpro", wins: 410 },
                  { name: "@nightframe", wins: 280 },
                  { name: "@lenshunter", wins: 135 },
                  { name: "@visualstory", wins: 72 },
                  { name: "@earthbound", wins: 34 },
                  { name: "@" + username, wins, isMe: true },
                ]
                  .sort((a, b) => b.wins - a.wins)
                  .map((u, i) => (
                    <div
                      className={"leaderrow " + (u.isMe ? "me" : "")}
                      key={u.isMe ? "me" : u.name}
                    >
                      <strong>#{i + 1}</strong>
                      <span>
                        <span className="miniavatar">
                          {u.name[1]?.toUpperCase()}
                        </span>
                        {u.name}
                        {u.isMe ? " (you)" : ""}
                      </span>
                      <span>{rankFor(u.wins)}</span>
                      <strong>{u.wins.toLocaleString()}</strong>
                    </div>
                  ))}
              </div>
              <h2 className="ranktitle">All Rank Tiers</h2>
              <div className="tiergrid">
                {ranks.map(([name, minimum], i) => (
                  <div className="tier" key={name}>
                    <div className="tiericon">
                      {["◈", "⬡", "✦", "◆", "✧", "♛", "♕", "★"][i]}
                    </div>
                    <strong>{name}</strong>
                    <small>{minimum}+ wins</small>
                  </div>
                ))}
              </div>
            </>
          )}
          {page === "Communities" && (
            <ChatRooms
              uploads={uploads}
              setUploads={setUploads}
              username={username}
              flash={flash}
              onAccount={() => setAccountOpen(true)}
            />
          )}
          {page === "My Profile" && (
            <>
              <div className="pageintro">
                <span className="eyebrow">YOUR CREATIVE IDENTITY</span>
                <h1>
                  My Profile<span className="dot">.</span>
                </h1>
                <p>Your character, your social links, your signature frame.</p>
                <button
                  className="primary"
                  onClick={() => setAccountOpen(true)}
                >
                  {cloudAccount?.onboarded
                    ? "EDIT PLAYER & SOCIAL LINKS"
                    : "CREATE MY PLAYER"}
                </button>
              </div>
              <div className="profilecard">
                <div className="profileavatar">{identity.avatar}</div>
                <div className="profileinfo">
                  <label>YOUR USERNAME</label>
                  <div className="nameedit">
                    <span>@</span>
                    <input
                      value={username}
                      onChange={(e) =>
                        setUsername(
                          e.target.value
                            .replace(/[^a-zA-Z0-9_]/g, "")
                            .slice(0, 18),
                        )
                      }
                      onBlur={() => {
                        if (!username) setUsername("you");
                      }}
                      aria-label="Username"
                    />
                  </div>
                  <p>
                    {rankFor(wins)} photographer • {wins} wins • {losses} losses
                  </p>
                </div>
              </div>
              <div className="account-profile-row">
                <div>
                  <h2>Your player profile</h2>
                  <p>
                    Customize your character, introduce yourself, and link your
                    social media.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => setAccountOpen(true)}
                >
                  {cloudAccount?.onboarded
                    ? "EDIT MY PLAYER"
                    : "SIGN UP / CREATE PLAYER"}
                </button>
              </div>
              <Identity
                uploads={uploads}
                identity={identity}
                setIdentity={setIdentity}
                completed={completed}
                wins={wins}
              />
              <div className="sectionhead">
                <h2>Your photo library</h2>
                <label className="uploadbtn">
                  <ImagePlus size={17} />{" "}
                  {busy ? "PROCESSING…" : "ADD EXISTING PHOTOS"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={busy}
                    onChange={uploadPhoto}
                    hidden
                  />
                </label>
              </div>
              <div className="notice">
                Upload JPG, PNG or WebP under 10 MB. Photos are resized and
                saved locally (latest 8). Export a backup to keep your progress
                before clearing browser data.
              </div>
              {uploads.length ? (
                <div className="gallery">
                  {uploads.map((p, i) => (
                    <div className="galleryitem" key={i}>
                      <img src={p.url} alt={p.name} />
                      <div>
                        <strong>{p.name}</strong>
                        <button
                          onClick={() => {
                            setUploads((prev) =>
                              prev.filter((_, j) => i !== j),
                            );
                            setEntry("sample");
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <Upload size={36} />
                  <h3>Your gallery starts here</h3>
                  <p>
                    Upload your first photograph to begin building your
                    portfolio.
                  </p>
                </div>
              )}
            </>
          )}
          {page === "Battle History" && (
            <>
              <div className="pageintro">
                <span className="eyebrow">YOUR JOURNEY</span>
                <h1>
                  Battle History<span className="dot">.</span>
                </h1>
                <p>
                  Your latest 100 practice matches. Ranked wins unlock tiers.
                </p>
              </div>
              {stats.history.length ? (
                <div className="historylist">
                  {stats.history.map((h) => (
                    <article className="historyitem" key={h.id}>
                      <strong className={h.won ? "positive" : ""}>
                        {h.won ? "WIN" : "LOSS"}
                      </strong>
                      <div>
                        <h3>{h.photo}</h3>
                        <p>
                          vs {h.opponent} · {h.genre} · {h.mode}
                        </p>
                        <small>
                          {new Date(h.date).toLocaleString()} · {h.votes}–
                          {15 - h.votes} simulated votes
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <Swords />
                  <h3>A fresh start</h3>
                  <p>Play your first battle to begin your history.</p>
                  <button
                    className="primary"
                    onClick={() => navigate("Battle Arena")}
                  >
                    ENTER THE ARENA
                  </button>
                </div>
              )}
            </>
          )}
          {page === "My Profile" && (
            <section className="data-tools">
              <h2>Your game data</h2>
              <p>
                Keep a backup to transfer your career to another browser.
                Restoring replaces your career and portfolio.
              </p>
              <button className="primary" onClick={exportProgress}>
                EXPORT BACKUP
              </button>{" "}
              <label className="uploadbtn">
                RESTORE BACKUP
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={importProgress}
                />
              </label>
              <button className="back" onClick={() => setConfirmReset(true)}>
                Start a new career
              </button>
              {confirmReset && (
                <div role="alert" className="notice">
                  Reset your wins, losses, and history? Your photos and chats
                  will stay.
                  <div className="resetactions">
                    <button
                      className="primary"
                      onClick={() => {
                        setStats({
                          rating: 0,
                          wins: 0,
                          losses: 0,
                          history: [],
                        });
                        setBattle(null);
                        setConfirmReset(false);
                        flash("New career started.");
                      }}
                    >
                      RESET CAREER
                    </button>
                    <button
                      className="back"
                      onClick={() => setConfirmReset(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
        <footer>
          © FOCAL · EVERY SHOT COUNTS{" "}
          <span>
            Practice arena + shared battle rooms · Photography brings us
            together
          </span>
        </footer>
      </div>
      {accountOpen && (
        <PlayerAccount
          initial={cloudAccount}
          onClose={closeAccount}
          onSaved={(p) => {
            setCloudAccount(p);
            setUsername(p.name);
            flash("Your player profile is ready. Welcome to FOCAL!");
          }}
        />
      )}
      {activeMission && (
        <MissionEntry
          mission={activeMission}
          uploads={uploads}
          busy={busy}
          onAdd={uploadPhoto}
          onClose={() => setActiveMission(null)}
          onExisting={startBattle}
          onCapture={beginHunt}
        />
      )}
      {hunt && (
        <PhotoHunt
          hunt={hunt}
          uploads={uploads}
          onSubmit={submitHunt}
          onCancel={() => setHunt(null)}
        />
      )}
      {celebration && (
        <Celebration value={celebration} onClose={() => setCelebration(null)} />
      )}
      {notification && <div className="toast">{notification}</div>}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
