/* ============================================================
   dev/gen_vows.js — what can a centre cut actually expose?

   Final control model: the blade is hinged on the world Z axis
   (normal n = (sin t, cos t, 0)), it always passes through the
   spirit's centre, and the player's only input is the swipe angle
   (0..90 in 5 degree steps).  The turn comes from the yaw each vow
   spawns its solid at.

   So a vow is valid iff some yaw makes the target appear at
   depth 0 for a usable range of tilts.

   Run:  node assets/shrine/dev/gen_vows.js
   ============================================================ */
const GEO = require("../../shared/geom.js");

const TILTS = [];
for (let t = 0; t <= 90; t += 5) TILTS.push(t);
const YAWS = [];
for (let y = 0; y < 180; y += 15) YAWS.push(y);

function rotY(tris, deg) {
  if (!deg) return tris;
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return tris.map((t) => t.map((p) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]));
}

function kindAt(tris, tilt) {
  const pl = GEO.planeAt(tris, tilt, 0, 0);
  const sec = GEO.sectionAt(tris, pl.n, pl.s);
  return sec ? GEO.classify(sec.hull2).kind : null;
}

const SOLIDS = ["cube", "cuboid", "triPrism", "hexPrism", "squarePyramid", "cylinder", "cone", "sphere"];
const cache = {};

console.log("solid           shape               yaw   tilts that work (of 19)   window");
console.log("---------------------------------------------------------------------------------");

for (const key of SOLIDS) {
  if (!cache[key]) cache[key] = GEO.trianglesOf(GEO.SOLIDS[key].make());
  const base = cache[key];

  const best = {};
  for (const yaw of YAWS) {
    const tris = rotY(base, yaw);
    const byKind = {};
    for (const t of TILTS) {
      const k = kindAt(tris, t);
      if (!k) continue;
      (byKind[k] = byKind[k] || []).push(t);
    }
    for (const k of Object.keys(byKind)) {
      const list = byKind[k];
      if (!best[k] || list.length > best[k].tilts.length) best[k] = { yaw, tilts: list };
    }
  }

  const rows = Object.keys(best)
    .filter((k) => ["none", "truncated", "quadrilateral", "polygon"].indexOf(k) < 0)
    .sort((a, b) => best[b].tilts.length - best[a].tilts.length);

  for (const k of rows) {
    const b = best[k];
    const span = b.tilts.length > 1
      ? b.tilts[0] + " to " + b.tilts[b.tilts.length - 1]
      : b.tilts[0] + "";
    console.log(
      key.padEnd(15) + GEO.NAMES[k][0].padEnd(19) +
      String(b.yaw).padStart(3) + "   " +
      String(b.tilts.length).padStart(2) + "                  " + span
    );
  }
}
