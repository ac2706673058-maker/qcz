/* ================= LexTV 词境 ================= */
"use strict";
function _dummyEl() { return document.createElement("div"); }
const $ = id => document.getElementById(id) || _dummyEl();
window.onerror = function (msg, src, line) { try { toast("程序错误:" + msg + " @" + line); } catch (e) { } return true; };
const NOW = () => Date.now();
const DAY = 86400000;
const todayStr = (t) => { const d = new Date(t || NOW()); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const NativeBridge = window.Bridge || {
  speak: (t, r) => { try { const u = new SpeechSynthesisUtterance(t); u.lang = "en-US"; u.rate = r; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { } },
  stopSpeak: () => { try { speechSynthesis.cancel(); } catch (e) { } },
  isTtsReady: () => true,
  save: (k, v) => localStorage.setItem("lex_" + k, v),
  load: (k) => localStorage.getItem("lex_" + k) || "",
  getDecks: () => "[]",
  readDeckFile: () => "[]",
  exitApp: () => { }
};
let ttsOK = true;
window.onTtsReady = ok => { ttsOK = !!ok; };

let WORDS = {};
let DECKS = [];
let P = null;
const DEFAULTS = { xp: 0, streak: 0, lastDay: "", dayLog: {}, dayNew: {}, words: {}, decksOff: {}, tr: {}, set: { newPerDay: 20, tts: 1, auto: 1, rate: 0.9 } };

/* ================= 使用者档案(双模式) =================
   fin  = 爸爸·金融投资(沿用老进度key,升级无损)
   teen = 弟弟·中考冲刺(独立进度,隐藏金融功能,词库按 profile 过滤) */
const PROFILES = {
  fin: {
    name: "爸爸 · 金融投资", short: "💼 爸爸", icon: "💼", store: "progress",
    menuHide: {}, deckOk: p => p !== "teen",
    slogans: ["看懂<em>世界</em>的词汇", "读懂<em>硅谷</em>与华尔街", "今天也在<em>变强</em>", "新闻不再<em>陌生</em>", "词汇是<em>带宽</em>"]
  },
  teen: {
    name: "弟弟 · 中考冲刺", short: "🎒 弟弟", icon: "🎒", store: "progress_teen",
    menuHide: { sim: 1, screens: 1 }, deckOk: p => p !== "fin",
    slogans: ["中考词汇<em>稳稳拿下</em>", "每天进步<em>一点点</em>", "单词是<em>分数</em>", "背过的词<em>不会背叛你</em>", "考场见<em>真章</em>"]
  }
};
let CUR = "fin";
const PF = () => PROFILES[CUR];
function loadApp() {
  try { const s = NativeBridge.load("app"); if (s) { const a = JSON.parse(s); if (a && a.profile === "teen") CUR = "teen"; } } catch (e) { }
}
function saveApp() { try { NativeBridge.save("app", JSON.stringify({ profile: CUR })); } catch (e) { } }

function loadP() {
  try { const s = NativeBridge.load(PF().store); P = s ? JSON.parse(s) : null; } catch (e) { P = null; }
  if (!P) P = JSON.parse(JSON.stringify(DEFAULTS));
  P.set = Object.assign({}, DEFAULTS.set, P.set || {});
  ["dayLog", "dayNew", "words", "decksOff", "tr"].forEach(k => { if (!P[k]) P[k] = {}; });
}
let saveTimer = null;
function saveP() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { NativeBridge.save(PF().store, JSON.stringify(P)); } catch (e) { } }, 600); }
function flushP() { clearTimeout(saveTimer); try { NativeBridge.save(PF().store, JSON.stringify(P)); } catch (e) { } }

function switchProfile(k) {
  if (!PROFILES[k]) return;
  if (k === CUR) { show("home"); return; }
  flushP();                       // 先把当前使用者的进度落盘
  CUR = k; saveApp();
  WORDS = {}; DECKS = [];
  loadP(); loadDecks();
  homeIdx = 0;
  show("home");
  toast("已切换到 " + PF().name + ",学习进度相互独立");
}

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function initSD(g) { return { S: Math.max(0.1, W[g - 1]), D: clamp(W[4] - (g - 3) * W[5], 1, 10) }; }
function retriev(t, S) { return Math.pow(1 + t / (9 * S), -1); }
function nextSD(S, D, R, g) {
  let nD = D - W[6] * (g - 3);
  nD = clamp(W[7] * (W[4] - W[5]) + (1 - W[7]) * nD, 1, 10);
  let nS;
  if (g === 1) {
    nS = Math.min(S, W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R)));
  } else {
    const hard = g === 2 ? W[15] : 1;
    const easy = g === 4 ? W[16] : 1;
    nS = S * (1 + Math.exp(W[8]) * (11 - nD) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hard * easy);
  }
  return { S: clamp(nS, 0.1, 3650), D: nD };
}
function rate(w, g) {
  const now = NOW();
  let rec = P.words[w];
  if (!rec || rec.st === 0 || rec.st === undefined) {
    const sd = initSD(g);
    rec = { st: g >= 3 ? 2 : 1, S: sd.S, D: sd.D, due: now + sd.S * DAY, reps: 1, lapses: g === 1 ? 1 : 0, last: now, fd: todayStr() };
  } else {
    const t = Math.max(0, (now - rec.last) / DAY);
    const R = retriev(t, rec.S);
    const sd = nextSD(rec.S, rec.D, R, g);
    rec.S = sd.S; rec.D = sd.D; rec.reps++; rec.last = now;
    if (g === 1) { rec.lapses++; rec.st = 1; rec.due = now + 10 * 60000; }
    else { rec.st = 2; rec.due = now + rec.S * DAY; }
  }
  P.words[w] = rec;
  bumpDay();
  P.xp += g === 3 ? 8 : g === 2 ? 4 : 2;
  saveP();
}
function bumpDay() {
  const d = todayStr();
  if (P.lastDay !== d) {
    const y = todayStr(NOW() - DAY);
    P.streak = (P.lastDay === y) ? P.streak + 1 : 1;
    P.lastDay = d;
  }
  P.dayLog[d] = (P.dayLog[d] || 0) + 1;
}
const level = () => Math.floor(Math.sqrt(P.xp / 60)) + 1;

function loadDecks() {
  let list = [];
  try { list = JSON.parse(NativeBridge.getDecks()); } catch (e) { list = []; }
  DECKS = [];
  // 按使用者过滤词库:manifest 里 profile 标 "fin"/"teen",不标=双方共用;U盘外部词库双方可见
  list = list.filter(d => d.source === "ext" || PF().deckOk(d.profile || ""));
  for (const d of list) {
    let total = 0;
    for (const f of (d.files || [])) {
      let arr = [];
      try { arr = JSON.parse(NativeBridge.readDeckFile(d.source, f)); } catch (e) { arr = []; }
      for (const e of arr) {
        if (!e || !e[0]) continue;
        const w = String(e[0]).trim();
        if (WORDS[w]) continue;
        WORDS[w] = { w: w, p: e[1] || "", m: e[2] || "", x: e[3] || "", tr: e[4] || "", deck: d.id };
        total++;
      }
    }
    DECKS.push({ id: d.id, name: d.name, icon: d.icon || "📘", source: d.source, total: total });
  }
}
const deckOn = id => !P.decksOff[id];
const deckName = id => { const d = DECKS.find(x => x.id === id); return d ? d.name : ""; };
function activeWords() { return Object.values(WORDS).filter(e => deckOn(e.deck)); }
function newQuota() { return Math.max(0, P.set.newPerDay - (P.dayNew[todayStr()] || 0)); }
function pickNew(n) {
  const out = [];
  for (const e of activeWords()) { const r = P.words[e.w]; if (!r || !r.st) { out.push(e); if (out.length >= n * 3) break; } }
  return shuffle(out).slice(0, n);
}
function dueWords() {
  const now = NOW();
  return activeWords().filter(e => { const r = P.words[e.w]; return r && r.st > 0 && r.due <= now; })
    .sort((a, b) => P.words[a.w].due - P.words[b.w].due);
}
function seenWords() { return activeWords().filter(e => { const r = P.words[e.w]; return r && r.st > 0; }); }

let _player = null;
let _speakSeq = 0;
function nativeSpeak(t) { if (ttsOK) { try { NativeBridge.speak(t, P.set.rate); } catch (e) { } } }
function ydUrl(t) { return "https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(t) + "&type=2"; }
function splitSentences(t) {
  // 按句末标点/逗号切成短段,有道对短段支持好;每段限长
  var raw = String(t).replace(/\s+/g, " ").trim();
  if (!raw) return [];
  var parts = raw.split(/(?<=[.!?;:,，。！？；：])\s*/);
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (!p) continue;
    // 单段仍太长则按空格再切到<=60字符
    while (p.length > 60) {
      var cut = p.lastIndexOf(" ", 60);
      if (cut < 20) cut = 60;
      out.push(p.slice(0, cut).trim());
      p = p.slice(cut).trim();
    }
    if (p) out.push(p);
  }
  return out;
}
/* 发音引擎v2:优先走原生(整句一次合成+MediaPlayer+缓存,彻底解决漏读);
   原生不可用(浏览器调试/旧APK)时降级到 webSpeak 旧逻辑 */
const hasNativeTts = (() => { try { return !!(window.Bridge && window.Bridge.hasNativeTts && window.Bridge.hasNativeTts()); } catch (e) { return false; } })();
let _spkErrToast = 0;
window.onSpeakDone = () => { };
window.onSpeakErr = () => {
  const now = NOW();
  if (now - _spkErrToast > 60000) { _spkErrToast = now; toast("发音获取失败,请检查电视网络"); }
};
function speak(t) {
  if (!P.set.tts || !t) return;
  t = String(t).replace(/\s+/g, " ").trim();
  if (!t) return;
  if (hasNativeTts) {
    try { NativeBridge.speakText(t, P.set.rate || 1); return; } catch (e) { }
  }
  webSpeak(t);
}
function webSpeak(t) {
  if (!P.set.tts || !t) return;
  try { NativeBridge.stopSpeak(); } catch (e) { }
  try { if (_player) { _player.pause(); _player.src = ""; _player = null; } } catch (e) { }
  if (typeof Audio === "undefined") { nativeSpeak(t); return; }
  var segs = splitSentences(t);
  if (!segs.length) return;
  var seq = ++_speakSeq;
  var idx = 0;
  var timer = null;
  function clearT() { if (timer) { clearTimeout(timer); timer = null; } }
  function playNext() {
    clearT();
    if (seq !== _speakSeq) return;
    if (idx >= segs.length) { _player = null; return; }
    var seg = segs[idx++];
    var advanced = false;
    function advance() { if (advanced || seq !== _speakSeq) return; advanced = true; clearT(); playNext(); }
    try {
      var a = new Audio(ydUrl(seg));
      _player = a;
      a.playbackRate = P.set.rate || 1;
      a.onended = advance;
      a.onerror = function () { if (idx === 1 && segs.length === 1) { advanced = true; nativeSpeak(seg); } else advance(); };
      // 元数据到位后按真实时长兜底(onended没触发时也能接上)
      a.onloadedmetadata = function () {
        if (seq !== _speakSeq) return;
        var dur = a.duration;
        if (isFinite(dur) && dur > 0) {
          clearT();
          timer = setTimeout(advance, (dur / (a.playbackRate || 1)) * 1000 + 350);
        }
      };
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () { });
      // 最后兜底:每段最多给12秒,防止卡死
      timer = setTimeout(advance, 12000);
    } catch (e) { advance(); }
  }
  playNext();
}

