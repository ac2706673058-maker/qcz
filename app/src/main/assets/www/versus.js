/* ======================================================================
   LexTV · 家庭对战 (FAMILY VERSUS)

   电视最大的优势是"一块全家共享的大屏"。这个模块把背单词变成两个人
   面对面的对战:轮流答题、答对出招削对手血、先把对方打空者胜,
   并把胜负记进常驻的家庭战绩榜。

   自带 UI 与样式,不依赖 index.html;词源沿用当前档案的训练词源。
   ====================================================================== */
"use strict";
(function () {
  var ROUNDS = 10;            // 总回合(两人各 5 次)
  var ANSWER_MS = 11000;      // 每题限时
  var MAX_HP = 100;

  var V = {
    active: false, phase: "off", runId: 0,
    aIdx: 0, bIdx: 1, side: 0,          // 设置阶段:两侧选谁 / 当前编辑哪一侧
    players: [], players2: [], list: [], bank: [],
    round: 0, turn: 0, sel: 0, locked: false,
    options: [], answer: -1,
    askAt: 0, raf: 0, timeLeft: 1,
    winner: -1
  };

  function byId(id) { return document.getElementById(id); }
  function nowMs() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function esc2(s) { try { return esc(String(s)); } catch (e) { return String(s || ""); } }
  function sfx(n) { try { if (window.SFX && SFX[n]) SFX[n](); } catch (e) { } }
  function norm(s) { return String(s || "").trim().toLowerCase(); }
  function syncHalo() { try { if (typeof requestFocusSync === "function") requestFocusSync(); } catch (e) { } }
  function shuf(a) { var o = a.slice(), i, j, t; for (i = o.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = o[i]; o[i] = o[j]; o[j] = t; } return o; }

  /* ---------- 家庭成员 ---------- */
  function members() {
    var out = [];
    try {
      (PROFILE_META || []).forEach(function (m) {
        if (m && !m.archived) out.push({ id: m.id, short: m.short || m.name || "成员" });
      });
    } catch (e) { }
    if (out.length < 2) {
      var base = out.length ? out : [{ id: "p1", short: "玩家 1" }];
      while (base.length < 2) base.push({ id: "p" + (base.length + 1), short: "玩家 " + (base.length + 1) });
      out = base;
    }
    return out;
  }

  /* ---------- 词库 ---------- */
  function prepare() {
    var pool = [];
    try { pool = typeof gameWords === "function" ? gameWords() : []; } catch (e) { }
    if (pool.length < 8) { try { pool = typeof seenWords === "function" ? seenWords() : []; } catch (e2) { } }
    if (pool.length < 8) { try { pool = typeof activeWords === "function" ? activeWords() : []; } catch (e3) { } }
    var seen = Object.create(null), bank = [], meanings = Object.create(null);
    pool.forEach(function (e) {
      var w = norm(e && e.w), m = norm(e && e.m);
      if (!w || !m || seen[w]) return;
      seen[w] = true; meanings[m] = true; bank.push(e);
    });
    if (bank.length < 8 || Object.keys(meanings).length < 4) return null;
    return { bank: bank, list: shuf(bank).slice(0, ROUNDS) };
  }
  function makeOptions(target) {
    var used = Object.create(null), opts = [target];
    used[norm(target.m)] = true;
    var pool = shuf(V.bank);
    for (var i = 0; i < pool.length && opts.length < 4; i++) {
      var c = pool[i], mk = norm(c.m);
      if (!mk || used[mk] || norm(c.w) === norm(target.w)) continue;
      used[mk] = true; opts.push(c);
    }
    if (opts.length < 4) return null;
    opts = shuf(opts);
    return { options: opts, answer: opts.indexOf(target) };
  }

  /* ---------- 战绩榜(跨档案,单独存) ---------- */
  function loadBoard() {
    try { return JSON.parse(NativeBridge.load("family_vs") || "{}") || {}; } catch (e) { return {}; }
  }
  function saveBoard(b) { try { NativeBridge.save("family_vs", JSON.stringify(b)); } catch (e) { } }
  function recordResult(winId, loseId) {
    var b = loadBoard();
    function ent(id) { if (!b[id]) b[id] = { win: 0, lose: 0 }; return b[id]; }
    ent(winId).win++; ent(loseId).lose++;
    saveBoard(b);
    return b;
  }
  function boardLine(id) {
    var b = loadBoard()[id] || { win: 0, lose: 0 };
    return b.win + " 胜 " + b.lose + " 负";
  }

  /* ---------- UI ---------- */
  function installUi() {
    if (byId("versus")) return true;
    var app = byId("app"); if (!app) return false;
    var st = document.createElement("style");
    st.id = "versus-style";
    st.textContent = [
      "#versus{display:none;padding:3vmin 4.5vmin}",
      "#versus.active{display:flex;flex-direction:column}",
      ".vs-head{display:flex;align-items:stretch;gap:2vmin;flex:0 0 auto}",
      ".vs-p{flex:1;display:flex;align-items:center;gap:1.6vmin;padding:1.5vmin 2vmin;border-radius:2vmin;background:var(--panel);",
      "  border:.1vmin solid var(--hair);box-shadow:0 .8vmin 2vmin rgba(0,0,0,.07);transition:transform .16s,box-shadow .16s}",
      ".vs-p.turn{box-shadow:0 0 0 .32vmin var(--focus),0 1.4vmin 3.2vmin rgba(10,108,240,.2);transform:translateY(-.4vmin)}",
      ".vs-p .av{width:7vmin;height:7vmin;flex:0 0 auto}",
      ".vs-p .av .mglyph{width:4.4vmin;height:4.4vmin}",
      ".vs-info{flex:1;min-width:0}",
      ".vs-name{font-size:2.7vmin;font-weight:750;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".vs-rec{font-size:1.6vmin;color:var(--dim);margin-top:.2vmin}",
      ".vs-hp{height:1.5vmin;border-radius:1vmin;background:var(--ink2);margin-top:.85vmin;overflow:hidden}",
      ".vs-hp i{display:block;height:100%;width:100%;border-radius:1vmin;background:linear-gradient(90deg,#34C759,#8BE07A);transition:width .35s cubic-bezier(.2,.8,.3,1)}",
      ".vs-hp.low i{background:linear-gradient(90deg,#FF9F0A,#FF453A)}",
      ".vs-num{font-size:3.2vmin;font-weight:800;color:var(--paper);font-variant-numeric:tabular-nums;min-width:9vmin;text-align:right}",
      ".vs-num small{display:block;font-size:1.5vmin;color:var(--dim);font-weight:600}",
      ".vs-p.hurt{animation:vsHurt .45s ease}",
      "@keyframes vsHurt{0%,100%{transform:none}25%{transform:translateX(-1.2vmin)}60%{transform:translateX(1vmin)}}",
      ".vs-p.hit{background:#FDEBEA}",
      ".vs-vsmark{flex:0 0 auto;align-self:center;font:850 3.4vmin/1 Inter,sans-serif;color:var(--gold);letter-spacing:-.03em}",
      ".vs-turnbar{flex:0 0 auto;margin:1.5vmin 0 .5vmin;text-align:center;font-size:2.3vmin;color:var(--dim)}",
      ".vs-turnbar b{color:var(--gold);font-size:2.6vmin}",
      ".vs-timer{flex:0 0 auto;height:.7vmin;border-radius:1vmin;background:var(--ink2);overflow:hidden;margin:.4vmin auto 0;width:70vmin;max-width:100%}",
      ".vs-timer i{display:block;height:100%;background:var(--gold);width:100%}",
      ".vs-word{flex:0 0 auto;text-align:center;margin:1.6vmin 0 .4vmin;font-size:7.6vmin;font-weight:850;letter-spacing:-.03em;color:var(--paper)}",
      ".vs-phon{flex:0 0 auto;text-align:center;font-size:2.5vmin;color:var(--gold);min-height:3vmin}",
      "#vs-opts{margin-top:auto}",
      ".vs-fb{flex:0 0 auto;text-align:center;min-height:3.4vmin;font-size:2.4vmin;font-weight:700;margin-top:1vmin}",
      ".vs-fb.good{color:var(--good)}.vs-fb.bad{color:var(--bad)}",
      /* 设置阶段 */
      ".vs-setup{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.4vmin}",
      ".vs-pick{display:flex;align-items:center;gap:3vmin}",
      ".vs-card{width:44vmin;padding:2.6vmin;border-radius:2.4vmin;background:var(--panel);border:.1vmin solid var(--hair);",
      "  box-shadow:0 1vmin 2.6vmin rgba(0,0,0,.08);text-align:center;transition:transform .16s,box-shadow .16s}",
      ".vs-card.focus{box-shadow:0 0 0 .32vmin var(--focus),0 1.6vmin 3.6vmin rgba(10,108,240,.2);transform:translateY(-.5vmin) scale(1.02)}",
      ".vs-card .av{width:12vmin;height:12vmin;margin:0 auto}",
      ".vs-card .av .mglyph{width:7.4vmin;height:7.4vmin}",
      ".vs-card .nm{margin-top:1.2vmin;font-size:3.2vmin;font-weight:800;color:var(--paper)}",
      ".vs-card .rc{margin-top:.5vmin;font-size:1.9vmin;color:var(--dim)}",
      ".vs-card .sw{margin-top:1vmin;font-size:1.8vmin;color:var(--gold);font-weight:650}",
      ".vs-tip{font-size:2.1vmin;color:var(--dim);text-align:center;line-height:1.6}",
      /* 结算 */
      ".vs-fin{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.6vmin}",
      ".vs-fin .av{width:16vmin;height:16vmin}",
      ".vs-fin .av .mglyph{width:10vmin;height:10vmin}",
      ".vs-crown{font-size:2.2vmin;letter-spacing:.4em;color:var(--gold);font-weight:800}",
      ".vs-win{font-size:6.6vmin;font-weight:850;color:var(--paper);letter-spacing:-.02em}",
      ".vs-sub{font-size:2.4vmin;color:var(--dim);text-align:center;line-height:1.6}",
      "@media(prefers-reduced-motion:reduce){.vs-p,.vs-card,.vs-hp i{transition:none!important}.vs-p.hurt{animation:none!important}}"
    ].join("");
    document.head.appendChild(st);

    var root = document.createElement("div");
    root.className = "screen"; root.id = "versus"; root.setAttribute("aria-label", "家庭对战");
    root.innerHTML =
      '<div class="top"><div class="brand serif">家庭对战</div><div class="meta"><span id="vs-round">准备</span></div></div>'
      + '<div class="vs-setup" id="vs-setup">'
      + '  <div class="vs-pick">'
      + '    <div class="vs-card" id="vs-card-a"></div><div class="vs-vsmark">VS</div><div class="vs-card" id="vs-card-b"></div>'
      + '  </div>'
      + '  <div class="vs-tip">上下切换要改的一方 · 左右换人 · OK 开始<br>轮流答题,答对出招削对方血量,先把对方打空者获胜</div>'
      + '</div>'
      + '<div id="vs-play" style="display:none;flex:1;flex-direction:column;min-height:0">'
      + '  <div class="vs-head">'
      + '    <div class="vs-p" id="vs-pa"></div><div class="vs-vsmark">VS</div><div class="vs-p" id="vs-pb"></div>'
      + '  </div>'
      + '  <div class="vs-turnbar" id="vs-turn"></div>'
      + '  <div class="vs-timer"><i id="vs-time"></i></div>'
      + '  <div class="vs-word" id="vs-word"></div>'
      + '  <div class="vs-phon" id="vs-phon"></div>'
      + '  <div class="opts" id="vs-opts"></div>'
      + '  <div class="vs-fb" id="vs-fb"></div>'
      + '</div>'
      + '<div class="vs-fin" id="vs-fin" style="display:none"></div>';
    app.appendChild(root);
    return true;
  }

  /* ---------- 设置阶段 ---------- */
  function renderSetup() {
    var ms = V.players;
    [["a", V.aIdx, 0], ["b", V.bIdx, 1]].forEach(function (x) {
      var el = byId("vs-card-" + x[0]); if (!el) return;
      var m = ms[x[1] % ms.length];
      el.className = "vs-card" + (V.side === x[2] ? " focus" : "");
      el.innerHTML = (window.avatar ? window.avatar(m.id) : "")
        + '<div class="nm">' + esc2(m.short) + '</div>'
        + '<div class="rc">' + esc2(boardLine(m.id)) + '</div>'
        + '<div class="sw">← → 换人</div>';
    });
    syncHalo();
  }

  /* ---------- 对战 ---------- */
  function hpPct(p) { return Math.max(0, Math.round(p.hp / MAX_HP * 100)); }
  function renderPanels() {
    [["vs-pa", 0], ["vs-pb", 1]].forEach(function (x) {
      var el = byId(x[0]); if (!el) return;
      var p = V.players2[x[1]];
      el.className = "vs-p" + (V.turn === x[1] && V.phase === "battle" ? " turn" : "");
      el.innerHTML = (window.avatar ? window.avatar(p.id) : "")
        + '<div class="vs-info"><div class="vs-name">' + esc2(p.short) + '</div>'
        + '<div class="vs-rec">连击 ×' + p.combo + ' · 答对 ' + p.right + '</div>'
        + '<div class="vs-hp' + (p.hp <= 35 ? " low" : "") + '"><i style="width:' + hpPct(p) + '%"></i></div></div>'
        + '<div class="vs-num">' + p.hp + '<small>HP</small></div>';
    });
  }
  function renderOptions() {
    var box = byId("vs-opts"); if (!box) return;
    box.innerHTML = "";
    V.options.forEach(function (o, i) {
      var el = document.createElement("div");
      el.className = "opt" + (i === V.sel ? " focus" : "");
      el.innerHTML = '<span class="idx">' + (i + 1) + '</span><span>' + esc2(o.m) + '</span>';
      box.appendChild(el);
    });
    syncHalo();
  }
  function optFocus() {
    var rows = byId("vs-opts").children;
    for (var i = 0; i < rows.length; i++) rows[i].classList.toggle("focus", i === V.sel);
    syncHalo();
  }
  function nextQuestion() {
    if (V.phase !== "battle") return;
    if (V.round >= ROUNDS || V.players2[0].hp <= 0 || V.players2[1].hp <= 0) { finish(); return; }
    var target = V.list[V.round % V.list.length];
    var made = makeOptions(target);
    if (!made) { finish(); return; }
    V.options = made.options; V.answer = made.answer;
    V.sel = 0; V.locked = false; V.askAt = nowMs();
    byId("vs-round").textContent = "第 " + (V.round + 1) + " / " + ROUNDS + " 回合";
    byId("vs-word").textContent = target.w;
    byId("vs-phon").textContent = target.p ? "/" + String(target.p).replace(/^\/+|\/+$/g, "") + "/" : "";
    byId("vs-fb").textContent = ""; byId("vs-fb").className = "vs-fb";
    byId("vs-turn").innerHTML = "轮到 <b>" + esc2(V.players2[V.turn].short) + "</b> · 选出正确释义";
    renderPanels(); renderOptions();
    try { if (typeof speak === "function") speak(target.w); } catch (e) { }
    startTimer();
  }
  function startTimer() {
    stopTimer();
    var run = V.runId;
    function tick() {
      if (run !== V.runId || V.phase !== "battle") return;
      var left = 1 - (nowMs() - V.askAt) / ANSWER_MS;
      if (left <= 0) { byId("vs-time").style.width = "0%"; V.raf = 0; if (!V.locked) resolve(-1); return; }
      byId("vs-time").style.width = (left * 100).toFixed(1) + "%";
      V.raf = requestAnimationFrame(tick);
    }
    V.raf = requestAnimationFrame(tick);
  }
  function stopTimer() { if (V.raf) { cancelAnimationFrame(V.raf); V.raf = 0; } }

  function resolve(pick) {
    if (V.locked || V.phase !== "battle") return;
    V.locked = true; stopTimer();
    var me = V.players2[V.turn], foe = V.players2[1 - V.turn];
    var ok = pick === V.answer;
    var rows = byId("vs-opts").children;
    for (var i = 0; i < rows.length; i++) {
      if (i === V.answer) rows[i].classList.add("right");
      else if (i === pick) rows[i].classList.add("wrong");
    }
    var fb = byId("vs-fb");
    if (ok) {
      me.right++; me.combo++;
      var speed = Math.max(0, 1 - (nowMs() - V.askAt) / ANSWER_MS);
      var dmg = 12 + Math.round(speed * 8) + Math.min(6, (me.combo - 1) * 2);
      foe.hp = Math.max(0, foe.hp - dmg);
      fb.textContent = "✓ 命中!对 " + foe.short + " 造成 " + dmg + " 点伤害" + (me.combo > 1 ? " · 连击 ×" + me.combo : "");
      fb.className = "vs-fb good";
      sfx("good");
      var foeEl = byId(V.turn === 0 ? "vs-pb" : "vs-pa");
      if (foeEl) { foeEl.classList.add("hurt", "hit"); setTimeout(function () { try { foeEl.classList.remove("hurt", "hit"); } catch (e) { } }, 460); }
    } else {
      me.combo = 0;
      fb.textContent = pick < 0 ? "⏱ 超时 · 这一击落空了" : "✗ 出招落空 · 正确释义已标出";
      fb.className = "vs-fb bad";
      sfx("bad");
    }
    try { if (typeof schedHit === "function") schedHit(V.list[V.round % V.list.length].w, ok); } catch (e) { }
    renderPanels();
    V.round++; V.turn = 1 - V.turn;
    var run = V.runId;
    setTimeout(function () {
      if (run !== V.runId || V.phase !== "battle") return;
      if (V.players2[0].hp <= 0 || V.players2[1].hp <= 0 || V.round >= ROUNDS) finish();
      else nextQuestion();
    }, 1500);
  }

  function finish() {
    if (V.phase === "finish") return;
    V.phase = "finish"; stopTimer();
    var a = V.players2[0], b = V.players2[1];
    var win;
    if (a.hp !== b.hp) win = a.hp > b.hp ? 0 : 1;
    else if (a.right !== b.right) win = a.right > b.right ? 0 : 1;
    else win = -1;
    V.winner = win;
    byId("vs-play").style.display = "none";
    var fin = byId("vs-fin"); fin.style.display = "flex";
    if (win < 0) {
      fin.innerHTML = '<div class="vs-crown">DRAW</div><div class="vs-win">平局!</div>'
        + '<div class="vs-sub">' + esc2(a.short) + ' ' + a.hp + ' HP　·　' + esc2(b.short) + ' ' + b.hp + ' HP<br>按 OK 再来一局 · 返回退出</div>';
      sfx("ok");
    } else {
      var w = V.players2[win], l = V.players2[1 - win];
      recordResult(w.id, l.id);
      fin.innerHTML = '<div class="vs-crown">WINNER</div>'
        + (window.avatar ? window.avatar(w.id) : "")
        + '<div class="vs-win">' + esc2(w.short) + ' 获胜!</div>'
        + '<div class="vs-sub">剩余 ' + w.hp + ' HP · 答对 ' + w.right + ' 题　·　' + esc2(l.short) + ' 答对 ' + l.right + ' 题<br>'
        + '家庭战绩:' + esc2(w.short) + ' ' + esc2(boardLine(w.id)) + '　·　' + esc2(l.short) + ' ' + esc2(boardLine(l.id)) + '<br>'
        + '按 OK 再来一局 · 返回退出</div>';
      sfx("win");
      if (window.celebrate) window.celebrate();
    }
    byId("vs-round").textContent = "对战结束";
    syncHalo();
  }

  /* ---------- 生命周期 ---------- */
  function open() {
    if (!installUi()) { try { toast("对战界面初始化失败"); } catch (e) { } return; }
    var prepared = prepare();
    if (!prepared) {
      try { toast("可用单词不足(至少 8 个词、4 种释义),先学几个词或到设置放宽「训练词源」"); } catch (e) { }
      return;
    }
    V.runId++; V.active = true; V.phase = "setup";
    V.bank = prepared.bank; V.list = prepared.list;
    V.players = members();
    V.aIdx = 0; V.bIdx = V.players.length > 1 ? 1 : 0; V.side = 0;
    byId("vs-setup").style.display = "flex";
    byId("vs-play").style.display = "none";
    byId("vs-fin").style.display = "none";
    byId("vs-round").textContent = "选择对战双方";
    renderSetup();
    try { show("versus"); } catch (e) { }
  }
  function startBattle() {
    var ms = V.players;
    var a = ms[V.aIdx % ms.length], b = ms[V.bIdx % ms.length];
    if (a.id === b.id) { try { toast("请选择两个不同的成员"); } catch (e) { } return; }
    V.runId++;
    V.players2 = [
      { id: a.id, short: a.short, hp: MAX_HP, right: 0, combo: 0 },
      { id: b.id, short: b.short, hp: MAX_HP, right: 0, combo: 0 }
    ];
    V.round = 0; V.turn = 0; V.phase = "battle"; V.winner = -1;
    byId("vs-setup").style.display = "none";
    byId("vs-fin").style.display = "none";
    byId("vs-play").style.display = "flex";
    nextQuestion();
  }
  function stop() { V.runId++; V.active = false; V.phase = "off"; stopTimer(); }

  function key(k) {
    if (!V.active) return;
    if (k === "BACK") { stop(); try { show("home"); } catch (e) { } return; }
    if (V.phase === "setup") {
      var n = V.players.length;
      if (k === "UP" || k === "DOWN") { V.side = 1 - V.side; sfx("nav"); renderSetup(); }
      else if (k === "LEFT" || k === "RIGHT") {
        var d = k === "RIGHT" ? 1 : n - 1;
        if (V.side === 0) V.aIdx = (V.aIdx + d) % n; else V.bIdx = (V.bIdx + d) % n;
        sfx("nav"); renderSetup();
      } else if (k === "OK") startBattle();
      return;
    }
    if (V.phase === "battle") {
      if (V.locked) return;
      if (k === "LEFT") { V.sel = (V.sel + 3) % 4; sfx("nav"); optFocus(); }
      else if (k === "RIGHT") { V.sel = (V.sel + 1) % 4; sfx("nav"); optFocus(); }
      else if (k === "UP") { V.sel = (V.sel + 2) % 4; sfx("nav"); optFocus(); }
      else if (k === "DOWN") { V.sel = (V.sel + 2) % 4; sfx("nav"); optFocus(); }
      else if (k === "OK") resolve(V.sel);
      else if (k === "PLAY" || k === "MENU") { try { speak(V.list[V.round % V.list.length].w); } catch (e) { } }
      return;
    }
    if (V.phase === "finish") {
      if (k === "OK") { V.phase = "setup"; byId("vs-fin").style.display = "none"; byId("vs-setup").style.display = "flex"; byId("vs-round").textContent = "选择对战双方"; renderSetup(); }
      return;
    }
  }

  try { handlers.versus = { enter: function () { }, key: key }; } catch (e) { }
  window.FamilyVS = { open: open, stop: stop };

  /* ======================================================================
     全屏庆祝(彩纸礼花)—— 对战获胜 / 今日任务完成 共用
     ====================================================================== */
  var CEL_COLORS = ["#FF453A", "#FF9F0A", "#FFD60A", "#34C759", "#0A84FF", "#BF5AF2", "#FF375F"];
  window.celebrate = function (text) {
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch (e) { }
    var host = byId("app"); if (!host) return;
    var layer = document.createElement("div");
    layer.style.cssText = "position:absolute;inset:0;z-index:120;pointer-events:none;overflow:hidden";
    var n = 46;
    for (var i = 0; i < n; i++) {
      var p = document.createElement("i");
      var c = CEL_COLORS[i % CEL_COLORS.length];
      var left = Math.random() * 100, delay = Math.random() * 260, dur = 1500 + Math.random() * 1200;
      var w = 0.8 + Math.random() * 0.9;
      p.style.cssText = "position:absolute;top:-6vmin;left:" + left.toFixed(2) + "%;width:" + w.toFixed(2)
        + "vmin;height:" + (w * 1.7).toFixed(2) + "vmin;background:" + c + ";border-radius:.2vmin;opacity:0";
      layer.appendChild(p);
      (function (el, delay, dur) {
        try {
          el.animate([
            { transform: "translate3d(0,0,0) rotate(0deg)", opacity: 1, offset: 0 },
            { transform: "translate3d(" + (Math.random() * 16 - 8).toFixed(1) + "vmin,58vmin,0) rotate(" + (Math.random() * 720 - 360).toFixed(0) + "deg)", opacity: 1, offset: .82 },
            { transform: "translate3d(" + (Math.random() * 20 - 10).toFixed(1) + "vmin,72vmin,0) rotate(" + (Math.random() * 900 - 450).toFixed(0) + "deg)", opacity: 0, offset: 1 }
          ], { duration: dur, delay: delay, easing: "cubic-bezier(.25,.55,.35,1)" });
        } catch (e) { }
      })(p, delay, dur);
    }
    if (text) {
      var t = document.createElement("div");
      t.textContent = text;
      t.style.cssText = "position:absolute;left:0;right:0;top:34%;text-align:center;font-size:6vmin;font-weight:850;"
        + "letter-spacing:-.02em;color:var(--paper);text-shadow:0 1vmin 3vmin rgba(0,0,0,.18)";
      layer.appendChild(t);
      try {
        t.animate([
          { transform: "scale(.72)", opacity: 0, offset: 0 },
          { transform: "scale(1.06)", opacity: 1, offset: .28 },
          { transform: "scale(1)", opacity: 1, offset: .5 },
          { transform: "scale(1)", opacity: 0, offset: 1 }
        ], { duration: 2400, easing: "cubic-bezier(.2,.8,.3,1)" });
      } catch (e) { }
    }
    host.appendChild(layer);
    setTimeout(function () { try { layer.parentNode && layer.parentNode.removeChild(layer); } catch (e) { } }, 3200);
  };
})();
