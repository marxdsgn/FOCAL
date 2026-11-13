export const ranks = [
  ["Rookie", 0],
  ["Amateur", 3],
  ["Rising Creator", 10],
  ["Pro", 25],
  ["Elite", 50],
  ["Master", 100],
  ["Grandmaster", 200],
  ["Legend", 400],
];
export function rankFor(wins) {
  return [...ranks].reverse().find(([, min]) => wins >= min)?.[0] || "Rookie";
}
export function progression(wins) {
  const index = ranks.findIndex(([name]) => name === rankFor(wins));
  const current = ranks[index],
    next = ranks[index + 1];
  return {
    current,
    next,
    percent: next
      ? Math.min(100, (100 * (wins - current[1])) / (next[1] - current[1]))
      : 100,
  };
}
// A practice simulation, not an assessment of image quality or real community votes.
export function simulateVotes(random = Math.random) {
  const votes = Array.from({ length: 15 }, () => random() < 0.5);
  const mine = votes.filter(Boolean).length;
  return { mine, opponent: 15 - mine, won: mine > 7 };
}
export function applyResult(stats, battle, result) {
  const ranked = battle.mode === "Ranked";
  const delta = ranked ? (result.won ? 24 : -16) : 0;
  return {
    rating: Math.max(0, stats.rating + delta),
    wins: stats.wins + (ranked && result.won ? 1 : 0),
    losses: stats.losses + (ranked && !result.won ? 1 : 0),
    history: [
      {
        id: battle.id,
        date: new Date().toISOString(),
        mode: battle.mode,
        genre: battle.genre,
        photo: battle.a.name,
        opponent: battle.b.name,
        won: result.won,
        votes: result.mine,
        delta,
      },
      ...stats.history,
    ].slice(0, 100),
  };
}
