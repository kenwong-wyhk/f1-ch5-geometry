/* ============================================================
   dev/check_vows.js — prove every vow is winnable.

   This mirrors the game exactly:

     • the blade is hinged on the world Z axis, n = (sin t, cos t, 0)
     • it always passes through the spirit's centre, s = 0
     • the player can reach the whole pencil of lean angles,
       t = -90…90 (the swipe solver folds into that range)

   For each vow it spawns the solid at its authored yaw and walks
   that tilt grid at a centre cut.  A vow passes when at least one
   tilt produces an accepted shape.  It also checks the declared
   `window` is honest and that the declared `tilt` really works.

   The grid is walked through the same apex aim-assist the game uses
   (shrine.js `apexAssist`): on a pyramid or cone, a tilt within 7°
   of vertical is pulled onto the apex.

   Run:  node assets/shrine/dev/check_vows.js
   ============================================================ */
const GEO = require("../../shared/geom.js");
const VOWS = require("../vows.js");

const TILTS = [];
for (let t = -90; t <= 90; t += 5) TILTS.push(t);

const APEX_SNAP = 7;
const APEX = new Set(["squarePyramid", "tetra", "cone"]);
function assist(tilt, solid) {
  if (!APEX.has(solid)) return tilt;
  if (tilt > 90 - APEX_SNAP) return 90;
  if (tilt < -90 + APEX_SNAP) return -90;
  return tilt;
}

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

/* the game's plane: through the origin, normal (sin t, cos t, 0) */
function normalAt(tilt) {
  const a = (tilt * Math.PI) / 180;
  return [Math.sin(a), Math.cos(a), 0];
}

function kindAt(tris, tilt) {
  const sec = GEO.sectionAt(tris, normalAt(tilt), 0);
  return sec ? GEO.classify(sec.hull2).kind : null;
}

let fail = 0;
console.log("vow                 solid          yaw  wins  window  declared  verdict");
console.log("---------------------------------------------------------------------------");

for (const v of VOWS) {
  const tris = rotY(trisFor(v.solid), v.yaw);
  const wins = TILTS.filter((t) => v.accept.includes(kindAt(tris, assist(t, v.solid))));
  const ok = wins.length > 0;
  const idealOk = ok && v.accept.includes(kindAt(tris, assist(v.tilt, v.solid)));
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
