/* ================= SFX 音效引擎 (v3.8) =================
   Web Audio 实时合成,无需音频文件、离线可用。风格:柔和、克制、悦耳,
   类似 Apple tvOS 的轻点反馈。全局在方向键/OK 时触发,游戏结果处叠加。 */
"use strict";
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, comp = null;
  var enabled = true;
  var lastNav = 0;

  function ensure() {
    if (!AC) return false;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.9;
        comp = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : null;
        if (comp) { master.connect(comp); comp.connect(ctx.destination); }
        else master.connect(ctx.destination);
      } catch (e) { ctx = null; return false; }
    }
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) { } }
    return true;
  }

  // 单个柔和音:正弦为主 + 轻微高次谐波,指数衰减,经低通增暖
  function blip(opt) {
    if (!enabled || !ensure()) return;
    var t = ctx.currentTime + (opt.delay || 0);
    var g = ctx.createGain();
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = opt.cut || 3200; lp.Q.value = 0.6;
    var peak = opt.gain == null ? 0.09 : opt.gain;
    var dur = opt.dur || 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opt.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var o = ctx.createOscillator();
    o.type = opt.type || "sine";
    o.frequency.setValueAtTime(opt.f, t);
    if (opt.f2) o.frequency.exponentialRampToValueAtTime(opt.f2, t + dur * 0.9);
    o.connect(g);
    // 轻微高八度泛音增加"清脆"质感
    if (opt.spark) {
      var o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = "sine"; o2.frequency.setValueAtTime(opt.f * 2.01, t);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
      o2.connect(g2); g2.connect(lp); o2.start(t); o2.stop(t + dur + 0.03);
    }
    g.connect(lp); lp.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  // 短促噪声(用于击退/whoosh)
  function noise(opt) {
    if (!enabled || !ensure()) return;
    var t = ctx.currentTime + (opt.delay || 0);
    var dur = opt.dur || 0.16;
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.setValueAtTime(opt.f || 1200, t);
    bp.frequency.exponentialRampToValueAtTime(opt.f2 || 300, t + dur);
    bp.Q.value = 0.8;
    var g = ctx.createGain();
    g.gain.setValueAtTime(opt.gain || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur);
  }

  var SFX = {
    resume: function () { ensure(); },
    setEnabled: function (v) { enabled = !!v; },
    // 方向键:温暖柔和的低频轻点(去掉高次泛音的尖锐感,音量更足,类 tvOS 聚焦)
    nav: function () {
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      if (now - lastNav < 40) return; lastNav = now;
      blip({ f: 500, f2: 430, type: "sine", dur: 0.07, gain: 0.11, cut: 1300, attack: 0.004 });
    },
    // OK 确认:温暖的圆润"啵"
    ok: function () { blip({ f: 660, f2: 560, type: "sine", dur: 0.1, gain: 0.075, cut: 2600, spark: true }); },
    // 返回:柔和下行
    back: function () { blip({ f: 480, f2: 360, type: "sine", dur: 0.11, gain: 0.06, cut: 2200 }); },
    // 答对/成功:上行三音(E5-A5-D6)清亮如风铃
    good: function () {
      blip({ f: 659, dur: 0.13, gain: 0.07, spark: true });
      blip({ f: 880, dur: 0.14, gain: 0.07, spark: true, delay: 0.075 });
      blip({ f: 1175, dur: 0.2, gain: 0.075, spark: true, delay: 0.15 });
    },
    // 答错:柔和低沉双音(不刺耳)
    bad: function () {
      blip({ f: 300, f2: 240, type: "triangle", dur: 0.13, gain: 0.08, cut: 1400 });
      blip({ f: 220, f2: 170, type: "triangle", dur: 0.18, gain: 0.08, cut: 1200, delay: 0.09 });
    },
    // 通关/大成就:欢快琶音
    win: function () {
      var seq = [523, 659, 784, 1047, 1319];
      for (var i = 0; i < seq.length; i++) blip({ f: seq[i], dur: 0.24, gain: 0.08, spark: true, delay: i * 0.085 });
    },
    // 击退怪物:whoosh + 沉闷撞击
    hit: function () {
      noise({ f: 1800, f2: 400, dur: 0.14, gain: 0.1 });
      blip({ f: 150, f2: 70, type: "sine", dur: 0.16, gain: 0.14, cut: 900, delay: 0.04 });
    },
    // 怪物逼近/危险:低频威胁音
    danger: function () { blip({ f: 120, f2: 90, type: "sawtooth", dur: 0.22, gain: 0.07, cut: 500 }); }
  };

  window.SFX = SFX;
})();
