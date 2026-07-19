/* ======================================================================
   LexTV · 词境疾驰

   The three-lane/object-pool gameplay structure is informed by
   juwalbose/ThreeJSEndlessRunner3D (MIT). Rendering, state management,
   controls and learning integration are rewritten for Three.js r128,
   Android TV and LexTV's existing data contracts.
   ====================================================================== */
"use strict";
(function () {
  var STEP = 1 / 30;
  var LANE_X = [-3.15, 0, 3.15];
  var GATE_GLYPHS = ["◈", "✧", "⌁"];
  var PLAYER_Z = 3.2;
  var ROAD_SEGMENTS = 16;
  var ROAD_STEP = 6.4;
  var R = {
    active: false,
    suspended: false,
    phase: "off",
    runId: 0,
    ownerP: null,
    ownerCur: null,
    returnScreen: "world",
    list: [],
    bank: [],
    round: 0,
    resolved: 0,
    right: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    shield: 3,
    maxShield: 3,
    gap: 72,
    lane: 1,
    speed: 15,
    questionToken: 0,
    answerCommitted: false,
    committedTokens: Object.create(null),
    sessionCommitted: false,
    options: [],
    answerLane: -1,
    obstacleLane: 0,
    obstacleCommitted: false,
    pickupLane: 1,
    pickupCommitted: false,
    jumpY: 0,
    jumpV: 0,
    inputSignals: { LEFT: 0, DOWN: 0, RIGHT: 0, UP: 0, OK: 0 },
    simTime: 0,
    phaseUntil: 0,
    mappingUntil: 0,
    inputGateUntil: 0,
    countdownLast: -1,
    pendingFinish: false,
    raf: 0,
    lastRealTime: 0,
    accumulator: 0,
    renderer: null,
    scene: null,
    camera: null,
    root: null,
    road: null,
    roadLines: null,
    scenery: null,
    roadZ: [],
    sceneryZ: [],
    dummy: null,
    player: null,
    playerVisual: null,
    playerShadow: null,
    monster: null,
    monsterMaterial: null,
    gateRoot: null,
    gateMaterials: [],
    obstacle: null,
    pickup: null,
    gateZ: -48,
    prevGateZ: -48,
    obstacleZ: -24,
    prevObstacleZ: -24,
    pickupZ: -22,
    prevPickupZ: -22,
    failed: false,
    degraded: false,
    renderScale: 0.9,
    measuredFps: 30,
    sampleFrames: 0,
    sampleTime: 0,
    contextLost: false
  };

  function byId(id) { return document.getElementById(id); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function nowMs() {
    try { return window.performance && performance.now ? performance.now() : Date.now(); }
    catch (e) { return Date.now(); }
  }
  function normal(value) {
    var text = String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
    try { return text.normalize("NFKC"); } catch (e) { return text; }
  }
  function shuffleCopy(source) {
    var out = source.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = out[i]; out[i] = out[j]; out[j] = swap;
    }
    return out;
  }
  function setText(id, value) { var el = byId(id); if (el) el.textContent = value; }
  function ownerValid() {
    try {
      return R.active && R.ownerP === P && R.ownerCur === CUR &&
        typeof SCREEN !== "undefined" && SCREEN === "skytrail";
    } catch (e) { return false; }
  }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }

  function addUnique(target, source, limit, used) {
    for (var i = 0; i < source.length && target.length < limit; i++) {
      var item = source[i];
      var key = item && normal(item.w);
      if (!item || !key || !normal(item.m) || used[key]) continue;
      used[key] = true;
      target.push(item);
    }
  }

  function prepareRun() {
    var all = [];
    try { all = typeof activeWords === "function" ? activeWords() : []; } catch (e) { all = []; }
    var bank = [], seen = Object.create(null), meanings = Object.create(null);
    for (var i = 0; i < all.length; i++) {
      var item = all[i];
      var wk = item && normal(item.w), mk = item && normal(item.m);
      if (!wk || !mk || seen[wk]) continue;
      seen[wk] = true; meanings[mk] = true; bank.push(item);
    }
    if (bank.length < 12 || Object.keys(meanings).length < 3) return null;

    var due = [], weak = [], learned = [];
    try { due = typeof dueWords === "function" ? dueWords() : []; } catch (e2) { due = []; }
    try { weak = typeof weakWords === "function" ? weakWords() : []; } catch (e3) { weak = []; }
    try { learned = typeof seenWords === "function" ? seenWords() : []; } catch (e4) { learned = []; }
    var byWord = Object.create(null);
    for (var b = 0; b < bank.length; b++) byWord[normal(bank[b].w)] = bank[b];
    function mapBank(source) {
      var out = [];
      for (var m = 0; m < source.length; m++) {
        var found = byWord[normal(source[m] && source[m].w)];
        if (found) out.push(found);
      }
      return out;
    }
    var list = [], used = Object.create(null);
    addUnique(list, mapBank(due), 4, used);
    addUnique(list, mapBank(weak), 7, used);
    addUnique(list, shuffleCopy(mapBank(learned)), 10, used);
    addUnique(list, shuffleCopy(bank), 10, used);
    if (list.length < 10) return null;
    return { list: list.slice(0, 10), bank: bank };
  }

  function makeOptions(target) {
    var targetWord = normal(target.w), targetMeaning = normal(target.m);
    var sameDeck = [], other = [];
    for (var i = 0; i < R.bank.length; i++) {
      var item = R.bank[i];
      if (!item || normal(item.w) === targetWord || normal(item.m) === targetMeaning) continue;
      (item.deck === target.deck ? sameDeck : other).push(item);
    }
    var pool = shuffleCopy(sameDeck).concat(shuffleCopy(other));
    var options = [target], used = Object.create(null); used[targetMeaning] = true;
    for (var j = 0; j < pool.length && options.length < 3; j++) {
      var mk = normal(pool[j].m);
      if (!mk || used[mk]) continue;
      used[mk] = true; options.push(pool[j]);
    }
    if (options.length !== 3) return null;
    options = shuffleCopy(options);
    return { options: options, answerLane: options.indexOf(target) };
  }

  function ensureRuntime() {
    if (window.THREE) return Promise.resolve(true);
    if (window.WordWorld && typeof WordWorld.ensureRuntime === "function") return WordWorld.ensureRuntime();
    return new Promise(function (resolve, reject) {
      var id = "lextv-three-runtime";
      var old = document.getElementById(id);
      if (old) {
        old.addEventListener("load", function () { window.THREE ? resolve(true) : reject(new Error("THREE unavailable")); }, { once: true });
        old.addEventListener("error", reject, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.id = id; script.src = "vendor/three-r128.min.js"; script.async = true;
      script.onload = function () { window.THREE ? resolve(true) : reject(new Error("THREE unavailable")); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function material(color, opacity) {
    return new THREE.MeshLambertMaterial({ color: color, transparent: opacity < 1, opacity: opacity, depthWrite: opacity >= 1 });
  }

  function makeWingGeometry(flip) {
    var geometry = new THREE.BufferGeometry();
    var side = flip ? -1 : 1;
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0.2, 0, side * 0.85, 0.5, 0.05, side * 0.58, -0.32, 0,
      0, 0.2, 0, side * 0.58, -0.32, 0, side * 0.12, -0.18, 0.04
    ], 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  function buildPlayer() {
    var group = new THREE.Group();
    var visual = new THREE.Group();
    var body = new THREE.Mesh(new THREE.OctahedronGeometry(0.56, 0), material(0xf2dfa0, 1));
    body.scale.set(0.86, 1.16, 0.86); visual.add(body);
    var chest = new THREE.Mesh(new THREE.OctahedronGeometry(0.27, 0), material(0x78b99f, 1));
    chest.position.set(0, -0.1, 0.42); visual.add(chest);
    var wingMat = new THREE.MeshBasicMaterial({ color: 0xe5f2df, side: THREE.DoubleSide, transparent: true, opacity: 0.86 });
    var leftWing = new THREE.Mesh(makeWingGeometry(true), wingMat);
    var rightWing = new THREE.Mesh(makeWingGeometry(false), wingMat.clone());
    leftWing.position.z = rightWing.position.z = -0.08; visual.add(leftWing); visual.add(rightWing);
    var halo = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.04, 5, 24), new THREE.MeshBasicMaterial({ color: 0xf6e49b }));
    halo.rotation.x = Math.PI / 2; halo.position.y = 0.1; visual.add(halo);
    var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: 0x0b292a, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.78; group.add(shadow);
    group.add(visual); group.position.set(0, 1.45, PLAYER_Z); group.scale.setScalar(1.18);
    group.userData.leftWing = leftWing; group.userData.rightWing = rightWing; group.userData.halo = halo;
    R.player = group; R.playerVisual = visual; R.playerShadow = shadow;
    R.root.add(group);
  }

  function buildMonster() {
    var group = new THREE.Group();
    R.monsterMaterial = material(0x472d3a, 0.78);
    var body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.78, 0), R.monsterMaterial);
    body.scale.set(1.08, 1.2, 0.9); group.add(body);
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xff9b77 });
    var eyeA = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
    var eyeB = eyeA.clone(); eyeA.position.set(-0.23, 0.15, -0.68); eyeB.position.set(0.23, 0.15, -0.68); group.add(eyeA); group.add(eyeB);
    var hornMat = material(0x8f777b, 1);
    var hornA = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 5), hornMat);
    var hornB = hornA.clone(); hornA.position.set(-0.43, 0.72, 0); hornB.position.set(0.43, 0.72, 0); hornA.rotation.z = 0.28; hornB.rotation.z = -0.28; group.add(hornA); group.add(hornB);
    group.position.set(-4.65, 1.15, 5.8); group.scale.setScalar(0.52); R.monster = group; R.root.add(group);
  }

  function buildGates() {
    R.gateRoot = new THREE.Group(); R.gateMaterials = [];
    for (var i = 0; i < 3; i++) {
      var gate = new THREE.Group(); gate.position.x = LANE_X[i];
      var mat = new THREE.MeshBasicMaterial({ color: 0x62a889, transparent: true, opacity: 0.92 }); R.gateMaterials.push(mat);
      var postGeo = new THREE.BoxGeometry(0.34, 3.4, 0.34);
      var left = new THREE.Mesh(postGeo, mat), right = new THREE.Mesh(postGeo, mat);
      left.position.set(-1.18, 1.7, 0); right.position.set(1.18, 1.7, 0); gate.add(left); gate.add(right);
      var lintel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.34, 0.38), mat);
      lintel.position.y = 3.28; gate.add(lintel);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.055, 5, 28), new THREE.MeshBasicMaterial({ color: 0xe7d68d, transparent: true, opacity: 0.58 }));
      ring.position.y = 1.78; gate.add(ring);
      var core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: 0xfff2b2 }));
      core.position.y = 1.78; gate.add(core);
      R.gateRoot.add(gate);
    }
    R.gateRoot.position.z = R.gateZ; R.root.add(R.gateRoot);
  }

  function buildObstacle() {
    var group = new THREE.Group();
    var base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), material(0x6f7873, 1));
    base.scale.set(1.25, 0.82, 0.9); base.position.y = 0.65; group.add(base);
    var crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), material(0xc98578, 1));
    crystal.position.y = 1.45; crystal.scale.set(0.8, 1.5, 0.8); group.add(crystal);
    group.position.set(0, 0, R.obstacleZ); R.obstacle = group; R.root.add(group);
  }

  function buildPickup() {
    var group = new THREE.Group();
    var ringMat = new THREE.MeshBasicMaterial({ color: 0xf1db86, transparent: true, opacity: 0.9 }); ringMat.toneMapped = false;
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.08, 6, 24), ringMat); ring.rotation.x = Math.PI / 2; group.add(ring);
    var coreMat = new THREE.MeshBasicMaterial({ color: 0xb8e3c7 }); coreMat.toneMapped = false;
    var core = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), coreMat); group.add(core);
    var orbit = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 5, 20), ringMat.clone()); orbit.rotation.y = Math.PI / 2; group.add(orbit);
    group.position.set(0, 1.3, R.pickupZ); group.userData.ring = ring; group.userData.orbit = orbit;
    R.pickup = group; R.root.add(group);
  }

  function buildScene() {
    if (R.scene && R.renderer) {
      try {
        var existingContext = R.renderer.getContext();
        if (!R.contextLost && (!existingContext.isContextLost || !existingContext.isContextLost())) return true;
      } catch (reuseError) { }
      return false;
    }
    var stage = byId("sr-stage");
    if (!stage || !window.THREE) return false;
    try {
      R.scene = new THREE.Scene(); R.scene.background = new THREE.Color(0x214c57); R.scene.fog = new THREE.Fog(0x244f56, 18, 76);
      R.camera = new THREE.PerspectiveCamera(47, 16 / 9, 0.1, 100); R.camera.position.set(0, 6.2, 11.5); R.camera.lookAt(0, 1.15, -8);
      R.root = new THREE.Group(); R.scene.add(R.root);
      R.scene.add(new THREE.HemisphereLight(0xeaf0d9, 0x274c49, 0.88));
      var sun = new THREE.DirectionalLight(0xffe8b3, 0.72); sun.position.set(-8, 13, 7); sun.castShadow = false; R.scene.add(sun);
      var fill = new THREE.DirectionalLight(0x8fcbd0, 0.18); fill.position.set(7, 4, -8); R.scene.add(fill);

      R.dummy = new THREE.Object3D(); R.roadZ = []; R.sceneryZ = [];
      R.road = new THREE.InstancedMesh(new THREE.BoxGeometry(9.7, 0.34, 5.9), new THREE.MeshBasicMaterial({ color: 0x31554f }), ROAD_SEGMENTS);
      R.roadLines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.04, 2.4), new THREE.MeshBasicMaterial({ color: 0xdad698, transparent: true, opacity: 0.72 }), ROAD_SEGMENTS * 2);
      R.scenery = new THREE.InstancedMesh(new THREE.ConeGeometry(0.72, 2.8, 5), new THREE.MeshBasicMaterial({ color: 0x568774 }), ROAD_SEGMENTS * 2);
      R.road.instanceMatrix.setUsage(THREE.DynamicDrawUsage); R.roadLines.instanceMatrix.setUsage(THREE.DynamicDrawUsage); R.scenery.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      R.road.frustumCulled = false; R.roadLines.frustumCulled = false; R.scenery.frustumCulled = false;
      R.root.add(R.road); R.root.add(R.roadLines); R.root.add(R.scenery);
      for (var i = 0; i < ROAD_SEGMENTS; i++) { R.roadZ[i] = 10 - i * ROAD_STEP; R.sceneryZ[i] = 7 - i * ROAD_STEP; }

      var starGeo = new THREE.BufferGeometry(), points = new Float32Array(54 * 3);
      for (var p = 0; p < 54; p++) { points[p * 3] = (Math.random() - 0.5) * 34; points[p * 3 + 1] = 3 + Math.random() * 12; points[p * 3 + 2] = -10 - Math.random() * 65; }
      starGeo.setAttribute("position", new THREE.BufferAttribute(points, 3));
      R.root.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xf5e7a9, size: 0.09, transparent: true, opacity: 0.72, sizeAttenuation: true })));
      buildPlayer(); buildMonster(); buildGates(); buildObstacle(); buildPickup();

      // Android TV 以稳帧和温度为先；跑酷本身会按帧率自适应分辨率。
      R.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power", precision: "mediump", failIfMajorPerformanceCaveat: false });
      R.contextLost = false;
      R.renderer.setPixelRatio(1); R.renderer.setClearColor(0x214c57, 1); R.renderer.shadowMap.enabled = false;
      if (typeof THREE.sRGBEncoding !== "undefined") R.renderer.outputEncoding = THREE.sRGBEncoding;
      stage.appendChild(R.renderer.domElement);
      R.renderer.domElement.addEventListener("webglcontextlost", function (event) {
        event.preventDefault(); R.contextLost = true; activateFallback("图形上下文已切换");
      });
      R.renderer.domElement.addEventListener("webglcontextrestored", function () { R.contextLost = false; });
      onResize(); resetScene(); return true;
    } catch (e) { activateFallback("兼容跑道"); return false; }
  }

  function chooseScale() {
    var width = Math.max(1, window.innerWidth || 1280);
    if (R.degraded) {
      if (width >= 3000) return 0.45;
      if (width >= 1700) return 0.7;
      if (width >= 1200) return 0.78;
      return 0.86;
    }
    if (width >= 3000) return 0.55;
    if (width >= 1700) return 0.9;
    if (width >= 1200) return 0.94;
    return 1;
  }
  function onResize() {
    if (!R.renderer || !R.camera) return;
    var width = Math.max(1, window.innerWidth || 1280), height = Math.max(1, window.innerHeight || 720);
    R.camera.aspect = width / height; R.camera.updateProjectionMatrix(); R.renderScale = chooseScale();
    R.renderer.setSize(Math.max(640, Math.round(width * R.renderScale)), Math.max(360, Math.round(height * R.renderScale)), false);
    R.renderer.domElement.style.width = "100%"; R.renderer.domElement.style.height = "100%";
  }
  function activateFallback(reason) {
    R.failed = true;
    R.obstacleCommitted = true; R.pickupCommitted = true;
    var root = byId("skytrail"); if (root) root.classList.add("sr-fallback-only");
    if (R.renderer && R.renderer.domElement) R.renderer.domElement.style.display = "none";
    setText("sr-callout", reason || "已切换兼容跑道");
  }

  function resetScene() {
    R.roadZ = []; R.sceneryZ = [];
    for (var i = 0; i < ROAD_SEGMENTS; i++) { R.roadZ[i] = 10 - i * ROAD_STEP; R.sceneryZ[i] = 7 - i * ROAD_STEP; }
    if (R.player) { R.player.position.set(0, 1.45, PLAYER_Z); R.player.rotation.set(0, 0, 0); R.player.scale.setScalar(1.18); }
    if (R.monster) { R.monster.position.set(-4.65, 1.15, 5.8); R.monster.scale.setScalar(0.52); }
    if (R.gateRoot) { R.gateRoot.visible = false; R.gateRoot.position.z = -48; }
    if (R.obstacle) { R.obstacle.visible = false; R.obstacle.position.set(0, 0, -24); }
    if (R.pickup) { R.pickup.visible = false; R.pickup.position.set(0, 1.3, -22); }
    updateInstances(0);
  }

  function updateInstances(delta) {
    if (!R.dummy || !R.road) return;
    var wrap = ROAD_SEGMENTS * ROAD_STEP;
    for (var i = 0; i < ROAD_SEGMENTS; i++) {
      if (delta) { R.roadZ[i] += R.speed * delta; if (R.roadZ[i] > 13) R.roadZ[i] -= wrap; }
      R.dummy.position.set(0, -0.22, R.roadZ[i]); R.dummy.rotation.set(0, 0, 0); R.dummy.scale.set(1, 1, 1); R.dummy.updateMatrix(); R.road.setMatrixAt(i, R.dummy.matrix);
      for (var laneLine = 0; laneLine < 2; laneLine++) {
        R.dummy.position.set(laneLine ? 1.58 : -1.58, 0, R.roadZ[i]); R.dummy.updateMatrix(); R.roadLines.setMatrixAt(i * 2 + laneLine, R.dummy.matrix);
      }
      if (delta) { R.sceneryZ[i] += R.speed * delta * 0.88; if (R.sceneryZ[i] > 13) R.sceneryZ[i] -= wrap; }
      for (var side = 0; side < 2; side++) {
        var jitter = ((i * 17 + side * 11) % 7) * 0.19;
        R.dummy.position.set((side ? 1 : -1) * (6.1 + jitter), 1.1 + (i % 3) * 0.18, R.sceneryZ[i]);
        R.dummy.rotation.set(0, (i * 0.7 + side) % Math.PI, 0); R.dummy.scale.set(0.75 + (i % 4) * 0.08, 0.8 + (i % 3) * 0.12, 0.75 + (i % 4) * 0.08); R.dummy.updateMatrix();
        R.scenery.setMatrixAt(i * 2 + side, R.dummy.matrix);
      }
    }
    R.road.instanceMatrix.needsUpdate = true; R.roadLines.instanceMatrix.needsUpdate = true; R.scenery.instanceMatrix.needsUpdate = true;
  }

  function updateHud() {
    setText("sr-round", Math.min(R.total || 10, R.round + 1) + " / " + (R.total || 10));
    setText("sr-score", String(Math.max(0, R.score)));
    setText("sr-combo", String(R.combo));
    var shield = ""; for (var i = 0; i < R.maxShield; i++) shield += i < R.shield ? "◆" : "◇";
    setText("sr-shield", shield);
    var gap = byId("sr-gap"); if (gap) gap.style.width = clamp(R.gap, 5, 100) + "%";
    var monsterDot = document.querySelector("#skytrail .sr-monster-dot"); if (monsterDot) monsterDot.style.left = clamp(7, 90 - R.gap, 86) + "%";
    setText("sr-gap-text", R.gap < 25 ? "迫近" : (R.gap < 50 ? "警戒" : "安全"));
    var root = byId("skytrail"); if (root) root.classList.toggle("sr-danger", R.gap < 28 || R.shield <= 1);
  }

  function updateLaneVisual() {
    var gates = document.querySelectorAll("#sr-gates .sr-gate");
    for (var i = 0; i < gates.length; i++) gates[i].classList.toggle("focus", i === R.lane);
    for (var j = 0; j < R.gateMaterials.length; j++) {
      if (R.gateMaterials[j] && R.gateMaterials[j].color) R.gateMaterials[j].color.setHex(j === R.lane ? 0xe4d48d : 0x79b99c);
    }
    try { if (typeof requestFocusSync === "function") requestFocusSync(); } catch (e) { }
  }

  function clearResultClasses() {
    var root = byId("skytrail"); if (root) root.classList.remove("sr-good", "sr-bad", "sr-hit", "sr-boost", "sr-jump");
    var gates = document.querySelectorAll("#sr-gates .sr-gate");
    for (var i = 0; i < gates.length; i++) gates[i].classList.remove("right", "wrong", "passed");
  }

  /* v6.4 重构:释义全程常驻显示在三扇星门上 —— 玩家"看着选道",
     不再要求 1.6 秒记住符文映射(原设计导致看不懂、必错、体验极差)。 */
  function setGateMapping(reveal, label) {
    var gates = document.querySelectorAll("#sr-gates .sr-gate");
    var labels = ["LEFT LANE", "CENTER LANE", "RIGHT LANE"];
    for (var i = 0; i < gates.length; i++) {
      var b = gates[i].querySelector("b"), small = gates[i].querySelector("small");
      if (b) b.textContent = R.options[i] ? R.options[i].m : GATE_GLYPHS[i];
      if (small) small.textContent = labels[i] + " · 释义";
      gates[i].setAttribute("aria-selected", i === R.lane ? "true" : "false");
    }
  }

  function showQuestionCopy(target, made, reveal) {
    setText("sr-word", target.w);
    var phon = String(target.p || "").trim().replace(/^\/+|\/+$/g, "");
    setText("sr-phon", phon ? "/" + phon + "/" : "");
    setGateMapping(true, "STEER");
  }

  function beginQuestionRun() {
    if (!ownerValid() || R.phase !== "preview") return;
    R.phase = "run"; R.mappingUntil = 0; setGateMapping(true, "STEER"); updateLaneVisual();
    var PATTERN_NAMES = { tutorial: "热身航段 · 无路障,看释义换道", double: "双重路障 · 连续躲两次", echo: "回声链 · 连吃 3 枚回声", sweep: "游走路障 · 它会变道,看准再躲", rush: "疾速冲刺 · 分数 ×1.5" };
    setText("sr-callout", (PATTERN_NAMES[R.pattern] || "看准释义换道") + " · ↑ 跳跃");
    var host = byId("sr-gates"); if (host) { host.style.opacity = ".9"; host.style.transform = "translate3d(-50%,-6vmin,0) scale(.8)"; }
  }

  function startQuestion() {
    if (!ownerValid() || R.round >= R.total) return;
    var target = R.list[R.round], made = makeOptions(target);
    if (!made) { abortToReturn("当前词书释义过于相近，无法生成三座星门", "BACK"); return; }
    R.questionToken++;
    R.answerCommitted = false;
    R.options = made.options;
    R.answerLane = made.answerLane;
    R.lane = 1;
    R.jumpY = 0; R.jumpV = 0;
    R.obstacleCommitted = R.failed; R.pickupCommitted = R.failed;
    // v6.6:滚动天空式航段系统 —— 每关一种花样,零新增3D物件(复用现有网格)
    var PATTERNS = ["double", "echo", "sweep", "rush"];
    R.pattern = R.round < 2 ? "tutorial" : PATTERNS[(R.round - 2) % PATTERNS.length];
    R.obstacleRearm = R.pattern === "double" ? 1 : 0;
    R.pickupRearm = R.pattern === "echo" ? 2 : 0;
    R.sweep = R.pattern === "sweep"; R.sweepLocked = false;
    R.speed = 15 + R.round * 0.3 + Math.min(5, R.combo * 0.72);
    if (R.pattern === "rush") R.speed *= 1.3;
    R.gateZ = PLAYER_Z - R.speed * 3.45; R.prevGateZ = R.gateZ;
    R.obstacleZ = PLAYER_Z - R.speed * 2.1; R.prevObstacleZ = R.obstacleZ;
    R.obstacleLane = Math.floor(Math.random() * 3);
    var noObstacle = R.pattern === "tutorial";
    R.pickupZ = R.obstacleZ + 2.1; R.prevPickupZ = R.pickupZ;
    R.pickupLane = (R.obstacleLane + 1 + Math.floor(Math.random() * 2)) % 3;
    R.phase = "preview"; R.phaseUntil = R.simTime + (reducedMotion() ? 0.5 : 0.9); R.mappingUntil = 0; R.pendingFinish = false;
    clearResultClasses(); showQuestionCopy(target, made, true); updateLaneVisual(); updateHud();
    if (R.gateRoot) { R.gateRoot.visible = true; R.gateRoot.position.z = R.gateZ; }
    if (noObstacle) R.obstacleCommitted = true;
    if (R.obstacle) { R.obstacle.visible = !R.failed && !noObstacle; R.obstacle.position.set(LANE_X[R.obstacleLane], 0, R.obstacleZ); }
    if (R.pickup) { R.pickup.visible = !R.failed; R.pickup.position.set(LANE_X[R.pickupLane], 1.3, R.pickupZ); }
    setText("sr-callout", "冲向与单词相符的释义星门 · ← → 换道");
    var host = byId("sr-gates"); if (host) { host.style.opacity = "1"; host.style.transform = "translate3d(-50%,-1vmin,0) scale(.92)"; }
    try { if (!document.hidden && typeof speak === "function") speak(target.w); } catch (e) { }
  }

  function pulseClass(name, duration) {
    var root = byId("skytrail"); if (!root) return;
    root.classList.remove(name); void root.offsetWidth; root.classList.add(name);
    var runId = R.runId, token = R.questionToken;
    setTimeout(function () {
      if (R.runId === runId && R.questionToken === token && byId("skytrail")) byId("skytrail").classList.remove(name);
    }, duration || 420);
  }

  function obstacleHit() {
    if (R.obstacleCommitted || R.phase !== "run") return;
    R.obstacleCommitted = true;
    if (R.obstacle) R.obstacle.visible = false;
    var collided = R.lane === R.obstacleLane && R.jumpY < 0.82;
    if (collided) {
      R.shield = Math.max(0, R.shield - 1); R.gap = Math.max(5, R.gap - 12); R.score = Math.max(0, R.score - 35); R.combo = 0;
      setText("sr-callout", "路障命中 · 护盾受损"); pulseClass("sr-hit", 420);
      try { if (window.SFX && SFX.bad) SFX.bad(); } catch (e) { }
    } else {
      var dodgeGain = R.pattern === "rush" ? 30 : 20;
      R.score += dodgeGain; setText("sr-callout", (R.jumpY >= 0.82 ? "凌空越障" : "漂亮闪避") + " · +" + dodgeGain + " 星辉");
      try { if (window.SFX && SFX.nav) SFX.nav(); } catch (e2) { }
    }
    // 双重路障:第一座过线后,在 1.1 秒外再装填一座(不同车道,方向可预判)
    if (R.obstacleRearm > 0 && !R.failed && R.gateZ < PLAYER_Z - R.speed * 1.35) {
      R.obstacleRearm--;
      R.obstacleLane = (R.obstacleLane + 1 + Math.floor(Math.random() * 2)) % 3;
      R.obstacleZ = PLAYER_Z - R.speed * 1.1; R.prevObstacleZ = R.obstacleZ;
      R.obstacleCommitted = false;
      if (R.obstacle) { R.obstacle.visible = true; R.obstacle.position.set(LANE_X[R.obstacleLane], 0, R.obstacleZ); }
    }
    updateHud();
  }

  function rearmPickup() {
    if (R.pickupRearm <= 0 || R.failed || R.gateZ >= PLAYER_Z - R.speed * 1.2) return;
    R.pickupRearm--;
    R.pickupLane = (R.pickupLane + 1 + Math.floor(Math.random() * 2)) % 3;
    R.pickupZ = PLAYER_Z - R.speed * 0.95; R.prevPickupZ = R.pickupZ;
    R.pickupCommitted = false;
    if (R.pickup) { R.pickup.visible = true; R.pickup.position.set(LANE_X[R.pickupLane], 1.3, R.pickupZ); }
  }
  function pickupPass() {
    if (R.pickupCommitted || R.phase !== "run") return;
    R.pickupCommitted = true;
    if (R.pickup) R.pickup.visible = false;
    if (R.lane !== R.pickupLane) { rearmPickup(); return; }
    R.score += 45; R.gap = Math.min(100, R.gap + 6);
    setText("sr-callout", "捕获回声 · +45 星辉,词怪被拉开距离");
    rearmPickup();
    try { if (typeof speak === "function" && R.list[R.round]) speak(R.list[R.round].w); } catch (e) { }
    try { if (window.SFX && SFX.good) SFX.good(); } catch (e2) { }
    updateHud();
  }

  function commitGate() {
    var token = R.questionToken;
    if (R.phase !== "run" || R.answerCommitted || R.committedTokens[token] || !ownerValid()) return;
    R.answerCommitted = true; R.committedTokens[token] = true; R.phase = "resolve";
    var ok = R.lane === R.answerLane;
    var gates = document.querySelectorAll("#sr-gates .sr-gate");
    for (var i = 0; i < gates.length; i++) {
      gates[i].classList.add("passed");
      if (i === R.answerLane) gates[i].classList.add("right");
      if (!ok && i === R.lane) gates[i].classList.add("wrong");
    }
    if (ok) {
      R.right++; R.combo++; R.bestCombo = Math.max(R.bestCombo, R.combo); R.score += Math.round((130 + Math.min(170, R.combo * 18)) * (R.pattern === "rush" ? 1.5 : 1)); R.gap = Math.min(100, R.gap + 11);
      setText("sr-callout", R.list[R.round].w + " = " + R.list[R.round].m + " · 冲刺击退词怪");
      var rootGood = byId("skytrail"); if (rootGood) rootGood.classList.add("sr-good", "sr-boost");
      try { if (window.SFX && SFX.good) SFX.good(); } catch (e) { }
    } else {
      R.combo = 0; R.shield = Math.max(0, R.shield - 1); R.score = Math.max(0, R.score - 45); R.gap = Math.max(5, R.gap - 18);
      setText("sr-callout", "正确星门：" + R.list[R.round].m + " · 词怪正在逼近");
      var rootBad = byId("skytrail"); if (rootBad) rootBad.classList.add("sr-bad"); pulseClass("sr-hit", 420);
      try { if (window.SFX && SFX.bad) SFX.bad(); } catch (e2) { }
    }
    try { if (typeof schedHit === "function") schedHit(R.list[R.round].w, ok); } catch (e3) { }
    try { if (ok && R.ownerP === P) { P.xp += 5; saveP(); } } catch (e4) { }
    R.resolved++;
    R.phaseUntil = R.simTime + 1.05;
    R.pendingFinish = R.resolved >= R.total;
    if (R.pendingFinish) commitSession();
    updateHud();
  }

  function commitSession() {
    if (R.sessionCommitted || R.resolved !== R.total || !ownerValid()) return false;
    R.sessionCommitted = true;
    try { if (typeof gameResult === "function") gameResult("skytrail", R.right, R.total, R.score); } catch (e) { }
    return true;
  }

  function showFinish() {
    if (!ownerValid() || !R.sessionCommitted) return;
    R.phase = "finish"; cancelFrame();
    var accuracy = R.total ? Math.round(R.right * 100 / R.total) : 0;
    setText("sr-finish-title", accuracy === 100 && R.shield === R.maxShield ? "无伤穿越星穹" : (accuracy >= 80 ? "冲出风暴" : "航路已经点亮"));
    setText("sr-finish-stats", R.right + " / " + R.total + " 共鸣 · " + accuracy + "% · " + R.score + " 星辉");
    setText("sr-finish-msg", "最佳连击 " + R.bestCombo + " · 剩余护盾 " + R.shield + "。这不是一次测验：你刚刚用真正的路线选择完成了整段复习。");
    var finish = byId("sr-finish"); if (finish) finish.hidden = false;
    var button = byId("sr-return"); if (button) button.classList.add("focus");
    try { if (typeof requestFocusSync === "function") requestFocusSync(); } catch (e0) { }
    R.inputGateUntil = nowMs() + 700;
    try { if (typeof armTvCarryGuard === "function") armTvCarryGuard("OK", 700); } catch (e) { }
    try { if (window.SFX && SFX.win) SFX.win(); } catch (e2) { }
  }

  function updateSimulation(delta) {
    R.simTime += delta;
    if (R.phase === "countdown") {
      updateInstances(delta * 0.45);
      var remain = Math.max(0, R.phaseUntil - R.simTime), number = Math.ceil(remain);
      if (number !== R.countdownLast) {
        R.countdownLast = number; setText("sr-count", number > 0 ? String(number) : "GO");
        try { if (number > 0 && window.SFX && SFX.nav) SFX.nav(); } catch (e) { }
      }
      if (remain <= 0) {
        var countdown = byId("sr-countdown"); if (countdown) countdown.classList.add("hidden");
        startQuestion();
      }
      return;
    }
    if (R.phase === "preview") {
      updateInstances(delta * 0.18);
      if (R.simTime >= R.phaseUntil) beginQuestionRun();
      return;
    }
    if (R.phase !== "run" && R.phase !== "resolve") return;
    updateInstances(delta * (R.phase === "resolve" ? 1.12 : 1));

    var xTarget = LANE_X[R.lane];
    if (R.player) {
      R.player.position.x += (xTarget - R.player.position.x) * Math.min(1, delta * 12);
      if (R.jumpY > 0 || R.jumpV > 0) {
        R.jumpV -= 8.8 * delta; R.jumpY = Math.max(0, R.jumpY + R.jumpV * delta);
        if (R.jumpY <= 0) { R.jumpY = 0; R.jumpV = 0; var jumpRoot = byId("skytrail"); if (jumpRoot) jumpRoot.classList.remove("sr-jump"); }
      }
      R.player.position.y = 1.45 + R.jumpY;
      R.player.rotation.z += ((xTarget - R.player.position.x) * -0.08 - R.player.rotation.z) * Math.min(1, delta * 9);
      if (R.playerVisual) R.playerVisual.rotation.y = Math.sin(R.simTime * 8) * 0.08;
      if (R.player.userData.leftWing) R.player.userData.leftWing.rotation.z = Math.sin(R.simTime * 12) * 0.18;
      if (R.player.userData.rightWing) R.player.userData.rightWing.rotation.z = -Math.sin(R.simTime * 12) * 0.18;
      if (R.player.userData.halo) R.player.userData.halo.rotation.z += delta * 1.8;
      if (R.playerShadow) R.playerShadow.scale.setScalar(clamp(1 - R.jumpY * 0.2, 0.55, 1));
    }
    if (R.monster) {
      var danger = 1 - clamp(R.gap, 5, 100) / 100;
      var scale = 0.42 + danger * 0.92;
      R.monster.scale.setScalar(scale); R.monster.position.x += ((-4.65 + (R.player ? R.player.position.x * 0.18 : 0)) - R.monster.position.x) * Math.min(1, delta * 3.5);
      R.monster.position.y = 1.1 + Math.sin(R.simTime * 5.5) * 0.12;
      if (R.monsterMaterial) R.monsterMaterial.opacity = 0.2 + danger * 0.7;
    }
    if (R.camera && R.player) {
      R.camera.position.x += (R.player.position.x * 0.12 - R.camera.position.x) * Math.min(1, delta * 3.2);
      R.camera.rotation.z += ((R.player.position.x * -0.006) - R.camera.rotation.z) * Math.min(1, delta * 4);
    }

    if (R.phase === "run") {
      if (R.mappingUntil && R.simTime >= R.mappingUntil) { R.mappingUntil = 0; setGateMapping(false); }
      R.prevObstacleZ = R.obstacleZ; R.obstacleZ += R.speed * delta;
      if (R.sweep && !R.obstacleCommitted && R.obstacle && R.obstacle.visible) {
        var eta = (PLAYER_Z - R.obstacleZ) / Math.max(1, R.speed);
        if (eta > 1.15) {
          R.sweepLocked = false;
          R.obstacle.position.x = Math.sin(R.simTime * 2.1) * LANE_X[2];
          R.obstacle.rotation.y += delta * 5;
        } else if (!R.sweepLocked) {
          R.sweepLocked = true;
          var nearest = 0, best = 1e9;
          for (var li = 0; li < 3; li++) { var dxl = Math.abs(R.obstacle.position.x - LANE_X[li]); if (dxl < best) { best = dxl; nearest = li; } }
          R.obstacleLane = nearest; R.obstacle.position.x = LANE_X[nearest];
        }
      }
      if (R.obstacle) { R.obstacle.position.z = R.obstacleZ; if (!R.sweep || R.sweepLocked) R.obstacle.rotation.y += delta * 1.4; }
      if (!R.obstacleCommitted && R.prevObstacleZ < PLAYER_Z && R.obstacleZ >= PLAYER_Z) obstacleHit();

      R.prevPickupZ = R.pickupZ; R.pickupZ += R.speed * delta;
      if (R.pickup) {
        R.pickup.position.z = R.pickupZ; R.pickup.rotation.y += delta * 2.4;
        if (R.pickup.userData.orbit) R.pickup.userData.orbit.rotation.z += delta * 3.1;
      }
      if (!R.pickupCommitted && R.prevPickupZ < PLAYER_Z && R.pickupZ >= PLAYER_Z) pickupPass();

      R.prevGateZ = R.gateZ; R.gateZ += R.speed * delta;
      if (R.gateRoot) R.gateRoot.position.z = R.gateZ;
      var progress = clamp((R.gateZ - (PLAYER_Z - R.speed * 3.45)) / Math.max(1, R.speed * 3.45), 0, 1);
      var gateHost = byId("sr-gates");
      if (gateHost) {
        var scaleHud = 0.8 + progress * 0.22, y = -6 + progress * 6;
        gateHost.style.transform = "translate3d(-50%," + y.toFixed(2) + "vmin,0) scale(" + scaleHud.toFixed(3) + ")";
        gateHost.style.opacity = String(0.9 + progress * 0.1);
      }
      if (R.prevGateZ < PLAYER_Z && R.gateZ >= PLAYER_Z) commitGate();
    } else if (R.simTime >= R.phaseUntil) {
      if (R.pendingFinish) showFinish();
      else { R.round++; startQuestion(); }
    }
  }

  function renderScene() {
    if (!R.renderer || !R.scene || !R.camera || R.failed) return;
    try { R.renderer.render(R.scene, R.camera); } catch (e) { activateFallback("兼容跑道"); }
  }

  function frame(realNow) {
    R.raf = 0;
    if (!ownerValid() || R.suspended || document.hidden || R.phase === "finish" || R.phase === "off") return;
    if (!R.lastRealTime) R.lastRealTime = realNow;
    var elapsed = Math.min(0.1, Math.max(0, (realNow - R.lastRealTime) / 1000)); R.lastRealTime = realNow;
    R.accumulator += elapsed;
    var steps = 0;
    while (R.accumulator >= STEP && steps < 3) { updateSimulation(STEP); R.accumulator -= STEP; steps++; }
    if (steps >= 3) R.accumulator = 0;
    R.sampleTime += elapsed;
    if (steps > 0) { renderScene(); R.sampleFrames++; }
    if (R.sampleTime >= 3) {
      R.measuredFps = R.sampleTime > 0 ? Math.round(R.sampleFrames / R.sampleTime) : 30;
      if (R.measuredFps < 25 && !R.degraded) { R.degraded = true; onResize(); }
      R.sampleFrames = 0; R.sampleTime = 0;
    }
    R.raf = requestAnimationFrame(frame);
  }
  function startFrame() {
    if (R.raf || R.suspended || !ownerValid() || R.phase === "finish") return;
    R.lastRealTime = 0; R.accumulator = 0; R.raf = requestAnimationFrame(frame);
  }
  function cancelFrame() { if (R.raf) { cancelAnimationFrame(R.raf); R.raf = 0; } R.lastRealTime = 0; R.accumulator = 0; }

  function startCountdown() {
    if (!ownerValid()) return;
    R.phase = "countdown"; R.simTime = 0; R.phaseUntil = reducedMotion() ? 0.35 : 3; R.countdownLast = -1;
    var countdown = byId("sr-countdown"); if (countdown) countdown.classList.remove("hidden");
    setText("sr-count", reducedMotion() ? "GO" : "3"); setText("sr-callout", "左右选道 · 上键或 OK 跃过障碍");
    startFrame();
  }

  function resetRun(prepared) {
    R.runId++; R.active = true; R.suspended = false; R.phase = "loading";
    R.ownerP = P; R.ownerCur = CUR; R.list = prepared.list; R.bank = prepared.bank; R.total = prepared.list.length;
    R.round = 0; R.resolved = 0; R.right = 0; R.score = 0; R.combo = 0; R.bestCombo = 0; R.shield = R.maxShield; R.gap = 72;
    R.lane = 1; R.speed = 15; R.questionToken = 0; R.answerCommitted = false; R.committedTokens = Object.create(null); R.sessionCommitted = false;
    R.options = []; R.answerLane = -1; R.obstacleCommitted = false; R.pickupCommitted = false; R.jumpY = 0; R.jumpV = 0; R.pendingFinish = false; R.mappingUntil = 0; R.failed = R.contextLost;
    R.inputSignals = { LEFT: 0, DOWN: 0, RIGHT: 0, UP: 0, OK: 0 };
    cancelFrame(); clearResultClasses();
    var root = byId("skytrail");
    if (root) {
      root.classList.remove("sr-danger");
      root.classList.toggle("sr-fallback-only", R.failed);
    }
    var finish = byId("sr-finish"); if (finish) finish.hidden = true;
    var button = byId("sr-return"); if (button) button.classList.remove("focus");
    var countdown = byId("sr-countdown"); if (countdown) countdown.classList.remove("hidden");
    setText("sr-count", "✦"); setText("sr-word", "SKYLINE"); setText("sr-phon", "正在生成今日航道");
    updateHud(); updateLaneVisual();
  }

  function open() {
    var prepared = prepareRun();
    if (!prepared) { try { toast("当前启用词书至少需要 12 个有效词，才能开启词境疾驰"); } catch (e) { } return false; }
    R.returnScreen = typeof SCREEN === "string" ? SCREEN : "world";
    resetRun(prepared);
    var runId = R.runId;
    show("skytrail");
    ensureRuntime().then(function () {
      if (!ownerValid() || R.runId !== runId) return;
      if (!buildScene()) activateFallback("兼容跑道");
      else { R.failed = false; var root = byId("skytrail"); if (root) root.classList.remove("sr-fallback-only"); if (R.renderer && R.renderer.domElement) R.renderer.domElement.style.display = "block"; resetScene(); }
      startCountdown();
    }).catch(function () {
      if (!ownerValid() || R.runId !== runId) return;
      activateFallback("兼容跑道"); startCountdown();
    });
    return true;
  }

  function pause() {
    if (!R.active || R.suspended) return;
    R.suspended = true; cancelFrame();
    try { if (typeof NativeBridge !== "undefined" && NativeBridge.stopSpeak) NativeBridge.stopSpeak(); } catch (e) { }
  }
  function resume() {
    if (!R.active || !R.suspended || document.hidden || !ownerValid()) return;
    R.suspended = false; startFrame();
  }
  function stop() {
    if (!R.active) { cancelFrame(); R.suspended = true; return; }
    R.runId++; R.active = false; R.suspended = true; R.phase = "off"; R.ownerP = null; R.ownerCur = null; cancelFrame();
  }

  function abortToReturn(message, guardKey) {
    var target = R.returnScreen || "world";
    R.runId++; R.active = false; R.phase = "off"; cancelFrame(); R.ownerP = null; R.ownerCur = null;
    if (message) { try { toast(message); } catch (e) { } }
    try { if (typeof armTvCarryGuard === "function" && guardKey) armTvCarryGuard(guardKey, 700); } catch (e2) { }
    if (target === "world" && window.WordWorld && typeof WordWorld.open === "function") WordWorld.open();
    else show(target === "skytrail" ? "arcade" : target);
  }

  function jump() {
    if (R.jumpY > 0.04 || R.jumpV > 0) return;
    R.jumpV = 4.7; var root = byId("skytrail"); if (root) root.classList.add("sr-jump");
    try { if (window.SFX && SFX.ok) SFX.ok(); } catch (e) { }
  }

  function key(k) {
    if (!R.active || !ownerValid()) return;
    var signal = nowMs(), guarded = k === "LEFT" || k === "DOWN" || k === "RIGHT" || k === "UP" || k === "OK";
    var previous = guarded ? (R.inputSignals[k] || 0) : 0;
    if (guarded) R.inputSignals[k] = signal;
    if (R.phase === "finish") {
      if (k === "BACK" && signal >= R.inputGateUntil) abortToReturn("", k);
      else if (k === "OK" && signal >= R.inputGateUntil && (!previous || signal - previous >= 380)) abortToReturn("", k);
      return;
    }
    if (k === "BACK") { abortToReturn("已撤离本次航道，未完成的题目不会结算", "BACK"); return; }
    if (R.suspended || document.hidden || R.phase !== "run") return;
    // v6.7:换道改为相对移动(一按一格)。原版 LEFT/RIGHT 是"跳到最左/最右道",
    // 在边道按一下会横跨两格、且到中道只能按"下",完全反直觉。
    // 方向键节流降到 120ms(原 380ms 会吞连按),跳跃保留 380ms 防误触双跳。
    var dirKey = k === "LEFT" || k === "RIGHT" || k === "DOWN";
    if (guarded && previous && signal - previous < (dirKey ? 120 : 380)) return;
    if (k === "LEFT") R.lane = Math.max(0, R.lane - 1);
    else if (k === "RIGHT") R.lane = Math.min(2, R.lane + 1);
    else if (k === "DOWN") R.lane = 1;
    else if (k === "UP" || k === "OK") jump();
    else if (k === "PLAY" || k === "MENU") { try { speak(R.list[R.round].w); } catch (e) { } return; }
    else return;
    updateLaneVisual();
  }

  function disposeMaterial(mat) { if (mat && typeof mat.dispose === "function") mat.dispose(); }
  function dispose() {
    R.runId++; R.active = false; R.phase = "off"; cancelFrame();
    if (R.scene) {
      R.scene.traverse(function (node) {
        if (node.geometry && typeof node.geometry.dispose === "function") node.geometry.dispose();
        if (Array.isArray(node.material)) for (var i = 0; i < node.material.length; i++) disposeMaterial(node.material[i]);
        else disposeMaterial(node.material);
      });
    }
    if (R.renderer) {
      var canvas = R.renderer.domElement; try { R.renderer.dispose(); } catch (e) { }
      try { if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); } catch (e2) { }
    }
    R.renderer = R.scene = R.camera = R.root = R.road = R.roadLines = R.scenery = R.player = R.monster = R.gateRoot = R.obstacle = R.pickup = null;
    R.contextLost = false;
    R.ownerP = null; R.ownerCur = null;
  }

  function benchmark() {
    var info = R.renderer && R.renderer.info ? R.renderer.info : null;
    return {
      mode: R.failed ? "fallback" : "3d",
      active: R.active,
      phase: R.phase,
      fps: R.measuredFps,
      renderScale: R.renderScale,
      degraded: R.degraded,
      calls: info ? info.render.calls : 0,
      triangles: info ? info.render.triangles : 0,
      geometries: info ? info.memory.geometries : 0,
      textures: info ? info.memory.textures : 0,
      question: R.round + 1,
      resolved: R.resolved
    };
  }

  window.WordRush = { open: open, pause: pause, resume: resume, stop: stop, dispose: dispose, onResize: onResize, benchmark: benchmark };
  handlers.skytrail = { enter: function () { if (R.active && R.suspended && !document.hidden) resume(); }, key: key };
  window.addEventListener("resize", function () { if (R.active) onResize(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else resume(); });
  window.addEventListener("pagehide", pause);
  window.addEventListener("blur", pause);
  window.addEventListener("focus", resume);
}());
