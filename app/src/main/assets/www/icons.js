/* ================= iOS 风格图标库 (v4.1) =================
   线性白色图标 + 彩色渐变圆角方块(iOS 设置/主屏那种 tile),取代 emoji。
   全部内联 SVG,自绘,离线可用。 */
"use strict";
(function () {
  var I = {
    new: '<path d="M4 20l4.5-1L20 7.5a2.1 2.1 0 0 0-3-3L5.5 15.5 4 20z"/><path d="M14.5 6.5l3 3"/>',
    review: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>',
    quiz: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    listen: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4.2" height="6.5" rx="1.6"/><rect x="16.8" y="13.5" width="4.2" height="6.5" rx="1.6"/>',
    cloze: '<rect x="5" y="3" width="14" height="18" rx="2.4"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    spell: '<rect x="3" y="6.5" width="18" height="11" rx="2.2"/><path d="M7 10.3h.01M11 10.3h.01M15 10.3h.01M8 14h8"/>',
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
    rate: '<path d="M4 17a9 9 0 1 1 16 0"/><path d="M12 13.5a1.6 1.6 0 1 0 0-3.2"/><path d="M13.4 10.4 17.5 7"/>',
    update: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>',
    reset: '<path d="M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13"/>',
    _default: '<circle cx="12" cy="12" r="8"/>'
  };
  var C = {
    new: ['#0A84FF', '#0060E6'], review: ['#5E5CE6', '#3D3BB0'], quiz: ['#FFCC00', '#FF9F0A'],
    listen: ['#FF375F', '#E6006A'], cloze: ['#40C8E0', '#0A84FF'], spell: ['#BF5AF2', '#8944AB'],
    match: ['#FF9F0A', '#FF6A00'], tf: ['#00C7BE', '#019A8E'], battle: ['#8E8E93', '#5B5B60'],
    chase: ['#FF453A', '#D70015'], sim: ['#34C759', '#248A3D'], screens: ['#64D2FF', '#0A84FF'],
    browse: ['#FF9500', '#E96A00'], custom: ['#FF375F', '#C9006E'], ai: ['#5E5CE6', '#3D3BB0'],
    decks: ['#0A84FF', '#0060E6'], stats: ['#30D158', '#1E7B34'], who: ['#40C8E0', '#0A84FF'],
    settings: ['#8E8E93', '#5B5B60'],
    newPerDay: ['#0A84FF', '#0060E6'], tts: ['#FF9500', '#E96A00'], auto: ['#34C759', '#248A3D'],
    rate: ['#BF5AF2', '#8944AB'], update: ['#0A84FF', '#0060E6'], reset: ['#FF453A', '#D70015'],
    _default: ['#8E8E93', '#5B5B60']
  };
  window.iconSvg = function (id) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="gicon">' + (I[id] || I._default) + '</svg>';
  };
  window.iconTile = function (id, extra) {
    var c = C[id] || C._default;
    return '<div class="ic itile ' + (extra || '') + '" style="background:linear-gradient(160deg,' + c[0] + ',' + c[1] + ')">' + iconSvg(id) + '</div>';
  };
})();
