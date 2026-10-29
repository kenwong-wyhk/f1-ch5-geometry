/* ============================================================
   Construction Bench · 5.3 Basic Constructions
   Seven constructions on one sheet of paper. The student draws
   with a ruler, a pair of compasses, a protractor and a set
   square; the sheet checks the geometry, not the drawing.
   Every figure is drawn in ink; the one red is the mark being
   made.
   ============================================================ */
(function () {
  "use strict";

  var board = document.getElementById("board");
  if (!board) return;

  var NS = "http://www.w3.org/2000/svg";
  var CM = 48;                 // user units per centimetre
  var PW = 16, PH = 10.5;      // the sheet, in centimetres
  var VW = PW * CM, VH = PH * CM;
  var ARM = 7;                 // the length of a ray the protractor lays down
  var PROTO = 4.4;             // the protractor's radius

  /* ---------- 1. geometry ---------- */

  function d2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function len(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
  function unit(a) { var l = len(a) || 1; return { x: a.x / l, y: a.y / l }; }
  function perp(a) { return { x: -a.y, y: a.x }; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function angleOf(v) { return deg(Math.atan2(v.y, v.x)); }
  function dirOf(a) { return { x: Math.cos(rad(a)), y: Math.sin(rad(a)) }; }
  function polar(o, r, a) { return { x: o.x + r * Math.cos(rad(a)), y: o.y + r * Math.sin(rad(a)) }; }
  function normDeg(a) { a = a % 360; if (a > 180) a -= 360; if (a <= -180) a += 360; return a; }
  function inside(p) { return p.x > -0.2 && p.x < PW + 0.2 && p.y > -0.2 && p.y < PH + 0.2; }

  /* the angle between two rays from a common point, 0 to 180 */
  function rayAngle(u, v) {
    var c = dot(u, v) / ((len(u) || 1) * (len(v) || 1));
    return deg(Math.acos(clamp(c, -1, 1)));
  }

  /* the acute angle between two lines, 0 to 90 */
  function lineDiff(a, b) {
    var d = Math.abs(normDeg(a - b));
    return d > 90 ? 180 - d : d;
  }

  function pointLineDist(p, a, b) {
    var v = sub(b, a), l = len(v);
    if (!l) return d2(p, a);
    return Math.abs(cross(v, sub(p, a))) / l;
  }

  function projectOnLine(p, a, b) {
    var v = sub(b, a), l2 = dot(v, v);
    if (!l2) return { x: a.x, y: a.y };
    return add(a, mul(v, dot(sub(p, a), v) / l2));
  }

  function lineLine(s1, s2) {
    var d1 = sub(s1.b, s1.a), d2v = sub(s2.b, s2.a);
    var den = cross(d1, d2v);
    if (Math.abs(den) < 1e-9) return null;
    var t = cross(sub(s2.a, s1.a), d2v) / den;
    var p = add(s1.a, mul(d1, t));
    return inside(p) ? p : null;
  }

  function lineCircle(s, c) {
    var d = sub(s.b, s.a), f = sub(s.a, c.c);
    var A = dot(d, d), B = 2 * dot(f, d), C = dot(f, f) - c.r * c.r;
    var disc = B * B - 4 * A * C;
    if (disc < 0 || A === 0) return [];
    var sq = Math.sqrt(disc);
    return [(-B + sq) / (2 * A), (-B - sq) / (2 * A)]
      .map(function (t) { return add(s.a, mul(d, t)); })
      .filter(inside);
  }

  function circleCircle(c1, c2) {
    var dx = c2.c.x - c1.c.x, dy = c2.c.y - c1.c.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d === 0 || d > c1.r + c2.r || d < Math.abs(c1.r - c2.r)) return [];
    var a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
    var h = Math.sqrt(Math.max(0, c1.r * c1.r - a * a));
    var mx = c1.c.x + a * dx / d, my = c1.c.y + a * dy / d;
    return [
      { x: mx + h * dy / d, y: my - h * dx / d },
      { x: mx - h * dy / d, y: my + h * dx / d }
    ].filter(inside);
  }

  function segCross(s1, s2) {
    var p = lineLine(s1, s2);
    if (!p) return null;
    function within(s, q) {
      var v = sub(s.b, s.a), t = dot(sub(q, s.a), v) / dot(v, v);
      return t > -0.02 && t < 1.02;
    }
    return within(s1, p) && within(s2, p) ? p : null;
  }

  function sharedPoint(s1, s2) {
    var pairs = [[s1.a, s2.a], [s1.a, s2.b], [s1.b, s2.a], [s1.b, s2.b]];
    for (var i = 0; i < pairs.length; i++) {
      if (d2(pairs[i][0], pairs[i][1]) < 0.16) return pairs[i][0];
    }
    return null;
  }

  function clipT(p, u) {
    var pad = 0.12, tmin = -1e6, tmax = 1e6, t;
    if (Math.abs(u.x) < 1e-9) {
      if (p.x < pad || p.x > PW - pad) return null;
    } else {
      t = [(pad - p.x) / u.x, (PW - pad - p.x) / u.x];
      tmin = Math.max(tmin, Math.min(t[0], t[1]));
      tmax = Math.min(tmax, Math.max(t[0], t[1]));
    }
    if (Math.abs(u.y) < 1e-9) {
      if (p.y < pad || p.y > PH - pad) return null;
    } else {
      t = [(pad - p.y) / u.y, (PH - pad - p.y) / u.y];
      tmin = Math.max(tmin, Math.min(t[0], t[1]));
      tmax = Math.min(tmax, Math.max(t[0], t[1]));
    }
    return tmin > tmax ? null : [tmin, tmax];
  }

  /* ---------- 2. the seven tasks ---------- */

  var TASKS = [
    {
      id: "perp",
      title: "Perpendicular through a point",
      zh: "過一點作垂線",
      brief: "CD is given, with E above it. Construct the line through E that is perpendicular to CD.",
      data: "Given: line CD, point E",
      tool: "setsquare", sq: "perp",
      points: { C: [2.6, 9.6], D: [14.4, 6.4], E: [6.0, 3.8] },
      segments: [["C", "D"]],
      labels: [{ on: ["C", "D"], text: "CD" }],
      steps: [
        "Put one edge of the set square along CD.",
        "Hold the ruler against the set square's other edge and slide the square until its first edge passes through E.",
        "Draw the line along that edge, from E down to CD.",
        "Mark the right angle where the two lines meet."
      ],
      checks: [
        {
          label: "A line passes through E",
          hint: "Nothing goes through E yet. The set square has to slide until its edge sits on the point.",
          test: function () { return throughPoint(G.pts.E).length > 0; }
        },
        {
          label: "It is at right angles to CD",
          hint: "It reaches E but it leans. Keep the square's corner on the line and its other edge on E.",
          test: function () {
            var cd = G.segs[0];
            return throughPoint(G.pts.E).some(function (s) { return perpTo(s, cd); });
          }
        },
        {
          label: "It actually reaches CD",
          hint: "A perpendicular has to meet the line. Extend your line until it crosses CD.",
          test: function () {
            var cd = G.segs[0];
            return throughPoint(G.pts.E).some(function (s) {
              return perpTo(s, cd) && segCross(s, cd);
            });
          }
        }
      ]
    },
    {
      id: "para",
      title: "Parallel through a point",
      zh: "過一點作平行線",
      brief: "CD is given, with E above it. Construct the line through E that is parallel to CD.",
      data: "Given: line CD, point E",
      tool: "setsquare", sq: "para",
      points: { C: [2.6, 9.2], D: [14.0, 6.2], E: [9.4, 3.4] },
      segments: [["C", "D"]],
      labels: [{ on: ["C", "D"], text: "CD" }],
      steps: [
        "Lay one edge of the set square along CD.",
        "Press the ruler against the square's hypotenuse and hold the ruler still.",
        "Slide the square along the ruler until its first edge passes through E.",
        "Draw the line. It never meets CD, however far you extend it."
      ],
      checks: [
        {
          label: "A line passes through E",
          hint: "Nothing goes through E yet. Slide the square until its edge sits on the point.",
          test: function () { return throughPoint(G.pts.E).length > 0; }
        },
        {
          label: "It is parallel to CD",
          hint: "It reaches E but it is not parallel. If the ruler moved while you slid the square, start again.",
          test: function () {
            var cd = G.segs[0];
            return throughPoint(G.pts.E).some(function (s) { return parallelTo(s, cd); });
          }
        },
        {
          label: "It is a separate line, not CD",
          hint: "That is CD itself. The new line has to sit away from it, through E.",
          test: function () {
            var cd = G.segs[0];
            return throughPoint(G.pts.E).some(function (s) {
              return parallelTo(s, cd) && pointLineDist(s.a, cd.a, cd.b) > 0.8;
            });
          }
        }
      ]
    },
    {
      id: "sss",
      title: "Three sides",
      zh: "已知三邊作三角形",
      brief: "AB is given. Construct triangle ABC with AC = 7.5 cm and BC = 4.5 cm.",
      data: "Given: AB = 6 cm · AC = 7.5 cm · BC = 4.5 cm",
      tool: "compass",
      points: { A: [5.6, 9.2], B: [11.6, 9.2] },
      segments: [["A", "B"]],
      target: { C: [11.6, 4.7] },
      labels: [{ on: ["A", "B"], text: "AB = 6 cm" }],
      steps: [
        "Set the compasses to 7.5 cm and strike an arc from A.",
        "Set them to 4.5 cm and strike an arc from B.",
        "The two arcs cross at C. Mark it.",
        "Join AC and BC with the ruler."
      ],
      checks: [
        {
          label: "An arc of 7.5 cm centred on A",
          hint: "Open the compasses to 7.5 cm, put the needle on A and draw the arc.",
          test: function () { return arcsAt(G.pts.A, 7.5).length > 0; }
        },
        {
          label: "An arc of 4.5 cm centred on B",
          hint: "Change the opening to 4.5 cm and put the needle on B. Do not change it again.",
          test: function () { return arcsAt(G.pts.B, 4.5).length > 0; }
        },
        {
          label: "C sits where the arcs cross",
          hint: "The vertex is the crossing point of the two arcs. Click there so the ruler can find it.",
          test: function () { return !!found(G.target.C); }
        },
        {
          label: "AC is drawn",
          hint: "Join A to C.",
          test: function () { return sideDrawn(G.pts.A, G.target.C); }
        },
        {
          label: "BC is drawn",
          hint: "Join B to C.",
          test: function () { return sideDrawn(G.pts.B, G.target.C); }
        }
      ]
    },
    {
      id: "sas",
      title: "Two sides and the angle between them",
      zh: "已知兩邊及其夾角",
      brief: "DE is given. Construct triangle DEF with DF = 2 cm and ∠FDE = 60°.",
      data: "Given: DE = 5 cm · DF = 2 cm · ∠FDE = 60°",
      tool: "protractor",
      points: { D: [5.8, 9.4], E: [10.8, 9.4] },
      segments: [["D", "E"]],
      target: { F: [6.8, 7.668] },
      labels: [{ on: ["D", "E"], text: "DE = 5 cm" }],
      steps: [
        "Lay the protractor on DE with its centre on D and 0° along DE.",
        "Read 60° and draw a ray from D.",
        "Mark F on that ray, 2 cm from D.",
        "Join EF."
      ],
      checks: [
        {
          label: "A ray leaves D at 60°",
          hint: "Put the protractor's centre on D, its 0° line on DE, and swing to 60°.",
          test: function () { return armFrom(G.pts.D, G.pts.E, 60).length > 0; }
        },
        {
          label: "DF is 2 cm",
          hint: "Mark the point 2 cm from D along that ray, then check the length with the ruler.",
          test: function () { return !!armPoint(G.pts.D, G.pts.E, 60, 2); }
        },
        {
          label: "EF is drawn",
          hint: "Join E to F to close the triangle.",
          test: function () {
            var p = armPoint(G.pts.D, G.pts.E, 60, 2);
            return !!p && sideDrawn(G.pts.E, p);
          }
        }
      ]
    },
    {
      id: "asa",
      title: "Two angles and the side between them",
      zh: "已知兩角及其夾邊",
      brief: "IJ is given. Construct triangle HIJ with ∠HIJ = 100° and ∠HJI = 30°.",
      data: "Given: IJ = 4 cm · ∠HIJ = 100° · ∠HJI = 30°",
      tool: "protractor",
      points: { I: [7.4, 9.8], J: [11.4, 9.8] },
      segments: [["I", "J"]],
      target: { H: [6.9466, 7.2290] },
      labels: [{ on: ["I", "J"], text: "IJ = 4 cm" }],
      steps: [
        "At I, lay the 0° line on IJ and draw a ray at 100°.",
        "At J, lay the 0° line on JI and draw a ray at 30°.",
        "The two rays cross at H.",
        "IJ is already drawn, so the triangle is closed."
      ],
      checks: [
        {
          label: "A ray leaves I at 100°",
          hint: "Centre on I, 0° along IJ, then swing round past 90° to 100°.",
          test: function () { return armFrom(G.pts.I, G.pts.J, 100).length > 0; }
        },
        {
          label: "A ray leaves J at 30°",
          hint: "Centre on J this time, with 0° along JI, and swing to 30°.",
          test: function () { return armFrom(G.pts.J, G.pts.I, 30).length > 0; }
        },
        {
          label: "The two rays meet at H",
          hint: "The arms have to cross. Extend one of them until it reaches the other.",
          test: function () {
            var a = armFrom(G.pts.I, G.pts.J, 100), b = armFrom(G.pts.J, G.pts.I, 30);
            return meetNear(a, b, G.target.H);
          }
        }
      ]
    },
    {
      id: "aas",
      title: "Two angles and a side that is not between them",
      zh: "已知兩角及非夾邊",
      brief: "NP is given. Construct triangle MNP with ∠MNP = 80° and ∠NMP = 55°. Neither angle touches the given side at P, so find the angle at P first.",
      data: "Given: NP = 3.5 cm · ∠MNP = 80° · ∠NMP = 55°",
      tool: "protractor",
      points: { N: [7.8, 9.8], P: [11.3, 9.8] },
      segments: [["N", "P"]],
      target: { M: [8.3246, 6.8247] },
      labels: [{ on: ["N", "P"], text: "NP = 3.5 cm" }],
      steps: [
        "Find the third angle: ∠MPN = 180° − 80° − 55° = 45°.",
        "At N, draw a ray at 80° from NP.",
        "At P, draw a ray at 45° from PN.",
        "The rays cross at M."
      ],
      checks: [
        {
          label: "A ray leaves N at 80°",
          hint: "Centre on N, 0° along NP, swing to 80°.",
          test: function () { return armFrom(G.pts.N, G.pts.P, 80).length > 0; }
        },
        {
          label: "A ray leaves P at 45°",
          hint: "The angle at P is not given. Work it out: 180° − 80° − 55° = 45°.",
          test: function () { return armFrom(G.pts.P, G.pts.N, 45).length > 0; }
        },
        {
          label: "The two rays meet at M",
          hint: "The arms have to cross, and the crossing is the vertex M.",
          test: function () {
            var a = armFrom(G.pts.N, G.pts.P, 80), b = armFrom(G.pts.P, G.pts.N, 45);
            return meetNear(a, b, G.target.M);
          }
        }
      ]
    },
    {
      id: "rhs",
      title: "A right angle, the hypotenuse and one side",
      zh: "已知直角、斜邊及一邊",
      brief: "YZ is given. Construct triangle XYZ with ∠XYZ = 90° and XZ = 4 cm.",
      data: "Given: YZ = 2.5 cm · XZ = 4 cm · ∠XYZ = 90°",
      tool: "setsquare", sq: "perp",
      points: { Y: [8.6, 9.6], Z: [11.1, 9.6] },
      segments: [["Y", "Z"]],
      target: { X: [8.6, 6.4775] },
      labels: [{ on: ["Y", "Z"], text: "YZ = 2.5 cm" }],
      steps: [
        "Construct the perpendicular to YZ at Y with the set square.",
        "Set the compasses to 4 cm and strike an arc from Z.",
        "Where the arc cuts the perpendicular is X.",
        "Join XZ."
      ],
      checks: [
        {
          label: "A perpendicular to YZ at Y",
          hint: "Lay the set square on YZ and draw through Y at a right angle.",
          test: function () {
            var yz = G.segs[0];
            return throughPoint(G.pts.Y).some(function (s) { return perpTo(s, yz); });
          }
        },
        {
          label: "X is 4 cm from Z, on that perpendicular",
          hint: "Strike an arc of 4 cm from Z, or measure 4 cm from Z with the ruler until it meets the perpendicular.",
          test: function () { return !!found(G.target.X); }
        },
        {
          label: "XZ is drawn",
          hint: "Join Z to X. That side is the hypotenuse.",
          test: function () { return sideDrawn(G.pts.Z, G.target.X); }
        }
      ]
    }
  ];

  /* ---------- 3. state ---------- */

  var state = {
    ti: 0,
    tool: "setsquare",
    sq: "perp",
    compassR: 4.5,
    marks: { segments: [], circles: [] },
    draft: null,
    hover: null,
    attempts: 0,
    passed: false,
    results: null,
    history: [],
    cache: null
  };

  var G = null;
  var store = { done: {}, clean: {} };
  var KEY = "ch05-construction-bench";

  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.done) store = parsed;
    }
  } catch (err) { /* storage blocked: the bench still works, it just forgets */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (err) { /* ignore */ }
  }

  /* ---------- 4. predicates the checks use ---------- */

  function throughPoint(p, tol) {
    return state.marks.segments.filter(function (s) {
      return pointLineDist(p, s.a, s.b) < (tol || 0.16);
    });
  }

  function segAngle(s) { return angleOf(sub(s.b, s.a)); }

  function perpTo(s, line) {
    return lineDiff(segAngle(s), segAngle(line)) > 88.5;
  }

  function parallelTo(s, line) {
    return lineDiff(segAngle(s), segAngle(line)) < 1.5;
  }

  function arcsAt(p, r) {
    return state.marks.circles.filter(function (c) {
      return d2(c.c, p) < 0.22 && Math.abs(c.r - r) < 0.16;
    });
  }

  function sideDrawn(p, q, tol) {
    tol = tol || 0.14;
    return state.marks.segments.some(function (s) {
      if (pointLineDist(p, s.a, s.b) > tol) return false;
      if (pointLineDist(q, s.a, s.b) > tol) return false;
      var u = unit(sub(s.b, s.a)), L = d2(s.a, s.b);
      var t1 = dot(sub(p, s.a), u), t2 = dot(sub(q, s.a), u);
      return Math.min(t1, t2) > -0.18 && Math.max(t1, t2) < L + 0.18;
    });
  }

  /* segments leaving V at an angle to the ray VA */
  function armFrom(V, A, deg0, tol) {
    tol = tol || 2.2;
    return state.marks.segments.filter(function (s) {
      var far = null;
      if (d2(s.a, V) < 0.2) far = s.b;
      else if (d2(s.b, V) < 0.2) far = s.a;
      if (!far) return false;
      return Math.abs(rayAngle(sub(A, V), sub(far, V)) - deg0) < tol;
    });
  }

  /* the point marked at len along the arm */
  function armPoint(V, A, deg0, want) {
    var pts = allPoints();
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (Math.abs(d2(V, p) - want) > 0.2) continue;
      if (Math.abs(rayAngle(sub(A, V), sub(p, V)) - deg0) > 2.6) continue;
      return p;
    }
    return null;
  }

  function meetNear(a, b, target) {
    for (var i = 0; i < a.length; i++) {
      for (var j = 0; j < b.length; j++) {
        var p = segCross(a[i], b[j]);
        if (p && d2(p, target) < 0.32) return true;
      }
    }
    return false;
  }

  function playerPoints() {
    var out = [];
    state.marks.segments.forEach(function (s) { out.push(s.a, s.b); });
    state.marks.circles.forEach(function (c) { out.push(c.c); });
    return out;
  }

  /* every point the sheet now holds: what was clicked, and every crossing
     the student's own lines and arcs make. A vertex found by two rays
     crossing is still a vertex. */
  function allPoints() {
    var out = playerPoints(), lines = G.segs.concat(state.marks.segments), i, j;
    for (i = 0; i < lines.length; i++) {
      for (j = i + 1; j < lines.length; j++) {
        var p = lineLine(lines[i], lines[j]);
        if (p) out.push(p);
      }
      for (j = 0; j < state.marks.circles.length; j++) {
        lineCircle(lines[i], state.marks.circles[j]).forEach(function (q) { out.push(q); });
      }
    }
    for (i = 0; i < state.marks.circles.length; i++) {
      for (j = i + 1; j < state.marks.circles.length; j++) {
        circleCircle(state.marks.circles[i], state.marks.circles[j]).forEach(function (q) { out.push(q); });
      }
    }
    return out;
  }

  function foundIn(pts, p) {
    for (var i = 0; i < pts.length; i++) if (d2(pts[i], p) < 0.3) return pts[i];
    return null;
  }

  function found(p) { return foundIn(allPoints(), p); }

  /* ---------- 5. snapping ---------- */

  function pxPerCm() {
    var r = board.getBoundingClientRect();
    return (r.width || VW) / PW;
  }

  function snapR() { return clamp(13 / pxPerCm(), 0.16, 0.62); }

  function candidates() {
    if (state.cache) return state.cache;
    var out = [], seen = [];
    function push(p, name) {
      if (!p || !inside(p)) return;
      for (var i = 0; i < seen.length; i++) if (d2(seen[i], p) < 0.05) return;
      seen.push(p);
      out.push({ p: { x: p.x, y: p.y }, name: name || null });
    }
    for (var k in G.pts) push(G.pts[k], k);
    state.marks.segments.forEach(function (s) { push(s.a); push(s.b); });
    state.marks.circles.forEach(function (c) { push(c.c); });

    var lines = G.segs.concat(state.marks.segments);
    var i, j;
    for (i = 0; i < lines.length; i++) {
      for (j = i + 1; j < lines.length; j++) push(lineLine(lines[i], lines[j]));
      for (j = 0; j < state.marks.circles.length; j++) {
        lineCircle(lines[i], state.marks.circles[j]).forEach(function (p) { push(p); });
      }
    }
    for (i = 0; i < state.marks.circles.length; i++) {
      for (j = i + 1; j < state.marks.circles.length; j++) {
        circleCircle(state.marks.circles[i], state.marks.circles[j]).forEach(function (p) { push(p); });
      }
    }
    state.cache = out;
    return out;
  }

  function snapPoint(raw) {
    var r = snapR(), best = null, bd = r;
    candidates().forEach(function (c) {
      var d = d2(c.p, raw);
      if (d < bd) { bd = d; best = c; }
    });
    return best ? { x: best.p.x, y: best.p.y, name: best.name } : null;
  }

  function snapEnd(p0, raw) {
    var s = snapPoint(raw);
    if (s) return s;
    var v = sub(raw, p0);
    if (len(v) < 1e-6) return { x: raw.x, y: raw.y };
    var want = Math.max(0.2, Math.round(len(v) * 10) / 10);
    var p = add(p0, mul(unit(v), want));
    /* a length rounded to 0.1 cm may sit a hair off a line: put it back on */
    var lines = G.segs.concat(state.marks.segments), best = null, bd = 0.12;
    lines.forEach(function (s2) {
      var q = projectOnLine(p, s2.a, s2.b);
      var d = d2(q, p);
      if (d < bd) { bd = d; best = q; }
    });
    if (best) return { x: best.x, y: best.y };
    return { x: p.x, y: p.y };
  }

  function nearestSegment(p, tol) {
    var lines = G.segs.concat(state.marks.segments), best = null, bd = tol;
    lines.forEach(function (s) {
      var d = pointLineDist(p, s.a, s.b);
      if (d < bd) { bd = d; best = s; }
    });
    return best;
  }

  function eraseAt(p) {
    var i, tol = 0.34;
    for (i = state.marks.circles.length - 1; i >= 0; i--) {
      var c = state.marks.circles[i];
      if (Math.abs(d2(c.c, p) - c.r) < tol) {
        pushHistory(); state.marks.circles.splice(i, 1); changed(); return true;
      }
    }
    for (i = state.marks.segments.length - 1; i >= 0; i--) {
      var s = state.marks.segments[i];
      if (pointLineDist(p, s.a, s.b) > tol) continue;
      var u = unit(sub(s.b, s.a)), L = d2(s.a, s.b);
      var t = dot(sub(p, s.a), u);
      if (t < -0.1 || t > L + 0.1) continue;
      pushHistory(); state.marks.segments.splice(i, 1); changed(); return true;
    }
    return false;
  }

  /* ---------- 6. drawing ---------- */

  var layer = {};
  function group(id) {
    if (!layer[id]) layer[id] = document.getElementById(id);
    return layer[id];
  }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) {
      if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function X(v) { return v * CM; }

  function label(g, x, y, str, cls, anchor) {
    var t = el("text", {
      x: X(x), y: X(y), class: cls || "b-label",
      "text-anchor": anchor || "middle"
    }, g);
    t.textContent = str;
    return t;
  }

  function squareMark(g, v, u1, u2, s) {
    var a = add(v, mul(u1, s));
    var b = add(a, mul(u2, s));
    var c = add(v, mul(u2, s));
    el("path", {
      d: "M " + X(a.x) + " " + X(a.y) + " L " + X(b.x) + " " + X(b.y) + " L " + X(c.x) + " " + X(c.y),
      class: "b-right"
    }, g);
  }

  function renderSheet() {
    var g = group("layer-sheet");
    g.innerHTML = "";
    el("rect", { x: 0, y: 0, width: VW, height: VH, class: "b-paper" }, g);
    for (var i = 1; i < PW; i++) {
      el("line", { x1: i * CM, y1: 0, x2: i * CM, y2: VH, class: "b-grid" }, g);
    }
    for (var j = 1; j < PH; j++) {
      el("line", { x1: 0, y1: j * CM, x2: VW, y2: j * CM, class: "b-grid" }, g);
    }
    el("rect", { x: 0.5, y: 0.5, width: VW - 1, height: VH - 1, class: "b-edge" }, g);
  }

  function renderGiven() {
    var g = group("layer-given");
    g.innerHTML = "";
    G.segs.forEach(function (s) {
      el("line", { x1: X(s.a.x), y1: X(s.a.y), x2: X(s.b.x), y2: X(s.b.y), class: "b-given-line" }, g);
    });
    for (var k in G.pts) {
      var p = G.pts[k];
      el("circle", { cx: X(p.x), cy: X(p.y), r: 4.6, class: "b-given-dot" }, g);
      label(g, p.x + 0.34, p.y - 0.36, k, "b-name", "start");
    }
    (G.labels || []).forEach(function (l) {
      var a = G.pts[l.on[0]], b = G.pts[l.on[1]];
      var m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      var u = unit(sub(b, a)), n = perp(u);
      /* the length sits on the far side of the line, away from the figure */
      if (n.y < 0) n = mul(n, -1);
      label(g, m.x + n.x * 0.55, m.y + n.y * 0.55, l.text, "b-dim");
    });
  }

  function renderMarks() {
    var g = group("layer-marks");
    g.innerHTML = "";
    state.marks.circles.forEach(function (c) {
      el("circle", { cx: X(c.c.x), cy: X(c.c.y), r: X(c.r), class: "b-arc" }, g);
      el("circle", { cx: X(c.c.x), cy: X(c.c.y), r: 2, class: "b-centre" }, g);
    });
    state.marks.segments.forEach(function (s) {
      el("line", {
        x1: X(s.a.x), y1: X(s.a.y), x2: X(s.b.x), y2: X(s.b.y), class: "b-line"
      }, g);
    });

    /* a right angle the student has actually constructed gets its mark */
    var all = G.segs.concat(state.marks.segments), seenV = [], i, j;
    for (i = 0; i < all.length; i++) {
      for (j = i + 1; j < all.length; j++) {
        if (Math.abs(lineDiff(segAngle(all[i]), segAngle(all[j])) - 90) > 1.5) continue;
        var v = sharedPoint(all[i], all[j]) || segCross(all[i], all[j]);
        if (!v) continue;
        if (seenV.some(function (q) { return d2(q, v) < 0.3; })) continue;
        seenV.push(v);
        var e1 = d2(all[i].a, v) > d2(all[i].b, v) ? all[i].a : all[i].b;
        var e2 = d2(all[j].a, v) > d2(all[j].b, v) ? all[j].a : all[j].b;
        squareMark(g, v, unit(sub(e1, v)), unit(sub(e2, v)), 0.32);
      }
    }
    playerPoints().forEach(function (p) {
      el("circle", { cx: X(p.x), cy: X(p.y), r: 3.2, class: "b-dot" }, g);
    });
    var seen = allPoints();
    for (var k in (G.target || {})) {
      var hit = foundIn(seen, G.target[k]);
      if (!hit) continue;
      el("circle", { cx: X(hit.x), cy: X(hit.y), r: 8, class: "b-found-ring" }, g);
      label(g, hit.x + 0.36, hit.y - 0.4, k, "b-name-red", "start");
    }
  }

  function renderGuide() {
    var g = group("layer-guide");
    g.innerHTML = "";
    var d = state.draft, h = state.hover;

    if (d && d.tool === "protractor") drawProtractor(g, d);
    if (d && d.tool === "setsquare") drawSetSquare(g, d, h);
    if (d && d.tool === "ruler" && h) drawRuler(g, d, h);
    if (state.tool === "compass" && h && !d) {
      el("circle", { cx: X(h.x), cy: X(h.y), r: X(state.compassR), class: "b-guide" }, g);
      dimChip(g, h.x, h.y - state.compassR - 0.4, state.compassR.toFixed(1) + " cm");
    }
    if (h && (state.tool !== "eraser") && (state.tool !== "protractor" || !d)) {
      el("path", {
        d: "M " + (X(h.x) - 7) + " " + X(h.y) + " h 14 M " + X(h.x) + " " + (X(h.y) - 7) + " v 14",
        class: "b-snap"
      }, g);
    }
  }

  function drawRuler(g, d, h) {
    var p1 = snapEnd(d.p0, h);
    el("line", { x1: X(d.p0.x), y1: X(d.p0.y), x2: X(p1.x), y2: X(p1.y), class: "b-guide" }, g);
    el("circle", { cx: X(d.p0.x), cy: X(d.p0.y), r: 5, class: "b-guide-dot" }, g);
    var m = { x: (d.p0.x + p1.x) / 2, y: (d.p0.y + p1.y) / 2 };
    dimChip(g, m.x, m.y, d2(d.p0, p1).toFixed(1) + " cm");
  }

  function drawSetSquare(g, d, h) {
    if (!h) return;
    var base = d.line;
    var ang = segAngle(base) + (state.sq === "perp" ? 90 : 0);
    var u = dirOf(ang), t = clipT(h, u);
    if (t) {
      el("line", {
        x1: X(h.x + u.x * t[0]), y1: X(h.y + u.y * t[0]),
        x2: X(h.x + u.x * t[1]), y2: X(h.y + u.y * t[1]), class: "b-guide"
      }, g);
    }
    el("line", {
      x1: X(base.a.x), y1: X(base.a.y), x2: X(base.b.x), y2: X(base.b.y), class: "b-picked"
    }, g);

    /* the square's other edge: the perpendicular from the point to the line */
    var foot = projectOnLine(h, base.a, base.b);
    el("line", { x1: X(h.x), y1: X(h.y), x2: X(foot.x), y2: X(foot.y), class: "b-guide-soft" }, g);
    var n = unit(sub(h, foot));
    if (len(sub(h, foot)) > 0.3) {
      var uB = unit(sub(base.b, base.a)), s = 0.42;
      var q1 = add(foot, mul(uB, s));
      var q2 = add(q1, mul(n, s));
      var q3 = add(foot, mul(n, s));
      el("path", {
        d: "M " + X(q1.x) + " " + X(q1.y) + " L " + X(q2.x) + " " + X(q2.y) + " L " + X(q3.x) + " " + X(q3.y),
        class: "b-square"
      }, g);
    }
  }

  function drawProtractor(g, d) {
    var V = d.V, base = d.armAngle, sign = d.sign || 1;
    var p0 = polar(V, PROTO, base), p1 = polar(V, PROTO, base + sign * 180);
    el("path", {
      d: "M " + X(V.x) + " " + X(V.y) +
         " L " + X(p0.x) + " " + X(p0.y) +
         " A " + X(PROTO) + " " + X(PROTO) + " 0 0 " + (sign > 0 ? 1 : 0) + " " + X(p1.x) + " " + X(p1.y) +
         " Z",
      class: "b-proto-fill"
    }, g);
    el("path", {
      d: "M " + X(p0.x) + " " + X(p0.y) +
         " A " + X(PROTO) + " " + X(PROTO) + " 0 0 " + (sign > 0 ? 1 : 0) + " " + X(p1.x) + " " + X(p1.y),
      class: "b-proto-rim"
    }, g);

    for (var i = 0; i <= 180; i += 5) {
      var a = base + sign * i;
      var long = i % 30 === 0;
      var r2 = PROTO - (long ? 0.55 : i % 10 === 0 ? 0.4 : 0.26);
      var q1 = polar(V, PROTO, a), q2 = polar(V, r2, a);
      el("line", { x1: X(q1.x), y1: X(q1.y), x2: X(q2.x), y2: X(q2.y), class: "b-proto-tick" }, g);
      if (long) {
        var q3 = polar(V, PROTO - 0.85, a);
        label(g, q3.x, q3.y, String(i), "b-proto-num");
      }
    }

    var ray = base + sign * d.angle;
    var e = polar(V, Math.min(ARM, (clipT(V, dirOf(ray)) || [0, ARM])[1]), ray);
    el("line", { x1: X(V.x), y1: X(V.y), x2: X(e.x), y2: X(e.y), class: "b-accent-line" }, g);
    el("path", {
      d: "M " + X(polar(V, 1.15, base).x) + " " + X(polar(V, 1.15, base).y) +
         " A " + X(1.15) + " " + X(1.15) + " 0 0 " + (sign > 0 ? 1 : 0) + " " +
         X(polar(V, 1.15, ray).x) + " " + X(polar(V, 1.15, ray).y),
      class: "b-accent-arc"
    }, g);
    var mid = polar(V, 1.75, base + sign * d.angle / 2);
    label(g, mid.x, mid.y + 0.15, d.angle.toFixed(0) + "°", "b-readout");
  }

  function dimChip(g, x, y, str) {
    var t = el("text", { x: X(x), y: X(y), class: "b-chip-text" }, g);
    t.textContent = str;
  }

  function renderAll() {
    renderSheet();
    renderGiven();
    renderMarks();
    renderGuide();
  }

  function changed() {
    state.cache = null;
    renderMarks();
    renderGuide();
  }

  /* ---------- 7. committing marks ---------- */

  function pushHistory() {
    state.history.push(JSON.stringify(state.marks));
    if (state.history.length > 40) state.history.shift();
  }

  function commitSegment(a, b) {
    if (d2(a, b) < 0.25) return;
    pushHistory();
    state.marks.segments.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
    changed();
  }

  function commitCircle(c, r) {
    pushHistory();
    state.marks.circles.push({ c: { x: c.x, y: c.y }, r: r });
    changed();
  }

  function undo() {
    if (!state.history.length) return;
    state.marks = JSON.parse(state.history.pop());
    state.draft = null;
    changed();
    say("Undone.");
  }

  function clearMarks() {
    if (!state.marks.segments.length && !state.marks.circles.length) return;
    pushHistory();
    state.marks = { segments: [], circles: [] };
    state.draft = null;
    changed();
    say("Sheet cleared.");
  }

  /* ---------- 8. the tools ---------- */

  function toPaper(ev) {
    var r = board.getBoundingClientRect();
    return {
      x: clamp((ev.clientX - r.left) / r.width * PW, 0, PW),
      y: clamp((ev.clientY - r.top) / r.height * PH, 0, PH)
    };
  }

  function armAt(V, pointer) {
    var best = null;
    var near = d2(pointer, V) < 0.55;
    G.segs.concat(state.marks.segments).forEach(function (s) {
      var far = null;
      if (d2(s.a, V) < 0.2) far = s.b;
      else if (d2(s.b, V) < 0.2) far = s.a;
      else if (pointLineDist(V, s.a, s.b) < 0.14) far = d2(s.a, V) > d2(s.b, V) ? s.a : s.b;
      if (!far) return;
      var ang = angleOf(sub(far, V));
      var diff = Math.abs(normDeg(ang - angleOf(sub(pointer, V))));
      if (diff > 90) diff = 180 - diff;
      /* a click right on the vertex says nothing about direction, so the
         given side wins: that is the arm the protractor is laid on */
      if (near && G.segs.indexOf(s) > -1) diff = -1;
      if (!best || diff < best.diff) best = { ang: ang, diff: diff, seg: s };
    });
    return best;
  }

  function onClick(raw) {
    var p = snapPoint(raw) || { x: raw.x, y: raw.y };

    if (state.tool === "eraser") {
      if (!eraseAt(raw)) say("Nothing there. Click on one of your lines or arcs.");
      return;
    }

    if (state.tool === "ruler") {
      if (!state.draft || state.draft.tool !== "ruler") {
        state.draft = { tool: "ruler", p0: p };
        say("Start set. Click the end point, or drag and watch the length.");
      } else {
        var p1 = snapEnd(state.draft.p0, raw);
        if (d2(p1, state.draft.p0) < 0.25) { say("Too short. Click further away."); return; }
        commitSegment(state.draft.p0, p1);
        state.draft = null;
        say("Line drawn.");
      }
      renderGuide();
      return;
    }

    if (state.tool === "compass") {
      commitCircle(p, state.compassR);
      say("Arc drawn, radius " + state.compassR.toFixed(1) + " cm. Move the needle and click again.");
      return;
    }

    if (state.tool === "protractor") {
      if (!state.draft || state.draft.tool !== "protractor") {
        var arm = armAt(p, raw);
        state.draft = {
          tool: "protractor", V: p,
          armAngle: arm ? arm.ang : 0, armSeg: arm ? arm.seg : null,
          angle: 0, sign: 1
        };
        say(arm ? "Protractor on the arm. Swing to the angle, then click again."
                : "No line at this point. Centre the protractor on a vertex of a line.");
      } else {
        var d = state.draft;
        var dd = normDeg(angleOf(sub(raw, d.V)) - d.armAngle);
        var size = Math.abs(dd);
        if (size < 1) { say("Swing further out before clicking."); return; }
        var u = dirOf(d.armAngle + (dd < 0 ? -size : size));
        var t = clipT(d.V, u);
        var far = Math.min(ARM, t ? t[1] : ARM);
        commitSegment(d.V, add(d.V, mul(u, far)));
        state.draft = null;
        say("Ray drawn at " + size.toFixed(0) + "°. Now mark the length on it.");
      }
      renderGuide();
      return;
    }

    if (state.tool === "setsquare") {
      if (!state.draft || state.draft.tool !== "setsquare") {
        var line = nearestSegment(raw, 0.7);
        if (!line) { say("Click on a line first, then slide the square to the point."); return; }
        state.draft = { tool: "setsquare", line: line };
        say("Square on the line. Now click the point the new line must pass through.");
      } else {
        var base = state.draft.line;
        var a2 = segAngle(base) + (state.sq === "perp" ? 90 : 0);
        var u2 = dirOf(a2), t2 = clipT(p, u2);
        if (!t2) { say("That point is off the sheet. Click inside the paper."); return; }
        commitSegment(add(p, mul(u2, t2[0])), add(p, mul(u2, t2[1])));
        state.draft = null;
        say(state.sq === "perp" ? "Perpendicular drawn." : "Parallel drawn.");
      }
      renderGuide();
      return;
    }
  }

  /* ---------- 9. the interface ---------- */

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var hintEl = $("#bench-hint");
  var checkList = $("#task-checks");
  var feedback = $("#feedback");
  var checkBtn = $("#btn-check");
  var methodBtn = $("#btn-method");
  var stamp = $("#stamp");

  function say(msg) { if (hintEl) hintEl.textContent = msg; }

  function buildTask(i) {
    state.ti = i;
    var t = TASKS[i];
    G = { pts: {}, segs: [], target: {}, labels: t.labels || [] };
    for (var k in t.points) G.pts[k] = { x: t.points[k][0], y: t.points[k][1] };
    (t.segments || []).forEach(function (pair) {
      G.segs.push({ a: G.pts[pair[0]], b: G.pts[pair[1]] });
    });
    for (var k2 in (t.target || {})) G.target[k2] = { x: t.target[k2][0], y: t.target[k2][1] };

    state.marks = { segments: [], circles: [] };
    state.draft = null;
    state.hover = null;
    state.history = [];
    state.cache = null;
    state.attempts = 0;
    state.passed = false;
    state.results = null;

    setTool(t.tool || "setsquare", true);
    if (t.sq) setSquareMode(t.sq, true);

    $("#task-count").textContent = "Task " + (i + 1) + " of " + TASKS.length;
    $("#task-title").textContent = t.title;
    $("#task-zh").textContent = t.zh;
    $("#task-brief").textContent = t.brief;
    $("#task-data").textContent = t.data;

    checkList.innerHTML = "";
    t.checks.forEach(function (c, n) {
      var li = document.createElement("li");
      li.innerHTML = '<span class="mark" aria-hidden="true"></span><span class="tx"></span>';
      li.querySelector(".tx").textContent = c.label;
      li.setAttribute("data-i", n);
      checkList.appendChild(li);
    });

    if (stamp) { stamp.hidden = true; stamp.textContent = ""; }
    feedback.textContent = "";
    feedback.className = "task-feedback";
    methodBtn.hidden = true;
    checkBtn.textContent = "Check my construction";
    checkBtn.disabled = false;

    paintIndex();
    renderAll();
    say("Pick a tool, then click on the sheet.");
  }

  function paintChecks(results) {
    $$("#task-checks li").forEach(function (li, i) {
      var r = results[i];
      li.classList.toggle("ok", !!(r && r.ok));
      li.classList.toggle("bad", !!(r && !r.ok));
      li.querySelector(".mark").textContent = r ? (r.ok ? "✓" : "✗") : "";
    });
  }

  function evaluate() {
    return G ? TASKS[state.ti].checks.map(function (c) {
      var ok = false;
      try { ok = !!c.test(); } catch (err) { ok = false; }
      return { label: c.label, hint: c.hint, ok: ok };
    }) : [];
  }

  function onCheck() {
    if (state.passed) { nextTask(); return; }
    if (!state.marks.segments.length && !state.marks.circles.length) {
      feedback.textContent = "The sheet is empty. Draw something first.";
      feedback.className = "task-feedback bad";
      return;
    }
    state.attempts++;
    var res = evaluate();
    state.results = res;
    paintChecks(res);
    var failed = res.filter(function (r) { return !r.ok; });

    if (!failed.length) {
      state.passed = true;
      store.done[TASKS[state.ti].id] = true;
      if (state.attempts === 1) store.clean[TASKS[state.ti].id] = true;
      save();
      paintIndex();
      feedback.textContent = state.attempts === 1
        ? "Correct first time. Every arc where it should be."
        : "Correct. That is the construction.";
      feedback.className = "task-feedback ok";
      if (stamp) {
        stamp.hidden = false;
        stamp.textContent = state.attempts === 1 ? "Constructed, first try" : "Constructed";
      }
      checkBtn.textContent = state.ti < TASKS.length - 1 ? "Next task" : "Start again";
      methodBtn.hidden = true;
      say("Constructed. Press Next task, or read the notes under the bench.");
    } else {
      feedback.textContent = failed[0].hint;
      feedback.className = "task-feedback bad";
      if (state.attempts >= 2) methodBtn.hidden = false;
      say(failed.length + (failed.length === 1 ? " condition" : " conditions") + " still to satisfy.");
    }
  }

  function nextTask() {
    buildTask((state.ti + 1) % TASKS.length);
    board.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function showMethod() {
    var t = TASKS[state.ti];
    feedback.innerHTML = "";
    var ol = document.createElement("ol");
    ol.className = "method-list";
    t.steps.forEach(function (s) {
      var li = document.createElement("li");
      li.textContent = s;
      ol.appendChild(li);
    });
    feedback.appendChild(ol);
    feedback.className = "task-feedback method";
    methodBtn.hidden = true;
  }

  function paintIndex() {
    var host = $("#bench-index");
    if (!host) return;
    host.innerHTML = "";
    TASKS.forEach(function (t, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bench-index-row" + (i === state.ti ? " here" : "");
      b.innerHTML = '<span class="n"></span><span class="t"></span><span class="dot" aria-hidden="true"></span>';
      b.querySelector(".n").textContent = String(i + 1);
      b.querySelector(".t").textContent = t.title;
      var dot = b.querySelector(".dot");
      if (store.clean[t.id]) dot.className = "dot clean";
      else if (store.done[t.id]) dot.className = "dot done";
      b.setAttribute("aria-current", i === state.ti ? "true" : "false");
      b.addEventListener("click", function () { buildTask(i); });
      host.appendChild(b);
    });
    var n = Object.keys(store.done).length;
    var p = $("#bench-progress");
    if (p) p.textContent = n === TASKS.length
      ? "All seven constructed"
      : n + " of " + TASKS.length + " constructed";
  }

  /* tools */
  function setTool(name, quiet) {
    state.tool = name;
    state.draft = null;
    $$(".tool-btn").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-tool") === name ? "true" : "false");
    });
    $$(".tool-pane").forEach(function (pane) {
      pane.hidden = pane.getAttribute("data-pane") !== name;
    });
    board.parentNode.setAttribute("data-tool", name);
    if (!quiet) say({
      ruler: "Click a start point, then an end point. The length snaps to 0.1 cm.",
      compass: "Set the opening, then click where the needle goes.",
      protractor: "Click the vertex, swing to the angle, click again.",
      setsquare: "Click a line, then click the point the new line must pass through.",
      eraser: "Click one of your lines or arcs to remove it."
    }[name]);
    renderGuide();
  }

  function setSquareMode(mode, quiet) {
    state.sq = mode;
    $$("[data-sq]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-sq") === mode ? "true" : "false");
    });
    if (!quiet) renderGuide();
  }

  $$(".tool-btn").forEach(function (b) {
    b.addEventListener("click", function () { setTool(b.getAttribute("data-tool")); });
  });
  $$("[data-sq]").forEach(function (b) {
    b.addEventListener("click", function () {
      setSquareMode(b.getAttribute("data-sq"));
      say(state.sq === "perp"
        ? "Set square: right angle to the line. Click the line, then the point."
        : "Set square: parallel. Click the line, then the point.");
    });
  });

  var range = $("#compass-range");
  if (range) {
    range.addEventListener("input", function () {
      state.compassR = parseFloat(range.value);
      $("#compass-out").textContent = state.compassR.toFixed(1) + " cm";
      renderGuide();
    });
  }

  checkBtn.addEventListener("click", onCheck);
  methodBtn.addEventListener("click", showMethod);
  $("#btn-undo").addEventListener("click", undo);
  $("#btn-clear").addEventListener("click", clearMarks);

  /* pointer */
  board.addEventListener("pointermove", function (e) {
    var raw = toPaper(e);
    var s = snapPoint(raw);
    state.hover = s || raw;
    if (state.draft && state.draft.tool === "protractor") {
      var V = state.draft.V;
      var d = normDeg(angleOf(sub(state.hover, V)) - state.draft.armAngle);
      state.draft.angle = Math.min(180, Math.abs(d));
      state.draft.sign = d < 0 ? -1 : 1;
    }
    renderGuide();
  });
  board.addEventListener("pointerleave", function () {
    state.hover = null;
    renderGuide();
  });
  board.addEventListener("click", function (e) {
    onClick(toPaper(e));
  });
  board.addEventListener("contextmenu", function (e) {
    if (state.draft) { e.preventDefault(); state.draft = null; renderGuide(); say("Cancelled."); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && state.draft) {
      state.draft = null; renderGuide(); say("Cancelled.");
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      if (document.activeElement === board) return;
      e.preventDefault(); undo();
    }
  });

  /* start */
  buildTask(0);
})();
