export const WORLD_LIMIT = 34;
export const DESTINATIONS = [
  {
    id: "arena",
    name: "Battle Arena",
    page: "Live Rooms",
    x: -17,
    z: -14,
    color: 0x26dcec,
    icon: "⚔",
  },
  {
    id: "missions",
    name: "Mission HQ",
    page: "Missions",
    x: 17,
    z: -14,
    color: 0x9063ff,
    icon: "✦",
  },
  {
    id: "cafe",
    name: "Community Café",
    page: "Communities",
    x: -23,
    z: 7,
    color: 0xee49b2,
    icon: "☕",
  },
  {
    id: "gallery",
    name: "Photo Gallery",
    page: "Photo Journal",
    x: 23,
    z: 7,
    color: 0x48f2bf,
    icon: "▧",
  },
  {
    id: "practice",
    name: "Practice Studio",
    page: "Battle Arena",
    x: -12,
    z: 25,
    color: 0x5294ff,
    icon: "◎",
  },
  {
    id: "ranks",
    name: "Hall of Fame",
    page: "Leaderboard",
    x: 12,
    z: 25,
    color: 0xffb85b,
    icon: "♛",
  },
].map((d) => {
  const rotation = Math.atan2(-d.x, -d.z);
  return {
    ...d,
    rotation,
    door: {
      x: d.x + Math.sin(rotation) * 5.4,
      z: d.z + Math.cos(rotation) * 5.4,
    },
  };
});
export const COLLIDERS = [
  { x: 0, z: 0, width: 5.3, depth: 5.3, rotation: 0 },
  ...DESTINATIONS.map((d) => ({ ...d, width: 8.8, depth: 6.8 })),
];
export function blocked(x, z, colliders = COLLIDERS) {
  if (Math.abs(x) > WORLD_LIMIT || Math.abs(z) > WORLD_LIMIT) return true;
  return colliders.some((c) => {
    const cos = Math.cos(c.rotation || 0),
      sin = Math.sin(c.rotation || 0),
      dx = x - c.x,
      dz = z - c.z,
      lx = dx * cos - dz * sin,
      lz = dx * sin + dz * cos;
    const nx = Math.max(-c.width / 2, Math.min(c.width / 2, lx)),
      nz = Math.max(-c.depth / 2, Math.min(c.depth / 2, lz));
    return Math.hypot(lx - nx, lz - nz) < 0.48;
  });
}
export function moveCharacter(
  position,
  input,
  seconds,
  yaw = 0,
  sprint = false,
) {
  const length = Math.hypot(input.x, input.z);
  if (!length) return { ...position, moving: false };
  const step =
      ((sprint ? 8 : 5) * Math.min(0.05, Math.max(0, seconds))) /
      Math.max(1, length),
    cos = Math.cos(yaw),
    sin = Math.sin(yaw);
  const dx = (input.x * cos + input.z * sin) * step,
    dz = (-input.x * sin + input.z * cos) * step;
  let { x, z } = position;
  if (!blocked(x + dx, z)) x += dx;
  if (!blocked(x, z + dz)) z += dz;
  return {
    x,
    z,
    yaw: Math.atan2(dx, dz),
    moving: x !== position.x || z !== position.z,
  };
}
export function nearbyDestination(position) {
  return (
    DESTINATIONS.find(
      (d) => Math.hypot(position.x - d.door.x, position.z - d.door.z) < 3.3,
    ) || null
  );
}
