/* ============================================================
   shrine.js — 伏魔御廚子 (Malevolent Shrine)
   A 60-second cross-section arcade game for Ch.5.

   The maths is the same as Slice Lab: a flat plane cuts a solid and
   the exposed face is a cross-section.  The control is different —
   you draw the blade with your finger.

   Blade model (see dev/check_vows.js):
     • the plane is hinged on the world Z axis: n = (sin t, cos t, 0)
     • it always passes through the spirit's centre (s = 0)
     • the player draws a line on screen; t is solved so that the
       blade's in-plane direction e(t) = (cos t, -sin t, 0) projects
       onto the screen *parallel to that line* — the blade lies along
       the swipe, not across it (see tiltFromStroke below)
     • t runs -90°…90°, i.e. the whole pencil of planes through the
       Z axis, so either lean is reachable
     • each vow spawns its solid at an authored yaw, which supplies
       the turn the player cannot control
   ============================================================ */
(function () {
  "use strict";

  var THREE = window.THREE, GEO = window.GEO, VOWS = window.VOWS;
  if (!THREE || !GEO || !VOWS) return;

  var $ = function (s) { return document.querySelector(s); };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t; }
  function easeOutBack(t) {
    var c1 = 1.7, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  var RUN_SECONDS = 60;
  var CUT_DUR = 1.15;        /* one cut animation, start to next spirit */
  var DRAG_MIN = 8;          /* px before a stroke has a usable direction */
  var SWIPE_MIN = 24;        /* px before it counts as a cut at all */

  /* ---------------------------------------------------------- *
   *  1. saved best
   * ---------------------------------------------------------- */
  var KEY = "ch05-shrine-best-v1";
  var best = 0, soundOn = true;
  try {
    best = parseInt(localStorage.getItem(KEY) || "0", 10) || 0;
    soundOn = localStorage.getItem(KEY + "-sound") !== "0";
  } catch (e) { }

  function saveBest(v) {
    try { localStorage.setItem(KEY, String(v)); } catch (e) { }
  }
  function saveSound() {
    try { localStorage.setItem(KEY + "-sound", soundOn ? "1" : "0"); } catch (e) { }
  }

  /* ---------------------------------------------------------- *
   *  2. DOM
   * ---------------------------------------------------------- */
  var stageEl = $("#dm-stage");
  var canvas = $("#dm-canvas");
  var paperEl = $("#dm-paper");
  var inkEl = $("#dm-ink");
  var elTime = $("#dm-time"), elClock = $("#dm-clock");
  var elScore = $("#dm-score");
  var elCombo = $("#dm-combo"), elComboB = elCombo.querySelector("b");
  var elVow = $("#dm-vow"), elTarget = $("#dm-target"), elTargetZh = $("#dm-target-zh");
  var elSpirit = $("#dm-spirit");
  var elCard = $("#dm-card"), elCardShape = $("#dm-card-shape");
  var elCardK = $("#dm-card-k"), elCardName = $("#dm-card-name"), elCardZh = $("#dm-card-zh");
  var elHint = $("#dm-hint");
  var elIntro = $("#dm-intro"), elEnd = $("#dm-end");
  var elRank = $("#dm-rank"), elFinal = $("#dm-final"), elKills = $("#dm-kills");
  var elBestCombo = $("#dm-bestcombo"), elBest = $("#dm-best"), elEndNote = $("#dm-end-note");
  var btnSound = $("#dm-sound"), btnAgain = $("#dm-again"), btnAgain2 = $("#dm-again-btn");
  var elStamp = $("#dm-stamp");

  var pctx = paperEl.getContext("2d");
  var ictx = inkEl.getContext("2d");
  var cctx = elCardShape.getContext("2d");

  /* ---------------------------------------------------------- *
   *  3. state
   * ---------------------------------------------------------- */
  var S = {
    mode: "intro",      /* intro | aim | cut | over */
    t: 0,               /* seconds inside the current mode */
    time: RUN_SECONDS,
    score: 0,
    combo: 1,
    bestCombo: 1,
    kills: 0,
    misses: 0,
    vow: null,
    pool: [],
    tris: null,
    last: null,
    slash: null,
    done: false
  };

  /* ---------------------------------------------------------- *
   *  4. renderer + scene
   * ---------------------------------------------------------- */
  /* this build has no colour management: sRGB output would brighten every
     material, so authored colours are converted to linear on the way in */
  function C(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.localClippingEnabled = true;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  var HOME = new THREE.Vector3(2.7, 2.0, 7.7);
  camera.position.copy(HOME);

  var controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.minAzimuthAngle = -0.75;
  controls.maxAzimuthAngle = 0.75;
  controls.rotateSpeed = 0.55;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8b8, 0.4));
  var key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(3.2, 5.2, 4.4);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xfff2e0, 0.25);
  fill.position.set(-4.5, 1.2, 2.2);
  scene.add(fill);
  var rim = new THREE.DirectionalLight(0xcfd6e0, 0.3);
  rim.position.set(-2.2, 2.6, -4.2);
  scene.add(rim);

  var root = new THREE.Group();
  scene.add(root);

  var bodyMat = new THREE.MeshStandardMaterial({
    color: C(0xe6e0d2), roughness: 0.8, metalness: 0.0,
    emissive: 0x2a2620, emissiveIntensity: 0.06,
    side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
  });
  var edgeMat = new THREE.LineBasicMaterial({ color: C(0x17130f), transparent: true, opacity: 0.85 });
  var shellMat = new THREE.MeshBasicMaterial({ color: C(0x17130f), side: THREE.BackSide });

  var body = null, edges = null, shell = null;

  /* blade preview */
  var bladeGroup = new THREE.Group();
  scene.add(bladeGroup);
  var bladeGeo = new THREE.PlaneGeometry(3.0, 3.0);
  var bladeMat = new THREE.MeshBasicMaterial({
    color: C(0x17130f), transparent: true, opacity: 0.085,
    side: THREE.DoubleSide, depthWrite: false
  });
  var bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
  bladeGroup.add(bladeMesh);
  var bladeRim = new THREE.LineSegments(
    new THREE.EdgesGeometry(bladeGeo),
    new THREE.LineBasicMaterial({ color: C(0x17130f), transparent: true, opacity: 0.42, depthWrite: false })
  );
  bladeGroup.add(bladeRim);
  bladeGroup.visible = false;

  /* live section outline on the solid */
  var SEAM_MAX = 220;
  var seamPos = new Float32Array(SEAM_MAX * 3);
  var seamGeo = new THREE.BufferGeometry();
  seamGeo.setAttribute("position", new THREE.BufferAttribute(seamPos, 3));
  var seamLine = new THREE.Line(seamGeo, new THREE.LineBasicMaterial({
    color: C(0xc0362c), transparent: true, opacity: 0.95, depthWrite: false
  }));
  seamLine.visible = false;
  scene.add(seamLine);

  /* ---------------------------------------------------------- *
   *  5. paper backdrop — ensō, torii, ink flecks
   * ---------------------------------------------------------- */
  function paintPaper() {
    var W = paperEl.width, H = paperEl.height;
    if (!W || !H) return;
    var x = pctx;

    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, W, H);
    x.fillStyle = "#f4f1e8";
    x.fillRect(0, 0, W, H);

    /* fibre: a repeating noise tile keeps this cheap */
    var tile = document.createElement("canvas");
    tile.width = tile.height = 96;
    var tc = tile.getContext("2d");
    var img = tc.createImageData(96, 96);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = 190 + Math.random() * 65;
      img.data[i] = v; img.data[i + 1] = v - 4; img.data[i + 2] = v - 14;
      img.data[i + 3] = 16 + Math.random() * 12;
    }
    tc.putImageData(img, 0, 0);
    x.fillStyle = x.createPattern(tile, "repeat");
    x.fillRect(0, 0, W, H);

    var cx = W * 0.5, cy = H * 0.52, R = Math.min(W, H) * 0.3;

    /* faint torii framing the spirit */
    x.save();
    x.globalAlpha = 0.045;
    x.fillStyle = "#17130f";
    var gw = R * 2.3, gh = R * 2.0, gx = cx, gy = cy;
    var postW = gw * 0.05;
    x.fillRect(gx - gw * 0.46, gy - gh * 0.42, postW, gh * 0.86);
    x.fillRect(gx + gw * 0.46 - postW, gy - gh * 0.42, postW, gh * 0.86);
    /* nuki — the lower tie beam */
    x.fillRect(gx - gw * 0.5, gy - gh * 0.2, gw, gh * 0.035);
    /* kasagi — the curved top lintel */
    x.beginPath();
    x.moveTo(gx - gw * 0.58, gy - gh * 0.44);
    x.quadraticCurveTo(gx, gy - gh * 0.5, gx + gw * 0.58, gy - gh * 0.44);
    x.lineTo(gx + gw * 0.55, gy - gh * 0.39);
    x.quadraticCurveTo(gx, gy - gh * 0.445, gx - gw * 0.55, gy - gh * 0.39);
    x.closePath();
    x.fill();
    /* shimaki — the small centre block */
    x.fillRect(gx - gw * 0.045, gy - gh * 0.4, gw * 0.09, gh * 0.06);
    x.restore();

    /* ensō — a brush circle with a gap and a dry tail */
    var a0 = -0.55, a1 = Math.PI * 2 - 1.05, steps = 260;
    x.lineCap = "round";
    var prev = null;
    for (var k = 0; k <= steps; k++) {
      var t = k / steps;
      var a = a0 + (a1 - a0) * t;
      var wob = 1 + Math.sin(a * 3.3) * 0.014 + Math.sin(a * 7.9 + 1) * 0.007;
      var rr = R * wob;
      var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 1.02;
      if (prev) {
        var w = (0.028 - 0.016 * t) * R * (0.75 + 0.25 * Math.sin(a * 2.1));
        x.beginPath();
        x.moveTo(prev[0], prev[1]);
        x.lineTo(px, py);
        x.lineWidth = Math.max(1.2, w);
        x.strokeStyle = "rgba(23,19,15," + (0.2 + 0.12 * Math.sin(a * 5.3) + 0.05) + ")";
        x.stroke();
      }
      prev = [px, py];
    }

    /* ink flecks near the ring */
    for (var f = 0; f < 26; f++) {
      var ang = Math.random() * Math.PI * 2;
      var dist = R * (1.02 + Math.random() * 0.35);
      var fx = cx + Math.cos(ang) * dist, fy = cy + Math.sin(ang) * dist;
      var rad = 0.4 + Math.random() * 2.6;
      x.beginPath();
      x.ellipse(fx, fy, rad, rad * (0.5 + Math.random()), Math.random() * 3, 0, Math.PI * 2);
      x.fillStyle = "rgba(23,19,15," + (0.05 + Math.random() * 0.14) + ")";
      x.fill();
    }
  }

  /* ---------------------------------------------------------- *
   *  6. spirit
   * ---------------------------------------------------------- */
  function clearSpirit() {
    [body, edges, shell].forEach(function (o) {
      if (!o) return;
      if (o.parent) o.parent.remove(o);
    });
    if (body && body.geometry) body.geometry.dispose();
    if (shell && shell.geometry) shell.geometry.dispose();
    body = edges = shell = null;
  }

  function rotYSpec(spec, deg) {
    if (!deg) return spec;
    var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var p = spec.positions, n = spec.normals;
    var outP = new Float32Array(p.length), outN = new Float32Array(n.length);
    for (var i = 0; i < p.length; i += 3) {
      outP[i] = p[i] * c + p[i + 2] * s;
      outP[i + 1] = p[i + 1];
      outP[i + 2] = -p[i] * s + p[i + 2] * c;
      outN[i] = n[i] * c + n[i + 2] * s;
      outN[i + 1] = n[i + 1];
      outN[i + 2] = -n[i] * s + n[i + 2] * c;
    }
    return { positions: outP, normals: outN };
  }

  function spawnSpirit(vow) {
    clearSpirit();
    var spec = rotYSpec(GEO.SOLIDS[vow.solid].make(), vow.yaw);
    S.tris = GEO.trianglesOf(spec);

    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(spec.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(spec.normals, 3));
    g.computeBoundingSphere();

    body = new THREE.Mesh(g, bodyMat);
    root.add(body);

    shell = new THREE.Mesh(g, shellMat);
    shell.scale.setScalar(1.022);
    root.add(shell);

    edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 16), edgeMat);
    root.add(edges);

    /* a small entrance pop */
    root.scale.setScalar(0.82);
    root.rotation.y = -0.16;
    S.pop = 0;
  }

  /* ---------------------------------------------------------- *
   *  7. gesture -> blade
   *     The blade is hinged on the world Z axis, so it always
   *     contains that axis and is seen almost edge-on: on screen it
   *     reads as a line.  The stroke chooses the lean.
   *
   *     e(t) = (cos t, -sin t, 0) is the blade's in-plane direction
   *     that lies in the XY plane; the other one is Z itself.  For
   *     the blade to lie *along* the finger, e(t) must project onto
   *     the screen parallel to the stroke:
   *
   *       sx = cos t·right.x - sin t·right.y
   *       sy = cos t·up.x    - sin t·up.y
   *       sx·(-dy) - sy·dx = 0        ->  tan t = num / den
   *
   *     which has a closed form, so the blade tracks the finger
   *     exactly at any camera angle.
   * ---------------------------------------------------------- */
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  var drag = null;

  var _right = new THREE.Vector3(), _up = new THREE.Vector3();
  var _n = new THREE.Vector3(), _ex = new THREE.Vector3(), _ez = new THREE.Vector3();
  var _basis = new THREE.Matrix4();

  function pick(x, y) {
    var r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    var hits = body ? raycaster.intersectObject(body, false) : [];
    return hits.length ? hits[0] : null;
  }

  /* screen stroke (dx, dy with y pointing down) -> blade tilt in degrees */
  function tiltFromStroke(dx, dy) {
    /* matrixWorld is column-major: column 0 is the camera's right axis,
       column 1 its up axis */
    var m = camera.matrixWorld.elements;
    _right.set(m[0], m[1], m[2]).normalize();
    _up.set(m[4], m[5], m[6]).normalize();

    var ax = _right.x, ay = _up.x;        /* coefficients of cos t */
    var bx = -_right.y, by = -_up.y;      /* coefficients of sin t  */

    var num = ax * dy + ay * dx;
    var den = -(bx * dy + by * dx);
    if (Math.abs(num) < 1e-9 && Math.abs(den) < 1e-9) return null;

    var t = Math.atan2(num, den) * 180 / Math.PI;
    /* t and t ± 180 are the same plane, so fold into -90…90 */
    if (t > 90) t -= 180;
    if (t < -90) t += 180;
    return t;
  }

  function planeNormal(tilt) {
    var t = tilt * Math.PI / 180;
    return [Math.sin(t), Math.cos(t), 0];
  }

  /* local X along the stroke direction, local Y along the hinge */
  function orientBlade(tilt) {
    var a = tilt * Math.PI / 180;
    _n.set(Math.sin(a), Math.cos(a), 0);
    _ex.set(Math.cos(a), -Math.sin(a), 0);
    _ez.set(0, 0, 1);
    _basis.makeBasis(_ex, _ez, _n.clone().negate());
    bladeGroup.quaternion.setFromRotationMatrix(_basis);
  }

  function updatePreview(tilt) {
    var n = planeNormal(tilt);
    var sec = GEO.sectionAt(S.tris, n, 0);
    S.preview = sec;
    S.tilt = tilt;

    bladeGroup.position.set(0, 0, 0);
    orientBlade(tilt);
    bladeGroup.visible = true;

    if (!sec) { seamLine.visible = false; return; }
    var m = Math.min(sec.hull3.length, SEAM_MAX - 1);
    for (var i = 0; i <= m; i++) {
      var p = sec.hull3[i % sec.hull3.length];
      seamPos[i * 3] = p[0] * 1.004;
      seamPos[i * 3 + 1] = p[1] * 1.004;
      seamPos[i * 3 + 2] = p[2] * 1.004;
    }
    seamGeo.setDrawRange(0, m + 1);
    seamGeo.attributes.position.needsUpdate = true;
    seamGeo.computeBoundingSphere();
    seamLine.visible = true;
  }

  function clearPreview() {
    bladeGroup.visible = false;
    seamLine.visible = false;
    S.preview = null;
  }

  /* ---------------------------------------------------------- *
   *  8. the cut
   * ---------------------------------------------------------- */
  function capGeometry(sec) {
    var c = sec.center3, h = sec.hull3, pos = [], nor = [];
    for (var i = 0; i < h.length; i++) {
      var a = h[i], b = h[(i + 1) % h.length];
      pos.push(c[0], c[1], c[2], a[0], a[1], a[2], b[0], b[1], b[2]);
      for (var k = 0; k < 3; k++) nor.push(sec.n[0], sec.n[1], sec.n[2]);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.computeBoundingSphere();
    return g;
  }

  function contourGeometry(sec) {
    var pts = [];
    for (var i = 0; i < sec.hull3.length; i++) {
      var p = sec.hull3[i];
      pts.push(new THREE.Vector3(p[0], p[1], p[2]));
    }
    pts.push(pts[0].clone());
    var g = new THREE.BufferGeometry().setFromPoints(pts);
    g.computeBoundingSphere();
    return g;
  }

  var halves = null;
  function clearHalves() {
    if (!halves) return;
    [halves.top, halves.bot].forEach(function (g) { if (g && g.parent) g.parent.remove(g); });
    if (halves.topMat) halves.topMat.dispose();
    if (halves.botMat) halves.botMat.dispose();
    if (halves.capMat) halves.capMat.dispose();
    if (halves.capGeo) halves.capGeo.dispose();
    if (halves.lineGeo) halves.lineGeo.dispose();
    if (halves.lineMat) halves.lineMat.dispose();
    halves = null;
  }

  function makeHalves(sec) {
    var n = new THREE.Vector3(sec.n[0], sec.n[1], sec.n[2]);
    var topMat = bodyMat.clone();
    topMat.clippingPlanes = [new THREE.Plane(n.clone(), 0)];
    var botMat = bodyMat.clone();
    botMat.clippingPlanes = [new THREE.Plane(n.clone().negate(), 0)];
    /* flat ink-red fill — a manga screentone, not a lit surface */
    var capMat = new THREE.MeshBasicMaterial({
      color: C(0xc0362c), side: THREE.DoubleSide
    });
    var capGeo = capGeometry(sec);
    var lineGeo = contourGeometry(sec);
    var lineMat = new THREE.LineBasicMaterial({ color: C(0x17130f), transparent: true, opacity: 0.9 });

    var top = new THREE.Group(), bot = new THREE.Group();
    top.add(new THREE.Mesh(body.geometry, topMat));
    bot.add(new THREE.Mesh(body.geometry, botMat));
    top.add(new THREE.Mesh(capGeo, capMat));
    bot.add(new THREE.Mesh(capGeo, capMat));
    top.add(new THREE.Line(lineGeo, lineMat));
    bot.add(new THREE.Line(lineGeo, lineMat));
    scene.add(top); scene.add(bot);

    body.visible = false;
    if (edges) edges.visible = false;
    if (shell) shell.visible = false;

    halves = {
      top: top, bot: bot, topMat: topMat, botMat: botMat,
      capMat: capMat, capGeo: capGeo, lineGeo: lineGeo, lineMat: lineMat, n: n
    };
  }

  function setSeparation(d) {
    if (!halves) return;
    var n = halves.n;
    halves.top.position.copy(n).multiplyScalar(d * 0.42);
    halves.bot.position.copy(n).multiplyScalar(-d * 0.42);
    halves.topMat.clippingPlanes[0].constant = -n.dot(halves.top.position);
    halves.botMat.clippingPlanes[0].constant = -n.clone().negate().dot(halves.bot.position);
  }

  var cutSeq = 0;                 /* guards the delayed verdict */
  function performCut(tilt) {
    if (S.mode !== "aim") return;
    var n = planeNormal(tilt);
    var sec = GEO.sectionAt(S.tris, n, 0);
    if (!sec) return;

    var res = GEO.classify(sec.hull2);
    var win = S.vow.accept.indexOf(res.kind) >= 0;
    S.last = { sec: sec, res: res, win: win };

    clearPreview();
    makeHalves(sec);
    spawnSplash(sec);
    S.mode = "cut";
    S.t = 0;
    S.missed = !win;

    if (win) {
      S.kills++;
      S.score += 100 * S.combo;
      S.combo = Math.min(8, S.combo + 1);
      S.bestCombo = Math.max(S.bestCombo, S.combo);
      S.time = Math.min(RUN_SECONDS, S.time + 1.5);
      S.misses = 0;
      Sound.hit();
      popCombo();
      flashVow("hit");
    } else {
      S.combo = 1;
      S.time = Math.max(0, S.time - 4);
      S.misses++;
      Sound.miss();
      flashVow("miss");
    }
    Sound.slash();
    paintSlashStroke(S.slashA, S.slashB, win);
    updateHud();
    S.slashA = S.slashB = null;

    /* let the cut and its ink land before the verdict covers the middle */
    var mine = ++cutSeq;
    setTimeout(function () {
      if (S.done || cutSeq !== mine) return;
      if (win) stamp();
      showCard(res, win);
    }, 150);
  }

  /* ---------------------------------------------------------- *
   *  9. section card
   * ---------------------------------------------------------- */
  function showCard(res, win) {
    elCard.hidden = false;
    elCard.classList.toggle("bad", !win);
    elCardK.textContent = win ? "DISMANTLED" : "NOT THE VOW";
    elCardName.textContent = res.name;
    elCardZh.textContent = res.zh;

    var W = elCardShape.width, H = elCardShape.height;
    cctx.clearRect(0, 0, W, H);
    var sec = S.last.sec;
    var pts = sec.hull2.slice();
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    pts.forEach(function (p) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    });
    var pad = 12;
    var sc = Math.min((W - pad * 2) / Math.max(1e-6, maxX - minX), (H - pad * 2) / Math.max(1e-6, maxY - minY));
    var mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    cctx.beginPath();
    pts.forEach(function (p, i) {
      var px = W / 2 + (p[0] - mx) * sc, py = H / 2 - (p[1] - my) * sc;
      if (i === 0) cctx.moveTo(px, py); else cctx.lineTo(px, py);
    });
    cctx.closePath();
    cctx.fillStyle = win ? "rgba(192,54,44,.9)" : "rgba(244,241,232,.14)";
    cctx.fill();
    cctx.strokeStyle = win ? "#f4f1e8" : "#e0523f";
    cctx.lineWidth = 2;
    cctx.lineJoin = "round";
    cctx.stroke();

    requestAnimationFrame(function () { elCard.classList.add("show"); });
    clearTimeout(showCard._t);
    showCard._t = setTimeout(function () {
      elCard.classList.remove("show");
      setTimeout(function () { elCard.hidden = true; }, 220);
    }, 1150);
  }

  /* ---------------------------------------------------------- *
   * 10. HUD
   * ---------------------------------------------------------- */
  function updateHud() {
    elTime.textContent = String(Math.max(0, Math.ceil(S.time)));
    elClock.classList.toggle("low", S.time <= 10);
    elScore.textContent = String(S.score);
    elComboB.textContent = "×" + S.combo;
    elCombo.classList.toggle("on", S.combo > 1);
  }

  function stamp() {
    elStamp.classList.remove("go");
    void elStamp.offsetWidth;
    elStamp.classList.add("go");
  }

  function flashVow(kind) {
    elVow.classList.remove("hit", "miss");
    void elVow.offsetWidth;
    elVow.classList.add(kind);
  }

  function popCombo() {
    elCombo.classList.remove("pop");
    void elCombo.offsetWidth;
    elCombo.classList.add("pop");
  }

  function setVow(vow) {
    S.vow = vow;
    elTarget.textContent = vow.target;
    elTargetZh.textContent = vow.zh;
    var s = GEO.SOLIDS[vow.solid];
    elSpirit.textContent = s.en.toUpperCase() + " " + s.zh;
    elVow.classList.remove("hit", "miss");
    spawnSpirit(vow);
    S.misses = 0;
  }

  function nextVow() {
    if (!S.pool.length) S.pool = shuffle(VOWS.slice());
    var v = S.pool.shift();
    if (S.vow && v.solid === S.vow.solid && S.pool.length) {
      S.pool.push(v);
      v = S.pool.shift();
    }
    setVow(v);
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------------------------------------------------------- *
   * 11. ink overlay — slash stroke, cut flash, splash
   *     Everything here is drawn on the ink canvas above the 3-D
   *     scene, so it reads as ink on the page rather than dust in
   *     the air.  Sizes are scaled by INK_K so a phone and a
   *     projector get the same picture.
   * ---------------------------------------------------------- */
  var slashFx = null;
  var flashFx = null;
  var inkBits = [];
  var INK_K = 1;

  function paintSlashStroke(a, b, ok) {
    if (!a || !b) return;
    slashFx = { a: a, b: b, t: 0, ok: ok };
  }

  /* world point -> ink canvas pixel */
  function projectToInk(p) {
    var v = new THREE.Vector3(p[0], p[1], p[2]).project(camera);
    return [(v.x * 0.5 + 0.5) * inkEl.width, (-v.y * 0.5 + 0.5) * inkEl.height];
  }

  /* the burst: droplets thrown off the fresh cut, plus a short glow
     along the section outline itself.
     The plane is seen almost edge-on, so its projected outline is a thin
     sliver — spraying "outward from the middle" would just run along the
     cut.  Ink is squeezed out sideways instead, along the plane normal
     projected on screen. */
  function spawnSplash(sec) {
    if (!sec || !sec.hull3 || sec.hull3.length < 3) return;

    var pts = sec.hull3.map(projectToInk);
    var cx = 0, cy = 0, i;
    for (i = 0; i < pts.length; i++) { cx += pts[i][0]; cy += pts[i][1]; }
    cx /= pts.length; cy /= pts.length;

    /* screen direction of the plane normal */
    var o = projectToInk([0, 0, 0]);
    var e = projectToInk(sec.n);
    var nx = e[0] - o[0], ny = e[1] - o[1];
    var nl = Math.hypot(nx, ny);
    if (nl < 1e-3) { nx = 0; ny = -1; } else { nx /= nl; ny /= nl; }
    /* the tangent of the cut line, for a little scatter along it */
    var tx = -ny, ty = nx;

    var k = INK_K;
    var n = Math.min(52, 22 + pts.length * 2);

    for (i = 0; i < n; i++) {
      /* walk the outline so the spray comes off the whole cut, not just
         the two tips of the sliver */
      var a0 = pts[i % pts.length], a1 = pts[(i + 1) % pts.length];
      var f = Math.random();
      var px = a0[0] + (a1[0] - a0[0]) * f;
      var py = a0[1] + (a1[1] - a0[1]) * f;
      var side = Math.random() < 0.5 ? -1 : 1;
      var sp = (340 + Math.pow(Math.random(), 0.7) * 820) * k;
      var along = (Math.random() - 0.5) * 130 * k;

      inkBits.push({
        x: px + (Math.random() - 0.5) * 12 * k,
        y: py + (Math.random() - 0.5) * 12 * k,
        vx: nx * sp * side + tx * along,
        vy: ny * sp * side + ty * along - 50 * k,
        r: (1.8 + Math.random() * 3.4) * k,
        life: 0,
        max: 0.36 + Math.random() * 0.42,
        red: Math.random() < 0.28,
        grav: 0.45 + Math.random() * 0.5,
        drag: 0.88 + Math.random() * 0.07
      });
    }

    /* a few heavy drops that carry further and fall */
    for (i = 0; i < 5; i++) {
      var q = pts[(Math.random() * pts.length) | 0];
      var sd = Math.random() < 0.5 ? -1 : 1;
      var s2 = (420 + Math.random() * 520) * k;
      inkBits.push({
        x: q[0], y: q[1],
        vx: nx * s2 * sd + tx * (Math.random() - 0.5) * 180 * k,
        vy: ny * s2 * sd + ty * (Math.random() - 0.5) * 180 * k - 140 * k,
        r: (3.4 + Math.random() * 3.0) * k,
        life: 0,
        max: 0.8 + Math.random() * 0.45,
        red: Math.random() < 0.35,
        grav: 1.1,
        drag: 0.985
      });
    }

    var reach = 0;
    for (i = 0; i < pts.length; i++) {
      reach = Math.max(reach, Math.hypot(pts[i][0] - cx, pts[i][1] - cy));
    }

    flashFx = { pts: pts, cx: cx, cy: cy, r: reach * 1.9, t: 0 };
  }

  function updateInkBits(dt) {
    var g = 1450 * INK_K;
    for (var i = inkBits.length - 1; i >= 0; i--) {
      var b = inkBits[i];
      b.life += dt;
      if (b.life >= b.max) { inkBits.splice(i, 1); continue; }
      b.vy += g * b.grav * dt;
      var d = Math.pow(b.drag, dt * 60);
      b.vx *= d; b.vy *= d;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
  }

  function drawInkBits() {
    for (var i = 0; i < inkBits.length; i++) {
      var b = inkBits[i];
      var a = 1 - Math.pow(b.life / b.max, 1.7);
      var sp = Math.hypot(b.vx, b.vy);
      var st = Math.min(2.4, sp / (620 * INK_K));      /* stretched along its flight */
      ictx.save();
      ictx.translate(b.x, b.y);
      ictx.rotate(Math.atan2(b.vy, b.vx));
      ictx.beginPath();
      ictx.ellipse(0, 0, b.r * (1 + st), b.r * (1 - 0.28 * Math.min(1, st)), 0, 0, Math.PI * 2);
      ictx.fillStyle = b.red
        ? "rgba(192,54,44," + (0.78 * a).toFixed(3) + ")"
        : "rgba(23,19,15," + (0.82 * a).toFixed(3) + ")";
      ictx.fill();
      ictx.restore();
    }
  }

  function drawFlash(dt) {
    if (!flashFx) return;
    flashFx.t += dt;
    var p = flashFx.t / 0.34;
    if (p >= 1) { flashFx = null; return; }

    var a = 1 - p;
    var pts = flashFx.pts, cx = flashFx.cx, cy = flashFx.cy;

    /* the bloom: the plane is edge-on, so a glow is the only thing that
       reads as "light" on a section seen as a line */
    var R = Math.max(40, flashFx.r) * (1 + 0.4 * easeOut(p));
    var g = ictx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, "rgba(255,238,226," + (0.30 * a * a).toFixed(3) + ")");
    g.addColorStop(0.35, "rgba(224,82,63," + (0.13 * a * a).toFixed(3) + ")");
    g.addColorStop(1, "rgba(224,82,63,0)");
    ictx.fillStyle = g;
    ictx.beginPath();
    ictx.arc(cx, cy, R, 0, Math.PI * 2);
    ictx.fill();

    /* the bite: a thin hot line right on the cut */
    ictx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      if (i === 0) ictx.moveTo(pts[i][0], pts[i][1]);
      else ictx.lineTo(pts[i][0], pts[i][1]);
    }
    ictx.closePath();
    ictx.lineJoin = "round";
    ictx.lineCap = "round";
    ictx.strokeStyle = "rgba(255,250,246," + (0.9 * a * a * a).toFixed(3) + ")";
    ictx.lineWidth = Math.max(1, (1.2 + 2.6 * (1 - p)) * INK_K);
    ictx.stroke();
  }

  function drawSlash(dt) {
    if (!slashFx) return;
    slashFx.t += dt;
    var p = Math.min(1, slashFx.t / 0.55);
    if (p >= 1) { slashFx = null; return; }

    var a = slashFx.a, b = slashFx.b;
    var alpha = 1 - easeIn(p);
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;

    /* a tapered brush body: thick in the middle, pointed at both ends */
    var N = 26;
    ictx.beginPath();
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      var w = Math.sin(t * Math.PI) * Math.min(10, 3 + len * 0.018);
      var px = a[0] + dx * t + nx * w, py = a[1] + dy * t + ny * w;
      if (i === 0) ictx.moveTo(px, py); else ictx.lineTo(px, py);
    }
    for (var j = N; j >= 0; j--) {
      var t2 = j / N;
      var w2 = Math.sin(t2 * Math.PI) * Math.min(10, 3 + len * 0.018);
      ictx.lineTo(a[0] + dx * t2 - nx * w2, a[1] + dy * t2 - ny * w2);
    }
    ictx.closePath();
    ictx.fillStyle = "rgba(23,19,15," + (0.62 * alpha) + ")";
    ictx.fill();

    /* flecks along the stroke */
    for (var k = 0; k < 7; k++) {
      var tt = Math.random();
      var ox = a[0] + dx * tt + nx * (Math.random() - 0.5) * 26;
      var oy = a[1] + dy * tt + ny * (Math.random() - 0.5) * 26;
      ictx.beginPath();
      ictx.arc(ox, oy, Math.random() * 2.2, 0, Math.PI * 2);
      ictx.fillStyle = "rgba(23,19,15," + (0.5 * alpha) + ")";
      ictx.fill();
    }
  }

  function drawInkFx(dt) {
    ictx.clearRect(0, 0, inkEl.width, inkEl.height);
    drawFlash(dt);
    drawSlash(dt);
    updateInkBits(dt);
    drawInkBits();
  }

  /* ---------------------------------------------------------- *
   * 12. run flow
   * ---------------------------------------------------------- */
  function startRun() {
    S.time = RUN_SECONDS;
    S.score = 0;
    S.combo = 1;
    S.bestCombo = 1;
    S.kills = 0;
    S.misses = 0;
    S.pool = shuffle(VOWS.slice());
    S.mode = "aim";
    S.t = 0;
    S.done = false;
    clearHalves();
    nextVow();
    updateHud();
    elEnd.hidden = true;
    elHint.style.opacity = "1";
    Sound.start();
  }

  function endRun() {
    S.mode = "over";
    elCard.classList.remove("show");
    elCard.hidden = true;
    S.done = true;
    clearHalves();
    clearPreview();
    Sound.end();

    var rank = S.kills >= 12 ? "S" : S.kills >= 8 ? "A" : S.kills >= 5 ? "B" : "C";
    elRank.textContent = rank;
    elFinal.textContent = String(S.score);
    elKills.textContent = String(S.kills);
    elBestCombo.textContent = "×" + S.bestCombo;
    if (S.score > best) { best = S.score; saveBest(best); }
    elBest.textContent = String(best);
    elEndNote.textContent = rank === "S"
      ? "Every spirit dismantled exactly as vowed. The domain closes."
      : rank === "A"
        ? "A clean run — only a few cuts missed the vow."
        : rank === "B"
          ? "Solid. The blade follows your line: across gives a flat face, upright gives a tall one."
          : "Keep going — draw the line you want to cut. Across the spirit cuts it flat; straight down cuts it upright.";

    elEnd.hidden = false;
  }

  /* ---------------------------------------------------------- *
   * 13. input
   * ---------------------------------------------------------- */
  function toCanvasXY(e) {
    var r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (inkEl.width / r.width), (e.clientY - r.top) * (inkEl.height / r.height)];
  }

  function onDown(e) {
    if (S.mode !== "aim") return;
    var hit = pick(e.clientX, e.clientY);
    if (!hit) return;                     /* empty space -> OrbitControls */
    e.stopPropagation();
    e.preventDefault();
    drag = { x0: e.clientX, y0: e.clientY, tilt: null, moved: false };
    S.slashA = toCanvasXY(e);
    S.slashB = S.slashA;
    clearPreview();                       /* the blade arrives with the stroke */
    if (elHint) elHint.style.opacity = "0";
  }

  function onMove(e) {
    if (!drag) return;
    e.stopPropagation();
    e.preventDefault();
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_MIN) return;
    drag.moved = true;
    var tilt = tiltFromStroke(dx, dy);
    if (tilt === null) return;
    drag.tilt = tilt;
    S.slashB = toCanvasXY(e);
    updatePreview(tilt);
  }

  function onUp(e) {
    if (!drag) return;
    e.stopPropagation();
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    var far = Math.hypot(dx, dy) >= SWIPE_MIN;
    /* a fast flick can end before any pointermove arrives, so solve from
       the final vector as a fallback */
    var tilt = drag.tilt === null ? tiltFromStroke(dx, dy) : drag.tilt;
    var a = S.slashA, b = toCanvasXY(e);
    drag = null;
    if (!far || tilt === null) { clearPreview(); S.slashA = S.slashB = null; return; }
    S.slashA = a; S.slashB = b;
    performCut(tilt);
  }

  canvas.addEventListener("pointerdown", onDown, true);
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("pointercancel", function () {
    if (!drag) return;
    drag = null;
    clearPreview();
    S.slashA = S.slashB = null;
  }, true);

  /* ---------------------------------------------------------- *
   * 14. audio
   * ---------------------------------------------------------- */
  var Sound = {
    ctx: null, on: soundOn,
    ensure: function () {
      if (!this.on) return null;
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { this.on = false; return null; }
        this.ctx = new AC();
        var n = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, n, n);
        var d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    tone: function (f0, f1, dur, type, vol, when) {
      var c = this.ensure(); if (!c) return;
      var t = c.currentTime + (when || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.03);
    },
    noise: function (dur, f0, f1, vol, q) {
      var c = this.ensure(); if (!c) return;
      var t = c.currentTime;
      var src = c.createBufferSource(); src.buffer = this.noiseBuf;
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = q || 1.2;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(c.destination);
      src.start(t); src.stop(t + dur + 0.05);
    },
    slash: function () {
      this.noise(0.22, 6000, 900, 0.14, 0.9);
      this.tone(1500, 380, 0.16, "triangle", 0.05);
    },
    hit: function () {
      this.tone(120, 46, 0.4, "sine", 0.16);
      this.noise(0.12, 900, 200, 0.07, 0.8);
      this.tone(880, 880, 0.35, "triangle", 0.035, 0.05);
    },
    miss: function () {
      this.tone(160, 96, 0.28, "square", 0.06);
      this.tone(150, 90, 0.3, "sawtooth", 0.03, 0.02);
    },
    start: function () {
      this.tone(70, 38, 1.1, "sine", 0.2);
      this.noise(0.9, 300, 60, 0.09, 0.6);
    },
    end: function () {
      this.tone(220, 70, 1.2, "sine", 0.12);
      this.noise(1.0, 500, 80, 0.06, 0.5);
    },
    tick: function () { this.tone(1200, 900, 0.05, "square", 0.02); }
  };

  /* ---------------------------------------------------------- *
   * 15. resize + loop
   * ---------------------------------------------------------- */
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var lastW = 0, lastH = 0;

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    paperEl.width = Math.round(w * DPR);
    paperEl.height = Math.round(h * DPR);
    inkEl.width = Math.round(w * DPR);
    inkEl.height = Math.round(h * DPR);
    /* ink is drawn in device pixels: this keeps droplets the same size
       on screen whatever the canvas resolution */
    INK_K = Math.min(inkEl.width, inkEl.height) / 620;
    paintPaper();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stageEl);
  window.addEventListener("resize", resize);

  var last = performance.now();
  var clockT = 0;

  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clockT += dt;

    if (S.mode === "aim" || S.mode === "cut") {
      S.time -= dt;
      if (S.time <= 0) { S.time = 0; updateHud(); endRun(); }
      else if (S.time <= 10) {
        if (Math.floor(S.time) !== Math.floor(S.time + dt)) Sound.tick();
      }
    }

    if (S.mode === "cut") {
      S.t += dt;
      var p = clamp(S.t / 0.42, 0, 1);
      setSeparation(easeOutBack(p));
      if (p >= 1) setSeparation(1);
      if (S.t > 0.82) {
        var f = clamp((S.t - 0.82) / 0.33, 0, 1);
        if (halves) {
          halves.top.position.y += dt * 0.9;
          halves.bot.position.y -= dt * 0.9;
          halves.topMat.transparent = true;
          halves.botMat.transparent = true;
          halves.capMat.transparent = true;
          halves.topMat.opacity = 1 - f;
          halves.botMat.opacity = 1 - f;
          halves.capMat.opacity = 1 - f;
          halves.lineMat.transparent = true;
          halves.lineMat.opacity = 0.9 * (1 - f);
        }
      }
      if (S.t >= CUT_DUR) {
        clearHalves();
        if (S.missed && S.misses >= 2) {
          nextVow();                       /* two misses: give a different vow */
        } else if (!S.missed) {
          nextVow();
        } else {
          spawnSpirit(S.vow);              /* retry the same vow */
        }
        S.mode = "aim";
        S.t = 0;
        updateHud();
      }
    }

    if (S.mode === "aim" && S.pop !== undefined && S.pop < 1) {
      S.pop = Math.min(1, S.pop + dt * 4.2);
      var e = easeOut(S.pop);
      root.scale.setScalar(0.82 + 0.18 * e);
      root.rotation.y = -0.16 * (1 - e);
    }

    drawInkFx(dt);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------- *
   * 16. boot
   * ---------------------------------------------------------- */
  function openDomain() {
    elIntro.classList.add("open");
    Sound.start();
    setTimeout(function () {
      elIntro.hidden = true;
      startRun();
    }, 780);
  }

  elIntro.addEventListener("click", function () {
    if (elIntro.classList.contains("open")) return;
    openDomain();
  });

  btnSound.addEventListener("click", function () {
    Sound.on = !Sound.on;
    soundOn = Sound.on;
    saveSound();
    btnSound.classList.toggle("off", !Sound.on);
    if (Sound.on) Sound.tick();
  });
  btnSound.classList.toggle("off", !Sound.on);

  function restart() {
    elEnd.hidden = true;
    startRun();
  }
  btnAgain.addEventListener("click", restart);
  btnAgain2.addEventListener("click", restart);

  resize();
  updateHud();
  requestAnimationFrame(loop);

  /* debug / test handle */
  window.Shrine = {
    start: function () { elIntro.hidden = true; startRun(); },
    cutAt: function (tilt) { performCut(tilt); },
    forceVow: function (id) {
      var v = VOWS.filter(function (x) { return x.id === id; })[0];
      if (v) setVow(v);
      return v ? v.target : null;
    },
    aim: function (tilt) { updatePreview(tilt); },
    tiltFor: function (dx, dy) { return tiltFromStroke(dx, dy); },
    pickAt: function (x, y) { var h = pick(x, y); return h ? h.distance : null; },
    blade: function (tilt) {
      orientBlade(tilt);
      return new THREE.Vector3(0, 0, 1).applyQuaternion(bladeGroup.quaternion).toArray();
    },
    state: S,
    vows: VOWS
  };

  /* auto-open the domain after a beat so the page is never stuck */
  setTimeout(function () {
    if (!elIntro.hidden && !elIntro.classList.contains("open")) openDomain();
  }, 2600);
})();
