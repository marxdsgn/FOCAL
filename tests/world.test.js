import test from "node:test";
import assert from "node:assert/strict";
import {
  moveCharacter,
  blocked,
  DESTINATIONS,
  nearbyDestination,
} from "../src/worldRules.js";
test("walking is normalized, bounded and stops at world obstacles", () => {
  const start = { x: 0, z: 8 };
  const diagonal = moveCharacter(start, { x: 1, z: 1 }, 0.05),
    straight = moveCharacter(start, { x: 1, z: 0 }, 0.05);
  assert.ok(
    Math.abs(Math.hypot(diagonal.x, diagonal.z - 8) - straight.x) < 0.00001,
  );
  let p = { x: 0, z: 4 };
  for (let i = 0; i < 100; i++) p = moveCharacter(p, { x: 0, z: -1 }, 0.05);
  assert.ok(p.z > 2.6);
  assert.equal(blocked(35, 0), true);
  assert.equal(blocked(0, 0), true);
  for (const d of DESTINATIONS) {
    assert.equal(blocked(d.door.x, d.door.z), false);
    assert.equal(nearbyDestination(d.door).id, d.id);
  }
});
test("camera-relative movement and sprint operate without frame jumps", () => {
  const moved = moveCharacter(
    { x: 0, z: 8 },
    { x: 0, z: -1 },
    0.05,
    Math.PI / 2,
  );
  assert.ok(moved.x < 0);
  assert.ok(Math.abs(moved.z - 8) < 0.00001);
  assert.equal(moveCharacter({ x: 0, z: 8 }, { x: 1, z: 0 }, 100).x, 0.25);
  assert.ok(
    moveCharacter({ x: 0, z: 8 }, { x: 1, z: 0 }, 0.05, 0, true).x > 0.25,
  );
});
