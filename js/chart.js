/* ============================================================
 * chart.js  くらべるグラフの絵を描く部分
 *
 *  外から何も読み込まずに、その場で線グラフを組み立てます。
 *  （インターネットにつながっていなくても動くようにするため）
 *
 *  色は2色。色の見え方が人と違う方でも区別がつくことを
 *  確認した組み合わせを使い、さらに「線の種類（実線・破線）」と
 *  「線のはしの文字」でも区別できるようにしています。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.SPSChart = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var 色 = {
    married: '#2f6f9f',   // 結婚を続けた場合
    divorced: '#c2591a',  // 離婚した場合
    grid: '#e3e8ee',
    axis: '#9aa7b3',
    ink: '#1b2733',
    sub: '#52616f',
    cliff: '#8a5a00',
    withProg: '#2f6f9f',    // 使える制度を全部使った場合
    withoutProg: '#c2591a', // いまのまま
    band: '#dff0e6',        // 生活防衛資金のゾーン
    bandLine: '#1c7a4a'
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** きりのよい目盛り幅を選ぶ */
  function 目盛り幅(範囲) {
    var 候補 = [1000, 2000, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 500000];
    for (var i = 0; i < 候補.length; i++) { if (範囲 / 候補[i] <= 6) { return 候補[i]; } }
    return 1000000;
  }

  /**
   * 線グラフのSVGを文字列で返す。
   * @param {Array}  years  engine.シミュレーション() の years
   * @param {Array}  cliffs 同 cliffs
   * @param {String} 見方   'perPerson'（ひとりあたりに直した金額。ふだんはこちら）
   *                        または 'total'（家ぜんたいの金額）
   */
  function 描く(years, cliffs, 見方) {
    if (!years || !years.length) { return '<p class="hint">お子さんの年齢を入れると、ここにグラフが出ます。</p>'; }
    var 値 = (見方 === 'total') ? 'total' : 'perPerson';
    function V(y, key) { return y[key][値]; }

    var W = Math.max(520, 60 + years.length * 46), H = 320;
    var 左 = 66, 右 = 78, 上 = 18, 下 = 52;
    var 幅 = W - 左 - 右, 高 = H - 上 - 下;

    var 全値 = [];
    years.forEach(function (y) { 全値.push(V(y, 'married'), V(y, 'divorced')); });
    var 最大 = Math.max.apply(null, 全値), 最小 = Math.min.apply(null, 全値);
    var 上限 = Math.max(最大, 0), 下限 = Math.min(最小, 0);
    var 余白 = Math.max((上限 - 下限) * 0.12, 5000);
    上限 += 余白; 下限 -= (下限 < 0 ? 余白 : 0);
    if (上限 === 下限) { 上限 = 下限 + 10000; }

    var 幅1 = years.length > 1 ? 幅 / (years.length - 1) : 0;
    function X(i) { return 左 + 幅1 * i; }
    function Y(v) { return 上 + 高 - (v - 下限) / (上限 - 下限) * 高; }

    var s = [];
    s.push('<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="結婚を続けた場合と離婚した場合の、ひと月あたりのお金の推移">');

    /* --- 横の目盛り線 --- */
    var 幅目 = 目盛り幅(上限 - 下限);
    var 開始 = Math.ceil(下限 / 幅目) * 幅目;
    for (var v = 開始; v <= 上限; v += 幅目) {
      var yy = Y(v);
      s.push('<line x1="' + 左 + '" y1="' + yy.toFixed(1) + '" x2="' + (左 + 幅) + '" y2="' + yy.toFixed(1) +
        '" stroke="' + (v === 0 ? 色.axis : 色.grid) + '" stroke-width="1"/>');
      s.push('<text x="' + (左 - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="' + 色.sub + '">' +
        Math.round(v / 10000) + '万</text>');
    }

    /* --- 制度の崖（たて線） --- */
    (cliffs || []).forEach(function (c, idx) {
      var cx = X(c.offset);
      s.push('<line x1="' + cx.toFixed(1) + '" y1="' + 上 + '" x2="' + cx.toFixed(1) + '" y2="' + (上 + 高) +
        '" stroke="' + 色.cliff + '" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.75"/>');
      s.push('<text x="' + (cx + 3).toFixed(1) + '" y="' + (上 + 12 + (idx % 3) * 13) + '" font-size="10" fill="' + 色.cliff + '">▼' + esc(c.label) + '</text>');
    });

    /* --- 横軸 --- */
    s.push('<line x1="' + 左 + '" y1="' + (上 + 高) + '" x2="' + (左 + 幅) + '" y2="' + (上 + 高) + '" stroke="' + 色.axis + '" stroke-width="1"/>');
    var 間引き = years.length > 14 ? 2 : 1;
    years.forEach(function (y, i) {
      if (i % 間引き !== 0 && i !== years.length - 1) { return; }
      s.push('<text x="' + X(i).toFixed(1) + '" y="' + (上 + 高 + 16) + '" text-anchor="middle" font-size="11" fill="' + 色.sub + '">' + y.youngestAge + '</text>');
    });
    s.push('<text x="' + (左 + 幅 / 2) + '" y="' + (H - 20) + '" text-anchor="middle" font-size="11" fill="' + 色.sub + '">いちばん下のお子さんの年齢（歳）</text>');
    s.push('<text x="' + 左 + '" y="' + (上 - 4) + '" font-size="11" fill="' + 色.sub + '">' +
      (値 === 'total' ? '家ぜんたいで、ひと月に使えるお金' : 'ひとりあたりに直した、ひと月のお金') + '</text>');

    /* --- 折れ線 --- */
    function 線(key, col, dash) {
      var d = years.map(function (y, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(V(y, key)).toFixed(1); }).join(' ');
      s.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' +
        (dash ? ' stroke-dasharray="6 4"' : '') + '/>');
      years.forEach(function (y, i) {
        if (i % 間引き !== 0 && i !== years.length - 1) { return; }
        s.push('<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(V(y, key)).toFixed(1) + '" r="3.2" fill="' + col + '" stroke="#fff" stroke-width="2"/>');
      });
    }
    線('married', 色.married, true);
    線('divorced', 色.divorced, false);

    /* --- 線のはしに名前を直接書く（凡例を探さなくても分かるように） --- */
    var 末 = years.length - 1;
    s.push('<text x="' + (X(末) + 6) + '" y="' + (Y(V(years[末], 'married')) + 4).toFixed(1) + '" font-size="11" font-weight="700" fill="' + 色.married + '">続ける</text>');
    s.push('<text x="' + (X(末) + 6) + '" y="' + (Y(V(years[末], 'divorced')) + 4).toFixed(1) + '" font-size="11" font-weight="700" fill="' + 色.divorced + '">離婚</text>');

    /* --- 指でなぞった位置の金額を出すための当たり判定 --- */
    years.forEach(function (y, i) {
      var x0 = X(i) - 幅1 / 2, w = 幅1 || 40;
      s.push('<rect class="hit" data-i="' + i + '" x="' + Math.max(左, x0).toFixed(1) + '" y="' + 上 + '" width="' + w.toFixed(1) + '" height="' + 高 +
        '" fill="transparent" style="cursor:crosshair"><title>' +
        'お子さん' + y.youngestAge + '歳／続けた場合 ' + Math.round(V(y, 'married')).toLocaleString('ja-JP') + '円・離婚した場合 ' +
        Math.round(V(y, 'divorced')).toLocaleString('ja-JP') + '円</title></rect>');
    });

    s.push('</svg>');
    return s.join('');
  }

  /** グラフの下に置く、数字そのままの表（グラフが読みにくい方むけ） */
  function 表(years, 見方) {
    if (!years || !years.length) { return ''; }
    var 値 = (見方 === 'total') ? 'total' : 'perPerson';
    var 見出し = (値 === 'total') ? '家ぜんたいの金額' : 'ひとりあたりに直した金額';
    var 行 = years.filter(function (y, i) { return i % Math.ceil(years.length / 8) === 0 || i === years.length - 1; });
    var h = ['<table class="compare"><caption class="hint" style="text-align:left">' + 見出し +
      '（ひと月あたり）</caption><thead><tr><th>いちばん下の子</th><th>結婚を続けた場合</th><th>離婚した場合</th><th>差</th></tr></thead><tbody>'];
    行.forEach(function (y) {
      var m = y.married[値], dv = y.divorced[値];
      var 差 = dv - m;
      h.push('<tr><td>' + y.youngestAge + '歳</td><td>' + Math.round(m).toLocaleString('ja-JP') + '円</td><td>' +
        Math.round(dv).toLocaleString('ja-JP') + '円</td><td>' +
        (差 >= 0 ? '＋' : '−') + Math.abs(Math.round(差)).toLocaleString('ja-JP') + '円</td></tr>');
    });
    h.push('</tbody></table>');
    return h.join('');
  }

  function 凡例() {
    return '<div class="legend">' +
      '<span><span class="swatch" style="background:' + 色.married + '"></span>結婚を続けた場合（破線）</span>' +
      '<span><span class="swatch" style="background:' + 色.divorced + '"></span>離婚した場合（実線）</span>' +
      '<span><span class="swatch" style="background:' + 色.cliff + '"></span>制度が切りかわるところ</span>' +
      '</div>';
  }

  /* ============================================================
   * 貯金のたまり方のグラフ
   *   帯 ... 生活防衛資金のゾーン（生活費の3か月分から6か月分）
   *   線 ... 制度を申請した場合 と、申請しなかった場合
   * ============================================================ */
  function 資産を描く(curve) {
    if (!curve || !curve.points.length) { return '<p class="hint">毎月の生活費を入れると、ここにグラフが出ます。</p>'; }
    var pts = curve.points;

    var W = Math.max(520, 60 + pts.length * 46), H = 320;
    var 左 = 74, 右 = 84, 上 = 18, 下 = 52;
    var 幅 = W - 左 - 右, 高 = H - 上 - 下;

    var 全値 = [0, curve.safetyMax, curve.startSavings];
    pts.forEach(function (p) { 全値.push(p.all, p.now); });
    var 上限 = Math.max.apply(null, 全値), 下限 = Math.min.apply(null, 全値);
    var 余白 = Math.max((上限 - 下限) * 0.1, 100000);
    上限 += 余白; 下限 -= 余白;

    var 幅1 = pts.length > 1 ? 幅 / (pts.length - 1) : 0;
    function X(i) { return 左 + 幅1 * i; }
    function Y(v) { return 上 + 高 - (v - 下限) / (上限 - 下限) * 高; }

    var s = [];
    s.push('<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="貯金のたまり方。制度を申請した場合と、しなかった場合の比較。生活防衛資金のゾーンつき">');

    /* --- 生活防衛資金の帯 --- */
    if (curve.safetyMax > 0) {
      var y上 = Y(curve.safetyMax), y下 = Y(curve.safetyMin);
      s.push('<rect x="' + 左 + '" y="' + y上.toFixed(1) + '" width="' + 幅 + '" height="' + Math.max(1, y下 - y上).toFixed(1) +
        '" fill="' + 色.band + '"/>');
      s.push('<line x1="' + 左 + '" y1="' + y下.toFixed(1) + '" x2="' + (左 + 幅) + '" y2="' + y下.toFixed(1) +
        '" stroke="' + 色.bandLine + '" stroke-width="1" stroke-dasharray="4 3"/>');
      s.push('<line x1="' + 左 + '" y1="' + y上.toFixed(1) + '" x2="' + (左 + 幅) + '" y2="' + y上.toFixed(1) +
        '" stroke="' + 色.bandLine + '" stroke-width="1" stroke-dasharray="4 3"/>');
      s.push('<text x="' + (左 + 6) + '" y="' + (y上 - 4).toFixed(1) + '" font-size="10" font-weight="700" fill="' + 色.bandLine +
        '">まずここまで貯める（生活費の3〜6か月分）</text>');
    }

    /* --- 横の目盛り線 --- */
    var 幅目 = 目盛り幅(上限 - 下限);
    var 開始 = Math.ceil(下限 / 幅目) * 幅目;
    for (var v = 開始; v <= 上限; v += 幅目) {
      var yy = Y(v);
      s.push('<line x1="' + 左 + '" y1="' + yy.toFixed(1) + '" x2="' + (左 + 幅) + '" y2="' + yy.toFixed(1) +
        '" stroke="' + (v === 0 ? '#8899a6' : 色.grid) + '" stroke-width="' + (v === 0 ? 1.5 : 1) + '"/>');
      s.push('<text x="' + (左 - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="' + 色.sub + '">' +
        Math.round(v / 10000) + '万</text>');
    }

    /* --- 横軸 --- */
    var 間引き = pts.length > 14 ? 2 : 1;
    pts.forEach(function (p, i) {
      if (i % 間引き !== 0 && i !== pts.length - 1) { return; }
      s.push('<text x="' + X(i).toFixed(1) + '" y="' + (上 + 高 + 16) + '" text-anchor="middle" font-size="11" fill="' + 色.sub + '">' + p.youngestAge + '</text>');
    });
    s.push('<text x="' + (左 + 幅 / 2) + '" y="' + (H - 20) + '" text-anchor="middle" font-size="11" fill="' + 色.sub + '">いちばん下のお子さんの年齢（歳）</text>');
    s.push('<text x="' + 左 + '" y="' + (上 - 4) + '" font-size="11" fill="' + 色.sub + '">たまっていく貯金</text>');

    /* --- 折れ線 --- */
    function 線(key, col, dash, 名) {
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[key]).toFixed(1); }).join(' ');
      s.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' +
        (dash ? ' stroke-dasharray="6 4"' : '') + '/>');
      var 末 = pts.length - 1;
      s.push('<text x="' + (X(末) + 6) + '" y="' + (Y(pts[末][key]) + 4).toFixed(1) + '" font-size="11" font-weight="700" fill="' + col + '">' + 名 + '</text>');
    }
    線('now', 色.withoutProg, true, 'いまのまま');
    線('all', 色.withProg, false, '全部使う');

    if (curve.startSavings > 0) {
      s.push('<circle cx="' + 左 + '" cy="' + Y(curve.startSavings).toFixed(1) + '" r="4" fill="#fff" stroke="' + 色.withProg + '" stroke-width="2"/>');
      s.push('<text x="' + (左 + 7) + '" y="' + (Y(curve.startSavings) - 7).toFixed(1) + '" font-size="10" fill="' + 色.sub + '">いまの貯金</text>');
    }

    pts.forEach(function (p, i) {
      var x0 = X(i) - 幅1 / 2, w = 幅1 || 40;
      s.push('<rect class="hit" x="' + Math.max(左, x0).toFixed(1) + '" y="' + 上 + '" width="' + w.toFixed(1) + '" height="' + 高 +
        '" fill="transparent" style="cursor:crosshair"><title>' +
        'お子さん' + p.youngestAge + '歳／全部使う ' + Math.round(p.all).toLocaleString('ja-JP') + '円・いまのまま ' +
        Math.round(p.now).toLocaleString('ja-JP') + '円' +
        (p.tuition ? '（この年の学校のお金 ' + Math.round(p.tuition).toLocaleString('ja-JP') + '円）' : '') +
        '</title></rect>');
    });

    s.push('</svg>');
    return s.join('');
  }

  function 資産の凡例() {
    return '<div class="legend">' +
      '<span><span class="swatch" style="background:' + 色.withProg + '"></span>使える制度を全部使った場合（実線）</span>' +
      '<span><span class="swatch" style="background:' + 色.withoutProg + '"></span>いまのまま（破線）</span>' +
      '<span><span class="swatch" style="background:' + 色.band + ';height:.7rem;border:1px solid ' + 色.bandLine + '"></span>生活防衛資金のゾーン</span>' +
      '</div>';
  }

  return { 描く: 描く, 表: 表, 凡例: 凡例, 資産を描く: 資産を描く, 資産の凡例: 資産の凡例, 色: 色 };
}));
