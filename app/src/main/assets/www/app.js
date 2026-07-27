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
const DEFAULTS = { xp: 0, streak: 0, lastDay: "", dayLog: {}, dayNew: {}, words: {}, decksOff: {}, tr: {}, drill: {}, game: {}, set: { newPerDay: 20, tts: 1, auto: 1, eye: 0, rate: 0.9, gameSrc: "today" } };

/* ================= 家庭空间 v2 =================
   “人物”与“学习模板”分离。爸爸/弟弟保留原 id 和原存储 key，升级绝不搬迁旧进度；
   新人物使用安全生成的 id 和独立 progress_user_* 文件，并默认拥有全部功能。 */
const PROFILE_TEMPLATES = {
  fin: {
    label: "金融英语", deckOk: p => p !== "teen",
    slogans: ["看懂<em>世界</em>的词汇", "读懂<em>硅谷</em>与华尔街", "今天也在<em>变强</em>", "新闻不再<em>陌生</em>", "词汇是<em>带宽</em>"]
  },
  teen: {
    label: "考试冲刺", deckOk: p => p !== "fin",
    slogans: ["中考词汇<em>稳稳拿下</em>", "每天进步<em>一点点</em>", "单词是<em>分数</em>", "背过的词<em>不会背叛你</em>", "考场见<em>真章</em>"]
  },
  all: {
    label: "全能空间", deckOk: () => true,
    slogans: ["每个人都有<em>自己的节奏</em>", "把陌生变成<em>熟悉</em>", "今天学会<em>真正会用</em>", "一词一世界", "记忆会在练习中<em>生长</em>"]
  }
};
const BUILTIN_PROFILE_META = [
  { id: "fin", name: "爸爸 · 金融投资", short: "爸爸", icon: "💼", template: "fin", store: "progress", builtin: true },
  { id: "teen", name: "弟弟 · 中考冲刺", short: "弟弟", icon: "🎒", template: "teen", store: "progress_teen", builtin: true }
];
const PROFILES = {};
let PROFILE_META = [];
let APP_STATE = { schema: 2, profile: "fin", profiles: [] };
let CUR = "fin";
const PF = () => PROFILES[CUR] || PROFILES.fin;
function safeProfileMeta(raw) {
  if (!raw || !/^u_[a-z0-9]{6,32}$/.test(String(raw.id || ""))) return null;
  const template = PROFILE_TEMPLATES[raw.template] ? raw.template : "all";
  const name = String(raw.name || "家庭成员").replace(/[<>]/g, "").trim().slice(0, 18) || "家庭成员";
  return {
    id: String(raw.id), name: name, short: String(raw.short || name).replace(/[<>]/g, "").trim().slice(0, 6) || "成员",
    icon: String(raw.icon || "👤").slice(0, 4), template: template,
    store: "progress_user_" + String(raw.id).slice(2), builtin: false, archived: !!raw.archived
  };
}
function registerProfile(meta) {
  const t = PROFILE_TEMPLATES[meta.template] || PROFILE_TEMPLATES.all;
  PROFILES[meta.id] = {
    name: meta.name, short: meta.short, icon: meta.icon, store: meta.store,
    template: meta.template, builtin: !!meta.builtin, archived: !!meta.archived,
    menuHide: meta.builtin ? (meta.id === "fin" ? { chase: 1 } : { sim: 1, screens: 1, cloud: 1 }) : {},
    deckOk: t.deckOk, slogans: t.slogans
  };
}
function rebuildProfiles(custom) {
  Object.keys(PROFILES).forEach(k => delete PROFILES[k]);
  PROFILE_META = BUILTIN_PROFILE_META.map(x => Object.assign({}, x));
  (custom || []).forEach(raw => {
    const m = safeProfileMeta(raw);
    if (m && !PROFILE_META.some(x => x.id === m.id)) PROFILE_META.push(m);
  });
  PROFILE_META.forEach(registerProfile);
}
function activeProfileMeta() { return PROFILE_META.filter(m => !m.archived); }
function validAppState(a) {
  return !!(a && typeof a === "object" && !Array.isArray(a)
    && (typeof a.profile === "string" || typeof a.currentProfileId === "string" || Array.isArray(a.profiles)));
}
function loadApp() {
  let a = null;
  try { const s = NativeBridge.load("app"); if (s) a = JSON.parse(s); } catch (e) { }
  if (!validAppState(a)) a = null;
  if (!a) { try { const b = NativeBridge.load("app_backup"); if (b) { const x = JSON.parse(b); if (validAppState(x)) a = x; } } catch (e) { } }
  const customs = a && Array.isArray(a.profiles) ? a.profiles : [];
  rebuildProfiles(customs);
  const wanted = a && String(a.profile || a.currentProfileId || "fin");
  CUR = PROFILES[wanted] && !PROFILES[wanted].archived ? wanted : "fin";
  APP_STATE = { schema: 2, profile: CUR, profiles: PROFILE_META.filter(m => !m.builtin) };
}
function saveApp() {
  try {
    APP_STATE = { schema: 2, profile: CUR, profiles: PROFILE_META.filter(m => !m.builtin).map(m => ({
      id: m.id, name: m.name, short: m.short, icon: m.icon, template: m.template, archived: !!m.archived
    })) };
    const prev = NativeBridge.load("app");
    if (prev) { try { if (validAppState(JSON.parse(prev))) NativeBridge.save("app_backup", prev); } catch (e) { } }
    NativeBridge.save("app", JSON.stringify(APP_STATE));
  } catch (e) { }
}

function loadP() {
  try { const s = NativeBridge.load(PF().store); P = s ? JSON.parse(s) : null; } catch (e) { P = null; }
  if (!P) P = JSON.parse(JSON.stringify(DEFAULTS));
  P.set = Object.assign({}, DEFAULTS.set, P.set || {});
  ["dayLog", "dayNew", "words", "decksOff", "tr", "drill", "game"].forEach(k => { if (!P[k]) P[k] = {}; });
  applyVisualPrefs();
}
function applyVisualPrefs() {
  document.documentElement.classList.toggle("eye", !!(P && P.set && P.set.eye));
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
    rec = { st: g >= 3 ? 2 : 1, S: sd.S, D: sd.D, due: now + (g === 1 ? 10 * 60000 : sd.S * DAY), reps: 1, lapses: g === 1 ? 1 : 0, last: now, fd: todayStr() };
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

/* 游戏练习不擅自改写未到期的 FSRS 排程,但会记录答题表现供“弱项突围”选题。
   到期或即将到期的词仍走原有 rate(),保证复习算法与旧进度完全兼容。 */
function practiceHit(w, ok) {
  if (!P.drill) P.drill = {};
  const d = P.drill[w] || { ok: 0, bad: 0, last: 0 };
  if (ok) d.ok++; else d.bad++;
  d.last = NOW();
  P.drill[w] = d;
}
function gameResult(id, right, total, score) {
  if (!P.game) P.game = {};
  const g = P.game[id] || { sessions: 0, best: 0, bestAcc: 0, lastAcc: 0, last: 0 };
  const acc = total ? Math.round(right / total * 100) : 0;
  g.sessions++;
  g.best = Math.max(g.best || 0, score || 0);
  g.bestAcc = Math.max(g.bestAcc || 0, acc);
  g.lastAcc = acc;
  g.last = NOW();
  P.game[id] = g;
  saveP();
}

/* ================= 官方在线词书仓库 =================
   目录与词书都来自本仓库的审核区。包内容先写入版本化 key，回读成功后再切换 registry，
   因而断网或安装中断不会破坏已经安装的旧版本。 */
const CATALOG_URL = "https://raw.githubusercontent.com/ac2706673058-maker/qcz/main/catalog/catalog.json";
const CLOUD_MAX_BYTES = 2 * 1024 * 1024;
const CLOUD_MAX_WORDS = 5000;
let CLOUD_REGISTRY = null;
function safeCloudId(id) { id = String(id || ""); return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(id) ? id : ""; }
function loadCloudRegistry() {
  if (CLOUD_REGISTRY) return CLOUD_REGISTRY;
  let r = null;
  try { const s = NativeBridge.load("deck_registry"); if (s) r = JSON.parse(s); } catch (e) { }
  const valid = x => !!(x && x.schema === 1 && x.decks && typeof x.decks === "object" && !Array.isArray(x.decks));
  if (!valid(r)) { try { const b = NativeBridge.load("deck_registry_backup"); if (b) { const x = JSON.parse(b); if (valid(x)) r = x; } } catch (e) { } }
  if (!valid(r)) r = { schema: 1, decks: {} };
  const clean = {};
  Object.keys(r.decks).forEach(id => {
    const d = r.decks[id];
    if (!safeCloudId(id) || !d || !/^deckpkg_[a-z0-9_-]+_v\d+$/.test(String(d.storageKey || ""))) return;
    clean[id] = d;
  });
  CLOUD_REGISTRY = { schema: 1, decks: clean };
  return CLOUD_REGISTRY;
}
function saveCloudRegistry() {
  try {
    const data = JSON.stringify(loadCloudRegistry());
    const prev = NativeBridge.load("deck_registry");
    if (prev) { try { const p = JSON.parse(prev); if (p && p.schema === 1 && p.decks) NativeBridge.save("deck_registry_backup", prev); } catch (e) { } }
    NativeBridge.save("deck_registry", data);
    const check = JSON.parse(NativeBridge.load("deck_registry") || "null");
    return !!(check && check.schema === 1 && check.decks && JSON.stringify(check) === data);
  } catch (e) { return false; }
}
function parseDeckRows(raw, strict) {
  let arr;
  try { arr = JSON.parse(raw); } catch (e) { throw new Error("词书不是有效 JSON"); }
  if (!Array.isArray(arr) || !arr.length) throw new Error("词书内容为空");
  if (arr.length > CLOUD_MAX_WORDS) throw new Error("词书超过 " + CLOUD_MAX_WORDS + " 条上限");
  const seen = {};
  arr.forEach((row, i) => {
    if (!Array.isArray(row) || row.length < 3) throw new Error("第 " + (i + 1) + " 条格式不正确");
    const limits = [80, 120, 400, 600, 600];
    for (let j = 0; j < Math.min(row.length, 5); j++) {
      if (row[j] !== null && row[j] !== undefined && typeof row[j] !== "string") throw new Error("第 " + (i + 1) + " 条含非文本字段");
      if (String(row[j] || "").length > limits[j]) throw new Error("第 " + (i + 1) + " 条文本过长");
    }
    const w = String(row[0] || "").trim();
    if (!w || /[<>\u0000-\u001f]/.test(w)) throw new Error("第 " + (i + 1) + " 条单词无效");
    if (strict && seen[w.toLowerCase()]) throw new Error("词书包含重复词: " + w);
    seen[w.toLowerCase()] = 1;
  });
  return arr;
}
function appendCloudDecks() {
  const reg = loadCloudRegistry();
  Object.keys(reg.decks).sort().forEach(id => {
    const d = reg.decks[id];
    let raw = "", arr = [];
    try {
      raw = NativeBridge.load(d.storageKey); arr = parseDeckRows(raw, false);
      if ((d.count && arr.length !== Number(d.count)) || (d.bytes && utf8Bytes(raw).length !== Number(d.bytes))) throw new Error("缓存不完整");
      delete d.broken;
    } catch (e) { d.broken = true; return; }
    const deckId = "online_" + id;
    let total = 0;
    arr.forEach(e => {
      const w = String(e[0]).trim();
      if (WORDS[w]) return;
      WORDS[w] = { w: w, p: e[1] || "", m: e[2] || "", x: e[3] || "", tr: e[4] || "", deck: deckId };
      total++;
    });
    DECKS.push({ id: deckId, cloudId: id, name: d.name || id, icon: d.icon || "☁️", source: "online", total: total, version: Number(d.version || 1) });
  });
}

function loadDecks() {
  let list = [];
  try { list = JSON.parse(NativeBridge.getDecks()); } catch (e) { list = []; }
  WORDS = {};
  DECKS = [];
  // 弟弟空间严格只使用中考核心词汇；爸爸/其他空间仍按各自模板加载可开关词书。
  // 高考与外部词书文件完整保留在安装包/用户目录，不改动原始数据。
  list = CUR === "teen"
    ? list.filter(d => d.id === "zk" && d.profile === "teen")
    : list.filter(d => d.source === "ext" || PF().deckOk(d.profile || ""));
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
  if (CUR !== "teen") appendCloudDecks();
}
const deckOn = id => (CUR === "teen" && id === "zk") || !P.decksOff[id];
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

/* ---------- 训练词源:训练馆游戏取词范围(按档案保存,默认今日学习) ---------- */
const GAME_SRC = [
  { id: "today", n: "今天学的" },
  { id: "yesterday", n: "昨天学的" },
  { id: "3d", n: "近 3 天" },
  { id: "7d", n: "近 7 天" },
  { id: "all", n: "全部已学" }
];
function gameSrcId() { return (P && P.set && P.set.gameSrc) || "today"; }
function gameSrcName(id) { const f = GAME_SRC.find(o => o.id === (id || gameSrcId())); return f ? f.n : "今天学的"; }
function inGameSrc(rec) {
  if (!rec) return false;
  const src = gameSrcId();
  if (src === "all") return true;
  const now = NOW();
  if (src === "yesterday") { const y = todayStr(now - 86400000); return rec.fd === y || todayStr(rec.last || 0) === y; }
  const days = src === "3d" ? 3 : (src === "7d" ? 7 : 1);
  for (let i = 0; i < days; i++) { const d = todayStr(now - i * 86400000); if (rec.fd === d || todayStr(rec.last || 0) === d) return true; }
  return false;
}
window.gameWords = function () { return seenWords().filter(e => inGameSrc(P.words[e.w])); };
const SRC_HINT = ";词量不够可到设置调整「训练词源」";
function weakScore(e) {
  const r = P.words[e.w] || {};
  const d = (P.drill && P.drill[e.w]) || {};
  const overdue = r.due ? Math.max(0, (NOW() - r.due) / DAY) : 0;
  const missRate = (d.bad || 0) / Math.max(1, (d.ok || 0) + (d.bad || 0));
  return (r.lapses || 0) * 16 + (r.D || 5) * 1.7 + Math.max(0, 14 - (r.S || 0)) * .45
    + Math.min(30, overdue) * .8 + (d.bad || 0) * 5 + missRate * 10;
}
function weakWords() {
  return seenWords().slice().sort((a, b) => weakScore(b) - weakScore(a));
}

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

/* 计时条交给合成线程做线性动画,主线程只保留一个到点回调。
   电视端不再每 80~100ms 改一次宽度,低端 WebView 也能保持遥控响应。 */
function timerBar(id, ms, done) {
  const el = $(id);
  el.style.transition = "none";
  el.style.width = "100%";
  void el.offsetWidth;
  el.style.transition = "width " + ms + "ms linear";
  requestAnimationFrame(() => { el.style.width = "0%"; });
  return setTimeout(done, ms + 20);
}
function stopTimerBar(handle, id) {
  clearTimeout(handle);
  const el = $(id);
  if (!el || !el.style) return;
  let width = "0%";
  try { width = getComputedStyle(el).width; } catch (e) { }
  el.style.transition = "none";
  el.style.width = width;
}
function gridMoveIndex(index, key, n, cols) {
  if (n <= 1) return 0;
  if (key === "LEFT") return (index + n - 1) % n;
  if (key === "RIGHT") return (index + 1) % n;
  const row = Math.floor(index / cols), col = index % cols, rows = Math.ceil(n / cols);
  const step = key === "UP" ? -1 : 1;
  if (key !== "UP" && key !== "DOWN") return index;
  for (let d = 1; d <= rows; d++) {
    const r = (row + step * d + rows * 2) % rows;
    const next = r * cols + col;
    if (next < n) return next;
  }
  return index;
}

let SCREEN = "home";
let RETURN_SCREEN = "home";
const handlers = {};
const NAV_DIR = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] };

/* Liquid Comet / 液态彗星焦点
   全屏只允许一个共享焦点框、一条光轨和一次最终落点。普通卡片永远不传播余波；
   同帧输入合并、旧动画立即取消、语义焦点永远先更新，视觉再追上。 */
const FOCUS_FX = { layer: null, halo: null, haloAnim: null, pending: null, raf: 0, seq: 0, lastInput: 0, settle: 0, target: null, key: "", reduced: false };
function navFocused() { return document.querySelector(".screen.active .focus"); }
function focusFxReduced() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
}
function focusRect(el) {
  if (!el || !el.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 } : null;
}
function ensureFocusFx() {
  if (FOCUS_FX.layer && document.body.contains(FOCUS_FX.layer)) return;
  const layer = document.createElement("div"); layer.id = "focus-fx"; layer.setAttribute("aria-hidden", "true");
  const halo = document.createElement("div"); halo.className = "focus-halo"; layer.appendChild(halo);
  $("app").appendChild(layer); FOCUS_FX.layer = layer; FOCUS_FX.halo = halo;
}
function clearFocusBursts() {
  ensureFocusFx();
  while (FOCUS_FX.layer.children.length > 1) FOCUS_FX.layer.removeChild(FOCUS_FX.layer.lastChild);
}
/* v6.5:液态彗星回归"极速版" —— 保留飞行光轨/撞击视觉,但时长压缩近半、
   粒子减量,并且卡片自身反馈始终即时(特效只是叠加,不再是唯一指示)。 */
