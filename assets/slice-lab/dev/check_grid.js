/* ============================================================
   dev/check_grid.js — the incremental-aim guarantee.

   The console only lets the player pick TILT / TURN in 15° steps,
   so every level must be winnable on that grid. This walks the
   grid and reports, per level, whether a solution exists and what
   the cleanest one is (shallowest depth, closest to the middle).

   Run:  node assets/slice-lab/dev/check_grid.js
   ============================================================ */
const GEO = require("../../shared/geom.js");
const LEVELS = require("../levels.js");

const TILT_STEP = 5;    /* must match game.js */
const TURN_STEP = 15;

const cache = {};
const tris = (key) => (cache[key] = cache[key] || GEO.trianglesOf(GEO.SOLIDS[key].make()));

function kindAt(t, tilt, turn, depth) {
  const pl = GEO.planeAt(t, tilt, turn, depth);
  const sec = GEO.sectionAt(t, pl.n, pl.s);
  return sec ? GEO.classify(sec.hull2).kind : "none";
}

let bad = 0;
console.log("level  solid            target        grid solutions   best aim (tilt/turn/depth)");
console.log("grid: tilt " + TILT_STEP + "° steps, turn " + TURN_STEP + "° steps");
console.log("--------------------------------------------------------------------------------");

for (const lv of LEVELS) {
  const t = tris(lv.solid);
  const hits = [];
  for (let tilt = 0; tilt <= 90; tilt += TILT_STEP) {
    for (let turn = 0; turn < 360; turn += TURN_STEP) {
      for (let d = -1; d <= 1.0001; d += 0.05) {
        if (lv.accept.includes(kindAt(t, tilt, turn, d))) {
          hits.push({ tilt, turn, depth: Math.round(d * 100) / 100 });
        }
      }
    }
  }
  // prefer: the level's own ideal when it is on the grid, else the shallowest depth
  const onGrid = hits.find(
    (h) => h.tilt === lv.ideal.tilt && h.turn === lv.ideal.turn && Math.abs(h.depth - lv.ideal.depth) < 0.051
  );
  const best = onGrid || hits.slice().sort((a, b) => Math.abs(a.depth) - Math.abs(b.depth))[0];
  if (!hits.length) bad++;
  console.log(
    String(lv.id).padStart(5) + "  " +
    lv.solid.padEnd(16) + " " +
    lv.target.padEnd(13) + " " +
    String(hits.length).padStart(6) + " combos   " +
    (best ? `${best.tilt}° / ${best.turn}° / ${best.depth}` : "—") +
    (onGrid ? "   (matches ideal)" : "   <-- ideal not on grid")
  );
}

console.log("\n" + (bad ? bad + " LEVEL(S) UNREACHABLE ON THE STEP GRID" : "all levels reachable on the step grid"));
process.exit(bad ? 1 : 0);
