import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { DESTINATIONS } from "./worldRules.js";
const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...extra });
const neon = (color) =>
  mat(color, { emissive: color, emissiveIntensity: 2.1, roughness: 0.3 });
function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function rounded(parent, w, h, d, m, x = 0, y = 0, z = 0, r = 0.12) {
  return part(
    parent,
    new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)),
    m,
    x,
    y,
    z,
  );
}
function sphere(parent, r, m, x = 0, y = 0, z = 0, scale = [1, 1, 1]) {
  const s = part(parent, new THREE.SphereGeometry(r, 16, 12), m, x, y, z);
  s.scale.set(...scale);
  return s;
}
function capsule(parent, r, length, m, x, y, z) {
  return part(parent, new THREE.CapsuleGeometry(r, length, 5, 12), m, x, y, z);
}
function ring(parent, r, t, m, x, y, z) {
  return part(parent, new THREE.TorusGeometry(r, t, 8, 48), m, x, y, z);
}
function label(parent, text, color, x, y, z, width = 8) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 180;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#07121eed";
  ctx.beginPath();
  ctx.roundRect(4, 4, 1016, 172, 18);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "700 56px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), 512, 86, 940);
  ctx.fillStyle = "#72919e";
  ctx.font = "18px monospace";
  ctx.fillText("F O C A L  /  N E O N  D I S T R I C T", 512, 143);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: true }),
  );
  sprite.position.set(x, y, z);
  sprite.scale.set(width, (width * 180) / 1024, 1);
  parent.add(sprite);
  return sprite;
}
function glow(parent, color, x, y, z, size = 3) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d"),
    g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "#ffffffaa");
  g.addColorStop(0.12, color + "88");
  g.addColorStop(1, color + "00");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sprite.position.set(x, y, z);
  sprite.scale.set(size, size, 1);
  parent.add(sprite);
  return sprite;
}

