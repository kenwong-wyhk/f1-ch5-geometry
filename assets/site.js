/* ============================================================
   Ch.5 Introduction to Geometry — shared interactions
   ============================================================ */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var SVGNS = "http://www.w3.org/2000/svg";

  /* An inline SVG with a viewBox but no width/height has no intrinsic size, so it
     collapses to 0 inside a shrink-to-fit box (e.g. a grid item with margin:auto).
     Always give the generated diagrams explicit dimensions. */
  function fitSvg(el, w, h) {
    el.setAttribute("viewBox", "0 0 " + w + " " + h);
    el.setAttribute("width", w);
    el.setAttribute("height", h);
    el.style.maxWidth = "100%";
    el.style.height = "auto";
    el.style.display = "block";
    el.style.margin = "0 auto";
    return el;
  }

  /* ---------- 1. show / hide solution ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-reveal]");
    if (!b) return;
    var t = document.querySelector(b.getAttribute("data-reveal"));
    if (!t) return;
    var hidden = t.classList.toggle("hidden");
    b.textContent = hidden ? (b.dataset.show || "Show solution") : (b.dataset.hide || "Hide solution");
    b.setAttribute("aria-expanded", hidden ? "false" : "true");
  });

  /* ---------- 2. progress tracking ---------- */
  /* The list of completed sections is held in memory and written through to
     localStorage. Reading storage on every click meant that a blocked or
     unavailable store (sandboxed preview, private mode) made the button
     impossible to un-tick, so the state now lives in `done` instead. */
  var KEY = "ch05-geometry-progress";
  var done = [];
  var storageOK = true;
  try {
    var saved = localStorage.getItem(KEY);
    if (saved) {
      var parsed = JSON.parse(saved);
      if (Object.prototype.toString.call(parsed) === "[object Array]") done = parsed;
    }
  } catch (err) { storageOK = false; }

  function persist() {
    if (!storageOK) return;
    try { localStorage.setItem(KEY, JSON.stringify(done)); }
    catch (err) { storageOK = false; }
  }

  var pageId = document.body.getAttribute("data-page");
  var paintBtn = null;

  if (pageId) {
    var bar = $(".done-bar");
    if (bar) {
      var btn = bar.querySelector("button");
      var note = bar.querySelector("span");
      paintBtn = function () {
        var on = done.indexOf(pageId) > -1;
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.textContent = on ? "✓ Section completed" : "Mark this section as completed";
      };
      paintBtn();
      if (!storageOK && note) note.textContent = "Storage is blocked in this viewer — ticks will not be kept.";
      btn.addEventListener("click", function () {
        var i = done.indexOf(pageId);
        if (i > -1) done.splice(i, 1); else done.push(pageId);
        persist();
        paintBtn();
        paintBar();
      });
    }
  }

  function paintBar() {
    var pb = $("#prog-fill"), pn = $("#prog-num");
    if (!pb) return;
    var total = parseInt(document.body.getAttribute("data-total") || "11", 10);
    pb.style.width = Math.round((done.length / total) * 100) + "%";
    if (pn) pn.textContent = done.length + " / " + total + " plates marked";
  }
  paintBar();
  if (!storageOK) {
    var pnote = $("#prog-note");
    if (pnote) pnote.textContent = "This viewer is blocking browser storage, so ticks cannot be saved between pages. Open the site in a normal browser tab to keep your progress.";
  }

  /* Back/forward navigation can restore this page from the bfcache without
     re-running the script, so refresh from storage whenever it is shown. */
  function resync() {
    try {
      var raw = localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : null;
      if (Object.prototype.toString.call(arr) === "[object Array]") done = arr;
    } catch (err) { storageOK = false; }
    if (paintBtn) paintBtn();
    paintBar();
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) resync(); });
  window.addEventListener("storage", function (e) { if (e.key === KEY) resync(); });

  /* ---------- 3. angle explorer (page 02) ---------- */
  var angHost = $("#angle-demo");
  if (angHost) {
    var cx = 200, cy = 190, R = 100;
    var svg = document.createElementNS(SVGNS, "svg");
    fitSvg(svg, 400, 340);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Interactive angle diagram");
    svg.innerHTML =
      '<path id="ad-arc" d="" fill="none" stroke="#2563eb" stroke-width="3" opacity=".85"/>' +
      '<line id="ad-ray1" x1="' + cx + '" y1="' + cy + '" x2="' + (cx + 150) + '" y2="' + cy + '" stroke="#33475b" stroke-width="2.6" stroke-linecap="round"/>' +
      '<line id="ad-ray2" x1="' + cx + '" y1="' + cy + '" x2="' + (cx + 150) + '" y2="' + cy + '" stroke="#33475b" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path id="ad-sq" d="" fill="none" stroke="#14212e" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="3.6" fill="#14212e"/>' +
      '<text x="' + (cx - 16) + '" y="' + (cy + 20) + '" class="lbl">O</text>' +
      '<text id="ad-deg" x="' + (cx + 34) + '" y="' + (cy - 24) + '" class="lbl" fill="#2563eb">45°</text>';
    angHost.appendChild(svg);

    var slider = $("#angle-range"), outType = $("#angle-type"), outNum = $("#angle-num");
    var outComp = $("#angle-comp"), outSupp = $("#angle-supp");

    function render(theta) {
      var rad = theta * Math.PI / 180;
      var x2 = cx + 150 * Math.cos(rad), y2 = cy - 150 * Math.sin(rad);
      $("#ad-ray2").setAttribute("x2", x2.toFixed(2));
      $("#ad-ray2").setAttribute("y2", y2.toFixed(2));

      var isRound = theta >= 359.5;
      var arcR = isRound ? 140 : R;
      var ax = cx + arcR, ay = cy;
      var bx = cx + arcR * Math.cos(rad), by = cy - arcR * Math.sin(rad);
      var large = theta > 180 ? 1 : 0;
      // A near-zero chord would make the browser place the centre at the ray tip,
      // so a full turn is drawn as two explicit half circles centred on O.
      var d = isRound
        ? "M " + (cx - arcR) + " " + cy +
          " A " + arcR + " " + arcR + " 0 0 0 " + (cx + arcR) + " " + cy +
          " A " + arcR + " " + arcR + " 0 0 0 " + (cx - arcR) + " " + cy
        : "M " + ax + " " + ay + " A " + arcR + " " + arcR + " 0 " + large + " 0 " + bx.toFixed(2) + " " + by.toFixed(2);
      $("#ad-arc").setAttribute("d", d);

      // right-angle square
      var sq = $("#ad-sq");
      if (Math.abs(theta - 90) < 0.6) {
        sq.setAttribute("d", "M " + (cx + 26) + " " + cy + " L " + (cx + 26) + " " + (cy - 26) + " L " + cx + " " + (cy - 26));
      } else sq.setAttribute("d", "");

      // label position: on the arc, at the bisector of the swept angle
      var lx, ly;
      if (isRound) {
        // no bisector exists for a full turn — park the label at the upper right
        var lr45 = arcR + 26;
        lx = cx + lr45 * Math.cos(Math.PI / 4);
        ly = cy - lr45 * Math.sin(Math.PI / 4);
      } else if (theta <= 2) {
        // zero angle: keep the label off the arm itself
        lx = cx + arcR + 12;
        ly = cy - 22;
      } else {
        var mid = rad / 2, lr = arcR + 26;
        lx = cx + lr * Math.cos(mid);
        ly = cy - lr * Math.sin(mid);
      }
      var t = $("#ad-deg");
      t.setAttribute("x", lx.toFixed(1));
      t.setAttribute("y", ly.toFixed(1));
      t.textContent = theta + "°";

      var name;
      if (theta === 0) name = "Zero angle 零角";
      else if (theta < 90) name = "Acute angle 銳角";
      else if (theta === 90) name = "Right angle 直角";
      else if (theta < 180) name = "Obtuse angle 鈍角";
      else if (theta === 180) name = "Straight angle 平角";
      else if (theta < 360) name = "Reflex angle 反角";
      else name = "Round angle 周角";
      if (outType) outType.textContent = name;
      if (outNum) outNum.textContent = theta + "°";
      if (outComp) outComp.textContent = theta > 0 && theta < 90 ? "90° − " + theta + "° = " + (90 - theta) + "°" : "— (no complement)";
      if (outSupp) outSupp.textContent = theta > 0 && theta < 180 ? "180° − " + theta + "° = " + (180 - theta) + "°" : "— (no supplement)";
    }
    if (slider) {
      slider.addEventListener("input", function () { render(parseInt(slider.value, 10)); });
      render(parseInt(slider.value, 10));
    }
    $$("[data-angle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = parseInt(b.getAttribute("data-angle"), 10);
        if (slider) slider.value = v;
        render(v);
      });
    });
  }

  /* ---------- 4. triangle angle sum (page 04) ---------- */
  var triHost = $("#tri-demo");
  if (triHost) {
    var tsvg = document.createElementNS(SVGNS, "svg");
    fitSvg(tsvg, 380, 240);
    tsvg.setAttribute("role", "img");
    tsvg.setAttribute("aria-label", "Interactive triangle ABC with its three interior angles");
    tsvg.innerHTML =
      '<polygon id="td-poly" points="" fill="#eaf1ff" stroke="#2563eb" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<g id="td-marks"></g>';
    triHost.appendChild(tsvg);

    var sa = $("#tri-a"), sb = $("#tri-b");
    var sumOut = $("#tri-sum");
    var COL = { A: "#d97706", B: "#0d9488", C: "#7c3aed" };
    var MIN_ANGLE = 25, MAX_SUM = 150;

    function drawTri(A, B) {
      var C = 180 - A - B;
      var rad = Math.PI / 180, R = 1;
      // sides from the sine rule (opposite A, B, C)
      var sideC = 2 * R * Math.sin(C * rad);   // AB
      var sideB = 2 * R * Math.sin(B * rad);   // AC
      var P = {
        A: { x: 0, y: 0 },
        B: { x: sideC, y: 0 },
        C: { x: sideB * Math.cos(A * rad), y: sideB * Math.sin(A * rad) }
      };
      var xs = [P.A.x, P.B.x, P.C.x], ys = [P.A.y, P.B.y, P.C.y];
      var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs);
      var miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
      var w = 380, h = 240, pad = 58;
      var sc = Math.min((w - 2 * pad) / ((maxx - minx) || 1), (h - 2 * pad) / ((maxy - miny) || 1));
      var ox = (w - (maxx - minx) * sc) / 2 - minx * sc;
      var oy = (h - (maxy - miny) * sc) / 2 + maxy * sc;
      var T = function (p) { return { x: ox + p.x * sc, y: oy - p.y * sc }; };
      var V = { A: T(P.A), B: T(P.B), C: T(P.C) };

      $("#td-poly").setAttribute("points",
        V.A.x.toFixed(1) + "," + V.A.y.toFixed(1) + " " +
        V.B.x.toFixed(1) + "," + V.B.y.toFixed(1) + " " +
        V.C.x.toFixed(1) + "," + V.C.y.toFixed(1));

      var cen = { x: (V.A.x + V.B.x + V.C.x) / 3, y: (V.A.y + V.B.y + V.C.y) / 3 };
      var html = "";
      var spec = [["A", V.B, V.C, A], ["B", V.A, V.C, B], ["C", V.A, V.B, C]];

      spec.forEach(function (it) {
        var key = it[0], Q = it[1], S = it[2], deg = it[3], v = V[key];
        var u1 = { x: Q.x - v.x, y: Q.y - v.y }, u2 = { x: S.x - v.x, y: S.y - v.y };
        var l1 = Math.hypot(u1.x, u1.y) || 1, l2 = Math.hypot(u2.x, u2.y) || 1;
        u1 = { x: u1.x / l1, y: u1.y / l1 }; u2 = { x: u2.x / l2, y: u2.y / l2 };

        // arc: both ends exactly r from the vertex, sweep taken from the cross product
        var r = 30;
        var p1 = { x: v.x + r * u1.x, y: v.y + r * u1.y };
        var p2 = { x: v.x + r * u2.x, y: v.y + r * u2.y };
        var cross = (Q.x - v.x) * (S.y - v.y) - (Q.y - v.y) * (S.x - v.x);
        var sweep = cross > 0 ? 1 : 0;
        html += '<path d="M ' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1) +
          ' A ' + r + ' ' + r + ' 0 0 ' + sweep + ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1) +
          '" fill="none" stroke="' + COL[key] + '" stroke-width="2.8"/>';

        // angle value on the bisector, just outside the arc
        var bx = u1.x + u2.x, by = u1.y + u2.y, bl = Math.hypot(bx, by) || 1;
        bx /= bl; by /= bl;
        var lr = r + 20;
        html += '<text x="' + (v.x + lr * bx).toFixed(1) + '" y="' + (v.y + lr * by).toFixed(1) +
          '" class="lbl" fill="' + COL[key] + '" text-anchor="middle" dominant-baseline="middle">' + deg + '°</text>';

        // vertex dot + letter, pushed outwards from the centroid
        var dx = v.x - cen.x, dy = v.y - cen.y, dl = Math.hypot(dx, dy) || 1;
        html += '<circle cx="' + v.x.toFixed(1) + '" cy="' + v.y.toFixed(1) + '" r="3.4" fill="#14212e"/>';
        html += '<text x="' + (v.x + dx / dl * 17).toFixed(1) + '" y="' + (v.y + dy / dl * 17).toFixed(1) +
          '" class="lbl" fill="' + COL[key] + '" text-anchor="middle" dominant-baseline="middle">' + key + '</text>';
      });
      $("#td-marks").innerHTML = html;
      if (sumOut) sumOut.innerHTML = "<b>" + A + "° + " + B + "° + " + C + "° = 180°</b>";
    }

    function upd() {
      var A = parseInt(sa.value, 10), B = parseInt(sb.value, 10);
      if (A + B > MAX_SUM) { B = MAX_SUM - A; sb.value = B; }
      if (B < MIN_ANGLE) { B = MIN_ANGLE; sb.value = B; }
      $("#tri-a-val").textContent = A + "°";
      $("#tri-b-val").textContent = B + "°";
      $("#tri-c-val").textContent = (180 - A - B) + "°";
      drawTri(A, B);
    }
    sa.addEventListener("input", upd); sb.addEventListener("input", upd); upd();
  }

  /* ---------- 5. polygon explorer (page 05) ---------- */
  var polyHost = $("#poly-demo");
  if (polyHost) {
    var psvg = document.createElementNS(SVGNS, "svg");
    fitSvg(psvg, 340, 260);
    psvg.setAttribute("role", "img");
    psvg.setAttribute("aria-label", "Regular polygon explorer");
    // the polygon is filled, so the diagonals must be painted *after* it
    psvg.innerHTML = '<polygon id="pd-poly" fill="#eaf1ff" stroke="#2563eb" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<g id="pd-diag" stroke="#d97706" stroke-width="1.7" stroke-linecap="round"></g>';
    polyHost.appendChild(psvg);

    var outN = $("#poly-n"), outD = $("#poly-d"), outS = $("#poly-s"), outA = $("#poly-a");
    var names = { 3: "triangle", 4: "quadrilateral", 5: "pentagon", 6: "hexagon", 7: "heptagon", 8: "octagon", 9: "nonagon", 10: "decagon" };

    function drawPoly(n, showDiag) {
      var cxp = 170, cyp = 130, R = 96;
      var pts = [];
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + i * 2 * Math.PI / n;
        pts.push({ x: cxp + R * Math.cos(a), y: cyp + R * Math.sin(a) });
      }
      $("#pd-poly").setAttribute("points", pts.map(function (p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" "));
      var dg = $("#pd-diag");
      var html = "";
      if (showDiag) {
        for (var i2 = 0; i2 < n; i2++) for (var j = i2 + 2; j < n; j++) {
          if (i2 === 0 && j === n - 1) continue;
          html += '<line x1="' + pts[i2].x.toFixed(1) + '" y1="' + pts[i2].y.toFixed(1) + '" x2="' + pts[j].x.toFixed(1) + '" y2="' + pts[j].y.toFixed(1) + '"/>';
        }
      }
      dg.innerHTML = html;
      if (outN) outN.textContent = n + " — " + names[n];
      if (outD) outD.textContent = (n * (n - 3) / 2) + "";
      if (outS) outS.textContent = (n - 2) * 180 + "°";
      if (outA) outA.textContent = ((n - 2) * 180 / n).toFixed(n === 7 ? 1 : 0) + "°";
    }
    var curN = 5, showD = true;
    $$("[data-poly]").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("[data-poly]").forEach(function (o) { o.classList.remove("on"); });
        b.classList.add("on");
        curN = parseInt(b.getAttribute("data-poly"), 10);
        drawPoly(curN, showD);
      });
    });
    var dbtn = $("#poly-toggle");
    if (dbtn) dbtn.addEventListener("click", function () {
      showD = !showD;
      dbtn.textContent = showD ? "Hide diagonals" : "Show diagonals";
      drawPoly(curN, showD);
    });
    drawPoly(5, true);
  }

  /* ---------- 6. circle part highlighter (page 06) ---------- */
  var circHost = $("#circle-demo");
  if (circHost) {
    var info = {
      centre: ["Centre O 圓心", "The fixed point in the middle of a circle. Every point on the circle is the same distance from it."],
      radius: ["Radius 半徑", "A line segment from the centre to any point on the circle. All radii of the same circle are equal."],
      diameter: ["Diameter 直徑", "A chord that passes through the centre. It is the longest chord, and diameter = 2 × radius."],
      chord: ["Chord 弦", "A line segment joining any two points on the circle. It does NOT have to pass through the centre."],
      arc: ["Arc 弧", "A part of the circumference. The shorter one is the minor arc; the longer one is the major arc."],
      sector: ["Sector 扇形", "The region enclosed by two radii and an arc. (Looks like a slice of pizza.)"],
      segment: ["Segment 弓形", "The region enclosed by a chord and an arc. (It does not include the centre.)"],
      circumference: ["Circumference 圓周", "The whole boundary (perimeter) of the circle."]
    };
    var ttl = $("#cp-title"), dsc = $("#cp-desc");
    function show(part) {
      $$("[data-part]").forEach(function (g) { g.classList.toggle("hl", g.getAttribute("data-part") === part); });
      if (info[part]) { ttl.textContent = info[part][0]; dsc.textContent = info[part][1]; }
      $$("[data-cp]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-cp") === part); });
    }
    $$("[data-cp]").forEach(function (b) {
      b.addEventListener("click", function () { show(b.getAttribute("data-cp")); });
    });
    show("radius");
  }

  /* ---------- 7. solid explorer (page 07) ---------- */
  var solidHost = $("#solid-demo");
  if (solidHost) {
    var DATA = {
      cube: { name: "Cube 正方體", v: 8, e: 12, f: 6, poly: "Yes — 6 square faces", uni: "Yes — a square", note: "A cube is a prism (a rectangular prism whose faces are all squares)." },
      cuboid: { name: "Cuboid 長方體", v: 8, e: 12, f: 6, poly: "Yes — 6 rectangular faces", uni: "Yes — a rectangle", note: "Also called a rectangular prism." },
      triprism: { name: "Triangular prism 三稜柱體", v: 6, e: 9, f: 5, poly: "Yes — 2 triangles + 3 rectangles", uni: "Yes — a triangle", note: "Named by the shape of its bases." },
      pentaprism: { name: "Pentagonal prism 五稜柱體", v: 10, e: 15, f: 7, poly: "Yes — 2 pentagons + 5 rectangles", uni: "Yes — a pentagon", note: "Named by the shape of its bases." },
      squarepyr: { name: "Square pyramid 四角錐體", v: 5, e: 8, f: 5, poly: "Yes — 1 square + 4 triangles", uni: "No — cross-sections shrink towards the apex", note: "Named by the shape of its base." },
      tetr: { name: "Triangular pyramid 三角錐體", v: 4, e: 6, f: 4, poly: "Yes — 4 triangles", uni: "No", note: "Also called a tetrahedron." },
      cylinder: { name: "Circular cylinder 圓柱體", v: 0, e: 0, f: 2, poly: "No — it has a curved surface", uni: "Yes — a circle", note: "Two identical circular ends joined by a curved surface." },
      cone: { name: "Circular cone 圓錐體", v: 1, e: 0, f: 1, poly: "No — it has a curved surface", uni: "No", note: "A circular base and a vertex — not a pyramid." },
      sphere: { name: "Sphere 球體", v: 0, e: 0, f: 0, poly: "No — a completely curved surface", uni: "No — the circles get smaller away from the centre", note: "Every cross-section is a circle, but they are different sizes, so they are not uniform." }
    };
    var sName = $("#sd-name"), sV = $("#sd-v"), sE = $("#sd-e"), sF = $("#sd-f"),
      sP = $("#sd-poly"), sU = $("#sd-uni"), sN = $("#sd-note");
    function pick(k) {
      var d = DATA[k]; if (!d) return;
      sName.textContent = d.name;
      sV.textContent = d.v; sE.textContent = d.e; sF.textContent = d.f;
      sP.textContent = d.poly; sU.textContent = d.uni; sN.textContent = d.note;
      $$("[data-solid]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-solid") === k); });
    }
    $$("[data-solid]").forEach(function (b) {
      b.addEventListener("click", function () { pick(b.getAttribute("data-solid")); });
    });
    pick("triprism");
  }

  /* ---------- 8. construction stepper (page 08) ---------- */
  var stepHost = $("#con-step");
  if (stepHost) {
    var steps = $$("[data-step-img]");
    var cap = $("#con-cap");
    var caps = [
      "Step 1 — Draw the line AB and mark the point P above it.",
      "Step 2 — Place one edge of the set square along AB, then slide it until the other edge passes through P.",
      "Step 3 — Hold the set square firmly and draw the line along that edge. Mark the right angle with the small square symbol."
    ];
    function showStep(i) {
      steps.forEach(function (s, k) { s.classList.toggle("hidden", k !== i); });
      if (cap) cap.textContent = caps[i];
      $$("[data-goto-step]").forEach(function (b) {
        b.classList.toggle("on", parseInt(b.getAttribute("data-goto-step"), 10) === i);
      });
    }
    $$("[data-goto-step]").forEach(function (b) {
      b.addEventListener("click", function () { showStep(parseInt(b.getAttribute("data-goto-step"), 10)); });
    });
    showStep(0);
  }

  /* ---------- 9. glossary search ---------- */
  var gs = $("#gloss-search");
  if (gs) {
    var items = $$(".gitem"), none = $("#gloss-empty");
    gs.addEventListener("input", function () {
      var q = gs.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (it) {
        var hit = !q || it.textContent.toLowerCase().indexOf(q) > -1;
        it.style.display = hit ? "" : "none";
        if (hit) shown++;
      });
      $$(".galpha").forEach(function (h) {
        var sib = h.nextElementSibling, any = false;
        while (sib && sib.classList.contains("gitem")) {
          if (sib.style.display !== "none") { any = true; break; }
          sib = sib.nextElementSibling;
        }
        h.style.display = any ? "" : "none";
      });
      if (none) none.style.display = shown ? "none" : "";
    });
  }

  /* ---------- 10. quiz engine ---------- */
  var qHost = $("#quiz");
  if (qHost && window.QUIZ) {
    var total = window.QUIZ.length, answered = 0, score = 0;
    var scoreEl = $("#quiz-score"), bar = $("#quiz-progress");
    window.QUIZ.forEach(function (item, i) {
      var card = document.createElement("div");
      card.className = "qcard";
      var html = '<div class="qn">Question ' + (i + 1) + " of " + total + (item.topic ? ", " + item.topic : "") + "</div>" +
        '<div class="qt">' + item.q + "</div>" +
        (item.fig ? '<div class="qfig">' + item.fig + "</div>" : "") +
        "<div class='opts'>";
      item.options.forEach(function (o, j) {
        html += '<button type="button" data-opt="' + j + '"><span class="k">' + "ABCD"[j] + "</span><span>" + o + "</span></button>";
      });
      html += '</div><div class="fb"></div>';
      card.innerHTML = html;
      qHost.appendChild(card);

      var fb = card.querySelector(".fb");
      card.querySelectorAll("[data-opt]").forEach(function (b) {
        b.addEventListener("click", function () {
          var pick = parseInt(b.getAttribute("data-opt"), 10);
          var ok = pick === item.answer;
          card.querySelectorAll("[data-opt]").forEach(function (o, k) {
            o.disabled = true;
            if (k === item.answer) o.classList.add("correct");
            else if (k === pick) o.classList.add("wrong");
          });
          fb.className = "fb show " + (ok ? "ok" : "no");
          fb.innerHTML = (ok ? "<b>Correct!</b> " : "<b>Not quite.</b> ") + item.why;
          answered++;
          if (ok) score++;
          if (scoreEl) scoreEl.textContent = score + " / " + answered;
          if (bar) bar.style.width = Math.round((answered / total) * 100) + "%";
        });
      });
    });
  }
})();
