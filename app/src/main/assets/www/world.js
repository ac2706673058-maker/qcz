/* ======================================================================
   LexTV Word World

   The camera pacing is informed by Evan Bacon's MIT-licensed Pillar Valley,
   and the small deterministic render/state loop by pshenok's MIT-licensed
   Server Survival. No code or art is copied from either project.

   KayKit scene art is CC0; see world-assets/LICENSES.md. The asset bundle is
   loaded lazily as a normal script. This is deliberate: Android WebView can
   load file:// subresources, while file:// fetch/XHR is not reliable.
   ====================================================================== */
"use strict";
(function () {
  var LANDMARKS = [
    { id: "expedition", icon: "✦", title: "晨光远征", sub: "十道星门 · 星轨跃迁", desc: "护送词灵穿过十道记忆星门，在回声与星轨中完成今日远征。", point: [-4.5, 0.15, 0.25], color: 0x9bc89f },
    { id: "echo", icon: "◈", title: "记忆裂隙", sub: "实时潜入 · 词义决定出口", desc: "进入会反应的记忆裂隙，躲过词灵、收集回声，并用真正记住的词义改变下一条路线。", point: [0, 0.05, -4.2], color: 0xb69be8 },
    { id: "chase", icon: "◇", title: "风暴峡谷", sub: "词怪追逐 · 实时逃生", desc: "闯过四座能量星门，击退紧追不舍的词怪。每一次选择都改变距离。", point: [4.5, 0.2, -0.1], color: 0xe6c784 },
    { id: "decks", icon: "▦", title: "旅者营地", sub: "整备世界与冒险内容", desc: "在营地管理角色空间、离线内容与已经解锁的冒险记忆。", point: [0, 0.1, 4.4], color: 0x93bed1 },
    { id: "skytrail", icon: "✧", title: "词境疾驰", sub: "今日主线 · 天穹跑酷", desc: "在浮空赛道躲避障碍、穿越词义星门，把词怪永远甩在风暴后面。", point: [0, 0.25, 0], color: 0xded8a2 }
  ];

  var W = {
    index: 4,
    running: false,
    ready: false,
    failed: false,
    intro: false,
    introSeen: false,
    introTimer: 0,
    raf: 0,
    token: 0,
    scene: null,
    camera: null,
    renderer: null,
    worldRoot: null,
    assetRoot: null,
    placeholderRoot: null,
    markers: [],
    motes: null,
    traveler: null,
    travelerGoal: null,
    sharedTexture: null,
    runtimePromise: null,
    bundlePromise: null,
    assetPromise: null,
    assetGeneration: 0,
    loadedModels: Object.create(null),
    assetsLoaded: 0,
    assetsFailed: 0,
    lastFrame: 0,
    renderFrames: 0,
    sampleTime: 0,
    sampleFrames: 0,
    measuredFps: 30,
    renderScale: 0.68,
    degraded: false,
    cameraGoal: null,
    lookGoal: null,
    lookNow: null,
    qualityText: "正在准备",
    suspended: false,
    confirmAt: { OK: 0, BACK: 0 },
    expedition: {
      active: false,
      phase: "atlas",
      list: [],
      bank: [],
      round: 0,
      total: 0,
      optionIndex: 0,
      options: [],
      answerIndex: -1,
      right: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      shield: 3,
      maxShield: 3,
      hintUsed: false,
      eliminated: [],
      mode: "sight",
      riftSequence: [],
      riftStep: 0,
      riftMistakes: 0,
      riftLastKey: "",
      riftStartedAt: 0,
      riftReward: 0,
      riftFxTimer: 0,
      locked: false,
      finished: false,
      timer: 0,
      revealDueAt: 0,
      run: 0,
      phaseAt: 0,
      ownerP: null,
      ownerCur: null
    }
  };

  function byId(id) { return document.getElementById(id); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  var REDUCED_QUERY = null;
  var REDUCED_MOTION = false;
  try {
    if (window.matchMedia) {
      REDUCED_QUERY = window.matchMedia("(prefers-reduced-motion: reduce)");
      REDUCED_MOTION = !!REDUCED_QUERY.matches;
      var onReducedChange = function (event) { REDUCED_MOTION = !!event.matches; };
      if (REDUCED_QUERY.addEventListener) REDUCED_QUERY.addEventListener("change", onReducedChange);
      else if (REDUCED_QUERY.addListener) REDUCED_QUERY.addListener(onReducedChange);
    }
  } catch (e) { REDUCED_QUERY = null; REDUCED_MOTION = false; }
  function reducedMotion() { return REDUCED_MOTION; }
  function setText(id, value) { var el = byId(id); if (el) el.textContent = value; }
  function setQuality(value) { W.qualityText = value; setText("world-quality", value); }
  function nowMs() {
    try { return window.performance && performance.now ? performance.now() : Date.now(); }
    catch (e) { return Date.now(); }
  }
  function shuffleCopy(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }
  function syncWorldFocus() {
    requestAnimationFrame(function () {
      try {
        if (typeof requestFocusSync === "function") requestFocusSync();
        else if (typeof placeFocusHalo === "function" && typeof focusRect === "function") {
          placeFocusHalo(focusRect(document.querySelector(".screen.active .focus")));
        }
      } catch (e) { }
    });
  }

  function learningSnapshot() {
    var total = 0, studied = 0, due = 0, unseen = 0;
    try {
      var active = typeof activeWords === "function" ? activeWords() : [];
      total = active.length;
      for (var i = 0; i < active.length; i++) {
        var row = P && P.words ? P.words[active[i].w] : null;
        if (row && row.st) studied++; else unseen++;
      }
      due = typeof dueWords === "function" ? dueWords().length : 0;
    } catch (e) { }
    return { total: total, studied: studied, unseen: unseen, due: due, percent: total ? Math.round(studied * 100 / total) : 0 };
  }

  function renderActions() {
    var host = byId("world-actions");
    if (!host) return;
    var snap = learningSnapshot();
    host.innerHTML = "";
    for (var i = 0; i < LANDMARKS.length; i++) {
      var item = LANDMARKS[i];
      var sub = item.sub;
      if (item.id === "expedition" && snap.total) sub = snap.unseen + " 枚新符文等待唤醒";
      if (item.id === "echo" && snap.due) sub = snap.due + " 束记忆回声等待夺回";
      var el = document.createElement("div");
      el.className = "world-action" + (i === W.index ? " focus" : "");
      el.setAttribute("data-world-index", String(i));
      el.innerHTML = '<span class="wa-icon">' + item.icon + '</span><div class="wa-name">' + item.title + '</div><div class="wa-sub">' + sub + '</div>';
      host.appendChild(el);
    }
    var progress = byId("world-progress");
    if (progress) progress.style.width = snap.percent + "%";
    setText("world-progress-text", snap.percent + "%");
  }

  function focusAction() {
    var cards = document.querySelectorAll("#world-actions .world-action");
    for (var i = 0; i < cards.length; i++) cards[i].classList.toggle("focus", i === W.index);
    var item = LANDMARKS[W.index];
    setText("world-title", item.title);
    setText("world-desc", item.desc);
    for (var j = 0; j < W.markers.length; j++) {
      var marker = W.markers[j];
      var selected = j === W.index;
      marker.visible = selected;
      if (marker.userData && marker.userData.ring) {
        marker.userData.ring.material.opacity = selected ? 0.92 : 0;
      }
    }
    if (W.travelerGoal && item && item.point) {
      var side = W.index === 4 ? 1.3 : (W.index === 0 ? 0.75 : -0.55);
      W.travelerGoal.set(item.point[0] + side, item.point[1] + 1.42, item.point[2] + 0.58);
    }
  }

  function cameraFor(item) {
    if (!window.THREE) return null;
    var p = item.point;
    var distance = item.id === "expedition" ? 10.8 : 8.5;
    var side = item.id === "new" ? 1.8 : (item.id === "arcade" ? -1.4 : 0);
    return new THREE.Vector3(p[0] + 5.8 + side, p[1] + 4.8, p[2] + distance);
  }

  function select(index, immediate) {
    W.index = (Number(index) + LANDMARKS.length) % LANDMARKS.length;
    focusAction();
    if (!W.camera || !window.THREE) return W.index;
    var item = LANDMARKS[W.index];
    W.cameraGoal = cameraFor(item);
    W.lookGoal = new THREE.Vector3(item.point[0], item.point[1] + 0.65, item.point[2]);
    if (immediate) {
      W.camera.position.copy(W.cameraGoal);
      W.lookNow.copy(W.lookGoal);
      W.camera.lookAt(W.lookNow);
    }
    return W.index;
  }

  function finishIntro() {
    if (!W.intro) return;
    W.intro = false;
    W.introSeen = true;
    if (W.introTimer) { clearTimeout(W.introTimer); W.introTimer = 0; }
    var root = byId("world");
    if (root) root.classList.remove("world-intro");
    var skip = byId("world-skip");
    if (skip) { skip.classList.remove("focus"); skip.style.visibility = "hidden"; }
    select(W.index, reducedMotion());
    requestAnimationFrame(function () {
      try {
        var focused = document.querySelector("#world-actions .world-action.focus");
        if (focused && typeof placeFocusHalo === "function" && typeof focusRect === "function") placeFocusHalo(focusRect(focused));
      } catch (e) { }
      setTimeout(function () {
        try {
          if (typeof SCREEN === "undefined" || SCREEN !== "world") return;
          var settled = document.querySelector("#world-actions .world-action.focus");
          if (settled && typeof placeFocusHalo === "function" && typeof focusRect === "function") placeFocusHalo(focusRect(settled));
        } catch (e2) { }
      }, 480);
    });
  }

  function clearExpeditionTimer() {
    if (W.expedition.timer) {
      clearTimeout(W.expedition.timer);
      W.expedition.timer = 0;
    }
  }

  function scheduleExpeditionReveal(run, delay) {
    clearExpeditionTimer();
    W.expedition.timer = setTimeout(function () {
      W.expedition.timer = 0;
      if (W.suspended || (typeof document.hidden === "boolean" && document.hidden)) return;
      showExpeditionReveal(run);
    }, Math.max(24, Number(delay) || 0));
  }

  function clearWorldFocus() {
    var focused = document.querySelectorAll("#world .focus");
    for (var i = 0; i < focused.length; i++) focused[i].classList.remove("focus");
  }

  function expeditionOwnerValid() {
    try {
      return W.expedition.ownerP === P && W.expedition.ownerCur === CUR &&
        typeof SCREEN !== "undefined" && SCREEN === "world";
    } catch (e) { return false; }
  }

  function normalMeaning(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function normalWord(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validSeenWords() {
    var source = [];
    try { source = typeof seenWords === "function" ? seenWords() : []; }
    catch (e) { source = []; }
    var out = [], words = Object.create(null);
    for (var i = 0; i < source.length; i++) {
      var item = source[i];
      if (!item || !String(item.w || "").trim() || !normalMeaning(item.m)) continue;
      var key = normalWord(item.w);
      if (words[key]) continue;
      words[key] = true;
      out.push(item);
    }
    return out;
  }

  function addUniqueWords(target, source, maxAdd, used) {
    var added = 0;
    for (var i = 0; i < source.length && added < maxAdd; i++) {
      var item = source[i];
      var wordKey = item && normalWord(item.w);
      if (!item || !wordKey || !normalMeaning(item.m) || used[wordKey]) continue;
      used[wordKey] = true;
      target.push(item);
      added++;
    }
  }

  function prepareExpedition() {
    var bank = validSeenWords();
    var meanings = Object.create(null);
    var bankByWord = Object.create(null);
    for (var i = 0; i < bank.length; i++) meanings[normalMeaning(bank[i].m)] = true;
    for (var b = 0; b < bank.length; b++) bankByWord[normalWord(bank[b].w)] = bank[b];
    if (bank.length < 10 || Object.keys(meanings).length < 3) return null;

    var list = [], used = Object.create(null);
    var due = [], weak = [];
    try { due = typeof dueWords === "function" ? dueWords() : []; } catch (e) { due = []; }
    try { weak = typeof weakWords === "function" ? weakWords() : []; } catch (e2) { weak = []; }
    due = due.map(function (item) { return bankByWord[normalWord(item && item.w)]; }).filter(Boolean);
    weak = weak.map(function (item) { return bankByWord[normalWord(item && item.w)]; }).filter(Boolean);
    addUniqueWords(list, due, 4, used);
    addUniqueWords(list, weak, 3, used);
    addUniqueWords(list, shuffleCopy(bank), 10 - list.length, used);
    if (list.length < 10) return null;
    return { list: list.slice(0, 10), bank: bank.slice() };
  }

  function makeExpeditionOptions(word) {
    var targetMeaning = normalMeaning(word.m);
    var targetWord = normalWord(word.w);
    var sameDeck = [], otherDeck = [];
    for (var i = 0; i < W.expedition.bank.length; i++) {
      var candidate = W.expedition.bank[i];
      if (!candidate || normalWord(candidate.w) === targetWord || normalMeaning(candidate.m) === targetMeaning) continue;
      (candidate.deck === word.deck ? sameDeck : otherDeck).push(candidate);
    }
    var pool = shuffleCopy(sameDeck).concat(shuffleCopy(otherDeck));
    var choices = [word], usedMeanings = Object.create(null);
    usedMeanings[targetMeaning] = true;
    for (var j = 0; j < pool.length && choices.length < 3; j++) {
      var meaning = normalMeaning(pool[j].m);
      if (!meaning || usedMeanings[meaning]) continue;
      usedMeanings[meaning] = true;
      choices.push(pool[j]);
    }
    if (choices.length < 3) return null;
    choices = shuffleCopy(choices);
    return { choices: choices, answerIndex: choices.indexOf(word) };
  }

  function expeditionZone(round) {
    var zones = ["苔光草原", "回声溪谷", "风车天径", "云端藏书院", "星穹之门"];
    var index = Math.min(zones.length - 1, Math.floor(round * zones.length / Math.max(1, W.expedition.total)));
    return zones[index];
  }

  function shieldText() {
    var text = "";
    for (var i = 0; i < W.expedition.maxShield; i++) text += i < W.expedition.shield ? "◆" : "◇";
    return text;
  }

  function updateExpeditionHud() {
    setText("we-score", String(W.expedition.score));
    setText("we-streak", String(W.expedition.streak));
    setText("we-shield", shieldText());
  }

  function moveExpeditionWorld() {
    var X = W.expedition;
    var destination = Math.min(LANDMARKS.length - 1, Math.floor(X.round * LANDMARKS.length / Math.max(1, X.total)));
    select(destination, false);
  }

  var RIFT_DIRECTIONS = [
    { key: "LEFT", glyph: "←", label: "左" },
    { key: "UP", glyph: "↑", label: "上" },
    { key: "RIGHT", glyph: "→", label: "右" },
    { key: "DOWN", glyph: "↓", label: "下" }
  ];

  function clearRiftFxTimer() {
    if (W.expedition.riftFxTimer) {
      clearTimeout(W.expedition.riftFxTimer);
      W.expedition.riftFxTimer = 0;
    }
  }

  function buildRiftSequence() {
    var X = W.expedition;
    var eventNumber = Math.max(1, Math.floor((X.round + 1) / 3));
    var length = Math.min(7, 4 + eventNumber);
    var seed = (X.round + 1) * 7919;
    for (var w = 0; w < X.list.length; w++) {
      var text = String(X.list[w] && X.list[w].w || "");
      for (var c = 0; c < text.length; c++) seed = ((seed * 33) ^ text.charCodeAt(c)) >>> 0;
    }
    var sequence = [];
    for (var i = 0; i < length; i++) {
      seed = (Math.imul(seed || 1, 1664525) + 1013904223) >>> 0;
      var index = seed % RIFT_DIRECTIONS.length;
      if (i && RIFT_DIRECTIONS[index].key === sequence[i - 1]) index = (index + 1 + ((seed >>> 8) % 3)) % RIFT_DIRECTIONS.length;
      sequence.push(RIFT_DIRECTIONS[index].key);
    }
    return sequence;
  }

  function riftDirection(key) {
    for (var i = 0; i < RIFT_DIRECTIONS.length; i++) if (RIFT_DIRECTIONS[i].key === key) return RIFT_DIRECTIONS[i];
    return RIFT_DIRECTIONS[0];
  }

  function updateRiftNodes() {
    var X = W.expedition;
    var host = byId("we-rift-sequence");
    if (!host) return;
    for (var i = 0; i < host.children.length; i++) {
      host.children[i].classList.toggle("done", i < X.riftStep);
      host.children[i].classList.toggle("current", i === X.riftStep && X.phase === "rift");
    }
    var progress = byId("we-rift-progress");
    if (progress) progress.style.width = Math.round(100 * X.riftStep / Math.max(1, X.riftSequence.length)) + "%";
  }

  function renderRiftNodes() {
    var X = W.expedition;
    var host = byId("we-rift-sequence");
    if (!host) return;
    host.innerHTML = "";
    for (var i = 0; i < X.riftSequence.length; i++) {
      var direction = riftDirection(X.riftSequence[i]);
      var node = document.createElement("span");
      node.className = "wr-node" + (i === 0 ? " current" : "");
      node.setAttribute("data-direction", direction.key);
      var glyph = document.createElement("b");
      glyph.textContent = direction.glyph;
      var label = document.createElement("small");
      label.textContent = direction.label;
      node.appendChild(glyph);
      node.appendChild(label);
      host.appendChild(node);
    }
    updateRiftNodes();
  }

  function startRift() {
    var X = W.expedition;
    if (!X.active || X.phase !== "reveal" || !expeditionOwnerValid() || W.suspended || document.hidden) return false;
    clearExpeditionTimer();
    clearRiftFxTimer();
    X.phase = "rift";
    X.phaseAt = nowMs();
    X.riftSequence = buildRiftSequence();
    X.riftStep = 0;
    X.riftMistakes = 0;
    X.riftLastKey = "";
    X.riftStartedAt = X.phaseAt;
    X.riftReward = 0;
    var root = byId("world");
    if (root) root.classList.remove("world-echo", "world-rift-complete");
    if (root) root.classList.add("world-rift");
    var reveal = byId("we-reveal");
    if (reveal) reveal.hidden = true;
    var rift = byId("we-rift");
    if (rift) rift.hidden = false;
    var next = byId("we-rift-continue");
    if (next) { next.hidden = true; next.classList.remove("focus"); }
    setText("we-zone", "星轨跃迁");
    setText("we-round", (X.round + 1) + " → " + (X.round + 2));
    setText("we-rift-status", "依次按方向键，让词灵踏亮整座星桥");
    var progress = byId("we-rift-progress");
    if (progress) progress.style.width = "0%";
    clearWorldFocus();
    renderRiftNodes();
    var destination = Math.min(LANDMARKS.length - 1, Math.floor((X.round + 1) * LANDMARKS.length / Math.max(1, X.total)));
    select(destination, false);
    try { if (window.SFX && SFX.open) SFX.open(); } catch (e) { }
    syncWorldFocus();
    return true;
  }

  function flashRiftMiss() {
    var host = byId("we-rift-sequence");
    var current = host && host.children[W.expedition.riftStep];
    if (!current) return;
    current.classList.remove("miss");
    void current.offsetWidth;
    current.classList.add("miss");
    clearRiftFxTimer();
    W.expedition.riftFxTimer = setTimeout(function () {
      W.expedition.riftFxTimer = 0;
      if (current) current.classList.remove("miss");
    }, 260);
  }

  function completeRift() {
    var X = W.expedition;
    if (X.phase !== "rift" || !expeditionOwnerValid() || W.suspended || document.hidden) return;
    X.phase = "riftDone";
    X.phaseAt = nowMs();
    X.riftReward = Math.max(80, 220 - X.riftMistakes * 35);
    X.score += X.riftReward;
    var healed = false;
    if (!X.riftMistakes && X.shield < X.maxShield) { X.shield++; healed = true; }
    updateExpeditionHud();
    updateRiftNodes();
    var root = byId("world");
    if (root) root.classList.add("world-rift-complete");
    setText("we-rift-status", (X.riftMistakes ? "星桥贯通" : "完美跃迁") + " · +" + X.riftReward + " 星辉" + (healed ? " · 护盾修复" : ""));
    var next = byId("we-rift-continue");
    clearWorldFocus();
    if (next) { next.hidden = false; next.classList.add("focus"); }
    try { if (window.SFX && SFX.win) SFX.win(); } catch (e) { }
    syncWorldFocus();
  }

  function handleRiftDirection(key) {
    var X = W.expedition;
    if (X.phase !== "rift" || !expeditionOwnerValid() || W.suspended || document.hidden || nowMs() - X.phaseAt < 180) return;
    if (key === X.riftLastKey) return;
    X.riftLastKey = key;
    var expected = X.riftSequence[X.riftStep];
    if (key === expected) {
      X.riftStep++;
      updateRiftNodes();
      if (X.riftStep >= X.riftSequence.length) completeRift();
      else setText("we-rift-status", "很好 · 继续沿着亮起的星轨前进");
    } else {
      X.riftMistakes++;
      flashRiftMiss();
      setText("we-rift-status", "方向偏离了一瞬 · 星桥仍在，继续尝试");
    }
  }

  function advanceExpeditionWord() {
    var X = W.expedition;
    var root = byId("world");
    if (root) root.classList.remove("world-rift", "world-rift-complete");
    var rift = byId("we-rift");
    if (rift) rift.hidden = true;
    X.round++;
    if (X.round >= X.total) finishExpedition();
    else renderExpeditionQuestion();
  }

  function focusExpeditionOption(index) {
    var options = byId("we-options");
    var children = options ? options.children : [];
    if (!children.length) return;
    var X = W.expedition;
    var requested = Number(index);
    var direction = requested < X.optionIndex ? -1 : 1;
    var candidate = (requested + children.length) % children.length;
    for (var tries = 0; tries < children.length && X.eliminated[candidate]; tries++) {
      candidate = (candidate + direction + children.length) % children.length;
    }
    X.optionIndex = candidate;
    for (var i = 0; i < children.length; i++) {
      var selected = i === X.optionIndex;
      children[i].classList.toggle("focus", selected);
      children[i].setAttribute("aria-selected", selected ? "true" : "false");
    }
  }

  function renderExpeditionQuestion() {
    var X = W.expedition;
    var word = X.list[X.round];
    var data = makeExpeditionOptions(word);
    if (!data) {
      exitExpedition();
      try { if (typeof toast === "function") toast("当前词库的释义过于相近，暂时无法生成远征题"); } catch (e) { }
      return false;
    }
    clearExpeditionTimer();
    X.options = data.choices;
    X.answerIndex = data.answerIndex;
    X.optionIndex = 0;
    X.eliminated = [false, false, false];
    X.hintUsed = false;
    X.locked = false;
    X.phase = "question";
    X.phaseAt = nowMs();
    var echoEnabled = false;
    try { echoEnabled = !!(P && P.set && P.set.tts); } catch (echoSettingError) { echoEnabled = false; }
    X.mode = X.round % 3 === 2 && echoEnabled ? "echo" : "sight";
    moveExpeditionWorld();

    setText("we-zone", expeditionZone(X.round));
    setText("we-round", (X.round + 1) + " / " + X.total);
    updateExpeditionHud();
    setText("we-prompt-kicker", X.mode === "echo" ? "LISTEN TO THE STAR ECHO" : "CHOOSE THE TRUE MEANING");
    setText("we-prompt", X.mode === "echo" ? "✦ 星语回响" : word.w);
    setText("we-pron", X.mode === "echo" ? "播放键重听 · 凭声音开启星门" : (word.p || "听见它，也看见它"));
    setText("we-feedback", "方向键选择 · OK 确认 · 播放键听音 · 菜单键可使用星芒提示");
    var world = byId("world");
    if (world) world.classList.toggle("world-echo", X.mode === "echo");
    var feedback = byId("we-feedback");
    if (feedback) feedback.className = "";

    var reveal = byId("we-reveal");
    var finish = byId("we-finish");
    var rift = byId("we-rift");
    if (reveal) reveal.hidden = true;
    if (finish) finish.hidden = true;
    if (rift) rift.hidden = true;
    if (world) world.classList.remove("world-rift", "world-rift-complete");
    clearWorldFocus();
    var host = byId("we-options");
    if (host) {
      host.innerHTML = "";
      var keys = ["A", "B", "C"];
      for (var i = 0; i < X.options.length; i++) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = i === 0 ? "focus" : "";
        button.setAttribute("role", "option");
        button.setAttribute("data-key", keys[i]);
        button.setAttribute("aria-selected", i === 0 ? "true" : "false");
        button.textContent = X.options[i].m;
        host.appendChild(button);
      }
    }
    syncWorldFocus();
    if (X.mode === "echo" && expeditionOwnerValid() && !W.suspended && !document.hidden) {
      try { if (typeof speak === "function") speak(word.w); } catch (echoError) { }
    }
    return true;
  }

  function startExpedition() {
    if (W.expedition.active) return true;
    finishIntro();
    var prepared = prepareExpedition();
    if (!prepared) {
      try { if (typeof toast === "function") toast("星辉远征需要至少 10 个已学单词，先完成一小段学习吧"); } catch (e) { }
      syncWorldFocus();
      return false;
    }
    var X = W.expedition;
    clearExpeditionTimer();
    X.run++;
    X.active = true;
    X.phase = "question";
    X.list = prepared.list;
    X.bank = prepared.bank;
    X.round = 0;
    X.total = X.list.length;
    X.right = 0;
    X.score = 0;
    X.streak = 0;
    X.bestStreak = 0;
    X.shield = X.maxShield;
    X.hintUsed = false;
    X.eliminated = [];
    X.mode = "sight";
    X.riftSequence = [];
    X.riftStep = 0;
    X.riftMistakes = 0;
    X.riftLastKey = "";
    X.riftStartedAt = 0;
    X.riftReward = 0;
    X.finished = false;
    X.ownerP = P;
    X.ownerCur = CUR;
    X.phaseAt = nowMs();
    var root = byId("world");
    if (root) root.classList.add("world-expedition");
    select(4, false);
    renderExpeditionQuestion();
    return true;
  }

  function showExpeditionReveal(run) {
    var X = W.expedition;
    if (!X.active || X.run !== run || X.phase !== "result" || !expeditionOwnerValid() || W.suspended || document.hidden) return;
    clearExpeditionTimer();
    X.revealDueAt = 0;
    X.phase = "reveal";
    X.phaseAt = nowMs();
    var word = X.list[X.round];
    setText("we-reveal-word", word.w);
    setText("we-reveal-meaning", word.m);
    var example = String(word.x || "").trim();
    var translation = String(word.tr || "").trim();
    setText("we-reveal-example", example ? (example + (translation ? "  ·  " + translation : "")) : "把这个词带进下一次真实表达里。");
    var host = byId("we-options");
    if (host) {
      for (var i = 0; i < host.children.length; i++) host.children[i].classList.remove("focus");
    }
    var reveal = byId("we-reveal");
    if (reveal) reveal.hidden = false;
    var next = byId("we-next");
    if (next) {
      next.textContent = X.round + 1 >= X.total ? "查看远征结算" : "下一词";
      next.classList.add("focus");
    }
    try { if (typeof speak === "function") speak(word.w); } catch (e) { }
    syncWorldFocus();
  }

  function answerExpedition() {
    var X = W.expedition;
    if (!X.active || X.phase !== "question" || X.locked || !expeditionOwnerValid()) return;
    if (nowMs() - X.phaseAt < 700) return;
    if (X.eliminated[X.optionIndex]) return;
    X.locked = true;
    X.phase = "result";
    X.phaseAt = nowMs();
    var ok = X.optionIndex === X.answerIndex;
    var healed = false;
    if (ok) {
      X.right++;
      X.streak++;
      X.bestStreak = Math.max(X.bestStreak, X.streak);
      X.score += 100 + Math.min(6, X.streak) * 18;
      if (X.streak % 3 === 0 && X.shield < X.maxShield) {
        X.shield++;
        healed = true;
      }
    } else {
      X.streak = 0;
      if (X.shield > 0) X.shield--;
      else X.score = Math.max(0, X.score - 30);
    }
    updateExpeditionHud();
    var host = byId("we-options");
    if (host) {
      for (var i = 0; i < host.children.length; i++) {
        host.children[i].classList.remove("right", "wrong");
        if (i === X.answerIndex) host.children[i].classList.add("right");
        if (i === X.optionIndex && !ok) host.children[i].classList.add("wrong");
      }
    }
    var feedback = byId("we-feedback");
    if (feedback) {
      feedback.textContent = ok ? (healed ? "完美连击 · 词灵修复了一格护盾" : "答对了 · 星门已经点亮") :
        (X.shield ? "这次选错了 · 护盾吸收冲击，正确答案已标出" : "护盾破碎 · 不会中断远征，继续找回它");
      feedback.className = ok ? "good" : "bad";
    }
    try {
      if (typeof schedHit === "function") schedHit(X.list[X.round].w, ok);
      if (window.SFX) (ok ? SFX.good() : SFX.bad());
    } catch (e) { }
    if (W.traveler && W.traveler.userData) W.traveler.userData.pulse = ok ? 1 : -1;
    var run = X.run;
    var delay = ok ? 420 : 560;
    X.revealDueAt = nowMs() + delay;
    scheduleExpeditionReveal(run, delay);
  }

  function useExpeditionHint() {
    var X = W.expedition;
    if (!X.active || X.phase !== "question" || X.locked || X.hintUsed || !expeditionOwnerValid() || W.suspended || document.hidden) return;
    var feedback = byId("we-feedback");
    if (X.score < 80) {
      if (feedback) { feedback.textContent = "星芒提示需要 80 星辉 · 连续答对即可充能"; feedback.className = ""; }
      return;
    }
    var candidates = [];
    for (var i = 0; i < X.options.length; i++) {
      if (i !== X.answerIndex && !X.eliminated[i]) candidates.push(i);
    }
    if (!candidates.length) return;
    var removeIndex = candidates[0] === X.optionIndex && candidates.length > 1 ? candidates[1] : candidates[0];
    X.eliminated[removeIndex] = true;
    X.hintUsed = true;
    X.score -= 80;
    updateExpeditionHud();
    var host = byId("we-options");
    if (host && host.children[removeIndex]) {
      host.children[removeIndex].classList.add("eliminated");
      host.children[removeIndex].setAttribute("aria-disabled", "true");
    }
    if (X.optionIndex === removeIndex) focusExpeditionOption(removeIndex + 1);
    if (feedback) { feedback.textContent = "星雾掠过 · 已排除一个错误星门"; feedback.className = "good"; }
    try { if (window.SFX && SFX.ok) SFX.ok(); } catch (e) { }
    syncWorldFocus();
  }

  function finishExpedition() {
    var X = W.expedition;
    if (!X.active || X.finished || !expeditionOwnerValid()) return;
    clearExpeditionTimer();
    X.finished = true;
    X.phase = "finish";
    X.phaseAt = nowMs();
    select(4, false);
    var accuracy = X.total ? Math.round(X.right * 100 / X.total) : 0;
    try {
      if (typeof gameResult === "function") gameResult("expedition", X.right, X.total, X.score);
      if (window.SFX && SFX.win) SFX.win();
    } catch (e) { }
    setText("we-finish-title", accuracy === 100 && X.shield === X.maxShield ? "无伤点亮星穹" : (accuracy >= 80 ? "远征凯旋" : "星路已留下足迹"));
    setText("we-finish-stats", X.right + " / " + X.total + " 正确  ·  " + accuracy + "%  ·  " + X.score + " 星辉");
    setText("we-finish-msg", "最佳连击 " + X.bestStreak + " · 剩余护盾 " + shieldText() + "。每一次找回，都会让下次复习更准确。按 OK 返回词汇世界。");
    var reveal = byId("we-reveal");
    if (reveal) reveal.hidden = true;
    var rift = byId("we-rift");
    if (rift) rift.hidden = true;
    var root = byId("world");
    if (root) root.classList.remove("world-rift", "world-rift-complete");
    clearWorldFocus();
    var finish = byId("we-finish");
    if (finish) finish.hidden = false;
    var back = byId("we-return");
    if (back) back.classList.add("focus");
    else {
      var copy = finish ? finish.querySelector(".we-finish-copy") : null;
      if (copy) copy.classList.add("focus");
    }
    syncWorldFocus();
  }

  function nextExpeditionWord() {
    var X = W.expedition;
    if (!X.active || X.phase !== "reveal" || !expeditionOwnerValid()) return;
    if (nowMs() - X.phaseAt < 700) return;
    if (X.round + 1 < X.total && (X.round + 1) % 3 === 0) startRift();
    else advanceExpeditionWord();
  }

  function exitExpedition(resetOnly) {
    var X = W.expedition;
    clearExpeditionTimer();
    clearRiftFxTimer();
    X.run++;
    X.active = false;
    X.phase = "atlas";
    X.locked = false;
    X.list = [];
    X.bank = [];
    X.options = [];
    X.round = 0;
    X.total = 0;
    X.optionIndex = 0;
    X.answerIndex = -1;
    X.right = 0;
    X.score = 0;
    X.streak = 0;
    X.bestStreak = 0;
    X.shield = X.maxShield;
    X.hintUsed = false;
    X.eliminated = [];
    X.mode = "sight";
    X.riftSequence = [];
    X.riftStep = 0;
    X.riftMistakes = 0;
    X.riftLastKey = "";
    X.riftStartedAt = 0;
    X.riftReward = 0;
    X.finished = false;
    X.revealDueAt = 0;
    X.ownerP = null;
    X.ownerCur = null;
    X.phaseAt = nowMs();
    X.guardUntil = X.phaseAt + 700;
    var root = byId("world");
    if (root) root.classList.remove("world-expedition", "world-echo", "world-rift", "world-rift-complete");
    var reveal = byId("we-reveal");
    var finish = byId("we-finish");
    var rift = byId("we-rift");
    if (reveal) reveal.hidden = true;
    if (finish) finish.hidden = true;
    if (rift) rift.hidden = true;
    clearWorldFocus();
    if (!resetOnly) {
      select(4, false);
      renderActions();
      focusAction();
      syncWorldFocus();
    }
  }

  function expeditionKey(k) {
    var X = W.expedition;
    var age = nowMs() - X.phaseAt;
    if (k === "BACK") {
      if (age >= 160) exitExpedition(false);
      return;
    }
    if (k === "PLAY" && (X.phase === "question" || X.phase === "reveal")) {
      try { if (typeof speak === "function" && X.list[X.round]) speak(X.list[X.round].w); } catch (e) { }
      return;
    }
    if (k === "MENU" && X.phase === "question") {
      useExpeditionHint();
      return;
    }
    if (X.phase === "rift" && (k === "LEFT" || k === "UP" || k === "RIGHT" || k === "DOWN")) {
      handleRiftDirection(k);
      return;
    }
    if (X.phase === "question") {
      if (k === "LEFT" || k === "UP") focusExpeditionOption(X.optionIndex - 1);
      else if (k === "RIGHT" || k === "DOWN") focusExpeditionOption(X.optionIndex + 1);
      else if (k === "OK") answerExpedition();
    } else if (X.phase === "result" && k === "OK" && age >= 700) {
      showExpeditionReveal(X.run);
    } else if (X.phase === "reveal" && k === "OK") {
      nextExpeditionWord();
    } else if (X.phase === "riftDone" && k === "OK" && age >= 700) {
      advanceExpeditionWord();
    } else if (X.phase === "finish" && k === "OK" && age >= 700) {
      exitExpedition(false);
    }
  }

  function restoreExpeditionFocus() {
    var X = W.expedition;
    clearWorldFocus();
    if (X.phase === "question" || X.phase === "result") {
      focusExpeditionOption(X.optionIndex);
    } else if (X.phase === "reveal") {
      var next = byId("we-next");
      if (next) next.classList.add("focus");
    } else if (X.phase === "finish") {
      var back = byId("we-return");
      if (back) back.classList.add("focus");
      else {
        var finish = byId("we-finish");
        var copy = finish ? finish.querySelector(".we-finish-copy") : null;
        if (copy) copy.classList.add("focus");
      }
    } else if (X.phase === "riftDone") {
      var riftNext = byId("we-rift-continue");
      if (riftNext) riftNext.classList.add("focus");
    }
    syncWorldFocus();
  }

  function openLandmark() {
    var id = LANDMARKS[W.index].id;
    if (id === "expedition") { startExpedition(); return; }
    if (id === "echo") {
      try { if (typeof RETURN_SCREEN !== "undefined") RETURN_SCREEN = "world"; } catch (e0) { }
      if (window.EchoHeist && typeof window.EchoHeist.open === "function") window.EchoHeist.open();
      else if (typeof toast === "function") toast("记忆裂隙正在唤醒，请稍后重试");
      return;
    }
    if (id === "chase") {
      try { if (typeof RETURN_SCREEN !== "undefined") RETURN_SCREEN = "world"; } catch (e) { }
    }
    openMenu(id);
  }

  function key(k) {
    if (k === "OK" || k === "BACK") {
      var signalAt = nowMs();
      var previousSignal = W.confirmAt[k] || 0;
      W.confirmAt[k] = signalAt;
      if (previousSignal && signalAt - previousSignal < 320) return;
    }
    if (W.expedition.active) { expeditionKey(k); return; }
    if ((k === "OK" || k === "BACK") && W.expedition.guardUntil && nowMs() < W.expedition.guardUntil) return;
    if (W.intro) {
      finishIntro();
      if (k === "OK") return;
    }
    if (k === "LEFT" || k === "UP") select(W.index - 1, false);
    else if (k === "RIGHT" || k === "DOWN") select(W.index + 1, false);
    else if (k === "OK") openLandmark();
    else if (k === "BACK") show("home");
  }

  function makeMaterial(color, opacity) {
    return new THREE.MeshLambertMaterial({ color: color, transparent: opacity < 1, opacity: opacity });
  }

  function addPlaceholderIsland(parent, item, index) {
    var group = new THREE.Group();
    group.position.set(item.point[0], item.point[1] - 0.48, item.point[2]);
    var radius = index === 4 ? 2.18 : 1.72;
    var land = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.82, 0.58, 6, 1, false), makeMaterial(index === 4 ? 0x8ead79 : 0x9ab889, 1));
    group.add(land);
    var stone = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius * 0.57, 0.52, 6), makeMaterial(0x71837a, 1));
    stone.position.y = -0.46;
    group.add(stone);

    var building = new THREE.Group();
    var baseColor = item.color;
    var body = new THREE.Mesh(new THREE.BoxGeometry(index === 4 ? 1.35 : 0.9, index === 1 ? 1.65 : 0.88, index === 4 ? 1.2 : 0.82), makeMaterial(baseColor, 1));
    body.position.y = index === 1 ? 1.1 : 0.72;
    building.add(body);
    var roof = new THREE.Mesh(new THREE.ConeGeometry(index === 4 ? 1.08 : 0.73, index === 1 ? 1.25 : 0.66, 4), makeMaterial(index === 2 ? 0xd2a75f : 0x607b82, 1));
    roof.position.y = index === 1 ? 2.45 : 1.48;
    roof.rotation.y = Math.PI / 4;
    building.add(roof);
    if (index === 2) {
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.75, 6), makeMaterial(0x6b6255, 1));
      mast.position.y = 1.35; building.add(mast);
      var blades = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.1, 0.08), makeMaterial(0xf0e4c3, 1));
      blades.position.set(0, 1.75, 0.52); building.add(blades);
      var blades2 = blades.clone(); blades2.rotation.z = Math.PI / 2; building.add(blades2);
    }
    group.add(building);
    parent.add(group);
  }

  function addMarker(item) {
    var marker = new THREE.Group();
    marker.position.set(item.point[0], item.point[1] + 1.72, item.point[2]);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.045, 6, 28), new THREE.MeshBasicMaterial({ color: item.color, transparent: true, opacity: 0.92 }));
    ring.rotation.x = Math.PI / 2;
    marker.add(ring);
    var core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xfff5c9 }));
    marker.add(core);
    marker.userData.ring = ring;
    W.worldRoot.add(marker);
    W.markers.push(marker);
  }

  function addTraveler() {
    var traveler = new THREE.Group();
    var visual = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.43, 0),
      new THREE.MeshLambertMaterial({ color: 0xffedaa })
    );
    body.scale.set(0.82, 1.12, 0.82);
    visual.add(body);

    var wingGeometry = new THREE.BufferGeometry();
    wingGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
      -0.08, 0.13, 0, -0.78, 0.35, 0.06, -0.58, -0.27, 0,
       0.08, 0.13, 0,  0.58, -0.27, 0,     0.78, 0.35, 0.06
    ], 3));
    wingGeometry.computeVertexNormals();
    var wings = new THREE.Mesh(
      wingGeometry,
      new THREE.MeshBasicMaterial({ color: 0xeaf4e8, side: THREE.DoubleSide })
    );
    wings.position.z = -0.05;
    visual.add(wings);

    var halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.49, 0.026, 5, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff4bf })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.08;
    visual.add(halo);

    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.56, 20),
      new THREE.MeshBasicMaterial({ color: 0x35564f, transparent: true, opacity: 0.2, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.3;
    traveler.add(shadow);
    traveler.add(visual);
    traveler.userData.visual = visual;
    traveler.userData.wings = wings;
    traveler.userData.halo = halo;
    traveler.userData.shadow = shadow;
    traveler.userData.pulse = 0;

    var item = LANDMARKS[W.index];
    var side = W.index === 4 ? 1.3 : (W.index === 0 ? 0.75 : -0.55);
    W.travelerGoal = new THREE.Vector3(item.point[0] + side, item.point[1] + 1.42, item.point[2] + 0.58);
    traveler.position.copy(W.travelerGoal);
    W.traveler = traveler;
    W.worldRoot.add(traveler);
  }

  function buildLightScene() {
    W.scene = new THREE.Scene();
    W.scene.fog = new THREE.Fog(0xc9dedb, 13, 32);
    W.camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 70);
    W.lookNow = new THREE.Vector3(0, 0.8, 0);
    W.worldRoot = new THREE.Group();
    W.assetRoot = new THREE.Group();
    W.placeholderRoot = new THREE.Group();
    W.loadedModels = Object.create(null); W.assetsLoaded = 0; W.assetsFailed = 0;
    W.worldRoot.add(W.placeholderRoot);
    W.worldRoot.add(W.assetRoot);
    W.scene.add(W.worldRoot);

    var hemi = new THREE.HemisphereLight(0xf3f1dc, 0x53716a, 1.35);
    W.scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff3d1, 1.12);
    sun.position.set(-7, 12, 8);
    sun.castShadow = false;
    W.scene.add(sun);
    var fill = new THREE.DirectionalLight(0xa9cfd0, 0.35);
    fill.position.set(8, 4, -6);
    W.scene.add(fill);

    var sea = new THREE.Mesh(new THREE.CircleGeometry(18, 48), new THREE.MeshLambertMaterial({ color: 0x87ada7, transparent: true, opacity: 0.68 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.92;
    W.worldRoot.add(sea);

    for (var i = 0; i < LANDMARKS.length; i++) {
      addPlaceholderIsland(W.placeholderRoot, LANDMARKS[i], i);
      addMarker(LANDMARKS[i]);
    }
    addTraveler();

    var moteGeo = new THREE.BufferGeometry();
    var positions = new Float32Array(24 * 3);
    for (var p = 0; p < 24; p++) {
      positions[p * 3] = (Math.random() - 0.5) * 17;
      positions[p * 3 + 1] = Math.random() * 4.5 + 0.2;
      positions[p * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    moteGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    W.motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xfff2bd, size: 0.075, transparent: true, opacity: 0.68, sizeAttenuation: true }));
    W.worldRoot.add(W.motes);
    select(W.index, true);
  }

  function chooseRenderScale() {
    var w = Math.max(1, window.innerWidth || 1280);
    if (w >= 3000) return 0.55;
    if (w >= 1700) return 0.84;
    if (w >= 1200) return 0.92;
    return 1;
  }

  function onResize() {
    if (!W.renderer || !W.camera) return;
    var width = Math.max(1, window.innerWidth || 1280);
    var height = Math.max(1, window.innerHeight || 720);
    W.camera.aspect = width / height;
    W.camera.updateProjectionMatrix();
    var scale = W.degraded ? Math.max(0.5, W.renderScale) : chooseRenderScale();
    W.renderScale = scale;
    W.renderer.setPixelRatio(1);
    W.renderer.setSize(Math.max(640, Math.round(width * scale)), Math.max(360, Math.round(height * scale)), false);
    W.renderer.domElement.style.width = "100%";
    W.renderer.domElement.style.height = "100%";
  }

  function activateFallback(reason) {
    W.failed = true;
    W.ready = false;
    var root = byId("world");
    if (root) root.classList.add("world-fallback-only");
    if (W.renderer && W.renderer.domElement) W.renderer.domElement.style.display = "none";
    setQuality(reason || "兼容画面");
    if (!document.hidden) {
      W.suspended = false;
      if (W.expedition.active && W.expedition.phase === "result") {
        var remaining = Math.max(24, (W.expedition.revealDueAt || nowMs()) - nowMs());
        scheduleExpeditionReveal(W.expedition.run, remaining);
      }
    }
  }

  function loadRuntimeScript(id, src, ready) {
    if (ready()) return Promise.resolve(true);
    return new Promise(function (resolve, reject) {
      var old = document.getElementById(id);
      if (old) {
        old.addEventListener("load", function () { ready() ? resolve(true) : reject(new Error(id + " unavailable")); }, { once: true });
        old.addEventListener("error", reject, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = function () { ready() ? resolve(true) : reject(new Error(id + " unavailable")); };
      script.onerror = function () { reject(new Error(id + " load failed")); };
      document.head.appendChild(script);
    });
  }

  function ensureRuntime() {
    if (window.THREE && window.THREE.GLTFLoader) return Promise.resolve(true);
    if (W.runtimePromise) return W.runtimePromise;
    W.runtimePromise = loadRuntimeScript("lextv-three-runtime", "vendor/three-r128.min.js", function () {
      return !!window.THREE;
    }).then(function () {
      return loadRuntimeScript("lextv-gltf-runtime", "vendor/GLTFLoader-r128.js", function () {
        return !!(window.THREE && window.THREE.GLTFLoader);
      });
    });
    return W.runtimePromise;
  }

  function initRenderer() {
    if (/(?:^|[?&])wwFallback=1(?:&|$)/.test(window.location.search || "")) {
      activateFallback("兼容画面");
      return false;
    }
    if (W.failed) { activateFallback("兼容画面"); return false; }
    if (W.renderer && W.scene) {
      setQuality(W.assetsLoaded >= 7 ? (W.degraded ? "流畅模式" : "完整世界 · 30 FPS") : "轻量世界 · 30 FPS");
      return true;
    }
    if (!window.THREE) { activateFallback("兼容画面"); return false; }
    var stage = byId("world-stage");
    if (!stage) { activateFallback("界面不可用"); return false; }
    try {
      // TV 端优先稳定温度；低多边形场景不需要独占高性能 GPU。
      W.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power", precision: "mediump", failIfMajorPerformanceCaveat: false });
      W.renderer.setClearColor(0x000000, 0);
      W.renderer.shadowMap.enabled = false;
      if (typeof THREE.sRGBEncoding !== "undefined") W.renderer.outputEncoding = THREE.sRGBEncoding;
      if (typeof THREE.ACESFilmicToneMapping !== "undefined") {
        W.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        W.renderer.toneMappingExposure = 0.96;
      }
      W.renderer.domElement.setAttribute("aria-hidden", "true");
      W.renderer.domElement.addEventListener("webglcontextlost", function (event) {
        try { event.preventDefault(); } catch (e) { }
        stop();
        activateFallback("图形已安全降级");
      }, false);
      stage.appendChild(W.renderer.domElement);
      buildLightScene();
      onResize();
      W.ready = true;
      W.failed = false;
      setQuality("流畅 3D · 30 FPS");
      return true;
    } catch (e) {
      try { if (W.renderer) W.renderer.dispose(); } catch (x) { }
      W.renderer = null;
      activateFallback("兼容画面");
      return false;
    }
  }

  function ensureBundle() {
    if (window.LEXTV_WORLD_BUNDLE) return Promise.resolve(window.LEXTV_WORLD_BUNDLE);
    if (W.bundlePromise) return W.bundlePromise;
    W.bundlePromise = new Promise(function (resolve, reject) {
      var old = document.getElementById("lextv-world-bundle");
      if (old) {
        old.addEventListener("load", function () { window.LEXTV_WORLD_BUNDLE ? resolve(window.LEXTV_WORLD_BUNDLE) : reject(new Error("bundle missing")); }, { once: true });
        old.addEventListener("error", reject, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.id = "lextv-world-bundle";
      script.src = "world-assets/bundle.js";
      script.async = true;
      script.onload = function () {
        if (window.LEXTV_WORLD_BUNDLE) resolve(window.LEXTV_WORLD_BUNDLE);
        else reject(new Error("bundle missing"));
      };
      script.onerror = function () { reject(new Error("bundle load failed")); };
      document.head.appendChild(script);
    });
    return W.bundlePromise;
  }

  function decodeJson64(value) {
    var raw = atob(value);
    try {
      if (window.TextDecoder) {
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        return new TextDecoder("utf-8").decode(bytes);
      }
    } catch (e) { }
    return raw;
  }

  function loadSharedTexture(bundle, generation) {
    if (W.sharedTexture) return Promise.resolve(W.sharedTexture);
    if (!bundle.sharedTexture) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var uri = "data:" + (bundle.textureMime || "image/png") + ";base64," + bundle.sharedTexture;
      var loader = new THREE.TextureLoader();
      loader.load(uri, function (texture) {
        if (generation !== W.assetGeneration) {
          try { texture.dispose(); } catch (staleError) { }
          resolve(null);
          return;
        }
        texture.flipY = false;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearMipMapLinearFilter;
        if (typeof THREE.sRGBEncoding !== "undefined") texture.encoding = THREE.sRGBEncoding;
        W.sharedTexture = texture;
        resolve(texture);
      }, undefined, function () { resolve(null); });
    });
  }

  function rebindMaterials(root, texture) {
    root.traverse(function (node) {
      if (!node || !node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = false;
      var materials = Array.isArray(node.material) ? node.material : [node.material];
      for (var i = 0; i < materials.length; i++) {
        var material = materials[i];
        if (!material) continue;
        var oldMap = material.map;
        if (texture && oldMap !== texture) material.map = texture;
        if (typeof material.roughness === "number") material.roughness = 0.94;
        if (typeof material.metalness === "number") material.metalness = 0;
        material.needsUpdate = true;
        if (oldMap && oldMap !== texture && typeof oldMap.dispose === "function") oldMap.dispose();
      }
    });
  }

  function parseModel(bundle, modelDef, sharedTexture) {
    return new Promise(function (resolve, reject) {
      var record = bundle.models && bundle.models[modelDef.id];
      if (!record) { reject(new Error("model missing: " + modelDef.id)); return; }
      var documentJson;
      try {
        documentJson = JSON.parse(decodeJson64(record.gltf));
        var buffers = documentJson.buffers || [];
        for (var i = 0; i < buffers.length; i++) {
          var source = String(buffers[i].uri || "");
          if (!source || source.indexOf("data:") === 0) continue;
          var keyName = source.split(/[\\/]/).pop();
          if (record.files && record.files[keyName]) buffers[i].uri = "data:application/octet-stream;base64," + record.files[keyName];
        }
        var images = documentJson.images || [];
        for (var j = 0; j < images.length; j++) {
          if (images[j].uri && bundle.sharedTexture) images[j].uri = "data:" + (bundle.textureMime || "image/png") + ";base64," + bundle.sharedTexture;
        }
      } catch (e) { reject(e); return; }

      var manager = new THREE.LoadingManager();
      manager.setURLModifier(function (url) {
        if (String(url).indexOf("data:") === 0) return url;
        var base = String(url).split(/[\\/]/).pop();
        if (record.files && record.files[base]) return "data:application/octet-stream;base64," + record.files[base];
        if (/\.(png|jpg|jpeg)$/i.test(base) && bundle.sharedTexture) return "data:" + (bundle.textureMime || "image/png") + ";base64," + bundle.sharedTexture;
        return url;
      });
      try {
        var loader = new THREE.GLTFLoader(manager);
        loader.parse(JSON.stringify(documentJson), "", function (gltf) {
          var root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root) { reject(new Error("empty model")); return; }
          rebindMaterials(root, sharedTexture);
          resolve(root);
        }, reject);
      } catch (e2) { reject(e2); }
    });
  }

  function addModelPlacements(bundle, definition, sourceRoot, targetRoot) {
    targetRoot = targetRoot || W.assetRoot;
    if (!targetRoot) return;
    var placements = bundle.manifest && bundle.manifest.placements ? bundle.manifest.placements : [];
    for (var i = 0; i < placements.length; i++) {
      var row = placements[i];
      if (row.model !== definition.id) continue;
      var clone = sourceRoot.clone(true);
      var p = row.position || [0, 0, 0];
      clone.position.set(Number(p[0]) || 0, Number(p[1]) || 0, Number(p[2]) || 0);
      clone.rotation.y = Number(row.rotationY) || 0;
      var scale = (Number(definition.scale) || 1) * (Number(row.scale) || 1);
      clone.scale.setScalar(scale);
      targetRoot.add(clone);
    }
  }

  function disposeStaleTree(root) {
    if (!root || typeof root.traverse !== "function") return;
    root.traverse(function (node) {
      if (node.geometry && typeof node.geometry.dispose === "function") node.geometry.dispose();
      var materials = Array.isArray(node.material) ? node.material : [node.material];
      for (var i = 0; i < materials.length; i++) {
        var material = materials[i];
        if (!material) continue;
        if (material.map && material.map !== W.sharedTexture && typeof material.map.dispose === "function") material.map.dispose();
        if (typeof material.dispose === "function") material.dispose();
      }
    });
  }

  function loadAssets() {
    if (W.assetPromise) return W.assetPromise;
    if (!W.ready || !window.THREE || !window.THREE.GLTFLoader) return Promise.resolve(false);
    var generation = W.assetGeneration;
    var targetRoot = W.assetRoot;
    W.assetPromise = ensureBundle().then(function (bundle) {
      if (generation !== W.assetGeneration || !targetRoot || targetRoot !== W.assetRoot) throw new Error("stale world");
      if (!bundle || !bundle.manifest || !bundle.models) throw new Error("invalid bundle");
      THREE.Cache.enabled = true;
      return loadSharedTexture(bundle, generation).then(function (sharedTexture) {
        if (generation !== W.assetGeneration || !targetRoot || targetRoot !== W.assetRoot) throw new Error("stale world");
        var definitions = bundle.manifest.models || [];
        var chain = Promise.resolve();
        definitions.forEach(function (definition) {
          chain = chain.then(function () {
            if (generation !== W.assetGeneration || targetRoot !== W.assetRoot) throw new Error("stale world");
            if (W.loadedModels[definition.id]) return;
            return parseModel(bundle, definition, sharedTexture).then(function (modelRoot) {
              if (generation !== W.assetGeneration || targetRoot !== W.assetRoot) {
                disposeStaleTree(modelRoot);
                return;
              }
              addModelPlacements(bundle, definition, modelRoot, targetRoot);
              W.loadedModels[definition.id] = true;
              W.assetsLoaded++;
            }, function () { if (generation === W.assetGeneration) W.assetsFailed++; }).then(function () {
              return new Promise(function (resolve) { setTimeout(resolve, 0); });
            });
          });
        });
        return chain.then(function () {
          if (generation !== W.assetGeneration || targetRoot !== W.assetRoot) return false;
          if (W.assetsLoaded >= 7 && W.placeholderRoot) W.placeholderRoot.visible = false;
          if (W.assetsLoaded >= 7) setQuality(W.degraded ? "流畅模式" : "完整世界 · 30 FPS");
          else setQuality("轻量世界 · 30 FPS");
          return W.assetsLoaded > 0;
        });
      });
    }).catch(function () {
      if (generation !== W.assetGeneration || targetRoot !== W.assetRoot) return false;
      setQuality("轻量世界 · 30 FPS");
      return false;
    });
    return W.assetPromise;
  }

  function degrade() {
    if (W.degraded || !W.renderer) return;
    W.degraded = true;
    W.renderScale = Math.max(0.5, W.renderScale * 0.78);
    if (W.motes) W.motes.visible = false;
    onResize();
    setQuality("流畅模式 · 24–30 FPS");
  }

  function publishStats() {
    var el = byId("world-quality");
    var info = W.renderer && W.renderer.info ? W.renderer.info : null;
    if (!el || !info) return;
    el.setAttribute("data-ww-fps", String(W.measuredFps));
    el.setAttribute("data-ww-calls", String(info.render.calls || 0));
    el.setAttribute("data-ww-triangles", String(info.render.triangles || 0));
    el.setAttribute("data-ww-textures", String(info.memory.textures || 0));
    el.setAttribute("data-ww-scale", W.renderScale.toFixed(2));
    try {
      var attrs = W.renderer.getContext().getContextAttributes();
      el.setAttribute("data-ww-antialias", attrs && attrs.antialias ? "on" : "off");
    } catch (e) { el.setAttribute("data-ww-antialias", "unknown"); }
  }

  function animateScene(dt, now) {
    if (!W.camera || !W.cameraGoal || !W.lookGoal || !W.lookNow) return;
    var reduce = reducedMotion();
    var ease = reduce ? 1 : (1 - Math.exp(-dt * 8.2));
    W.camera.position.lerp(W.cameraGoal, ease);
    W.lookNow.lerp(W.lookGoal, ease);
    W.camera.lookAt(W.lookNow);
    var marker = W.markers[W.index];
    if (marker) {
      marker.rotation.y += dt * 0.72;
      if (!reduce) marker.position.y = LANDMARKS[W.index].point[1] + 1.72 + Math.sin(now * 0.0016) * 0.045;
    }
    if (W.traveler && W.travelerGoal) {
      var dx = W.travelerGoal.x - W.traveler.position.x;
      var dz = W.travelerGoal.z - W.traveler.position.z;
      W.traveler.position.lerp(W.travelerGoal, reduce ? 1 : (1 - Math.exp(-dt * 9.6)));
      if (!reduce && Math.abs(dx) + Math.abs(dz) > 0.015) W.traveler.rotation.y = Math.atan2(dx, dz);
      var visual = W.traveler.userData.visual;
      var pulse = W.traveler.userData.pulse || 0;
      if (visual) {
        var bob = reduce ? 0 : Math.sin(now * 0.0031) * 0.095;
        visual.position.y = bob;
        visual.rotation.z = pulse < 0 ? -0.12 * Math.abs(pulse) : 0;
        var scale = 1 + Math.abs(pulse) * 0.14;
        visual.scale.set(scale, scale, scale);
      }
      if (W.traveler.userData.wings && !reduce) W.traveler.userData.wings.scale.x = 1 + Math.sin(now * 0.0062) * 0.08;
      if (W.traveler.userData.halo && !reduce) W.traveler.userData.halo.rotation.z += dt * 0.62;
      if (W.traveler.userData.shadow) {
        var shadowScale = reduce ? 1 : 1 - Math.sin(now * 0.0031) * 0.08;
        W.traveler.userData.shadow.scale.set(shadowScale, shadowScale, shadowScale);
      }
      if (pulse) W.traveler.userData.pulse = Math.abs(pulse) < 0.02 ? 0 : pulse * Math.exp(-dt * 5.4);
    }
    if (W.motes && W.motes.visible && !reduce) W.motes.rotation.y += dt * 0.018;
  }

  function frame(now) {
    if (!W.running || !W.ready || !W.renderer || !W.scene) { W.raf = 0; return; }
    W.raf = requestAnimationFrame(frame);
    if (W.lastFrame && now - W.lastFrame < 31) return;
    var elapsed = W.lastFrame ? now - W.lastFrame : 33.3;
    W.lastFrame = now;
    var dt = Math.min(0.08, elapsed / 1000);
    animateScene(dt, now);
    try { W.renderer.render(W.scene, W.camera); }
    catch (e) { stop(); activateFallback("图形已安全降级"); return; }
    W.renderFrames++;
    W.sampleFrames++;
    W.sampleTime += elapsed;
    if (W.sampleFrames >= 120) {
      W.measuredFps = W.sampleTime > 0 ? Math.round(1000 * W.sampleFrames / W.sampleTime) : 30;
      if (W.measuredFps < 25) degrade();
      publishStats();
      W.sampleFrames = 0;
      W.sampleTime = 0;
    }
  }

  function beginIntro() {
    var root = byId("world");
    var skip = byId("world-skip");
    var duration = reducedMotion() ? 0 : (W.introSeen ? 320 : 2400);
    W.intro = duration > 0;
    if (root) root.classList.toggle("world-intro", W.intro);
    if (skip) {
      skip.style.visibility = W.intro ? "visible" : "hidden";
      skip.classList.toggle("focus", W.intro);
    }
    if (W.intro && W.camera && window.THREE) {
      W.camera.position.set(0, 11.8, 18.5);
      W.lookNow.set(0, 0, 0);
    }
    if (W.intro) W.introTimer = setTimeout(finishIntro, duration);
    else finishIntro();
  }

  function prepareIntroCopy() {
    var profile = "旅者";
    try { if (typeof PF === "function" && PF()) profile = PF().short || PF().name || profile; } catch (e) { }
    setText("world-cinematic-profile", profile);
    var date = new Date();
    var seed = (date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate()) >>> 0;
    var identity = "";
    try { identity = String(typeof CUR !== "undefined" ? CUR : "LEX"); } catch (e2) { identity = "LEX"; }
    for (var i = 0; i < identity.length; i++) seed = ((seed * 33) ^ identity.charCodeAt(i)) >>> 0;
    setText("world-cinematic-seed", "WORLD " + (seed % 10000).toString().padStart(4, "0"));
  }

  function start() {
    var runToken = ++W.token;
    W.suspended = false;
    var root = byId("world");
    if (root && !W.failed) root.classList.remove("world-fallback-only");
    var resumeExpedition = W.expedition.active && expeditionOwnerValid();
    if (W.expedition.active && !resumeExpedition) exitExpedition(true);
    if (resumeExpedition) {
      if (root) root.classList.add("world-expedition");
      restoreExpeditionFocus();
      if (W.expedition.phase === "result") {
        var remainingReveal = Math.max(24, (W.expedition.revealDueAt || nowMs()) - nowMs());
        scheduleExpeditionReveal(W.expedition.run, remainingReveal);
      }
    } else {
      prepareIntroCopy();
      renderActions();
      beginIntro();
      focusAction();
    }
    setQuality("正在唤醒世界");
    ensureRuntime().then(function () {
      if (runToken !== W.token || typeof SCREEN === "undefined" || SCREEN !== "world") return;
      var ok = initRenderer();
      W.running = !!ok;
      W.lastFrame = 0;
      W.sampleFrames = 0;
      W.sampleTime = 0;
      if (!ok) return;
      if (!W.expedition.active && W.intro && W.camera && W.lookNow) {
        W.camera.position.set(0, 11.8, 18.5);
        W.lookNow.set(0, 0, 0);
      }
      if (W.renderer && W.renderer.domElement) W.renderer.domElement.style.display = "block";
      onResize();
      if (!W.raf) W.raf = requestAnimationFrame(frame);
      loadAssets();
    }).catch(function () {
      if (runToken !== W.token || typeof SCREEN === "undefined" || SCREEN !== "world") return;
      activateFallback("兼容画面");
    });
    return true;
  }

  function stop() {
    W.token++;
    // 退出世界立刻使串行 GLTF 解析链失效，避免快速返回/重进时仍在后台吃 CPU。
    W.assetGeneration++;
    W.assetPromise = null;
    W.running = false;
    W.suspended = true;
    if (W.raf) { cancelAnimationFrame(W.raf); W.raf = 0; }
    if (W.introTimer) { clearTimeout(W.introTimer); W.introTimer = 0; }
    if (W.expedition.active && W.expedition.phase === "result") clearExpeditionTimer();
    // 已完成解析的模型留在内存中复用；未完成的解析由 generation 令牌取消。
    // 这样快速退出/重进不会重新解码 1.48MB 资源，也不会出现占位场景消失后的空画面。
    if (W.placeholderRoot) W.placeholderRoot.visible = W.assetsLoaded < 7;
    W.intro = false;
  }

  function disposeMaterial(material) {
    if (!material) return;
    var keys = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "alphaMap", "aoMap"];
    for (var i = 0; i < keys.length; i++) {
      var texture = material[keys[i]];
      if (texture && texture !== W.sharedTexture && typeof texture.dispose === "function") texture.dispose();
    }
    if (typeof material.dispose === "function") material.dispose();
  }

  function dispose() {
    exitExpedition(true);
    stop();
    W.assetGeneration++;
    if (W.scene) {
      W.scene.traverse(function (node) {
        if (node.geometry && typeof node.geometry.dispose === "function") node.geometry.dispose();
        if (Array.isArray(node.material)) for (var i = 0; i < node.material.length; i++) disposeMaterial(node.material[i]);
        else disposeMaterial(node.material);
      });
    }
    if (W.sharedTexture) { try { W.sharedTexture.dispose(); } catch (e) { } }
    W.sharedTexture = null;
    if (W.renderer) {
      var canvas = W.renderer.domElement;
      try { W.renderer.dispose(); } catch (e2) { }
      try { if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); } catch (e3) { }
    }
    W.renderer = W.scene = W.camera = W.worldRoot = W.assetRoot = W.placeholderRoot = W.motes = null;
    W.traveler = W.travelerGoal = null;
    W.markers = [];
    W.ready = false;
    W.failed = false;
    W.assetPromise = null;
    W.assetsLoaded = 0;
    W.assetsFailed = 0;
  }

  function open() {
    show("world");
  }

  function benchmark() {
    var info = W.renderer && W.renderer.info ? W.renderer.info : null;
    return {
      mode: W.failed ? "fallback" : (W.degraded ? "degraded-3d" : "3d"),
      running: W.running,
      fps: W.measuredFps,
      renderScale: W.renderScale,
      calls: info ? info.render.calls : 0,
      triangles: info ? info.render.triangles : 0,
      geometries: info ? info.memory.geometries : 0,
      textures: info ? info.memory.textures : 0,
      assetsLoaded: W.assetsLoaded,
      assetsFailed: W.assetsFailed,
      quality: W.qualityText,
      expedition: W.expedition.active ? W.expedition.phase : "atlas"
    };
  }

  window.WordWorld = {
    open: open,
    start: start,
    stop: stop,
    dispose: dispose,
    ensureRuntime: ensureRuntime,
    onResize: onResize,
    select: select,
    key: key,
    startExpedition: startExpedition,
    exitExpedition: function () { exitExpedition(false); },
    benchmark: benchmark
  };

  handlers.world = {
    enter: function () { start(); },
    key: key
  };

  window.addEventListener("resize", function () { if (W.running) onResize(); });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (typeof SCREEN !== "undefined" && SCREEN === "world") stop();
    } else if (typeof SCREEN !== "undefined" && SCREEN === "world") start();
  });
  window.addEventListener("pagehide", stop);
}());
