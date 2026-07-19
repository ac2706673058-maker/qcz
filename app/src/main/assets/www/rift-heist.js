/* ======================================================================
   LexTV · 记忆裂隙 / ECHO HEIST

   A low-cost, original Canvas2D roguelite layer.  The player explores a
   living maze, steals echo shards, chooses a route, and opens one of three
   rune gates from memory.  The game is intentionally not a quiz card: the
   word decision is embedded in movement, risk and consequence.

   The route/room idea is informed by the MIT-licensed Truncate word game
   (rules inspiration only; no code, assets or dictionary data are copied):
   https://github.com/TruncateGame/Truncate
   ====================================================================== */
"use strict";
(function () {
  var COLS = 17, ROWS = 9, FIXED = 1 / 30, MAX_PARTICLES = 42;
  var DIRS = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] };
  var GATE_GLYPHS = ["◈", "✧", "⌁"];
  var GATE_COLORS = ["#8ee2d0", "#f3d58d", "#b8a9f2"];
  var E = {
    active: false, suspended: false, phase: "off", runId: 0,
    ownerP: null, ownerCur: null, returnScreen: "arcade",
    bank: [], list: [], round: 0, total: 0, target: null, options: [],
    grid: [], gates: [], correctGate: -1, sealed: [], shards: [], shardCount: 0,
    player: { x: 1, y: 1, drawX: 1, drawY: 1 },
    enemy: { x: 13, y: 7, drawX: 13, drawY: 7, nextAt: 0, speed: 0.54 },
    hunter: null, boss: false,
    shield: 3, maxShield: 3, score: 0, combo: 0, right: 0, solved: 0,
    mistakes: 0, roundMistake: false, resolvedRound: false, routeIndex: 0,
    routeMode: 0, routeMultiplier: 1, rng: null, seed: 0,
    particles: [], stars: [], trail: [],
    canvas: null, ctx: null, cw: 0, ch: 0, scale: 1,
    map: { x: 0, y: 0, w: 0, h: 0, cell: 0 },
    raf: 0, lastFrame: 0, accumulator: 0, simTime: 0,
    introTimer: 0, resumeTimer: 0, inputAt: Object.create(null),
    scanUntil: 0, scanVisible: false,
    acceptedAt: Object.create(null), measuredFps: 30, sampleTime: 0, sampleFrames: 0,
    lastOutcome: "", sessionCommitted: false, pausedByBlur: false
  };

  function byId(id) { return document.getElementById(id); }
  function nowMs() {
    try { return window.performance && performance.now ? performance.now() : Date.now(); }
    catch (e) { return Date.now(); }
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function text(id, value) { var el = byId(id); if (el) el.textContent = String(value == null ? "" : value); }
  function normal(value) {
    var s = String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
    try { return s.normalize("NFKC"); } catch (e) { return s; }
  }
  function esc(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }
  function hash(value) {
    var h = 2166136261 >>> 0, s = String(value || "");
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var n = seed >>> 0;
    return function () {
      n += 0x6D2B79F5;
      var t = n;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(source, random) {
    var out = source.slice(), r = random || Math.random;
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
  function cellKey(x, y) { return x + ":" + y; }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }
  function ownerValid() {
    try { return E.active && E.ownerP === P && E.ownerCur === CUR && SCREEN === "echo-heist"; }
    catch (e) { return false; }
  }
  function playSfx(name) {
    try { if (window.SFX && typeof SFX[name] === "function") SFX[name](); } catch (e) { }
  }
  function speakWord(value) {
    try {
      if (typeof nativeSpeak === "function") nativeSpeak(value);
      else if (typeof speak === "function") speak(value);
    } catch (e) { }
  }

  function installUi() {
    if (byId("echo-heist")) return true;
    var app = byId("app"); if (!app) return false;
    var style = document.createElement("style");
    style.id = "echo-heist-style";
    style.textContent = [
      "#echo-heist{display:none;padding:0;overflow:hidden;isolation:isolate;background:#090d1b;color:#f5f6ff}",
      "#echo-heist.active{display:flex;animation:eh-in .32s cubic-bezier(.18,.78,.2,1)}",
      "@keyframes eh-in{from{opacity:0;transform:scale(1.012)}to{opacity:1;transform:none}}",
      "#eh-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;outline:0}",
      ".eh-vignette{position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgba(4,7,20,.5),transparent 22%,transparent 72%,rgba(4,7,18,.8)),radial-gradient(ellipse at 45% 48%,transparent 38%,rgba(4,7,19,.5) 100%)}",
      ".eh-top{position:absolute;z-index:4;left:4.2vw;right:4.2vw;top:3.2vh;display:flex;align-items:flex-start;justify-content:space-between;pointer-events:none}",
      ".eh-brand{display:grid;grid-template-columns:auto auto;column-gap:1.15vmin;align-items:center;text-shadow:0 .25vmin 1.2vmin rgba(0,0,0,.35)}",
      ".eh-mark{grid-row:1/span 2;width:5.9vmin;height:5.9vmin;display:grid;place-items:center;border:.12vmin solid rgba(255,255,255,.46);border-radius:1.8vmin;color:#121734;background:linear-gradient(145deg,#f1d994,#8ed9cf);font:850 2.7vmin/1 Inter,sans-serif;box-shadow:inset 0 .15vmin .15vmin rgba(255,255,255,.65),0 .8vmin 2.5vmin rgba(0,0,0,.25)}",
      ".eh-brand b{font-size:2.7vmin;letter-spacing:.08em}.eh-brand small{font:650 1.35vmin/1.1 Inter,sans-serif;letter-spacing:.26em;color:rgba(224,231,255,.64)}",
      ".eh-hud{display:grid;grid-template-columns:repeat(4,minmax(9.2vmin,auto));gap:.7vmin;padding:.55vmin;border:.1vmin solid rgba(214,224,255,.22);border-radius:1.65vmin;background:rgba(14,20,43,.82);box-shadow:0 .7vmin 2.1vmin rgba(0,0,0,.22)}",
      ".eh-stat{min-width:8.8vmin;padding:.5vmin .9vmin;border-radius:1.1vmin;text-align:center;background:rgba(226,235,255,.07)}.eh-stat small{display:block;font-size:1.35vmin;letter-spacing:.1em;color:rgba(218,228,255,.62)}.eh-stat b{display:block;margin-top:.24vmin;font:780 2.05vmin/1 Inter,'PingFang SC',sans-serif;color:#fff}.eh-stat.shield b{color:#f2d991;letter-spacing:.08em}",
      ".eh-side{position:absolute;z-index:4;right:4.2vw;top:16.5vh;width:min(31vw,48vmin);pointer-events:none}",
      ".eh-kicker{font:750 1.35vmin/1 Inter,sans-serif;letter-spacing:.3em;color:#9adbd2}.eh-target{margin-top:.8vmin;padding:1.45vmin 1.55vmin 1.55vmin;border:.1vmin solid rgba(205,218,255,.25);border-radius:1.9vmin;background:rgba(15,23,50,.84);box-shadow:0 .9vmin 2.4vmin rgba(0,0,0,.2)}",
      ".eh-target small{display:block;font-size:1.55vmin;color:rgba(218,228,255,.62);letter-spacing:.18em}.eh-target b{display:block;margin-top:.6vmin;font:850 5.8vmin/.95 Inter,'PingFang SC',sans-serif;letter-spacing:-.04em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.eh-target span{display:block;margin-top:.7vmin;color:#c0cae8;font:650 2vmin/1.2 Inter,sans-serif}",
      ".eh-meaning{margin-top:1.1vmin;padding:1.25vmin 1.45vmin 1.4vmin;border-left:.38vmin solid #f2d991;color:#eef1ff;background:rgba(13,19,42,.82);font-size:2.15vmin;line-height:1.35;min-height:20vmin}.eh-meaning> b{display:block;color:#f2d991;font-size:1.55vmin;letter-spacing:.13em;margin-bottom:.65vmin}.eh-rune-guide{display:block;margin-bottom:.8vmin;color:#dbe3ff;font:650 1.65vmin/1.35 'PingFang SC','Noto Sans SC',sans-serif}.eh-rune-list{display:grid;gap:.62vmin}.eh-rune-row{display:grid;grid-template-columns:6.1vmin minmax(0,1fr);align-items:center;gap:1vmin;min-height:5.9vmin}.eh-rune-ring{--rune:#8ee2d0;position:relative;width:5.4vmin;height:5.4vmin;display:grid;place-items:center;border:.28vmin solid transparent;border-top-color:var(--rune);border-right-color:var(--rune);border-bottom-color:var(--rune);border-radius:50%;color:var(--rune);filter:drop-shadow(0 0 .5vmin var(--rune))}.eh-rune-ring:before{content:'';position:absolute;inset:.66vmin;border:.22vmin solid var(--rune);border-radius:50%;opacity:.92}.eh-rune-glyph{position:relative;z-index:1;font:850 2.5vmin/1 Inter,sans-serif;color:var(--rune)}.eh-rune-copy{font:760 2.35vmin/1.15 Inter,'PingFang SC','Noto Sans SC',sans-serif;color:#fff;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}.eh-room{margin-top:.9vmin;color:rgba(226,233,255,.78);font-size:1.7vmin;line-height:1.4}.eh-log{margin-top:.8vmin;min-height:4.5vmin;color:#aebfe5;font-size:1.7vmin;line-height:1.4}",
      ".eh-bottom{position:absolute;z-index:4;left:4.3vw;right:4.3vw;bottom:3.6vh;display:flex;justify-content:space-between;align-items:center;color:rgba(220,229,255,.72);font-size:1.55vmin;letter-spacing:.04em;pointer-events:none}.eh-bottom b{display:inline-block;margin:0 .35vmin;padding:.18vmin .62vmin;border:.1vmin solid rgba(220,229,255,.32);border-radius:.55vmin;color:#f5f6ff}",
      ".eh-overlay{position:absolute;z-index:8;inset:0;display:grid;place-items:center;text-align:center;background:radial-gradient(circle at 50% 43%,rgba(83,119,223,.16),rgba(6,10,27,.78) 58%,rgba(4,7,18,.94));opacity:1}.eh-overlay[hidden]{display:none!important}",
      ".eh-intro-copy{position:relative;width:min(88vmin,72vw);padding:4vmin}.eh-intro-copy:before,.eh-intro-copy:after{content:'';position:absolute;left:50%;top:50%;border:.12vmin solid rgba(145,221,215,.32);border-radius:50%;pointer-events:none}.eh-intro-copy:before{width:58vmin;height:58vmin;margin:-29vmin;animation:eh-orbit 11s linear infinite}.eh-intro-copy:after{width:40vmin;height:40vmin;margin:-20vmin;border-color:rgba(242,217,145,.25);animation:eh-orbit 7s linear infinite reverse}@keyframes eh-orbit{to{transform:rotate(360deg)}}",
      ".eh-intro-copy small{position:relative;font:760 1.5vmin/1 Inter,sans-serif;letter-spacing:.46em;color:#a7e0d5}.eh-intro-copy h1{position:relative;margin-top:1.2vmin;font:850 9.4vmin/.88 Inter,'PingFang SC',sans-serif;letter-spacing:-.06em;color:#fff;text-shadow:0 .5vmin 2.2vmin rgba(82,145,230,.38)}.eh-intro-copy h1 em{font-style:normal;color:#f2d991}.eh-intro-copy p{position:relative;margin-top:1.6vmin;color:#d8e0fa;font-size:2.2vmin;letter-spacing:.12em}.eh-intro-copy .eh-intro-meta{position:relative;margin-top:2.5vmin;color:rgba(213,225,255,.58);font:600 1.35vmin/1 Inter,sans-serif;letter-spacing:.22em}",
      ".eh-review-card,.eh-route-card,.eh-finish-card{width:min(84vmin,66vw);padding:3.1vmin 4.2vmin;border:.1vmin solid rgba(211,222,255,.3);border-radius:2.5vmin;background:rgba(13,21,47,.94);box-shadow:0 1.8vmin 5vmin rgba(0,0,0,.35)}.eh-review-kicker,.eh-finish-kicker{font:760 1.35vmin/1 Inter,sans-serif;letter-spacing:.34em;color:#9ddbd1}.eh-review-card h2{margin-top:1vmin;font:820 5.6vmin/.98 Inter,'PingFang SC',sans-serif;color:#fff}.eh-review-card .eh-review-meaning{margin-top:1.2vmin;font-size:2.5vmin;color:#f2d991}.eh-review-card .eh-review-ex{margin:1.25vmin auto 0;max-width:66vmin;color:#c4cee9;font-size:1.8vmin;line-height:1.55}.eh-review-card button,.eh-finish-card button{min-width:30vmin;min-height:6.2vmin;margin-top:2.1vmin;border:.13vmin solid #f2d991;border-radius:1.45vmin;background:#f2d991;color:#17203c;font:780 2.05vmin/1 Inter,'PingFang SC',sans-serif;outline:0;transition:transform .1s cubic-bezier(.2,.86,.25,1.2),box-shadow .1s}.eh-review-card button.focus,.eh-finish-card button.focus{transform:translateY(-.35vmin) scale(1.045);box-shadow:0 0 0 .25vmin #fff,0 0 0 .58vmin rgba(242,217,145,.68),0 1vmin 2.4vmin rgba(0,0,0,.3)}",
      ".eh-route-wrap{width:min(90vmin,70vw)}.eh-route-wrap h2{margin-top:1vmin;font:820 5.2vmin/.98 Inter,'PingFang SC',sans-serif}.eh-route-wrap>p{margin-top:.9vmin;color:#b8c4e7;font-size:1.8vmin}.eh-route-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.3vmin;margin-top:2.1vmin}.eh-route-card{width:auto;min-height:18vmin;padding:2.1vmin 2.2vmin;text-align:left;transition:transform .1s,border-color .1s,background .1s}.eh-route-card h3{font-size:2.45vmin;color:#fff}.eh-route-card p{margin-top:.8vmin;color:#aebbe0;font-size:1.6vmin;line-height:1.45}.eh-route-card .eh-route-key{display:inline-block;margin-top:1.25vmin;color:#f2d991;font:750 1.35vmin/1 Inter,sans-serif;letter-spacing:.16em}.eh-route-card.focus{border-color:#f2d991;background:rgba(39,49,88,.98);transform:translateY(-.45vmin) scale(1.035);box-shadow:0 0 0 .22vmin rgba(242,217,145,.7),0 1.2vmin 3vmin rgba(0,0,0,.3)}",
      ".eh-finish-card h2{margin-top:1vmin;font:830 6.1vmin/.98 Inter,'PingFang SC',sans-serif;color:#fff}.eh-finish-stats{margin-top:1.4vmin;font-size:2.4vmin;color:#f2d991}.eh-finish-card p{margin:1.1vmin auto 0;color:#bbc7e7;font-size:1.8vmin;line-height:1.5}",
      "html.eye #echo-heist{filter:saturate(.78) brightness(.98)}html.eye #echo-heist .eh-target,html.eye #echo-heist .eh-hud{background:rgba(31,38,61,.9)}",
      "@media(max-width:1300px){.eh-side{right:3.5vw;width:min(31vw,48vmin)}.eh-target b{font-size:5.45vmin}.eh-hud{grid-template-columns:repeat(4,minmax(8vmin,auto))}.eh-route-card h3{font-size:2.15vmin}}",
      "@media(prefers-reduced-motion:reduce){#echo-heist.active,.eh-intro-copy:before,.eh-intro-copy:after{animation:none!important}.eh-route-card,.eh-review-card button,.eh-finish-card button{transition-duration:.01ms!important}}"
    ].join("");
    document.head.appendChild(style);
    var root = document.createElement("div");
    root.className = "screen"; root.id = "echo-heist"; root.setAttribute("aria-label", "记忆裂隙");
    root.innerHTML = ''
      + '<canvas id="eh-canvas" aria-label="实时记忆裂隙地图"></canvas><div class="eh-vignette"></div>'
      + '<div class="eh-top"><div class="eh-brand"><span class="eh-mark">◈</span><b>记忆裂隙</b><small>ECHO HEIST · LEXTV ORIGINAL</small></div>'
      + '<div class="eh-hud"><div class="eh-stat"><small>房间</small><b id="eh-round">1 / 6</b></div><div class="eh-stat"><small>回声</small><b id="eh-score">0</b></div><div class="eh-stat"><small>夺回</small><b id="eh-shards">0 / 3</b></div><div class="eh-stat shield"><small>护盾</small><b id="eh-shield">◆◆◆</b></div></div></div>'
      + '<div class="eh-side"><div class="eh-kicker">TARGET MEMORY</div><div class="eh-target"><small>正在追踪的词</small><b id="eh-word">—</b><span id="eh-phon">—</span></div><div class="eh-meaning" id="eh-meaning"><b id="eh-meaning-kicker">裂隙规则</b><div id="eh-meaning-text">先看目标词，再对照中文，最后走进地图中相同的圆环符文门。</div></div><div class="eh-room" id="eh-room">每次选择都会改变下一间房。</div><div class="eh-log" id="eh-log"></div></div>'
      + '<div class="eh-bottom"><span id="eh-phase">方向键移动 · OK 夺取符文门 · 返回撤离</span><span><b>方向键</b>移动 <b>OK</b>交互 <b>返回</b>撤离</span></div>'
      + '<div class="eh-overlay" id="eh-intro"><div class="eh-intro-copy"><small>A LEXTV ORIGINAL · MEMORY RIFT</small><h1>ECHO <em>HEIST</em></h1><p>不是答题，是把记忆从裂隙里夺回来</p><div class="eh-intro-meta">方向键潜入 · 收集回声 · 亲自决定出口</div></div></div>'
      + '<div class="eh-overlay" id="eh-review" hidden><div class="eh-review-card"><div class="eh-review-kicker" id="eh-review-kicker">ECHO RECOVERED</div><h2 id="eh-review-word">word</h2><div class="eh-review-meaning" id="eh-review-meaning">meaning</div><div class="eh-review-ex" id="eh-review-ex">example</div><button id="eh-review-next" type="button">OK · 继续潜入</button></div></div>'
      + '<div class="eh-overlay" id="eh-route" hidden><div class="eh-route-wrap"><div class="eh-review-kicker">ROUTE FORGED BY MEMORY</div><h2>下一间房，走哪条？</h2><p>这不是正确答案，而是你的风险选择。路线会改变敌人的速度与回声奖励。</p><div class="eh-route-cards" id="eh-route-cards"></div></div></div>'
      + '<div class="eh-overlay" id="eh-finish" hidden><div class="eh-finish-card"><div class="eh-finish-kicker">RIFT SEALED · MEMORY RETURNED</div><h2 id="eh-finish-title">裂隙已封存</h2><div class="eh-finish-stats" id="eh-finish-stats"></div><p id="eh-finish-msg"></p><button id="eh-finish-next" type="button">OK · 返回训练馆</button></div></div>';
    app.appendChild(root);
    E.canvas = byId("eh-canvas");
    try { E.ctx = E.canvas.getContext("2d", { alpha: false }); } catch (e) { E.ctx = null; }
    if (!E.ctx) try { E.ctx = E.canvas.getContext("2d"); } catch (e2) { E.ctx = null; }
    return !!E.ctx;
  }

  function prepareBank() {
    var raw = [], all = [];
    try { raw = typeof activeWords === "function" ? activeWords() : []; } catch (e) { raw = []; }
    var seen = Object.create(null);
    for (var i = 0; i < raw.length; i++) {
      var item = raw[i], key = item && normal(item.w);
      if (!key || seen[key] || !normal(item.m)) continue;
      seen[key] = true; all.push(item);
    }
    var meaningCount = Object.create(null);
    for (var mi = 0; mi < all.length; mi++) meaningCount[normal(all[mi].m)] = true;
    if (all.length < 3 || Object.keys(meaningCount).length < 3) return null;
    var due = [], weak = [], unseen = [];
    try { due = typeof dueWords === "function" ? dueWords() : []; } catch (e2) { }
    try { weak = typeof weakWords === "function" ? weakWords() : []; } catch (e3) { }
    for (var j = 0; j < all.length; j++) {
      var rec = P && P.words ? P.words[all[j].w] : null;
      if (!rec || !rec.st) unseen.push(all[j]);
    }
    var byKey = Object.create(null);
    for (var b = 0; b < all.length; b++) byKey[normal(all[b].w)] = all[b];
    function map(source) {
      var out = [];
      for (var k = 0; k < source.length; k++) { var x = byKey[normal(source[k] && source[k].w)]; if (x) out.push(x); }
      return out;
    }
    var selected = [], used = Object.create(null);
    function add(source, limit) {
      var count = 0;
      for (var n = 0; n < source.length && count < limit; n++) {
        var x = source[n], key = normal(x && x.w);
        if (!x || !key || used[key]) continue;
        used[key] = true; selected.push(x); count++;
      }
    }
    add(map(due), 3); add(map(weak), 3); add(shuffle(unseen, E.rng), 3); add(shuffle(all, E.rng), 8);
    if (selected.length < 3) add(shuffle(all, E.rng), 8);
    return { bank: all, list: selected.slice(0, Math.min(6, selected.length)) };
  }

  function makeGateOptions() {
    var choices = [E.target], used = Object.create(null), targetMeaning = normal(E.target && E.target.m);
    used[targetMeaning] = true;
    var pool = shuffle(E.bank, E.rng);
    for (var i = 0; i < pool.length && choices.length < 3; i++) {
      var item = pool[i], meaning = normal(item && item.m);
      if (!meaning || used[meaning]) continue;
      used[meaning] = true; choices.push(item);
    }
    if (choices.length < 3) return false;
    E.options = shuffle(choices, E.rng);
    E.correctGate = E.options.indexOf(E.target);
    return E.correctGate >= 0;
  }

  function floorCells(grid) {
    var out = [];
    for (var y = 1; y < ROWS - 1; y++) for (var x = 1; x < COLS - 1; x++) if (grid[y][x] === 0) out.push({ x: x, y: y });
    return out;
  }
  function makeMaze(random) {
    var grid = [], x, y;
    for (y = 0; y < ROWS; y++) { grid[y] = []; for (x = 0; x < COLS; x++) grid[y][x] = 1; }
    var stack = [{ x: 1, y: 1 }]; grid[1][1] = 0;
    while (stack.length) {
      var here = stack[stack.length - 1];
      var ways = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]], random).filter(function (d) {
        var nx = here.x + d[0], ny = here.y + d[1];
        return nx > 0 && nx < COLS - 1 && ny > 0 && ny < ROWS - 1 && grid[ny][nx] === 1;
      });
      if (!ways.length) { stack.pop(); continue; }
      var step = ways[0], nx = here.x + step[0], ny = here.y + step[1];
      grid[here.y + step[1] / 2][here.x + step[0] / 2] = 0; grid[ny][nx] = 0; stack.push({ x: nx, y: ny });
    }
    // v6.6:树状迷宫任意两点仅一条路,配合完美寻路的词灵=必被抓。
    // 敲掉 ~18% 隔在两块地板之间的墙,制造环路,玩家可以绕圈摆脱追击。
    for (y = 1; y < ROWS - 1; y++) {
      for (x = 1; x < COLS - 1; x++) {
        if (grid[y][x] !== 1) continue;
        var lr = grid[y][x - 1] === 0 && grid[y][x + 1] === 0;
        var ud = grid[y - 1][x] === 0 && grid[y + 1][x] === 0;
        if ((lr || ud) && !(lr && ud) && random() < 0.18) grid[y][x] = 0;
      }
    }
    return grid;
  }
  function distance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
  function makeRoom() {
    var random = E.rng, grid = makeMaze(random), cells = floorCells(grid);
    var right = cells.filter(function (p) { return p.x >= COLS - 4 && p.y % 2 === 1; });
    right = shuffle(right, random);
    var gates = [];
    for (var i = 0; i < right.length && gates.length < 3; i++) {
      if (!gates.some(function (g) { return distance(g, right[i]) < 3; })) gates.push(right[i]);
    }
    if (gates.length < 3) gates = [{ x: 15, y: 1 }, { x: 15, y: 3 }, { x: 15, y: 7 }];
    gates = gates.slice(0, 3);
    var used = Object.create(null); used[cellKey(1, 1)] = true;
    gates.forEach(function (g) { used[cellKey(g.x, g.y)] = true; });
    var shards = [], candidates = shuffle(cells, random);
    for (var s = 0; s < candidates.length && shards.length < (E.routeMode === 1 ? 4 : 3); s++) {
      var c = candidates[s];
      if (used[cellKey(c.x, c.y)] || distance(c, { x: 1, y: 1 }) < 3) continue;
      if (shards.some(function (q) { return distance(q, c) < 2; })) continue;
      used[cellKey(c.x, c.y)] = true; shards.push({ x: c.x, y: c.y, phase: random() * 6.28, got: false });
    }
    function protectedSpawn(x, y) {
      if (x === 1 && y === 1) return true;
      return gates.some(function (g) { return g.x === x && g.y === y; });
    }
    function hasHunterExit(p) {
      var names = ["LEFT", "RIGHT", "UP", "DOWN"];
      for (var hi = 0; hi < names.length; hi++) {
        var hd = DIRS[names[hi]], hx = p.x + hd[0], hy = p.y + hd[1];
        if (grid[hy] && grid[hy][hx] === 0 && !protectedSpawn(hx, hy)) return true;
      }
      return false;
    }
    // Spawn only on cells that have at least one legal way out. This prevents
    // a rare maze dead-end from pinning a spirit behind a protected rune tile.
    var enemies = shuffle(cells, random).filter(function (p) {
      return !used[cellKey(p.x, p.y)] && distance(p, { x: 1, y: 1 }) > 7 && hasHunterExit(p);
    });
    enemies.sort(function (a, b) { return distance(b, { x: 1, y: 1 }) - distance(a, { x: 1, y: 1 }); });
    var enemy = enemies[0] || cells.filter(function (p) { return !protectedSpawn(p.x, p.y) && hasHunterExit(p); })[0] || { x: 15, y: 7 };
    var hunterHome = enemies.filter(function (p) { return (p.x !== enemy.x || p.y !== enemy.y) && distance(p, enemy) >= 4; })[0]
      || enemies[1] || enemy;
    E.grid = grid; E.gates = gates; E.sealed = [false, false, false]; E.shards = shards; E.shardCount = 0;
    E.player = { x: 1, y: 1, drawX: 1, drawY: 1 };
    E.enemy = { x: enemy.x, y: enemy.y, homeX: enemy.x, homeY: enemy.y, drawX: enemy.x, drawY: enemy.y, nextAt: E.simTime + 2.2, speed: E.routeMode === 1 ? .62 : .8 };
    E.hunter = (E.boss || E.routeMode === 1) ? { x: hunterHome.x, y: hunterHome.y, homeX: hunterHome.x, homeY: hunterHome.y, drawX: hunterHome.x, drawY: hunterHome.y, nextAt: E.simTime + 3, speed: E.boss ? .88 : 1.05 } : null;
    E.trail = []; E.roundMistake = false; E.resolvedRound = false;
  }

  function layout() {
    if (!E.canvas || !E.ctx) return;
    var rect = E.canvas.getBoundingClientRect();
    E.cw = Math.max(1, rect.width || window.innerWidth || 1280);
    E.ch = Math.max(1, rect.height || window.innerHeight || 720);
    E.scale = E.cw >= 2600 ? .54 : (E.cw >= 1800 ? .72 : 1);
    E.canvas.width = Math.max(1, Math.floor(E.cw * E.scale));
    E.canvas.height = Math.max(1, Math.floor(E.ch * E.scale));
    var maxH = E.ch * .7, maxW = E.cw * .62;
    var cell = Math.min(maxW / COLS, maxH / ROWS);
    E.map.cell = cell; E.map.w = cell * COLS; E.map.h = cell * ROWS;
    E.map.x = E.cw * .055; E.map.y = E.ch * .18 + Math.max(0, (maxH - E.map.h) * .35);
    E.stars = [];
    var random = rng((E.seed || 1) ^ 0xA5A5A5A5);
    for (var i = 0; i < 74; i++) E.stars.push({ x: random() * E.cw, y: random() * E.ch, r: .25 + random() * 1.4, a: .18 + random() * .5, p: random() * 6.28 });
    if (E.ctx) E.ctx.imageSmoothingEnabled = true;
  }
  function cellCenter(p) { return { x: E.map.x + (p.x + .5) * E.map.cell, y: E.map.y + (p.y + .5) * E.map.cell }; }
  function gateAt(x, y) {
    for (var i = 0; i < E.gates.length; i++) if (E.gates[i].x === x && E.gates[i].y === y) return i;
    return -1;
  }
  function floorAt(x, y) { return !!(E.grid[y] && E.grid[y][x] === 0); }
  function updateHud() {
    text("eh-round", (Math.min(E.round + 1, E.total || 1)) + " / " + (E.total || 1));
    text("eh-score", E.score);
    text("eh-shards", E.shardCount + " / " + E.shards.length);
    var shield = "";
    for (var i = 0; i < E.maxShield; i++) shield += i < E.shield ? "◆" : "◇";
    text("eh-shield", shield);
    if (E.target) {
      text("eh-word", E.target.w || "—");
      var phon = String(E.target.p || "").trim();
      text("eh-phon", phon ? (phon.charAt(0) === "/" ? phon : "/" + phon + "/") : "听见它，记住它");
    }
  }
  function status(message, tone) {
    text("eh-log", message || "");
    var el = byId("eh-meaning");
    if (el) { el.classList.remove("eh-good", "eh-bad"); if (tone) el.classList.add("eh-" + tone); }
  }
  function phaseText(value) { text("eh-phase", value); }
  function renderGateScan(label) {
    text("eh-meaning-kicker", label || "符文扫描");
    var el = byId("eh-meaning-text"); if (!el) return;
    var rows = [];
    for (var i = 0; i < E.options.length; i++) {
      rows.push('<span class="eh-rune-row"><span class="eh-rune-ring" style="--rune:' + GATE_COLORS[i] + ';transform:rotate(' + (i * 37) + 'deg)"><span class="eh-rune-glyph" style="transform:rotate(' + (-i * 37) + 'deg)">' + GATE_GLYPHS[i] + '</span></span><span class="eh-rune-copy">' + esc(E.options[i].m) + '</span></span>');
    }
    el.innerHTML = '<span class="eh-rune-guide">目标词 → 对照中文 → 找地图里同色、同字形的圆环门，站上去按 OK</span><span class="eh-rune-list">' + rows.join("") + '</span>';
  }
  function beginGateScan(duration, label) {
    E.scanVisible = true; E.scanUntil = nowMs() + Math.max(700, duration || 2600);
    renderGateScan(label || "符文扫描 · 记住三组映射");
    phaseText("右侧是符文→释义对照 · OK 立即潜入");
  }
  /* v6.4:符文→释义对照表常驻显示(原版 2.6 秒后隐藏、逼玩家背映射,
     导致"云里雾里";现在只解除移动锁,提示牌一直留在屏上)。 */
  function endGateScan() {
    if (!E.scanVisible) return;
    E.scanVisible = false; E.scanUntil = 0;
    renderGateScan("符文对照 · 常驻显示");
    phaseText("方向键潜入 · 收集回声 · 走到与目标词相符的符文门前按 OK");
  }
  function gateScanActive() { return E.scanVisible && nowMs() < E.scanUntil; }
  function addParticle(x, y, color, count, power) {
    var random = E.rng || Math.random, n = Math.min(count || 1, MAX_PARTICLES - E.particles.length);
    for (var i = 0; i < n; i++) {
      var a = random() * Math.PI * 2, s = (power || 1) * (.35 + random() * .9);
      E.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .35 + random() * .55, max: .55 + random() * .6, color: color, size: .7 + random() * 2.4 });
    }
  }
  function addBurstAt(point, color, count, power) {
    var c = cellCenter(point); addParticle(c.x, c.y, color, count, power);
  }
  function collectShard() {
    for (var i = 0; i < E.shards.length; i++) {
      var shard = E.shards[i];
      if (!shard.got && shard.x === E.player.x && shard.y === E.player.y) {
        shard.got = true; E.shardCount++; E.score += 18;
        addBurstAt(shard, "#8ee2d0", 10, E.map.cell * .018); playSfx("collect");
        status("回声 +18 分(加分项,不必集齐)", "good");
        updateHud();
        if (E.shardCount >= E.shards.length) {
          E.score += 60; if (E.shield < E.maxShield) E.shield++;
          status("集齐全部回声!+60 分,护盾 +1", "good"); updateHud();
        }
      }
    }
  }
  function resetPlayer(reason) {
    E.player.x = 1; E.player.y = 1; E.player.drawX = 1; E.player.drawY = 1;
    E.trail = []; status(reason || "词灵擦肩而过 · 回到入口", "bad");
  }
  function hitByHunter(hunter) {
    if (E.phase !== "play" || !ownerValid()) return;
    E.shield = Math.max(0, E.shield - 1); E.combo = 0; E.mistakes++;
    var p = { x: E.player.x, y: E.player.y }; addBurstAt(p, "#f08c9d", 16, E.map.cell * .025); playSfx("bad");
    if (E.shield <= 0) {
      // 护盾耗尽不会让用户卡死：自动把当前房间判为一次困难回忆，并进入复盘。
      E.roundMistake = true; finishRound(false, "护盾耗尽 · 裂隙把你送回了回声台");
    } else {
      // v6.6:不再把玩家拖回起点 —— 词灵被震退回巢并冻结,你继续走你的
      if (hunter && hunter.homeX != null) { hunter.x = hunter.homeX; hunter.y = hunter.homeY; }
      if (hunter) hunter.nextAt = E.simTime + 2.6;
      status("词灵撞上 · 护盾 -1,它被震退回巢了", "bad");
    }
    updateHud();
  }
  function neighbors(x, y) {
    var out = [], names = ["LEFT", "RIGHT", "UP", "DOWN"];
    for (var i = 0; i < names.length; i++) {
      var d = DIRS[names[i]], nx = x + d[0], ny = y + d[1];
      if (floorAt(nx, ny)) out.push({ x: nx, y: ny });
    }
    return out;
  }
  function nextStep(from, to) {
    if (!from || !to) return from;
    var queue = [{ x: from.x, y: from.y }], came = Object.create(null), seen = Object.create(null);
    seen[cellKey(from.x, from.y)] = true;
    while (queue.length) {
      var cur = queue.shift();
      if (cur.x === to.x && cur.y === to.y) break;
      var ns = neighbors(cur.x, cur.y);
      for (var i = 0; i < ns.length; i++) {
        var key = cellKey(ns[i].x, ns[i].y);
        if (seen[key]) continue; seen[key] = true; came[key] = cur; queue.push(ns[i]);
      }
    }
    var targetKey = cellKey(to.x, to.y); if (!seen[targetKey]) return from;
    var step = { x: to.x, y: to.y }, prev = came[targetKey];
    while (prev && !(prev.x === from.x && prev.y === from.y)) { step = prev; prev = came[cellKey(prev.x, prev.y)]; }
    return step;
  }
  function safeCell(x, y) {
    // Only the exact entrance and rune tiles are protected. Protecting their
    // neighbours can trap a spirit behind a gate and make it appear frozen.
    if (x === 1 && y === 1) return true;
    for (var i = 0; i < E.gates.length; i++) {
      if (E.gates[i].x === x && E.gates[i].y === y) return true;
    }
    return false;
  }
  function moveHunter(hunter) {
    if (!hunter || E.phase !== "play") return;
    // v6.6:不再全程 BFS 完美追踪 —— 距离≤3 才穷追(85%),远处大概率游荡,
    // 玩家凭环路和安全区(入口/门的精确格)可以真正甩开它。
    var step, d = distance(hunter, E.player), roll = (E.rng || Math.random)();
    var chase = d <= 3 ? 0.85 : 0.5;
    if (roll < chase) step = nextStep(hunter, E.player);
    else {
      var ns = neighbors(hunter.x, hunter.y);
      step = ns.length ? ns[Math.floor((E.rng || Math.random)() * ns.length)] : hunter;
    }
    if (safeCell(step.x, step.y)) {
      // Keep the chase/roam decision above intact; only reroute a blocked step.
      var alternatives = neighbors(hunter.x, hunter.y).filter(function (cell) { return !safeCell(cell.x, cell.y); });
      if (!alternatives.length) return;
      if (roll < chase) {
        alternatives.sort(function (a, b) { return distance(a, E.player) - distance(b, E.player); });
        step = alternatives[0];
      } else step = alternatives[Math.floor((E.rng || Math.random)() * alternatives.length)];
    }
    hunter.x = step.x; hunter.y = step.y;
    if (hunter.x === E.player.x && hunter.y === E.player.y) hitByHunter(hunter);
  }
  function tickGame(dt) {
    E.simTime += dt;
    if (E.scanVisible) {
      if (nowMs() >= E.scanUntil) endGateScan();
      else return;
    }
    var ease = reducedMotion() ? 1 : (1 - Math.exp(-dt * 13));
    E.player.drawX += (E.player.x - E.player.drawX) * ease;
    E.player.drawY += (E.player.y - E.player.drawY) * ease;
    if (E.enemy) {
      E.enemy.drawX += (E.enemy.x - E.enemy.drawX) * ease;
      E.enemy.drawY += (E.enemy.y - E.enemy.drawY) * ease;
      if (E.simTime >= E.enemy.nextAt) { E.enemy.nextAt = E.simTime + E.enemy.speed; moveHunter(E.enemy); }
    }
    if (E.hunter) {
      E.hunter.drawX += (E.hunter.x - E.hunter.drawX) * ease;
      E.hunter.drawY += (E.hunter.y - E.hunter.drawY) * ease;
      if (E.simTime >= E.hunter.nextAt) { E.hunter.nextAt = E.simTime + E.hunter.speed; moveHunter(E.hunter); }
    }
    for (var i = E.particles.length - 1; i >= 0; i--) {
      var q = E.particles[i]; q.life -= dt; q.x += q.vx * dt * 26; q.y += q.vy * dt * 26; q.vx *= .97; q.vy *= .97;
      if (q.life <= 0) E.particles.splice(i, 1);
    }
  }
  function move(dx, dy) {
    if (E.phase !== "play" || !ownerValid() || gateScanActive()) return;
    var nx = E.player.x + dx, ny = E.player.y + dy;
    if (!floorAt(nx, ny)) { status("墙面没有回应 · 换一个方向", "bad"); return; }
    E.player.x = nx; E.player.y = ny; E.trail.push({ x: nx, y: ny, life: 1 });
    if (E.trail.length > 24) E.trail.shift();
    collectShard();
    var gate = gateAt(nx, ny);
    if (gate >= 0) {
      if (E.sealed[gate]) status("这道门已经排除 · 去另一道门", "bad");
      else status("按 OK 开门 · 对照表在右侧,选与单词相符的门", "good");
    }
  }
  function resolveGate(index) {
    if (E.phase !== "play" || !ownerValid() || index < 0 || E.sealed[index]) return;
    var good = index === E.correctGate;
    if (!good) {
      E.sealed[index] = true; E.roundMistake = true; E.combo = 0; E.shield = Math.max(0, E.shield - 1);
      addBurstAt(E.gates[index], "#f08c9d", 14, E.map.cell * .022); playSfx("bad"); updateHud();
      renderGateScan("错误符文已排除 · 三组对照仍保留");
      if (E.shield <= 0 || E.sealed.filter(Boolean).length >= 2) finishRound(false, "错误出口崩塌 · 先把这个词带回回声台");
      else { status("这道门不对 · 护盾 -1,已标记排除,去另一道门", "bad"); }
      return;
    }
    addBurstAt(E.gates[index], "#f2d991", 24, E.map.cell * .035); playSfx("win");
    finishRound(true, "记忆回应了你 · 出口被夺回");
  }
  function renderReview(message) {
    var target = E.target || {};
    text("eh-review-kicker", E.lastOutcome === "perfect" ? "ECHO RECOVERED · PERFECT" : "ECHO RECOVERED · REPAIR THE MEMORY");
    text("eh-review-word", target.w || "—"); text("eh-review-meaning", target.m || "—");
    text("eh-review-ex", target.x || "把这个词放回真实句子里，再继续潜入。");
    var btn = byId("eh-review-next"); if (btn) { btn.classList.add("focus"); btn.textContent = E.round >= E.total - 1 ? "OK · 封存裂隙" : "OK · 选择下一条路线"; }
    var panel = byId("eh-review"); if (panel) panel.hidden = false;
    text("eh-meaning-kicker", "本轮回声已复原"); text("eh-meaning-text", target.m || "");
    phaseText("回声复盘 · OK 后决定下一条路线");
  }
  function finishRound(solved, message) {
    if (E.resolvedRound || E.phase !== "play") return;
    E.resolvedRound = true; E.phase = "review"; E.solved += solved ? 1 : 0;
    if (solved && !E.roundMistake) { E.right++; E.combo++; E.score += Math.round((100 + E.shardCount * 24) * E.routeMultiplier); E.lastOutcome = "perfect"; }
    else { E.combo = 0; E.lastOutcome = "repair"; }
    E.score = Math.max(0, E.score); E.mistakes += E.roundMistake ? 1 : 0;
    try { if (typeof schedHit === "function") schedHit(E.target.w, !!(solved && !E.roundMistake)); } catch (e) { }
    status(message || (solved ? "出口开启" : "本轮进入复盘"), solved ? "good" : "bad");
    updateHud(); renderReview(message);
    try { speakWord(E.target.w + ". " + (E.target.x || "")); } catch (e2) { }
  }
  function renderRoute() {
    var host = byId("eh-route-cards"); if (!host) return;
    host.innerHTML = "";
    var options = [
      { title: "静默回廊", desc: "巡逻词灵变慢，护盾恢复 1 格。适合稳稳把记忆带回家。", key: "LEFT" },
      { title: "贪婪宝库", desc: "回声奖励 ×1.45，但下一间房会多一个危险猎手。", key: "RIGHT" }
    ];
    for (var i = 0; i < options.length; i++) {
      var el = document.createElement("div"); el.className = "eh-route-card" + (i === E.routeIndex ? " focus" : "");
      el.setAttribute("data-route", String(i));
      el.innerHTML = '<h3>' + esc(options[i].title) + '</h3><p>' + esc(options[i].desc) + '</p><span class="eh-route-key">' + options[i].key + ' · 选择</span>';
      host.appendChild(el);
    }
    phaseText("左右选择路线 · OK 确认你的风险");
  }
  function openRoute() {
    if (E.round >= E.total - 1) { finishRun(); return; }
    E.phase = "route"; E.routeIndex = E.routeIndex % 2; renderRoute();
    var panel = byId("eh-route"); if (panel) panel.hidden = false;
  }
  function applyRoute() {
    var panel = byId("eh-route"); if (panel) panel.hidden = true;
    E.routeMode = E.routeIndex; E.routeMultiplier = E.routeMode === 1 ? 1.45 : 1;
    if (E.routeMode === 0) E.shield = Math.min(E.maxShield, E.shield + 1);
    E.round++; E.boss = E.round === E.total - 1; startRound();
  }
  function startRound() {
    E.phase = "play"; E.target = E.list[E.round];
    if (!makeGateOptions()) { stop(); if (typeof toast === "function") toast("当前词书需要至少 3 种不同释义"); return; }
    makeRoom(); updateHud();
    text("eh-room", E.boss ? "最终房 · 裂隙守门者已经醒来，三道符文只留一道真实出口。" : (E.routeMode === 1 ? "危险宝库 · 多一名猎手，回声奖励更高。" : "静默回廊 · 先观察巡逻，再把回声一枚枚带走。"));
    beginGateScan(reducedMotion() ? 1600 : 1200, "符文对照 · 全程可见,放心探索");
    addParticle(E.map.x + E.map.w * .5, E.map.y + E.map.h * .5, "#8ee2d0", E.boss ? 28 : 14, E.map.cell * .018);
  }
  function startRun() {
    if (!E.active || !ownerValid()) return;
    var prepared = prepareBank();
    if (!prepared) { stop(); if (typeof toast === "function") toast("记忆裂隙至少需要 3 个可用单词"); return; }
    E.bank = prepared.bank; E.list = prepared.list; E.total = E.list.length; E.round = 0; E.score = 0; E.combo = 0; E.right = 0; E.solved = 0; E.mistakes = 0; E.shield = 3; E.maxShield = 3; E.routeMode = 0; E.routeMultiplier = 1; E.sessionCommitted = false; E.boss = false; E.simTime = 0;
    E.seed = hash(String(new Date().toISOString().slice(0, 10)) + ":" + String(typeof CUR === "undefined" ? "fin" : CUR)); E.rng = rng(E.seed); layout();
    var intro = byId("eh-intro"); if (intro) intro.hidden = true;
    startRound();
  }
  function finishRun() {
    if (E.sessionCommitted) return;
    E.sessionCommitted = true; E.phase = "finish";
    try { if (typeof gameResult === "function") gameResult("echo", E.right, E.total, E.score); } catch (e) { }
    var title = E.right >= Math.ceil(E.total * .7) ? "裂隙为你让路" : "你把记忆带了回来";
    text("eh-finish-title", title); text("eh-finish-stats", E.score + " 回声 · 完美夺回 " + E.right + " / " + E.total + " · 连击 " + E.combo);
    text("eh-finish-msg", "每个被复原的词都已进入当前家庭空间的 FSRS 轨道。下次进入，裂隙会优先呼叫仍然脆弱的词。");
    var panel = byId("eh-finish"); if (panel) panel.hidden = false;
    var btn = byId("eh-finish-next"); if (btn) btn.classList.add("focus"); phaseText("OK 返回训练馆 · 返回直接撤离"); playSfx("win");
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w * .5, h * .5); ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawBackground(ctx, t) {
    var g = ctx.createLinearGradient(0, 0, E.cw, E.ch); g.addColorStop(0, "#090d20"); g.addColorStop(.52, "#111c3c"); g.addColorStop(1, "#070a19"); ctx.fillStyle = g; ctx.fillRect(0, 0, E.cw, E.ch);
    var glow = ctx.createRadialGradient(E.cw * .39, E.ch * .48, 0, E.cw * .39, E.ch * .48, E.cw * .55); glow.addColorStop(0, "rgba(82,146,190,.16)"); glow.addColorStop(.55, "rgba(27,60,110,.06)"); glow.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = glow; ctx.fillRect(0, 0, E.cw, E.ch);
    for (var i = 0; i < E.stars.length; i++) { var s = E.stars[i], a = s.a * (.68 + .32 * Math.sin(t * .0012 + s.p)); ctx.globalAlpha = a; ctx.fillStyle = i % 7 === 0 ? "#f2d991" : "#a9d8ef"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    var cx = E.cw * .38, cy = E.ch * .52;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * .00005);
    for (var r = 0; r < 3; r++) { ctx.strokeStyle = r === 1 ? "rgba(142,226,208,.12)" : "rgba(181,169,242,.08)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, (18 + r * 8) * E.map.cell, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  function drawMaze(ctx, t) {
    var m = E.map; if (!E.grid.length || !m.cell) return;
    var pad = m.cell * .07;
    // A solid board plate keeps the low-power canvas crisp against the cosmic background.
    roundRect(ctx, m.x - m.cell * .42, m.y - m.cell * .42, m.w + m.cell * .84, m.h + m.cell * .84, m.cell * .35);
    ctx.fillStyle = "rgba(8,15,39,.84)"; ctx.fill(); ctx.strokeStyle = "rgba(154,188,235,.2)"; ctx.lineWidth = 1.2; ctx.stroke();
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      var px = m.x + x * m.cell + pad, py = m.y + y * m.cell + pad, size = m.cell - pad * 2;
      if (E.grid[y][x] === 0) {
        roundRect(ctx, px, py, size, size, m.cell * .13); ctx.fillStyle = (x + y) % 2 ? "rgba(44,70,125,.38)" : "rgba(33,58,108,.38)"; ctx.fill();
        ctx.strokeStyle = "rgba(150,189,231,.08)"; ctx.lineWidth = .8; ctx.stroke();
      } else { ctx.fillStyle = "rgba(4,10,27,.6)"; ctx.fillRect(px, py, size, size); }
    }
    // Soft trail left by the traveller; capped to keep the TV renderer quiet.
    for (var q = 0; q < E.trail.length; q++) { var tr = E.trail[q], tc = cellCenter(tr); ctx.globalAlpha = (q + 1) / E.trail.length * .18; ctx.fillStyle = "#8ee2d0"; ctx.beginPath(); ctx.arc(tc.x, tc.y, m.cell * .11, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    // Echo shards.
    for (var i = 0; i < E.shards.length; i++) {
      var sh = E.shards[i]; if (sh.got) continue; var sc = cellCenter(sh), pulse = 1 + Math.sin(t * .004 + sh.phase) * .16;
      ctx.save(); ctx.translate(sc.x, sc.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = "#8ee2d0"; ctx.globalAlpha = .94; ctx.shadowColor = "#8ee2d0"; ctx.shadowBlur = Math.min(16, m.cell * .28); ctx.fillRect(-m.cell * .105 * pulse, -m.cell * .105 * pulse, m.cell * .21 * pulse, m.cell * .21 * pulse); ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    // The mapping is shown briefly before play; the maze itself keeps only glyphs.
    for (var gi = 0; gi < E.gates.length; gi++) {
      var gate = E.gates[gi], gc = cellCenter(gate), color = GATE_COLORS[gi], sealed = E.sealed[gi];
      ctx.save(); ctx.translate(gc.x, gc.y); ctx.globalAlpha = sealed ? .26 : .9;
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, m.cell * .045); ctx.shadowColor = color; ctx.shadowBlur = sealed ? 0 : Math.min(18, m.cell * .34);
      ctx.beginPath(); ctx.arc(0, 0, m.cell * (.3 + Math.sin(t * .003 + gi) * .025), 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, m.cell * .43, t * .0008 + gi, t * .0008 + gi + Math.PI * 1.35); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = sealed ? "#73809f" : color; ctx.font = "800 " + Math.max(14, m.cell * .35) + "px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(sealed ? "×" : GATE_GLYPHS[gi], 0, 0); ctx.restore();
    }
    drawHunter(ctx, E.enemy, t, false); if (E.hunter) drawHunter(ctx, E.hunter, t, true);
    drawPlayer(ctx, t);
    for (var p = E.particles.length - 1; p >= 0; p--) { var part = E.particles[p], pc = part; ctx.globalAlpha = clamp(part.life / part.max, 0, 1); ctx.fillStyle = part.color; ctx.beginPath(); ctx.arc(pc.x, pc.y, part.size, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    // Directional pulse around the currently occupied cell makes remote navigation obvious.
    if (E.phase === "play") { var pp = cellCenter({ x: E.player.drawX, y: E.player.drawY }); ctx.strokeStyle = "rgba(242,217,145,.42)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(pp.x, pp.y, m.cell * (.52 + Math.sin(t * .004) * .05), 0, Math.PI * 2); ctx.stroke(); }
  }
  function drawHunter(ctx, hunter, t, boss) {
    if (!hunter) return;
    var c = cellCenter({ x: hunter.drawX, y: hunter.drawY }), m = E.map;
    var radius = m.cell * (boss ? .28 : .22), color = boss ? "#f29bb0" : "#d27dbe";
    var phase = hunter.homeX * .73 + hunter.homeY * 1.17, bob = Math.sin(t * .0052 + phase) * radius * .2;
    var mx = hunter.x - hunter.drawX, my = hunter.y - hunter.drawY, mag = Math.sqrt(mx * mx + my * my);
    var tailX = mag > .015 ? -mx / mag : -(.72 + Math.sin(t * .0017 + phase) * .16);
    var tailY = mag > .015 ? -my / mag : Math.sin(t * .0031 + phase) * .34;
    ctx.save(); ctx.translate(c.x, c.y + bob);
    // Three translucent echoes make movement readable without particles or timers.
    for (var w = 3; w >= 1; w--) {
      var drift = Math.sin(t * .004 + phase + w) * radius * .18;
      ctx.globalAlpha = .055 + (3 - w) * .035; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(tailX * radius * (.72 + w * .46) - tailY * drift, tailY * radius * (.72 + w * .46) + tailX * drift, radius * (.48 - w * .065), 0, Math.PI * 2); ctx.fill();
    }
    ctx.rotate(clamp(mx, -1, 1) * .12 + Math.sin(t * .003 + phase) * .025);
    ctx.scale(1 + Math.sin(t * .006 + phase) * .045, 1 - Math.sin(t * .006 + phase) * .035);
    ctx.globalAlpha = .93; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = Math.min(18, m.cell * .32);
    ctx.beginPath(); ctx.arc(0, 0, radius, Math.PI, 0); ctx.quadraticCurveTo(radius * .92, radius * .72, radius * .46, radius * .66); ctx.quadraticCurveTo(radius * .12, radius * 1.12, -radius * .18, radius * .68); ctx.quadraticCurveTo(-radius * .62, radius * 1.02, -radius * .78, radius * .45); ctx.quadraticCurveTo(-radius, radius * .14, -radius, 0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    var lookX = clamp((E.player.drawX - hunter.drawX) * .09, -.16, .16) * radius;
    var lookY = clamp((E.player.drawY - hunter.drawY) * .09, -.13, .13) * radius;
    var blink = Math.sin(t * .0011 + phase) > .985 ? .18 : 1;
    ctx.save(); ctx.translate(radius * .18, -radius * .13); ctx.scale(1, blink); ctx.fillStyle = "#11142e"; ctx.beginPath(); ctx.arc(0, 0, radius * .34, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff1d2"; ctx.beginPath(); ctx.arc(radius * .08 + lookX, -radius * .04 + lookY, radius * .11, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (boss) { ctx.strokeStyle = "rgba(242,217,145,.86)"; ctx.lineWidth = Math.max(1, m.cell * .035); ctx.beginPath(); ctx.arc(0, 0, radius * 1.55, t * .002, t * .002 + Math.PI * 1.5); ctx.stroke(); }
    ctx.restore();
  }
  function drawPlayer(ctx, t) {
    var c = cellCenter({ x: E.player.drawX, y: E.player.drawY }), m = E.map, r = m.cell * .22;
    ctx.save(); ctx.translate(c.x, c.y); ctx.globalAlpha = .94; ctx.fillStyle = "#f2d991"; ctx.shadowColor = "#8ee2d0"; ctx.shadowBlur = Math.min(24, m.cell * .48); ctx.beginPath(); ctx.arc(0, 0, r * (1 + Math.sin(t * .006) * .08), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1.2, m.cell * .035); ctx.beginPath(); ctx.arc(0, 0, r * 1.5, t * .0017, t * .0017 + Math.PI * 1.35); ctx.stroke(); ctx.restore();
  }
  function draw(now) {
    if (!E.ctx) return; var ctx = E.ctx; ctx.setTransform(E.scale, 0, 0, E.scale, 0, 0); ctx.clearRect(0, 0, E.cw, E.ch); drawBackground(ctx, now);
    if (E.grid.length) drawMaze(ctx, now);
  }
  function frame(now) {
    if (!E.active || E.suspended || !ownerValid()) { E.raf = 0; return; }
    E.raf = requestAnimationFrame(frame);
    if (E.lastFrame && now - E.lastFrame < 31) return;
    var elapsed = E.lastFrame ? Math.min(120, now - E.lastFrame) : 33.3; E.lastFrame = now; E.accumulator += elapsed / 1000;
    while (E.accumulator >= FIXED) { if (E.phase === "play") tickGame(FIXED); E.accumulator -= FIXED; }
    draw(now); E.sampleFrames++; E.sampleTime += elapsed;
    if (E.sampleFrames >= 90) { E.measuredFps = E.sampleTime ? Math.round(1000 * E.sampleFrames / E.sampleTime) : 30; E.sampleFrames = 0; E.sampleTime = 0; }
  }
  function resize() { layout(); }
  function clearTimers() { if (E.introTimer) { clearTimeout(E.introTimer); E.introTimer = 0; } if (E.resumeTimer) { clearTimeout(E.resumeTimer); E.resumeTimer = 0; } }
  function open() {
    if (!installUi() || !E.ctx) { if (typeof toast === "function") toast("记忆裂隙需要 Canvas 支持"); return false; }
    E.returnScreen = (typeof SCREEN !== "undefined" && SCREEN === "world") ? "world" : "arcade";
    E.runId++; E.active = true; E.suspended = false; E.ownerP = P; E.ownerCur = CUR; E.phase = "intro"; E.sessionCommitted = false; E.seed = hash(String(Date.now()) + ":" + String(typeof CUR === "undefined" ? "fin" : CUR)); E.rng = rng(E.seed); E.grid = []; E.particles = []; E.lastFrame = 0; E.accumulator = 0;
    var run = E.runId; clearTimers(); show("echo-heist"); resize();
    var intro = byId("eh-intro"); if (intro) intro.hidden = false; var review = byId("eh-review"); if (review) review.hidden = true; var route = byId("eh-route"); if (route) route.hidden = true; var finish = byId("eh-finish"); if (finish) finish.hidden = true;
    phaseText("OK 立即潜入 · 或等待裂隙自行打开"); text("eh-log", "目标不是答完题，而是把词从追击你的世界里夺回来。");
    E.introTimer = setTimeout(function () { if (E.active && E.runId === run && E.phase === "intro" && ownerValid()) startRun(); }, reducedMotion() ? 240 : 1500);
    if (!E.raf) E.raf = requestAnimationFrame(frame); return true;
  }
  function stop() {
    E.runId++; E.active = false; E.suspended = true; E.phase = "off"; clearTimers(); E.scanVisible = false; E.scanUntil = 0;
    if (E.raf) { cancelAnimationFrame(E.raf); E.raf = 0; } E.ownerP = null; E.ownerCur = null; E.grid = []; E.particles = [];
  }
  function suspend() { if (E.active) { E.suspended = true; E.pausedByBlur = true; if (E.raf) { cancelAnimationFrame(E.raf); E.raf = 0; } } }
  function resume() { if (E.active && typeof SCREEN !== "undefined" && SCREEN === "echo-heist") { E.suspended = false; E.pausedByBlur = false; E.lastFrame = 0; if (!E.raf) E.raf = requestAnimationFrame(frame); } }
  function nextReview() {
    var panel = byId("eh-review"); if (panel) panel.hidden = true;
    if (E.round >= E.total - 1) { finishRun(); return; }
    openRoute();
  }
  function returnHome() { var target = E.returnScreen === "world" ? "world" : "arcade"; stop(); show(target); }
  function key(k) {
    if (!E.active || !ownerValid()) return;
    var t = nowMs(), last = E.inputAt[k] || 0, gap = (k === "OK" || k === "BACK") ? 300 : 58;
    if (t - last < gap) return; E.inputAt[k] = t;
    if (k === "BACK") { returnHome(); return; }
    if (k === "PLAY" || k === "INFO") { if (E.target) speakWord(E.target.w); return; }
    if (E.phase === "intro") { if (k === "OK") { clearTimers(); startRun(); } return; }
    if (E.phase === "review") { if (k === "OK") nextReview(); return; }
    if (E.phase === "route") {
      if (k === "LEFT" || k === "UP") E.routeIndex = 0; else if (k === "RIGHT" || k === "DOWN") E.routeIndex = 1; else if (k === "OK") { applyRoute(); return; }
      renderRoute(); return;
    }
    if (E.phase === "finish") { if (k === "OK") returnHome(); return; }
    if (E.phase !== "play") return;
    if (gateScanActive()) { if (k === "OK") endGateScan(); return; }
    if (k === "LEFT") move(-1, 0); else if (k === "RIGHT") move(1, 0); else if (k === "UP") move(0, -1); else if (k === "DOWN") move(0, 1); else if (k === "OK") { var gate = gateAt(E.player.x, E.player.y); if (gate >= 0) resolveGate(gate); else status("这里没有可夺取的符文门 · 继续寻找回声", "bad"); }
  }
  function benchmark() {
    return { active: E.active, phase: E.phase, fps: E.measuredFps, renderScale: E.scale, round: E.round, total: E.total, solved: E.solved, right: E.right, score: E.score, shield: E.shield, shards: E.shardCount, shardTotal: E.shards.length, sessionCommitted: E.sessionCommitted, grid: E.grid.length ? [COLS, ROWS] : null, owner: ownerValid() };
  }

  if (!installUi()) return;
  if (typeof handlers === "object") handlers["echo-heist"] = { enter: function () { resize(); }, key: key };
  window.EchoHeist = { open: open, stop: stop, suspend: suspend, resume: resume, benchmark: benchmark };
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () { if (document.hidden) suspend(); else resume(); });
  window.addEventListener("blur", suspend); window.addEventListener("focus", resume);
})();
