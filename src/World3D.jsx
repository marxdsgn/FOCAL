import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { request } from "./LiveRooms.jsx";
import { rankFor } from "./game.js";
import {
  DESTINATIONS,
  COLLIDERS,
  moveCharacter,
  nearbyDestination,
} from "./worldRules.js";
import { Character } from "./Community.jsx";
import "./world.css";
import { createCyberAvatar as avatar, buildCyberDistrict } from "./worldArt.js";

function sign(parent, text, color, x, y, z, width = 7) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#30263bea";
  ctx.beginPath();
  ctx.roundRect(0, 0, 768, 128, 18);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = "#fff8ed";
  ctx.font = "600 53px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 384, 68, 720);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false }),
  );
  sprite.position.set(x, y, z);
  sprite.scale.set(width, width / 6, 1);
  parent.add(sprite);
  return sprite;
}
export default function World3D({
  profile,
  active,
  onNavigate,
  onProfile,
  onLogout,
  loggingOut,
  onPhoto,
}) {
  const host = useRef(null),
    engine = useRef(null),
    callbacks = useRef({ active, onNavigate, onPhoto }),
    [near, setNear] = useState(null),
    [status, setStatus] = useState("Connecting to the plaza…"),
    [messages, setMessages] = useState([]),
    [draft, setDraft] = useState(""),
    [players, setPlayers] = useState(1),
    [error, setError] = useState(""),
    [mapOpen, setMapOpen] = useState(false),
    [help, setHelp] = useState(false),
    [chatOpen, setChatOpen] = useState(false),
    [rain, setRain] = useState(false);
  const weather = useRef(rain);
  weather.current = rain;
  callbacks.current = { active, onNavigate, onPhoto };
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      setError(
        "This browser could not start 3D graphics. Try enabling hardware acceleration or use the destination menu.",
      );
      return;
    }
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        window.innerWidth < 700 ? 1.2 : 1.7,
      ),
    );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    root.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Walkable cyberpunk FOCAL photography district",
    );
    renderer.domElement.setAttribute("role", "img");
    const district = buildCyberDistrict();
    const scene = district.scene;
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);
    const player = avatar(profile.character);
    scene.add(player);
    const position = { x: 0, z: 7.5, yaw: Math.PI, height: 0 };
    let jumpVelocity = 0;
    let yaw = 0,
      elapsed = 0,
      last = performance.now(),
      frame,
      nearId = "",
      target = null;
    const keys = new Set(),
      joystick = { x: 0, z: 0 },
      remote = new Map();
    let drag = null;
    const ray = new THREE.Raycaster(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    engine.current = {
      position,
      joystick,
      remote,
      scene,
      avatar,
      rotate: (amount) => {
        yaw += amount;
      },
      recenter: () => {
        position.x = 0;
        position.z = 7.5;
        target = null;
        yaw = 0;
      },
      jump: () => {
        if (callbacks.current.active && position.height === 0)
          jumpVelocity = 5.4;
      },
      snap: () => {
        if (!callbacks.current.active) return;
        try {
          player.visible = false;
          renderer.render(scene, camera);
          const c = document.createElement("canvas"),
            source = renderer.domElement;
          c.width = Math.min(1200, source.width);
          c.height = Math.round((c.width * source.height) / source.width);
          c.getContext("2d").drawImage(source, 0, 0, c.width, c.height);
          let quality = 0.8,
            url = c.toDataURL("image/jpeg", quality);
          while (url.length > 450000 && quality > 0.3) {
            quality -= 0.15;
            url = c.toDataURL("image/jpeg", quality);
          }
          callbacks.current.onPhoto?.({
            id: crypto.randomUUID(),
            name:
              "Neon District " +
              new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            url,
            category: "In-world photography",
            addedAt: new Date().toISOString(),
          });
        } catch {
          setError("Could not save this frame. Try a smaller browser window.");
        } finally {
          player.visible = true;
        }
      },
      interact: () => {
        const d = nearbyDestination(position);
        if (d && callbacks.current.active) callbacks.current.onNavigate(d.page);
      },
    };
    const resize = () => {
      const { width, height } = root.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();
    camera.position.set(0, 6.6, 20);
    function typing() {
      return (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        ) || document.activeElement?.isContentEditable
      );
    }
    function down(e) {
      if (!callbacks.current.active || typing()) return;
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "shift",
          "q",
          "r",
          "e",
          " ",
          "f",
        ].includes(key)
      ) {
        e.preventDefault();
        keys.add(key);
        target = null;
        if (key === "e" && !e.repeat) engine.current.interact();
        if (key === " " && !e.repeat) engine.current.jump();
        if (key === "f" && !e.repeat) engine.current.snap();
      }
    }
    const up = (e) => keys.delete(e.key.toLowerCase());
    const clear = () => {
      keys.clear();
      joystick.x = joystick.z = 0;
      drag = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    const pointerdown = (e) => {
      if (!callbacks.current.active) return;
      drag = {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      };
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const pointermove = (e) => {
      if (!drag || !callbacks.current.active) return;
      yaw -= (e.clientX - drag.x) * 0.006;
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const pointerup = (e) => {
      if (
        drag &&
        Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5 &&
        callbacks.current.active
      ) {
        const rect = root.getBoundingClientRect();
        ray.setFromCamera(
          new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            (-(e.clientY - rect.top) / rect.height) * 2 + 1,
          ),
          camera,
        );
        const hit = new THREE.Vector3();
        if (ray.ray.intersectPlane(plane, hit)) target = { x: hit.x, z: hit.z };
      }
      drag = null;
    };
    renderer.domElement.addEventListener("pointerdown", pointerdown);
    renderer.domElement.addEventListener("pointermove", pointermove);
    renderer.domElement.addEventListener("pointerup", pointerup);
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      let input = { x: 0, z: 0 };
      if (callbacks.current.active && !typing()) {
        input.x =
          Number(keys.has("d") || keys.has("arrowright")) -
          Number(keys.has("a") || keys.has("arrowleft")) +
          joystick.x;
        input.z =
          Number(keys.has("s") || keys.has("arrowdown")) -
          Number(keys.has("w") || keys.has("arrowup")) +
          joystick.z;
        if (keys.has("q")) yaw -= dt;
        if (keys.has("r")) yaw += dt;
        if (target && !input.x && !input.z) {
          const dx = target.x - position.x,
            dz = target.z - position.z;
          if (Math.hypot(dx, dz) < 0.3) target = null;
          else {
            input = {
              x: dx * Math.cos(yaw) - dz * Math.sin(yaw),
              z: dx * Math.sin(yaw) + dz * Math.cos(yaw),
            };
          }
        }
      } else keys.clear();
      const next = moveCharacter(position, input, dt, yaw, keys.has("shift"));
      if (target && !next.moving) target = null;
      Object.assign(position, next);
      if (position.height > 0 || jumpVelocity > 0) {
        jumpVelocity -= 14 * dt;
        position.height = Math.max(0, position.height + jumpVelocity * dt);
        if (position.height === 0) jumpVelocity = 0;
      }
      player.position.set(position.x, 0.08 + position.height, position.z);
      player.rotation.y = position.yaw;
      player.userData.animate(elapsed, next.moving);
      const d = nearbyDestination(position);
      if ((d?.id || "") !== nearId) {
        nearId = d?.id || "";
        setNear(d);
      }
      const offset = new THREE.Vector3(
        Math.sin(yaw) * 13,
        6.6,
        Math.cos(yaw) * 13,
      );
      camera.position.lerp(
        new THREE.Vector3(position.x, 0, position.z).add(offset),
        1 - Math.exp(-dt * 5),
      );
      camera.lookAt(
        position.x - Math.sin(yaw) * 4,
        1.3,
        position.z - Math.cos(yaw) * 4,
      );
      for (const actor of remote.values()) {
        const before = actor.mesh.position.clone();
        actor.mesh.position.lerp(
          new THREE.Vector3(
            actor.target.x,
            0.08 + (actor.target.height || 0),
            actor.target.z,
          ),
          1 - Math.exp(-dt * 3),
        );
        actor.mesh.rotation.y = actor.target.yaw || 0;
        actor.mesh.userData.animate(
          elapsed,
          before.distanceTo(actor.mesh.position) > 0.002,
        );
      }
      district.update(elapsed, dt, weather.current);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    const lost = (e) => {
      e.preventDefault();
      setError(
        "3D graphics paused. Reload the page to reconnect, or use the destination menu.",
      );
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      renderer.domElement.removeEventListener("pointerdown", pointerdown);
      renderer.domElement.removeEventListener("pointermove", pointermove);
      renderer.domElement.removeEventListener("pointerup", pointerup);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      const geometries = new Set(),
        materials = new Set(),
        textures = new Set();
      scene.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        for (const m of (Array.isArray(o.material)
          ? o.material
          : [o.material]
        ).filter(Boolean)) {
          materials.add(m);
          if (m.map) textures.add(m.map);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      engine.current = null;
    };
  }, [profile.publicId, JSON.stringify(profile.character)]);
  useEffect(() => {
    let alive = true,
      running = false;
    async function update() {
      if (running || !engine.current) return;
      running = true;
      try {
        const { x, z, yaw, height } = engine.current.position;
        const data = await request("/world/presence", "POST", {
          x,
          z,
          yaw,
          height,
        });
        if (!alive) return;
        setMessages(data.messages);
        setPlayers(data.players.length);
        setStatus("Connected to the plaza");
        const remote = engine.current.remote,
          seen = new Set();
        for (const p of data.players) {
          if (p.isMe) continue;
          seen.add(p.publicId);
          if (!remote.has(p.publicId)) {
            const actor = engine.current.avatar(p.character);
            engine.current.scene.add(actor);
            sign(actor, p.name, "#e2c8f0", 0, 3, 0, 2.8);
            actor.position.set(p.position.x, 0.08, p.position.z);
            remote.set(p.publicId, { mesh: actor, target: p.position });
          }
          remote.get(p.publicId).target = p.position;
        }
        for (const [id, p] of remote)
          if (!seen.has(id)) {
            engine.current.scene.remove(p.mesh);
            p.mesh.traverse((o) => {
              o.geometry?.dispose();
              if (o.material) {
                o.material.map?.dispose();
                o.material.dispose();
              }
            });
            remote.delete(id);
          }
      } catch {
        if (alive)
          setStatus("World connection unavailable · you can still explore");
      } finally {
        running = false;
      }
    }
    update();
    const timer = setInterval(update, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [profile.publicId]);
  async function send(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    try {
      const result = await request("/world/chat", "POST", {
        text: draft.trim(),
      });
      setMessages(result.messages);
      setDraft("");
    } catch (e) {
      setError(e.message);
    }
  }
  function stick(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect(),
      x = (e.clientX - r.left - r.width / 2) / (r.width * 0.36),
      z = (e.clientY - r.top - r.height / 2) / (r.height * 0.36);
    if (engine.current) {
      engine.current.joystick.x = Math.max(-1, Math.min(1, x));
      engine.current.joystick.z = Math.max(-1, Math.min(1, z));
    }
  }
  const resetStick = () => {
    if (engine.current)
      engine.current.joystick.x = engine.current.joystick.z = 0;
  };
  return (
    <div className={"world-shell " + (!active ? "world-is-paused" : "")}>
      <div className="world-canvas" ref={host} />
      <div className="world-brand">
        <strong>
          FOCAL<span>.</span>
        </strong>
        <button className="world-player" onClick={onProfile}>
          <Character value={profile.character} />
          <span>
            {profile.name}
            <small>
              {rankFor(profile.wins)} · {profile.wins} wins
            </small>
          </span>
        </button>
      </div>
      <div className="world-actions">
        <button onClick={() => setMapOpen((v) => !v)} aria-expanded={mapOpen}>
          Map & places
        </button>
        <button onClick={() => setHelp((v) => !v)} aria-expanded={help}>
          Controls
        </button>
        <button onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
      <div className="world-location">
        <span className="live-dot" /> NEON DISTRICT{" "}
        <small>
          {players} {players === 1 ? "photographer" : "photographers"} ·{" "}
          {status}
        </small>
      </div>
      {help && (
        <section className="world-help">
          <h3>Find your perspective.</h3>
          <p>
            WASD / arrow keys to walk · Shift to run · drag to rotate the camera
            · click the ground to walk · E to enter a place · Space to jump · F
            to take a photo.
          </p>
          <p>
            On touch screens, use the movement pad. Tap a doorway’s Enter button
            to open it.
          </p>
          <button onClick={() => engine.current?.recenter()}>
            Return to the Aperture
          </button>
          <button onClick={() => setHelp(false)}>Got it</button>
        </section>
      )}
      {mapOpen && (
        <section className="world-map-menu">
          <h3>Explore the district</h3>
          <p>Walk to a marked entrance, or open a place here.</p>
          {DESTINATIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                onNavigate(d.page);
                setMapOpen(false);
              }}
            >
              <span>{d.icon}</span>
              {d.name} →
            </button>
          ))}
          <button onClick={() => onNavigate("My Profile")}>
            My photo library & profile →
          </button>
          <button onClick={() => onNavigate("Battle History")}>
            My battle history →
          </button>
        </section>
      )}
      {active && near && (
        <button className="world-enter" onClick={() => onNavigate(near.page)}>
          <kbd>E</kbd> Enter {near.name} <span>→</span>
        </button>
      )}
      {active && !near && (
        <div className="world-welcome">
          Welcome to the Neon District
          <small>Walk to a building to begin · WASD or arrows</small>
        </div>
      )}
      <button
        className="world-chat-toggle"
        onClick={() => setChatOpen((v) => !v)}
        aria-expanded={chatOpen}
      >
        World chat {chatOpen ? "−" : "+"}
      </button>
      {chatOpen && (
        <section className="world-chat">
          <div className="world-chat-messages" aria-live="polite">
            {messages.length ? (
              messages.slice(-12).map((m) => (
                <p key={m.id}>
                  <strong>{m.name}</strong> {m.text}
                </p>
              ))
            ) : (
              <p className="world-chat-empty">
                Say hello to the photographers in the plaza.
              </p>
            )}
          </div>
          <form onSubmit={send}>
            <input
              aria-label="World chat message"
              placeholder="Say something…"
              maxLength={300}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button disabled={!draft.trim()}>Send</button>
          </form>
        </section>
      )}
      {active && (
        <div className="world-photo-actions">
          <button onClick={() => engine.current?.snap()}>
            📷 Take photo <kbd>F</kbd>
          </button>
          <button onClick={() => engine.current?.jump()}>
            Jump <kbd>Space</kbd>
          </button>
          <button aria-pressed={rain} onClick={() => setRain((v) => !v)}>
            {rain ? "Rain on" : "Rain off"}
          </button>
        </div>
      )}
      <div className="world-camera-controls">
        <button
          aria-label="Rotate camera left"
          onClick={() => engine.current?.rotate(0.4)}
        >
          ↶
        </button>
        <button
          aria-label="Rotate camera right"
          onClick={() => engine.current?.rotate(-0.4)}
        >
          ↷
        </button>
      </div>
      {active && (
        <div
          className="world-joystick"
          role="group"
          aria-label="Touch movement pad"
          onPointerDown={stick}
          onPointerMove={(e) => {
            if (e.buttons) stick(e);
          }}
          onPointerUp={resetStick}
          onPointerCancel={resetStick}
        >
          <span>↑</span>
          <span>← MOVE →</span>
          <span>↓</span>
        </div>
      )}
      {error && (
        <div className="world-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
