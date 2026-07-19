/* ======================================================================
   LexTV · 星火遗迹

   The depth-first maze-generation idea is informed by wwwtyro/Astray,
   released under The Unlicense:
   https://github.com/wwwtyro/Astray

   Rendering, controls, enemy behavior, state management and learning
   integration are original LexTV code. No upstream runtime, art or physics
   engine is redistributed. This file stays fully offline and Canvas 2D-only.
   ====================================================================== */
"use strict";
(function () {
  var COLS = 15, ROWS = 9, STEP = 1 / 30;
  var DIRS = {
    LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1]
  };
  var PORTAL_COLORS = ["#8fd0bd", "#f0d48a", "#9aaee5"];
  var GATE_GLYPHS = ["◈", "✧", "⌁"];
  var M = {
    active: false, suspended: false, phase: "off", runId: 0,
    ownerP: null, ownerCur: null, returnScreen: "world",
    list: [], bank: [], round: 0, total: 0, resolved: 0,
    right: 0, score: 0, combo: 0, bestCombo: 0,
    shield: 3, maxShield: 3, mistakes: 0,
    questionToken: 0, committedTokens: Object.create(null), sessionCommitted: false,
    current: null, options: [], correctPortal: -1, portals: [], shards: [], shardCount: 0,
    grid: [], distances: [], start: { x: 1, y: 1 },
    player: { x: 1, y: 1, px: 1, py: 1 },
    monster: { x: 13, y: 7, px: 13, py: 7, nextAt: 0 },
    trail: [], visited: Object.create(null),
    simTime: 0, phaseUntil: 0, inputGateUntil: 0,
    signalAt: { LEFT: 0, RIGHT: 0, UP: 0, DOWN: 0, OK: 0 },
    acceptedAt: { LEFT: 0, RIGHT: 0, UP: 0, DOWN: 0, OK: 0 },
    blockedKeys: Object.create(null),
    raf: 0, lastRealTime: 0, accumulator: 0,
    canvas: null, ctx: null, width: 0, height: 0, scale: 1,
    mapX: 0, mapY: 0, cell: 40, flash: 0, reveal: 0,
    sampleTime: 0, sampleFrames: 0, measuredFps: 30, degraded: false
  };

  function byId(id) { return document.getElementById(id); }
  function nowMs() {
    try { return window.performance && performance.now ? performance.now() : Date.now(); }
    catch (e) { return Date.now(); }
  }
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function setText(id, value) { var el = byId(id); if (el) el.textContent = String(value == null ? "" : value); }
  function normal(value) {
    var text = String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
    try { return text.normalize("NFKC"); } catch (e) { return text; }
  }
  function phonetic(value) {
    var text = String(value || "").trim();
    if (!text) return "";
    return text.charAt(0) === "/" ? text : "/" + text + "/";
  }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }
  function hash(text) {
    var out = 2166136261 >>> 0, source = String(text || "");
    for (var i = 0; i < source.length; i++) { out ^= source.charCodeAt(i); out = Math.imul(out, 16777619); }
    return out >>> 0;
  }
  function randomFrom(seed) {
    var value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      var t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(source, rng) {
    var out = source.slice(), random = rng || Math.random;
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1)), swap = out[i]; out[i] = out[j]; out[j] = swap;
    }
    return out;
  }
  function cellKey(x, y) { return x + ":" + y; }
  function ownerValid() {
    try { return M.active && M.ownerP === P && M.ownerCur === CUR && SCREEN === "memory-maze"; }
    catch (e) { return false; }
  }

  function installUi() {
    if (byId("memory-maze")) return true;
    var app = byId("app"); if (!app) return false;
    var style = document.createElement("style");
    style.id = "memory-maze-style";
    style.textContent = [
      "#memory-maze{--mm-gold:#efd58a;--mm-mint:#8fd0bd;--mm-ink:#102f35;padding:0;display:none;overflow:hidden;isolation:isolate;color:#f8f8ed;background:linear-gradient(145deg,#102e35,#244c4c 55%,#203b3b)}",
      "#memory-maze.active{display:block;animation:mm-screen-in .34s cubic-bezier(.18,.78,.2,1)}",
      "@keyframes mm-screen-in{from{opacity:0;transform:scale(1.012)}to{opacity:1;transform:none}}",
      "#mm-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;background:#12343a;outline:0}",
      ".mm-scrim{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(5,24,29,.42),transparent 22%,transparent 67%,rgba(5,22,27,.72)),radial-gradient(ellipse at 50% 48%,transparent 45%,rgba(5,20,23,.38));z-index:2}",
      ".mm-top{position:absolute;z-index:4;left:4vw;right:4vw;top:3.8vh;display:flex;align-items:flex-start;justify-content:space-between;pointer-events:none}",
      ".mm-brand{display:grid;grid-template-columns:auto auto;align-items:center;column-gap:1.1vmin;text-shadow:0 .2vmin .7vmin rgba(2,18,21,.45)}",
      ".mm-brand-mark{grid-row:1/span 2;width:5.3vmin;height:5.3vmin;display:grid;place-items:center;border:.12vmin solid rgba(255,255,255,.35);border-radius:1.55vmin;color:#1b433f;background:linear-gradient(145deg,#f0dea2,#88bbaa);box-shadow:inset 0 .14vmin .12vmin rgba(255,255,255,.58),0 .7vmin 1.8vmin rgba(5,24,27,.22);font:850 2.5vmin/1 Inter,sans-serif}",
      ".mm-brand b{font-size:2.55vmin;letter-spacing:.08em}.mm-brand small{font:650 1.4vmin/1.15 Inter,sans-serif;letter-spacing:.22em;color:rgba(226,239,224,.67)}",
      ".mm-stats{display:grid;grid-template-columns:repeat(4,minmax(9.5vmin,auto));gap:.65vmin;padding:.5vmin;border:.1vmin solid rgba(255,255,255,.18);border-radius:1.6vmin;background:rgba(10,39,41,.78);box-shadow:0 .6vmin 1.8vmin rgba(3,18,21,.2)}",
      ".mm-stat{min-width:9vmin;padding:.55vmin .95vmin;border-radius:1.1vmin;text-align:center;background:rgba(224,238,220,.08)}",
      ".mm-stat small{display:block;font-size:1.45vmin;letter-spacing:.08em;color:rgba(223,237,221,.68)}.mm-stat b{display:block;margin-top:.25vmin;font:760 2.1vmin/1 Inter,'PingFang SC',sans-serif;color:#fffce9}.mm-stat.shield b{color:var(--mm-gold);letter-spacing:.1em}",
      ".mm-target{position:absolute;z-index:4;left:50%;top:3.6vh;min-width:34vmin;max-width:64vmin;padding:.9vmin 2.8vmin 1.05vmin;transform:translateX(-50%);text-align:center;border:.1vmin solid rgba(239,222,157,.28);border-radius:1.65vmin;background:rgba(10,37,40,.83);box-shadow:0 .7vmin 2vmin rgba(2,20,22,.2);pointer-events:none}",
      ".mm-target small{display:block;font:730 1.35vmin/1 Inter,sans-serif;letter-spacing:.24em;color:#d8c887}.mm-target b{display:block;margin-top:.45vmin;font:820 4.15vmin/.98 Inter,'PingFang SC',sans-serif;letter-spacing:-.025em;color:#fffdf0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mm-target span{display:block;margin-top:.42vmin;font-size:1.55vmin;color:rgba(224,237,222,.62)}",
      ".mm-portals{position:absolute;z-index:4;left:50%;bottom:4.3vh;width:min(112vmin,88vw);transform:translateX(-50%);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1vmin;pointer-events:none}",
      ".mm-portal-card{position:relative;min-width:0;min-height:7.4vmin;padding:1.05vmin 1.35vmin 1vmin 4.6vmin;border:.12vmin solid rgba(255,255,255,.22);border-radius:1.55vmin;color:#eaf2e8;background:rgba(12,39,41,.82);box-shadow:0 .7vmin 1.8vmin rgba(2,18,21,.18);transition:transform 110ms ease,border-color 110ms ease,opacity 110ms ease}",
      ".mm-portal-card i{position:absolute;left:1.2vmin;top:50%;width:2.5vmin;height:2.5vmin;margin-top:-1.25vmin;border:.3vmin solid var(--portal);border-radius:50%;box-shadow:0 0 1.2vmin var(--portal)}",
      ".mm-portal-card b{display:block;font-size:1.85vmin;line-height:1.28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mm-portal-card small{display:block;margin-top:.3vmin;font:680 1.3vmin/1 Inter,sans-serif;letter-spacing:.16em;color:rgba(224,237,222,.55)}",
      ".mm-portal-card.near{transform:translateY(-.38vmin);border-color:var(--portal)}.mm-portal-card.sealed{opacity:.36;text-decoration:line-through}",
      ".mm-callout{position:absolute;z-index:5;left:50%;bottom:14.7vh;max-width:78vw;transform:translateX(-50%);padding:.65vmin 1.8vmin;border-radius:10vmin;text-align:center;color:#eaf4e8;background:rgba(8,35,37,.82);box-shadow:0 .45vmin 1.5vmin rgba(2,18,21,.18);font-size:1.7vmin;font-weight:670;letter-spacing:.04em;pointer-events:none;transition:transform 100ms ease,color 100ms ease}",
      ".mm-callout.good{color:#bce8c5;transform:translateX(-50%) scale(1.04)}.mm-callout.bad{color:#f1afa5;transform:translateX(-50%) scale(1.04)}",
      ".mm-controls{position:absolute;z-index:4;right:4vw;bottom:1.25vh;color:rgba(226,238,224,.62);font-size:1.35vmin;letter-spacing:.06em;pointer-events:none}.mm-controls b{display:inline-block;margin-left:.8vmin;padding:.15vmin .5vmin;border:.1vmin solid rgba(255,255,255,.32);border-radius:.45vmin;color:#f4f5e8}",
      ".mm-intro{position:absolute;z-index:7;inset:0;display:grid;place-items:center;text-align:center;color:#fffdf0;background:radial-gradient(circle at 50% 49%,rgba(99,142,125,.17),rgba(6,27,31,.76) 56%,rgba(4,20,24,.94));pointer-events:none;opacity:0;visibility:hidden;transition:opacity .32s ease}",
      "#memory-maze.mm-intro-on .mm-intro{opacity:1;visibility:visible}.mm-intro-copy{position:relative}.mm-intro-copy:before{content:'';position:absolute;left:50%;top:50%;width:55vmin;height:55vmin;margin:-27.5vmin;border:.12vmin solid rgba(235,220,154,.24);border-radius:50%;animation:mm-orbit 9s linear infinite}.mm-intro-copy small{font:760 1.55vmin/1 Inter,sans-serif;letter-spacing:.42em;color:#d9ca8d}.mm-intro-copy h2{margin-top:1.1vmin;font:850 8.2vmin/.92 Inter,'PingFang SC',sans-serif;letter-spacing:.06em}.mm-intro-copy p{margin-top:1.6vmin;font-size:2.2vmin;letter-spacing:.16em;color:rgba(231,240,226,.76)}",
      "@keyframes mm-orbit{to{transform:rotate(360deg)}}",
      ".mm-finish{position:absolute;z-index:8;inset:0;display:grid;place-items:center;text-align:center;background:radial-gradient(circle at 50% 32%,rgba(242,220,145,.24),transparent 30vmin),linear-gradient(145deg,#173a3d,#315a53);opacity:1}.mm-finish[hidden]{display:none!important}",
      ".mm-finish-copy{width:min(86vmin,80vw);padding:4vmin 6vmin;border:.12vmin solid rgba(255,255,255,.28);border-radius:2.6vmin;background:rgba(12,41,42,.88);box-shadow:0 2vmin 6vmin rgba(3,20,23,.3)}",
      ".mm-finish-kicker{font:760 1.5vmin/1 Inter,sans-serif;letter-spacing:.34em;color:#dbc987}.mm-finish h2{margin-top:1vmin;font-size:6.3vmin;line-height:1.05}.mm-finish-stats{margin-top:1.8vmin;font-size:2.8vmin;font-weight:750;color:#f1dfa0}.mm-finish p{margin:1.3vmin auto 0;font-size:1.95vmin;line-height:1.45;color:rgba(229,239,226,.72)}",
      "#mm-return{min-width:32vmin;min-height:6.8vmin;margin-top:2.3vmin;border:.16vmin solid #ead68e;border-radius:1.7vmin;color:#214a42;background:#efe1a7;font:780 2.3vmin/1 Inter,'PingFang SC',sans-serif;outline:0;box-shadow:0 .8vmin 2vmin rgba(3,23,23,.25);transition:transform 90ms ease,box-shadow 90ms ease}#mm-return.focus{transform:translateY(-.35vmin) scale(1.04);box-shadow:0 0 0 .24vmin #fffdf1,0 0 0 .62vmin rgba(234,214,142,.62),0 1vmin 2.3vmin rgba(3,23,23,.3)}",
      "html.eye #memory-maze{filter:saturate(.78) brightness(.98)}html.eye .mm-target,html.eye .mm-stats,html.eye .mm-portal-card{background:rgba(31,57,52,.9)}",
      "@media(max-width:1300px){.mm-stats{grid-template-columns:repeat(4,minmax(8.4vmin,auto))}.mm-stat{min-width:8vmin}.mm-target b{font-size:3.8vmin}.mm-portal-card b{font-size:1.75vmin}.mm-callout{font-size:1.85vmin}}",
      "@media(prefers-reduced-motion:reduce){#memory-maze.active,.mm-intro-copy:before{animation:none!important}.mm-portal-card,.mm-callout,#mm-return{transition-duration:.01ms!important}}"
    ].join("");
    document.head.appendChild(style);

    var root = document.createElement("div");
    root.className = "screen"; root.id = "memory-maze"; root.setAttribute("aria-label", "星火遗迹迷宫");
    root.innerHTML = ''
      + '<canvas id="mm-canvas" aria-label="可移动的词汇迷宫"></canvas><div class="mm-scrim"></div>'
      + '<div class="mm-top"><div class="mm-brand"><span class="mm-brand-mark">⌘</span><b>星火遗迹</b><small>STARFIRE RUINS</small></div>'
      + '<div class="mm-stats"><div class="mm-stat"><small>遗迹</small><b id="mm-round">1 / 8</b></div><div class="mm-stat"><small>星辉</small><b id="mm-score">0</b></div><div class="mm-stat"><small>连击</small><b id="mm-combo">0</b></div><div class="mm-stat shield"><small>护符</small><b id="mm-shield">◆◆◆</b></div></div></div>'
      + '<div class="mm-target"><small>TARGET ECHO</small><b id="mm-word">LEXORIA</b><span id="mm-phon">沿着回声寻找真正含义</span></div>'
      + '<div class="mm-callout" id="mm-callout">门牌释义全程可见 · 收集回声,再走进与单词相符的传送门</div>'
      + '<div class="mm-portals" id="mm-portals"></div><div class="mm-controls"><b>方向键</b> 移动 <b>OK</b> 回放目标 <b>返回</b> 撤离</div>'
      + '<div class="mm-intro"><div class="mm-intro-copy"><small>A LEXTV LIVING RUIN</small><h2>星 火 遗 迹</h2><p>每一次遗忘，都会重写道路</p></div></div>'
      + '<div class="mm-finish" id="mm-finish" hidden><div class="mm-finish-copy"><div class="mm-finish-kicker">RUINS RESONANCE COMPLETE</div><h2 id="mm-finish-title">遗迹重新发光</h2><div class="mm-finish-stats" id="mm-finish-stats"></div><p id="mm-finish-msg"></p><button id="mm-return" type="button">返回词汇世界</button></div></div>';
    app.appendChild(root);
    M.canvas = byId("mm-canvas");
    try { M.ctx = M.canvas.getContext("2d", { alpha: false }); } catch (e) { M.ctx = null; }
    if (!M.ctx) try { M.ctx = M.canvas.getContext("2d"); } catch (fallbackError) { M.ctx = null; }
    return !!M.ctx;
  }

  function prepareRun() {
    var raw = [];
    try { raw = activeWords(); } catch (e) { raw = []; }
    var bank = [], words = Object.create(null), meanings = Object.create(null);
    for (var i = 0; i < raw.length; i++) {
      var item = raw[i], wk = item && normal(item.w), mk = item && normal(item.m);
      if (!wk || !mk || words[wk]) continue;
      words[wk] = true; meanings[mk] = true; bank.push(item);
    }
    if (bank.length < 12 || Object.keys(meanings).length < 3) return null;

    var selected = [], selectedWords = Object.create(null);
    function add(items, limit) {
      var count = 0;
      for (var n = 0; n < items.length && selected.length < 8 && count < limit; n++) {
        var word = items[n], key = normal(word.w); if (!key || selectedWords[key]) continue;
        selectedWords[key] = true; selected.push(word); count++;
      }
    }
    var due = bank.filter(function (e) { var r = P.words && P.words[e.w]; return r && r.st > 0 && r.due <= Date.now(); });
    var weak = [];
    try { weak = weakWords(); } catch (e2) { weak = []; }
    var seen = bank.filter(function (e) { var r = P.words && P.words[e.w]; return r && r.st > 0; });
    var srcPool = [];
    try { srcPool = typeof gameWords === "function" ? gameWords().filter(function (e) { return bank.some(function (b) { return normal(b.w) === normal(e.w); }); }) : seen; } catch (ep) { srcPool = seen; }
    var poolKeys = Object.create(null);
    for (var pk = 0; pk < srcPool.length; pk++) poolKeys[normal(srcPool[pk].w)] = true;
    function inPool(item) { return item && poolKeys[normal(item.w)]; }
    add(shuffled(due).filter(inPool), 3); add(weak.filter(inPool), 3); add(shuffled(srcPool), 8);
    if (selected.length < 8) return null;
    return { bank: bank, list: selected.slice(0, 8) };
  }

  function makeOptions(target, rng) {
    var used = Object.create(null), options = [target]; used[normal(target.m)] = true;
    var pool = shuffled(M.bank, rng);
    for (var i = 0; i < pool.length && options.length < 3; i++) {
      var candidate = pool[i], meaning = normal(candidate.m);
      if (!meaning || normal(candidate.w) === normal(target.w) || used[meaning]) continue;
      used[meaning] = true; options.push(candidate);
    }
    if (options.length < 3) return null;
    options = shuffled(options, rng);
    return { options: options, answer: options.indexOf(target) };
  }

  function makeMaze(rng) {
    var grid = [], x, y;
    for (y = 0; y < ROWS; y++) { grid[y] = []; for (x = 0; x < COLS; x++) grid[y][x] = 1; }
    var stack = [{ x: 1, y: 1 }]; grid[1][1] = 0;
    while (stack.length) {
      var here = stack[stack.length - 1];
      var ways = shuffled([[2, 0], [-2, 0], [0, 2], [0, -2]], rng).filter(function (d) {
        var nx = here.x + d[0], ny = here.y + d[1];
        return nx > 0 && nx < COLS - 1 && ny > 0 && ny < ROWS - 1 && grid[ny][nx] === 1;
      });
      if (!ways.length) { stack.pop(); continue; }
      var step = ways[0], nx = here.x + step[0], ny = here.y + step[1];
      grid[here.y + step[1] / 2][here.x + step[0] / 2] = 0; grid[ny][nx] = 0;
      stack.push({ x: nx, y: ny });
    }
    // v7.0:回溯迷宫是树(任意两点仅一条路),配 BFS 追踪=必被抓。
    // 敲掉 ~18% 的隔墙制造环路,玩家可以绕圈甩开词怪。
    for (y = 1; y < ROWS - 1; y++) {
      for (x = 1; x < COLS - 1; x++) {
        if (grid[y][x] !== 1) continue;
        var lr = grid[y][x - 1] === 0 && grid[y][x + 1] === 0;
        var ud = grid[y - 1][x] === 0 && grid[y + 1][x] === 0;
        if ((lr || ud) && !(lr && ud) && rng() < 0.18) grid[y][x] = 0;
      }
    }
    return grid;
  }

  function floorCells(grid) {
    var out = [];
    for (var y = 1; y < ROWS - 1; y++) for (var x = 1; x < COLS - 1; x++) if (grid[y][x] === 0) out.push({ x: x, y: y });
    return out;
  }
  function neighbors(grid, point) {
    var out = [];
    for (var key in DIRS) {
      var d = DIRS[key], x = point.x + d[0], y = point.y + d[1];
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS && grid[y][x] === 0) out.push({ x: x, y: y });
    }
    return out;
  }
  function distanceMap(grid, start) {
    var dist = [], queue = [{ x: start.x, y: start.y }], head = 0;
    for (var y = 0; y < ROWS; y++) { dist[y] = []; for (var x = 0; x < COLS; x++) dist[y][x] = -1; }
    dist[start.y][start.x] = 0;
    while (head < queue.length) {
      var current = queue[head++], next = neighbors(grid, current);
      for (var i = 0; i < next.length; i++) {
        var n = next[i]; if (dist[n.y][n.x] >= 0) continue;
        dist[n.y][n.x] = dist[current.y][current.x] + 1; queue.push(n);
      }
    }
    return dist;
  }
  function choosePortals(grid, start, rng) {
    var dist = distanceMap(grid, start), cells = floorCells(grid);
    cells.sort(function (a, b) { return dist[b.y][b.x] - dist[a.y][a.x]; });
    var picked = [];
    for (var i = 0; i < cells.length && picked.length < 3; i++) {
      var c = cells[i], far = dist[c.y][c.x] >= 7;
      if (!far) continue;
      var apart = picked.every(function (p) { return Math.abs(p.x - c.x) + Math.abs(p.y - c.y) >= 5; });
      if (apart) picked.push(c);
    }
    for (var j = 0; j < cells.length && picked.length < 3; j++) {
      var fallback = cells[j];
      if (!picked.some(function (p) { return p.x === fallback.x && p.y === fallback.y; })) picked.push(fallback);
    }
    return { cells: shuffled(picked.slice(0, 3), rng), dist: dist };
  }
  function farthestFree(grid, start, excluded) {
    var dist = distanceMap(grid, start), cells = floorCells(grid).filter(function (c) { return !excluded[cellKey(c.x, c.y)]; });
    cells.sort(function (a, b) { return dist[b.y][b.x] - dist[a.y][a.x]; });
    return cells[0] || { x: COLS - 2, y: ROWS - 2 };
  }
  function chooseShards(grid, start, excluded, rng) {
    var dist = distanceMap(grid, start), cells = shuffled(floorCells(grid), rng).filter(function (c) {
      return dist[c.y][c.x] >= 3 && !excluded[cellKey(c.x, c.y)];
    });
    var out = [];
    for (var i = 0; i < cells.length && out.length < 3; i++) {
      var c = cells[i];
      if (out.every(function (p) { return Math.abs(p.x - c.x) + Math.abs(p.y - c.y) >= 3; })) out.push({ x: c.x, y: c.y, taken: false });
    }
    // A generated tree normally has ample space, but the learning contract is
    // always three echoes. Fill any rare tight layout without duplicating a cell.
    for (var j = 0; j < cells.length && out.length < 3; j++) {
      var fallback = cells[j];
      if (!out.some(function (p) { return p.x === fallback.x && p.y === fallback.y; })) {
        out.push({ x: fallback.x, y: fallback.y, taken: false });
      }
    }
    return out;
  }

  function blockCarriedKeys() {
    var signal = nowMs(); M.blockedKeys = Object.create(null);
    Object.keys(M.signalAt).forEach(function (key) { if (M.signalAt[key] && signal - M.signalAt[key] < 420) M.blockedKeys[key] = true; });
  }
  function startRound() {
    if (!ownerValid() || M.round >= M.total) return;
    var target = M.list[M.round], rng = randomFrom(hash(M.ownerCur + ":" + target.w + ":" + M.round + ":" + M.runId));
    var made = makeOptions(target, rng);
    if (!made) { abortToReturn("当前词书的释义过于相近，遗迹无法生成三座传送门", "BACK"); return; }
    M.questionToken++; M.current = target; M.options = made.options; M.correctPortal = made.answer;
    M.grid = makeMaze(rng); M.start = { x: 1, y: 1 }; M.distances = distanceMap(M.grid, M.start);
    var portalChoice = choosePortals(M.grid, M.start, rng), excluded = Object.create(null);
    M.portals = portalChoice.cells.map(function (cell, i) {
      excluded[cellKey(cell.x, cell.y)] = true;
      return { x: cell.x, y: cell.y, option: i, sealed: false };
    });
    excluded[cellKey(M.start.x, M.start.y)] = true;
    M.shards = chooseShards(M.grid, M.start, excluded, rng); M.shardCount = 0;
    M.shards.forEach(function (s) { excluded[cellKey(s.x, s.y)] = true; });
    var monsterStart = farthestFree(M.grid, M.start, excluded);
    M.player.x = M.player.px = M.start.x; M.player.y = M.player.py = M.start.y;
    M.monster.x = M.monster.px = monsterStart.x; M.monster.y = M.monster.py = monsterStart.y;
    M.monster.nextAt = M.simTime + 2.1;
    M.trail = [{ x: M.start.x, y: M.start.y }]; M.visited = Object.create(null); M.visited[cellKey(M.start.x, M.start.y)] = true;
    M.mistakes = 0; M.shield = M.maxShield; M.flash = 0; M.reveal = 0;
    // 先给电视端一个很短、静止的符文映射窗口；隐藏后才开放移动，
    // 避免把玩法退化成边看释义边走向答案。
    M.phase = "preview"; M.phaseUntil = M.simTime + (reducedMotion() ? 0.5 : 0.9); blockCarriedKeys();
    setText("mm-word", target.w); setText("mm-phon", target.p ? phonetic(target.p) : "");
    setCallout("收集全部回声,然后走进与单词相符的传送门", "good");
    renderPortals(); updateHud();
    try { if (typeof speak === "function") speak(target.w); } catch (e) { }
  }

  function updateHud() {
    setText("mm-round", Math.min(M.round + 1, M.total) + " / " + M.total);
    setText("mm-score", M.score); setText("mm-combo", M.combo > 1 ? "×" + M.combo : String(M.combo));
    var shield = ""; for (var i = 0; i < M.maxShield; i++) shield += i < M.shield ? "◆" : "◇";
    setText("mm-shield", shield);
  }
  function setCallout(text, kind) {
    var el = byId("mm-callout"); if (!el) return;
    el.textContent = text; el.className = "mm-callout" + (kind ? " " + kind : "");
  }
  function renderPortals() {
    var host = byId("mm-portals"); if (!host) return; host.innerHTML = "";
    for (var i = 0; i < M.options.length; i++) {
      var card = document.createElement("div"), portal = M.portals[i], near = portal && Math.abs(portal.x - M.player.x) + Math.abs(portal.y - M.player.y) <= 2;
      card.className = "mm-portal-card" + (near ? " near" : "") + (portal && portal.sealed ? " sealed" : "");
      card.style.setProperty("--portal", PORTAL_COLORS[i]);
      var dot = document.createElement("i"), copy = document.createElement("div"), title = document.createElement("b"), small = document.createElement("small");
      // v6.4:门牌释义常驻显示 —— "背符文"设计让玩家云里雾里,现在看着走即可。
      var revealMeaning = true;
      title.textContent = revealMeaning ? M.options[i].m : (GATE_GLYPHS[i] + " · 未知回声");
      small.textContent = String.fromCharCode(65 + i) + " · " + (portal && portal.sealed ? "SEALED · 已记录" : (near ? "NEAR · 踏入判定" : GATE_GLYPHS[i] + " · 释义"));
      copy.appendChild(title); copy.appendChild(small); card.appendChild(dot); card.appendChild(copy); host.appendChild(card);
    }
  }

  function resizeCanvas() {
    if (!M.canvas || !M.ctx) return false;
    var rect = M.canvas.getBoundingClientRect(), width = Math.max(640, Math.round(rect.width || window.innerWidth || 1280)), height = Math.max(360, Math.round(rect.height || window.innerHeight || 720));
    var normalScale = width >= 3000 ? 0.58 : (width >= 1700 ? 0.9 : 1);
    M.scale = M.degraded ? normalScale * 0.76 : normalScale;
    var pixelWidth = Math.max(640, Math.round(width * M.scale)), pixelHeight = Math.max(360, Math.round(height * M.scale));
    if (M.canvas.width !== pixelWidth || M.canvas.height !== pixelHeight) { M.canvas.width = pixelWidth; M.canvas.height = pixelHeight; }
    M.width = pixelWidth; M.height = pixelHeight;
    var top = height * M.scale * 0.19, bottom = height * M.scale * 0.19, side = width * M.scale * 0.07;
    M.cell = Math.max(18, Math.min((M.width - side * 2) / COLS, (M.height - top - bottom) / ROWS));
    M.mapX = (M.width - M.cell * COLS) / 2; M.mapY = top + Math.max(0, (M.height - top - bottom - M.cell * ROWS) / 2);
    return true;
  }

  function roundedRect(ctx, x, y, w, h, radius) {
    var r = Math.min(radius, w / 2, h / 2); ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function mapCenter(x, y) { return { x: M.mapX + (x + 0.5) * M.cell, y: M.mapY + (y + 0.5) * M.cell }; }
  function drawBackground(ctx, time) {
    var bg = ctx.createLinearGradient(0, 0, 0, M.height); bg.addColorStop(0, "#102f38"); bg.addColorStop(0.56, "#315d57"); bg.addColorStop(1, "#152f34");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, M.width, M.height);
    ctx.save(); ctx.globalAlpha = 0.2;
    for (var i = 0; i < 24; i++) {
      var x = ((i * 137 + time * (4 + i % 4)) % (M.width + 80)) - 40, y = (i * 83) % M.height;
      ctx.fillStyle = i % 3 ? "#d6e9d5" : "#f0d68e"; ctx.beginPath(); ctx.arc(x, y, 0.8 + (i % 3) * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawMaze(ctx, time) {
    var c = M.cell, mapW = c * COLS, mapH = c * ROWS;
    ctx.save(); ctx.translate(0, Math.sin(time * 0.00045) * c * 0.018);
    roundedRect(ctx, M.mapX - c * 0.16, M.mapY - c * 0.16, mapW + c * 0.32, mapH + c * 0.32, c * 0.28);
    ctx.fillStyle = "rgba(8,31,34,.62)"; ctx.fill(); ctx.strokeStyle = "rgba(229,238,211,.16)"; ctx.lineWidth = Math.max(1, c * 0.025); ctx.stroke();

    ctx.fillStyle = "#315b55";
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) if (M.grid[y] && M.grid[y][x] === 0) {
      ctx.fillRect(M.mapX + x * c + c * 0.045, M.mapY + y * c + c * 0.045, c * 0.91, c * 0.91);
    }
    if (M.trail.length > 1) {
      ctx.beginPath();
      for (var t = Math.max(0, M.trail.length - 28); t < M.trail.length; t++) {
        var pt = mapCenter(M.trail[t].x, M.trail[t].y); if (t === Math.max(0, M.trail.length - 28)) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = "rgba(237,216,143,.33)"; ctx.lineWidth = c * 0.11; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    }

    for (var wy = 0; wy < ROWS; wy++) for (var wx = 0; wx < COLS; wx++) if (!M.grid[wy] || M.grid[wy][wx] !== 0) {
      var bx = M.mapX + wx * c, by = M.mapY + wy * c;
      ctx.fillStyle = "rgba(3,20,23,.34)"; ctx.fillRect(bx + c * 0.09, by + c * 0.12, c * 0.88, c * 0.86);
      ctx.fillStyle = "#173a3c"; roundedRect(ctx, bx + c * 0.035, by + c * 0.02, c * 0.9, c * 0.82, c * 0.11); ctx.fill();
      ctx.fillStyle = "rgba(143,190,168,.16)"; ctx.fillRect(bx + c * 0.09, by + c * 0.07, c * 0.78, c * 0.075);
    }

    for (var s = 0; s < M.shards.length; s++) if (!M.shards[s].taken) {
      var shard = M.shards[s], sp = mapCenter(shard.x, shard.y), size = c * (0.13 + Math.sin(time * 0.004 + s) * 0.018);
      ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(time * 0.0018 + s); ctx.shadowColor = "#efd58a"; ctx.shadowBlur = c * 0.24; ctx.fillStyle = "#f5dfa0";
      ctx.beginPath(); ctx.moveTo(0, -size * 1.5); ctx.lineTo(size, 0); ctx.lineTo(0, size * 1.5); ctx.lineTo(-size, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    }

    for (var p = 0; p < M.portals.length; p++) {
      var portal = M.portals[p], pp = mapCenter(portal.x, portal.y), pulse = 1 + Math.sin(time * 0.004 + p * 2) * 0.09;
      ctx.save(); ctx.translate(pp.x, pp.y); ctx.globalAlpha = portal.sealed ? 0.25 : 0.94; ctx.strokeStyle = PORTAL_COLORS[p]; ctx.lineWidth = c * 0.07; ctx.shadowColor = PORTAL_COLORS[p]; ctx.shadowBlur = c * (M.reveal > 0 ? 0.34 : 0.24);
      ctx.beginPath(); ctx.ellipse(0, 0, c * 0.29 * pulse, c * 0.16 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, c * 0.08, 0, Math.PI * 2); ctx.fillStyle = PORTAL_COLORS[p]; ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = "#f9faee"; ctx.font = "700 " + Math.max(10, c * 0.23) + "px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String.fromCharCode(65 + p), 0, -c * 0.31); ctx.restore();
    }

    var mp = mapCenter(M.monster.px, M.monster.py), monsterPulse = 1 + Math.sin(time * 0.006) * 0.08;
    ctx.save(); ctx.translate(mp.x, mp.y); ctx.shadowColor = "#df6f68"; ctx.shadowBlur = c * 0.33; ctx.fillStyle = "rgba(124,54,54,.94)";
    ctx.beginPath(); ctx.arc(0, 0, c * 0.22 * monsterPulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#f5d8c9"; ctx.beginPath(); ctx.arc(-c * 0.07, -c * 0.035, c * 0.035, 0, Math.PI * 2); ctx.arc(c * 0.07, -c * 0.035, c * 0.035, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    var player = mapCenter(M.player.px, M.player.py), glow = 1 + Math.sin(time * 0.005) * 0.08;
    ctx.save(); ctx.translate(player.x, player.y); ctx.shadowColor = "#f4e4a6"; ctx.shadowBlur = c * 0.44; ctx.fillStyle = "#f7e9ad";
    ctx.beginPath(); ctx.moveTo(0, -c * 0.22 * glow); ctx.lineTo(c * 0.17 * glow, c * 0.13 * glow); ctx.lineTo(0, c * 0.08 * glow); ctx.lineTo(-c * 0.17 * glow, c * 0.13 * glow); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(219,240,214,.76)"; ctx.lineWidth = c * 0.035; ctx.beginPath(); ctx.ellipse(0, 0, c * 0.28 * glow, c * 0.11 * glow, -0.25, 0, Math.PI * 2); ctx.stroke(); ctx.restore();

    var fog = ctx.createRadialGradient(player.x, player.y, c * 1.2, player.x, player.y, c * 5.4);
    fog.addColorStop(0, "rgba(4,20,23,0)"); fog.addColorStop(0.58, "rgba(4,20,23,.13)"); fog.addColorStop(1, "rgba(4,20,23,.48)");
    ctx.fillStyle = fog; ctx.fillRect(M.mapX, M.mapY, mapW, mapH);
    if (M.flash > 0) { ctx.fillStyle = "rgba(196,65,63," + (M.flash * 0.28) + ")"; ctx.fillRect(M.mapX, M.mapY, mapW, mapH); }
    ctx.restore();
  }
  function render(time) {
    if (!M.ctx || !M.width || !M.height) return;
    drawBackground(M.ctx, time || 0); if (M.grid && M.grid.length) drawMaze(M.ctx, time || 0);
  }

  function collectAtPlayer() {
    for (var i = 0; i < M.shards.length; i++) {
      var shard = M.shards[i]; if (shard.taken || shard.x !== M.player.x || shard.y !== M.player.y) continue;
      shard.taken = true; M.shardCount++; M.score += 35; M.reveal = M.shardCount >= M.shards.length ? (reducedMotion() ? 0.68 : 1.35) : Math.max(M.reveal, 0.35);
      if (M.shardCount >= M.shards.length) {
        M.phase = "recall"; M.phaseUntil = M.simTime + M.reveal; blockCarriedKeys();
        setCallout("三枚回声共鸣 · 全部符文映射短暂重放（不会提示正确门）", "good");
        renderPortals();
      } else setCallout("捕获回声碎片 " + M.shardCount + " / " + M.shards.length, "good");
      try { if (typeof speak === "function" && M.current) speak(M.current.w); } catch (e) { }
      try { if (window.SFX && SFX.good) SFX.good(); } catch (e2) { }
      updateHud();
    }
  }
  function portalAt(x, y) {
    for (var i = 0; i < M.portals.length; i++) if (M.portals[i].x === x && M.portals[i].y === y) return M.portals[i];
    return null;
  }
  function loseShield(reason) {
    if (M.phase !== "run" || !ownerValid()) return;
    M.mistakes++; M.combo = 0; M.shield = Math.max(0, M.shield - 1); M.score = Math.max(0, M.score - 35); M.flash = 1;
    setCallout(reason + (M.shield ? " · 护符剩余 " + M.shield : " · 记忆守卫正在救援"), "bad");
    try { if (window.SFX && SFX.bad) SFX.bad(); } catch (e) { }
    updateHud();
    if (!M.shield) commitRound(false, "记忆守卫把你带出了迷雾");
  }
  function enterPortal(portal, previous) {
    if (!portal || portal.sealed || M.phase !== "run") return;
    if (M.shardCount < M.shards.length) {
      M.player.x = previous.x; M.player.y = previous.y;
      setCallout("传送门仍在沉睡 · 先收齐三枚回声", "bad");
      return;
    }
    if (portal.option === M.correctPortal) { commitRound(M.mistakes === 0, "找到真正含义 · " + M.current.m); return; }
    portal.sealed = true; M.player.x = previous.x; M.player.y = previous.y;
    loseShield("错误传送门已封印"); renderPortals();
  }
  function movePlayer(key) {
    var d = DIRS[key]; if (!d || M.phase !== "run") return;
    var nx = M.player.x + d[0], ny = M.player.y + d[1];
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || !M.grid[ny] || M.grid[ny][nx] !== 0) {
      setCallout("石墙挡住了道路 · 换个方向", ""); return;
    }
    var previous = { x: M.player.x, y: M.player.y };
    M.player.x = nx; M.player.y = ny; M.visited[cellKey(nx, ny)] = true; M.trail.push({ x: nx, y: ny }); if (M.trail.length > 42) M.trail.shift();
    collectAtPlayer(); var portal = portalAt(nx, ny); if (portal) enterPortal(portal, previous);
    if (M.phase === "run" && M.player.x === M.monster.x && M.player.y === M.monster.y) monsterHit();
    renderPortals();
  }
  function nextMonsterStep() {
    if (M.phase !== "run") return null;
    var start = { x: M.monster.x, y: M.monster.y }, queue = [start], head = 0, seen = Object.create(null), parent = Object.create(null);
    seen[cellKey(start.x, start.y)] = true;
    var found = null;
    while (head < queue.length) {
      var current = queue[head++];
      if (current.x === M.player.x && current.y === M.player.y) { found = current; break; }
      var next = neighbors(M.grid, current);
      for (var i = 0; i < next.length; i++) {
        var n = next[i], key = cellKey(n.x, n.y); if (seen[key]) continue;
        seen[key] = true; parent[key] = current; queue.push(n);
      }
    }
    if (!found) return null;
    var cursor = found, prev = parent[cellKey(cursor.x, cursor.y)];
    while (prev && !(prev.x === start.x && prev.y === start.y)) { cursor = prev; prev = parent[cellKey(cursor.x, cursor.y)]; }
    return cursor;
  }
  function resetMonsterFar() {
    var excluded = Object.create(null); excluded[cellKey(M.player.x, M.player.y)] = true;
    M.portals.forEach(function (p) { excluded[cellKey(p.x, p.y)] = true; });
    var far = farthestFree(M.grid, M.player, excluded); M.monster.x = M.monster.px = far.x; M.monster.y = M.monster.py = far.y; M.monster.nextAt = M.simTime + 1.8;
  }
  function monsterHit() {
    loseShield("词怪撞上 · 它被震退了,你原地继续");
    if (M.phase === "run") resetMonsterFar();
  }
  function updateMonster() {
    if (M.phase !== "run" || M.simTime < M.monster.nextAt) return;
    var dist = Math.abs(M.monster.x - M.player.x) + Math.abs(M.monster.y - M.player.y);
    var chase = dist <= 4 ? 0.95 : 0.75;
    var step;
    if (Math.random() < chase) step = nextMonsterStep();
    else { var ns = neighbors(M.grid, M.monster); step = ns.length ? ns[Math.floor(Math.random() * ns.length)] : null; }
    if (step) { M.monster.x = step.x; M.monster.y = step.y; }
    var pace = Math.max(0.62, 1.05 - M.round * 0.035 - M.shardCount * 0.06); M.monster.nextAt = M.simTime + pace;
    if (M.monster.x === M.player.x && M.monster.y === M.player.y) monsterHit();
  }

  function commitRound(perfect, message) {
    var token = M.questionToken;
    if (M.phase !== "run" || M.committedTokens[token] || !ownerValid()) return false;
    M.committedTokens[token] = true; M.phase = "feedback"; M.resolved++;
    if (perfect) { M.right++; M.combo++; M.bestCombo = Math.max(M.bestCombo, M.combo); M.score += 210 + Math.min(120, M.combo * 20); }
    else { M.combo = 0; M.score += 55; }
    try { if (typeof schedHit === "function") schedHit(M.current.w, !!perfect); } catch (e) { }
    try { if (M.ownerP === P) { P.xp += perfect ? 5 : 2; saveP(); } } catch (e2) { }
    setCallout(message + (perfect ? " · 完美记忆" : " · 已安排加密复习"), perfect ? "good" : "bad");
    try { if (window.SFX) { if (perfect && SFX.good) SFX.good(); else if (!perfect && SFX.bad) SFX.bad(); } } catch (e3) { }
    M.phaseUntil = M.simTime + 1.18; blockCarriedKeys(); updateHud();
    if (M.resolved >= M.total) commitSession();
    return true;
  }
  function commitSession() {
    if (M.sessionCommitted || M.resolved !== M.total || !ownerValid()) return false;
    M.sessionCommitted = true;
    try { if (typeof gameResult === "function") gameResult("maze", M.right, M.total, M.score); } catch (e) { }
    return true;
  }
  function showFinish() {
    if (!ownerValid()) return;
    if (!M.sessionCommitted && !commitSession()) return;
    M.phase = "finish"; cancelFrame(); M.inputGateUntil = nowMs() + 700; blockCarriedKeys();
    var acc = M.total ? Math.round(M.right * 100 / M.total) : 0;
    setText("mm-finish-title", acc === 100 ? "遗迹为你完全苏醒" : (acc >= 75 ? "星火重新连成道路" : "你带回了失落回声"));
    setText("mm-finish-stats", M.right + " / " + M.total + " 完美穿越 · " + M.score + " 星辉 · 最高连击 ×" + M.bestCombo);
    setText("mm-finish-msg", acc >= 75 ? "你不是在选择答案，而是真的走过了这段记忆。" : "走错的门已经被记忆算法标记，下次遗迹会换一条路再见。");
    var finish = byId("mm-finish"); if (finish) finish.hidden = false;
    var button = byId("mm-return"); if (button) button.classList.add("focus");
    try { if (typeof requestFocusSync === "function") requestFocusSync(); } catch (e) { }
  }

  function simulate(delta) {
    if (!ownerValid() || M.suspended) return;
    M.simTime += delta; M.flash = Math.max(0, M.flash - delta * 2.8); M.reveal = Math.max(0, M.reveal - delta);
    M.player.px += (M.player.x - M.player.px) * Math.min(1, delta * 13); M.player.py += (M.player.y - M.player.py) * Math.min(1, delta * 13);
    M.monster.px += (M.monster.x - M.monster.px) * Math.min(1, delta * 8); M.monster.py += (M.monster.y - M.monster.py) * Math.min(1, delta * 8);
    if (M.phase === "intro" && M.simTime >= M.phaseUntil) {
      var root = byId("memory-maze"); if (root) root.classList.remove("mm-intro-on"); startRound();
    } else if (M.phase === "preview" && M.simTime >= M.phaseUntil) {
      M.phase = "run"; blockCarriedKeys(); renderPortals();
      setCallout("方向键探索 · 收齐回声后凭记忆踏入符文门", "");
    } else if (M.phase === "recall" && M.simTime >= M.phaseUntil) {
      M.phase = "run"; M.reveal = 0; blockCarriedKeys(); renderPortals();
      setCallout("映射已隐藏 · 现在凭记忆选择真正含义", "");
    } else if (M.phase === "feedback" && M.simTime >= M.phaseUntil) {
      if (M.resolved >= M.total) showFinish(); else { M.round++; startRound(); }
    } else if (M.phase === "run") updateMonster();
  }
  function frame(realNow) {
    M.raf = 0;
    if (!ownerValid() || M.suspended || document.hidden || M.phase === "finish" || M.phase === "off") return;
    if (!M.lastRealTime) M.lastRealTime = realNow;
    var elapsed = clamp((realNow - M.lastRealTime) / 1000, 0, 0.1); M.lastRealTime = realNow; M.accumulator += elapsed;
    var steps = 0; while (M.accumulator >= STEP && steps < 3) { simulate(STEP); M.accumulator -= STEP; steps++; }
    if (steps >= 3) M.accumulator = 0;
    if (steps > 0) { render(realNow); M.sampleFrames++; }
    M.sampleTime += elapsed;
    if (M.sampleTime >= 3) {
      M.measuredFps = M.sampleTime ? Math.round(M.sampleFrames / M.sampleTime) : 30;
      if (M.measuredFps < 24 && !M.degraded) { M.degraded = true; resizeCanvas(); }
      M.sampleTime = 0; M.sampleFrames = 0;
    }
    M.raf = requestAnimationFrame(frame);
  }
  function startFrame() {
    if (M.raf || !ownerValid() || M.suspended || document.hidden || M.phase === "finish") return;
    M.lastRealTime = 0; M.accumulator = 0; M.raf = requestAnimationFrame(frame);
  }
  function cancelFrame() { if (M.raf) cancelAnimationFrame(M.raf); M.raf = 0; M.lastRealTime = 0; M.accumulator = 0; }

  function resetRun(prepared) {
    M.runId++; M.active = true; M.suspended = false; M.phase = "loading"; M.ownerP = P; M.ownerCur = CUR;
    M.list = prepared.list; M.bank = prepared.bank; M.total = prepared.list.length; M.round = 0; M.resolved = 0;
    M.right = 0; M.score = 0; M.combo = 0; M.bestCombo = 0; M.shield = M.maxShield; M.mistakes = 0;
    M.questionToken = 0; M.committedTokens = Object.create(null); M.sessionCommitted = false; M.current = null;
    M.signalAt = { LEFT: 0, RIGHT: 0, UP: 0, DOWN: 0, OK: 0 }; M.acceptedAt = { LEFT: 0, RIGHT: 0, UP: 0, DOWN: 0, OK: 0 }; M.blockedKeys = Object.create(null);
    M.simTime = 0; M.phaseUntil = 0; M.inputGateUntil = nowMs() + 700; M.sampleTime = 0; M.sampleFrames = 0; M.measuredFps = 30; M.degraded = false;
    cancelFrame();
    var finish = byId("mm-finish"); if (finish) finish.hidden = true;
    var button = byId("mm-return"); if (button) button.classList.remove("focus");
    var root = byId("memory-maze"); if (root) root.classList.add("mm-intro-on");
    setText("mm-word", "LEXORIA"); setText("mm-phon", "正在重写今日遗迹"); setText("mm-round", "1 / " + M.total); setText("mm-score", 0); setText("mm-combo", 0); setText("mm-shield", "◆◆◆");
    var portals = byId("mm-portals"); if (portals) portals.innerHTML = "";
  }
  function open() {
    if (!installUi()) { try { toast("当前电视无法创建遗迹画布"); } catch (e) { } return false; }
    var prepared = prepareRun(); if (!prepared) { try { toast("训练词源词量不足 8 个,可到设置调整「训练词源」"); } catch (e2) { } return false; }
    M.returnScreen = typeof SCREEN === "string" && SCREEN !== "memory-maze" ? SCREEN : "world";
    resetRun(prepared); show("memory-maze"); resizeCanvas();
    M.phase = "intro"; M.phaseUntil = reducedMotion() ? 0.28 : 1.05; setCallout("遗迹正在生成新的道路", ""); render(nowMs()); startFrame();
    return true;
  }
  function pause() { if (!M.active || M.suspended) return; M.suspended = true; cancelFrame(); try { if (NativeBridge && NativeBridge.stopSpeak) NativeBridge.stopSpeak(); } catch (e) { } }
  function resume() { if (!M.active || !M.suspended || document.hidden || !ownerValid()) return; M.suspended = false; resizeCanvas(); startFrame(); }
  function stop() { M.runId++; M.active = false; M.suspended = true; M.phase = "off"; M.ownerP = null; M.ownerCur = null; cancelFrame(); }
  function abortToReturn(message, guardKey) {
    var target = M.returnScreen || "world"; M.runId++; M.active = false; M.suspended = true; M.phase = "off"; cancelFrame(); M.ownerP = null; M.ownerCur = null;
    if (message) try { toast(message); } catch (e) { }
    try { if (typeof armTvCarryGuard === "function" && guardKey) armTvCarryGuard(guardKey, 700); } catch (e2) { }
    if (target === "world" && window.WordWorld && typeof WordWorld.open === "function") WordWorld.open(); else show(target === "memory-maze" ? "arcade" : target);
  }

  function key(k) {
    if (!M.active || !ownerValid()) return;
    var signal = nowMs(), guarded = Object.prototype.hasOwnProperty.call(M.signalAt, k), previous = guarded ? M.signalAt[k] : 0;
    if (guarded) M.signalAt[k] = signal;
    if (M.phase === "finish") {
      if (k === "BACK" && signal >= M.inputGateUntil) abortToReturn("", "BACK");
      else if (k === "OK" && signal >= M.inputGateUntil && (!previous || signal - previous >= 400)) abortToReturn("", "OK");
      return;
    }
    if (k === "BACK") { abortToReturn("已撤离遗迹，未完成的词不会结算", "BACK"); return; }
    if (k === "PLAY" || k === "MENU") { if (M.current) try { speak(M.current.w); } catch (e) { } return; }
    if (M.suspended || document.hidden || M.phase !== "run" || !guarded) return;
    if (M.blockedKeys[k]) {
      if (previous && signal - previous < 400) return;
      delete M.blockedKeys[k];
    }
    if (k === "OK") { if (signal - (M.acceptedAt.OK || 0) < 420) return; M.acceptedAt.OK = signal; if (M.current) try { speak(M.current.w); } catch (e2) { } setCallout("目标回声再次响起", ""); return; }
    if (!DIRS[k] || signal - (M.acceptedAt[k] || 0) < 92) return;
    M.acceptedAt[k] = signal; movePlayer(k);
  }

  function benchmark() {
    return {
      active: M.active, phase: M.phase, fps: M.measuredFps, renderScale: M.scale, degraded: M.degraded,
      round: M.round + 1, resolved: M.resolved, right: M.right, score: M.score, shield: M.shield,
      questionToken: M.questionToken, committedCount: Object.keys(M.committedTokens).length,
      sessionCommitted: M.sessionCommitted, drawMode: "canvas2d", gridSize: COLS + "x" + ROWS,
      grid: M.grid.map(function (row) { return row.join(""); }), player: { x: M.player.x, y: M.player.y },
      monster: { x: M.monster.x, y: M.monster.y }, correctPortal: M.correctPortal,
      portals: M.portals.map(function (p) { return { x: p.x, y: p.y, option: p.option, sealed: p.sealed }; }),
      shards: M.shards.map(function (s) { return { x: s.x, y: s.y, taken: s.taken }; })
    };
  }
  function dispose() {
    stop();
    var root = byId("memory-maze"), style = byId("memory-maze-style");
    if (root && root.parentNode) root.parentNode.removeChild(root); if (style && style.parentNode) style.parentNode.removeChild(style);
    M.canvas = null; M.ctx = null; M.grid = []; M.portals = []; M.shards = [];
  }

  if (!installUi()) { /* `open()` will retry after the document is ready. */ }
  window.MemoryMaze = { open: open, pause: pause, resume: resume, stop: stop, key: key, benchmark: benchmark, dispose: dispose };
  handlers["memory-maze"] = { enter: function () { resizeCanvas(); }, key: key };
  window.addEventListener("resize", function () { if (M.active) { resizeCanvas(); render(nowMs()); } });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else resume(); });
  window.addEventListener("pagehide", pause); window.addEventListener("blur", pause); window.addEventListener("focus", resume);
}());
