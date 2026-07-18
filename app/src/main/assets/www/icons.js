/* ================= iOS 风格图标库 (v6.0) =================
   线性白色图标 + 彩色渐变圆角方块(iOS 设置/主屏那种 tile),取代 emoji。
   全部内联 SVG,自绘,离线可用。 */
"use strict";
(function () {
  var I = {
    new: '<path d="M4 20l4.5-1L20 7.5a2.1 2.1 0 0 0-3-3L5.5 15.5 4 20z"/><path d="M14.5 6.5l3 3"/>',
    review: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>',
    weak: '<path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6l-7-3z"/><path d="m8.7 12 2.1 2.1 4.6-4.6"/>',
    arcade: '<path d="M7.2 8h9.6a4.7 4.7 0 0 1 4.5 5.9l-1 3.7a2.5 2.5 0 0 1-4.3 1l-1.5-1.8h-5l-1.5 1.8a2.5 2.5 0 0 1-4.3-1l-1-3.7A4.7 4.7 0 0 1 7.2 8z"/><path d="M8 11v4M6 13h4M16.5 12h.01M18.5 14h.01"/>',
    quiz: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    listen: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4.2" height="6.5" rx="1.6"/><rect x="16.8" y="13.5" width="4.2" height="6.5" rx="1.6"/>',
    cloze: '<rect x="5" y="3" width="14" height="18" rx="2.4"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    spell: '<rect x="3" y="6.5" width="18" height="11" rx="2.2"/><path d="M7 10.3h.01M11 10.3h.01M15 10.3h.01M8 14h8"/>',
    chunks: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M17 14v6M14 17h6"/>',
    sentence: '<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9h8M8 12h5"/>',
    starship: '<path d="M12 2.8c3.7 2.4 5.7 6 5.7 10.2L15 17H9l-2.7-4C6.3 8.8 8.3 5.2 12 2.8z"/><circle cx="12" cy="10" r="2"/><path d="m8.8 15-3.3 1.8V12l1.2-1.3M15.2 15l3.3 1.8V12l-1.2-1.3M10 19l2 2 2-2"/>',
    match: '<path d="M9.5 7H6.5a3 3 0 0 0 0 6h3"/><path d="M14.5 7h3a3 3 0 0 1 0 6h-3"/><path d="M8.5 10h7"/>',
    tf: '<path d="M12 3v18"/><path d="M5 7h14"/><path d="M8 21h8"/><path d="M5 7 2.5 13a2.7 2.7 0 0 0 5 0L5 7z"/><path d="M19 7l-2.5 6a2.7 2.7 0 0 0 5 0L19 7z"/>',
    battle: '<rect x="5" y="7" width="14" height="12" rx="2.4"/><path d="M9 7V4.2M15 7V4.2M9.5 12h.01M14.5 12h.01M9.5 16h5"/>',
    chase: '<path d="M5 20.5V11a7 7 0 0 1 14 0v9.5l-2.4-1.7-2.3 1.7-2.3-1.7-2.3 1.7L5 20.5z"/><path d="M9.5 11h.01M14.5 11h.01"/>',
    sim: '<path d="M4 21h16"/><path d="M5.5 21V10l6.5-4.6L18.5 10v11"/><path d="M9.5 21v-5.5h5V21"/>',
    screens: '<rect x="7" y="3" width="10" height="18" rx="2.6"/><path d="M11 18h2"/>',
    browse: '<path d="M12 6.2C10 4.7 6.7 4.2 3.5 5v13c3.2-.8 6.5-.3 8.5 1.2 2-1.5 5.3-2 8.5-1.2V5c-3.2-.8-6.5-.3-8.5 1.2z"/><path d="M12 6.2V19"/>',
    custom: '<rect x="4" y="5" width="16" height="16" rx="2.4"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/>',
    ai: '<path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4z"/><path d="M6.5 11v4.5c0 1.3 2.7 3 5.5 3s5.5-1.7 5.5-3V11"/>',
    decks: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3.5 12.5 12 17l8.5-4.5"/><path d="M3.5 16.5 12 21l8.5-4.5"/>',
    stats: '<path d="M5 21V11M12 21V4M19 21v-6"/><path d="M3.5 21h17"/>',
    who: '<circle cx="9" cy="8" r="3.2"/><path d="M3.2 20a5.8 5.8 0 0 1 11.6 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.5 20a5.8 5.8 0 0 0-2.7-4.9"/>',
    settings: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/>',
    /* 设置项 */
    newPerDay: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1"/>',
    tts: '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z"/><path d="M16.5 9a4 4 0 0 1 0 6"/>',
    auto: '<path d="M7 4.5 19 12 7 19.5V4.5z"/>',
    eye: '<path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    rate: '<path d="M4 17a9 9 0 1 1 16 0"/><path d="M12 13.5a1.6 1.6 0 1 0 0-3.2"/><path d="M13.4 10.4 17.5 7"/>',
    update: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>',
    reset: '<path d="M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13"/>',
    _default: '<circle cx="12" cy="12" r="8"/>'
  };
  var C = {
    new: ['#4A91DE', '#286CB6'], review: ['#7469D1', '#5047A4'], weak: ['#50A46C', '#2F774A'], arcade: ['#5964D8', '#3943A4'], quiz: ['#E7A925', '#CE7914'],
    listen: ['#E45577', '#C22D59'], cloze: ['#50AEC2', '#2E7E9F'], spell: ['#A969C4', '#754693'],
    chunks: ['#D98242', '#AD5527'], sentence: ['#4AA39A', '#2E7771'],
    starship: ['#5B6CE1', '#3441A8'],
    match: ['#E18A31', '#BF5A1B'], tf: ['#3BA9A0', '#267A75'], battle: ['#76767E', '#4A4A50'],
    chase: ['#DF5A53', '#B83238'], sim: ['#4DA16B', '#307A4E'], screens: ['#51A0C4', '#2D72A1'],
    browse: ['#D78634', '#AF5C24'], custom: ['#D6607C', '#A84063'], ai: ['#7469D1', '#5047A4'],
    decks: ['#4A91DE', '#286CB6'], stats: ['#51A66C', '#327C4C'], who: ['#50AEC2', '#2E7E9F'],
    settings: ['#76767E', '#4A4A50'],
    newPerDay: ['#4A91DE', '#286CB6'], tts: ['#D78634', '#AF5C24'], auto: ['#4DA16B', '#307A4E'],
    eye: ['#A58A58', '#71603F'], rate: ['#A969C4', '#754693'], update: ['#4A91DE', '#286CB6'], reset: ['#DF5A53', '#B83238'],
    _default: ['#8E8E93', '#5B5B60']
  };
  window.iconSvg = function (id) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="gicon">' + (I[id] || I._default) + '</svg>';
  };
  window.iconTile = function (id, extra) {
    var c = C[id] || C._default;
    return '<div class="ic itile ' + (extra || '') + '" style="background:linear-gradient(160deg,' + c[0] + ',' + c[1] + ')">' + iconSvg(id) + '</div>';
  };

  /* --------- 小号纯色字形(状态栏/内联,fill=currentColor,类 SF Symbols) --------- */
  var G = {
    user: '<path d="M12 12.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5z"/><path d="M4.2 20c0-3.4 3.5-5.5 7.8-5.5s7.8 2.1 7.8 5.5c0 .9-.5 1.4-1.4 1.4H5.6C4.7 21.4 4.2 20.9 4.2 20z"/>',
    flame: '<path d="M12.9 2.2c.3 2.4-.8 4-2.3 5.5C9 9.4 7 11 7 14.2A5 5 0 0 0 17 14c0-2-.9-3.4-1.7-4.5-.3.8-.9 1.3-1.6 1.6.4-2.8-.4-6.4-.8-8.9z"/>',
    star: '<path d="m12 3 2.5 5.1 5.6.8-4.05 4 .96 5.6L12 15.9l-5.01 2.6.96-5.6L3.9 8.9l5.6-.8L12 3z"/>',
    seal: '<path d="m12 2.4 2 1.6 2.6-.15.85 2.45 2.35 1.1-.6 2.55L23 12l-1.75 2 .6 2.55-2.35 1.1-.85 2.45L16 20l-2 1.6-2-1.6-2.6.15-.85-2.45L6.2 16.6l.6-2.55L5.05 12l1.75-2-.6-2.55 2.35-1.1L9.4 3.85 12 4l2-1.6z"/>',
    check: '<path d="m8 12.4 2.6 2.6L16.4 9" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  };
  window.glyph = function (id) {
    var extra = id === 'seal' ? G.check : '';
    return '<svg viewBox="0 0 24 24" fill="currentColor" class="mglyph">' + (G[id] || '') + extra + '</svg>';
  };
  // 头像:渐变圆 + 白色人形,按档案着色
  var AV = { fin: ['#0A84FF', '#0060E6'], teen: ['#FF9F0A', '#FF6A00'] };
  window.avatar = function (prof, cls) {
    var c = AV[prof] || AV.fin;
    return '<span class="av ' + (cls || '') + '" style="background:linear-gradient(160deg,' + c[0] + ',' + c[1] + ')">' +
      '<svg viewBox="0 0 24 24" fill="#fff" class="mglyph">' + G.user + '</svg></span>';
  };
})();
