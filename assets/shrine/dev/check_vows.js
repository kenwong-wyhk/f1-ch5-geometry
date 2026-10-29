/* ============================================================
   dev/check_vows.js — prove every vow is winnable.

   For each vow it spawns the solid at its authored yaw and walks
   the player's real tilt grid (0..90 in 5° steps) at a centre cut.
   A vow passes when at least one tilt produces an accepted shape.
   It also checks the declared `window` is honest and that the
   declared `tilt` really works.

   Run:  node assets/shrine/dev/check_vows.js
   ============================================================ */
const GEO = require("../../shared/geom.js");
const VOWS = require("../vows.js");

const TILTS = [];
for (let t = 0; t <= 90; t += 5) TILTS.push(t);

function rotY(tris, deg) {
  if (!deg) return tris;
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return tris.map((t) => t.map((p) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]));
}

const cache = {};
function trisFor(key) {
  if (!cache[key]) cache[key] = GEO.trianglesOf(GEO.SOLIDS[key].make());
  return cache[key];
}

function kindAt(tris, tilt) {
  const pl = GEO.planeAt(tris, tilt, 0, 0);
  const sec = GEO.sectionAt(tris, pl.n, pl.s);
  return sec ? GEO.classify(sec.hull2).kind : null;
}

let fail = 0;
console.log("vow                 solid          yaw  wins  window  declared  verdict");
console.log("---------------------------------------------------------------------------");

for (const v of VOWS) {
  const tris = rotY(trisFor(v.solid), v.yaw);
  const wins = TILTS.filter((t) => v.accept.includes(kindAt(tris, t)));
  const ok = wins.length > 0;
  const idealOk = ok && v.accept.includes(kindAt(tris, v.tilt));
  const windowOk = Math.abs(wins.length - v.window) <= 1;
  if (!ok || !idealOk || !windowOk) fail++;

  console.log(
    v.id.padEnd(20) +
    v.solid.padEnd(15) +
    String(v.yaw).padStart(3) + "  " +
    String(wins.length).padStart(3) + "   " +
    String(v.window).padStart(4) + "     " +
    String(v.tilt).padStart(3) + "°     " +
    (!ok ? "UNREACHABLE" : !idealOk ? "declared tilt misses" : !windowOk ? "window off" : "ok")
  );
}

console.log("\n" + (fail ? fail + " VOW(S) FAILED" : "all " + VOWS.length + " vows winnable on the tilt grid"));
process.exit(fail ? 1 : 0);