function placeFocusHalo(r) {
  ensureFocusFx();
  if (!r) { FOCUS_FX.halo.style.opacity = "0"; return; }
  const pad = 5;
  Object.assign(FOCUS_FX.halo.style, { left: (r.left - pad) + "px", top: (r.top - pad) + "px", width: (r.width + pad * 2) + "px", height: (r.height + pad * 2) + "px", opacity: "1" });
}
function cancelFocusFx(snap) {
  FOCUS_FX.seq++; FOCUS_FX.pending = null;
  if (FOCUS_FX.raf) { cancelAnimationFrame(FOCUS_FX.raf); FOCUS_FX.raf = 0; }
  clearTimeout(FOCUS_FX.settle); FOCUS_FX.settle = 0;
  if (FOCUS_FX.haloAnim) { try { FOCUS_FX.haloAnim.cancel(); } catch (e) { } FOCUS_FX.haloAnim = null; }
  clearFocusBursts();
  if (snap) placeFocusHalo(focusRect(navFocused()));
}
function syncFocusFx() {
  cancelFocusFx(false); placeFocusHalo(focusRect(navFocused()));
}
function requestFocusSync() {
  const seq = FOCUS_FX.seq;
  requestAnimationFrame(() => {
    // 方向键光轨优先；普通重绘只在没有待播放导航动效时校准共享焦点框。
    if (FOCUS_FX.pending || FOCUS_FX.raf || seq !== FOCUS_FX.seq) return;
    syncFocusFx();
  });
}
function focusBeam(from, to, duration, rapid) {
  if (!from || !to || focusFxReduced()) return;
  const dx = to.cx - from.cx, dy = to.cy - from.cy, dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 3) return;
  const beam = document.createElement("div"); beam.className = "focus-beam";
  Object.assign(beam.style, { left: from.cx + "px", top: from.cy + "px", width: dist + "px", transform: "rotate(" + Math.atan2(dy, dx) + "rad) scaleX(.05)", opacity: "0" });
  FOCUS_FX.layer.appendChild(beam);
  try { beam.animate([
    { transform: "rotate(" + Math.atan2(dy, dx) + "rad) scaleX(.05)", opacity: 0, offset: 0 },
    { transform: "rotate(" + Math.atan2(dy, dx) + "rad) scaleX(.72)", opacity: rapid ? .48 : .92, offset: .18 },
    { transform: "rotate(" + Math.atan2(dy, dx) + "rad) scaleX(1)", opacity: rapid ? .28 : .64, offset: .56 },
    { transform: "rotate(" + Math.atan2(dy, dx) + "rad) scaleX(1)", opacity: 0, offset: 1 }
  ], { duration: duration, easing: "cubic-bezier(.16,.78,.22,1)" }); } catch (e) { }
}
function focusImpact(r, key, target, seq) {
  if (!r || seq !== FOCUS_FX.seq || focusFxReduced()) return;
  const vector = NAV_DIR[key] || [1, 0];
  const wide = r.width > r.height * 3;
  for (let i = 0; i < 2; i++) {
    const ring = document.createElement("div"); ring.className = "focus-impact r" + i;
    Object.assign(ring.style, { left: (r.left - 8) + "px", top: (r.top - 8) + "px", width: (r.width + 16) + "px", height: (r.height + 16) + "px" });
    FOCUS_FX.layer.appendChild(ring);
    const start = wide ? "scale(.992,.82)" : "scale(.82)";
    const end = wide ? (i ? "scale(1.018,1.28)" : "scale(1.012,1.16)") : ("scale(" + (i ? 1.20 : 1.11) + ")");
    try { ring.animate([
      { transform: start, opacity: 0 }, { transform: "scale(1)", opacity: i ? .48 : .88, offset: .28 },
      { transform: end, opacity: 0 }
    ], { duration: 190 + i * 50, delay: i * 20, easing: "cubic-bezier(.18,.72,.18,1)" }); } catch (e) { }
  }
  // 火花按控件短边计算并设上限；超宽列表不会再把火花拉成横跨全屏的光柱。
  const shortSide = Math.min(r.width, r.height);
  const sparkStart = clamp(shortSide * .25, 16, 44);
  const sparkEnd = clamp(shortSide * .72, 44, 108);
  const count = 5;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i / count) + (vector[0] ? 0 : Math.PI / 8);
    const spark = document.createElement("div"); spark.className = "focus-spark";
    Object.assign(spark.style, { left: r.cx + "px", top: r.cy + "px", transform: "rotate(" + a + "rad) translateX(" + sparkStart + "px) scaleX(.1)" });
    FOCUS_FX.layer.appendChild(spark);
    try { spark.animate([
      { transform: "rotate(" + a + "rad) translateX(" + sparkStart + "px) scaleX(.1)", opacity: 0 },
      { opacity: .9, offset: .18 },
      { transform: "rotate(" + a + "rad) translateX(" + sparkEnd + "px) scaleX(1)", opacity: 0 }
    ], { duration: 180 + (i % 3) * 25, easing: "cubic-bezier(.12,.7,.22,1)" }); } catch (e) { }
  }
  setTimeout(() => {
    if (seq !== FOCUS_FX.seq) return;
    clearFocusBursts();
    // 卡片自身的 96ms 上浮缩放已完成，再以最终像素位置校准共享焦点框。
    placeFocusHalo(focusRect(navFocused()));
  }, 300);
}
function playFocusFx(key, from, to, target, rapid) {
  ensureFocusFx(); clearFocusBursts();
  const seq = ++FOCUS_FX.seq, dx = to.cx - from.cx, dy = to.cy - from.cy;
  // v6.5 极速:飞行 80~120ms(连按 60ms),框子和卡片几乎同时到位
  const dist = Math.sqrt(dx * dx + dy * dy), duration = rapid ? 60 : Math.round(clamp(78 + dist * .06, 80, 120));
  placeFocusHalo(to);
  if (FOCUS_FX.haloAnim) { try { FOCUS_FX.haloAnim.cancel(); } catch (e) { } FOCUS_FX.haloAnim = null; }
  const sx = clamp(from.width / to.width, .55, 1.8), sy = clamp(from.height / to.height, .55, 1.8);
  const ux = dist ? dx / dist : 0, uy = dist ? dy / dist : 0;
  try { FOCUS_FX.haloAnim = FOCUS_FX.halo.animate([
    { transform: "translate3d(" + (from.cx - to.cx) + "px," + (from.cy - to.cy) + "px,0) scale(" + sx + "," + sy + ")", opacity: .72, offset: 0 },
    { transform: "translate3d(" + (-dx * .16) + "px," + (-dy * .16) + "px,0) scale(" + (Math.abs(dx) > Math.abs(dy) ? 1.08 : .96) + "," + (Math.abs(dx) > Math.abs(dy) ? .96 : 1.08) + ")", opacity: 1, offset: .54 },
    { transform: "translate3d(" + (7 * ux) + "px," + (7 * uy) + "px,0) scale(1.025,.99)", opacity: 1, offset: .78 },
    { transform: "translate3d(" + (-2 * ux) + "px," + (-2 * uy) + "px,0) scale(.994,1.006)", opacity: 1, offset: .91 },
    { transform: "translate3d(0,0,0) scale(1)", opacity: 1, offset: 1 }
  ], { duration: duration, easing: "linear" }); } catch (e) { FOCUS_FX.haloAnim = null; }
  focusBeam(from, to, duration, rapid);
  clearTimeout(FOCUS_FX.settle);
  FOCUS_FX.target = target; FOCUS_FX.key = key;
  FOCUS_FX.settle = setTimeout(() => {
    const current = navFocused(), r = focusRect(current);
    if (seq === FOCUS_FX.seq && current === FOCUS_FX.target) focusImpact(r, FOCUS_FX.key, current, seq);
  }, rapid ? 55 : Math.min(60, duration * .5));
}
function scheduleFocusFx(key, before, beforeRect) {
  const target = navFocused();
  if (!NAV_DIR[key] || !before || !target || before === target) return;
  // who/cloud 等列表会整块重建 DOM，必须在 handler 运行前保存出发位置。
  const from = beforeRect || focusRect(before), to = focusRect(target); if (!from || !to) return;
  const now = NOW(), rapid = now - FOCUS_FX.lastInput < 90; FOCUS_FX.lastInput = now;
  FOCUS_FX.pending = { key: key, from: from, to: to, target: target, rapid: rapid };
  if (FOCUS_FX.raf) return;
  FOCUS_FX.raf = requestAnimationFrame(() => {
    FOCUS_FX.raf = 0; const p = FOCUS_FX.pending; FOCUS_FX.pending = null;
    if (!p) return;
    if (focusFxReduced()) { placeFocusHalo(p.to); return; }
    playFocusFx(p.key, p.from, p.to, p.target, p.rapid);
  });
}
function show(name) {
  if (SCREEN === "world" && name !== "world" && window.WordWorld && typeof window.WordWorld.stop === "function") {
    try { window.WordWorld.stop(); } catch (e) { }
  }
  if (SCREEN === "skytrail" && name !== "skytrail" && window.WordRush && typeof window.WordRush.stop === "function") {
    try { window.WordRush.stop(); } catch (e) { }
  }
  if (SCREEN === "memory-maze" && name !== "memory-maze" && window.MemoryMaze && typeof window.MemoryMaze.stop === "function") {
    try { window.MemoryMaze.stop(); } catch (e) { }
  }
  if (SCREEN === "echo-heist" && name !== "echo-heist" && window.EchoHeist && typeof window.EchoHeist.stop === "function") {
    try { window.EchoHeist.stop(); } catch (e) { }
  }
  if (SCREEN === "versus" && name !== "versus" && window.FamilyVS && typeof window.FamilyVS.stop === "function") {
    try { window.FamilyVS.stop(); } catch (e) { }
  }
  cancelFocusFx(false);
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(name).classList.add("active");
  SCREEN = name;
  // 进屏动画(v5-screen-in .15s)期间测量的焦点框位置会随内容整体偏下,
  // 动画结束后再校准一次,消除"刚进菜单选择框向下歪"的错位。
  setTimeout(() => { try { requestFocusSync(); } catch (e) { } }, 210);
  try { if (handlers[name] && handlers[name].enter) handlers[name].enter(); }
  catch (e) { toast("界面错误:" + (e && e.message)); }
  requestAnimationFrame(() => placeFocusHalo(focusRect(navFocused())));
}
const TV_CARRY_GUARD = { key: "", until: 0, span: 0 };
function armTvCarryGuard(key, ms) {
  TV_CARRY_GUARD.key = key;
  TV_CARRY_GUARD.span = Math.max(320, Number(ms) || 0);
  TV_CARRY_GUARD.until = NOW() + TV_CARRY_GUARD.span;
}
window.onTvKey = k => {
  const signalAt = NOW();
  if (TV_CARRY_GUARD.key === k && signalAt < TV_CARRY_GUARD.until) {
    TV_CARRY_GUARD.until = signalAt + TV_CARRY_GUARD.span;
    return;
  }
  if (signalAt >= TV_CARRY_GUARD.until) TV_CARRY_GUARD.key = "";
  try { $("toast").classList.remove("show"); } catch (e) { }
  const before = NAV_DIR[k] ? navFocused() : null;
  const beforeRect = before ? focusRect(before) : null;
  const h = handlers[SCREEN];
  try { if (h && h.key) h.key(k); } catch (e) { toast("按键错误:" + (e && e.message)); }
  if (NAV_DIR[k]) scheduleFocusFx(k, before, beforeRect);
  // 音效延后到焦点状态更新之后,永远不阻塞遥控输入。
  Promise.resolve().then(() => {
    try {
      if (window.SFX) {
        if (NAV_DIR[k]) SFX.nav();
        else if (k === "OK") SFX.ok();
        else if (k === "BACK") SFX.back();
      }
    } catch (e) { }
  });
};
window.addEventListener("resize", () => requestAnimationFrame(() => placeFocusHalo(focusRect(navFocused()))));
document.addEventListener("keydown", e => {
  const map = { ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT", Enter: "OK", Escape: "BACK", Backspace: "BACK" };
  if (map[e.key]) { e.preventDefault(); window.onTvKey(map[e.key]); }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (P) { flushP(); saveApp(); }
    try { if (typeof pauseChase === "function") pauseChase(); } catch (e) { }
  } else {
    try { if (typeof resumeChase === "function") resumeChase(); } catch (e) { }
  }
});
window.addEventListener("pagehide", () => {
  if (P) { flushP(); saveApp(); }
  try { if (typeof pauseChase === "function") pauseChase(); } catch (e) { }
});
window.addEventListener("blur", () => { try { if (typeof pauseChase === "function") pauseChase(); } catch (e) { } });
window.addEventListener("focus", () => { try { if (typeof resumeChase === "function") resumeChase(); } catch (e) { } });

/* 原生 onResume 兜底:部分电视盒子从后台回来时不触发 focus/visibility 事件,
   导致游戏帧循环和音频停在挂起态。原生层恢复时直接调这里,把一切叫醒。 */
window.onAppResume = () => {
  try { if (window.SFX && SFX.resume) SFX.resume(); } catch (e) { }
  try { window.dispatchEvent(new Event("focus")); } catch (e) { }
  try { document.dispatchEvent(new Event("visibilitychange")); } catch (e) { }
  try { if (typeof resumeChase === "function") resumeChase(); } catch (e) { }
  try { if (SCREEN === "home" && handlers.home && handlers.home.enter) handlers.home.enter(); } catch (e) { }
};

const MENU = [
  { id: "world", ic: "\uD83C\uDF0D", t: "\u8BCD\u6C47\u4E16\u754C", d: "\u63A2\u7D22\u8BCD\u6C47\u79D8\u5883 \u00B7 \u5728\u5192\u9669\u4E2D\u5DE9\u56FA\u590D\u4E60" },
  { id: "new", ic: "✒️", t: "学新词", d: "衬线大字卡 · 自动发音" },
  { id: "review", ic: "🧠", t: "智能复习", d: "FSRS 记忆算法调度" },
  { id: "weak", ic: "🛡️", t: "弱项突围", d: "按遗忘风险精准选题" },
  { id: "arcade", ic: "🎮", t: "训练馆", d: "多种记忆游戏 · 今日推荐" },
  { id: "sim", ic: "🏦", t: "实景模拟", d: "盈透/港新银行App动画实操课" },
  { id: "screens", ic: "📱", t: "界面对照", d: "对着券商/银行App学界面英文" },
  { id: "browse", ic: "📖", t: "单词本", d: "今日新学 · 全部已学" },
  { id: "custom", ic: "🗓️", t: "自选复习", d: "按日期挑单词随时复习" },
  { id: "ai", ic: "👨‍🏫", t: "AI 外教", d: "对话 · 跟读 · 情景课 · 教练" },
  { id: "assistant", ic: "🤖", t: "AI 助手", d: "grok 智能问答 · 语音提问" },
  { id: "versus", ic: "⚔️", t: "家庭对战", d: "两人同屏 · 答对出招 · 战绩榜" },
  { id: "decks", ic: "📚", t: "词库", d: "开关词书 · 外部扩展" },
  { id: "cloud", ic: "☁️", t: "云端词书", d: "搜索 · 安装 · 离线使用" },
  { id: "stats", ic: "📊", t: "统计", d: "热力图 · 掌握度" },
  { id: "who", ic: "👥", t: "家庭空间", d: "独立进度 · 新增使用者" },
  { id: "settings", ic: "⚙️", t: "设置", d: "新词量 · 发音 · 语速" }
];
const GAME_MENU = [
  { id: "echo", ic: "◈", t: "记忆裂隙", d: "迷宫寻门 · 对照表常驻 · 环路甩开词灵" },
  { id: "skytrail", ic: "✦", t: "词境疾驰", d: "多花样航段 · 冲过正确词义星门" },
  { id: "maze", ic: "⌘", t: "星火遗迹", d: "真迷宫潜行 · 收集回声躲开词怪" },
  { id: "quiz", ic: "⚡", t: "闪电测验", d: "限时四选一 · 连击得分" },
  { id: "listen", ic: "🎧", t: "听音辨义", d: "只听发音 · 训练听力反应" },
  { id: "cloze", ic: "📝", t: "例句填空", d: "读懂整句中文选英文词" },
  { id: "spell", ic: "⌨️", t: "拼写挑战", d: "听音看义 · 完整拼写" },
  { id: "chunks", ic: "🧩", t: "词块拼装", d: "拆成词块 · 重建字形记忆" },
  { id: "sentence", ic: "💬", t: "句子拼图", d: "重排语序 · 读懂真实用法" },
  { id: "starship", ic: "🚀", t: "词汇星舰", d: "双向回忆 · 护盾波次生存" },
  { id: "match", ic: "🀄", t: "词义配对", d: "消除式配对 · 双通道记忆" },
  { id: "tf", ic: "⚖️", t: "极速判断", d: "对错二选一 · 拼反应" },
  { id: "battle", ic: "🤖", t: "人机对战", d: "和 AI 拼速度与准确率" },
  { id: "chase", ic: "👾", t: "词怪追逐", d: "答对击退怪物 · 闯关逃生" }
];
function homeItems() { return MENU.filter(it => !PF().menuHide[it.id]); }
function homeCols() { return homeItems().length >= 13 ? 5 : 4; }
function arcadeItems() { return GAME_MENU.slice(); }
// 电视端固定五列：新增真正的游戏后仍保持远距离可读，不把卡片压成手机式小字。
function arcadeCols() { return 5; }

