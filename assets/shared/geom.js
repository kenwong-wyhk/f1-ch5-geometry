/* ============================================================
   geom.js — solid builders, plane cutting and shape naming
   for "Slice Lab" (Ch.5 Introduction to Geometry, Form 1 / S1).

   Deliberately free of three.js so the very same file can run in
   the browser AND in Node (dev/check_levels.js).  That matters:
   the maths that decides whether a cut wins a level is the maths
   the player actually sees, and it is unit-tested.

   Conventions
     point   [x, y, z]
     plane   n · x = s      n is a unit vector, s a signed distance
     mesh    { positions: Float32Array, normals: Float32Array }
             Non-indexed: every triangle owns 3 vertices, so flat
             solids shade flat and curved ones shade smooth.
   ============================================================ */
(function (global) {
  "use strict";

  var TAU = Math.PI * 2;

  /* ---------------------------------------------------------- *
   *  1. tiny vector helpers
   * ---------------------------------------------------------- */
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vlen(a) { return Math.sqrt(dot(a, a)); }
  function unit(a) { var l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function lerp3(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  /* Two orthonormal vectors spanning the plane with normal n. */
  function basis(n) {
    var helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = unit(cross(helper, n));
    var v = cross(n, u);
    return [u, v];
  }

  /* ---------------------------------------------------------- *
   *  2. mesh builder
   * ---------------------------------------------------------- */
  function Builder() { this.p = []; this.n = []; }
  Builder.prototype.tri = function (a, b, c, na, nb, nc) {
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.n.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
    return this;
  };
  /* flat-shaded triangle: one normal for all three corners */
  Builder.prototype.flat = function (a, b, c, n) { return this.tri(a, b, c, n, n, n); };
  Builder.prototype.quad = function (a, b, c, d, na, nb, nc, nd) {
    this.tri(a, b, c, na, nb, nc);
    this.tri(a, c, d, na, nc, nd);
    return this;
  };
  Builder.prototype.flatQuad = function (a, b, c, d, n) {
    this.flat(a, b, c, n); this.flat(a, c, d, n);
    return this;
  };
  /* finish a mesh: force every triangle to wind counter-clockwise as seen
     from outside, so the stored normal and the winding always agree. */
  Builder.prototype.done = function () {
    var p = this.p, n = this.n;
    for (var i = 0; i < p.length; i += 9) {
      var ax = p[i], ay = p[i + 1], az = p[i + 2];
      var bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
      var cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];
      var e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      var e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      var gx = e1y * e2z - e1z * e2y;
      var gy = e1z * e2x - e1x * e2z;
      var gz = e1x * e2y - e1y * e2x;
      if (gx * n[i] + gy * n[i + 1] + gz * n[i + 2] < 0) {
        var t0 = p[i + 3], t1 = p[i + 4], t2 = p[i + 5];
        p[i + 3] = p[i + 6]; p[i + 4] = p[i + 7]; p[i + 5] = p[i + 8];
        p[i + 6] = t0; p[i + 7] = t1; p[i + 8] = t2;
        var u0 = n[i + 3], u1 = n[i + 4], u2 = n[i + 5];
        n[i + 3] = n[i + 6]; n[i + 4] = n[i + 7]; n[i + 5] = n[i + 8];
        n[i + 6] = u0; n[i + 7] = u1; n[i + 8] = u2;
      }
    }
    return { positions: new Float32Array(p), normals: new Float32Array(n) };
  };

  function ring(n, r, y, rot) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = rot + (i / n) * TAU;
      out.push([r * Math.cos(a), y, r * Math.sin(a)]);
    }
    return out;
  }

  /* ---------------------------------------------------------- *
   *  3. the solids
   * ---------------------------------------------------------- */
  function box(w, h, d) {
    var b = new Builder(), x = w / 2, y = h / 2, z = d / 2;
    b.flatQuad([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]);
    b.flatQuad([x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]);
    b.flatQuad([x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]);
    b.flatQuad([-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]);
    b.flatQuad([-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]);
    b.flatQuad([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]);
    return b.done();
  }

  /* regular n-gon prism, axis = y, centred on the origin */
  function prism(n, r, h, rot) {
    rot = rot || 0;
    var b = new Builder(), top = h / 2, bot = -h / 2;
    var lo = ring(n, r, bot, rot), hi = ring(n, r, top, rot);
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var a = rot + ((i + 0.5) / n) * TAU;
      var nrm = [Math.cos(a), 0, Math.sin(a)];
      b.flatQuad(lo[i], lo[j], hi[j], hi[i], nrm);
      b.flat([0, top, 0], hi[i], hi[j], [0, 1, 0]);
      b.flat([0, bot, 0], lo[j], lo[i], [0, -1, 0]);
    }
    return b.done();
  }

  /* regular n-gon pyramid, apex on +y */
  function pyramid(n, r, h, rot) {
    rot = rot || 0;
    var b = new Builder(), top = h / 2, bot = -h / 2;
    var lo = ring(n, r, bot, rot), apex = [0, top, 0];
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var e1 = sub(lo[j], lo[i]), e2 = sub(apex, lo[i]);
      var nrm = unit(cross(e1, e2));
      if (dot(nrm, [lo[i][0], 0, lo[i][2]]) < 0) { nrm = [-nrm[0], -nrm[1], -nrm[2]]; }
      b.flat(lo[i], lo[j], apex, nrm);
      b.flat([0, bot, 0], lo[j], lo[i], [0, -1, 0]);
    }
    return b.done();
  }

  function cylinder(r, h, seg) {
    seg = seg || 64;
    var b = new Builder(), top = h / 2, bot = -h / 2;
    for (var i = 0; i < seg; i++) {
      var a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var A = [r * c0, bot, r * s0], B = [r * c1, bot, r * s1];
      var C = [r * c1, top, r * s1], D = [r * c0, top, r * s0];
      var nA = [c0, 0, s0], nB = [c1, 0, s1];
      b.quad(A, B, C, D, nA, nB, nB, nA);
      b.flat([0, top, 0], D, C, [0, 1, 0]);
      b.flat([0, bot, 0], B, A, [0, -1, 0]);
    }
    return b.done();
  }

  function cone(r, h, seg) {
    seg = seg || 64;
    var b = new Builder(), top = h / 2, bot = -h / 2, apex = [0, top, 0];
    /* normal of the lateral surface at angle a: (h cos a, r, h sin a) normalised */
    var k = Math.hypot(h, r);
    for (var i = 0; i < seg; i++) {
      var a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var A = [r * c0, bot, r * s0], B = [r * c1, bot, r * s1];
      b.tri(A, B, apex,
        [h * c0 / k, r / k, h * s0 / k],
        [h * c1 / k, r / k, h * s1 / k],
        [h * (c0 + c1) / 2 / k, r / k, h * (s0 + s1) / 2 / k]);
      b.flat([0, bot, 0], B, A, [0, -1, 0]);
    }
    return b.done();
  }

  function sphere(r, segU, segV) {
    segU = segU || 48; segV = segV || 24;
    var b = new Builder();
    function P(i, j) {
      var phi = (j / segV) * Math.PI;          // 0 .. PI  (top -> bottom)
      var th = (i / segU) * TAU;
      var x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
      return [r * x, r * y, r * z];
    }
    for (var j = 0; j < segV; j++) {
      for (var i = 0; i < segU; i++) {
        var a = P(i, j), bb = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
        var na = unit(a), nb = unit(bb), nc = unit(c), nd = unit(d);
        if (j === 0) { b.tri(a, c, d, na, nc, nd); }
        else if (j === segV - 1) { b.tri(a, bb, c, na, nb, nc); }
        else { b.quad(a, bb, c, d, na, nb, nc, nd); }
      }
    }
    return b.done();
  }

  /* ---------------------------------------------------------- *
   *  4. plane cutting
   * ---------------------------------------------------------- */
  function trianglesOf(mesh) {
    if (mesh._tris) return mesh._tris;
    var p = mesh.positions, out = [];
    for (var i = 0; i < p.length; i += 9) {
      out.push([[p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]], [p[i + 6], p[i + 7], p[i + 8]]]);
    }
    mesh._tris = out;
    return out;
  }

  /* signed extent of the mesh along n -> [min, max] */
  function extent(tris, n) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < tris.length; i++) {
      for (var k = 0; k < 3; k++) {
        var d = dot(n, tris[i][k]);
        if (d < lo) lo = d;
        if (d > hi) hi = d;
      }
    }
    return [lo, hi];
  }

  function convexHull(pts) {
    if (pts.length < 3) return pts.slice();
    var p = pts.slice().sort(function (a, b) { return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]; });
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lower = [], i;
    for (i = 0; i < p.length; i++) {
      while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], p[i]) <= 0) lower.pop();
      lower.push(p[i]);
    }
    var upper = [];
    for (i = p.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], p[i]) <= 0) upper.pop();
      upper.push(p[i]);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  /* drop vertices that sit on the straight line between their neighbours —
     triangle meshes leave mid-edge points that float a hair off the edge. */
  function simplifyHull(hull) {
    var h = hull.slice(), guard = 0, changed = true;
    while (changed && h.length > 3 && guard++ < 400) {
      changed = false;
      for (var i = 0; i < h.length; i++) {
        var a = h[(i - 1 + h.length) % h.length], b = h[i], c = h[(i + 1) % h.length];
        var lab = Math.hypot(b[0] - a[0], b[1] - a[1]);
        var lbc = Math.hypot(c[0] - b[0], c[1] - b[1]);
        if (lab < 1e-9 || lbc < 1e-9) { h.splice(i, 1); changed = true; break; }
        var area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
        if (area / (lab * lbc) < 0.008) { h.splice(i, 1); changed = true; break; }
      }
    }
    return h;
  }

  function polyArea(h) {
    var a = 0;
    for (var i = 0; i < h.length; i++) {
      var p = h[i], q = h[(i + 1) % h.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a) / 2;
  }

  function polyPerimeter(h) {
    var s = 0;
    for (var i = 0; i < h.length; i++) {
      var p = h[i], q = h[(i + 1) % h.length];
      s += Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    return s;
  }

  function polyCentroid(h) {
    var cx = 0, cy = 0;
    for (var i = 0; i < h.length; i++) { cx += h[i][0]; cy += h[i][1]; }
    return [cx / h.length, cy / h.length];
  }

  /* The cross-section of a convex solid by the plane n·x = s.
     Returns null when the plane misses the solid (or only grazes it). */
  function sectionAt(tris, n, s) {
    var uv = basis(n), u = uv[0], v = uv[1];
    var eps = 2e-5;
    var pts = [], seen = Object.create(null);

    function add(p) {
      var k = Math.round(p[0] * 1e5) + "|" + Math.round(p[1] * 1e5) + "|" + Math.round(p[2] * 1e5);
      if (seen[k]) return;
      seen[k] = 1;
      pts.push(p);
    }

    for (var i = 0; i < tris.length; i++) {
      var t = tris[i], a = t[0], b = t[1], c = t[2];
      var da = dot(n, a) - s, db = dot(n, b) - s, dc = dot(n, c) - s;
      if ((da > eps && db > eps && dc > eps) || (da < -eps && db < -eps && dc < -eps)) continue;
      var D = [da, db, dc], V = [a, b, c];
      for (var k = 0; k < 3; k++) {
        var k2 = (k + 1) % 3, d1 = D[k], d2 = D[k2];
        if ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) {
          add(lerp3(V[k], V[k2], d1 / (d1 - d2)));
        }
        if (Math.abs(d1) <= eps) add(V[k]);
      }
    }

    if (pts.length < 3) return null;
    var pts2 = [], i2;
    for (i2 = 0; i2 < pts.length; i2++) pts2.push([dot(pts[i2], u), dot(pts[i2], v)]);
    var hull2 = simplifyHull(convexHull(pts2));
    if (hull2.length < 3) return null;
    var area = polyArea(hull2);
    if (area < 2e-4) return null;

    var c0 = [n[0] * s, n[1] * s, n[2] * s];
    var hull3 = [];
    for (i2 = 0; i2 < hull2.length; i2++) {
      var q = hull2[i2];
      hull3.push([
        c0[0] + u[0] * q[0] + v[0] * q[1],
        c0[1] + u[1] * q[0] + v[1] * q[1],
        c0[2] + u[2] * q[0] + v[2] * q[1]
      ]);
    }
    var c2 = polyCentroid(hull2);
    return {
      n: n, s: s, u: u, v: v,
      hull2: hull2, hull3: hull3,
      area: area, perimeter: polyPerimeter(hull2),
      center2: c2,
      center3: [
        c0[0] + u[0] * c2[0] + v[0] * c2[1],
        c0[1] + u[1] * c2[0] + v[1] * c2[1],
        c0[2] + u[2] * c2[0] + v[2] * c2[1]
      ]
    };
  }

  /* ---------------------------------------------------------- *
   *  5. naming the shape the player just made
   * ---------------------------------------------------------- */
  var NAMES = {
    none:       ["No section", "沒有截面"],
    circle:     ["Circle", "圓形"],
    ellipse:    ["Ellipse", "橢圓形"],
    truncated:  ["Curved, with a straight edge", "曲面加直邊"],
    triangle:   ["Triangle", "三角形"],
    equilateral:["Equilateral triangle", "等邊三角形"],
    isosceles:  ["Isosceles triangle", "等腰三角形"],
    square:     ["Square", "正方形"],
    rectangle:  ["Rectangle", "長方形"],
    rhombus:    ["Rhombus", "菱形"],
    parallelogram: ["Parallelogram", "平行四邊形"],
    trapezium:  ["Trapezium", "梯形"],
    isoTrapezium: ["Isosceles trapezium", "等腰梯形"],
    kite:       ["Kite", "風箏形"],
    quadrilateral: ["Quadrilateral", "四邊形"],
    pentagon:   ["Pentagon", "五邊形"],
    hexagon:    ["Hexagon", "六邊形"],
    heptagon:   ["Heptagon", "七邊形"],
    octagon:    ["Octagon", "八邊形"],
    polygon:    ["Polygon", "多邊形"]
  };

  function named(kind, extra) {
    var nm = NAMES[kind] || NAMES.polygon;
    return { kind: kind, name: nm[0], zh: nm[1], label: extra || nm[0] };
  }

  function classify(h) {
    var m = h.length;
    if (m < 3) return named("none");

    var e = [], L = [], i, per = 0;
    for (i = 0; i < m; i++) {
      var a = h[i], b = h[(i + 1) % m];
      e.push([b[0] - a[0], b[1] - a[1]]);
      L.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
      per += L[i];
    }
    var maxL = Math.max.apply(null, L) || 1;
    function near(x, y, tol) { return Math.abs(x - y) <= tol; }
    function par(i1, i2) {
      return Math.abs(e[i1][0] * e[i2][1] - e[i1][1] * e[i2][0]) / ((L[i1] * L[i2]) || 1) < 0.035;
    }
    function eq(i1, i2) { return Math.abs(L[i1] - L[i2]) / maxL < 0.035; }
    function right(i1, i2) {
      return Math.abs(e[i1][0] * e[i2][0] + e[i1][1] * e[i2][1]) / ((L[i1] * L[i2]) || 1) < 0.035;
    }

    /* --- smooth curves coming off a cylinder / cone / sphere --- */
    if (m >= 9) {
      var flatEdge = false;
      for (i = 0; i < m; i++) if (L[i] > 0.16 * per) flatEdge = true;
      if (flatEdge) return named("truncated");
      var xs = h.map(function (p) { return p[0]; }), ys = h.map(function (p) { return p[1]; });
      var w = Math.max.apply(null, xs) - Math.min.apply(null, xs);
      var hh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
      var aspect = Math.max(w, hh) / (Math.min(w, hh) || 1);
      if (aspect < 1.1) return named("circle");
      return named("ellipse");
    }

    if (m === 3) {
      var allEq = eq(0, 1) && eq(1, 2);
      var twoEq = eq(0, 1) || eq(1, 2) || eq(0, 2);
      if (allEq) return named("equilateral");
      if (twoEq) return named("isosceles");
      return named("triangle");
    }

    if (m === 4) {
      var p02 = par(0, 2), p13 = par(1, 3);
      var e02 = eq(0, 2), e13 = eq(1, 3);
      var allRight = right(0, 1) && right(1, 2) && right(2, 3);
      var allEq4 = eq(0, 1) && eq(1, 2) && eq(2, 3);
      if (p02 && p13) {
        if (allRight && allEq4) return named("square");
        if (allRight) return named("rectangle");
        if (allEq4) return named("rhombus");
        return named("parallelogram");
      }
      if (p02 || p13) {
        var legs = p02 ? [L[1], L[3]] : [L[0], L[2]];
        if (Math.abs(legs[0] - legs[1]) / maxL < 0.035) return named("isoTrapezium");
        return named("trapezium");
      }
      /* kite: two pairs of touching equal sides */
      if ((eq(0, 1) && eq(2, 3)) || (eq(1, 2) && eq(3, 0))) return named("kite");
      return named("quadrilateral");
    }

    var poly = { 5: "pentagon", 6: "hexagon", 7: "heptagon", 8: "octagon" }[m] || "polygon";
    var r = named(poly);
    if (poly === "polygon") r.label = m + "-sided polygon";
    return r;
  }

  /* ---------------------------------------------------------- *
   *  6. aim -> plane
   *     tilt  0 = blade flat (parallel to the base)  90 = upright
   *     turn  which way the upright blade faces
   *     depth -1..1 across the solid's extent along the normal
   * ---------------------------------------------------------- */
  function normalFromAngles(tiltDeg, turnDeg) {
    var t = tiltDeg * Math.PI / 180, f = turnDeg * Math.PI / 180;
    return [
      Math.sin(t) * Math.cos(f),
      Math.cos(t),
      Math.sin(t) * Math.sin(f)
    ];
  }

  function planeAt(tris, tiltDeg, turnDeg, depth) {
    var n = normalFromAngles(tiltDeg, turnDeg);
    var ex = extent(tris, n);
    var lo = ex[0] + (ex[1] - ex[0]) * 0.01;
    var hi = ex[1] - (ex[1] - ex[0]) * 0.01;
    var s = lo + (hi - lo) * (depth + 1) / 2;
    return { n: n, s: s, range: [lo, hi] };
  }

  /* ---------------------------------------------------------- *
   *  7. the solid registry
   * ---------------------------------------------------------- */
  var SOLIDS = {
    cube: {
      en: "Cube", zh: "正方體", kind: "Prism",
      make: function () { return box(1.7, 1.7, 1.7); }
    },
    cuboid: {
      en: "Cuboid", zh: "長方體", kind: "Prism",
      make: function () { return box(2.2, 1.2, 1.5); }
    },
    triPrism: {
      en: "Triangular prism", zh: "三角柱", kind: "Prism",
      make: function () { return prism(3, 1.05, 1.9, Math.PI / 2); }
    },
    hexPrism: {
      en: "Hexagonal prism", zh: "六角柱", kind: "Prism",
      make: function () { return prism(6, 0.95, 1.9, 0); }
    },
    squarePyramid: {
      en: "Square pyramid", zh: "四角錐", kind: "Pyramid",
      make: function () { return pyramid(4, 1.15, 1.9, Math.PI / 4); }
    },
    tetra: {
      en: "Triangular pyramid", zh: "三角錐", kind: "Pyramid",
      make: function () { return pyramid(3, 1.1, 1.9, Math.PI / 2); }
    },
    cylinder: {
      en: "Cylinder", zh: "圓柱", kind: "Non-polyhedron",
      make: function () { return cylinder(0.9, 1.9, 64); }
    },
    cone: {
      en: "Cone", zh: "圓錐", kind: "Non-polyhedron",
      make: function () { return cone(0.95, 1.9, 64); }
    },
    sphere: {
      en: "Sphere", zh: "球體", kind: "Non-polyhedron",
      make: function () { return sphere(1.05, 48, 24); }
    }
  };

  var GEO = {
    dot: dot, cross: cross, sub: sub, vlen: vlen, unit: unit, lerp3: lerp3,
    basis: basis, box: box, prism: prism, pyramid: pyramid,
    cylinder: cylinder, cone: cone, sphere: sphere,
    trianglesOf: trianglesOf, extent: extent,
    convexHull: convexHull, simplifyHull: simplifyHull,
    polyArea: polyArea, polyPerimeter: polyPerimeter,
    sectionAt: sectionAt, classify: classify,
    normalFromAngles: normalFromAngles, planeAt: planeAt,
    NAMES: NAMES, SOLIDS: SOLIDS
  };

  if (typeof module !== "undefined" && module.exports) module.exports = GEO;
  if (global) global.GEO = GEO;
})(typeof window !== "undefined" ? window : this);
