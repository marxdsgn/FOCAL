import test from "node:test";
import assert from "node:assert/strict";
import {
  ranks,
  rankFor,
  progression,
  simulateVotes,
  applyResult,
} from "../src/game.js";
test("tiers unlock at each win boundary", () => {
  for (let i = 0; i < ranks.length; i++) {
    assert.equal(rankFor(ranks[i][1]), ranks[i][0]);
    if (i) assert.equal(rankFor(ranks[i][1] - 1), ranks[i - 1][0]);
  }
  assert.equal(progression(400).percent, 100);
});
test("panel supports wins and losses with fifteen votes, no ties", () => {
  assert.deepEqual(
    simulateVotes(() => 0),
    { mine: 15, opponent: 0, won: true },
  );
  assert.deepEqual(
    simulateVotes(() => 1),
    { mine: 0, opponent: 15, won: false },
  );
  let n = 0;
  assert.equal(simulateVotes(() => (n++ < 8 ? 0 : 1)).won, true);
});
test("only ranked wins advance tiers; losses do not remove earned wins", () => {
  const stats = { wins: 2, losses: 0, rating: 0, history: [] };
  const battle = {
    id: "one",
    a: { name: "Entry" },
    b: { name: "Opponent" },
    genre: "Open",
    mode: "Ranked",
  };
  const won = applyResult(stats, battle, { won: true, mine: 10 });
  assert.equal(rankFor(won.wins), "Amateur");
  assert.equal(won.history.length, 1);
  const lost = applyResult(won, battle, { won: false, mine: 4 });
  assert.equal(lost.wins, 3);
  assert.equal(lost.losses, 1);
  assert.equal(applyResult(stats, battle, { won: false, mine: 0 }).rating, 0);
  const casual = applyResult(
    stats,
    { ...battle, mode: "Casual" },
    { won: true, mine: 15 },
  );
  assert.equal(casual.wins, 2);
  assert.equal(casual.rating, 0);
  assert.equal(casual.history.length, 1);
});