let toastT = null;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }

let SCREEN = "home";
const handlers = {};
function show(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(name).classList.add("active");
  SCREEN = name;
  try { if (handlers[name] && handlers[name].enter) handlers[name].enter(); }
  catch (e) { toast("界面错误:" + (e && e.message)); }
}
window.onTvKey = k => {
  try { $("toast").classList.remove("show"); } catch (e) { }
  const h = handlers[SCREEN];
  try { if (h && h.key) h.key(k); } catch (e) { toast("按键错误:" + (e && e.message)); }
};
document.addEventListener("keydown", e => {
  const map = { ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT", Enter: "OK", Escape: "BACK", Backspace: "BACK" };
  if (map[e.key]) { e.preventDefault(); window.onTvKey(map[e.key]); }
});

const MENU = [
  { id: "new", ic: "✒️", t: "学新词", d: "衬线大字卡 · 自动发音" },
  { id: "review", ic: "🧠", t: "智能复习", d: "FSRS 记忆算法调度" },
  { id: "quiz", ic: "⚡", t: "闪电测验", d: "限时四选一 · 连击得分" },
  { id: "listen", ic: "🎧", t: "听音辨义", d: "只听发音 · 训练听力反应" },
  { id: "cloze", ic: "📝", t: "例句填空", d: "读懂整句中文选英文词" },
  { id: "spell", ic: "⌨️", t: "拼写挑战", d: "听音看义 · 遥控器拼单词" },
  { id: "match", ic: "🀄", t: "词义配对", d: "消除式配对 · 上瘾警告" },
  { id: "tf", ic: "⚖️", t: "极速判断", d: "对错二选一 · 拼反应" },
  { id: "battle", ic: "🤖", t: "人机对战", d: "和AI拼速度拼准度" },
  { id: "sim", ic: "🏦", t: "实景模拟", d: "盈透/港新银行App动画实操课" },
  { id: "screens", ic: "📱", t: "界面对照", d: "对着券商/银行App学界面英文" },
  { id: "browse", ic: "📖", t: "单词本", d: "今日新学 · 全部已学" },
  { id: "custom", ic: "🗓️", t: "自选复习", d: "按日期挑单词随时复习" },
  { id: "ai", ic: "👨‍🏫", t: "AI 外教", d: "对话 · 跟读 · 情景课 · 教练" },
  { id: "decks", ic: "📚", t: "词库", d: "开关词书 · 外部扩展" },
  { id: "stats", ic: "📊", t: "统计", d: "热力图 · 掌握度" },
  { id: "who", ic: "👥", t: "切换使用者", d: "爸爸金融版 ⇄ 弟弟中考版" },
  { id: "settings", ic: "⚙️", t: "设置", d: "新词量 · 发音 · 语速" }
];
function homeItems() { return MENU.filter(it => !PF().menuHide[it.id]); }
function homeCols() { return homeItems().length > 16 ? 5 : 4; }
let homeIdx = 0;
handlers.home = {
  enter() {
    const items = homeItems();
    if (homeIdx >= items.length) homeIdx = 0;
    const due = dueWords().length;
    let unseen = 0;
    for (const e of activeWords()) { const r = P.words[e.w]; if (!r || !r.st) unseen++; }
    const newRemain = Math.min(newQuota(), unseen);
    $("h-streak").textContent = P.streak;
    $("h-level").textContent = level();
    $("h-mastered").textContent = Object.values(P.words).filter(r => r.st === 2 && r.S >= 21).length;
    $("h-due").textContent = due + newRemain;
    $("h-user").textContent = PF().short;
    $("h-slogan").innerHTML = PF().slogans[new Date().getDate() % PF().slogans.length];
    $("h-sub").textContent = due > 0 ? ("待复习 " + due + " 个 · 今日新词剩余 " + newRemain + " 个") : ("今日新词剩余 " + newRemain + " 个 · 无待复习,棒!");
    const m = $("menu"); m.innerHTML = "";
    m.style.gridTemplateColumns = "repeat(" + homeCols() + ",1fr)";
    m.classList.toggle("dense", items.length > 16);
    items.forEach((it, i) => {
      const el = document.createElement("div");
      el.className = "mcard" + (i === homeIdx ? " focus" : "");
      let badge = "";
      if (it.id === "review" && due) badge = '<div class="badge">' + due + '</div>';
      if (it.id === "new" && newRemain) badge = '<div class="badge">' + newRemain + '</div>';
      el.innerHTML = badge + '<div class="ic">' + it.ic + '</div><div><div class="t">' + it.t + '</div><div class="d">' + it.d + '</div></div>';
      m.appendChild(el);
    });
  },
  key(k) {
    const items = homeItems();
    const cols = homeCols(), n = items.length;
    if (k === "LEFT") homeIdx = (homeIdx + n - 1) % n;
    else if (k === "RIGHT") homeIdx = (homeIdx + 1) % n;
    else if (k === "UP") homeIdx = (homeIdx - cols + n) % n;
    else if (k === "DOWN") homeIdx = (homeIdx + cols) % n;
    else if (k === "OK") { openMenu(items[homeIdx].id); return; }
    else if (k === "BACK") { NativeBridge.exitApp(); return; }
    handlers.home.enter();
  }
};
function openMenu(id) {
  if (id === "new") startStudy("new");
  else if (id === "review") startStudy("review");
  else if (id === "quiz") startQuiz("quiz");
  else if (id === "listen") startQuiz("listen");
  else if (id === "cloze") startQuiz("cloze");
  else if (id === "match") startMatch();
  else if (id === "tf") startTF(false);
  else if (id === "battle") startTF(true);
  else if (id === "browse") { BR.tab = 0; BR.idx = 0; show("browse"); }
  else if (id === "custom") { CU.idx = 0; show("custom"); }
  else if (id === "sim") { simOpen(); }
  else if (id === "spell") { startSpell(); }
  else if (id === "who") { WHO.idx = CUR === "fin" ? 0 : 1; show("who"); }
  else if (id === "screens") { SC.view = "list"; SC.gi = 0; show("screens"); }
  else if (id === "ai") show("ai");
  else show(id);
}

/* ================= 学习(新词/复习/自选) ================= */
const ST = { queue: [], i: 0, mode: "new", phase: "front", done: 0, again: 0, total: 0, lock: false, label: "" };
function startStudy(mode) {
  let q;
  if (mode === "new") {
    const n = newQuota();
    if (!n) { toast("今日新词已学完,去复习或测验吧"); return; }
    q = pickNew(n);
    if (!q.length) { toast("当前词库的新词都学完了!"); return; }
  } else {
    q = dueWords().slice(0, 120);
    if (!q.length) { toast("暂时没有到期的复习,休息一下"); return; }
  }
  ST.queue = q; ST.i = 0; ST.mode = mode; ST.done = 0; ST.again = 0; ST.total = q.length;
  show("study"); renderCard();
}
function renderCard() {
  const e = ST.queue[ST.i];
  ST.phase = "front"; ST.lock = false;
  $("s-mode").textContent = ST.mode === "new" ? "学新词" : (ST.mode === "custom" ? "自选复习 " + (ST.label || "") : "智能复习");
  $("s-prog").textContent = (ST.done + 1) + " / " + ST.total;
  $("s-bar").style.width = (ST.done / ST.total * 100) + "%";
  $("s-card").classList.remove("flipped");
  $("s-tag").textContent = ST.mode === "new" ? "NEW" : "REVIEW";
  $("s-deck").textContent = deckName(e.deck);
  $("s-word").textContent = e.w; $("s-word2").textContent = e.w;
  $("s-phon").textContent = e.p ? "/" + e.p + "/" : "";
  $("s-phon2").textContent = e.p ? "/" + e.p + "/" : "";
  $("s-mean").textContent = e.m;
  $("s-ex").innerHTML = highlight(e.x, e.w);
  document.querySelectorAll(".jbtn").forEach(b => b.classList.remove("focus"));
  if (P.set.auto) setTimeout(() => speak(e.w), 250);
}
function highlight(sent, w) {
  if (!sent) return "";
  const stem = w.slice(0, Math.max(3, w.length - 2)).toLowerCase();
  return esc(sent).replace(new RegExp("\\b(" + stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[a-z]*)", "i"), "<b>$1</b>");
}
function flipCard() {
  const e = ST.queue[ST.i];
  $("s-card").classList.add("flipped");
  ST.phase = "back";
  speak(e.w + ". " + (e.x || ""));
}
function judge(g) {
  if (ST.lock) return;
  ST.lock = true;
  const e = ST.queue[ST.i];
  const btn = g === 1 ? "j-no" : g === 2 ? "j-mid" : "j-yes";
  $(btn).classList.add("focus");
  if (ST.mode === "new" && (!P.words[e.w] || !P.words[e.w].st)) P.dayNew[todayStr()] = (P.dayNew[todayStr()] || 0) + 1;
  rate(e.w, g);
  if (g < 3) { ST.again++; ST.queue.splice(Math.min(ST.queue.length, ST.i + 4), 0, e); ST.total = ST.queue.length; }
  ST.done++;
  setTimeout(() => {
    ST.i++;
    if (ST.i >= ST.queue.length) finishSession();
    else renderCard();
  }, 260);
}
handlers.study = {
  key(k) {
    if (k === "BACK") { show("home"); return; }
    if (ST.lock) return;
    if (ST.phase === "front") {
      if (k === "OK") flipCard();
      else if (k === "RIGHT") judge(3);
      else if (k === "LEFT") { ST.lock = true; flipCard(); setTimeout(() => { ST.lock = false; judge(1); }, 900); }
      else if (k === "DOWN") { ST.lock = true; flipCard(); setTimeout(() => { ST.lock = false; judge(2); }, 900); }
      else if (k === "PLAY" || k === "MENU") speak(ST.queue[ST.i].w);
    } else {
      if (k === "RIGHT") judge(3);
      else if (k === "LEFT") judge(1);
      else if (k === "DOWN") judge(2);
      else if (k === "OK" || k === "PLAY" || k === "MENU") { speak(ST.queue[ST.i].w); }
    }
  }
};
function finishSession() {
  const acc = ST.total ? Math.round((ST.total - ST.again) / ST.total * 100) : 100;
  $("f-title").textContent = ST.mode === "new" ? "新词学完!" : "复习完成!";
  $("f-xp").textContent = "+" + (ST.done * 6) + " XP · Lv." + level();
  $("f-stats").innerHTML =
    '<div class="stat"><div class="n">' + ST.total + '</div><div class="l">完成卡片</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--good)">' + acc + '%</div><div class="l">初见即会</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">🔥' + P.streak + '</div><div class="l">连续天数</div></div>';
  $("f-msg").textContent = acc >= 85 ? "状态极佳,记忆曲线已为你安排好下次复习" : "没关系,忘记是记忆的必经之路,算法会加密复习";
  show("finish");
}
handlers.finish = { key(k) { if (k === "OK" || k === "BACK") show("home"); } };

/* ================= 测验(闪电/听音/填空) ================= */
const QZ = { list: [], i: 0, mode: "quiz", sel: 0, score: 0, combo: 0, best: 0, right: 0, lock: false, timer: null, tStart: 0, ansIdx: 0, optCount: 4 };
const QUIZ_N = 15, QUIZ_MS = 9000;
function startQuiz(mode) {
  if (mode === "listen" && !P.set.tts) { toast("请先在设置中开启发音"); return; }
  let pool = seenWords();
  if (mode === "cloze") pool = pool.filter(e => e.x && e.x.length > 8);
  if (pool.length < 8) { toast("先学至少 8 个新词再来挑战"); return; }
  QZ.list = shuffle(pool.slice()).slice(0, QUIZ_N);
  QZ.i = 0; QZ.mode = mode; QZ.score = 0; QZ.combo = 0; QZ.best = 0; QZ.right = 0;
  show("quiz"); renderQuiz();
}
function renderQuiz() {
  QZ.lock = false; QZ.sel = 0;
  const e = QZ.list[QZ.i];
  $("q-mode").textContent = QZ.mode === "quiz" ? "闪电测验" : (QZ.mode === "listen" ? "听音辨义" : "例句填空");
  $("q-prog").textContent = (QZ.i + 1) + " / " + QZ.list.length;
  $("q-score").textContent = QZ.score + " 分";
  $("q-combo").textContent = QZ.combo > 1 ? "⚡连击 ×" + QZ.combo : "";
  $("q-fb").textContent = "";
  const opts = [e];
  const pool = shuffle(activeWords().filter(x => x.w !== e.w && x.m !== e.m));
  // 例句填空优先用同词库的干扰项,更贴近主题也更有挑战
  pool.sort((a, b) => (a.deck === e.deck ? 0 : 1) - (b.deck === e.deck ? 0 : 1));
  for (const c of pool) { if (opts.length >= 4) break; opts.push(c); }
  shuffle(opts);
  QZ.ansIdx = opts.indexOf(e);
  QZ.optCount = opts.length;
  const box = $("q-opts"); box.innerHTML = "";
  if (QZ.mode === "quiz" || QZ.mode === "listen") {
    $("q-word").style.display = ""; $("q-phon").style.display = ""; $("q-sent").style.display = "none";
    if (QZ.mode === "listen") {
      $("q-word").textContent = "🎧";
      $("q-phon").textContent = "仔细听发音,选出正确释义 · 稍等会自动重播";
      const qi = QZ.i;
      setTimeout(() => { if (SCREEN === "quiz" && QZ.i === qi && !QZ.lock) speak(e.w); }, 3500);
    } else {
      $("q-word").textContent = e.w;
      $("q-phon").textContent = e.p ? "/" + e.p + "/" : "";
    }
    opts.forEach((o, i) => {
      const d = document.createElement("div");
      d.className = "opt" + (i === 0 ? " focus" : "");
      d.innerHTML = '<span class="idx">' + (i + 1) + '</span><span>' + esc(o.m) + '</span>';
      box.appendChild(d);
    });
    speak(e.w);
  } else {
    $("q-word").style.display = "none"; $("q-phon").style.display = "none"; $("q-sent").style.display = "";
    const stem = e.w.slice(0, Math.max(3, e.w.length - 2));
    const re = new RegExp("\\b" + stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[a-zA-Z]*", "i");
    // 上方:挖空的英文整句 + 整句中文翻译(靠读懂句子来选词)
    $("q-sent").innerHTML = esc(e.x).replace(re, "<b>______</b>")
      + '<div id="q-tr" style="font-size:2.9vmin;color:var(--gold);margin-top:2.4vmin;line-height:1.6"></div>';
    setClozeTr(e);
    // 四个选项:只显示英文单词,不给中文释义
    opts.forEach((o, i) => {
      const d = document.createElement("div");
      d.className = "opt cloze" + (i === 0 ? " focus" : "");
      d.innerHTML = '<span class="idx">' + (i + 1) + '</span><span class="serif" style="font-size:4.6vmin;letter-spacing:.01em">' + esc(o.w) + '</span>';
      box.appendChild(d);
    });
  }
  clearInterval(QZ.timer); QZ.tStart = NOW();
  if (QZ.mode === "cloze") {
    // 例句填空不限时:隐藏计时条,不启动倒计时
    $("q-timer").style.width = "0%";
  } else {
    $("q-timer").style.width = "100%";
    QZ.timer = setInterval(() => {
      const left = 1 - (NOW() - QZ.tStart) / QUIZ_MS;
      $("q-timer").style.width = Math.max(0, left * 100) + "%";
      if (left <= 0) answer(-1);
    }, 100);
  }
}
function moveSel(k) {
  const n = QZ.optCount || 4;
  if (n < 2) return;
  if (k === "UP") QZ.sel = (QZ.sel + n - 2 + n) % n;
  else if (k === "DOWN") QZ.sel = (QZ.sel + 2) % n;
  else if (k === "LEFT" || k === "RIGHT") QZ.sel = (QZ.sel % 2 === 0) ? Math.min(QZ.sel + 1, n - 1) : QZ.sel - 1;
  document.querySelectorAll("#q-opts .opt").forEach((o, i) => o.classList.toggle("focus", i === QZ.sel));
}
function answer(idx) {
  if (QZ.lock) return;
  QZ.lock = true; clearInterval(QZ.timer);
  const e = QZ.list[QZ.i];
  const opts = document.querySelectorAll("#q-opts .opt");
  const ok = idx === QZ.ansIdx;
  if (opts[QZ.ansIdx]) opts[QZ.ansIdx].classList.add("right");
  if (!ok && idx >= 0 && opts[idx]) opts[idx].classList.add("wrong");
  if (QZ.mode === "listen") { $("q-word").textContent = e.w; $("q-phon").textContent = e.p ? "/" + e.p + "/" : ""; }
  if (ok) {
    QZ.combo++; QZ.best = Math.max(QZ.best, QZ.combo); QZ.right++;
    const gain = 10 + Math.min(10, QZ.combo * 2);
    QZ.score += gain; P.xp += 5;
    $("q-combo").textContent = "⚡连击 ×" + QZ.combo; $("q-combo").classList.remove("pop"); void $("q-combo").offsetWidth; $("q-combo").classList.add("pop");
    $("q-fb").textContent = QZ.mode === "listen" ? e.w + "  +" + gain : "+" + gain;
  } else {
    QZ.combo = 0;
    $("q-fb").textContent = e.w + " → " + e.m;
    speak(e.w);
  }
  const r = P.words[e.w];
  if (r && r.due <= NOW() + DAY / 2) rate(e.w, ok ? 3 : 1); else { bumpDay(); saveP(); }
  if (QZ.mode === "cloze" && ok) speak(e.x);
  setTimeout(() => {
    QZ.i++;
    if (QZ.i >= QZ.list.length) finishQuiz(); else renderQuiz();
  }, ok ? 900 : 1900);
}
function finishQuiz() {
  $("f-title").textContent = QZ.right === QZ.list.length ? "全对!完美!" : "测验完成";
  $("f-xp").textContent = "+" + (QZ.right * 5) + " XP · 得分 " + QZ.score;
  $("f-stats").innerHTML =
    '<div class="stat"><div class="n" style="color:var(--good)">' + QZ.right + '/' + QZ.list.length + '</div><div class="l">答对</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">×' + QZ.best + '</div><div class="l">最高连击</div></div>'
    + '<div class="stat"><div class="n">' + QZ.score + '</div><div class="l">总分</div></div>';
  $("f-msg").textContent = QZ.right >= QZ.list.length * 0.8 ? "反应又快又准,词汇正在变成本能" : "错误的词已被算法标记,复习时会重点照顾";
  saveP(); show("finish");
}
/* 例句填空:显示整句中文翻译。优先用词库内置译文(第5字段),
   否则查本机缓存,再否则调用AI翻译一次并永久缓存。 */
let _trSeq = 0;
function setClozeTr(e) {
  const seq = ++_trSeq;
  const put = (txt, cls) => {
    const el = document.getElementById("q-tr");
    if (!el || seq !== _trSeq) return;
    el.textContent = txt;
    el.style.color = cls === "dim" ? "var(--dim)" : "var(--gold)";
  };
  if (e.tr) { put(e.tr); return; }
  if (!P.tr) P.tr = {};
  if (P.tr[e.w]) { put(P.tr[e.w]); return; }
  put("　整句翻译加载中…", "dim");
  aiCall([
    { role: "system", content: "你是专业翻译。把用户给的英文句子翻译成通顺自然的简体中文,只输出译文本身,不要加引号、拼音、英文或任何解释。" },
    { role: "user", content: e.x }
  ], (content, err) => {
    if (content) {
      const t = String(content).replace(/^[\s"'「」]+|[\s"'「」]+$/g, "").trim();
      if (t) { P.tr[e.w] = t; saveP(); put(t); return; }
    }
    put("（整句翻译需联网,可稍后再进此题）", "dim");
  }, 240);
}

handlers.quiz = {
  key(k) {
    if (k === "BACK") { clearInterval(QZ.timer); show("home"); return; }
    if (k === "MENU" || k === "PLAY") { speak(QZ.list[QZ.i].w); return; }
    if (QZ.lock) return;
    if (k === "OK") answer(QZ.sel);
    else if (["UP", "DOWN", "LEFT", "RIGHT"].includes(k)) moveSel(k);
  }
};

/* ================= 单词本 ================= */
const BR = { tab: 0, idx: 0, list: [] };
const BTABS = ["今日新学", "全部已学", "今日待复习"];
function brData() {
  const td = todayStr(), now = NOW();
  const all = activeWords().filter(e => P.words[e.w] && P.words[e.w].st > 0);
  if (BR.tab === 0) return all.filter(e => P.words[e.w].fd === td);
  if (BR.tab === 2) return all.filter(e => P.words[e.w].due <= now);
  return all.sort((a, b) => P.words[b.w].last - P.words[a.w].last);
}
handlers.browse = {
  enter() {
    BR.list = brData();
    if (BR.idx >= BR.list.length) BR.idx = Math.max(0, BR.list.length - 1);
    $("b-tabs").innerHTML = BTABS.map((t, i) => '<div class="tab' + (i === BR.tab ? " on" : "") + '">' + t + (i === BR.tab ? " · " + BR.list.length : "") + '</div>').join("");
    const box = $("b-list"); box.innerHTML = "";
    if (!BR.list.length) { box.innerHTML = '<div class="empty"><div class="e1">🍃</div><div class="e3">这里还没有单词,先去学几个吧</div></div>'; return; }
    const win = 9, start = Math.max(0, Math.min(BR.idx - 4, BR.list.length - win));
    BR.list.slice(start, start + win).forEach((e, i) => {
      const r = P.words[e.w];
      const gap = r.due <= NOW() ? '<span style="color:var(--mid)">待复习</span>' : "间隔" + Math.max(1, Math.round(r.S)) + "天";
      const el = document.createElement("div");
      el.className = "brow" + (start + i === BR.idx ? " focus" : "");
      el.innerHTML = '<div class="w serif">' + esc(e.w) + '</div><div class="p">' + (e.p ? "/" + esc(e.p) + "/" : "") + '</div><div class="m">' + esc(e.m) + '</div><div class="g">' + gap + '</div>';
      box.appendChild(el);
    });
  },
  key(k) {
    if (k === "BACK") { show("home"); return; }
    if (k === "LEFT") { BR.tab = (BR.tab + 2) % 3; BR.idx = 0; }
    else if (k === "RIGHT") { BR.tab = (BR.tab + 1) % 3; BR.idx = 0; }
    else if (k === "UP") BR.idx = Math.max(0, BR.idx - 1);
    else if (k === "DOWN") BR.idx = Math.min(BR.list.length - 1, BR.idx + 1);
    else if ((k === "OK" || k === "PLAY") && BR.list[BR.idx]) { const e = BR.list[BR.idx]; speak(e.w + ". " + (e.x || "")); return; }
    handlers.browse.enter();
  }
};

/* ================= 自选复习 ================= */
const CU = { idx: 0, dates: [] };
function cuDates() {
  const map = {};
  for (const k in P.words) { const r = P.words[k]; if (r.st > 0 && r.fd) map[r.fd] = (map[r.fd] || 0) + 1; }
  return Object.keys(map).sort().reverse().map(d => ({ d: d, n: map[d] }));
}
handlers.custom = {
  enter() {
    CU.dates = cuDates();
    if (CU.idx >= CU.dates.length) CU.idx = Math.max(0, CU.dates.length - 1);
    const box = $("c-list"); box.innerHTML = "";
    if (!CU.dates.length) { box.innerHTML = '<div class="empty"><div class="e1">🍃</div><div class="e3">还没有学习记录,先去学几个新词吧</div></div>'; return; }
    const td = todayStr();
    const win = 9, start = Math.max(0, Math.min(CU.idx - 4, CU.dates.length - win));
    CU.dates.slice(start, start + win).forEach((it, i) => {
      const el = document.createElement("div");
      el.className = "rowitem" + (start + i === CU.idx ? " focus" : "");
      el.innerHTML = '<div class="ic">📅</div><div class="info"><div class="name">' + it.d + (it.d === td ? ' <span style="color:var(--gold);font-size:2vmin">今天</span>' : "") + '</div><div class="desc">该日新学 ' + it.n + ' 个单词</div></div><div class="val">OK 复习</div>';
      box.appendChild(el);
    });
  },
  key(k) {
    if (k === "BACK") { show("home"); return; }
    if (!CU.dates.length) return;
    if (k === "UP") CU.idx = Math.max(0, CU.idx - 1);
    else if (k === "DOWN") CU.idx = Math.min(CU.dates.length - 1, CU.idx + 1);
    else if (k === "OK") {
      const d = CU.dates[CU.idx].d;
      const list = activeWords().filter(e => P.words[e.w] && P.words[e.w].st > 0 && P.words[e.w].fd === d);
      if (!list.length) { toast("该日期没有可复习的单词"); return; }
      ST.queue = shuffle(list.slice()); ST.i = 0; ST.mode = "custom"; ST.label = d;
      ST.done = 0; ST.again = 0; ST.total = ST.queue.length;
      show("study"); renderCard(); return;
    }
    handlers.custom.enter();
  }
};

function schedHit(w, ok) { const r = P.words[w]; if (r && r.due <= NOW() + DAY / 2) rate(w, ok ? 3 : 1); else { bumpDay(); saveP(); } }

/* ================= 词义配对 ================= */
const MT = { cells: [], idx: 0, sel: -1, round: 0, rounds: 5, score: 0, combo: 0, best: 0, right: 0, wrong: 0, pool: [], lock: false, err: null };
function startMatch() {
  const pool = seenWords();
  if (pool.length < 12) { toast("先学至少 12 个新词再来配对"); return; }
  MT.pool = shuffle(pool.slice()); MT.round = 0; MT.rounds = Math.min(5, Math.floor(MT.pool.length / 4));
  MT.score = 0; MT.combo = 0; MT.best = 0; MT.right = 0; MT.wrong = 0; MT.err = null;
  show("match"); renderMatch();
}
function renderMatch() {
  MT.lock = false; MT.sel = -1; MT.idx = 0; MT.err = null;
  const four = MT.pool.slice(MT.round * 4, MT.round * 4 + 4);
  const words = shuffle(four.slice()), means = shuffle(four.slice());
  MT.cells = words.map(e => ({ t: "w", e: e, done: false })).concat(means.map(e => ({ t: "m", e: e, done: false })));
  $("m-prog").textContent = "第 " + (MT.round + 1) + " / " + MT.rounds + " 轮";
  $("m-fb").textContent = "OK 选中一个单词,再选它的释义,配对成功即消除 · 配错扣5分";
  drawMatch();
}
function drawMatch() {
  $("m-combo").textContent = MT.combo > 1 ? "⚡连击 ×" + MT.combo : "";
  $("m-score").textContent = MT.score + " 分";
  const g = $("m-grid"); g.innerHTML = "";
  for (let row = 0; row < 4; row++) {
    [row, 4 + row].forEach(i => {
      const c = MT.cells[i];
      const d = document.createElement("div");
      d.className = "opt" + (c.done ? " done" : "") + (i === MT.idx ? " focus" : "") + (i === MT.sel ? " selw" : "") + (MT.err && MT.err.indexOf(i) >= 0 ? " wrong" : "");
      d.innerHTML = c.t === "w" ? '<span class="serif" style="font-size:3.6vmin">' + esc(c.e.w) + '</span>' : '<span>' + esc(c.e.m) + '</span>';
      g.appendChild(d);
    });
  }
}
handlers.match = {
  key(k) {
    if (k === "BACK") { show("home"); return; }
    if (MT.lock) return;
    const col = MT.idx < 4 ? 0 : 1, row = MT.idx % 4;
    if (k === "UP") MT.idx = col * 4 + (row + 3) % 4;
    else if (k === "DOWN") MT.idx = col * 4 + (row + 1) % 4;
    else if (k === "LEFT" || k === "RIGHT") MT.idx = (col === 0 ? 4 : 0) + row;
    else if (k === "OK") {
      const c = MT.cells[MT.idx];
      if (!c || c.done) { drawMatch(); return; }
      if (MT.sel === -1) MT.sel = MT.idx;
      else if (MT.sel === MT.idx) MT.sel = -1;
      else {
        const a = MT.cells[MT.sel], b = c;
        if (a.t === b.t) { MT.sel = MT.idx; drawMatch(); return; }
        const word = (a.t === "w" ? a : b).e;
        if (a.e.w === b.e.w) {
          a.done = true; b.done = true; MT.sel = -1;
          MT.combo++; MT.best = Math.max(MT.best, MT.combo); MT.right++;
          MT.score += 10 + Math.min(10, MT.combo * 2); P.xp += 4;
          $("m-fb").textContent = "✓ " + word.w;
          speak(word.w); schedHit(word.w, true);
          if (MT.cells.every(x => x.done)) {
            MT.lock = true;
            setTimeout(() => { MT.round++; if (MT.round >= MT.rounds) finishMatch(); else renderMatch(); }, 500);
          }
        } else {
          MT.combo = 0; MT.wrong++;
          MT.score = Math.max(0, MT.score - 5);
          MT.err = [MT.sel, MT.idx];
          MT.sel = -1;
          $("m-fb").textContent = "✗ 配错了! -5分 · " + word.w + " 的释义是: " + word.m;
          schedHit(word.w, false);
          MT.lock = true;
          setTimeout(() => { MT.err = null; MT.lock = false; drawMatch(); }, 700);
        }
      }
    }
    drawMatch();
  }
};
function finishMatch() {
  const tot = MT.right + MT.wrong;
  const acc = tot ? Math.round(MT.right / tot * 100) : 100;
  $("f-title").textContent = MT.wrong === 0 ? "零失误配对!" : "配对完成";
  $("f-xp").textContent = "+" + (MT.right * 4) + " XP · 得分 " + MT.score;
  $("f-stats").innerHTML = '<div class="stat"><div class="n" style="color:var(--good)">' + acc + '%</div><div class="l">准确率</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">x' + MT.best + '</div><div class="l">最高连击</div></div>'
    + '<div class="stat"><div class="n">' + MT.score + '</div><div class="l">总分</div></div>';
  $("f-msg").textContent = "配对错的词已按记忆算法安排加密复习";
  saveP(); show("finish");
}

/* ================= 极速判断 / 人机对战 ================= */
const TF = { list: [], i: 0, truth: true, score: 0, combo: 0, best: 0, right: 0, timer: null, t0: 0, lock: false, vs: false, bot: 0, botT: null };
const TF_N = 20, TF_MS = 4000;
function startTF(vs) {
  const pool = seenWords();
  if (pool.length < 10) { toast("先学至少 10 个新词再来挑战"); return; }
  TF.list = shuffle(pool.slice()).slice(0, TF_N);
  TF.i = 0; TF.score = 0; TF.combo = 0; TF.best = 0; TF.right = 0;
  TF.vs = !!vs; TF.bot = 0;
  show("tf"); renderTF();
}
function renderTF() {
  TF.lock = false;
  const e = TF.list[TF.i];
  // 每题独立随机:约一半题目释义是错的
  TF.truth = Math.random() >= 0.5;
  let showM = e.m;
  if (!TF.truth) {
    const others = activeWords().filter(x => x.w !== e.w && x.m !== e.m);
    const other = others[Math.floor(Math.random() * others.length)];
    if (other) showM = other.m; else TF.truth = true;
  }
  $("t-prog").textContent = (TF.vs ? "人机对战 " : "") + (TF.i + 1) + " / " + TF.list.length;
  $("t-combo").textContent = TF.vs ? "🤖 AI " + TF.bot + " 分" : (TF.combo > 1 ? "⚡x" + TF.combo : "");
  $("t-score").textContent = (TF.vs ? "你 " : "") + TF.score + " 分";
  clearTimeout(TF.botT);
  if (TF.vs) {
    const qi = TF.i;
    TF.botT = setTimeout(() => {
      if (TF.i !== qi || SCREEN !== "tf") return;
      const botOk = Math.random() < 0.78;
      if (botOk) { TF.bot += 10 + Math.floor(Math.random() * 8); $("t-combo").textContent = "🤖 AI " + TF.bot + " 分 ✓"; }
      else { $("t-combo").textContent = "🤖 AI " + TF.bot + " 分 ✗"; }
    }, 900 + Math.random() * 2300);
  }
  $("t-word").textContent = e.w;
  $("t-mean").innerHTML = "<b>" + esc(showM) + "</b>";
  $("t-fb").textContent = "";
  $("t-no").classList.remove("focus"); $("t-yes").classList.remove("focus");
  speak(e.w);
  clearInterval(TF.timer); TF.t0 = NOW();
  $("t-timer").style.width = "100%";
  TF.timer = setInterval(() => {
    const left = 1 - (NOW() - TF.t0) / TF_MS;
    $("t-timer").style.width = Math.max(0, left * 100) + "%";
    if (left <= 0) tfAnswer(null);
  }, 80);
}
function tfAnswer(saysMatch) {
  if (TF.lock) return;
  TF.lock = true; clearInterval(TF.timer);
  const e = TF.list[TF.i];
  const ok = saysMatch !== null && saysMatch === TF.truth;
  if (saysMatch !== null) (saysMatch ? $("t-yes") : $("t-no")).classList.add("focus");
  if (ok) {
    TF.combo++; TF.best = Math.max(TF.best, TF.combo); TF.right++;
    const speed = Math.max(0, Math.round((1 - (NOW() - TF.t0) / TF_MS) * 8));
    const gain = 10 + speed + Math.min(8, TF.combo);
    TF.score += gain; P.xp += 4;
    $("t-fb").textContent = "✓ +" + gain + (speed >= 6 ? " 神速!" : "");
  } else {
    TF.combo = 0;
    $("t-fb").textContent = "✗ " + e.w + " → " + e.m;
  }
  schedHit(e.w, ok);
  setTimeout(() => { TF.i++; if (TF.i >= TF.list.length) finishTF(); else renderTF(); }, ok ? 600 : 1600);
}
handlers.tf = {
  key(k) {
    if (k === "BACK") { clearInterval(TF.timer); clearTimeout(TF.botT); show("home"); return; }
    if (k === "MENU" || k === "PLAY") { speak(TF.list[TF.i].w); return; }
    if (TF.lock) return;
    if (k === "LEFT") tfAnswer(false);
    else if (k === "RIGHT") tfAnswer(true);
  }
};
function finishTF() {
  clearTimeout(TF.botT);
  if (TF.vs) {
    $("f-title").textContent = TF.score > TF.bot ? "🏆 你赢了!" : (TF.score === TF.bot ? "平局!" : "AI 险胜,再来!");
    $("f-xp").textContent = "+" + (TF.right * 4) + " XP";
    $("f-stats").innerHTML = '<div class="stat"><div class="n" style="color:var(--good)">' + TF.score + '</div><div class="l">你的得分</div></div>'
      + '<div class="stat"><div class="n" style="color:var(--bad)">' + TF.bot + '</div><div class="l">AI 得分</div></div>'
      + '<div class="stat"><div class="n">' + TF.right + '/' + TF.list.length + '</div><div class="l">你答对</div></div>';
    $("f-msg").textContent = "AI 不会累,但你会变强";
    saveP(); show("finish"); return;
  }
  $("f-title").textContent = TF.right >= TF.list.length * 0.9 ? "反应如闪电!" : "判断完成";
  $("f-xp").textContent = "+" + (TF.right * 4) + " XP · 得分 " + TF.score;
  $("f-stats").innerHTML = '<div class="stat"><div class="n" style="color:var(--good)">' + TF.right + '/' + TF.list.length + '</div><div class="l">答对</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">x' + TF.best + '</div><div class="l">最高连击</div></div>'
    + '<div class="stat"><div class="n">' + TF.score + '</div><div class="l">总分</div></div>';
  $("f-msg").textContent = "速度加分,连击加分,答错的词会加密复习";
  saveP(); show("finish");
}

/* ================= AI 层 ================= */
const AI_MODEL = "glm-4.7-flash";
let AIcb = {}, AIn = 0;
window.onAiReply = (id, raw) => {
  const cb = AIcb[id]; delete AIcb[id];
  if (!cb) return;
  try {
    const j = JSON.parse(raw);
    if (j.error) { cb(null, j.error.message || "接口错误"); return; }
    const m = j.choices && j.choices[0] && j.choices[0].message;
    const c = m && (m.content || m.reasoning_content);
    cb(c || null, c ? null : "空回复");
  } catch (e) { cb(null, "解析失败"); }
};
function aiCall(messages, cb, maxTok) {
  const id = "c" + (++AIn);
  AIcb[id] = cb;
  const payload = JSON.stringify({ model: AI_MODEL, messages: messages, temperature: 0.8, max_tokens: maxTok || 900, thinking: { type: "disabled" } });
  try { NativeBridge.aiChat(payload, id); }
  catch (e) { delete AIcb[id]; cb(null, "此版本App不支持AI"); return; }
  setTimeout(() => { if (AIcb[id]) { delete AIcb[id]; cb(null, "请求超时,检查电视网络"); } }, 35000);
}
function aiJson(content) {
  try {
    let t = String(content).replace(/```json|```/g, "").trim();
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    return JSON.parse(t);
  } catch (e) { return null; }
}

/* ---------- AI 对话 / 外教课堂 ---------- */
const AIS = { phase: 0, idx: 0, msgs: [], replies: [], sel: 0, busy: false, say: "", _retry: false };
const AI_FMT = '学生可能用中文或英文回答:若用中文,先理解意思,再在say里用简单英文回应并顺带教他这句话的英文说法。每轮都只输出JSON:{"say":"你要说的英文(1-2句,B1难度)","cn":"say的中文翻译","replies":["学生可选的英文回复1","回复2","回复3"]}。不要输出JSON以外的任何内容。';
const AI_TOPICS = [
  { ic: "💬", n: "自由闲聊", d: "轻松聊日常,像朋友一样", sys: "你是友好健谈的美国朋友Alex,和中国学生用简单英语闲聊日常生活。" },
  { ic: "📚", n: "今日单词陪练", d: "AI用你今天学的词和你对话", sys: "" },
  { ic: "📊", n: "学习教练", d: "他知道你的目标和进度", sys: "你是学生的专属英语学习教练Coach Lin,开场先用档案里的真实数据点评他今天的进度(目标完成了吗?连续几天?),然后围绕他今天学的单词出小题、造句、提问,带他把今天的词真正用起来。目标未完成就推他去学,完成了就带着巩固。" },
  { ic: "🧑‍🏫", n: "外教跟读课", d: "他说一句,你大声跟读", sys: "你是耐心的英语外教Mr.Reed,进行跟读训练:每轮给出一个实用英文句子让学生大声跟读,say字段就是要跟读的句子,cn是翻译,replies固定为[\"Next sentence please\",\"Say it again slower\",\"Make it harder\"]。根据学生选择调整难度。" },
  { ic: "🎭", n: "情景对话课", d: "餐厅点餐/机场/酒店实战", sys: "你是英语外教,进行情景角色扮演教学。随机选一个场景(餐厅点餐/机场值机/酒店入住/问路/购物退货),你扮演服务方,学生扮演顾客,一步步推进场景。" },
  { ic: "🔤", n: "发音课", d: "易混音对比 · 连读技巧", sys: "你是发音外教,每轮教一个发音要点(易混音对比如ship/sheep,或连读弱读技巧),say字段给出示范句或对比词,cn用中文讲清要点,replies是学生的练习选择。" }
];
function aiProfile() {
  const td = todayStr();
  const tw = activeWords().filter(e => P.words[e.w] && P.words[e.w].fd === td).map(e => e.w);
  const learned = Object.values(P.words).filter(r => r.st > 0).length;
  return "[学生档案]每日目标:" + P.set.newPerDay + "个新词;今日已学:" + (P.dayNew[td] || 0) + "个" + (tw.length ? "(" + tw.slice(0, 12).join(", ") + ")" : "") + ";待复习:" + dueWords().length + "个;连续学习:" + P.streak + "天;累计已学:" + learned + "词。在合适时机自然地提及进度、鼓励或提醒,不要生硬。";
}
handlers.ai = {
  enter() {
    AIS.phase = 0; AIS.idx = 0;
    $("ai-topics").style.display = ""; $("ai-chat").style.display = "none";
    $("ai-title").textContent = "👨‍🏫 AI 外教";
    $("ai-hint").textContent = "选一个模式开始 · OK 确认";
    renderAiTopics();
  },
  key(k) {
    if (AIS.phase === 0) {
      if (k === "BACK") { show("home"); return; }
      if (k === "UP") AIS.idx = (AIS.idx + AI_TOPICS.length - 1) % AI_TOPICS.length;
      else if (k === "DOWN") AIS.idx = (AIS.idx + 1) % AI_TOPICS.length;
      else if (k === "OK") { startAiChat(AIS.idx); return; }
      renderAiTopics();
    } else {
      if (k === "BACK" && VC.on) { cancelVoice(); $("ai-fb").textContent = ""; return; }
      if (k === "BACK") { show("home"); return; }
      if (k === "MENU" || k === "PLAY") { if (AIS.say) speak(AIS.say); return; }
      if (VC.rec) { if (k === "OK") stopVoice(); return; }
      if (VC.on) return;
      if (AIS._retry && k === "OK" && !AIS.busy) { aiTurn(); return; }
      if (AIS.busy) return;
      const n = AIS.replies.length + aiActs().length;
      if (k === "UP") AIS.sel = (AIS.sel + n - 1) % Math.max(1, n);
      else if (k === "DOWN") AIS.sel = (AIS.sel + 1) % Math.max(1, n);
      else if (k === "OK") {
        if (!n) return;
        const acts = aiActs();
        if (AIS.sel < acts.length) {
          const t = acts[AIS.sel].t;
          if (t === "replay") { if (AIS.say) speak(AIS.say); }
          else startVoice(t);
          return;
        }
        const r = AIS.replies[AIS.sel - acts.length];
        if (!r) return;
        $("ai-say").textContent = "🗣️ " + r;
        $("ai-cn").textContent = "";
        AIS.msgs.push({ role: "user", content: r });
        aiTurn();
        return;
      }
      drawAiReplies();
    }
  }
};
function renderAiTopics() {
  const box = $("ai-topics"); box.innerHTML = "";
  const win = 5, start = Math.max(0, Math.min(AIS.idx - 2, AI_TOPICS.length - win));
  AI_TOPICS.slice(start, start + win).forEach((t, ii) => {
    const i = start + ii;
    const el = document.createElement("div");
    el.className = "rowitem" + (i === AIS.idx ? " focus" : "");
    el.innerHTML = '<div class="ic">' + t.ic + '</div><div class="info"><div class="name">' + t.n + '</div><div class="desc">' + t.d + '</div></div><div class="val">OK</div>';
    box.appendChild(el);
  });
  try { const fc = box.querySelector(".focus"); if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
}
function startAiChat(i) {
  const t = AI_TOPICS[i];
  let sys = t.sys;
  if (t.n === "今日单词陪练") {
    const td = todayStr();
    const tw = activeWords().filter(e => P.words[e.w] && P.words[e.w].fd === td).map(e => e.w).slice(0, 15);
    const list = tw.length ? tw.join(", ") : "recent common news words";
    sys = "你是英语陪练老师,请围绕这些学生今天刚学的单词展开对话,让学生在语境中反复接触它们: " + list + "。";
  }
  AIS.phase = 1; AIS.sel = 0; AIS.replies = []; AIS.say = ""; AIS._retry = false;
  AIS.msgs = [{ role: "system", content: sys + aiProfile() + AI_FMT }, { role: "user", content: "请开始。" }];
  $("ai-topics").style.display = "none"; $("ai-chat").style.display = "flex";
  $("ai-title").textContent = t.ic + " " + t.n;
  $("ai-hint").textContent = "▲▼选择 OK确认 · 想说话就选带麦克风的选项 · 返回退出";
  aiTurn();
}
function aiTurn() {
  AIS.busy = true; AIS._retry = false;
  $("ai-fb").textContent = "AI 思考中...";
  $("ai-opts").innerHTML = "";
  if (AIS.msgs.length > 13) AIS.msgs = [AIS.msgs[0]].concat(AIS.msgs.slice(-10));
  aiCall(AIS.msgs, (content, err) => {
    AIS.busy = false;
    if (!content) { $("ai-fb").textContent = "✗ " + (err || "失败") + " · 按OK重试"; AIS._retry = true; return; }
    let j = aiJson(content);
    // 兜底:模型没按JSON输出时,直接把原文当作AI的话,保证对话永不中断
    if (!j || !j.say) {
      j = { say: String(content).slice(0, 300), cn: "", replies: ["Please continue", "Can you say that again?", "Teach me something new"] };
    }
    AIS.msgs.push({ role: "assistant", content: content });
    AIS.say = j.say;
    $("ai-say").textContent = j.say;
    $("ai-cn").textContent = j.cn || "";
    AIS.replies = (j.replies || []).slice(0, 3);
    AIS.sel = 0;
    $("ai-fb").textContent = "";
    drawAiReplies();
    speak(j.say);
  });
}
function aiActs() {
  const a = hasVoice ? [{ t: "en", l: "🎤 说英语(按OK开始录音)" }, { t: "cn", l: "🎤 说中文(按OK开始录音)" }] : [];
  a.push({ t: "replay", l: "🔊 再听一遍AI说的" });
  return a;
}
function drawAiReplies() {
  if (AIS._retry) return;
  const acts = aiActs();
  const items = acts.map(a => a.l).concat(AIS.replies);
  const box = $("ai-opts"); box.innerHTML = "";
  items.forEach((r, i) => {
    const d = document.createElement("div");
    d.className = "opt" + (i === AIS.sel ? " focus" : "");
    d.innerHTML = '<span class="idx">' + (i < acts.length ? "✦" : (i - acts.length + 1)) + '</span><span>' + esc(r) + '</span>';
    box.appendChild(d);
  });
  try { const fc = box.querySelector(".focus"); if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
}

/* ---------- 语音输入(录音→GLM-ASR云端识别) ---------- */
const VC = { on: false, rec: false };
const hasVoice = (() => { try { return !!(window.Bridge && window.Bridge.hasVoice && NativeBridge.hasVoice()); } catch (e) { return false; } })();
window.onVoiceReady = () => { const f = $("ai-fb"); f.style.color = "var(--gold)"; f.textContent = "🔴 录音中... 说完再按一次 OK 结束并识别 · 返回取消"; VC.rec = true; };
window.onVoicePart = t => { const f = $("ai-fb"); f.style.color = "var(--paper)"; f.textContent = t; };
window.onVoice = t => {
  VC.on = false; VC.rec = false;
  if (SCREEN !== "ai" || AIS.phase !== 1) return;
  t = (t || "").trim();
  if (!t) { $("ai-fb").textContent = "没听清,再试一次"; return; }
  $("ai-say").textContent = "🗣️ " + t;
  $("ai-cn").textContent = "";
  AIS.msgs.push({ role: "user", content: t });
  aiTurn();
};
window.onVoiceErr = m => {
  VC.on = false; VC.rec = false;
  const f = $("ai-fb"); f.style.color = "var(--bad)";
  f.textContent = "🎤 " + m;
  setTimeout(() => { try { f.style.color = ""; } catch (e) { } }, 3000);
};
function startVoice(lang) {
  if (!hasVoice) { toast("此版本不支持语音"); return; }
  VC.on = true; VC.rec = false; VC.lang = lang || "en";
  const f = $("ai-fb"); f.style.color = "var(--gold)"; f.textContent = "🎤 正在开启麦克风...";
  try { NativeBridge.startListen(VC.lang); } catch (e) { VC.on = false; $("ai-fb").textContent = "麦克风启动失败"; }
}
function stopVoice() { if (VC.rec) { $("ai-fb").textContent = "⏳ 正在识别..."; try { NativeBridge.stopListen(); } catch (e) { } } }
function cancelVoice() { VC.on = false; VC.rec = false; try { NativeBridge.stopListen(); } catch (e) { } }

/* ---------- 单词本 AI 讲解 ---------- */
let popOpen = false;
function aiExplain(e) {
  popOpen = true;
  $("ai-pop-text").textContent = "🧑‍🏫 AI 讲解 " + e.w + " 中...";
  $("ai-pop").classList.add("show");
  aiCall([
    { role: "system", content: "你是英语词汇老师,回答精炼,纯文本不用markdown。" },
    { role: "user", content: "讲解单词 " + e.w + " (" + e.m + "):1.核心含义与常见搭配 2.词根或联想记忆法 3.两个近义词及区别一句话 4.一个新闻风格新例句+中文翻译。140字以内。" }
  ], (content, err) => {
    if (!popOpen) return;
    $("ai-pop-text").textContent = content || ("✗ " + (err || "失败"));
    if (content) { P.xp += 2; saveP(); }
  }, 600);
}
const _brKeyOrig = handlers.browse.key;
let _brLastOk = 0;
handlers.browse.key = function (k) {
  if (popOpen) { popOpen = false; $("ai-pop").classList.remove("show"); return; }
  if (k === "MENU" && BR.list[BR.idx]) { aiExplain(BR.list[BR.idx]); return; }
  if (k === "OK") {
    const now = NOW();
    if (now - _brLastOk < 900 && BR.list[BR.idx]) { _brLastOk = 0; aiExplain(BR.list[BR.idx]); return; }
    _brLastOk = now;
  }
  _brKeyOrig(k);
};

/* ================= 词库 ================= */
let deckIdx = 0;
handlers.decks = {
  enter() {
    const box = $("deck-list"); box.innerHTML = "";
    DECKS.forEach((d, i) => {
      const learned = Object.values(WORDS).filter(e => e.deck === d.id && P.words[e.w] && P.words[e.w].st > 0).length;
      const pct = d.total ? Math.round(learned / d.total * 100) : 0;
      const el = document.createElement("div");
      el.className = "rowitem" + (i === deckIdx ? " focus" : "");
      el.innerHTML = '<div class="ic">' + d.icon + '</div>'
        + '<div class="info"><div class="name">' + esc(d.name) + (d.source === "ext" ? ' <span style="color:var(--gold);font-size:2vmin">外部</span>' : "") + '</div>'
        + '<div class="desc">已学 ' + learned + ' / ' + d.total + ' 词 · ' + pct + '%</div>'
        + '<div class="deckbar"><i style="width:' + pct + '%"></i></div></div>'
        + '<div class="val">' + (deckOn(d.id) ? "已启用" : '<span style="color:var(--faint)">已关闭</span>') + '</div>';
      box.appendChild(el);
    });
  },
  key(k) {
    if (k === "BACK") { show("home"); return; }
    if (!DECKS.length) return;
    if (k === "UP") deckIdx = (deckIdx + DECKS.length - 1) % DECKS.length;
    else if (k === "DOWN") deckIdx = (deckIdx + 1) % DECKS.length;
    else if (k === "OK") {
      const d = DECKS[deckIdx];
      if (deckOn(d.id)) P.decksOff[d.id] = 1; else delete P.decksOff[d.id];
      saveP();
    }
    handlers.decks.enter();
  }
};

/* ================= 统计 ================= */
handlers.stats = {
  enter() {
    const recs = Object.values(P.words);
    const learned = recs.filter(r => r.st > 0).length;
    const mastered = recs.filter(r => r.st === 2 && r.S >= 21).length;
    const total = Object.keys(WORDS).length;
    const todayN = P.dayLog[todayStr()] || 0;
    $("st-total").textContent = "词库总量 " + total + " 词";
    $("st-grid").innerHTML =
      '<div class="scard"><div class="n">' + learned + '</div><div class="l">已学单词</div></div>'
      + '<div class="scard"><div class="n">' + mastered + '</div><div class="l">已掌握(≥21天)</div></div>'
      + '<div class="scard"><div class="n">' + todayN + '</div><div class="l">今日学习次数</div></div>'
      + '<div class="scard"><div class="n">🔥' + P.streak + '</div><div class="l">连续天数 · Lv.' + level() + '</div></div>';
    const hm = $("heatmap"); hm.innerHTML = "";
    const days = 18 * 7;
    const start = NOW() - (days - 1) * DAY;
    for (let i = 0; i < days; i++) {
      const d = todayStr(start + i * DAY);
      const n = P.dayLog[d] || 0;
      const lv = n === 0 ? 0 : n < 15 ? 1 : n < 40 ? 2 : n < 90 ? 3 : 4;
      const c = document.createElement("div");
      c.className = "cell" + (lv ? " l" + lv : "");
      hm.appendChild(c);
    }
  },
  key(k) { if (k === "BACK" || k === "OK") show("home"); }
};

/* ================= 设置 ================= */
let setIdx = 0;
/* ---------- 自动更新配置 ---------- */
// 更新地址已配置好,无需改动
const GH_USER = "ac2706673058-maker";
const GH_REPO = "qcz";
const UPDATE_APK_URL = "https://github.com/" + GH_USER + "/" + GH_REPO + "/releases/latest/download/LexTV.apk";
const UPDATE_API_URL = "https://api.github.com/repos/" + GH_USER + "/" + GH_REPO + "/releases/latest";

const SETTINGS = [
  { id: "newPerDay", name: "每日新词量", desc: "每天最多学多少个新词", opts: [5, 10, 15, 20, 30, 50], fmt: v => v + " 词" },
  { id: "tts", name: "发音", desc: "在线真人发音,需电视联网;离线时自动尝试系统TTS", opts: [1, 0], fmt: v => v ? "开启" : "关闭" },
  { id: "auto", name: "自动朗读", desc: "出示卡片时自动读单词", opts: [1, 0], fmt: v => v ? "开启" : "关闭" },
  { id: "rate", name: "语速", desc: "朗读速度", opts: [0.7, 0.9, 1.0, 1.2], fmt: v => v + "×" },
  { id: "update", name: "检查更新", desc: "在线检查新版本并一键下载安装,进度保留", opts: null, fmt: () => "OK 检查" },
  { id: "reset", name: "重置全部进度", desc: "清空学习记录,不可恢复", opts: null, fmt: () => "OK 按两次" }
];
let resetArm = false;
const SET_ICON = { newPerDay: "🎯", tts: "🔊", auto: "▶️", rate: "⏩", update: "🔄", reset: "🗑️" };
handlers.settings = {
  enter() {
    const box = $("set-list"); box.innerHTML = "";
    SETTINGS.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "rowitem" + (i === setIdx ? " focus" : "");
      const val = s.opts ? s.fmt(P.set[s.id]) : (resetArm && i === setIdx && s.id === "reset" ? '<span style="color:var(--bad)">再按一次确认</span>' : s.fmt());
      el.innerHTML = '<div class="ic">' + (SET_ICON[s.id] || "•") + '</div>'
        + '<div class="info"><div class="name">' + s.name + '</div><div class="desc">' + s.desc + '</div></div>'
        + '<div class="val">' + val + '</div>';
      box.appendChild(el);
    });
    try { const fc = box.querySelector(".focus"); if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
  },
  key(k) {
    if (k === "BACK") { resetArm = false; show("home"); return; }
    const s = SETTINGS[setIdx];
    if (k === "UP") { setIdx = (setIdx + SETTINGS.length - 1) % SETTINGS.length; resetArm = false; }
    else if (k === "DOWN") { setIdx = (setIdx + 1) % SETTINGS.length; resetArm = false; }
    else if ((k === "LEFT" || k === "RIGHT") && s.opts) {
      const cur = s.opts.indexOf(P.set[s.id]);
      const nx = (cur + (k === "RIGHT" ? 1 : s.opts.length - 1)) % s.opts.length;
      P.set[s.id] = s.opts[nx]; saveP();
    } else if (k === "OK") {
      if (s.id === "update") { checkUpdate(); return; }
      else if (s.id === "reset") {
        if (!resetArm) { resetArm = true; }
        else { P = JSON.parse(JSON.stringify(DEFAULTS)); saveP(); resetArm = false; toast("已重置全部进度"); }
      } else if (s.opts) {
        const cur = s.opts.indexOf(P.set[s.id]);
        P.set[s.id] = s.opts[(cur + 1) % s.opts.length]; saveP();
        if (s.id === "tts" || s.id === "rate") speak("Welcome to Lex TV");
      }
    }
    handlers.settings.enter();
  }
};

/* ================= 界面对照教学 ================= */
let SCREENS = [];
function loadScreens() {
  try { SCREENS = JSON.parse(NativeBridge.readDeckFile("asset", "screens.json")); }
  catch (e) { SCREENS = []; }
  if (!Array.isArray(SCREENS)) SCREENS = [];
}
const SC = { view: "list", gi: 0, wi: 0 };
handlers.screens = {
  enter() {
    if (SC.view === "list") renderScList();
    else renderScWords();
  },
  key(k) {
    if (SC.view === "list") {
      if (k === "BACK") { show("home"); return; }
      if (!SCREENS.length) return;
      if (k === "UP") SC.gi = Math.max(0, SC.gi - 1);
      else if (k === "DOWN") SC.gi = Math.min(SCREENS.length - 1, SC.gi + 1);
      else if (k === "OK") { SC.view = "words"; SC.wi = 0; renderScWords(); return; }
      renderScList();
    } else {
      const g = SCREENS[SC.gi];
      const items = (g && g.items) || [];
      if (k === "BACK") { SC.view = "list"; renderScList(); return; }
      if (!items.length) return;
      if (k === "UP") SC.wi = Math.max(0, SC.wi - 1);
      else if (k === "DOWN") SC.wi = Math.min(items.length - 1, SC.wi + 1);
      else if (k === "OK" || k === "PLAY" || k === "MENU") { speak(items[SC.wi][0]); return; }
      renderScWords();
    }
  }
};
function renderScList() {
  $("sc-title").textContent = "📱 界面对照教学";
  $("sc-hint").textContent = "选一个App界面 · OK 进入 · 对着你手机上的App一起看";
  const box = $("sc-list"); box.innerHTML = "";
  if (!SCREENS.length) { box.innerHTML = '<div class="empty"><div class="e1">🍃</div><div class="e3">暂无对照数据</div></div>'; return; }
  const win = 6, start = Math.max(0, Math.min(SC.gi - 2, SCREENS.length - win));
  SCREENS.slice(start, start + win).forEach((g, ii) => {
    const i = start + ii;
    const el = document.createElement("div");
    el.className = "rowitem" + (i === SC.gi ? " focus" : "");
    el.innerHTML = '<div class="ic">📲</div><div class="info"><div class="name">' + esc(g.app) + ' · ' + esc(g.screen) + '</div><div class="desc">' + esc(g.desc || "") + ' · ' + ((g.items || []).length) + ' 词</div></div><div class="val">OK</div>';
    box.appendChild(el);
  });
  try { const fc = box.querySelector(".focus"); if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
}
function renderScWords() {
  const g = SCREENS[SC.gi];
  const items = (g && g.items) || [];
  $("sc-title").textContent = esc(g.app) + " · " + esc(g.screen);
  $("sc-hint").textContent = "▲▼ 逐词浏览 · OK 发音 · 返回上一层　(" + (SC.wi + 1) + "/" + items.length + ")";
  const box = $("sc-list"); box.innerHTML = "";
  const win = 7, start = Math.max(0, Math.min(SC.wi - 3, items.length - win));
  items.slice(start, start + win).forEach((it, ii) => {
    const i = start + ii;
    const el = document.createElement("div");
    el.className = "brow" + (i === SC.wi ? " focus" : "");
    el.innerHTML = '<div class="w serif" style="font-size:3.4vmin">' + esc(it[0]) + '</div>'
      + '<div class="m" style="color:var(--gold)">' + esc(it[1]) + '</div>'
      + '<div class="g" style="flex:1.6;text-align:left;color:var(--dim)">' + esc(it[2] || "") + '</div>';
    box.appendChild(el);
  });
  try { const fc = box.querySelector(".focus"); if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
  if (P.set.auto && items[SC.wi]) setTimeout(() => speak(items[SC.wi][0]), 200);
}

/* ================= 检查更新 ================= */
const UP = { active: false, phase: "", url: "", newVn: "", notes: "" };
function upBox(html) { $("ai-pop-text").innerHTML = html; $("ai-pop").classList.add("show"); UP.active = true; }
function upClose() { UP.active = false; $("ai-pop").classList.remove("show"); }
function curVN() { try { return NativeBridge.appVersionName ? NativeBridge.appVersionName() : "?"; } catch (e) { return "?"; } }
function curVC() { try { return NativeBridge.appVersionCode ? NativeBridge.appVersionCode() : 0; } catch (e) { return 0; } }

function checkUpdate() {
  if (GH_USER === "YOUR_GITHUB_USERNAME") {
    upBox('<div style="font-size:2.8vmin;line-height:1.7">⚠️ 还没有配置更新地址<br><br>请把 app.js 顶部的 GH_USER 改成你的 GitHub 用户名,重新打包一次即可。之后这里就能一键检查更新了。<br><br><span style="color:var(--dim);font-size:2.4vmin">按任意键关闭</span></div>');
    return;
  }
  UP.phase = "checking";
  upBox('<div style="font-size:3vmin">🔄 正在检查更新...</div>');
  fetch(UPDATE_API_URL, { headers: { "Accept": "application/vnd.github+json" } })
    .then(r => r.json())
    .then(data => {
      const tag = String(data.tag_name || "");
      const notes = String(data.body || "").slice(0, 300);
      const m = tag.match(/-(\d+)$/);
      const remoteVC = m ? parseInt(m[1]) : 0;
      const vnMatch = tag.match(/v?([\d.]+)/);
      const remoteVN = vnMatch ? vnMatch[1] : tag;
      const localVC = curVC();
      if (remoteVC > localVC) {
        UP.phase = "found"; UP.url = UPDATE_APK_URL; UP.newVn = remoteVN; UP.notes = notes;
        upBox('<div style="font-size:2.8vmin;line-height:1.7">🎉 发现新版本 <b style="color:var(--gold)">v' + esc(remoteVN) + '</b><br><span style="color:var(--dim);font-size:2.3vmin">当前 v' + esc(curVN()) + '</span>'
          + (notes ? '<br><br><div style="font-size:2.4vmin;color:var(--paper)">' + esc(notes) + '</div>' : '')
          + '<br><br><b style="color:var(--good)">按 OK 下载并安装</b>　·　按返回取消<br><span style="color:var(--dim);font-size:2.2vmin">安装后学习进度会完整保留</span></div>');
      } else {
        UP.phase = "latest";
        upBox('<div style="font-size:3vmin;line-height:1.7">✅ 已是最新版本<br><span style="color:var(--dim);font-size:2.5vmin">当前 v' + esc(curVN()) + '</span><br><br><span style="color:var(--dim);font-size:2.4vmin">按任意键关闭</span></div>');
      }
    })
    .catch(e => {
      UP.phase = "error";
      upBox('<div style="font-size:2.7vmin;line-height:1.7">❌ 检查失败<br><span style="font-size:2.3vmin;color:var(--dim)">' + esc(String(e.message || e)) + '</span><br><br>请确认电视已联网,以及仓库已发布过 Release。<br><br><span style="color:var(--dim);font-size:2.2vmin">按任意键关闭</span></div>');
    });
}
function startUpdateDownload() {
  UP.phase = "downloading";
  upBox('<div style="font-size:3vmin;line-height:1.8">⬇️ 正在下载新版本...<br><div style="font-size:5vmin;color:var(--gold)" id="up-pct">0%</div><span style="color:var(--dim);font-size:2.3vmin">下载完成会自动跳到安装界面,请勿离开</span></div>');
  try { NativeBridge.downloadAndInstall(UP.url); } catch (e) { upBox('<div style="font-size:2.8vmin">❌ 此版本不支持自动更新</div>'); }
}
window.onUpdateProgress = pct => { const e = document.getElementById("up-pct"); if (e) e.textContent = pct + "%"; };
window.onUpdateReady = () => { upBox('<div style="font-size:2.8vmin;line-height:1.7">📦 下载完成!<br><br>系统安装界面即将弹出,点"安装"即可完成更新。<br>如果没弹出,请在系统设置里允许本应用"安装未知应用"。<br><br><span style="color:var(--dim);font-size:2.2vmin">按任意键关闭</span></div>'); };
window.onUpdateErr = m => { upBox('<div style="font-size:2.7vmin;line-height:1.7">❌ 更新失败<br><span style="font-size:2.4vmin;color:var(--dim)">' + esc(m) + '</span><br><br><span style="color:var(--dim);font-size:2.2vmin">按任意键关闭</span></div>'); };

const _setKeyOrig = handlers.settings.key;
handlers.settings.key = function (k) {
  if (UP.active) {
    if (UP.phase === "found") {
      if (k === "OK") { startUpdateDownload(); return; }
      if (k === "BACK") { upClose(); return; }
      return;
    }
    if (UP.phase === "downloading") { return; }
    upClose(); return;
  }
  _setKeyOrig(k);
};

/* ================= 切换使用者 ================= */
const WHO = { idx: 0 };
handlers.who = {
  enter() {
    const box = $("who-list"); box.innerHTML = "";
    [["fin", "汇丰/盈透实景模拟 · 金融词库 · 界面对照"], ["teen", "中考核心词汇 · 拼写挑战 · 无金融内容"]].forEach((it, i) => {
      const p = PROFILES[it[0]];
      const el = document.createElement("div");
      el.className = "rowitem" + (i === WHO.idx ? " focus" : "");
      el.innerHTML = '<div class="ic" style="font-size:6vmin">' + p.icon + '</div>'
        + '<div class="info"><div class="name" style="font-size:4vmin">' + p.name + (it[0] === CUR ? ' <span style="color:var(--good);font-size:2.2vmin">● 当前</span>' : '') + '</div>'
        + '<div class="desc" style="font-size:2.4vmin;margin-top:1vmin">' + it[1] + '</div></div>'
        + '<div class="val">' + (it[0] === CUR ? "使用中" : "OK 切换") + '</div>';
      el.style.padding = "4vmin 4vmin";
      box.appendChild(el);
    });
  },
  key(k) {
    if (k === "BACK") { show("home"); return; }
    if (k === "UP" || k === "DOWN" || k === "LEFT" || k === "RIGHT") WHO.idx = 1 - WHO.idx;
    else if (k === "OK") { switchProfile(WHO.idx === 0 ? "fin" : "teen"); return; }
    handlers.who.enter();
  }
};

/* ================= 拼写挑战(听音看义,遥控器拼单词) ================= */
const SPL = { list: [], i: 0, ans: "", input: [], ki: 0, score: 0, combo: 0, best: 0, right: 0, lock: false, hints: 0 };
const SPL_KEYS = "abcdefghijklmnopqrstuvwxyz".split("").concat(["DEL", "HINT"]);
function startSpell() {
  const pool = seenWords().filter(e => /^[a-zA-Z]{3,12}$/.test(e.w));
  if (pool.length < 8) { toast("先学至少 8 个可拼写的单词(纯字母)再来挑战"); return; }
  SPL.list = shuffle(pool.slice()).slice(0, 10);
  SPL.i = 0; SPL.score = 0; SPL.combo = 0; SPL.best = 0; SPL.right = 0;
  show("spell"); renderSpell();
}
function renderSpell() {
  const e = SPL.list[SPL.i];
  SPL.ans = e.w.toLowerCase();
  SPL.input = [SPL.ans[0]];      // 首字母默认给出,降低遥控器输入负担
  SPL.ki = 0; SPL.lock = false; SPL.hints = 0;
  $("sp-prog").textContent = (SPL.i + 1) + " / " + SPL.list.length;
  $("sp-score").textContent = SPL.score + " 分";
  $("sp-combo").textContent = SPL.combo > 1 ? "⚡连击 ×" + SPL.combo : "";
  $("sp-mean").textContent = e.m;
  $("sp-phon").textContent = e.p ? "/" + e.p + "/" : "";
  $("sp-fb").textContent = "";
  drawSpell();
  speak(e.w);
}
function drawSpell() {
  const box = $("sp-boxes"); box.innerHTML = "";
  for (let i = 0; i < SPL.ans.length; i++) {
    const d = document.createElement("div");
    d.className = "sp-box" + (i === 0 ? " lockc" : "") + (i === SPL.input.length ? " cur" : "");
    d.textContent = SPL.input[i] || "";
    box.appendChild(d);
  }
  const kb = $("sp-kb"); kb.innerHTML = "";
  SPL_KEYS.forEach((kk, i) => {
    const d = document.createElement("div");
    d.className = "sp-key" + (i === SPL.ki ? " focus" : "") + (kk.length > 1 ? " fn" : "");
    d.textContent = kk === "DEL" ? "⌫ 删除" : (kk === "HINT" ? "💡 提示" : kk);
    kb.appendChild(d);
  });
}
function spellJudge() {
  SPL.lock = true;
  const e = SPL.list[SPL.i];
  const got = SPL.input.join("");
  const ok = got === SPL.ans;
  const box = $("sp-boxes"); box.innerHTML = "";
  for (let i = 0; i < SPL.ans.length; i++) {
    const d = document.createElement("div");
    d.className = "sp-box " + (got[i] === SPL.ans[i] ? "good" : "bad");
    d.textContent = SPL.ans[i];
    box.appendChild(d);
  }
  if (ok) {
    SPL.combo++; SPL.best = Math.max(SPL.best, SPL.combo); SPL.right++;
    const gain = Math.max(4, 12 + Math.min(8, SPL.combo * 2) - SPL.hints * 2);
    SPL.score += gain; P.xp += 5;
    $("sp-fb").textContent = "✓ 拼对了! +" + gain + (SPL.hints ? " 分(用了" + SPL.hints + "次提示)" : " 分");
  } else {
    SPL.combo = 0;
    $("sp-fb").textContent = "✗ 正确拼写是 " + e.w + " · 你拼的是 " + got;
  }
  speak(e.w);
  schedHit(e.w, ok);
  setTimeout(() => { SPL.i++; if (SPL.i >= SPL.list.length) finishSpell(); else renderSpell(); }, ok ? 1100 : 2600);
}
handlers.spell = {
  key(k) {
    if (k === "BACK") { show("home"); return; }
    if (k === "MENU" || k === "PLAY") { speak(SPL.list[SPL.i].w); return; }
    if (SPL.lock) return;
    const n = SPL_KEYS.length;                     // 28 键,7列×4行
    if (k === "UP") SPL.ki = (SPL.ki - 7 + n) % n;
    else if (k === "DOWN") SPL.ki = (SPL.ki + 7) % n;
    else if (k === "LEFT") SPL.ki = (SPL.ki + n - 1) % n;
    else if (k === "RIGHT") SPL.ki = (SPL.ki + 1) % n;
    else if (k === "OK") {
      const key = SPL_KEYS[SPL.ki];
      if (key === "DEL") { if (SPL.input.length > 1) SPL.input.pop(); }
      else if (key === "HINT") {
        if (SPL.input.length < SPL.ans.length) { SPL.input.push(SPL.ans[SPL.input.length]); SPL.hints++; }
      } else if (SPL.input.length < SPL.ans.length) SPL.input.push(key);
      if (SPL.input.length >= SPL.ans.length) { drawSpell(); spellJudge(); return; }
    }
    drawSpell();
  }
};
function finishSpell() {
  const acc = SPL.list.length ? Math.round(SPL.right / SPL.list.length * 100) : 100;
  $("f-title").textContent = SPL.right === SPL.list.length ? "全部拼对!" : "拼写完成";
  $("f-xp").textContent = "+" + (SPL.right * 5) + " XP · 得分 " + SPL.score;
  $("f-stats").innerHTML = '<div class="stat"><div class="n" style="color:var(--good)">' + SPL.right + '/' + SPL.list.length + '</div><div class="l">拼对</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">×' + SPL.best + '</div><div class="l">最高连击</div></div>'
    + '<div class="stat"><div class="n">' + SPL.score + '</div><div class="l">总分</div></div>';
  $("f-msg").textContent = "拼错的词已安排加密复习 · 考试拼写题就这么练出来";
  saveP(); show("finish");
}

/* ================= 启动 ================= */
function boot() {
  loadApp();
  loadP();
  loadDecks();
  loadScreens();
  try { ttsOK = !!NativeBridge.isTtsReady(); } catch (e) { }
  show("home");
}
boot();
