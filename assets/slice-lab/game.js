/* ============================================================
   game.js — Slice Lab
   A 3-D cross-section game for HKDSE Form 1 Maths (Ch.5).

   The solid never moves: the camera orbits, and the cutting plane
   lives in world space.  That keeps the geometry honest — the
   section you see is computed from the very triangles on screen.

   Flow:  aim  ->  slice  ->  seam glows  ->  flash  ->  the two
          halves part  ->  camera squares up to the cut face  ->
          verdict card.
   ============================================================ */
(function () {
  "use strict";

  var THREE = window.THREE, GEO = window.GEO, LEVELS = window.LEVELS;
  if (!THREE || !GEO || !LEVELS) return;

  /* ---------------------------------------------------------- *
   *  0. little helpers
   * ---------------------------------------------------------- */
  var $ = function (s) { return document.querySelector(s); };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) {
    var c1 = 1.6, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function snap(v, list, tol) {
    var best = v, bd = tol;
    for (var i = 0; i < list.length; i++) {
      var d = Math.abs(v - list[i]);
      if (d < bd) { bd = d; best = list[i]; }
    }
    return best;
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------------------------------------------------------- *
   *  1. saved progress (this browser only)
   * ---------------------------------------------------------- */
  var SAVE_KEY = "ch05-slice-lab-v1";
  var save = { stars: {}, assist: false, sound: true };
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      var p = JSON.parse(raw);
      if (p && typeof p === "object") {
        save.stars = p.stars || {};
        save.assist = !!p.assist;
        save.sound = p.sound !== false;
      }
    }
  } catch (e) { /* private mode: play anyway, just no memory */ }

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { }
  }

  /* ---------------------------------------------------------- *
   *  2. DOM
   * ---------------------------------------------------------- */
  var stageEl = $("#stage");
  var canvas = $("#stage-canvas");
  var padEl = $("#pad"), scanEl = $("#scan");
  var elLvNo = $("#lv-no"), elGoalName = $("#goal-name"), elGoalZh = $("#goal-zh");
  var elTilt = $("#ro-tilt"), elTurn = $("#ro-turn"), elDepth = $("#ro-depth");
  var elDepthInput = $("#depth");
  var elScanName = $("#scan-name");
  var elTip = $("#tip"), elToast = $("#toast"), elFlash = $("#flash");
  var btnSlice = $("#btn-slice"), btnSound = $("#btn-sound"), btnMenu = $("#btn-menu");
  var btnHint = $("#btn-hint");
  var panelStart = $("#start-panel"), panelResult = $("#result-panel");
  var lvGrid = $("#lv-grid"), btnPlay = $("#btn-play");
  var resStars = $("#res-stars"), resVerdict = $("#res-verdict");
  var resName = $("#res-name"), resZh = $("#res-zh"), resRule = $("#res-rule");
  var btnRetry = $("#btn-retry"), btnNext = $("#btn-next"), btnShow = $("#btn-show");
  var elAssist = $("#assist");

  var pctx = padEl.getContext("2d");
  var sctx = scanEl.getContext("2d");

  /* ---------------------------------------------------------- *
   *  3. state
   * ---------------------------------------------------------- */
  var S = {
    index: 0,
    lv: LEVELS[0],
    phase: "menu",        // menu | aim | cutting | result
    tilt: 0, turn: 0, depth: 0,
    cuts: 0,
    tris: null,
    section: null,
    plane: null,
    halves: null,
    shake: 0
  };

  /* ---------------------------------------------------------- *
   *  4. three.js stage
   * ---------------------------------------------------------- */
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.localClippingEnabled = true;

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08101c, 9, 26);

  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  var HOME_DIR = new THREE.Vector3(0.58, 0.40, 0.72).normalize();
  var HOME = new THREE.Vector3(4.9, 3.35, 6.1);
  camera.position.copy(HOME);

  var controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minDistance = 3.0;
  controls.maxDistance = 9.5;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = Math.PI * 0.505;
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 0.7;
  controls.autoRotateSpeed = 0.55;
  controls.target.set(0, 0, 0);

  /* ---- lights ---- */
  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x091323, 0.36));
  var keyLight = new THREE.DirectionalLight(0xfff4e6, 0.82);
  keyLight.position.set(4.5, 7, 5.5);
  scene.add(keyLight);
  var rimLight = new THREE.DirectionalLight(0x49b6ff, 0.72);
  rimLight.position.set(-5.5, 2.6, -5);
  scene.add(rimLight);
  var warmLight = new THREE.DirectionalLight(0xffd9b0, 0.2);
  warmLight.position.set(-2, -4, 4);
  scene.add(warmLight);
  var underGlow = new THREE.PointLight(0x22d3ee, 1.1, 5, 2);
  underGlow.position.set(0, -1.6, 0.5);
  scene.add(underGlow);

  /* ---- floor grid + pedestal ---- */
  var grid = new THREE.GridHelper(44, 66, 0x1d3f63, 0x122338);
  grid.position.y = -1.62;
  grid.material.transparent = true;
  grid.material.opacity = 0.75;
  scene.add(grid);

  var pedestal = new THREE.Mesh(
    new THREE.RingGeometry(1.04, 1.15, 128),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  pedestal.rotation.x = -Math.PI / 2;
  pedestal.position.y = -1.6;
  scene.add(pedestal);

  var pedestal2 = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 1.9, 128),
    new THREE.MeshBasicMaterial({
      color: 0x1d7fa8, transparent: true, opacity: 0.07,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  pedestal2.rotation.x = -Math.PI / 2;
  pedestal2.position.y = -1.61;
  scene.add(pedestal2);

  /* ---- soft textures made at runtime (no external files) ---- */
  function dotTexture(inner, mid) {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var x = c.getContext("2d");
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(0.42, mid);
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var sparkTex = dotTexture("rgba(255,255,255,1)", "rgba(255,190,110,.55)");

  /* ---- dust motes ---- */
  var dust = (function () {
    var N = 240, pos = new Float32Array(N * 3), spd = [];
    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2, r = 1.4 + Math.random() * 6.5;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -1.4 + Math.random() * 5.2;
      pos[i * 3 + 2] = Math.sin(a) * r;
      spd.push(0.03 + Math.random() * 0.08);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    var m = new THREE.PointsMaterial({
      size: 0.055, map: sparkTex, color: 0x86d9ff, transparent: true,
      opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
      sizeAttenuation: true
    });
    var pts = new THREE.Points(g, m);
    scene.add(pts);
    return { pts: pts, pos: pos, spd: spd, n: N };
  })();

  /* ---- blade: a translucent grid plane with a bright rim ---- */
  function gridTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 512;
    var x = c.getContext("2d");
    x.fillStyle = "#000";
    x.fillRect(0, 0, 512, 512);
    x.strokeStyle = "rgba(90,210,255,.55)";
    x.lineWidth = 1.4;
    for (var i = 0; i <= 512; i += 32) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke();
    }
    x.strokeStyle = "rgba(190,245,255,.95)";
    x.lineWidth = 3;
    x.strokeRect(1.5, 1.5, 509, 509);
    var g = x.createRadialGradient(256, 256, 40, 256, 256, 330);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    x.globalCompositeOperation = "destination-out";
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    var t = new THREE.CanvasTexture(c);
    if ("encoding" in t) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  var bladeGroup = new THREE.Group();
  scene.add(bladeGroup);

  var bladeGeo = new THREE.PlaneGeometry(3.7, 3.7);
  var bladeMat = new THREE.MeshBasicMaterial({
    map: gridTexture(), transparent: true, opacity: 0.34, color: 0x6fe3ff,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    depthTest: false
  });
  var bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
  bladeMesh.renderOrder = 900;
  bladeGroup.add(bladeMesh);

  var rimMat = new THREE.LineBasicMaterial({
    color: 0xbdf4ff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
  });
  var bladeRim = new THREE.LineSegments(new THREE.EdgesGeometry(bladeGeo), rimMat);
  bladeRim.renderOrder = 901;
  bladeGroup.add(bladeRim);

  /* a soft disc that hugs the plane, for the "energy" look */
  var bladeHalo = new THREE.Mesh(
    new THREE.PlaneGeometry(3.7, 3.7),
    new THREE.MeshBasicMaterial({
      map: sparkTex, transparent: true, opacity: 0.07, color: 0x2dd4bf,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      depthTest: false
    })
  );
  bladeHalo.renderOrder = 899;
  bladeGroup.add(bladeHalo);

  /* ---- solid root ---- */
  var root = new THREE.Group();
  scene.add(root);

  var bodyMat = new THREE.MeshStandardMaterial({
    color: 0xd3e0ee, roughness: 0.62, metalness: 0.02,
    emissive: 0x0a1a2e, emissiveIntensity: 1, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
  });
  var edgeMat = new THREE.LineBasicMaterial({
    color: 0x14607f, transparent: true, opacity: 1, depthWrite: false
  });

  var body = null, edgeLines = null;

  /* ---- seam line (rebuilt every aim change, never re-allocated) ---- */
  var SEAM_MAX = 200;
  var seamPos = new Float32Array(SEAM_MAX * 3);
  var seamCol = new Float32Array(SEAM_MAX * 3);
  var seamGeo = new THREE.BufferGeometry();
  seamGeo.setAttribute("position", new THREE.BufferAttribute(seamPos, 3));
  seamGeo.setAttribute("color", new THREE.BufferAttribute(seamCol, 3));
  var seamMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  var seamLine = new THREE.Line(seamGeo, seamMat);
  seamLine.visible = false;
  scene.add(seamLine);

  /* ---- sparks ---- */
  var Sparks = (function () {
    var N = 420;
    var pos = new Float32Array(N * 3);
    var col = new Float32Array(N * 3);
    var vel = new Float32Array(N * 3);
    var life = new Float32Array(N);
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    var m = new THREE.PointsMaterial({
      size: 0.09, map: sparkTex, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    var pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    scene.add(pts);
    var head = 0;

    return {
      burst: function (p, dir, count, speed) {
        for (var i = 0; i < count; i++) {
          var k = head = (head + 1) % N;
          pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
          var rx = (Math.random() - 0.5), ry = (Math.random() - 0.5), rz = (Math.random() - 0.5);
          var s = speed * (0.35 + Math.random() * 0.85);
          vel[k * 3] = (dir[0] * 0.55 + rx) * s;
          vel[k * 3 + 1] = (dir[1] * 0.55 + ry + 0.45) * s;
          vel[k * 3 + 2] = (dir[2] * 0.55 + rz) * s;
          life[k] = 0.55 + Math.random() * 0.6;
        }
      },
      update: function (dt) {
        for (var i = 0; i < N; i++) {
          if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
          life[i] -= dt;
          vel[i * 3 + 1] -= 2.4 * dt;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          var f = Math.max(0, Math.min(1, life[i] * 1.6));
          col[i * 3] = f; col[i * 3 + 1] = f * 0.72; col[i * 3 + 2] = f * 0.3;
        }
        g.attributes.position.needsUpdate = true;
        g.attributes.color.needsUpdate = true;
      }
    };
  })();

  /* ---------------------------------------------------------- *
   *  5. tween engine
   * ---------------------------------------------------------- */
  var tweens = [];
  function tween(dur, fn, ease) {
    return new Promise(function (resolve) {
      tweens.push({ t: 0, dur: Math.max(dur, 1e-4), fn: fn, ease: ease || easeInOut, resolve: resolve });
    });
  }
  function delay(d) { return tween(d, function () { }, function (x) { return x; }); }
  function updateTweens(dt) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      tw.t += dt;
      var p = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.ease(p), p);
      if (p >= 1) { tweens.splice(i, 1); tw.resolve(); }
    }
  }
  function killTweens() { tweens.length = 0; }

  /* ---------------------------------------------------------- *
   *  6. sound (tiny WebAudio synth, no files)
   * ---------------------------------------------------------- */
  var Sound = {
    ctx: null, noiseBuf: null, on: save.sound,
    ensure: function () {
      if (!this.on) return null;
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { this.on = false; return null; }
        this.ctx = new AC();
        var n = this.ctx.sampleRate * 1.2, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
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
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise: function (dur, f0, f1, vol, q) {
      var c = this.ensure(); if (!c) return;
      var t = c.currentTime;
      var src = c.createBufferSource(); src.buffer = this.noiseBuf;
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = q || 1.1;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(c.destination);
      src.start(t); src.stop(t + dur + 0.05);
    },
    charge: function () {
      this.tone(140, 420, 0.55, "sine", 0.06);
      this.tone(280, 900, 0.55, "triangle", 0.025);
      this.noise(0.55, 400, 2400, 0.02, 2.4);
    },
    slice: function () {
      this.noise(0.38, 5200, 420, 0.16, 0.8);
      this.tone(180, 46, 0.32, "sine", 0.13);
    },
    chime: function () {
      this.tone(660, 660, 0.5, "sine", 0.075);
      this.tone(990, 990, 0.62, "sine", 0.05, 0.07);
      this.tone(1320, 1320, 0.5, "triangle", 0.028, 0.13);
    },
    thud: function () {
      this.tone(150, 52, 0.3, "sine", 0.1);
      this.noise(0.2, 700, 180, 0.05, 0.9);
    },
    click: function () { this.tone(900, 700, 0.05, "square", 0.018); }
  };

  /* ---------------------------------------------------------- *
   *  7. building a level
   * ---------------------------------------------------------- */
  function clearHalves() {
    if (!S.halves) return;
    var h = S.halves;
    [h.topGroup, h.botGroup].forEach(function (g) {
      if (!g) return;
      g.parent && g.parent.remove(g);
    });
    if (h.topMat) h.topMat.dispose();
    if (h.botMat) h.botMat.dispose();
    if (h.capMat) h.capMat.dispose();
    if (h.capTopMat) h.capTopMat.dispose();
    if (h.capGeo) h.capGeo.dispose();
    if (h.tube) {
      if (h.tube.parent) h.tube.parent.remove(h.tube);
      h.tube.geometry.dispose();
      h.tube.material.dispose();
    }
    S.halves = null;
  }

  function clearRoot() {
    clearHalves();
    while (root.children.length) {
      var c = root.children.pop();
      if (c.geometry && c.geometry !== (body && body.geometry)) c.geometry.dispose();
      root.remove(c);
    }
    if (body && body.geometry) { body.geometry.dispose(); body = null; }
    edgeLines = null;
  }

  /* pull the camera back far enough that this solid fills the frame nicely */
  function updateHome() {
    var r = 1.5;
    if (body) {
      body.geometry.computeBoundingSphere();
      r = body.geometry.boundingSphere.radius;
    }
    var vFov = camera.fov * Math.PI / 180;
    var d = Math.max(5.4, (r / Math.sin(vFov / 2)) * 1.42);
    HOME.copy(HOME_DIR).multiplyScalar(d);
  }

  function buildLevel(index) {
    killTweens();
    clearRoot();
    S.index = index;
    S.lv = LEVELS[index];
    S.cuts = 0;
    S.phase = "aim";

    var mesh = GEO.SOLIDS[S.lv.solid].make();
    S.tris = GEO.trianglesOf(mesh);

    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    g.computeBoundingSphere();

    body = new THREE.Mesh(g, bodyMat);
    root.add(body);

    edgeLines = new THREE.LineSegments(new THREE.EdgesGeometry(g, 24), edgeMat);
    root.add(edgeLines);

    /* reset the aim: blade flat, through the middle */
    S.tilt = 0; S.turn = 0; S.depth = 0;
    elDepthInput.value = "0";

    elLvNo.textContent = pad2(index + 1);
    elGoalName.textContent = S.lv.target;
    var zh = (GEO.NAMES[acceptKind(S.lv)] || GEO.NAMES.polygon)[1];
    elGoalZh.textContent = zh;

    panelResult.hidden = true;
    panelResult.classList.remove("bad");
    updateHome();
    updateAim();
    refreshLevelGrid();

    toast("Cut " + (index + 1) + " · " + S.lv.title + " — " + S.lv.brief, 3400);
  }

  function acceptKind(lv) {
    /* the friendliest name for the target, used for the 中文 chip */
    var map = {
      Square: "square", Circle: "circle", Triangle: "triangle", Rectangle: "rectangle",
      Trapezium: "trapezium", Ellipse: "ellipse", Hexagon: "hexagon"
    };
    return map[lv.target] || "polygon";
  }

  /* ---------------------------------------------------------- *
   *  8. aim -> plane, seam, scanner
   * ---------------------------------------------------------- */
  function updateAim() {
    if (!S.tris) return;
    var pl = GEO.planeAt(S.tris, S.tilt, S.turn, S.depth);
    S.plane = pl;
    S.section = GEO.sectionAt(S.tris, pl.n, pl.s);

    /* blade transform */
    var n = new THREE.Vector3(pl.n[0], pl.n[1], pl.n[2]);
    bladeGroup.position.copy(n).multiplyScalar(pl.s);
    bladeGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    bladeGroup.visible = true;

    drawSeam();
    drawScanner();

    elTilt.textContent = Math.round(S.tilt) + "°";
    elTurn.textContent = Math.round(S.turn) + "°";
    elDepth.textContent = (S.depth >= 0 ? "+" : "") + S.depth.toFixed(2);

    btnSlice.disabled = !S.section;
  }

  function drawSeam() {
    var sec = S.section;
    if (!sec) { seamLine.visible = false; return; }
    var h = sec.hull3, m = h.length;
    if (m + 1 > SEAM_MAX) m = SEAM_MAX - 1;
    for (var i = 0; i <= m; i++) {
      var p = h[i % h.length];
      seamPos[i * 3] = p[0]; seamPos[i * 3 + 1] = p[1]; seamPos[i * 3 + 2] = p[2];
      seamCol[i * 3] = 0.16; seamCol[i * 3 + 1] = 0.78; seamCol[i * 3 + 2] = 0.98;
    }
    seamGeo.setDrawRange(0, m + 1);
    seamGeo.attributes.position.needsUpdate = true;
    seamGeo.attributes.color.needsUpdate = true;
    seamGeo.computeBoundingSphere();
    seamLine.visible = true;
  }

  /* brightness wave travelling round the seam */
  function setSeamScan(head, boost) {
    var sec = S.section;
    if (!sec) return;
    var m = Math.min(sec.hull3.length, SEAM_MAX - 1);
    for (var i = 0; i <= m; i++) {
      var u = (i % m) / m;
      var d = Math.abs(((u - head + 1.5) % 1 + 1) % 1 - 0.5);
      var b = Math.max(0, 1 - d / 0.16) * boost;
      seamCol[i * 3] = 0.16 + 0.84 * b;
      seamCol[i * 3 + 1] = 0.78 + 0.22 * b;
      seamCol[i * 3 + 2] = 0.98 + 0.02 * b;
    }
    seamGeo.attributes.color.needsUpdate = true;
  }

  /* ---- the little 2-D scanner ---- */
  function drawScanner() {
    var W = scanEl.width, H = scanEl.height;
    sctx.clearRect(0, 0, W, H);

    /* backdrop grid */
    sctx.save();
    sctx.strokeStyle = "rgba(90,150,200,.12)";
    sctx.lineWidth = 1;
    for (var i = 0; i <= 6; i++) {
      var x = (W / 6) * i, y = (H / 4) * i;
      sctx.beginPath(); sctx.moveTo(x, 0); sctx.lineTo(x, H); sctx.stroke();
      if (i <= 4) { sctx.beginPath(); sctx.moveTo(0, y); sctx.lineTo(W, y); sctx.stroke(); }
    }
    sctx.restore();

    var sec = S.section;
    if (!sec) {
      sctx.fillStyle = "rgba(120,160,200,.5)";
      sctx.font = "600 13px ui-monospace, Consolas, monospace";
      sctx.textAlign = "center";
      sctx.fillText("NO SECTION", W / 2, H / 2);
      elScanName.textContent = "—";
      elScanName.classList.add("muted");
      return;
    }

    var pts = sec.hull2.slice();
    /* rotate the longest edge horizontal so a square never reads as a diamond */
    var best = -1, bl = 0;
    for (var k = 0; k < pts.length; k++) {
      var q = pts[(k + 1) % pts.length];
      var L = Math.hypot(q[0] - pts[k][0], q[1] - pts[k][1]);
      if (L > bl) { bl = L; best = k; }
    }
    var ang = 0;
    if (best >= 0) {
      var q2 = pts[(best + 1) % pts.length];
      ang = -Math.atan2(q2[1] - pts[best][1], q2[0] - pts[best][0]);
    }
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    var rot = pts.map(function (p) {
      var x = p[0] * ca - p[1] * sa, y = p[0] * sa + p[1] * ca;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      return [x, y];
    });
    var pad = 22;
    var sx = (W - pad * 2) / Math.max(1e-6, maxX - minX);
    var sy = (H - pad * 2) / Math.max(1e-6, maxY - minY);
    var sc = Math.min(sx, sy);
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

    sctx.beginPath();
    for (var j = 0; j < rot.length; j++) {
      var px = W / 2 + (rot[j][0] - cx) * sc;
      var py = H / 2 - (rot[j][1] - cy) * sc;
      if (j === 0) sctx.moveTo(px, py); else sctx.lineTo(px, py);
    }
    sctx.closePath();

    var grad = sctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "rgba(34,211,238,.30)");
    grad.addColorStop(1, "rgba(59,130,246,.16)");
    sctx.fillStyle = grad;
    sctx.fill();

    sctx.shadowColor = "rgba(103,232,249,.95)";
    sctx.shadowBlur = 12;
    sctx.strokeStyle = "#7defff";
    sctx.lineWidth = 2.2;
    sctx.lineJoin = "round";
    sctx.stroke();
    sctx.shadowBlur = 0;

    elScanName.classList.remove("muted");
    elScanName.textContent = describe(sec.hull2.length);
  }

  function describe(m) {
    if (save.assist) {
      var nm = GEO.classify(S.section.hull2);
      return nm.name + " · " + nm.zh;
    }
    if (m >= 9) {
      var sec = S.section, per = 0, i;
      for (i = 0; i < m; i++) {
        var a = sec.hull2[i], b = sec.hull2[(i + 1) % m];
        per += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      for (i = 0; i < m; i++) {
        var a2 = sec.hull2[i], b2 = sec.hull2[(i + 1) % m];
        if (Math.hypot(b2[0] - a2[0], b2[1] - a2[1]) > 0.16 * per) return "curved + straight edge";
      }
      return "curved outline";
    }
    return m + " straight sides";
  }

  /* ---------------------------------------------------------- *
   *  9. the cut
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

  function seamTube(sec) {
    var path = new THREE.CurvePath();
    for (var i = 0; i < sec.hull3.length; i++) {
      var a = sec.hull3[i], b = sec.hull3[(i + 1) % sec.hull3.length];
      path.add(new THREE.LineCurve3(
        new THREE.Vector3(a[0], a[1], a[2]),
        new THREE.Vector3(b[0], b[1], b[2])
      ));
    }
    var segs = Math.max(32, sec.hull3.length * 3);
    return new THREE.TubeGeometry(path, segs, 0.013, 6, false);
  }

  function makeHalves(sec) {
    var n = new THREE.Vector3(sec.n[0], sec.n[1], sec.n[2]);
    var u = new THREE.Vector3(sec.u[0], sec.u[1], sec.u[2]);
    var s = sec.s;

    var topMat = bodyMat.clone();
    topMat.clippingPlanes = [new THREE.Plane(n.clone(), -s)];
    var botMat = bodyMat.clone();
    botMat.clippingPlanes = [new THREE.Plane(n.clone().negate(), s)];

    var capMat = new THREE.MeshStandardMaterial({
      color: 0xffd2a1, emissive: 0xff6a12, emissiveIntensity: 1.5,
      roughness: 0.35, metalness: 0.35, side: THREE.DoubleSide
    });
    var capTopMat = capMat.clone();

    var capGeo = capGeometry(sec);

    var topGroup = new THREE.Group(), botGroup = new THREE.Group();
    var topMesh = new THREE.Mesh(body.geometry, topMat);
    var botMesh = new THREE.Mesh(body.geometry, botMat);
    topGroup.add(topMesh);
    botGroup.add(botMesh);
    topGroup.add(new THREE.Mesh(capGeo, capTopMat));
    botGroup.add(new THREE.Mesh(capGeo, capMat));

    scene.add(topGroup); scene.add(botGroup);

    body.visible = false;
    if (edgeLines) edgeLines.visible = false;

    S.halves = {
      topGroup: topGroup, botGroup: botGroup,
      topMat: topMat, botMat: botMat, capMat: capMat, capTopMat: capTopMat, capGeo: capGeo,
      n: n, u: u, s: s, sep: 0
    };
  }

  /* the lifted half steps out of the way while the camera squares up */
  function fadeTop(op) {
    var h = S.halves;
    if (!h) return;
    h.topMat.transparent = true;
    h.topMat.opacity = op;
    h.capTopMat.transparent = true;
    h.capTopMat.opacity = op;
    h.topGroup.visible = op > 0.012;
  }

  function setSeparation(d) {
    var h = S.halves;
    if (!h) return;
    h.sep = d;
    var t = h.n.clone().multiplyScalar(d * 0.72).add(h.u.clone().multiplyScalar(d * 1.18));
    h.topGroup.position.copy(t);
    h.topMat.clippingPlanes[0].constant = -h.s - h.n.dot(t);
    h.topGroup.rotation.set(h.u.z * d * 0.22, 0, -h.u.x * d * 0.22);
  }

  function revealCamera(sec) {
    var n = new THREE.Vector3(sec.n[0], sec.n[1], sec.n[2]);
    var c = new THREE.Vector3(sec.center3[0], sec.center3[1], sec.center3[2]);
    var radius = 0;
    for (var i = 0; i < sec.hull3.length; i++) {
      var dx = sec.hull3[i][0] - sec.center3[0];
      var dy = sec.hull3[i][1] - sec.center3[1];
      var dz = sec.hull3[i][2] - sec.center3[2];
      radius = Math.max(radius, Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    var vFov = camera.fov * Math.PI / 180;
    var dist = Math.max(3.4, (radius / Math.sin(vFov / 2)) * 1.55);
    /* a hair off the normal: reads as 3-D, and dodges the degenerate
       look-straight-down case where camera.up is parallel to the view */
    var off = Math.abs(n.y) > 0.9
      ? new THREE.Vector3(sec.u[0], sec.u[1], sec.u[2])
      : new THREE.Vector3(0, 1, 0);
    /* aim slightly below the section so it sits in the upper half of the
       frame, clear of the result card that slides up from the bottom */
    var dir = n.clone().addScaledVector(off, 0.40).normalize();
    var screenUp = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y);
    if (screenUp.lengthSq() < 0.02) screenUp.set(0, 0, 1).addScaledVector(dir, -dir.z);
    screenUp.normalize();
    var target = c.clone().addScaledVector(screenUp, -dist * 0.05);
    var pos = target.clone().addScaledVector(n, dist).addScaledVector(off, dist * 0.40);
    return { pos: pos, target: target };
  }

  var flyQ = new THREE.Quaternion(), flyQi = new THREE.Quaternion();
  function flyTo(pos, target, dur) {
    controls.enabled = false;
    var p0 = camera.position.clone(), t0 = controls.target.clone();
    var d0 = p0.clone().sub(t0), d1 = pos.clone().sub(target);
    var r0 = d0.length(), r1 = d1.length();
    var dir0 = d0.clone().normalize(), dir1 = d1.clone().normalize();
    flyQ.setFromUnitVectors(dir0, dir1);
    return tween(dur, function (p) {
      flyQi.identity().slerp(flyQ, p);
      var dir = dir0.clone().applyQuaternion(flyQi);
      controls.target.lerpVectors(t0, target, p);
      camera.position.copy(controls.target).addScaledVector(dir, lerp(r0, r1, p));
    }).then(function () {
      controls.enabled = true;
      controls.update();
    });
  }

  function setBusy(b) {
    btnSlice.disabled = b || !S.section;
    padEl.style.pointerEvents = b ? "none" : "auto";
    elDepthInput.disabled = b;
    btnHint.disabled = b;
  }

  function flashScreen() {
    elFlash.classList.remove("fire");
    void elFlash.offsetWidth;
    elFlash.classList.add("fire");
  }

  var cutting = false;
  function doSlice() {
    if (cutting || S.phase !== "aim" || !S.section) return;
    cutting = true;
    S.phase = "cutting";
    setBusy(true);
    S.cuts++;
    if (S.cuts === 1 && elTip) elTip.style.opacity = "0";
    runCut().then(function () { cutting = false; }).catch(function (err) {
      cutting = false;
      S.phase = "aim";
      setBusy(false);
      toast("Something jammed the blade — try again.", 3000);
      if (window.console) console.error(err);
    });
  }

  async function runCut() {
    var sec = S.section;

    /* --- 1. lock on: the seam catches light and a scanner runs round it --- */
    Sound.charge();
    var tube = new THREE.Mesh(
      seamTube(sec),
      new THREE.MeshBasicMaterial({
        color: 0xaef6ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    scene.add(tube);
    bladeMat.opacity = 0.55;
    rimMat.opacity = 1;

    await tween(0.62, function (p) {
      tube.material.opacity = p * 0.9;
      setSeamScan((p * 1.6) % 1, p);
      bladeMat.opacity = 0.42 + 0.35 * Math.sin(p * Math.PI * 2.5);
      S.shake = 0.02 * p;
    }, function (x) { return x; });

    /* --- 2. the cut --- */
    flashScreen();
    Sound.slice();
    S.shake = 0.16;
    bladeGroup.visible = false;
    makeHalves(sec);
    setSeamScan(0.5, 0.55);   /* settle the outline to a steady glow */

    var tubeFade = tube;
    await tween(0.9, function (p) {
      setSeparation(easeOutBack(p) * 1.0);
      tube.material.opacity = 0.95 - p * 0.28;
      S.shake = 0.16 * (1 - p);
      if (Math.random() < 0.7) {
        var i = Math.floor(Math.random() * sec.hull3.length);
        Sparks.burst(sec.hull3[i], sec.n, 3, 1.5);
      }
      /* hot metal cooling to cyan */
      var k = Math.min(1, p * 1.35);
      S.halves.capMat.color.setRGB(lerp(1, 0.13, k), lerp(0.82, 0.83, k), lerp(0.63, 0.93, k));
      S.halves.capMat.emissive.setRGB(lerp(1, 0.05, k), lerp(0.42, 0.42, k), lerp(0.07, 0.52, k));
      S.halves.capMat.emissiveIntensity = lerp(1.9, 0.85, k);
    }, easeOut);

    if (S.halves) S.halves.tube = tubeFade;   /* keeps glowing as the outline */

    /* --- 3. square up to the cut face --- */
    var cam = revealCamera(sec);
    await Promise.all([
      flyTo(cam.pos, cam.target, 0.85),
      tween(0.62, function (p) { fadeTop(1 - p); }, easeOut)
    ]);

    /* --- 4. verdict --- */
    showResult(sec);
  }

  /* ---------------------------------------------------------- *
   * 10. result
   * ---------------------------------------------------------- */
  function showResult(sec) {
    S.phase = "result";
    var res = GEO.classify(sec.hull2);
    var win = S.lv.accept.indexOf(res.kind) >= 0;
    var stars = S.cuts <= 1 ? 3 : S.cuts === 2 ? 2 : 1;

    panelResult.hidden = false;
    stageEl.classList.add("is-result");
    panelResult.classList.toggle("bad", !win);
    resStars.textContent = win ? "★★★".slice(0, stars) + "☆☆☆".slice(0, 3 - stars) : "";
    resVerdict.textContent = win ? "PERFECT CUT" : "NOT QUITE";
    resName.textContent = res.name;
    resZh.textContent = res.zh;
    resRule.textContent = win ? S.lv.rule : S.lv.hint;

    btnNext.style.display = win ? "" : "none";
    btnShow.hidden = win;
    btnNext.textContent = (S.index + 1 < LEVELS.length) ? "NEXT CUT →" : "FINISH";
    btnRetry.textContent = win ? "CUT AGAIN" : "TRY AGAIN";

    if (win) {
      Sound.chime();
      var prev = save.stars[S.index] || 0;
      save.stars[S.index] = Math.max(prev, stars);
      persist();
      refreshLevelGrid();
      pulseCutFace();
    } else {
      Sound.thud();
    }
  }

  function pulseCutFace() {
    var h = S.halves;
    if (!h) return;
    var base = h.capMat.emissiveIntensity;
    tween(1.1, function (p) {
      h.capMat.emissiveIntensity = base + 0.9 * Math.sin(p * Math.PI);
    }, function (x) { return x; });
  }

  /* ---------------------------------------------------------- *
   * 11. level flow
   * ---------------------------------------------------------- */
  function refreshLevelGrid() {
    if (!lvGrid) return;
    var html = "";
    for (var i = 0; i < LEVELS.length; i++) {
      var st = save.stars[i] || 0;
      var cls = "lv-dot" + (st ? " done" : "");
      if (i === S.index && S.phase !== "menu") cls += " now";
      html += '<button type="button" class="' + cls + '" data-lv="' + i + '" title="' + LEVELS[i].title + '">' +
        (i + 1) + (st ? '<i>' + "★★★".slice(0, st) + "</i>" : "") + "</button>";
    }
    lvGrid.innerHTML = html;
  }

  function nextUnsolved() {
    for (var i = 0; i < LEVELS.length; i++) if (!save.stars[i]) return i;
    return 0;
  }

  function openMenu() {
    if (S.phase === "cutting") return;   /* let the blade finish */
    panelStart.hidden = false;
    panelResult.hidden = true;
    S.phase = "menu";
    controls.autoRotate = true;
    refreshLevelGrid();
  }

  function closeMenu() {
    panelStart.hidden = true;
    controls.autoRotate = false;
  }

  function goToLevel(i) {
    closeMenu();
    stageEl.classList.remove("is-result");
    buildLevel(i);
    controls.autoRotate = false;
    flyTo(HOME.clone(), new THREE.Vector3(0, 0, 0), 0.6);
    setBusy(false);
  }

  function retry() {
    panelResult.hidden = true;
    stageEl.classList.remove("is-result");
    S.phase = "aim";
    /* put the solid back together and return to the aim view */
    clearHalves();
    if (body) body.visible = true;
    if (edgeLines) edgeLines.visible = true;
    if (S.section) drawSeam(); else seamLine.visible = false;
    bladeGroup.visible = true;
    bladeMat.opacity = 0.3;
    rimMat.opacity = 0.85;
    setBusy(false);
    flyTo(HOME.clone(), new THREE.Vector3(0, 0, 0), 0.55);
  }

  function nextLevel() {
    if (S.index + 1 < LEVELS.length) goToLevel(S.index + 1);
    else openMenu();
  }

  /* ---------------------------------------------------------- *
   * 12. aim pad
   * ---------------------------------------------------------- */
  var PAD_DPR = Math.min(window.devicePixelRatio || 1, 2);
  function sizePad() {
    var css = padEl.getBoundingClientRect();
    var w = Math.max(80, css.width || 132);
    padEl.width = Math.round(w * PAD_DPR);
    padEl.height = Math.round(w * PAD_DPR);
    drawPad();
  }

  function padXY(tilt, turn) {
    var R = padEl.width / 2 - 14;
    var r = (tilt / 90) * R;
    var a = turn * Math.PI / 180;
    return [padEl.width / 2 + Math.sin(a) * r, padEl.height / 2 - Math.cos(a) * r];
  }

  function drawPad() {
    var W = padEl.width, H = padEl.height, cx = W / 2, cy = H / 2;
    var R = W / 2 - 14;
    pctx.clearRect(0, 0, W, H);

    var g = pctx.createRadialGradient(cx, cy, 4, cx, cy, R);
    g.addColorStop(0, "rgba(34,211,238,.16)");
    g.addColorStop(0.75, "rgba(20,60,90,.18)");
    g.addColorStop(1, "rgba(12,30,48,.35)");
    pctx.fillStyle = g;
    pctx.beginPath(); pctx.arc(cx, cy, R, 0, Math.PI * 2); pctx.fill();

    /* rings at 30 / 60 / 90 */
    for (var i = 1; i <= 3; i++) {
      pctx.beginPath();
      pctx.arc(cx, cy, (R * i) / 3, 0, Math.PI * 2);
      pctx.strokeStyle = i === 3 ? "rgba(103,232,249,.55)" : "rgba(103,232,249,.16)";
      pctx.lineWidth = i === 3 ? 2 : 1;
      pctx.stroke();
    }
    /* spokes */
    pctx.strokeStyle = "rgba(103,232,249,.10)";
    pctx.lineWidth = 1;
    for (var a = 0; a < 8; a++) {
      var th = (a / 8) * Math.PI * 2;
      pctx.beginPath();
      pctx.moveTo(cx, cy);
      pctx.lineTo(cx + Math.sin(th) * R, cy - Math.cos(th) * R);
      pctx.stroke();
    }
    /* labels */
    pctx.fillStyle = "rgba(120,190,220,.5)";
    pctx.font = "600 " + Math.round(W * 0.055) + "px ui-monospace, Consolas, monospace";
    pctx.textAlign = "center";
    pctx.fillText("0°", cx, cy - 4);
    pctx.fillText("90°", cx, cy - R - 3);

    /* handle */
    var p = padXY(S.tilt, S.turn);
    pctx.beginPath();
    pctx.moveTo(cx, cy);
    pctx.lineTo(p[0], p[1]);
    pctx.strokeStyle = "rgba(103,232,249,.75)";
    pctx.lineWidth = 2;
    pctx.stroke();

    pctx.shadowColor = "rgba(34,211,238,1)";
    pctx.shadowBlur = 14;
    pctx.beginPath();
    pctx.arc(p[0], p[1], W * 0.045, 0, Math.PI * 2);
    pctx.fillStyle = "#bdf6ff";
    pctx.fill();
    pctx.shadowBlur = 0;
    pctx.beginPath();
    pctx.arc(p[0], p[1], W * 0.075, 0, Math.PI * 2);
    pctx.strokeStyle = "rgba(189,246,255,.55)";
    pctx.lineWidth = 1.5;
    pctx.stroke();
  }

  var padActive = false;
  function padEvent(e) {
    var r = padEl.getBoundingClientRect();
    var W = padEl.width, H = padEl.height;
    var x = ((e.clientX - r.left) / r.width) * W;
    var y = ((e.clientY - r.top) / r.height) * H;
    var cx = W / 2, cy = H / 2;
    var R = W / 2 - 14;
    var dx = (x - cx) / R, dy = (y - cy) / R;
    var rr = Math.hypot(dx, dy);
    if (rr > 1) { dx /= rr; dy /= rr; rr = 1; }
    var tilt = rr * 90;
    var turn = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    tilt = snap(tilt, [0, 15, 30, 45, 60, 75, 90], 2.2);
    turn = snap(turn, [0, 45, 90, 135, 180, 225, 270, 315, 360], 2.2) % 360;
    S.tilt = tilt;
    if (tilt > 0.5) S.turn = turn;
    drawPad();
    updateAim();
  }

  padEl.addEventListener("pointerdown", function (e) {
    if (S.phase !== "aim") return;
    padActive = true;
    padEl.setPointerCapture(e.pointerId);
    padEvent(e);
    e.preventDefault();
  });
  padEl.addEventListener("pointermove", function (e) {
    if (!padActive) return;
    padEvent(e);
    e.preventDefault();
  });
  padEl.addEventListener("pointerup", function (e) {
    padActive = false;
    try { padEl.releasePointerCapture(e.pointerId); } catch (err) { }
  });
  padEl.addEventListener("pointercancel", function () { padActive = false; });

  /* depth slider */
  elDepthInput.addEventListener("input", function () {
    var v = parseFloat(elDepthInput.value) || 0;
    if (Math.abs(v) < 0.035) v = 0;
    S.depth = v;
    if (v === 0) elDepthInput.value = "0";
    updateAim();
  });

  /* ---------------------------------------------------------- *
   * 13. UI wiring
   * ---------------------------------------------------------- */
  function toast(msg, ms) {
    elToast.textContent = msg;
    elToast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { elToast.classList.remove("show"); }, ms || 2400);
  }

  btnSlice.addEventListener("click", function () { Sound.ensure(); doSlice(); });
  btnNext.addEventListener("click", nextLevel);
  btnRetry.addEventListener("click", retry);
  btnShow.addEventListener("click", function () {
    var id = S.lv.ideal;
    retry();
    S.tilt = id.tilt; S.turn = id.turn; S.depth = id.depth;
    elDepthInput.value = String(id.depth);
    drawPad();
    updateAim();
    toast("Blade lined up — hit SLICE to see the section.", 3000);
  });
  btnMenu.addEventListener("click", openMenu);
  btnPlay.addEventListener("click", function () {
    Sound.ensure();
    goToLevel(nextUnsolved());
  });

  btnHint.addEventListener("click", function () {
    toast("💡 " + S.lv.hint, 4200);
  });

  btnSound.addEventListener("click", function () {
    Sound.on = !Sound.on;
    save.sound = Sound.on;
    persist();
    btnSound.classList.toggle("off", !Sound.on);
    btnSound.textContent = Sound.on ? "♪" : "♪";
    if (Sound.on) Sound.click();
  });

  lvGrid.addEventListener("click", function (e) {
    var b = e.target.closest("[data-lv]");
    if (!b) return;
    goToLevel(parseInt(b.getAttribute("data-lv"), 10));
  });

  elAssist.addEventListener("change", function () {
    save.assist = elAssist.checked;
    persist();
    drawScanner();
  });

  /* keyboard: aim without a mouse (good for a projector) */
  document.addEventListener("keydown", function (e) {
    if (S.phase !== "aim") return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" && e.target.type !== "range") return;
    var step = e.shiftKey ? 1 : 5, used = true;
    switch (e.key) {
      case "ArrowLeft": S.turn = (S.turn - step + 360) % 360; break;
      case "ArrowRight": S.turn = (S.turn + step) % 360; break;
      case "ArrowUp": S.tilt = clamp(S.tilt + step, 0, 90); break;
      case "ArrowDown": S.tilt = clamp(S.tilt - step, 0, 90); break;
      case "+": case "=": S.depth = clamp(S.depth + 0.05, -1, 1); break;
      case "-": case "_": S.depth = clamp(S.depth - 0.05, -1, 1); break;
      case "Enter": case " ": doSlice(); break;
      default: used = false;
    }
    if (!used) return;
    e.preventDefault();
    elDepthInput.value = String(S.depth);
    drawPad();
    updateAim();
  });

  /* ---------------------------------------------------------- *
   * 14. resize + loop
   * ---------------------------------------------------------- */
  var lastW = 0, lastH = 0;
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (w === lastW && h === lastH) { sizePad(); return; }
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    updateHome();
    if ((S.phase === "aim" || S.phase === "menu") && !tweens.length) {
      camera.position.copy(HOME);
      controls.target.set(0, 0, 0);
      controls.update();
    }
    sizePad();
    var sr = scanEl.getBoundingClientRect();
    if (sr.width) {
      scanEl.width = Math.round(sr.width * PAD_DPR);
      scanEl.height = Math.round(sr.height * PAD_DPR);
      drawScanner();
    }
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stageEl);
  window.addEventListener("resize", resize);

  var last = performance.now(), clock = 0;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;

    updateTweens(dt);
    Sparks.update(dt);
    controls.update();

    /* camera shake after controls so it is not overwritten */
    if (S.shake > 0.0005) {
      camera.position.x += (Math.random() - 0.5) * S.shake;
      camera.position.y += (Math.random() - 0.5) * S.shake;
      S.shake *= 0.86;
    }

    /* living stage */
    underGlow.intensity = 5 + Math.sin(clock * 1.7) * 1.2;
    pedestal.material.opacity = 0.4 + Math.sin(clock * 1.7) * 0.12;
    pedestal.rotation.z = clock * 0.12;

    /* dust drift */
    for (var i = 0; i < dust.n; i++) {
      dust.pos[i * 3 + 1] += dust.spd[i] * dt;
      if (dust.pos[i * 3 + 1] > 4.0) dust.pos[i * 3 + 1] = -1.6;
    }
    dust.pts.geometry.attributes.position.needsUpdate = true;

    if (S.phase === "aim" && S.section) {
      rimMat.opacity = 0.7 + Math.sin(clock * 2.4) * 0.15;
      seamMat.opacity = 0.75 + Math.sin(clock * 2.4) * 0.2;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------- *
   * 15. boot
   * ---------------------------------------------------------- */
  elAssist.checked = !!save.assist;
  btnSound.classList.toggle("off", !Sound.on);
  if (!Sound.on) btnSound.classList.add("off");

  buildLevel(0);
  panelStart.hidden = false;
  S.phase = "menu";
  controls.autoRotate = true;
  refreshLevelGrid();
  resize();
  requestAnimationFrame(loop);

  /* a small console handle for teachers / automated checks */
  window.SliceLab = {
    go: goToLevel,
    aim: function (tilt, turn, depth) {
      S.tilt = tilt; S.turn = turn; S.depth = depth;
      elDepthInput.value = String(depth);
      drawPad(); updateAim();
    },
    slice: doSlice,
    state: S,
    levels: LEVELS
  };
  /* deep link: 12-slice-game.html?lv=7  jumps straight to cut 7 */
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.has("lv")) {
      var n = parseInt(qs.get("lv"), 10);
      if (n >= 1 && n <= LEVELS.length) goToLevel(n - 1);
    }
    if (qs.has("aim")) {
      var a = qs.get("aim").split(",").map(Number);
      window.SliceLab.aim(a[0] || 0, a[1] || 0, a[2] || 0);
    }
    if (qs.has("cut")) {
      setTimeout(function () { window.SliceLab.aim(
        (qs.get("aim") ? Number(qs.get("aim").split(",")[0]) : S.tilt),
        (qs.get("aim") ? Number(qs.get("aim").split(",")[1]) : S.turn),
        (qs.get("aim") ? Number(qs.get("aim").split(",")[2]) : S.depth));
        doSlice(); }, 500);
    }
  } catch (e) { }

})();
