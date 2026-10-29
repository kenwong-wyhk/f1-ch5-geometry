/* ============================================================
   dev/check_levels.js — Node harness for Slice Lab.

   Proves two things before the game ships:
     1. every level's "ideal" aim really does produce its target shape;
     2. the winning region is big enough to find by hand (we report
        the % of the sampled aim space that wins).

   Run:  node assets/slice-lab/dev/check_levels.js
   ============================================================ */
const GEO = require("../../shared/geom.js");
const LEVELS = require("../levels.js");

const cache = {};
function solid(key) {
  if (!cache[key]) {
    const mesh = GEO.SOLIDS[key].make();
    cache[key] = GEO.trianglesOf(mesh);
  }
  return cache[key];
}

function cut(tris, tilt, turn, depth) {
  const pl = GEO.planeAt(tris, tilt, turn, depth);
  const sec = GEO.sectionAt(tris, pl.n, pl.s);
  if (!sec) return { kind: "none", name: "No section" };
  return GEO.classify(sec.hull2);
}

let bad = 0;
console.log("level  solid            target        ideal-cut result            OK   win-region");
console.log("-----------------------------------------------------------------------------------");

for (const lv of LEVELS) {
  const tris = solid(lv.solid);
  const ideal = cut(tris, lv.ideal.tilt, lv.ideal.turn, lv.ideal.depth);
  const ok = lv.accept.includes(ideal.kind);
  if (!ok) bad++;

  // sample the aim space: 19 tilts x 24 turns x 9 depths
  let win = 0, total = 0;
  for (let tilt = 0; tilt <= 90; tilt += 5) {
    for (let turn = 0; turn < 360; turn += 15) {
      for (let d = -0.8; d <= 0.81; d += 0.2) {
        total++;
        if (lv.accept.includes(cut(tris, tilt, turn, d).kind)) win++;
      }
    }
  }
  const pct = (100 * win / total).toFixed(1);
  console.log(
    String(lv.id).padStart(5) + "  " +
    lv.solid.padEnd(16) + " " +
    lv.target.padEnd(13) + " " +
    (ideal.name + " (" + ideal.kind + ")").padEnd(27) + " " +
    (ok ? " ok " : "FAIL") + " " +
    pct.padStart(6) + "%"
  );
}

console.log("\n" + (bad ? bad + " LEVEL(S) NOT SOLVED BY THEIR IDEAL AIM" : "all levels solved by their ideal aim"));
process.exit(bad ? 1 : 0);