export function createCyberAvatar(character = {}) {
  const g = new THREE.Group(),
    body = new THREE.Group();
  g.add(body);
  const skin = mat(character.skin || "#c98f6a"),
    hair = mat(character.hair || "#302538"),
    cloth = mat(character.outfit || "#6954b8"),
    dark = mat("#10182a"),
    sole = mat("#9aa9c4"),
    cyan = neon("#23dbea");
  capsule(body, 0.32, 0.38, cloth, 0, 1.38, 0).scale.set(1.15, 1, 0.8);
  sphere(body, 0.3, dark, 0, 0.96, 0, [1.05, 0.65, 0.8]);
  capsule(body, 0.12, 0.16, skin, 0, 1.89, 0);
  sphere(body, 0.38, skin, 0, 2.18, 0.015, [1, 1.15, 0.94]);
  for (const side of [-1, 1]) {
    sphere(body, 0.09, skin, side * 0.365, 2.14, 0, [1, 1.25, 0.9]);
    sphere(
      body,
      0.062,
      mat("#e9eeef"),
      side * 0.135,
      2.2,
      0.337,
      [1, 1.12, 0.5],
    );
    sphere(body, 0.035, mat("#151326"), side * 0.135, 2.2, 0.365);
    sphere(body, 0.012, mat("#ffffff"), side * 0.124, 2.215, 0.39);
    capsule(body, 0.02, 0.11, hair, side * 0.135, 2.32, 0.323).rotation.z =
      Math.PI / 2;
  }
  sphere(body, 0.065, skin, 0, 2.075, 0.383, [0.75, 1, 1]);
  const smile = part(
    body,
    new THREE.TorusGeometry(0.095, 0.012, 6, 16, Math.PI),
    mat("#693e4d"),
    0,
    1.99,
    0.34,
  );
  smile.rotation.z = Math.PI;
  part(
    body,
    new THREE.SphereGeometry(0.405, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.43),
    hair,
    0,
    2.2,
    0,
  );
  if (character.style === "long")
    sphere(body, 0.39, hair, 0, 2.04, -0.22, [0.95, 1.42, 0.62]);
  if ((character.style || "curly") === "curly")
    for (let i = 0; i < 9; i++)
      sphere(
        body,
        0.15,
        hair,
        Math.cos(i * 0.75) * 0.27,
        2.44 + Math.sin(i * 1.5) * 0.05,
        Math.sin(i * 0.75) * 0.24,
      );
  sphere(body, 0.17, hair, -0.17, 2.43, 0.23, [1.3, 0.75, 1]);
  const limbs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.43, 1.73, 0);
    capsule(arm, 0.11, 0.37, cloth, 0, -0.27, 0);
    sphere(arm, 0.115, skin, 0, -0.6, 0, [0.9, 1.15, 0.85]);
    sphere(arm, 0.05, skin, -side * 0.09, -0.59, 0.055);
    ring(arm, 0.115, 0.025, cyan, 0, -0.48, 0).rotation.x = Math.PI / 2;
    body.add(arm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.18, 0.94, 0);
    capsule(leg, 0.14, 0.49, dark, 0, -0.31, 0);
    sphere(leg, 0.18, sole, 0, -0.77, 0.08, [0.88, 0.56, 1.4]);
    rounded(leg, 0.25, 0.035, 0.4, cyan, 0, -0.83, 0.1, 0.012);
    g.add(leg);
    limbs.push({ arm, leg, side });
  }
  const collar = ring(body, 0.235, 0.07, dark, 0, 1.77, 0);
  collar.rotation.x = Math.PI / 2;
  rounded(body, 0.025, 0.55, 0.025, cyan, 0, 1.41, 0.259, 0.01);
  rounded(body, 0.46, 0.065, 0.025, dark, 0, 1.18, 0.26, 0.02);
  sphere(body, 0.33, dark, 0, 1.43, -0.31, [0.85, 1.13, 0.55]);
  rounded(body, 0.035, 0.4, 0.035, cyan, 0, 1.44, -0.495, 0.015);
  if (character.accessory === "headphones") {
    for (const side of [-1, 1]) {
      sphere(body, 0.14, dark, side * 0.38, 2.18, 0, [0.5, 1, 1]);
      ring(body, 0.1, 0.02, cyan, side * 0.435, 2.18, 0).rotation.y =
        Math.PI / 2;
    }
  } else if (character.accessory === "cap") {
    sphere(body, 0.42, cloth, 0, 2.44, 0.04, [1, 0.22, 1.2]);
    sphere(body, 0.34, cloth, 0, 2.55, -0.03, [1, 0.65, 0.9]);
  } else {
    rounded(body, 0.34, 0.23, 0.16, dark, 0.27, 1.06, 0.31, 0.055);
    part(
      body,
      new THREE.CylinderGeometry(0.1, 0.1, 0.13, 16),
      cyan,
      0.27,
      1.06,
      0.43,
    ).rotation.x = Math.PI / 2;
  }
  g.userData.animate = (time, moving) => {
    for (const { arm, leg, side } of limbs) {
      arm.rotation.x = moving
        ? Math.sin(time * 9) * 0.48 * side
        : Math.sin(time * 1.5 + side) * 0.025;
      leg.rotation.x = moving ? -Math.sin(time * 9) * 0.56 * side : 0;
    }
    body.position.y = moving
      ? Math.abs(Math.sin(time * 9)) * 0.045
      : Math.sin(time * 1.7) * 0.015;
    body.rotation.z = moving ? Math.sin(time * 9) * 0.025 : 0;
  };
  g.traverse((o) => (o.castShadow = false));
  const shadow = part(
    g,
    new THREE.CircleGeometry(0.5, 24),
    new THREE.MeshBasicMaterial({
      color: "#000510",
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
    0,
    0.07,
    0,
  );
  shadow.rotation.x = -Math.PI / 2;
  return g;
}

export function buildCyberDistrict() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#070d20");
  scene.fog = new THREE.FogExp2("#0a122b", 0.013);
  scene.add(new THREE.HemisphereLight("#9aabef", "#172642", 1.25));
  const moon = new THREE.DirectionalLight("#94bdff", 2);
  moon.position.set(-17, 30, 10);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, {
    left: -40,
    right: 40,
    top: 40,
    bottom: -40,
  });
  moon.shadow.normalBias = 0.06;
  scene.add(moon);
  const cyanFill = new THREE.PointLight("#28dcec", 28, 32);
  cyanFill.position.set(-5, 5, -4);
  scene.add(cyanFill);
  const pinkFill = new THREE.PointLight("#e23fab", 20, 28);
  pinkFill.position.set(8, 4, 3);
  scene.add(pinkFill);

  const steel = mat("#121d31", { metalness: 0.62, roughness: 0.36 }),
    panels = mat("#26334b", { metalness: 0.35, roughness: 0.55 }),
    glass = mat("#132c42", { metalness: 0.7, roughness: 0.17 }),
    cyan = neon("#26dcec"),
    pink = neon("#ec3fae"),
    violet = neon("#815cff");
  const ground = part(
    scene,
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshPhysicalMaterial({
      color: "#101b2a",
      roughness: 0.29,
      metalness: 0.58,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  // A visible street grid and reflective-looking inlays keep the dark ground legible.
  const grid = new THREE.GridHelper(130, 52, "#233f57", "#172a3d");
  grid.position.y = 0.015;
  scene.add(grid);
  part(scene, new THREE.CylinderGeometry(11, 11, 0.15, 64), panels, 0, 0.02, 0);
  for (const r of [10.9, 8.8])
    ring(scene, r, 0.035, cyan, 0, 0.12, 0).rotation.x = -Math.PI / 2;
  for (const d of DESTINATIONS) {
    const length = Math.hypot(d.door.x, d.door.z);
    const path = rounded(
      scene,
      3.4,
      0.1,
      length,
      steel,
      d.door.x / 2,
      0.09,
      d.door.z / 2,
      0.02,
    );
    path.rotation.y = Math.atan2(d.door.x, d.door.z);
    const side = new THREE.Vector3(
      Math.cos(path.rotation.y) * 1.6,
      0,
      -Math.sin(path.rotation.y) * 1.6,
    );
    for (const sign of [-1, 1]) {
      const line = rounded(
        scene,
        0.045,
        0.025,
        length,
        neon(new THREE.Color(d.color).getStyle()),
        d.door.x / 2 + side.x * sign,
        0.155,
        d.door.z / 2 + side.z * sign,
        0.01,
      );
      line.rotation.y = path.rotation.y;
    }
  }
  const sculpture = new THREE.Group();
  scene.add(sculpture);
  part(
    sculpture,
    new THREE.CylinderGeometry(2.6, 2.8, 0.45, 48),
    steel,
    0,
    0.28,
    0,
  );
  ring(sculpture, 2.48, 0.045, cyan, 0, 0.52, 0).rotation.x = -Math.PI / 2;
  part(
    sculpture,
    new THREE.CylinderGeometry(0.45, 0.85, 1.25, 16),
    panels,
    0,
    0.9,
    0,
  );
  const aperture = new THREE.Group();
  aperture.position.y = 3;
  aperture.rotation.x = -0.18;
  sculpture.add(aperture);
  ring(aperture, 1.7, 0.13, steel, 0, 0, 0);
  ring(aperture, 1.75, 0.035, cyan, 0, 0, 0.1);
  const blades = new THREE.Group();
  aperture.add(blades);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const blade = rounded(
      blades,
      0.8,
      0.17,
      1.2,
      i % 2 ? violet : cyan,
      Math.cos(a) * 0.68,
      Math.sin(a) * 0.68,
      0,
      0.06,
    );
    blade.rotation.set(Math.PI / 2, 0, a + 0.7);
  }
  glow(scene, "#27dfee", 0, 3, 0.4, 5.5);
  label(scene, "THE APERTURE", "#63e9ef", 0, 5.6, 0, 5);
  const holograms = [];
  for (const d of DESTINATIONS) {
    const building = new THREE.Group();
    building.position.set(d.x, 0, d.z);
    building.rotation.y = d.rotation;
    scene.add(building);
    const color = "#" + new THREE.Color(d.color).getHexString(),
      light = neon(color);
    const height = d.id === "arena" ? 6 : 5.2;
    rounded(building, 9, 0.28, 7.8, steel, 0, 0.22, 0);
    rounded(building, 8, height, 6, panels, 0, height / 2 + 0.35, 0, 0.4);
    rounded(building, 8.6, 0.3, 6.6, steel, 0, height + 0.42, 0, 0.12);
    for (const x of [-3.9, 3.9])
      rounded(
        building,
        0.06,
        height,
        0.08,
        light,
        x,
        height / 2 + 0.4,
        3.08,
        0.02,
      );
    rounded(building, 8.2, 0.06, 0.12, light, 0, height + 0.25, 3.15, 0.02);
    // Illuminated doors and windows face the shared plaza.
    rounded(building, 1.75, 2.8, 0.12, glass, 0, 1.8, 3.1, 0.2);
    const arch = part(
      building,
      new THREE.TorusGeometry(1.12, 0.055, 8, 32, Math.PI),
      light,
      0,
      2.7,
      3.22,
    );
    for (const side of [-1, 1])
      rounded(building, 0.08, 2.3, 0.09, light, side * 1.12, 1.55, 3.22, 0.025);
    for (const x of [-2.6, 2.6]) {
      rounded(building, 1.75, 2.2, 0.15, glass, x, 2.6, 3.13, 0.15);
      rounded(building, 1.85, 0.045, 0.2, light, x, 1.48, 3.24, 0.015);
      for (let i = 0; i < 4; i++)
        rounded(
          building,
          1.3,
          0.035,
          0.025,
          mat(color, { emissive: color, emissiveIntensity: 0.55 }),
          x,
          1.9 + i * 0.39,
          3.23,
          0.01,
        );
    }
    label(scene, d.name, color, d.x, height + 2.4, d.z, 9);
    const marker = ring(scene, 0.95, 0.045, light, d.door.x, 0.18, d.door.z);
    marker.rotation.x = -Math.PI / 2;
    holograms.push(marker);
    glow(scene, color, d.door.x, 0.7, d.door.z, 2.7);
    // Inlaid strips suggest neon reflections without expensive screen-space passes.
    const reflection = part(
      building,
      new THREE.PlaneGeometry(1.6, 3.8),
      new THREE.MeshBasicMaterial({
        color: d.color,
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
      }),
      0,
      0.17,
      5.6,
    );
    reflection.rotation.x = -Math.PI / 2;
    if (d.id === "arena") {
      const emblem = ring(building, 1.1, 0.12, light, 0, 5.2, 3.18);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const b = rounded(
          building,
          0.55,
          0.12,
          0.11,
          light,
          Math.cos(a) * 0.6,
          5.2 + Math.sin(a) * 0.6,
          3.2,
          0.03,
        );
        b.rotation.z = a + 0.5;
      }
      emblem.userData.spin = true;
      holograms.push(emblem);
    }
    if (d.id === "missions") {
      rounded(building, 2.2, 2.4, 0.22, steel, 2.5, 1.5, 4.9, 0.15);
      for (let i = 0; i < 4; i++)
        rounded(
          building,
          1.7,
          0.12,
          0.05,
          light,
          2.5,
          2.3 - i * 0.45,
          5.04,
          0.03,
        );
    }
    if (d.id === "gallery") {
      for (const x of [-2.6, 2.6]) {
        const frame = rounded(building, 2, 1.6, 0.13, light, x, 2, 4.5, 0.06);
        const texture = new THREE.TextureLoader().load(
          "/photos/" + (x < 0 ? "sample-0.jpg" : "sample-3.jpg"),
        );
        texture.colorSpace = THREE.SRGBColorSpace;
        part(
          building,
          new THREE.PlaneGeometry(1.8, 1.4),
          new THREE.MeshBasicMaterial({ map: texture }),
          x,
          2,
          4.58,
        );
        holograms.push(frame);
      }
    }
    if (d.id === "cafe") {
      for (const x of [-2.9, 2.9]) {
        part(
          building,
          new THREE.CylinderGeometry(0.7, 0.7, 0.12, 20),
          steel,
          x,
          0.9,
          5,
        );
        part(
          building,
          new THREE.CylinderGeometry(0.06, 0.12, 0.85, 10),
          light,
          x,
          0.45,
          5,
        );
        for (const side of [-1, 1]) {
          sphere(building, 0.38, steel, x + side * 0.95, 0.48, 5, [1, 0.25, 1]);
          capsule(building, 0.045, 0.4, panels, x + side * 0.95, 0.22, 5);
        }
      }
      rounded(building, 7.8, 0.15, 2, steel, 0, 3.8, 3.8);
      rounded(building, 7.8, 0.05, 0.05, pink, 0, 3.73, 4.8);
    }
  }
  // Planters and lighting make routes feel inhabited, while the walking lanes stay clear.
  const plant = mat("#385365");
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2,
      x = Math.sin(a) * 9,
      z = Math.cos(a) * 9;
    rounded(scene, 0.9, 0.42, 0.9, steel, x, 0.28, z);
    for (let j = 0; j < 3; j++) {
      const leaf = part(
        scene,
        new THREE.ConeGeometry(0.28, 1.2, 8),
        plant,
        x + (j - 1) * 0.22,
        1,
        z,
      );
      leaf.rotation.z = (j - 1) * 0.2;
    }
    if (i % 3 === 0) {
      part(
        scene,
        new THREE.CylinderGeometry(0.05, 0.08, 3, 10),
        panels,
        x,
        1.7,
        z,
      );
      glow(scene, i % 2 ? "#e33aad" : "#23cfed", x, 3.25, z, 2.4);
      sphere(scene, 0.11, i % 2 ? pink : cyan, x, 3.25, z);
    }
  }
  const rail = mat("#2b3a54");
  for (const [x, z] of [
    [-8, 3],
    [8, 3],
    [-5, -7],
    [5, -7],
  ]) {
    rounded(scene, 2.4, 0.16, 0.7, rail, x, 0.65, z, 0.08);
    rounded(scene, 2.4, 0.6, 0.12, panels, x, 1, z - 0.3, 0.05);
    rounded(scene, 2.3, 0.035, 0.035, cyan, x, 0.72, z + 0.32, 0.015);
  }
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const windowGeo = new THREE.BoxGeometry(0.32, 0.65, 0.045),
    windows = new THREE.InstancedMesh(
      windowGeo,
      mat("#71cce1", { emissive: "#287b9e", emissiveIntensity: 1.4 }),
      700,
    );
  const transform = new THREE.Object3D();
  let count = 0;
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2,
      r = 47 + rand() * 22,
      x = Math.sin(a) * r,
      z = Math.cos(a) * r,
      h = 10 + rand() * 30,
      w = 5 + rand() * 5;
    const tower = rounded(
      scene,
      w,
      h,
      w,
      mat(i % 2 ? "#11182d" : "#182039"),
      x,
      h / 2,
      z,
      0.3,
    );
    tower.rotation.y = a;
    rounded(
      scene,
      w + 0.1,
      0.08,
      w + 0.1,
      i % 3 === 0 ? pink : cyan,
      x,
      h,
      z,
      0.025,
    );
    for (let row = 1; row < Math.min(10, h / 2) && count < 700; row++)
      for (let col = -1; col <= 1 && count < 700; col++) {
        transform.position.set(
          x + Math.cos(a) * col * 1.4 + -Math.sin(a) * (w / 2 + 0.04),
          row * 2.2,
          z - Math.sin(a) * col * 1.4 + -Math.cos(a) * (w / 2 + 0.04),
        );
        transform.rotation.y = a;
        transform.updateMatrix();
        windows.setMatrixAt(count++, transform.matrix);
      }
  }
  windows.count = count;
  scene.add(windows);
  // Elevated transit stays outside the playable district.
  const track = ring(scene, 42, 0.14, rail, 0, 9, 0);
  track.rotation.x = -Math.PI / 2;
  const train = new THREE.Group();
  scene.add(train);
  for (let i = 0; i < 3; i++) {
    rounded(train, 1.4, 1.1, 3, steel, 0, 0, i * 3.3, 0.25);
    rounded(train, 1.45, 0.08, 2.8, cyan, 0, 0.3, i * 3.3, 0.02);
  }
  const stars = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    const a = rand() * Math.PI * 2,
      r = 60 + rand() * 40;
    stars.set([Math.sin(a) * r, 25 + rand() * 65, Math.cos(a) * r], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(stars, 3));
  scene.add(
    new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: "#9eacdd",
        size: 0.16,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    ),
  );
  const rainPositions = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++)
    rainPositions.set(
      [(rand() - 0.5) * 65, rand() * 25, (rand() - 0.5) * 65],
      i * 3,
    );
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({
      color: "#81c1ed",
      size: 0.055,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  scene.add(rain);
  rain.visible = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    scene,
    update(t, dt, weather) {
      rain.visible = weather && !reduced;
      if (reduced) return;
      blades.rotation.z = t * 0.22;
      for (const h of holograms) {
        if (h.userData.spin) h.rotation.z = t * 0.15;
      }
      train.position.set(
        Math.sin(t * 0.045) * 42,
        9.8,
        Math.cos(t * 0.045) * 42,
      );
      train.rotation.y = t * 0.045 + Math.PI / 2;
      if (weather) {
        for (let i = 0; i < 300; i++) {
          rainPositions[i * 3 + 1] -= dt * 12;
          if (rainPositions[i * 3 + 1] < 0) rainPositions[i * 3 + 1] = 25;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
    },
  };
}