/* 首页每日:英文日期 + 一句鸡汤(中英),按年内天数轮换,每天自动换一句 */
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const QUOTES = [
  { en: "Little by little, one goes far.", zh: "积跬步,方能至千里。" },
  { en: "Every word is a new door.", zh: "每一个单词,都是一扇新的门。" },
  { en: "Small steps, every single day.", zh: "每天一小步,终会到达。" },
  { en: "Consistency beats intensity.", zh: "细水长流,胜过一时猛进。" },
  { en: "Today's effort, tomorrow's ease.", zh: "今天的努力,是明天的从容。" },
  { en: "Slow is smooth, smooth is fast.", zh: "慢即是稳,稳即是快。" },
  { en: "One page a day becomes a book.", zh: "每天一页,终成一书。" },
  { en: "Words are the bandwidth of thought.", zh: "词汇,是思想的带宽。" },
  { en: "Show up — that's half the battle.", zh: "坚持出现,就已赢了一半。" },
  { en: "Knowledge compounds like interest.", zh: "知识,会像利息一样滚雪球。" },
  { en: "Fall in love with the process.", zh: "爱上过程,结果自来。" },
  { en: "A little each day adds up to a lot.", zh: "每天一点点,终成一大片。" },
  { en: "The best time to start is now.", zh: "开始的最好时机,就是现在。" },
  { en: "Practice makes progress.", zh: "练习,造就进步。" },
  { en: "Better done well than done fast.", zh: "做得精,胜过做得快。" },
  { en: "Learn something today, keep it forever.", zh: "今天学到的,会陪你很久。" }
];
function dailyIndex() {
  const n = new Date();
  return Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 86400000);
}
function dateLabel() {
  const n = new Date();
  return WEEKDAYS[n.getDay()] + " · " + MONTHS[n.getMonth()] + " " + n.getDate();
}
function dailyQuote() { return QUOTES[dailyIndex() % QUOTES.length]; }
let homeIdx = 0;
handlers.home = {
  enter() {
    const items = homeItems();
    if (homeIdx >= items.length) homeIdx = 0;
    const due = dueWords().length;
    const weakN = Math.min(15, weakWords().length);
    let unseen = 0;
    for (const e of activeWords()) { const r = P.words[e.w]; if (!r || !r.st) unseen++; }
    const newRemain = Math.min(newQuota(), unseen);
    $("h-streak").textContent = P.streak;
    $("h-level").textContent = level();
    $("h-mastered").textContent = Object.values(P.words).filter(r => r.st === 2 && r.S >= 21).length;
    $("h-due").textContent = due + newRemain;
    if (window.glyph) {
      $("h-flame").innerHTML = glyph("flame");
      $("h-lvg").innerHTML = glyph("star");
      $("h-sealg").innerHTML = glyph("seal");
      const uc = $("h-user-chip");
      if (uc) { uc.className = "chip chip-user pf-" + CUR; uc.innerHTML = window.avatar(CUR) + '<b>' + PF().short + '</b>'; }
    } else { $("h-user").textContent = PF().short; }
    const dq = dailyQuote();
    if ($("h-date")) $("h-date").textContent = dateLabel();
    $("h-slogan").textContent = dq.en;
    $("h-sub").textContent = dq.zh;
    const m = $("menu"); m.innerHTML = "";
    m.style.gridTemplateColumns = "repeat(" + homeCols() + ",1fr)";
    m.classList.toggle("dense", items.length > 16);
    items.forEach((it, i) => {
      const el = document.createElement("div");
      el.className = "mcard" + (i === homeIdx ? " focus" : "");
      let badge = "";
      if (it.id === "review" && due) badge = '<div class="badge">' + due + '</div>';
      if (it.id === "new" && newRemain) badge = '<div class="badge">' + newRemain + '</div>';
      if (it.id === "weak" && weakN >= 8) badge = '<div class="badge">推荐</div>';
      if (it.id === "arcade") badge = '<div class="badge">' + arcadeItems().length + '</div>';
      const desc = it.id === "who" ? (activeProfileMeta().length + " 个独立空间 · 新增/切换") : it.d;
      el.innerHTML = badge + (window.iconTile ? iconTile(it.id) : '<div class="ic">' + it.ic + '</div>') + '<div><div class="t">' + it.t + '</div><div class="d">' + desc + '</div></div>';
      m.appendChild(el);
    });
  },
  key(k) {
    const items = homeItems();
    const cols = homeCols(), n = items.length;
    if (["LEFT", "RIGHT", "UP", "DOWN"].includes(k)) homeIdx = gridMoveIndex(homeIdx, k, n, cols);
    else if (k === "OK") { RETURN_SCREEN = "home"; openMenu(items[homeIdx].id); return; }
    else if (k === "BACK") { flushP(); saveApp(); NativeBridge.exitApp(); return; }
    homeFocus();   // 只切换焦点类,不重建DOM → 聚焦平滑滑动
  }
};
function homeFocus() {
  const cards = document.querySelectorAll("#menu .mcard");
  for (let i = 0; i < cards.length; i++) cards[i].classList.toggle("focus", i === homeIdx);
}
function openMenu(id) {
  if (id === "new") startStudy("new");
  else if (id === "review") startStudy("review");
  else if (id === "world") {
    if (window.WordWorld && typeof window.WordWorld.open === "function") window.WordWorld.open();
    else toast("\u8BCD\u6C47\u4E16\u754C\u8FD8\u5728\u51C6\u5907\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
  }
  else if (id === "weak") startQuiz("weak");
  else if (id === "arcade") { AR.idx = 0; show("arcade"); }
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
  else if (id === "chunks") { startChunks(); }
  else if (id === "sentence") { startSentence(); }
  else if (id === "starship") { startStarship(); }
  else if (id === "chase") { startChase(); }
  else if (id === "skytrail") {
    if (window.WordRush && typeof window.WordRush.open === "function") window.WordRush.open();
    else toast("词境疾驰正在唤醒，请稍后重试");
  }
  else if (id === "maze") {
    if (window.MemoryMaze && typeof window.MemoryMaze.open === "function") window.MemoryMaze.open();
    else toast("星火遗迹正在重建，请稍后重试");
  }
  else if (id === "echo") {
    if (window.EchoHeist && typeof window.EchoHeist.open === "function") window.EchoHeist.open();
    else toast("记忆裂隙正在唤醒，请稍后重试");
  }
  else if (id === "who") { WHO.phase = "list"; WHO.idx = Math.max(0, activeProfileMeta().findIndex(m => m.id === CUR)); show("who"); }
  else if (id === "cloud") { CLOUD.phase = "list"; CLOUD.row = 0; show("cloud"); }
  else if (id === "screens") { SC.view = "list"; SC.gi = 0; show("screens"); }
  else if (id === "ai") show("ai");
  else if (id === "assistant") { AX.i = 0; show("assistant"); }
  else if (id === "versus") { if (window.FamilyVS) window.FamilyVS.open(); else toast("请更新到最新版以使用家庭对战"); }
  else show(id);
}

/* ================= 训练馆(原有 8 种 + 2 种新玩法) ================= */
const AR = { idx: 0 };
function arcadeRecommended(items) {
  const tried = items.filter(it => P.game && P.game[it.id] && P.game[it.id].sessions);
  const weak = tried.slice().sort((a, b) => (P.game[a.id].lastAcc || 0) - (P.game[b.id].lastAcc || 0))[0];
  if (weak && (P.game[weak.id].lastAcc || 0) < 75) return { it: weak, why: "上次正确率 " + P.game[weak.id].lastAcc + "%,今天再巩固一次" };
  const it = items[dailyIndex() % items.length];
  return { it: it, why: "今日轮换训练 · 换一种记忆通道,效果更稳" };
}
function arcadeFocus() {
  const cards = document.querySelectorAll("#arc-grid .mcard");
  for (let i = 0; i < cards.length; i++) cards[i].classList.toggle("focus", i === AR.idx);
}
handlers.arcade = {
  enter() {
    const items = arcadeItems();
    if (AR.idx >= items.length) AR.idx = 0;
    $("arc-mark").textContent = items.length;
    const reco = arcadeRecommended(items);
    $("arc-rec-name").textContent = reco.it.t;
    $("arc-rec-desc").textContent = reco.why + " · 词源:" + gameSrcName();
    const grid = $("arc-grid"); grid.innerHTML = "";
    grid.style.gridTemplateColumns = "repeat(" + arcadeCols() + ",1fr)";
    items.forEach((it, i) => {
      const g = (P.game && P.game[it.id]) || null;
      const meta = g && g.sessions ? ("最佳 " + (g.best || 0) + " · 最近 " + (g.lastAcc || 0) + "%") : "尚未挑战 · 从零开始";
      const el = document.createElement("div");
      el.className = "mcard" + (i === AR.idx ? " focus" : "");
      el.dataset.game = it.id;
      el.innerHTML = (window.iconTile ? iconTile(it.id) : '<div class="ic">' + it.ic + '</div>')
        + '<div><div class="t">' + it.t + '</div><div class="d">' + it.d + '</div><div class="game-meta">' + meta + '</div></div>';
      grid.appendChild(el);
    });
  },
  key(k) {
    const items = arcadeItems(), n = items.length, cols = arcadeCols();
    if (k === "BACK") { show("home"); return; }
    if (["LEFT", "RIGHT", "UP", "DOWN"].includes(k)) AR.idx = gridMoveIndex(AR.idx, k, n, cols);
    else if (k === "OK") { RETURN_SCREEN = "arcade"; openMenu(items[AR.idx].id); return; }
    arcadeFocus();
  }
};

/* ================= 学习(新词/复习/自选) ================= */
const ST = { queue: [], i: 0, mode: "new", phase: "front", done: 0, again: 0, total: 0, lock: false, label: "", run: 0 };
function startStudy(mode) {
  RETURN_SCREEN = "home";
  ST.run++;
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
  if (P.set.auto) { const run = ST.run; setTimeout(() => { if (SCREEN === "study" && ST.run === run) speak(e.w); }, 250); }
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
  try { if (window.SFX) (g >= 3 ? SFX.good() : g === 2 ? SFX.ok() : SFX.bad()); } catch (e2) { }
  if (ST.mode === "new" && (!P.words[e.w] || !P.words[e.w].st)) P.dayNew[todayStr()] = (P.dayNew[todayStr()] || 0) + 1;
  rate(e.w, g);
  if (g < 3) { ST.again++; ST.queue.splice(Math.min(ST.queue.length, ST.i + 4), 0, e); ST.total = ST.queue.length; }
  ST.done++;
  const run = ST.run;
  setTimeout(() => {
    if (SCREEN !== "study" || ST.run !== run) return;
    ST.i++;
    if (ST.i >= ST.queue.length) finishSession();
    else renderCard();
  }, 260);
}
handlers.study = {
  key(k) {
    if (k === "BACK") { ST.run++; show("home"); return; }
    if (ST.lock) return;
    if (ST.phase === "front") {
      if (k === "OK") flipCard();
      else if (k === "RIGHT") judge(3);
      else if (k === "LEFT") { const run = ST.run; ST.lock = true; flipCard(); setTimeout(() => { if (SCREEN === "study" && ST.run === run) { ST.lock = false; judge(1); } }, 900); }
      else if (k === "DOWN") { const run = ST.run; ST.lock = true; flipCard(); setTimeout(() => { if (SCREEN === "study" && ST.run === run) { ST.lock = false; judge(2); } }, 900); }
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
    + '<div class="stat"><div class="n nflame">' + (window.glyph ? glyph("flame") : "") + P.streak + '</div><div class="l">连续天数</div></div>';
  $("f-msg").textContent = acc >= 85 ? "状态极佳,记忆曲线已为你安排好下次复习" : "没关系,忘记是记忆的必经之路,算法会加密复习";
  // 今日新词与复习都清零 → 全屏礼花庆祝(每天只放一次)
  try {
    const td = todayStr();
    if (!dueWords().length && !newQuota() && P.celebrated !== td) {
      P.celebrated = td; saveP();
      setTimeout(() => { try { if (window.celebrate) window.celebrate("今日任务完成!"); if (window.SFX) SFX.win(); } catch (e) { } }, 420);
    }
  } catch (e) { }
  show("finish");
}
handlers.finish = { key(k) { if (k === "OK" || k === "BACK") show(RETURN_SCREEN || "home"); } };

/* ================= 测验(闪电/听音/填空) ================= */
const QZ = { list: [], i: 0, mode: "quiz", sel: 0, score: 0, combo: 0, best: 0, right: 0, lock: false, timer: null, tStart: 0, ansIdx: 0, optCount: 4, run: 0 };
const QUIZ_N = 15, QUIZ_MS = 9000;
function startQuiz(mode) {
  QZ.run++;
  if (mode === "listen" && !P.set.tts) { toast("请先在设置中开启发音"); return; }
  let pool = mode === "weak" ? weakWords() : gameWords();
  if (mode === "cloze") pool = pool.filter(e => e.x && e.x.length > 8);
  if (pool.length < 8) { toast("「" + gameSrcName() + "」词量不足 8 个" + SRC_HINT); return; }
  QZ.list = mode === "weak" ? pool.slice(0, QUIZ_N) : shuffle(pool.slice()).slice(0, QUIZ_N);
  QZ.i = 0; QZ.mode = mode; QZ.score = 0; QZ.combo = 0; QZ.best = 0; QZ.right = 0;
  show("quiz"); renderQuiz();
}
function renderQuiz() {
  QZ.lock = false; QZ.sel = 0;
  const e = QZ.list[QZ.i];
  $("q-mode").textContent = QZ.mode === "quiz" ? "闪电测验" : (QZ.mode === "listen" ? "听音辨义" : (QZ.mode === "weak" ? "弱项突围" : "例句填空"));
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
  if (QZ.mode === "quiz" || QZ.mode === "listen" || QZ.mode === "weak") {
    $("q-word").style.display = ""; $("q-phon").style.display = ""; $("q-sent").style.display = "none";
    if (QZ.mode === "listen") {
      $("q-word").textContent = "🎧";
      $("q-phon").textContent = "仔细听发音,选出正确释义 · 稍等会自动重播";
      const qi = QZ.i, run = QZ.run;
      setTimeout(() => { if (SCREEN === "quiz" && QZ.run === run && QZ.i === qi && !QZ.lock) speak(e.w); }, 3500);
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
  clearTimeout(QZ.timer); QZ.tStart = NOW();
  if (QZ.mode === "cloze" || QZ.mode === "weak") {
    // 深度回忆类不限时:避免把“想起来了”误判成“太慢”
    $("q-timer").style.transition = "none";
    $("q-timer").style.width = "0%";
  } else {
    QZ.timer = timerBar("q-timer", QUIZ_MS, () => answer(-1));
  }
  requestFocusSync();
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
  QZ.lock = true; stopTimerBar(QZ.timer, "q-timer");
  const e = QZ.list[QZ.i];
  const opts = document.querySelectorAll("#q-opts .opt");
  const ok = idx === QZ.ansIdx;
  if (opts[QZ.ansIdx]) opts[QZ.ansIdx].classList.add("right");
  if (!ok && idx >= 0 && opts[idx]) opts[idx].classList.add("wrong");
  if (QZ.mode === "listen") { $("q-word").textContent = e.w; $("q-phon").textContent = e.p ? "/" + e.p + "/" : ""; }
  try { if (window.SFX) (ok ? SFX.good() : SFX.bad()); } catch (e2) { }
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
  schedHit(e.w, ok);
  if (QZ.mode === "cloze" && ok) speak(e.x);
  const run = QZ.run;
  setTimeout(() => {
    if (SCREEN !== "quiz" || QZ.run !== run) return;
    QZ.i++;
    if (QZ.i >= QZ.list.length) finishQuiz(); else renderQuiz();
  }, ok ? 900 : 1900);
}
function finishQuiz() {
  $("f-title").textContent = QZ.right === QZ.list.length ? "全对!完美!" : (QZ.mode === "weak" ? "薄弱词已加固" : "测验完成");
  $("f-xp").textContent = "+" + (QZ.right * 5) + " XP · 得分 " + QZ.score;
  $("f-stats").innerHTML =
    '<div class="stat"><div class="n" style="color:var(--good)">' + QZ.right + '/' + QZ.list.length + '</div><div class="l">答对</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">×' + QZ.best + '</div><div class="l">最高连击</div></div>'
    + '<div class="stat"><div class="n">' + QZ.score + '</div><div class="l">总分</div></div>';
  $("f-msg").textContent = QZ.mode === "weak" ? "下一次进入会重新计算风险,把练习留给最需要的词" : (QZ.right >= QZ.list.length * 0.8 ? "反应又快又准,词汇正在变成本能" : "错误的词已被算法标记,复习时会重点照顾");
  gameResult(QZ.mode, QZ.right, QZ.list.length, QZ.score); show("finish");
}
/* 例句填空:显示整句中文翻译。优先用词库内置译文(第5字段),
   否则查本机缓存,再否则调用AI翻译一次并永久缓存。 */
let _trSeq = 0;
function resolveSentenceTr(e, done) {
  if (e.tr) { done(e.tr, true); return; }
  if (!P.tr) P.tr = {};
  if (P.tr[e.w]) { done(P.tr[e.w], true); return; }
  const ownerP = P, ownerCur = CUR, ownerWord = e.w;
  aiCall([
    { role: "system", content: "你是专业翻译。把用户给的英文句子翻译成通顺自然的简体中文,只输出译文本身,不要加引号、拼音、英文或任何解释。" },
    { role: "user", content: e.x }
  ], (content, err) => {
    if (content) {
      const t = String(content).replace(/^[\s\"'「」]+|[\s\"'「」]+$/g, "").trim();
      if (t) {
        // AI 回包可能晚于使用者切换；只允许写回发起请求时的家庭空间。
        if (P === ownerP && CUR === ownerCur) { ownerP.tr[ownerWord] = t; saveP(); }
        done(t, true); return;
      }
    }
    done("（整句翻译需联网,可稍后再进此题）", false);
  }, 240);
}
function setClozeTr(e) {
  const seq = ++_trSeq;
  const put = (txt, cls) => {
    const el = document.getElementById("q-tr");
    if (!el || seq !== _trSeq) return;
    el.textContent = txt;
    el.style.color = cls === "dim" ? "var(--dim)" : "var(--gold)";
  };
  if (!e.tr && !(P.tr && P.tr[e.w])) put("　整句翻译加载中…", "dim");
  resolveSentenceTr(e, (txt, ok) => put(txt, ok ? "" : "dim"));
}

handlers.quiz = {
  key(k) {
    if (k === "BACK") { QZ.run++; stopTimerBar(QZ.timer, "q-timer"); show(RETURN_SCREEN || "home"); return; }
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
      el.dataset.index = start + i;
      el.className = "brow" + (start + i === BR.idx ? " focus" : "");
      el.innerHTML = '<div class="w serif">' + esc(e.w) + '</div><div class="p">' + (e.p ? "/" + esc(e.p) + "/" : "") + '</div><div class="m">' + esc(e.m) + '</div><div class="g">' + gap + '</div>';
      box.appendChild(el);
    });
  },
  key(k) {
    if (k === "BACK") { show("home"); return; }
    if (k === "LEFT") { BR.tab = (BR.tab + 2) % 3; BR.idx = 0; handlers.browse.enter(); return; }
    else if (k === "RIGHT") { BR.tab = (BR.tab + 1) % 3; BR.idx = 0; handlers.browse.enter(); return; }
    else if (k === "UP") { BR.idx = Math.max(0, BR.idx - 1); if (!browseFocus()) handlers.browse.enter(); return; }
    else if (k === "DOWN") { BR.idx = Math.min(BR.list.length - 1, BR.idx + 1); if (!browseFocus()) handlers.browse.enter(); return; }
    else if ((k === "OK" || k === "PLAY") && BR.list[BR.idx]) { const e = BR.list[BR.idx]; speak(e.w + ". " + (e.x || "")); return; }
    handlers.browse.enter();
  }
};
function browseFocus() {
  const rows = $("b-list").children;
  let found = false;
  for (let i = 0; i < rows.length; i++) {
    const on = Number(rows[i].dataset.index) === BR.idx;
    rows[i].classList.toggle("focus", on); found = found || on;
  }
  return found;
}

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
      el.dataset.index = start + i;
      el.className = "rowitem" + (start + i === CU.idx ? " focus" : "");
      el.innerHTML = '<div class="ic">📅</div><div class="info"><div class="name">' + it.d + (it.d === td ? ' <span style="color:var(--gold);font-size:2vmin">今天</span>' : "") + '</div><div class="desc">该日新学 ' + it.n + ' 个单词</div></div><div class="val">OK 复习</div>';
      box.appendChild(el);
    });
  },
  key(k) {
    if (k === "BACK") { show("home"); return; }
    if (!CU.dates.length) return;
    if (k === "UP") { CU.idx = Math.max(0, CU.idx - 1); if (!customFocus()) handlers.custom.enter(); return; }
    else if (k === "DOWN") { CU.idx = Math.min(CU.dates.length - 1, CU.idx + 1); if (!customFocus()) handlers.custom.enter(); return; }
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
function customFocus() {
  const rows = $("c-list").children;
  let found = false;
  for (let i = 0; i < rows.length; i++) {
    const on = Number(rows[i].dataset.index) === CU.idx;
    rows[i].classList.toggle("focus", on); found = found || on;
  }
  return found;
}

function schedHit(w, ok) {
  practiceHit(w, ok);
  const r = P.words[w];
  // 游戏也算一次真正的首次接触：不能只记 drill 而把单词永远留在“未学习”。
  // 首次答对先进入熟悉阶段(st=1)，再次到期时仍由 FSRS 正常调度；首次答错则短期复习。
  if (!r || !r.st) rate(w, ok ? 2 : 1);
  else if (r.due <= NOW() + DAY / 2) rate(w, ok ? 3 : 1);
  else { bumpDay(); saveP(); }
}

/* ================= 词义配对 ================= */
const MT = { cells: [], idx: 0, sel: -1, round: 0, rounds: 5, score: 0, combo: 0, best: 0, right: 0, wrong: 0, pool: [], lock: false, err: null, run: 0 };
function startMatch() {
  MT.run++;
  const pool = gameWords();
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
      d.dataset.cell = i;
      d.className = "opt" + (c.done ? " done" : "") + (i === MT.idx ? " focus" : "") + (i === MT.sel ? " selw" : "") + (MT.err && MT.err.indexOf(i) >= 0 ? " wrong" : "");
      d.innerHTML = c.t === "w" ? '<span class="serif" style="font-size:3.6vmin">' + esc(c.e.w) + '</span>' : '<span>' + esc(c.e.m) + '</span>';
      g.appendChild(d);
    });
  }
  requestFocusSync();
}
function matchFocus() {
  const cells = $("m-grid").children;
  for (let i = 0; i < cells.length; i++) cells[i].classList.toggle("focus", Number(cells[i].dataset.cell) === MT.idx);
}
handlers.match = {
  key(k) {
    if (k === "BACK") { MT.run++; show(RETURN_SCREEN || "home"); return; }
    if (MT.lock) return;
    const col = MT.idx < 4 ? 0 : 1, row = MT.idx % 4;
    if (k === "UP") { MT.idx = col * 4 + (row + 3) % 4; matchFocus(); return; }
    else if (k === "DOWN") { MT.idx = col * 4 + (row + 1) % 4; matchFocus(); return; }
    else if (k === "LEFT" || k === "RIGHT") { MT.idx = (col === 0 ? 4 : 0) + row; matchFocus(); return; }
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
            const run = MT.run;
            setTimeout(() => { if (SCREEN !== "match" || MT.run !== run) return; MT.round++; if (MT.round >= MT.rounds) finishMatch(); else renderMatch(); }, 500);
          }
        } else {
          MT.combo = 0; MT.wrong++;
          MT.score = Math.max(0, MT.score - 5);
          MT.err = [MT.sel, MT.idx];
          MT.sel = -1;
          $("m-fb").textContent = "✗ 配错了! -5分 · " + word.w + " 的释义是: " + word.m;
          schedHit(word.w, false);
          MT.lock = true;
          const run = MT.run;
          setTimeout(() => { if (SCREEN !== "match" || MT.run !== run) return; MT.err = null; MT.lock = false; drawMatch(); }, 700);
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
  gameResult("match", MT.right, tot, MT.score); show("finish");
}

