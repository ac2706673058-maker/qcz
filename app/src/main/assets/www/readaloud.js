/* ======================================================================
   LexTV · 口语跟读评分 (READ ALOUD)

   电视先示范朗读,你对着遥控器跟读,云端识别后与原文比对打分。
   复用已有的录音 + 识别管线(startVoice / window.onVoice),
   与聊天接口无关,不受其影响。
   ====================================================================== */
"use strict";
(function () {
  var ROUNDS = 8;
  var R = {
    active: false, phase: "off", runId: 0,
    list: [], i: 0, target: "", isSentence: false,
    scores: [], busy: false, lastHeard: ""
  };

  function byId(id) { return document.getElementById(id); }
  function esc2(s) { try { return esc(String(s)); } catch (e) { return String(s || ""); } }
  function sfx(n) { try { if (window.SFX && SFX[n]) SFX[n](); } catch (e) { } }
  function shuf(a) { var o = a.slice(), i, j, t; for (i = o.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = o[i]; o[i] = o[j]; o[j] = t; } return o; }

  /* ---------- 文本归一与相似度 ---------- */
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[.,!?;:"'’“”\-—()\[\]]/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  function lev(a, b) {
    var m = a.length, n = b.length, i, j;
    if (!m) return n; if (!n) return m;
    var prev = [], cur = [];
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      for (j = 0; j <= n; j++) prev[j] = cur[j];
    }
    return prev[n];
  }
  function similarity(target, heard) {
    var t = norm(target), h = norm(heard);
    if (!t) return 0;
    if (!h) return 0;
    var tw = t.split(" "), hw = h.split(" ");
    if (tw.length <= 1) {
      var d = lev(t, h);
      return Math.max(0, 1 - d / Math.max(t.length, h.length, 1));
    }
    // 多词:逐词匹配(容许轻微拼写差异)+ 长度惩罚
    var used = Object.create(null), hit = 0;
    for (var i = 0; i < tw.length; i++) {
      for (var j = 0; j < hw.length; j++) {
        if (used[j]) continue;
        var w1 = tw[i], w2 = hw[j];
        var ok = w1 === w2 || lev(w1, w2) <= (w1.length > 5 ? 2 : 1);
        if (ok) { used[j] = true; hit++; break; }
      }
    }
    return hit / Math.max(tw.length, hw.length);
  }
  function stars(score) { return score >= 85 ? 3 : (score >= 65 ? 2 : (score >= 40 ? 1 : 0)); }
  function starStr(n) { var s = ""; for (var i = 0; i < 3; i++) s += i < n ? "★" : "☆"; return s; }

  /* ---------- 取词 ---------- */
  function prepare() {
    var pool = [];
    try { pool = typeof gameWords === "function" ? gameWords() : []; } catch (e) { }
    if (pool.length < 4) { try { pool = typeof seenWords === "function" ? seenWords() : []; } catch (e2) { } }
    if (pool.length < 4) { try { pool = typeof activeWords === "function" ? activeWords() : []; } catch (e3) { } }
    var ok = pool.filter(function (e) { return e && /^[a-zA-Z][a-zA-Z\s'-]{1,20}$/.test(String(e.w || "")); });
    if (ok.length < 4) return null;
    return shuf(ok).slice(0, ROUNDS);
  }

  /* ---------- UI ---------- */
  function installUi() {
    if (byId("readaloud")) return true;
    var app = byId("app"); if (!app) return false;
    var st = document.createElement("style");
    st.id = "readaloud-style";
    st.textContent = [
      "#readaloud{display:none;padding:3.2vmin 5vmin}",
      "#readaloud.active{display:flex;flex-direction:column}",
      ".ra-mid{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1vmin;min-height:0}",
      ".ra-kick{font-size:1.9vmin;letter-spacing:.26em;color:var(--faint);font-weight:750}",
      ".ra-target{font-size:6.4vmin;font-weight:850;letter-spacing:-.025em;color:var(--paper);text-align:center;max-width:150vmin;line-height:1.16}",
      ".ra-target.sent{font-size:4.4vmin;font-weight:800}",
      ".ra-phon{font-size:2.6vmin;color:var(--gold);min-height:3vmin}",
      ".ra-mean{font-size:2.4vmin;color:var(--dim);text-align:center;max-width:130vmin}",
      ".ra-mic{margin-top:1.6vmin;width:13vmin;height:13vmin;border-radius:50%;display:grid;place-items:center;",
      "  background:var(--panel);box-shadow:0 1vmin 2.6vmin rgba(0,0,0,.1),inset 0 0 0 .26vmin var(--hair);font-size:5.4vmin}",
      ".ra-mic.rec{background:#FDEBEA;box-shadow:0 0 0 .4vmin var(--bad),0 1.4vmin 3.4vmin rgba(255,59,48,.28);animation:raPulse 1s ease-in-out infinite}",
      "@keyframes raPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}",
      ".ra-score{font-size:5.6vmin;font-weight:850;color:var(--good);min-height:6.6vmin;letter-spacing:-.02em}",
      ".ra-score.mid{color:var(--mid)}.ra-score.bad{color:var(--bad)}",
      ".ra-stars{font-size:4vmin;color:var(--gold);letter-spacing:.3vmin;min-height:4.6vmin}",
      ".ra-heard{font-size:2.1vmin;color:var(--dim);min-height:2.8vmin;text-align:center;max-width:140vmin}",
      ".ra-heard b{color:var(--paper)}",
      ".ra-prog{flex:0 0 auto;text-align:center;font-size:2vmin;color:var(--dim)}",
      "@media(prefers-reduced-motion:reduce){.ra-mic.rec{animation:none!important}}"
    ].join("");
    document.head.appendChild(st);

    var root = document.createElement("div");
    root.className = "screen"; root.id = "readaloud"; root.setAttribute("aria-label", "口语跟读");
    root.innerHTML =
      '<div class="top"><div class="brand serif">口语跟读</div><div class="meta"><span id="ra-round">1 / ' + ROUNDS + '</span></div></div>'
      + '<div class="ra-mid">'
      + '  <div class="ra-kick" id="ra-kick">READ ALOUD · 跟着读出来</div>'
      + '  <div class="ra-target" id="ra-target"></div>'
      + '  <div class="ra-phon" id="ra-phon"></div>'
      + '  <div class="ra-mean" id="ra-mean"></div>'
      + '  <div class="ra-mic" id="ra-mic">🎤</div>'
      + '  <div class="ra-score" id="ra-score"></div>'
      + '  <div class="ra-stars" id="ra-stars"></div>'
      + '  <div class="ra-heard" id="ra-heard"></div>'
      + '</div>'
      + '<div class="ra-fb" id="ra-fb" style="text-align:center;min-height:2.8vmin;font-size:2vmin;color:var(--dim)"></div>'
      + '<div class="hint-bar"><span><span class="k">OK</span>开始/结束录音</span><span><span class="k">上/播放</span>听示范</span><span><span class="k">下</span>跳过</span><span><span class="k">返回</span>退出</span></div>';
    app.appendChild(root);
    return true;
  }

  /* ---------- 流程 ---------- */
  function renderItem() {
    var e = R.list[R.i]; if (!e) { finish(); return; }
    var sent = String(e.x || "").trim();
    R.isSentence = !!(sent && sent.length <= 62 && /[a-zA-Z]/.test(sent) && R.i % 2 === 1);
    R.target = R.isSentence ? sent : String(e.w);
    byId("ra-round").textContent = (R.i + 1) + " / " + R.list.length;
    byId("ra-kick").textContent = R.isSentence ? "READ ALOUD · 读出整句" : "READ ALOUD · 读出这个词";
    var t = byId("ra-target");
    t.textContent = R.target; t.className = "ra-target" + (R.isSentence ? " sent" : "");
    byId("ra-phon").textContent = (!R.isSentence && e.p) ? "/" + String(e.p).replace(/^\/+|\/+$/g, "") + "/" : "";
    byId("ra-mean").textContent = R.isSentence ? (e.t || e.m || "") : (e.m || "");
    byId("ra-score").textContent = ""; byId("ra-score").className = "ra-score";
    byId("ra-stars").textContent = "";
    byId("ra-heard").textContent = "";
    byId("ra-fb").textContent = "按 OK 开始跟读";
    byId("ra-mic").classList.remove("rec");
    R.busy = false;
    try { if (typeof speak === "function") speak(R.target); } catch (er) { }
  }
  function score(heard) {
    var e = R.list[R.i];
    var sim = similarity(R.target, heard);
    var sc = Math.round(sim * 100);
    R.scores.push(sc); R.lastHeard = heard;
    var st = stars(sc);
    var el = byId("ra-score");
    el.textContent = sc + " 分";
    el.className = "ra-score" + (sc >= 65 ? "" : (sc >= 40 ? " mid" : " bad"));
    byId("ra-stars").textContent = starStr(st);
    byId("ra-heard").innerHTML = "电视听到:<b>" + esc2(heard || "(没听清)") + "</b>";
    byId("ra-fb").textContent = sc >= 85 ? "标准!按 OK 继续" : (sc >= 65 ? "不错,再清晰一点 · 按 OK 继续" : "差一点,可以按上键再听示范 · 按 OK 继续");
    byId("ra-mic").classList.remove("rec");
    sfx(sc >= 65 ? "good" : "bad");
    // 跟读达标计入 FSRS
    try { if (typeof schedHit === "function" && e) schedHit(e.w, sc >= 65); } catch (er) { }
    R.busy = true;   // 等待 OK 进入下一题
    R.phase = "scored";
  }
  function next() {
    R.i++;
    if (R.i >= R.list.length) { finish(); return; }
    R.phase = "ready"; renderItem();
  }
  function finish() {
    R.phase = "finish";
    var n = R.scores.length;
    var avg = n ? Math.round(R.scores.reduce(function (a, b) { return a + b; }, 0) / n) : 0;
    var good = R.scores.filter(function (s) { return s >= 65; }).length;
    try {
      if (typeof gameResult === "function") gameResult("readaloud", good, Math.max(1, n), avg * 10);
    } catch (e) { }
    byId("ra-kick").textContent = "SESSION COMPLETE";
    byId("ra-target").textContent = "平均 " + avg + " 分";
    byId("ra-target").className = "ra-target";
    byId("ra-phon").textContent = starStr(stars(avg));
    byId("ra-mean").textContent = n + " 句中有 " + good + " 句达标(65 分以上)";
    byId("ra-score").textContent = ""; byId("ra-stars").textContent = "";
    byId("ra-heard").textContent = "";
    byId("ra-fb").textContent = "按 OK 再来一组 · 返回退出";
    byId("ra-mic").classList.remove("rec");
    byId("ra-round").textContent = "完成";
    sfx(avg >= 75 ? "win" : "ok");
    if (avg >= 85 && window.celebrate) window.celebrate("发音很棒!");
  }

  function open() {
    if (!installUi()) { try { toast("跟读界面初始化失败"); } catch (e) { } return; }
    var hasMic = false;
    try { hasMic = !!(window.Bridge && window.Bridge.hasVoice && NativeBridge.hasVoice()); } catch (e) { }
    if (!hasMic) { try { toast("此电视/版本不支持麦克风,无法使用口语跟读"); } catch (e) { } return; }
    var list = prepare();
    if (!list) { try { toast("可跟读的单词不足 4 个,先学几个词或到设置放宽「训练词源」"); } catch (e) { } return; }
    R.runId++; R.active = true; R.phase = "ready";
    R.list = list; R.i = 0; R.scores = []; R.busy = false;
    try { show("readaloud"); } catch (e) { }
    renderItem();
  }
  function stop() { R.active = false; R.phase = "off"; try { if (typeof cancelVoice === "function") cancelVoice(); } catch (e) { } }

  // 由 app.js 的 window.onVoice 在本屏时转交
  function handleVoice(text) {
    if (!R.active || R.phase !== "recording") return;
    score(String(text || ""));
  }

  function key(k) {
    if (!R.active) return;
    if (k === "BACK") {
      if (R.phase === "recording") { try { cancelVoice(); } catch (e) { } R.phase = "ready"; byId("ra-mic").classList.remove("rec"); byId("ra-fb").textContent = "已取消 · 按 OK 重新开始"; return; }
      stop(); try { show("arcade"); } catch (e) { } return;
    }
    if (R.phase === "finish") { if (k === "OK") open(); return; }
    if (k === "UP" || k === "PLAY" || k === "MENU") { try { if (typeof speak === "function") speak(R.target); } catch (e) { } return; }
    // 已评分再按"下"只是进入下一题;仅在未作答时才记 0 分跳过
    if (k === "DOWN") {
      if (R.phase === "scored") { next(); return; }
      if (R.phase === "ready") { R.scores.push(0); next(); }
      return;
    }
    if (k === "OK") {
      if (R.phase === "recording") { try { stopVoice(); } catch (e) { } return; }
      if (R.phase === "scored") { next(); return; }
      if (R.phase === "ready") {
        R.phase = "recording";
        byId("ra-mic").classList.add("rec");
        byId("ra-fb").textContent = "正在录音 · 说完再按一次 OK";
        try { startVoice("en"); } catch (e) { R.phase = "ready"; byId("ra-mic").classList.remove("rec"); }
      }
    }
  }

  try { handlers.readaloud = { enter: function () { }, key: key }; } catch (e) { }
  window.ReadAloud = { open: open, stop: stop, handleVoice: handleVoice };
})();