/* ================= 极速判断 / 人机对战 ================= */
const TF = { list: [], i: 0, truth: true, score: 0, combo: 0, best: 0, right: 0, timer: null, t0: 0, lock: false, vs: false, bot: 0, botT: null, run: 0 };
const TF_N = 20, TF_MS = 4000;
function startTF(vs) {
  TF.run++;
  const pool = gameWords();
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
    const qi = TF.i, run = TF.run;
    TF.botT = setTimeout(() => {
      if (TF.run !== run || TF.i !== qi || SCREEN !== "tf") return;
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
  clearTimeout(TF.timer); TF.t0 = NOW();
  TF.timer = timerBar("t-timer", TF_MS, () => tfAnswer(null));
  requestFocusSync();
}
function tfAnswer(saysMatch) {
  if (TF.lock) return;
  TF.lock = true; stopTimerBar(TF.timer, "t-timer");
  const e = TF.list[TF.i];
  const ok = saysMatch !== null && saysMatch === TF.truth;
  if (saysMatch !== null) (saysMatch ? $("t-yes") : $("t-no")).classList.add("focus");
  try { if (window.SFX) (ok ? SFX.good() : SFX.bad()); } catch (e2) { }
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
  const run = TF.run;
  setTimeout(() => { if (SCREEN !== "tf" || TF.run !== run) return; TF.i++; if (TF.i >= TF.list.length) finishTF(); else renderTF(); }, ok ? 600 : 1600);
}
handlers.tf = {
  key(k) {
    if (k === "BACK") { TF.run++; stopTimerBar(TF.timer, "t-timer"); clearTimeout(TF.botT); show(RETURN_SCREEN || "home"); return; }
    if (k === "MENU" || k === "PLAY") { speak(TF.list[TF.i].w); return; }
    if (TF.lock) return;
    if (k === "LEFT") tfAnswer(false);
    else if (k === "RIGHT") tfAnswer(true);
  }
};
function finishTF() {
  clearTimeout(TF.botT);
  gameResult(TF.vs ? "battle" : "tf", TF.right, TF.list.length, TF.score);
  if (TF.vs) {
    $("f-title").textContent = TF.score > TF.bot ? "🏆 你赢了!" : (TF.score === TF.bot ? "平局!" : "AI 险胜,再来!");
    $("f-xp").textContent = "+" + (TF.right * 4) + " XP";
    $("f-stats").innerHTML = '<div class="stat"><div class="n" style="color:var(--good)">' + TF.score + '</div><div class="l">你的得分</div></div>'
      + '<div class="stat"><div class="n" style="color:var(--bad)">' + TF.bot + '</div><div class="l">AI 得分</div></div>'
      + '<div class="stat"><div class="n">' + TF.right + '/' + TF.list.length + '</div><div class="l">你答对</div></div>';
    $("f-msg").textContent = "AI 不会累,但你会变强";
    show("finish"); return;
  }
  $("f-title").textContent = TF.right >= TF.list.length * 0.9 ? "反应如闪电!" : "判断完成";
  $("f-xp").textContent = "+" + (TF.right * 4) + " XP · 得分 " + TF.score;
  $("f-stats").innerHTML = '<div class="stat"><div class="n" style="color:var(--good)">' + TF.right + '/' + TF.list.length + '</div><div class="l">答对</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">x' + TF.best + '</div><div class="l">最高连击</div></div>'
    + '<div class="stat"><div class="n">' + TF.score + '</div><div class="l">总分</div></div>';
  $("f-msg").textContent = "速度加分,连击加分,答错的词会加密复习";
  show("finish");
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
    $("ai-title").textContent = "AI 外教";
    $("ai-hint").textContent = "选一个模式开始 · OK 确认";
    renderAiTopics();
  },
  key(k) {
    if (AIS.phase === 0) {
      if (k === "BACK") { show("home"); return; }
      if (k === "UP") { AIS.idx = (AIS.idx + AI_TOPICS.length - 1) % AI_TOPICS.length; if (!aiTopicFocus()) renderAiTopics(); return; }
      else if (k === "DOWN") { AIS.idx = (AIS.idx + 1) % AI_TOPICS.length; if (!aiTopicFocus()) renderAiTopics(); return; }
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
      aiReplyFocus();
    }
  }
};
function renderAiTopics() {
  const box = $("ai-topics"); box.innerHTML = "";
  const win = 5, start = Math.max(0, Math.min(AIS.idx - 2, AI_TOPICS.length - win));
  AI_TOPICS.slice(start, start + win).forEach((t, ii) => {
    const i = start + ii;
    const el = document.createElement("div");
    el.dataset.index = i;
    el.className = "rowitem" + (i === AIS.idx ? " focus" : "");
    el.innerHTML = '<div class="ic">' + t.ic + '</div><div class="info"><div class="name">' + t.n + '</div><div class="desc">' + t.d + '</div></div><div class="val">OK</div>';
    box.appendChild(el);
  });
  try { const fc = box.querySelector(".focus"); if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
  requestFocusSync();
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
  requestFocusSync();
}
function aiTopicFocus() {
  const rows = $("ai-topics").children;
  let found = false;
  for (let i = 0; i < rows.length; i++) {
    const on = Number(rows[i].dataset.index) === AIS.idx;
    rows[i].classList.toggle("focus", on); found = found || on;
  }
  return found;
}
function aiReplyFocus() {
  const items = $("ai-opts").children;
  for (let i = 0; i < items.length; i++) items[i].classList.toggle("focus", i === AIS.sel);
  const fc = items[AIS.sel];
  try { if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
}

/* ---------- 语音输入(录音→GLM-ASR云端识别) ---------- */
const VC = { on: false, rec: false };
const hasVoice = (() => { try { return !!(window.Bridge && window.Bridge.hasVoice && NativeBridge.hasVoice()); } catch (e) { return false; } })();
function voiceFbId() { return SCREEN === "assistant" ? "ax-fb" : "ai-fb"; }
window.onVoiceReady = () => { const f = $(voiceFbId()); f.style.color = "var(--gold)"; f.textContent = "🔴 录音中... 说完再按一次 OK 结束并识别 · 返回取消"; VC.rec = true; };
window.onVoicePart = t => { const f = $(voiceFbId()); f.style.color = "var(--paper)"; f.textContent = t; };
window.onVoice = t => {
  VC.on = false; VC.rec = false;
  t = (t || "").trim();
  if (SCREEN === "assistant") {
    if (!t) { $("ax-fb").textContent = "没听清,再试一次"; return; }
    $("ax-fb").textContent = ""; axSend(t); return;
  }
  if (SCREEN !== "ai" || AIS.phase !== 1) return;
  if (!t) { $("ai-fb").textContent = "没听清,再试一次"; return; }
  $("ai-say").textContent = "🗣️ " + t;
  $("ai-cn").textContent = "";
  AIS.msgs.push({ role: "user", content: t });
  aiTurn();
};
window.onVoiceErr = m => {
  VC.on = false; VC.rec = false;
  const f = $(voiceFbId()); f.style.color = "var(--bad)";
  f.textContent = "🎤 " + m;
  setTimeout(() => { try { f.style.color = ""; } catch (e) { } }, 3000);
};
function startVoice(lang) {
  if (!hasVoice) { toast("此版本不支持语音"); return; }
  VC.on = true; VC.rec = false; VC.lang = lang || "en";
  const f = $(voiceFbId()); f.style.color = "var(--gold)"; f.textContent = "🎤 正在开启麦克风...";
  try { NativeBridge.startListen(VC.lang); } catch (e) { VC.on = false; $(voiceFbId()).textContent = "麦克风启动失败"; }
}
function stopVoice() { if (VC.rec) { $(voiceFbId()).textContent = "⏳ 正在识别..."; try { NativeBridge.stopListen(); } catch (e) { } } }
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
    const fixedTeenDeck = CUR === "teen";
    $("deck-hint").textContent = fixedTeenDeck ? "弟弟空间固定使用中考核心词汇" : "OK 开关词库 · 关闭后不再出新词";
    $("deck-tip").style.display = fixedTeenDeck ? "none" : "";
    const box = $("deck-list"); box.innerHTML = "";
    DECKS.forEach((d, i) => {
      const learned = Object.values(WORDS).filter(e => e.deck === d.id && P.words[e.w] && P.words[e.w].st > 0).length;
      const pct = d.total ? Math.round(learned / d.total * 100) : 0;
      const el = document.createElement("div");
      el.className = "rowitem" + (i === deckIdx ? " focus" : "");
      el.innerHTML = (window.iconTile ? iconTile('decks') : '<div class="ic">' + d.icon + '</div>')
        + '<div class="info"><div class="name">' + esc(d.name) + (d.source === "ext" ? ' <span style="color:var(--gold);font-size:2vmin">外部</span>' : (d.source === "online" ? ' <span style="color:var(--gold);font-size:2vmin">云端 v' + d.version + '</span>' : "")) + '</div>'
        + '<div class="desc">已学 ' + learned + ' / ' + d.total + ' 词 · ' + pct + '%</div>'
        + '<div class="deckbar"><i style="width:' + pct + '%"></i></div></div>'
        + (fixedTeenDeck ? '<div class="val val-blue">固定启用</div>' : '<div class="val"><span class="ios-sw' + (deckOn(d.id) ? " on" : "") + '"></span></div>');
      box.appendChild(el);
    });
  },
  key(k) {
    if (k === "BACK") { show("home"); return; }
    if (!DECKS.length) return;
    if (k === "UP") { deckIdx = (deckIdx + DECKS.length - 1) % DECKS.length; deckFocus(); return; }
    else if (k === "DOWN") { deckIdx = (deckIdx + 1) % DECKS.length; deckFocus(); return; }
    else if (k === "OK") {
      const d = DECKS[deckIdx];
      if (CUR === "teen") { toast("弟弟空间固定使用中考核心词汇"); return; }
      if (deckOn(d.id)) P.decksOff[d.id] = 1; else delete P.decksOff[d.id];
      saveP();
    }
    handlers.decks.enter();
  }
};

/* ================= 云端词书:搜索 / 校验 / 事务安装 / 离线缓存 ================= */
const CLOUD_CATS = [
  { id: "all", name: "全部" }, { id: "spoken", name: "口语" }, { id: "travel", name: "旅行" },
  { id: "exam", name: "考试" }, { id: "finance", name: "金融" }, { id: "academic", name: "学术" }, { id: "installed", name: "已安装" }
];
const CLOUD_KEYS = "abcdefghijklmnopqrstuvwxyz0123456789".split("").concat(["SPACE", "DEL", "CLEAR", "DONE"]);
const CLOUD = { phase: "list", row: 0, keyIdx: 0, cat: 0, query: "", catalog: [], busy: "", uninstallArm: "", message: "", fetchSeq: 0, refreshed: false };
function catalogEntry(raw) {
  if (!raw) return null;
  const id = safeCloudId(raw.id), version = Number(raw.version || 0), count = Number(raw.count || 0);
  if (!id || !Number.isInteger(version) || version < 1 || !Number.isInteger(count) || count < 1 || count > CLOUD_MAX_WORDS) return null;
  let u;
  try { u = new URL(String(raw.url || "")); } catch (e) { return null; }
  if (u.protocol !== "https:" || u.hostname !== "raw.githubusercontent.com" || !u.pathname.startsWith("/ac2706673058-maker/qcz/")) return null;
  const sha = String(raw.sha256 || "").toLowerCase(); if (!/^[a-f0-9]{64}$/.test(sha)) return null;
  return {
    id: id, name: String(raw.name || id).slice(0, 40), icon: String(raw.icon || "☁️").slice(0, 4),
    tags: Array.isArray(raw.tags) ? raw.tags.map(x => String(x).slice(0, 20)).slice(0, 8) : [],
    search: String(raw.search || "").slice(0, 160), level: String(raw.level || "通用").slice(0, 30),
    count: count, version: version, url: u.href, bytes: Math.max(0, Number(raw.bytes || 0)), sha256: sha,
    license: String(raw.license || "LexTV 审核内容").slice(0, 80), source: String(raw.source || "LexTV 官方").slice(0, 80),
    minAppVersion: Math.max(0, Number(raw.minAppVersion || 0))
  };
}
function parseCatalog(raw) {
  let doc; try { doc = JSON.parse(raw); } catch (e) { throw new Error("在线目录格式错误"); }
  if (!doc || doc.schema !== 1 || !Array.isArray(doc.decks) || doc.decks.length > 200) throw new Error("在线目录版本不受支持");
  const out = [], ids = {};
  doc.decks.forEach(x => { const d = catalogEntry(x); if (d && !ids[d.id]) { ids[d.id] = 1; out.push(d); } });
  if (!out.length) throw new Error("在线目录暂时为空");
  return out;
}
function utf8Bytes(text) {
  if (window.TextEncoder) return Array.from(new TextEncoder().encode(text));
  const bin = unescape(encodeURIComponent(text)), out = []; for (let i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i)); return out;
}
function sha256Fallback(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], rotr = (x,n) => (x >>> n) | (x << (32 - n));
  const a = bytes.slice(), bitLo = (a.length * 8) >>> 0, bitHi = Math.floor(a.length / 0x20000000) >>> 0;
  a.push(0x80); while (a.length % 64 !== 56) a.push(0); for (let s = 24; s >= 0; s -= 8) a.push((bitHi >>> s) & 255); for (let s = 24; s >= 0; s -= 8) a.push((bitLo >>> s) & 255);
  for (let off = 0; off < a.length; off += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) w[i] = ((a[off+i*4]<<24)|(a[off+i*4+1]<<16)|(a[off+i*4+2]<<8)|a[off+i*4+3]) >>> 0;
    for (let i = 16; i < 64; i++) { const x = w[i-15], y = w[i-2], s0 = rotr(x,7)^rotr(x,18)^(x>>>3), s1 = rotr(y,17)^rotr(y,19)^(y>>>10); w[i] = (w[i-16]+s0+w[i-7]+s1)>>>0; }
    let [aa,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++) { const S1=rotr(e,6)^rotr(e,11)^rotr(e,25), ch=(e&f)^((~e)&g), t1=(h+S1+ch+K[i]+w[i])>>>0, S0=rotr(aa,2)^rotr(aa,13)^rotr(aa,22), maj=(aa&b)^(aa&c)^(b&c), t2=(S0+maj)>>>0; h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=aa;aa=(t1+t2)>>>0; }
    H[0]=(H[0]+aa)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  return H.map(x => x.toString(16).padStart(8,"0")).join("");
}
function sha256Hex(text) {
  const bytes = utf8Bytes(text);
  if (window.crypto && crypto.subtle && window.Uint8Array) {
    return crypto.subtle.digest("SHA-256", new Uint8Array(bytes)).then(buf => Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2,"0")).join("")).catch(() => sha256Fallback(bytes));
  }
  return Promise.resolve(sha256Fallback(bytes));
}
function currentAppCode() { const n = Number(curVC() || 0); return n > 0 ? n : 32; }
function cloudAllEntries() {
  const out = CLOUD.catalog.slice(), ids = {}; out.forEach(d => ids[d.id] = 1);
  const reg = loadCloudRegistry(); Object.keys(reg.decks).forEach(id => { if (!ids[id]) out.push(Object.assign({ id: id, retired: true, tags: [], search: "", level: "已下架", count: 0, version: reg.decks[id].version }, reg.decks[id])); });
  return out;
}
function cloudFiltered() {
  const cat = CLOUD_CATS[CLOUD.cat].id, q = CLOUD.query.trim().toLowerCase(), reg = loadCloudRegistry();
  return cloudAllEntries().filter(d => {
    if (cat === "installed" && !reg.decks[d.id]) return false;
    if (!["all", "installed"].includes(cat) && !d.tags.map(x => x.toLowerCase()).includes(cat)) return false;
    if (q && (d.name + " " + d.level + " " + d.tags.join(" ") + " " + d.search).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function loadCachedCatalog() {
  if (CLOUD.catalog.length) return;
  try { const s = NativeBridge.load("catalog_cache"); if (s) CLOUD.catalog = parseCatalog(s); } catch (e) { }
}
function refreshCloudCatalog(force) {
  const seq = ++CLOUD.fetchSeq; CLOUD.message = "正在连接官方词书仓库…"; renderCloud();
  let ctrl = null, timer = 0;
  try { ctrl = window.AbortController ? new AbortController() : null; if (ctrl) timer = setTimeout(() => ctrl.abort(), 15000); } catch (e) { }
  fetch(CATALOG_URL, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined }).then(r => { if (!r.ok) throw new Error("目录请求失败 " + r.status); return r.text(); }).then(raw => {
    if (raw.length > 300000) throw new Error("目录文件过大");
    const list = parseCatalog(raw); if (seq !== CLOUD.fetchSeq) return;
    CLOUD.catalog = list; CLOUD.message = "已连接 · " + list.length + " 本审核词书"; CLOUD.refreshed = true;
    try { NativeBridge.save("catalog_cache", raw); } catch (e) { }
    if (SCREEN === "cloud") renderCloud();
  }).catch(e => {
    if (seq !== CLOUD.fetchSeq) return;
    CLOUD.message = CLOUD.catalog.length ? "当前离线 · 使用上次缓存目录" : "连接失败 · 按播放键重试";
    if (SCREEN === "cloud") renderCloud();
  }).then(() => clearTimeout(timer));
}
function cloudStatus(d) {
  const installed = loadCloudRegistry().decks[d.id];
  if (CLOUD.busy === d.id) return "正在校验…";
  if (d.minAppVersion > currentAppCode()) return "需新版 App";
  if (!installed) return "OK 安装";
  if (installed.broken) return "OK 修复缓存";
  if (Number(d.version || 0) > Number(installed.version || 0)) return "OK 更新 v" + d.version;
  return deckOn("online_" + d.id) ? "已安装 · 已启用" : "已安装 · 已关闭";
}
function renderCloud() {
  if (CLOUD.phase === "keyboard") { renderCloudKeyboard(); return; }
  $("cloud-status").textContent = CLOUD.message || (CLOUD.catalog.length ? "官方审核目录" : "尚未连接");
  $("cloud-query").style.display = "none"; $("cloud-keyboard").style.display = "none"; $("cloud-list").style.display = "flex";
  const list = cloudFiltered(), total = list.length + 1; if (CLOUD.row >= total) CLOUD.row = Math.max(0, total - 1);
  const search = $("cloud-search"); search.className = "rowitem cloud-search" + (CLOUD.row === 0 ? " focus" : "");
  search.innerHTML = (window.iconTile ? iconTile("cloud") : '<div class="ic">⌕</div>')
    + '<div class="info"><div class="name">搜索: ' + esc(CLOUD.query || "全部词书") + '</div><div class="desc">OK 打开键盘 · 左右切换分类 · 播放键刷新目录</div></div>'
    + '<div class="val val-blue">' + CLOUD_CATS[CLOUD.cat].name + " · " + list.length + '</div>';
  const box = $("cloud-list"); box.innerHTML = "";
  if (!list.length) { box.innerHTML = '<div class="empty"><div class="e1">☁️</div><div class="e2">没有匹配的词书</div><div class="e3">换一个分类或搜索词试试</div></div>'; requestFocusSync(); return; }
  const selected = Math.max(0, CLOUD.row - 1), win = 6, start = Math.max(0, Math.min(selected - 2, Math.max(0, list.length - win)));
  list.slice(start, start + win).forEach((d, at) => {
    const i = start + at, installed = loadCloudRegistry().decks[d.id], armed = CLOUD.uninstallArm === d.id;
    const el = document.createElement("div"); el.className = "rowitem cloud-row" + (CLOUD.row === i + 1 ? " focus" : ""); el.dataset.cloud = d.id;
    el.innerHTML = (window.iconTile ? iconTile("cloud") : '<div class="ic">' + esc(d.icon) + '</div>')
      + '<div class="info"><div class="name">' + esc(d.name) + (installed ? (' <span class="online-tag">' + (installed.broken ? '需修复' : '已安装') + '</span>') : '') + '</div>'
      + '<div class="desc">' + esc(d.level) + " · " + d.count + " 词 · " + esc(d.tags.join(" / ")) + " · " + esc(d.license) + '</div></div>'
      + '<div class="val' + (armed ? ' val-red' : ' val-blue') + '">' + esc(armed ? "OK 确认卸载" : cloudStatus(d)) + '</div>';
    box.appendChild(el);
  });
  try { const fc = document.querySelector("#cloud .focus"); if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
  requestFocusSync();
}
function renderCloudKeyboard() {
  $("cloud-list").style.display = "none"; $("cloud-query").style.display = "block"; $("cloud-keyboard").style.display = "grid";
  $("cloud-query").textContent = CLOUD.query || "输入英文关键词，例如 travel / exam";
  const box = $("cloud-keyboard"); box.innerHTML = "";
  CLOUD_KEYS.forEach((k, i) => {
    const el = document.createElement("div"); el.className = "sp-key" + (i === CLOUD.keyIdx ? " focus" : "") + (k.length > 1 ? " fn" : "");
    el.textContent = k === "SPACE" ? "空格" : (k === "DEL" ? "删除" : (k === "CLEAR" ? "清空" : (k === "DONE" ? "完成" : k)));
    box.appendChild(el);
  });
  requestFocusSync();
}
function cloudKeyboardFocus() {
  const keys = $("cloud-keyboard").children;
  for (let i = 0; i < keys.length; i++) keys[i].classList.toggle("focus", i === CLOUD.keyIdx);
}
function installCloudDeck(d) {
  if (CLOUD.busy || !d || d.minAppVersion > currentAppCode()) return;
  CLOUD.busy = d.id; CLOUD.uninstallArm = ""; renderCloud();
  let ctrl = null, timer = 0;
  try { ctrl = window.AbortController ? new AbortController() : null; if (ctrl) timer = setTimeout(() => ctrl.abort(), 20000); } catch (e) { }
  fetch(d.url, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined }).then(r => { if (!r.ok) throw new Error("下载失败 " + r.status); return r.text(); }).then(raw => {
    const bytes = utf8Bytes(raw).length; if (bytes > CLOUD_MAX_BYTES || (d.bytes && bytes !== d.bytes)) throw new Error("词书大小校验失败");
    const rows = parseDeckRows(raw, true); if (rows.length !== d.count) throw new Error("词条数量与目录不一致");
    return sha256Hex(raw).then(hash => { if (hash !== d.sha256) throw new Error("安全校验失败,未安装"); return { raw: raw, hash: hash }; });
  }).then(pkg => {
    const key = "deckpkg_" + d.id + "_v" + d.version;
    NativeBridge.save(key, pkg.raw);
    const check = NativeBridge.load(key); parseDeckRows(check, true);
    return sha256Hex(check).then(hash => { if (hash !== d.sha256) throw new Error("本机写入复验失败"); return key; });
  }).then(key => {
    const reg = loadCloudRegistry(), previous = reg.decks[d.id];
    reg.decks[d.id] = Object.assign({}, d, { storageKey: key, installedAt: NOW() });
    if (!saveCloudRegistry()) { if (previous) reg.decks[d.id] = previous; else delete reg.decks[d.id]; throw new Error("本机词书索引写入失败"); }
    delete P.decksOff["online_" + d.id]; saveP(); loadDecks();
    CLOUD.busy = ""; CLOUD.message = "安装完成 · 已离线缓存"; renderCloud(); toast(d.name + " 已安装并为当前用户启用");
  }).catch(e => { CLOUD.busy = ""; CLOUD.message = "安装未完成 · 原有词书未受影响"; renderCloud(); toast("安装失败: " + (e && e.message ? e.message : e)); }).then(() => clearTimeout(timer));
}
function uninstallCloudDeck(id) {
  const reg = loadCloudRegistry(); const d = reg.decks[id]; if (!d) return;
  delete reg.decks[id];
  if (!saveCloudRegistry()) { reg.decks[id] = d; toast("卸载未完成,原词书仍保留"); return; }
  CLOUD.uninstallArm = ""; loadDecks(); renderCloud(); toast((d.name || id) + " 已卸载,学习进度仍保留");
}
function cloudSelected() { const list = cloudFiltered(); return CLOUD.row > 0 ? list[CLOUD.row - 1] : null; }
handlers.cloud = {
  enter() { loadCachedCatalog(); renderCloud(); if (!CLOUD.refreshed) refreshCloudCatalog(false); },
  key(k) {
    if (CLOUD.busy) { if (k === "BACK") toast("正在安全写入词书,请稍等"); return; }
    if (CLOUD.phase === "keyboard") {
      if (k === "BACK") { CLOUD.phase = "list"; CLOUD.row = 0; renderCloud(); return; }
      if (["UP", "DOWN", "LEFT", "RIGHT"].includes(k)) { CLOUD.keyIdx = gridMoveIndex(CLOUD.keyIdx, k, CLOUD_KEYS.length, 7); cloudKeyboardFocus(); return; }
      if (k === "OK") {
        const key = CLOUD_KEYS[CLOUD.keyIdx];
        if (key === "DONE") { CLOUD.phase = "list"; CLOUD.row = 0; renderCloud(); return; }
        if (key === "DEL") CLOUD.query = CLOUD.query.slice(0, -1);
        else if (key === "CLEAR") CLOUD.query = "";
        else if (key === "SPACE") { if (CLOUD.query.length < 24 && CLOUD.query && !CLOUD.query.endsWith(" ")) CLOUD.query += " "; }
        else if (CLOUD.query.length < 24) CLOUD.query += key;
        renderCloudKeyboard();
      }
      return;
    }
    const list = cloudFiltered(), total = list.length + 1;
    if (k === "BACK") { CLOUD.uninstallArm = ""; show("home"); return; }
    if (k === "PLAY") { CLOUD.refreshed = false; refreshCloudCatalog(true); return; }
    if (k === "UP") { CLOUD.row = (CLOUD.row + total - 1) % total; CLOUD.uninstallArm = ""; renderCloud(); return; }
    if (k === "DOWN") { CLOUD.row = (CLOUD.row + 1) % total; CLOUD.uninstallArm = ""; renderCloud(); return; }
    if ((k === "LEFT" || k === "RIGHT") && CLOUD.row === 0) { CLOUD.cat = (CLOUD.cat + (k === "RIGHT" ? 1 : CLOUD_CATS.length - 1)) % CLOUD_CATS.length; CLOUD.row = 0; CLOUD.uninstallArm = ""; renderCloud(); return; }
    const d = cloudSelected();
    if (k === "MENU" && d && loadCloudRegistry().decks[d.id]) { CLOUD.uninstallArm = CLOUD.uninstallArm === d.id ? "" : d.id; renderCloud(); return; }
    if (k === "OK") {
      if (CLOUD.row === 0) { CLOUD.phase = "keyboard"; CLOUD.keyIdx = 0; renderCloudKeyboard(); return; }
      if (!d) return;
      if (CLOUD.uninstallArm === d.id) { uninstallCloudDeck(d.id); return; }
      const installed = loadCloudRegistry().decks[d.id];
      if (d.minAppVersion > currentAppCode()) { toast("请先升级 App 再安装这本词书"); return; }
      if (!installed || installed.broken || Number(d.version) > Number(installed.version || 0)) { installCloudDeck(d); return; }
      const deckId = "online_" + d.id; if (deckOn(deckId)) P.decksOff[deckId] = 1; else delete P.decksOff[deckId]; saveP(); renderCloud();
    }
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
    const gameSessions = GAME_MENU.reduce((n, it) => n + (((P.game || {})[it.id] || {}).sessions || 0), 0);
    const weakN = Math.min(15, weakWords().length);
    $("st-total").textContent = "词库总量 " + total + " 词";
    $("st-grid").innerHTML =
      '<div class="scard"><div class="n">' + learned + '</div><div class="l">已学单词</div></div>'
      + '<div class="scard"><div class="n">' + mastered + '</div><div class="l">已掌握(≥21天)</div></div>'
      + '<div class="scard"><div class="n">' + todayN + '</div><div class="l">今日学习次数</div></div>'
      + '<div class="scard"><div class="n nflame">' + (window.glyph ? glyph("flame") : "") + P.streak + '</div><div class="l">连续天数 · Lv.' + level() + '</div></div>'
      + '<div class="scard"><div class="n">' + gameSessions + '</div><div class="l">训练馆局数</div></div>'
      + '<div class="scard"><div class="n">' + weakN + '</div><div class="l">弱项突围池</div></div>';
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
  { id: "gameSrc", name: "训练词源", desc: "训练馆游戏使用哪些单词(默认今天学的)", opts: ["today", "yesterday", "3d", "7d", "all"], fmt: v => gameSrcName(v || "today") },
  { id: "eye", name: "护眼模式", desc: "暖灰低蓝光配色,降低大屏亮度刺激", opts: [1, 0], fmt: v => v ? "开启" : "关闭" },
  { id: "rate", name: "语速", desc: "朗读速度", opts: [0.7, 0.9, 1.0, 1.2], fmt: v => v + "×" },
  { id: "store", name: "软件商城", desc: "为电视一键下载安装实用第三方 App", opts: null, fmt: () => "OK 打开" },
  { id: "update", name: "检查更新", desc: "在线检查新版本并一键下载安装,进度保留", opts: null, fmt: () => "OK 检查" },
  { id: "reset", name: "重置全部进度", desc: "清空学习记录,不可恢复", opts: null, fmt: () => "OK 按两次" }
];
let resetArm = false;
const SET_ICON = { newPerDay: "🎯", tts: "🔊", auto: "▶️", gameSrc: "🗂", eye: "◐", store: "📦", rate: "⏩", update: "🔄", reset: "🗑️" };
handlers.settings = {
  enter() {
    const box = $("set-list"); box.innerHTML = "";
    SETTINGS.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "rowitem" + (i === setIdx ? " focus" : "");
      const isBool = s.opts && s.opts.length === 2 && s.opts[0] === 1 && s.opts[1] === 0;
      let val, cls = "val";
      if (isBool) val = '<span class="ios-sw' + (P.set[s.id] ? " on" : "") + '"></span>';
      else if (!s.opts && s.id === "reset") { val = resetArm && i === setIdx ? "再按一次确认" : s.fmt(); cls = "val val-red"; }
      else if (!s.opts) { val = s.fmt(); cls = "val val-blue"; }
      else val = s.fmt(P.set[s.id]);
      el.innerHTML = (window.iconTile ? iconTile(s.id) : '<div class="ic">' + (SET_ICON[s.id] || "•") + '</div>')
        + '<div class="info"><div class="name">' + s.name + '</div><div class="desc">' + s.desc + '</div></div>'
        + '<div class="' + cls + '">' + val + '</div>';
      box.appendChild(el);
    });
    try { const fc = box.querySelector(".focus"); if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
  },
  key(k) {
    if (k === "BACK") { resetArm = false; show("home"); return; }
    const s = SETTINGS[setIdx];
    if (k === "UP") {
      const wasArmed = resetArm; setIdx = (setIdx + SETTINGS.length - 1) % SETTINGS.length; resetArm = false;
      if (wasArmed) handlers.settings.enter(); else settingsFocus(); return;
    }
    else if (k === "DOWN") {
      const wasArmed = resetArm; setIdx = (setIdx + 1) % SETTINGS.length; resetArm = false;
      if (wasArmed) handlers.settings.enter(); else settingsFocus(); return;
    }
    else if ((k === "LEFT" || k === "RIGHT") && s.opts) {
      const cur = s.opts.indexOf(P.set[s.id]);
      const nx = (cur + (k === "RIGHT" ? 1 : s.opts.length - 1)) % s.opts.length;
      P.set[s.id] = s.opts[nx]; if (s.id === "eye") applyVisualPrefs(); saveP();
    } else if (k === "OK") {
      if (s.id === "store") { storeIdx = 0; show("store"); return; }
      else if (s.id === "update") { checkUpdate(); return; }
      else if (s.id === "reset") {
        if (!resetArm) { resetArm = true; }
        else { P = JSON.parse(JSON.stringify(DEFAULTS)); applyVisualPrefs(); saveP(); resetArm = false; toast("已重置全部进度"); }
      } else if (s.opts) {
        const cur = s.opts.indexOf(P.set[s.id]);
        P.set[s.id] = s.opts[(cur + 1) % s.opts.length]; if (s.id === "eye") applyVisualPrefs(); saveP();
        if (s.id === "tts" || s.id === "rate") speak("Welcome to Lex TV");
      }
    }
    handlers.settings.enter();
  }
};
function deckFocus() {
  const rows = $("deck-list").children;
  for (let i = 0; i < rows.length; i++) rows[i].classList.toggle("focus", i === deckIdx);
}
function settingsFocus() {
  const rows = $("set-list").children;
  for (let i = 0; i < rows.length; i++) rows[i].classList.toggle("focus", i === setIdx);
}

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
  $("sc-title").textContent = "界面对照教学";
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
  requestFocusSync();
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
  if (P.set.auto && items[SC.wi]) {
    const gi = SC.gi, wi = SC.wi, word = items[SC.wi][0];
    setTimeout(() => { if (SCREEN === "screens" && SC.view === "words" && SC.gi === gi && SC.wi === wi) speak(word); }, 200);
  }
  requestFocusSync();
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

/* ================= 软件商城:一键为电视下载安装第三方 App =================
   复用与"检查更新"完全相同的原生下载安装通道(downloadAndInstall + ai-pop 进度弹层)。
   每个 App 的下载地址均指向其开源项目官方 GitHub 发布页,与本软件的自更新同源同信任级别。 */
const STORE_APPS = [
  {
    id: "clashmeta",
    name: "Clash Meta for Android",
    ver: "v2.11.32",
    size: "通用版 · 含全部芯片架构",
    desc: "开源规则代理工具(Mihomo 内核)· MetaCubeX 官方 GitHub 发布",
    url: "https://github.com/MetaCubeX/ClashMetaForAndroid/releases/download/v2.11.32/cmfa-2.11.32-meta-universal-release.apk"
  }
];
let storeIdx = 0;
function storeFocus() {
  const rows = $("store-list").children;
  for (let i = 0; i < rows.length; i++) rows[i].classList.toggle("focus", i === storeIdx);
}

/* ================= AI 助手(grok · 独立通道,不影响 AI 外教) ================= */
const AX_PROMPTS = [
  "考我 5 个今天学的单词,给中英文",
  "用最简单的英语讲个笑话,后面附中文",
  "根据我的进度,今天该重点复习什么?",
  "把我今天学的几个单词编成 3 句英文小故事,附中文翻译",
  "陪我用简单英语聊两句,先问我一个问题"
];
const AX = { i: 0, msgs: [], busy: false, last: "" };
let AXn = 0;
function aiCallX(messages, cb) {
  const id = "x" + (++AXn); AIcb[id] = cb;
  const payload = JSON.stringify({ model: "grok-4.5", messages: messages, temperature: 0.7, max_tokens: 800 });
  try { NativeBridge.aiChatX(payload, id); }
  catch (e) { delete AIcb[id]; cb(null, "此版本 App 不支持 AI 助手,请更新后再试"); return; }
  setTimeout(() => { if (AIcb[id]) { delete AIcb[id]; cb(null, "请求超时,检查电视网络"); } }, 46000);
}
function axActs() {
  const acts = [];
  if (hasVoice) acts.push({ t: "voice", l: "🎤 语音提问" });
  AX_PROMPTS.forEach((p, i) => acts.push({ t: "prompt", l: p, i: i }));
  if (AX.last) acts.push({ t: "speak", l: "🔊 朗读回复" });
  acts.push({ t: "clear", l: "🧹 清空" });
  return acts;
}
function axRender() {
  const box = $("ax-acts"); if (!box) return; box.innerHTML = "";
  axActs().forEach((a, i) => {
    const el = document.createElement("div");
    el.className = "ax-chip" + (a.t === "voice" ? " voice" : "") + (i === AX.i ? " focus" : "");
    el.textContent = a.l; box.appendChild(el);
  });
}
function axFocus() {
  const rows = $("ax-acts").children;
  for (let i = 0; i < rows.length; i++) rows[i].classList.toggle("focus", i === AX.i);
}
function axSend(text) {
  AX.msgs.push({ role: "user", content: text });
  $("ax-user").innerHTML = "<b>你:</b> " + esc(text);
  $("ax-reply").textContent = "思考中…";
  AX.busy = true; $("ax-status").textContent = "grok 思考中…";
  if (AX.msgs.length > 13) AX.msgs = [AX.msgs[0]].concat(AX.msgs.slice(-10));
  aiCallX(AX.msgs, (content, err) => {
    AX.busy = false; $("ax-status").textContent = "grok · 快捷提问或语音";
    if (!content) {
      $("ax-reply").textContent = "✗ " + (err || "失败") + "\n\n(若提示 Invalid token / 401,说明这把 API key 需要更换)";
      AX.i = 0; axRender(); return;
    }
    AX.msgs.push({ role: "assistant", content: content });
    AX.last = content; $("ax-reply").textContent = content;
    AX.i = 0; axRender();
  });
}
handlers.assistant = {
  enter() {
    if (!AX.msgs.length) AX.msgs = [{ role: "system", content: "你是电视大屏上的英语学习助手,服务中国家庭。回答简洁、口语化、适合大屏阅读;涉及英文单词或句子时,英文后面紧跟中文解释。" + (typeof aiProfile === "function" ? aiProfile() : "") }];
    AX.i = 0; axRender();
  },
  key(k) {
    if (AX.busy) { if (k === "BACK") show("home"); return; }
    if (VC.on) { if (VC.rec && k === "OK") stopVoice(); else if (k === "BACK") { cancelVoice(); $("ax-fb").textContent = ""; } return; }
    if (k === "BACK") { show("home"); return; }
    const acts = axActs(), n = acts.length;
    if (k === "LEFT" || k === "UP") { AX.i = (AX.i + n - 1) % n; axFocus(); }
    else if (k === "RIGHT" || k === "DOWN") { AX.i = (AX.i + 1) % n; axFocus(); }
    else if (k === "OK") {
      const a = acts[AX.i]; if (!a) return;
      if (a.t === "voice") startVoice("cn");
      else if (a.t === "speak") { if (AX.last) speak(AX.last); }
      else if (a.t === "clear") { AX.msgs = AX.msgs.slice(0, 1); AX.last = ""; $("ax-user").textContent = ""; $("ax-reply").textContent = "已清空。选一个快捷提问,或语音提问。"; AX.i = 0; axRender(); }
      else if (a.t === "prompt") axSend(AX_PROMPTS[a.i]);
    }
  }
};
handlers.store = {
  enter() {
    if (storeIdx >= STORE_APPS.length) storeIdx = 0;
    const box = $("store-list"); box.innerHTML = "";
    STORE_APPS.forEach((a, i) => {
      const el = document.createElement("div");
      el.className = "rowitem" + (i === storeIdx ? " focus" : "");
      el.innerHTML = (window.iconTile ? iconTile("store") : '<div class="ic">📦</div>')
        + '<div class="info"><div class="name">' + esc(a.name) + ' <span style="color:var(--dim);font-size:2vmin;font-weight:500">' + esc(a.ver) + '</span></div>'
        + '<div class="desc">' + esc(a.desc) + ' · ' + esc(a.size) + '</div></div>'
        + '<div class="val val-blue">OK 安装</div>';
      box.appendChild(el);
    });
    storeFocus();
  },
  key(k) {
    if (UP.active) {
      if (UP.phase === "found") { if (k === "OK") { startUpdateDownload(); return; } if (k === "BACK") { upClose(); return; } return; }
      if (UP.phase === "downloading") return;
      upClose(); return;
    }
    if (k === "BACK") { show("settings"); return; }
    if (k === "UP") { storeIdx = (storeIdx + STORE_APPS.length - 1) % STORE_APPS.length; storeFocus(); return; }
    if (k === "DOWN") { storeIdx = (storeIdx + 1) % STORE_APPS.length; storeFocus(); return; }
    if (k === "OK") {
      const a = STORE_APPS[storeIdx]; if (!a) return;
      UP.phase = "found"; UP.url = a.url;
      upBox('<div style="font-size:2.7vmin;line-height:1.7">下载并安装 <b style="color:var(--gold)">' + esc(a.name) + '</b> ' + esc(a.ver) + '?'
        + '<br><span style="color:var(--dim);font-size:2.3vmin">' + esc(a.size) + ' · 来自官方 GitHub 发布</span>'
        + '<br><br><b style="color:var(--good)">按 OK 开始下载</b>　·　按返回取消'
        + '<br><span style="color:var(--dim);font-size:2.15vmin">下载完成后电视会弹出安装界面;首次需在系统里允许本应用「安装未知应用」</span></div>');
    }
  }
};

/* ================= 家庭空间:新增 / 切换 / 安全归档 ================= */
const WHO_TEMPLATES = [
  { id: "all", name: "全能空间", desc: "全部词书与全部功能 · 适合通用学习", icon: "✨" },
  { id: "teen", name: "考试冲刺", desc: "中考/高考词库优先 · 全部训练功能", icon: "🎒" },
  { id: "fin", name: "金融英语", desc: "新闻/科技/银行词库优先 · 全部训练功能", icon: "💼" }
];
const WHO = { idx: 0, phase: "list", templateIdx: 0, archivedIdx: 0, archiveArm: "", learned: {} };
function refreshWhoLearned() {
  const counts = {};
  activeProfileMeta().forEach(m => {
    if (m.id === CUR && P && P.words) { counts[m.id] = Object.values(P.words).filter(r => r && r.st > 0).length; return; }
    try { const s = NativeBridge.load(m.store), p = s ? JSON.parse(s) : null; counts[m.id] = p ? Object.values(p.words || {}).filter(r => r && r.st > 0).length : 0; }
    catch (e) { counts[m.id] = 0; }
  });
  WHO.learned = counts;
}
function whoProfileDesc(m) {
  const t = PROFILE_TEMPLATES[m.template] || PROFILE_TEMPLATES.all;
  const learned = Object.prototype.hasOwnProperty.call(WHO.learned, m.id) ? WHO.learned[m.id] : 0;
  return t.label + " · 已学 " + learned + " 词 · 进度完全独立";
}
function whoSetFocus(index) {
  const rows = $("who-list").children;
  for (let i = 0; i < rows.length; i++) rows[i].classList.toggle("focus", i === index);
  try { if (rows[index] && rows[index].scrollIntoView) rows[index].scrollIntoView({ block: "nearest" }); } catch (e) { }
}
function whoListItems() {
  const items = activeProfileMeta().map(m => ({ type: "profile", meta: m }));
  items.push({ type: "add" });
  const archived = PROFILE_META.filter(m => !m.builtin && m.archived);
  if (archived.length) items.push({ type: "archived", count: archived.length });
  return items;
}
function newProfileId() {
  let id;
  do { id = "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); } while (PROFILES[id]);
  return id;
}
function createFamilyProfile(template) {
  const n = PROFILE_META.filter(m => !m.builtin).length + 1;
  const id = newProfileId(), t = PROFILE_TEMPLATES[template] ? template : "all";
  const icon = t === "teen" ? "🎒" : (t === "fin" ? "💼" : "👤");
  const meta = safeProfileMeta({ id: id, name: "家人 " + n, short: "家人" + n, icon: icon, template: t });
  PROFILE_META.push(meta); registerProfile(meta); saveApp();
  WHO.phase = "list"; WHO.archiveArm = "";
  switchProfile(id);
}
function archiveFamilyProfile(id) {
  const m = PROFILE_META.find(x => x.id === id && !x.builtin); if (!m) return;
  flushP(); m.archived = true; rebuildProfiles(PROFILE_META.filter(x => !x.builtin));
  if (CUR === id) { CUR = "fin"; WORDS = {}; DECKS = []; loadP(); loadDecks(); }
  saveApp(); WHO.idx = 0; WHO.archiveArm = ""; toast("已归档 " + m.name + ",进度仍完整保留");
}
function restoreFamilyProfile(id) {
  const customs = PROFILE_META.filter(x => !x.builtin).map(x => Object.assign({}, x, x.id === id ? { archived: false } : {}));
  rebuildProfiles(customs); saveApp(); WHO.phase = "list"; WHO.idx = Math.max(0, activeProfileMeta().findIndex(m => m.id === id));
  toast("空间已恢复"); handlers.who.enter();
}
function renderWhoList() {
  const items = whoListItems(); if (WHO.idx >= items.length) WHO.idx = Math.max(0, items.length - 1);
  $("who-title").textContent = "家庭空间";
  $("who-hint").textContent = "方向键选择 · OK 切换/新增 · 菜单键归档";
  const box = $("who-list"); box.innerHTML = "";
  items.forEach((it, i) => {
    const el = document.createElement("div"); el.className = "rowitem family-row" + (i === WHO.idx ? " focus" : "");
    if (it.type === "profile") {
      const m = it.meta, p = PROFILES[m.id], armed = WHO.archiveArm === m.id;
      el.innerHTML = (window.avatar ? window.avatar(m.id) : '<div class="ic">' + p.icon + '</div>')
        + '<div class="info"><div class="name">' + esc(m.name) + (m.id === CUR ? ' <span class="current-dot">● 当前</span>' : '') + '</div>'
        + '<div class="desc">' + esc(armed ? "再按 OK 归档；学习记录不会删除" : whoProfileDesc(m)) + '</div></div>'
        + '<div class="val' + (armed ? ' val-red' : '') + '">' + (armed ? "OK 确认归档" : (m.id === CUR ? "使用中" : "OK 切换")) + '</div>';
    } else if (it.type === "add") {
      el.innerHTML = (window.iconTile ? iconTile("who") : '<div class="ic">＋</div>')
        + '<div class="info"><div class="name">＋ 新增使用者</div><div class="desc">建立全新的词书开关、FSRS 记录、游戏成绩与设置</div></div><div class="val val-blue">OK 新建</div>';
    } else {
      el.innerHTML = (window.iconTile ? iconTile("restore") : '<div class="ic">↻</div>')
        + '<div class="info"><div class="name">已归档空间</div><div class="desc">恢复以前的使用者与全部学习记录</div></div><div class="val">' + it.count + " 个" + '</div>';
    }
    box.appendChild(el);
  });
  try { const fc = box.querySelector(".focus"); if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
  requestFocusSync();
}
function renderWhoTemplates() {
  $("who-title").textContent = "选择学习模板"; $("who-hint").textContent = "模板只决定默认词书范围；新空间拥有全部功能";
  const box = $("who-list"); box.innerHTML = "";
  WHO_TEMPLATES.forEach((t, i) => {
    const el = document.createElement("div"); el.className = "rowitem family-row" + (i === WHO.templateIdx ? " focus" : "");
    el.innerHTML = (window.iconTile ? iconTile(t.id === "all" ? "who" : (t.id === "teen" ? "spell" : "stats")) : '<div class="ic">' + t.icon + '</div>')
      + '<div class="info"><div class="name">' + t.name + '</div><div class="desc">' + t.desc + '</div></div><div class="val val-blue">OK 创建</div>';
    box.appendChild(el);
  });
  requestFocusSync();
}
function renderWhoArchived() {
  const list = PROFILE_META.filter(m => !m.builtin && m.archived); if (WHO.archivedIdx >= list.length) WHO.archivedIdx = 0;
  $("who-title").textContent = "恢复归档空间"; $("who-hint").textContent = "OK 恢复 · 返回上一级";
  const box = $("who-list"); box.innerHTML = "";
  list.forEach((m, i) => {
    const el = document.createElement("div"); el.className = "rowitem family-row" + (i === WHO.archivedIdx ? " focus" : "");
    el.innerHTML = (window.avatar ? window.avatar(m.id) : '<div class="ic">' + m.icon + '</div>')
      + '<div class="info"><div class="name">' + esc(m.name) + '</div><div class="desc">' + esc((PROFILE_TEMPLATES[m.template] || PROFILE_TEMPLATES.all).label) + ' · 进度保留</div></div><div class="val val-blue">OK 恢复</div>';
    box.appendChild(el);
  });
  requestFocusSync();
}
handlers.who = {
  enter() {
    if (WHO.phase === "template") renderWhoTemplates();
    else if (WHO.phase === "archived") renderWhoArchived();
    else { refreshWhoLearned(); renderWhoList(); }
  },
  key(k) {
    if (WHO.phase === "template") {
      if (k === "BACK") { WHO.phase = "list"; handlers.who.enter(); return; }
      if (["UP", "LEFT"].includes(k)) { WHO.templateIdx = (WHO.templateIdx + WHO_TEMPLATES.length - 1) % WHO_TEMPLATES.length; whoSetFocus(WHO.templateIdx); return; }
      else if (["DOWN", "RIGHT"].includes(k)) { WHO.templateIdx = (WHO.templateIdx + 1) % WHO_TEMPLATES.length; whoSetFocus(WHO.templateIdx); return; }
      else if (k === "OK") { createFamilyProfile(WHO_TEMPLATES[WHO.templateIdx].id); return; }
      return;
    }
    if (WHO.phase === "archived") {
      const list = PROFILE_META.filter(m => !m.builtin && m.archived);
      if (k === "BACK") { WHO.phase = "list"; handlers.who.enter(); return; }
      if (!list.length) { WHO.phase = "list"; handlers.who.enter(); return; }
      if (["UP", "LEFT"].includes(k)) { WHO.archivedIdx = (WHO.archivedIdx + list.length - 1) % list.length; whoSetFocus(WHO.archivedIdx); return; }
      else if (["DOWN", "RIGHT"].includes(k)) { WHO.archivedIdx = (WHO.archivedIdx + 1) % list.length; whoSetFocus(WHO.archivedIdx); return; }
      else if (k === "OK") { restoreFamilyProfile(list[WHO.archivedIdx].id); return; }
      return;
    }
    const items = whoListItems();
    if (k === "BACK") { WHO.archiveArm = ""; show("home"); return; }
    if (["UP", "LEFT"].includes(k)) { const armed = !!WHO.archiveArm; WHO.idx = (WHO.idx + items.length - 1) % items.length; WHO.archiveArm = ""; if (armed) renderWhoList(); else whoSetFocus(WHO.idx); return; }
    else if (["DOWN", "RIGHT"].includes(k)) { const armed = !!WHO.archiveArm; WHO.idx = (WHO.idx + 1) % items.length; WHO.archiveArm = ""; if (armed) renderWhoList(); else whoSetFocus(WHO.idx); return; }
    else if (k === "MENU") {
      const it = items[WHO.idx];
      if (it && it.type === "profile" && !it.meta.builtin) WHO.archiveArm = WHO.archiveArm === it.meta.id ? "" : it.meta.id;
      else toast("内置的爸爸/弟弟空间会永久保留");
    } else if (k === "OK") {
      const it = items[WHO.idx]; if (!it) return;
      if (it.type === "add") { WHO.phase = "template"; WHO.templateIdx = 0; handlers.who.enter(); return; }
      if (it.type === "archived") { WHO.phase = "archived"; WHO.archivedIdx = 0; handlers.who.enter(); return; }
      if (WHO.archiveArm === it.meta.id) { archiveFamilyProfile(it.meta.id); handlers.who.enter(); return; }
      switchProfile(it.meta.id); return;
    }
    renderWhoList();
  }
};

/* ================= 拼写挑战(听音看义,遥控器拼单词) ================= */
const SPL = { list: [], i: 0, ans: "", input: [], ki: 0, score: 0, xpEarned: 0, combo: 0, best: 0, right: 0, lock: false, hints: 0, errors: 0, phase: "build", nextAfter: 0, carryOkUntil: 0, wrongAfter: 0, wrongKey: "", flashSeq: 0, run: 0 };
const SPL_KEYS = "abcdefghijklmnopqrstuvwxyz".split("").concat(["DEL", "HINT"]);
function startSpell() {
  SPL.run++;
  const pool = gameWords().filter(e => /^[a-zA-Z]{3,12}$/.test(e.w));
  if (pool.length < 8) { toast("先学至少 8 个可拼写的单词(纯字母)再来挑战"); return; }
  SPL.list = shuffle(pool.slice()).slice(0, 10);
  SPL.i = 0; SPL.score = 0; SPL.xpEarned = 0; SPL.combo = 0; SPL.best = 0; SPL.right = 0;
  SPL.carryOkUntil = NOW() + 240;
  show("spell"); renderSpell();
}
function renderSpell() {
  const e = SPL.list[SPL.i];
  SPL.ans = e.w.toLowerCase();
  SPL.input = [SPL.ans[0]];      // 首字母默认给出,降低遥控器输入负担
  SPL.ki = 0; SPL.lock = false; SPL.hints = 0; SPL.errors = 0; SPL.phase = "build"; SPL.nextAfter = 0; SPL.wrongAfter = 0; SPL.wrongKey = ""; SPL.flashSeq++;
  $("sp-prog").textContent = (SPL.i + 1) + " / " + SPL.list.length;
  $("sp-score").textContent = SPL.score + " 分";
  $("sp-combo").textContent = SPL.combo > 1 ? "⚡连击 ×" + SPL.combo : "";
  $("sp-mean").textContent = e.m;
  $("sp-phon").textContent = e.p ? "/" + e.p + "/" : "";
  $("sp-fb").textContent = "";
  drawSpell();
  speak(e.w);
  requestFocusSync();
}
function drawSpell() {
  drawSpellInput();
  const kb = $("sp-kb"); kb.innerHTML = "";
  SPL_KEYS.forEach((kk, i) => {
    const d = document.createElement("div");
    d.className = "sp-key" + (i === SPL.ki ? " focus" : "") + (kk.length > 1 ? " fn" : "");
    d.textContent = kk === "DEL" ? "⌫ 删除" : (kk === "HINT" ? "提示" : kk);
    kb.appendChild(d);
  });
}
function drawSpellInput() {
  const box = $("sp-boxes"); box.innerHTML = "";
  for (let i = 0; i < SPL.ans.length; i++) {
    const d = document.createElement("div");
    d.className = "sp-box" + (i === 0 ? " lockc" : "") + (i === SPL.input.length ? " cur" : "");
    d.textContent = SPL.input[i] || "";
    box.appendChild(d);
  }
}
function spellFocus() {
  const keys = $("sp-kb").children;
  for (let i = 0; i < keys.length; i++) keys[i].classList.toggle("focus", i === SPL.ki);
}
function spellWrong(letter) {
  const now = NOW();
  if (letter === SPL.wrongKey && now < SPL.wrongAfter) { SPL.wrongAfter = now + 190; return; }
  SPL.wrongKey = letter; SPL.wrongAfter = now + 220;
  SPL.errors++; SPL.combo = 0;
  const seq = ++SPL.flashSeq, pos = SPL.input.length;
  drawSpellInput();
  const cells = $("sp-boxes").children;
  if (cells[pos]) { cells[pos].textContent = letter; cells[pos].classList.remove("cur"); cells[pos].classList.add("bad", "wrong-pick"); }
  $("sp-fb").textContent = "✗ 这个字母不对,换一个再试";
  try { if (window.SFX) SFX.bad(); } catch (e) { }
  setTimeout(() => { if (SCREEN === "spell" && SPL.phase === "build" && seq === SPL.flashSeq) { drawSpellInput(); $("sp-fb").textContent = "继续拼写 · 错误会立即提示"; } }, 360);
}
function spellJudge() {
  SPL.lock = true;
  const e = SPL.list[SPL.i];
  const got = SPL.input.join("");
  const complete = got === SPL.ans;
  const perfect = complete && SPL.errors === 0 && SPL.hints === 0;
  const box = $("sp-boxes"); box.innerHTML = "";
  for (let i = 0; i < SPL.ans.length; i++) {
    const d = document.createElement("div");
    d.className = "sp-box " + (got[i] === SPL.ans[i] ? "good" : "bad");
    d.textContent = SPL.ans[i];
    box.appendChild(d);
  }
  $("sp-kb").innerHTML = '<div class="sp-key fn spell-next focus">下一题　→</div>';
  try { if (window.SFX) SFX.good(); } catch (e2) { }
  if (perfect) {
    SPL.combo++; SPL.best = Math.max(SPL.best, SPL.combo); SPL.right++;
    const gain = Math.max(4, 12 + Math.min(8, SPL.combo * 2) - SPL.hints * 2);
    SPL.score += gain; SPL.xpEarned += 5; P.xp += 5;
    $("sp-fb").textContent = "✓ 一次拼对 · +" + gain + " 分 · 按 OK 下一题";
  } else {
    SPL.combo = 0;
    const gain = Math.max(2, 7 - SPL.errors - SPL.hints); SPL.score += gain; SPL.xpEarned += 2; P.xp += 2;
    $("sp-fb").textContent = "✓ 已完成 · 本题修正 " + (SPL.errors + SPL.hints) + " 次 · 按 OK 下一题";
  }
  $("sp-mean").textContent = e.w + " · " + e.m;
  $("sp-phon").textContent = e.p ? "/" + e.p + "/ · 完整拼写回顾" : "完整拼写回顾";
  SPL.phase = "review"; SPL.nextAfter = NOW() + 580;
  requestAnimationFrame(syncFocusFx);
  schedHit(e.w, perfect);
  const run = SPL.run, idx = SPL.i;
  setTimeout(() => { if (SCREEN === "spell" && SPL.run === run && SPL.i === idx && SPL.phase === "review") speak(e.w); }, 260);
}
function nextSpell() {
  SPL.i++;
  if (SPL.i >= SPL.list.length) finishSpell(); else renderSpell();
}
handlers.spell = {
  key(k) {
    if (k === "BACK") { SPL.run++; show(RETURN_SCREEN || "home"); return; }
    if (k === "MENU" || k === "PLAY") { speak(SPL.list[SPL.i].w); return; }
    if (SPL.phase === "review") {
      if (k === "OK") {
        if (NOW() < SPL.nextAfter) { SPL.nextAfter = NOW() + 300; return; }
        SPL.carryOkUntil = NOW() + 240;
        nextSpell();
      }
      return;
    }
    if (SPL.lock) return;
    const n = SPL_KEYS.length;                     // 28 键,7列×4行
    if (k === "UP") { SPL.carryOkUntil = 0; SPL.wrongKey = ""; SPL.ki = (SPL.ki - 7 + n) % n; spellFocus(); return; }
    else if (k === "DOWN") { SPL.carryOkUntil = 0; SPL.wrongKey = ""; SPL.ki = (SPL.ki + 7) % n; spellFocus(); return; }
    else if (k === "LEFT") { SPL.carryOkUntil = 0; SPL.wrongKey = ""; SPL.ki = (SPL.ki + n - 1) % n; spellFocus(); return; }
    else if (k === "RIGHT") { SPL.carryOkUntil = 0; SPL.wrongKey = ""; SPL.ki = (SPL.ki + 1) % n; spellFocus(); return; }
    else if (k === "OK") {
      const now = NOW(); if (now < SPL.carryOkUntil) { SPL.carryOkUntil = now + 200; return; }
      const key = SPL_KEYS[SPL.ki];
      if (key === "DEL") { if (SPL.input.length > 1) SPL.input.pop(); }
      else if (key === "HINT") {
        if (SPL.input.length < SPL.ans.length) { SPL.input.push(SPL.ans[SPL.input.length]); SPL.hints++; }
      } else if (SPL.input.length < SPL.ans.length) {
        if (key !== SPL.ans[SPL.input.length]) { spellWrong(key); return; }
        SPL.input.push(key); SPL.wrongKey = "";
      }
      if (SPL.input.length >= SPL.ans.length) { drawSpellInput(); spellJudge(); return; }
    }
    drawSpellInput();
  }
};
function finishSpell() {
  const acc = SPL.list.length ? Math.round(SPL.right / SPL.list.length * 100) : 100;
  $("f-title").textContent = SPL.right === SPL.list.length ? "全部拼对!" : "拼写完成";
  $("f-xp").textContent = "+" + SPL.xpEarned + " XP · 得分 " + SPL.score;
  $("f-stats").innerHTML = '<div class="stat"><div class="n" style="color:var(--good)">' + SPL.right + '/' + SPL.list.length + '</div><div class="l">无错拼对</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">×' + SPL.best + '</div><div class="l">最高连击</div></div>'
    + '<div class="stat"><div class="n">' + SPL.score + '</div><div class="l">总分</div></div>';
  $("f-msg").textContent = "拼错的词已安排加密复习 · 考试拼写题就这么练出来";
  gameResult("spell", SPL.right, SPL.list.length, SPL.score); show("finish");
}

/* ================= 词块拼装 / 句子拼图 =================
   两种玩法共用一套轻量拼图引擎:前者重建单词字形,后者重建真实例句语序。
   每块都带稳定序号,即使句子里有重复词也不会误判。 */
const PG = { mode: "chunks", list: [], i: 0, pieces: [], chosen: [], answerTokens: [], idx: 0, score: 0, xpEarned: 0, combo: 0, best: 0, right: 0, lock: false, errors: 0, phase: "build", nextAfter: 0, carryOkUntil: 0, wrongAfter: 0, wrongKey: -1, trText: "", trPending: false, trOk: false, trDeadline: 0, seq: 0, flashSeq: 0 };
function chunkTokens(w) {
  const s = String(w).toLowerCase();
  const count = s.length <= 6 ? 3 : (s.length <= 10 ? 4 : 5);
  const out = [];
  let at = 0;
  for (let i = 0; i < count && at < s.length; i++) {
    const left = s.length - at, slots = count - i;
    const n = Math.ceil(left / slots);
    out.push(s.slice(at, at + n)); at += n;
  }
  return out;
}
function sentenceTokens(s) {
  // 每个原始空格词块独立清洗:全小写,移除所有标点/符号,不给首尾位置任何视觉暗示。
  return String(s).trim().split(/\s+/).map(t => t.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
}
function puzzleSentenceMeaning(e) {
  if (PG.trOk && PG.trText) return "整句中文: " + PG.trText;
  if (e.tr) return "整句中文: " + e.tr;
  if (P.tr && P.tr[e.w]) return "整句中文: " + P.tr[e.w];
  return "中文意思: 核心词 " + e.w + " = " + e.m + " · 完整句译离线暂不可用";
}
function startChunks() { startPuzzle("chunks"); }
function startSentence() { startPuzzle("sentence"); }
function startPuzzle(mode) {
  let pool;
  if (mode === "chunks") pool = gameWords().filter(e => /^[a-zA-Z]{5,15}$/.test(e.w));
  else {
    const eligible = gameWords().filter(e => e.x && sentenceTokens(e.x).length >= 4 && sentenceTokens(e.x).length <= 10);
    const translated = shuffle(eligible.filter(e => e.tr || (P.tr && P.tr[e.w])));
    // 优先使用自带/已缓存整句中文的题；数量不足时才让 AI 在解题期间补译。
    pool = translated.length >= 6 ? translated : translated.concat(shuffle(eligible.filter(e => !e.tr && !(P.tr && P.tr[e.w]))));
  }
  const minimum = mode === "chunks" ? 8 : 6;
  if (pool.length < minimum) {
    toast(mode === "chunks" ? "先学至少 8 个五字母以上的单词再来拼装" : "先学习一些带例句的单词再来挑战句子拼图");
    return;
  }
  PG.mode = mode; PG.list = (mode === "sentence" ? pool.slice() : shuffle(pool.slice())).slice(0, 10); PG.i = 0;
  PG.score = 0; PG.xpEarned = 0; PG.combo = 0; PG.best = 0; PG.right = 0; PG.seq++;
  PG.carryOkUntil = NOW() + 240;
  show("puzzle"); renderPuzzle();
}
function renderPuzzle() {
  const e = PG.list[PG.i], tokens = PG.mode === "chunks" ? chunkTokens(e.w) : sentenceTokens(e.x);
  PG.answerTokens = tokens.slice();
  PG.pieces = shuffle(tokens.map((txt, order) => ({ txt: txt, order: order, used: false })));
  PG.chosen = []; PG.idx = 0; PG.lock = false; PG.errors = 0; PG.phase = "build"; PG.nextAfter = 0; PG.wrongAfter = 0; PG.wrongKey = -1;
  PG.trText = PG.mode === "sentence" ? (e.tr || (P.tr && P.tr[e.w]) || "") : "";
  PG.trOk = !!PG.trText; PG.trPending = PG.mode === "sentence" && !PG.trText; PG.trDeadline = 0; PG.seq++; PG.flashSeq++;
  $("pz-title").textContent = PG.mode === "chunks" ? "词块拼装" : "句子拼图";
  $("pz-prog").textContent = (PG.i + 1) + " / " + PG.list.length;
  $("pz-score").textContent = PG.score + " 分";
  $("pz-combo").textContent = PG.combo > 1 ? "⚡连击 ×" + PG.combo : "";
  $("pz-clue").textContent = PG.mode === "chunks" ? e.m : (e.tr || (P.tr && P.tr[e.w]) || "整句中文释义加载中…");
  $("pz-target").textContent = PG.mode === "chunks"
    ? ((e.p ? "/" + e.p + "/ · " : "") + e.w.length + " 个字母 · " + tokens.length + " 个词块")
    : ("核心词: " + e.w + " · " + e.m);
  $("pz-fb").textContent = PG.mode === "chunks" ? "按正确顺序选择全部词块 · 选错会立即提示" : "按正确语序选择全部片段 · 已隐藏大小写和标点线索";
  drawPuzzle();
  if (PG.mode === "chunks") speak(e.w);
  else {
    const seq = PG.seq, idx = PG.i;
    resolveSentenceTr(e, (txt, ok) => {
      if (SCREEN !== "puzzle" || PG.seq !== seq || PG.i !== idx) return;
      PG.trText = txt; PG.trOk = !!ok; PG.trPending = false;
      $("pz-clue").textContent = PG.phase === "review" ? puzzleSentenceMeaning(e) : txt;
    });
  }
  requestFocusSync();
}
function puzzleText(tokens) {
  return tokens.join(PG.mode === "chunks" ? "" : " ");
}
function drawPuzzle() {
  const selected = PG.chosen.map(i => PG.pieces[i].txt);
  const build = $("pz-build");
  build.textContent = selected.length ? puzzleText(selected) : (PG.mode === "chunks" ? "选择词块…" : "从第一个片段开始…");
  build.className = "puzzle-build" + (selected.length ? "" : " empty");
  const grid = $("pz-grid"); grid.innerHTML = "";
  PG.pieces.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "piece" + (p.used ? " used" : "") + (PG.idx === i ? " focus" : "");
    d.textContent = p.txt; d.dataset.piece = i; grid.appendChild(d);
  });
  const undo = document.createElement("div");
  undo.className = "piece undo" + (PG.idx === PG.pieces.length ? " focus" : "");
  undo.textContent = "↶ 撤销"; grid.appendChild(undo);
}
function puzzleFocus() {
  const cells = $("pz-grid").children;
  for (let i = 0; i < cells.length; i++) cells[i].classList.toggle("focus", i === PG.idx);
}
function puzzleMove(k) {
  const n = PG.pieces.length + 1, cols = 4;
  PG.carryOkUntil = 0; PG.wrongKey = -1;
  PG.idx = gridMoveIndex(PG.idx, k, n, cols);
  puzzleFocus();
}
function puzzleWrong(i) {
  const now = NOW();
  if (i === PG.wrongKey && now < PG.wrongAfter) { PG.wrongAfter = now + 190; return; }
  PG.wrongKey = i; PG.wrongAfter = now + 220;
  PG.errors++; PG.combo = 0;
  const seq = ++PG.flashSeq, cell = $("pz-grid").children[i], p = PG.pieces[i];
  if (cell) { cell.classList.remove("wrong-pick"); void cell.offsetWidth; cell.classList.add("wrong-pick"); }
  $("pz-build").classList.add("bad");
  $("pz-fb").textContent = "✗ “" + (p ? p.txt : "这个片段") + "” 不能放在这里,换一个再试";
  try { if (window.SFX) SFX.bad(); } catch (e) { }
  setTimeout(() => {
    if (SCREEN !== "puzzle" || PG.phase !== "build" || seq !== PG.flashSeq) return;
    $("pz-build").classList.remove("bad"); if (cell) cell.classList.remove("wrong-pick");
    $("pz-fb").textContent = "继续尝试 · 错误不会被写入答案";
  }, 390);
}
function puzzleChoose() {
  if (PG.idx === PG.pieces.length) {
    const last = PG.chosen.pop();
    if (last !== undefined) PG.pieces[last].used = false;
    PG.flashSeq++; drawPuzzle(); return;
  }
  const p = PG.pieces[PG.idx];
  if (!p || p.used) return;
  const expected = PG.answerTokens[PG.chosen.length];
  if (p.txt !== expected) { puzzleWrong(PG.idx); return; }
  PG.flashSeq++; PG.wrongKey = -1; p.used = true; PG.chosen.push(PG.idx); drawPuzzle();
  if (PG.chosen.length < PG.pieces.length) return;
  PG.lock = true;
  const seq = PG.seq;
  setTimeout(() => { if (SCREEN === "puzzle" && seq === PG.seq) judgePuzzle(); }, 120);
}
function judgePuzzle() {
  const e = PG.list[PG.i];
  const perfect = PG.errors === 0;
  try { if (window.SFX) SFX.good(); } catch (e2) { }
  if (perfect) {
    PG.combo++; PG.best = Math.max(PG.best, PG.combo); PG.right++;
    const gain = 12 + Math.min(10, PG.combo * 2); PG.score += gain; PG.xpEarned += 5; P.xp += 5;
    $("pz-fb").textContent = "✓ 一次完成! +" + gain + " · 按 OK 下一题";
  } else {
    PG.combo = 0;
    const gain = Math.max(3, 8 - PG.errors); PG.score += gain; PG.xpEarned += 2; P.xp += 2;
    $("pz-fb").textContent = "✓ 已完成 · 本题修正 " + PG.errors + " 次 · 按 OK 下一题";
  }
  PG.phase = "review"; PG.lock = true; PG.nextAfter = NOW() + 620;
  if (PG.mode === "sentence" && PG.trPending) PG.trDeadline = NOW() + 900;
  $("pz-build").className = "puzzle-build good review";
  $("pz-build").textContent = PG.mode === "chunks" ? e.w : e.x;
  $("pz-clue").textContent = PG.mode === "chunks" ? e.m : (PG.trPending ? ("正在补齐整句中文… · 核心词: " + e.m) : puzzleSentenceMeaning(e));
  $("pz-target").textContent = PG.mode === "chunks" ? ((e.p ? "/" + e.p + "/ · " : "") + "完整单词回顾") : ("核心词: " + e.w + " · " + e.m + " · 完整句子回顾");
  const grid = $("pz-grid"); grid.innerHTML = '<div class="piece puzzle-next focus">下一题　→</div>';
  requestAnimationFrame(syncFocusFx);
  schedHit(e.w, perfect);
  const seq = PG.seq, idx = PG.i;
  setTimeout(() => { if (SCREEN === "puzzle" && PG.seq === seq && PG.i === idx && PG.phase === "review") speak(PG.mode === "chunks" ? e.w : e.x); }, 280);
}
function nextPuzzle() {
  PG.seq++; PG.i++;
  if (PG.i >= PG.list.length) finishPuzzle(); else renderPuzzle();
}
function finishPuzzle() {
  const acc = Math.round(PG.right / PG.list.length * 100);
  $("f-title").textContent = PG.right === PG.list.length ? "拼图全通!" : (PG.mode === "chunks" ? "词块训练完成" : "语序训练完成");
  $("f-xp").textContent = "+" + PG.xpEarned + " XP · 得分 " + PG.score;
  $("f-stats").innerHTML = '<div class="stat"><div class="n" style="color:var(--good)">' + PG.right + '/' + PG.list.length + '</div><div class="l">无错完成</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">×' + PG.best + '</div><div class="l">最高连击</div></div>'
    + '<div class="stat"><div class="n">' + acc + '%</div><div class="l">正确率</div></div>';
  $("f-msg").textContent = PG.mode === "chunks" ? "从词块到完整单词,拼写记忆会更牢" : "从单词走进句子,才是真正会使用";
  gameResult(PG.mode, PG.right, PG.list.length, PG.score); show("finish");
}
handlers.puzzle = {
  key(k) {
    if (k === "BACK") { PG.seq++; show(RETURN_SCREEN || "home"); return; }
    if (k === "MENU" || k === "PLAY") { const e = PG.list[PG.i]; if (e) speak(PG.mode === "chunks" ? e.w : e.x); return; }
    if (PG.phase === "review") {
      if (k === "OK") {
        if (NOW() < PG.nextAfter) { PG.nextAfter = NOW() + 320; return; }
        if (PG.mode === "sentence" && PG.trPending && NOW() < PG.trDeadline) {
          $("pz-fb").textContent = "正在补齐整句中文,最多再等一瞬 · 稍后按 OK 继续";
          return;
        }
        PG.carryOkUntil = NOW() + 240;
        nextPuzzle();
      }
      return;
    }
    if (PG.lock) return;
    if (k === "OK") { const now = NOW(); if (now < PG.carryOkUntil) { PG.carryOkUntil = now + 200; return; } puzzleChoose(); }
    else if (["UP", "DOWN", "LEFT", "RIGHT"].includes(k)) puzzleMove(k);
  }
};

/* ================= 词汇星舰(双向回忆生存战) ================= */
const SS = { list: [], opts: [], i: 0, sel: 0, ansIdx: 0, dir: "en", hull: 3, score: 0, combo: 0, best: 0, right: 0, wrong: 0, lock: false, timer: null, run: 0 };
const SS_N = 15, SS_TIME = 7500;
function roundList(pool, n) {
  const out = [];
  while (out.length < n) out.push.apply(out, shuffle(pool.slice()));
  return out.slice(0, n);
}
function startStarship() {
  SS.run++;
  const pool = gameWords().filter(e => e.m);
  if (pool.length < 8) { toast("先学至少 8 个单词再驾驶词汇星舰"); return; }
  SS.list = roundList(pool, SS_N); SS.i = 0; SS.hull = 3; SS.score = 0; SS.combo = 0; SS.best = 0; SS.right = 0; SS.wrong = 0;
  show("starship");
  $("ss-burst").innerHTML = "";
  renderStarship();
}
function renderStarship() {
  SS.lock = false; SS.sel = 0;
  const e = SS.list[SS.i];
  SS.dir = (SS.i + dailyIndex()) % 2 ? "zh" : "en";
  const opts = [e], pool = shuffle(activeWords().filter(x => x.w !== e.w && x.m !== e.m));
  for (const x of pool) { if (opts.length >= 4) break; opts.push(x); }
  shuffle(opts); SS.opts = opts; SS.ansIdx = opts.indexOf(e);
  $("ss-prog").textContent = "波次 " + (SS.i + 1) + " / " + SS.list.length;
  $("ss-score").textContent = SS.score + " 分";
  $("ss-combo").textContent = SS.combo > 1 ? "连击 ×" + SS.combo : "";
  $("ss-shield").textContent = "护盾 " + "◆".repeat(SS.hull) + "◇".repeat(3 - SS.hull);
  $("ss-prompt").textContent = SS.dir === "en" ? e.w : e.m;
  $("ss-direction").textContent = SS.dir === "en" ? "EN → 中文 · 锁定译义" : "中文 → EN · 反向回忆";
  $("ss-fb").textContent = SS.dir === "en" ? "选择正确译义,为星舰锁定目标" : "选择正确英文,启动反向识别系统";
  const enemy = $("ss-enemy"), scene = $("ss-scene");
  enemy.classList.remove("hit", "miss"); scene.classList.remove("damage");
  enemy.classList.toggle("long", $("ss-prompt").textContent.length > 18);
  const box = $("ss-opts"); box.innerHTML = "";
  opts.forEach((o, i) => {
    const d = document.createElement("div"); d.className = "opt" + (i === 0 ? " focus" : "");
    const text = SS.dir === "en" ? o.m : o.w;
    d.innerHTML = '<span class="idx">' + (i + 1) + '</span><span' + (SS.dir === "zh" ? ' class="serif" style="font-size:3.3vmin;font-weight:750"' : "") + '>' + esc(text) + '</span>';
    box.appendChild(d);
  });
  if (SS.dir === "en") speak(e.w);
  clearTimeout(SS.timer);
  const run = SS.run;
  SS.timer = timerBar("ss-timer", SS_TIME, () => { if (SCREEN === "starship" && SS.run === run) starshipAnswer(-1); });
  requestFocusSync();
}
function starshipMove(k) {
  SS.sel = gridMoveIndex(SS.sel, k, 4, 2);
  const opts = $("ss-opts").children;
  for (let i = 0; i < opts.length; i++) opts[i].classList.toggle("focus", i === SS.sel);
}
function starBurst(ok) {
  if (focusFxReduced()) return;
  const box = $("ss-burst");
  for (let i = 0; i < (ok ? 12 : 6); i++) {
    const p = document.createElement("i"); p.className = "ss-particle";
    p.style.left = (ok ? 72 + Math.random() * 9 : 16 + Math.random() * 5) + "%";
    p.style.top = (36 + Math.random() * 28) + "%";
    p.style.background = ok ? (i % 2 ? "#9DEBFF" : "#FFD66B") : "#FF6961";
    box.appendChild(p);
    const dx = (Math.random() * 2 - 1) * 18, dy = (Math.random() * 2 - 1) * 16;
    try { p.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: "translate(" + dx + "vmin," + dy + "vmin) scale(.1)", opacity: 0 }], { duration: 520 + Math.random() * 260, easing: "cubic-bezier(.2,.8,.3,1)" }); } catch (x) { }
    setTimeout(() => { try { box.removeChild(p); } catch (x) { } }, 850);
  }
}
function starshipAnswer(idx) {
  if (SS.lock) return;
  SS.lock = true; stopTimerBar(SS.timer, "ss-timer");
  const e = SS.list[SS.i], ok = idx === SS.ansIdx;
  const opts = $("ss-opts").children;
  if (opts[SS.ansIdx]) opts[SS.ansIdx].classList.add("right");
  if (!ok && idx >= 0 && opts[idx]) opts[idx].classList.add("wrong");
  if (ok) {
    SS.combo++; SS.best = Math.max(SS.best, SS.combo); SS.right++;
    const gain = 14 + Math.min(12, SS.combo * 2); SS.score += gain; P.xp += 5;
    if (SS.combo % 5 === 0 && SS.hull < 3) SS.hull++;
    $("ss-fb").textContent = "命中! +" + gain + " · " + e.w + " = " + e.m;
    const laser = $("ss-laser"), enemy = $("ss-enemy");
    laser.classList.remove("fire"); enemy.classList.remove("hit"); void laser.offsetWidth; laser.classList.add("fire"); enemy.classList.add("hit");
    starBurst(true);
    try { if (window.SFX) (SFX.hit ? SFX.hit() : SFX.good()); } catch (x) { }
  } else {
    SS.combo = 0; SS.wrong++; SS.hull = Math.max(0, SS.hull - 1);
    $("ss-fb").textContent = (idx < 0 ? "目标突破防线! " : "锁定错误! ") + e.w + " → " + e.m;
    const scene = $("ss-scene"), enemy = $("ss-enemy");
    scene.classList.remove("damage"); enemy.classList.remove("miss"); void scene.offsetWidth; scene.classList.add("damage"); enemy.classList.add("miss");
    starBurst(false);
    try { if (window.SFX) { SFX.bad(); SFX.danger(); } } catch (x) { }
  }
  $("ss-shield").textContent = "护盾 " + "◆".repeat(SS.hull) + "◇".repeat(3 - SS.hull);
  speak(e.w); schedHit(e.w, ok);
  const run = SS.run;
  setTimeout(() => {
    if (SCREEN !== "starship" || SS.run !== run) return;
    if (SS.hull <= 0) { finishStarship(false); return; }
    SS.i++; if (SS.i >= SS.list.length) finishStarship(true); else renderStarship();
  }, ok ? 720 : 1500);
}
function finishStarship(survived) {
  stopTimerBar(SS.timer, "ss-timer");
  const total = SS.right + SS.wrong, acc = total ? Math.round(SS.right / total * 100) : 0;
  $("f-title").textContent = survived ? "星域清扫完成!" : "护盾耗尽,返航整备";
  $("f-xp").textContent = "+" + (SS.right * 5) + " XP · 得分 " + SS.score;
  $("f-stats").innerHTML = '<div class="stat"><div class="n" style="color:var(--good)">' + SS.right + '/' + total + '</div><div class="l">命中</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">×' + SS.best + '</div><div class="l">最高连击</div></div>'
    + '<div class="stat"><div class="n">' + acc + '%</div><div class="l">锁定率</div></div>';
  $("f-msg").textContent = "英译中与中译英交替出现,让识别与回忆形成双向通路";
  gameResult("starship", SS.right, total, SS.score); show("finish");
}
handlers.starship = {
  key(k) {
    if (k === "BACK") { SS.run++; stopTimerBar(SS.timer, "ss-timer"); $("ss-burst").innerHTML = ""; show(RETURN_SCREEN || "home"); return; }
    if (k === "MENU" || k === "PLAY") { const e = SS.list[SS.i]; if (e) speak(e.w); return; }
    if (SS.lock) return;
    if (k === "OK") starshipAnswer(SS.sel);
    else if (["UP", "DOWN", "LEFT", "RIGHT"].includes(k)) starshipMove(k);
  }
};

/* ================= 词怪追逐(闯关逃生) =================
   小人在前跑,词怪在后追,间距越拉越近。答对词义→甩出道具击退词怪、向前闯关;
   答错/超时→词怪逼近。被追上=失败,闯到终点=逃生成功。 */
const CH = { list: [], bank: [], i: 0, sel: 0, ansIdx: 0, gap: 62, pos: 0, goal: 15, score: 0, combo: 0, best: 0, right: 0, wrong: 0, lock: false, over: false, timer: null, creep: null, feedbackTimer: null, t0: 0, deadline: 0, remaining: 0, feedbackRemaining: 0, paused: false, inputGate: 0, lastOkAt: 0, run: 0, questionId: 0, phase: "idle", pendingWin: null, resultCommitted: false, ownerP: null, ownerCur: null };
const CH_TIME = 8000, CH_KNOCK = 15, CH_PENALTY = 20, CH_CREEP = 0.22;
function chaseNorm(value) {
  let text = String(value || "");
  try { if (text.normalize) text = text.normalize("NFKC"); } catch (e) { }
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
function chaseMeaningKey(value) { return chaseNorm(value); }
function chaseWordKey(value) { return chaseNorm(value); }
function chaseOwnerValid() {
  try { return CH.ownerP === P && CH.ownerCur === CUR && SCREEN === "chase"; }
  catch (e) { return false; }
}
function resetChaseVisuals() {
  const root = $("chase");
  if (root) {
    root.classList.remove("danger", "shake", "boost");
    root.setAttribute("data-ch-lane", "0"); root.setAttribute("data-ch-zone", "0"); root.style.setProperty("--spd", "1");
  }
  ["ch-runner", "ch-monster", "ch-speed", "ch-shock"].forEach(id => {
    const el = $(id); if (el) el.classList.remove("dash", "recoil", "lunge", "on", "go");
  });
  const particles = $("ch-particles"); if (particles) particles.innerHTML = "";
  const vignette = document.querySelector("#chase .ch-vignette"); if (vignette) vignette.style.opacity = "";
}
function makeChaseBank() {
  const out = [], words = Object.create(null);
  (window.gameWords ? gameWords() : activeWords()).forEach(e => {
    const wk = e && chaseWordKey(e.w), mk = e && chaseMeaningKey(e.m);
    if (!wk || !mk || words[wk]) return;
    words[wk] = true; out.push(e);
  });
  return out;
}
function startChase() {
  CH.run++;
  const pool = makeChaseBank(), meanings = new Set(pool.map(e => chaseMeaningKey(e.m)));
  if (pool.length < 8 || meanings.size < 4) { toast("「" + gameSrcName() + "」需要至少 8 个词和 4 种释义" + SRC_HINT); return; }
  CH.bank = pool.slice(); CH.list = shuffle(pool.slice());
  CH.i = 0; CH.gap = 62; CH.pos = 0; CH.goal = 15; CH.score = 0; CH.combo = 0; CH.best = 0; CH.right = 0; CH.wrong = 0;
  CH.over = false; CH.paused = false; CH.lastOkAt = 0; CH.questionId = 0; CH.phase = "starting"; CH.pendingWin = null; CH.resultCommitted = false; CH.ownerP = P; CH.ownerCur = CUR;
  stopChaseClock(false); stopChaseFeedback(); resetChaseVisuals();
  show("chase"); renderChase();
}
function chaseOpts(e) {
  const opts = [e];
  const targetWord = chaseWordKey(e.w), usedMeanings = new Set([chaseMeaningKey(e.m)]);
  const pool = shuffle(CH.bank.filter(x => chaseWordKey(x.w) !== targetWord));
  for (const c of pool) {
    const meaning = chaseMeaningKey(c.m);
    if (!meaning || usedMeanings.has(meaning)) continue;
    usedMeanings.add(meaning); opts.push(c);
    if (opts.length >= 4) break;
  }
  if (opts.length < 4) return null;
  shuffle(opts);
  CH.ansIdx = opts.indexOf(e);
  return opts;
}
function stopChaseClock(freeze) {
  clearTimeout(CH.timer); clearInterval(CH.creep); CH.timer = null; CH.creep = null;
  if (freeze) stopTimerBar(0, "ch-timer");
}
function stopChaseFeedback() {
  clearTimeout(CH.feedbackTimer); CH.feedbackTimer = null;
}
function scheduleChaseAdvance(delay, pendingWin) {
  stopChaseFeedback();
  const duration = Math.max(80, Number(delay) || 0), run = CH.run, questionId = CH.questionId;
  CH.feedbackRemaining = duration; CH.deadline = NOW() + duration; CH.pendingWin = pendingWin;
  CH.phase = pendingWin === null ? "feedback" : "ending"; CH.paused = false;
  CH.feedbackTimer = setTimeout(() => {
    CH.feedbackTimer = null;
    if (!chaseOwnerValid() || CH.run !== run || CH.questionId !== questionId || CH.paused || document.hidden) return;
    if (pendingWin === null) renderChase(); else finishChase(pendingWin);
  }, duration);
}
function startChaseClock(ms, resetBar) {
  stopChaseClock(false);
  const duration = Math.max(260, Number(ms) || CH_TIME), bar = $("ch-timer"), run = CH.run, questionId = CH.questionId;
  CH.remaining = duration; CH.deadline = NOW() + duration; CH.paused = false;
  if (bar) {
    bar.style.transition = "none";
    if (resetBar) bar.style.width = "100%";
    void bar.offsetWidth;
    bar.style.transition = "width " + duration + "ms linear";
    requestAnimationFrame(() => { if (chaseOwnerValid() && CH.run === run && CH.questionId === questionId && CH.phase === "question" && !CH.paused) bar.style.width = "0%"; });
  }
  CH.timer = setTimeout(() => {
    CH.timer = null;
    if (chaseOwnerValid() && CH.run === run && CH.questionId === questionId && CH.phase === "question" && !CH.paused && !document.hidden) chaseAnswer(-1);
  }, duration + 20);
  CH.creep = setInterval(() => {
    if (CH.lock || CH.paused || document.hidden || !chaseOwnerValid() || CH.phase !== "question" || CH.run !== run || CH.questionId !== questionId) return;
    CH.gap = Math.max(0, CH.gap - CH_CREEP);
    drawChase();
    if (CH.gap <= 0) chaseAnswer(-1);
  }, 160);
}
function pauseChase() {
  if (SCREEN !== "chase" || CH.paused || !chaseOwnerValid()) return;
  if (CH.phase === "question") {
    CH.remaining = Math.max(260, CH.deadline - NOW()); CH.paused = true; stopChaseClock(true);
  } else if (CH.phase === "feedback" || CH.phase === "ending") {
    CH.feedbackRemaining = Math.max(80, CH.deadline - NOW()); CH.paused = true; stopChaseFeedback();
  }
}
function resumeChase() {
  if (SCREEN !== "chase" || !CH.paused || document.hidden || !chaseOwnerValid()) return;
  if (CH.phase === "question") startChaseClock(CH.remaining, false);
  else if (CH.phase === "feedback" || CH.phase === "ending") scheduleChaseAdvance(CH.feedbackRemaining, CH.pendingWin);
}
function renderChase() {
  if (!chaseOwnerValid() || CH.over || document.hidden) return;
  stopChaseFeedback(); CH.questionId++; CH.phase = "question"; CH.pendingWin = null; CH.lock = false; CH.paused = false; CH.sel = 0;
  $("chase").classList.remove("shake");
  ["ch-runner", "ch-monster", "ch-speed", "ch-shock"].forEach(id => { const el = $(id); if (el) el.classList.remove("dash", "recoil", "lunge", "on", "go"); });
  const vignette = document.querySelector("#chase .ch-vignette"); if (vignette) vignette.style.opacity = "";
  const e = CH.list[CH.i % CH.list.length];
  CH.cur = e;
  const zones = ["晨雾边境", "风蚀高地", "星火峡口"];
  $("ch-prog").textContent = zones[Math.min(2, Math.floor(CH.pos / 5))] + "  " + CH.pos + " / " + CH.goal;
  $("ch-score").textContent = CH.score + " 分";
  $("ch-combo").textContent = CH.combo > 1 ? "🔥 连击 ×" + CH.combo : "";
  $("ch-word").textContent = e.w;
  const chasePhon = String(e.p || "").trim().replace(/^\/+|\/+$/g, "");
  $("ch-phon").textContent = chasePhon ? "/" + chasePhon + "/" : "";
  $("ch-fb").textContent = "方向键锁定能量门 · OK 穿越 · 播放键重听";
  const opts = chaseOpts(e);
  if (!opts) { CH.over = true; toast("当前词书释义过于相近，暂时无法生成四座星门"); show(RETURN_SCREEN || "arcade"); return; }
  const box = $("ch-opts"); box.innerHTML = "";
  const gateKeys = ["↖", "↗", "↙", "↘"];
  opts.forEach((o, i) => {
    const d = document.createElement("div");
    d.className = "opt" + (i === 0 ? " focus" : "");
    d.innerHTML = '<span class="idx">' + gateKeys[i] + '</span><span>' + esc(o.m) + '</span>';
    box.appendChild(d);
  });
  syncChaseGate();
  drawChase();
  speak(e.w);
  // 计时与追击在页面隐藏时暂停，回到电视应用后从剩余时间继续。
  CH.t0 = NOW(); CH.inputGate = CH.t0 + 620;
  startChaseClock(CH_TIME, true);
  requestFocusSync();
}
function drawChase() {
  const gap = clamp(CH.gap, 0, 100);
  // 角色在峡谷左侧奔跑，四座答案星门位于前方；距离越小词怪越逼近。
  const runnerX = 34;
  const monsterX = clamp(runnerX - 8 - gap * 0.38, 1, runnerX - 7);
  $("ch-runner").style.left = runnerX + "%";
  $("ch-monster").style.left = monsterX + "%";
  const prox = clamp(1 - gap / 60, 0, 1);
  $("ch-monster").style.setProperty("--monster-scale", (0.84 + prox * 0.38).toFixed(2));
  $("ch-gapbar").style.width = gap + "%";
  const danger = gap < 28;
  $("chase").classList.toggle("danger", danger);
  $("chase").classList.toggle("boost", CH.combo >= 3);
  $("chase").setAttribute("data-ch-zone", String(Math.min(2, Math.floor(CH.pos / 5))));
  $("ch-gapbar").style.background = danger ? "var(--bad)" : "linear-gradient(90deg,var(--good),var(--gold))";
  // 连击 → 奔跑越快(视差/地面加速)
  const spd = (1 + Math.min(CH.combo, 8) * 0.16).toFixed(2);
  $("chase").style.setProperty("--spd", spd);
}
function chaseParticles(xPct, color, n) {
  if (focusFxReduced()) return;
  const box = $("ch-particles"); if (!box || !box.appendChild) return;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("div"); p.className = "ch-pt";
    p.style.background = color; p.style.left = xPct + "%"; p.style.bottom = (9 + Math.random() * 7) + "vmin";
    const dx = (Math.random() * 2 - 1) * 26, dy = -(8 + Math.random() * 22), rot = Math.random() * 360;
    try {
      p.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: "translate(" + dx + "vmin," + dy + "vmin) scale(.2) rotate(" + rot + "deg)", opacity: 0 }],
        { duration: 480 + Math.random() * 320, easing: "cubic-bezier(.2,.7,.3,1)" });
    } catch (e) { }
    box.appendChild(p);
    setTimeout(() => { try { box.removeChild(p); } catch (e) { } }, 840);
  }
}
function syncChaseGate() {
  $("chase").setAttribute("data-ch-lane", String(CH.sel));
  document.querySelectorAll("#ch-opts .opt").forEach((o, i) => o.classList.toggle("focus", i === CH.sel));
}
function chaseMove(k) {
  let row = Math.floor(CH.sel / 2), col = CH.sel % 2;
  if (k === "UP") row = 0;
  else if (k === "DOWN") row = 1;
  else if (k === "LEFT") col = 0;
  else if (k === "RIGHT") col = 1;
  CH.sel = row * 2 + col;
  syncChaseGate();
}
function chaseAnswer(idx) {
  if (CH.lock || CH.phase !== "question" || CH.paused || document.hidden || !chaseOwnerValid()) return;
  CH.lock = true; CH.phase = "feedback"; stopChaseClock(true);
  const e = CH.cur;
  const opts = document.querySelectorAll("#ch-opts .opt");
  const ok = idx === CH.ansIdx;
  if (opts[CH.ansIdx]) opts[CH.ansIdx].classList.add("right");
  if (!ok && idx >= 0 && opts[idx]) opts[idx].classList.add("wrong");
  if (ok) {
    CH.combo++; CH.best = Math.max(CH.best, CH.combo); CH.right++; CH.pos++;
    CH.gap = Math.min(100, CH.gap + CH_KNOCK + Math.min(6, CH.combo));
    CH.score += 10 + Math.min(12, CH.combo * 2); P.xp += 4;
    $("ch-fb").textContent = "✓ 击退! " + e.w + " = " + e.m;
    try { if (window.SFX) SFX.hit(); } catch (x) { }
    // 小人急冲 + 速度线 + 冲击波炸退词怪 + 粒子迸溅
    const r = $("ch-runner"); r.classList.remove("dash"); void r.offsetWidth; r.classList.add("dash");
    const sp = $("ch-speed"); sp.classList.remove("on"); void sp.offsetWidth; sp.classList.add("on");
    const monX = clamp(26 - CH.gap * 0.38, 1, 27);
    const sh = $("ch-shock"); sh.style.left = (monX + 6) + "%"; sh.classList.remove("go"); void sh.offsetWidth; sh.classList.add("go");
    const m = $("ch-monster"); m.classList.remove("recoil"); void m.offsetWidth; m.classList.add("recoil");
    chaseParticles(monX + 6, "#FF9F0A", 12);
    chaseParticles(monX + 6, "#0A84FF", 6);
  } else {
    CH.combo = 0; CH.wrong++;
    CH.gap = Math.max(0, CH.gap - CH_PENALTY);
    $("ch-fb").textContent = (idx < 0 ? "⏱ 超时!" : "✗ ") + e.w + " → " + e.m;
    try { if (window.SFX) { SFX.bad(); SFX.danger(); } } catch (x) { }
    $("chase").classList.remove("shake"); void $("chase").offsetWidth; $("chase").classList.add("shake");
    const m = $("ch-monster"); m.classList.remove("lunge"); void m.offsetWidth; m.classList.add("lunge");
    const v = document.querySelector("#chase .ch-vignette"), run = CH.run, questionId = CH.questionId; if (v) { v.style.opacity = "1"; setTimeout(() => { if (CH.run === run && CH.questionId === questionId && CH.gap >= 28) v.style.opacity = ""; }, 260); }
    chaseParticles(clamp(26 - CH.gap * 0.38, 1, 27) + 5, "#FF3B30", 8);
  }
  drawChase();
  schedHit(e.w, ok);
  if (CH.pos >= CH.goal) { CH.over = true; commitChaseResult(true); scheduleChaseAdvance(800, true); return; }
  if (CH.gap <= 0) { CH.over = true; commitChaseResult(false); scheduleChaseAdvance(900, false); return; }
  CH.i++;
  scheduleChaseAdvance(ok ? 750 : 1500, null);
}
handlers.chase = {
  key(k) {
    if (k === "OK") {
      const now = NOW(), previous = CH.lastOkAt; CH.lastOkAt = now;
      if ((previous && now - previous < 620) || now < CH.inputGate) return;
    }
    if (k === "BACK") {
      CH.run++; stopChaseClock(true); stopChaseFeedback(); CH.over = true; CH.phase = "aborted"; CH.paused = false;
      CH.ownerP = null; CH.ownerCur = null; armTvCarryGuard("BACK", 650); show(RETURN_SCREEN || "home"); return;
    }
    if (k === "MENU" || k === "PLAY") { if (CH.cur) speak(CH.cur.w); return; }
    if (CH.lock) return;
    if (k === "OK") chaseAnswer(CH.sel);
    else if (["UP", "DOWN", "LEFT", "RIGHT"].includes(k)) chaseMove(k);
  }
};
function commitChaseResult(win) {
  if (CH.resultCommitted || !chaseOwnerValid()) return false;
  CH.resultCommitted = true; CH.pendingWin = !!win;
  const tot = CH.right + CH.wrong;
  gameResult("chase", CH.right, tot, CH.score);
  return true;
}
function finishChase(win) {
  if (!chaseOwnerValid()) return;
  stopChaseClock(true); stopChaseFeedback();
  commitChaseResult(win);
  CH.phase = "finish"; CH.paused = false;
  const tot = CH.right + CH.wrong;
  const acc = tot ? Math.round(CH.right / tot * 100) : 0;
  $("f-title").textContent = win ? "🎉 成功逃生!" : "👾 被词怪追上了";
  $("f-xp").textContent = "+" + (CH.right * 4) + " XP · 得分 " + CH.score;
  $("f-stats").innerHTML = '<div class="stat"><div class="n" style="color:var(--good)">' + CH.pos + '/' + CH.goal + '</div><div class="l">闯关进度</div></div>'
    + '<div class="stat"><div class="n" style="color:var(--gold)">×' + CH.best + '</div><div class="l">最高连击</div></div>'
    + '<div class="stat"><div class="n">' + acc + '%</div><div class="l">正确率</div></div>';
  $("f-msg").textContent = win ? "词义配对越快越准,道具威力越大!" : "别灰心,答对就能击退它,再来一次!";
  try { if (window.SFX) (win ? SFX.win() : SFX.danger()); } catch (x) { }
  armTvCarryGuard("OK", 700);
  show("finish");
}

/* ================= 启动 ================= */
function boot() {
  try { if (window.SFX) SFX.resume(); } catch (e) { }
  loadApp();
  loadP();
  loadDecks();
  loadScreens();
  try { ttsOK = !!NativeBridge.isTtsReady(); } catch (e) { }
  show("home");
  // 游戏优先启动：脚本全部就绪后直接进入词汇世界；返回键仍可抵达完整经典首页。
  window.addEventListener("load", () => {
    try { if (SCREEN === "home" && window.WordWorld && typeof window.WordWorld.open === "function") window.WordWorld.open(); }
    catch (e) { }
  }, { once: true });
}
boot();
