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
    bandLine: '#1c7a4a',
    floor: '#a32020',
    training: '#6a4c93'   // 資格を取るルート
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------
   * 目盛りの決め方
   *   1・2・5 に 10 のべき乗をかけた「きりのいい数」から、
   *   目盛りの本数が5本くらいになるものを選びます。
   *   お金のグラフなので、いちばん細かくても1万円きざみにします。
   *   こうすると「12.7万」のような半端な目盛りが出ません。
   * ---------------------------------------------------------- */
  var 目盛りの候補 = [10000, 20000, 50000, 100000, 200000, 500000,
    1000000, 2000000, 5000000, 10000000, 20000000, 50000000];

  function 目盛り幅(範囲, 本数) {
    var n = 本数 || 5;
    for (var i = 0; i < 目盛りの候補.length; i++) {
      if (範囲 / 目盛りの候補[i] <= n) { return 目盛りの候補[i]; }
    }
    return 目盛りの候補[目盛りの候補.length - 1];
  }

  /** 目盛りの値を並べる（きりのいい数だけ。最大5本くらい） */
  function 目盛り一覧(下限, 上限, 本数) {
    var 幅 = 目盛り幅(上限 - 下限, 本数);
    var 出 = [];
    for (var v = Math.ceil(下限 / 幅) * 幅; v <= 上限; v += 幅) { 出.push(v); }
    if (下限 < 0 && 上限 > 0 && 出.indexOf(0) === -1) { 出.push(0); 出.sort(function (a, b) { return a - b; }); }
    return 出;
  }

  /** 目盛りの文字（万円どまり。端数は出さない） */
  function 目盛り文字(v) {
    if (v === 0) { return '0'; }
    var 万 = v / 10000;
    if (Math.abs(万) >= 1000) { return (万 / 1000) + '千万'; }
    return 万 + '万';
  }

  /** 線のはしの名前が重なるとき、上下に離す */
  function ラベルの位置(候補) {
    var 並び = 候補.slice().sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < 並び.length; i++) {
      if (並び[i].y - 並び[i - 1].y < 14) { 並び[i].y = 並び[i - 1].y + 14; }
    }
    return 候補;
  }

  /**
   * 線グラフのSVGを文字列で返す。
   * @param {Array}  years  engine.シミュレーション() の years
   * @param {Array}  cliffs 同 cliffs
   * @param {String} 見方   'perPerson'（ひとりあたりに直した金額。ふだんはこちら）
   *                        または 'total'（家ぜんたいの金額）
   */
  function 描く(years, cliffs, 見方, 縦長) {
    if (!years || !years.length) { return '<p class="hint">お子さんの年齢を入れると、ここにグラフが出ます。</p>'; }
    var 値 = (見方 === 'total') ? 'total' : 'perPerson';
    function V(y, key) { return y[key][値]; }

    /* スマートフォンのように画面が狭いときは、横にはみ出させず、
       そのかわり縦に伸ばして線を読みやすくする */
    var W, H, 左, 右, 上, 下;
    if (縦長) {
      W = 360; H = 470;
      左 = 52; 右 = 58; 上 = 26; 下 = 56;
    } else {
      /* パソコンでも、縦を従来より伸ばす（320→430、約1.34倍）。
         線の傾き・帯・床の関係が読みやすくなるため。
         画面に収まる範囲でとどめる。 */
      W = Math.max(500, 70 + years.length * 42); H = 430;
      左 = 62; 右 = 66; 上 = 24; 下 = 58;
    }
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

    /* --- 横の目盛り線（きりのいい数だけ。5本くらい） --- */
    目盛り一覧(下限, 上限, 6).forEach(function (v) {
      var yy = Y(v);
      s.push('<line x1="' + 左 + '" y1="' + yy.toFixed(1) + '" x2="' + (左 + 幅) + '" y2="' + yy.toFixed(1) +
        '" stroke="' + (v === 0 ? 色.axis : 色.grid) + '" stroke-width="1"/>');
      s.push('<text x="' + (左 - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="' + 色.sub + '">' +
        目盛り文字(v) + '</text>');
    });

    /* --- 制度の崖（たて線）。名前はグラフの外の一覧に出し、線には番号だけ置く。
           番号どうしが近すぎるときは、下の段にずらしてかぶらないようにする --- */
    var 置いた = [];
    (cliffs || []).forEach(function (c, idx) {
      var cx = X(c.offset);
      var 段 = 0;
      while (置いた.some(function (q) { return q.段 === 段 && Math.abs(q.x - cx) < 20; })) { 段++; }
      置いた.push({ x: cx, 段: 段 });
      var cy = 上 + 7 + 段 * 20;
      s.push('<line x1="' + cx.toFixed(1) + '" y1="' + (cy + 8).toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + (上 + 高) +
        '" stroke="' + 色.cliff + '" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.75"/>');
      s.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="8" fill="' + 色.cliff + '"/>');
      s.push('<text x="' + cx.toFixed(1) + '" y="' + (cy + 4).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">' +
        (idx + 1) + '</text>');
    });

    /* --- 横軸 --- */
    s.push('<line x1="' + 左 + '" y1="' + (上 + 高) + '" x2="' + (左 + 幅) + '" y2="' + (上 + 高) + '" stroke="' + 色.axis + '" stroke-width="1"/>');
    var 間引き = 縦長 ? Math.max(1, Math.ceil(years.length / 6)) : (years.length > 14 ? 2 : 1);
    years.forEach(function (y, i) {
      if (i % 間引き !== 0 && i !== years.length - 1) { return; }
      s.push('<text x="' + X(i).toFixed(1) + '" y="' + (上 + 高 + 17) + '" text-anchor="middle" font-size="12" fill="' + 色.sub + '">' + y.youngestAge + '</text>');
    });
    s.push('<text x="' + (左 + 幅 / 2) + '" y="' + (H - 18) + '" text-anchor="middle" font-size="12" fill="' + 色.sub + '">いちばん下のお子さんの年齢（歳）</text>');
    s.push('<text x="' + 左 + '" y="' + (上 - 8) + '" font-size="12" fill="' + 色.sub + '">' +
      (値 === 'total' ? '家ぜんたいで、ひと月に使えるお金' : 'ひとりあたりに直した、ひと月のお金') + '</text>');

    /* --- 折れ線 --- */
    function 線(key, col, dash) {
      var d = years.map(function (y, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(V(y, key)).toFixed(1); }).join(' ');
      s.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' +
        (dash ? ' stroke-dasharray="6 4"' : '') + '/>');
      years.forEach(function (y, i) {
        if (i % 間引き !== 0 && i !== years.length - 1) { return; }
        s.push('<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(V(y, key)).toFixed(1) + '" r="' + (縦長 ? 2.8 : 3.2) +
          '" fill="' + col + '" stroke="#fff" stroke-width="2"/>');
      });
    }
    線('married', 色.married, true);
    線('divorced', 色.divorced, false);

    /* --- 線のはしに名前を直接書く（重なるときは上下に離す） --- */
    var 末 = years.length - 1;
    ラベルの位置([
      { y: Y(V(years[末], 'married')) + 4, col: 色.married, 名: '続ける' },
      { y: Y(V(years[末], 'divorced')) + 4, col: 色.divorced, 名: '離婚' }
    ]).forEach(function (L) {
      s.push('<text x="' + (X(末) + 7) + '" y="' + L.y.toFixed(1) + '" font-size="12" font-weight="700" fill="' + L.col + '">' + L.名 + '</text>');
    });

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
  function 資産を描く(curve, 縦長) {
    if (!curve || !curve.points.length) { return '<p class="hint">毎月の生活費を入れると、ここにグラフが出ます。</p>'; }
    var pts = curve.points;

    var tr = curve.training;
    var 描く数 = (curve.drawUntilOffset != null ? curve.drawUntilOffset : pts.length - 1) + 1;
    /* 資格を取るルートは、いまのままの線より先まで見せたい（そこに希望があるので）。
       ただし借りられる上限にぶつかったら、そこで止める。 */
    var 資格描く数 = tr
      ? ((tr.hitsBorrowFloorAtOffset !== null) ? tr.hitsBorrowFloorAtOffset + 1 : tr.points.length)
      : 0;
    if (tr) { 描く数 = Math.max(描く数, Math.min(資格描く数, pts.length)); }
    var W, H, 左, 右, 上, 下;
    if (縦長) {
      W = 360; H = 470;
      左 = 56; 右 = 60; 上 = 26; 下 = 56;
    } else {
      W = Math.max(500, 70 + pts.length * 42); H = 430;
      左 = 66; 右 = 74; 上 = 24; 下 = 58;
    }
    var 幅 = W - 左 - 右, 高 = H - 上 - 下;

    /* 借りられる上限より下は、実在しない金額。線もそこで止める（床にはりつく） */
    function 床(v) {
      return (curve.borrowFloor != null && v < curve.borrowFloor) ? curve.borrowFloor : v;
    }
    var 全値 = [0, curve.safetyMax, curve.startSavings];
    pts.slice(0, 描く数).forEach(function (p) { 全値.push(床(p.all), 床(p.now)); });
    if (tr) { tr.points.slice(0, 資格描く数).forEach(function (p) { 全値.push(床(p.all)); }); }
    var 上限 = Math.max.apply(null, 全値), 下限 = Math.min.apply(null, 全値);
    var 余白 = Math.max((上限 - 下限) * 0.1, 100000);
    上限 += 余白; 下限 -= 余白;
    /* 借りられる上限（年収の3分の1）より下は、実在しない金額なので目盛りも出さない */
    if (curve.borrowFloor != null && 下限 < curve.borrowFloor) {
      下限 = curve.borrowFloor - Math.max((上限 - curve.borrowFloor) * 0.06, 30000);
    }

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
        '">' + (縦長 ? 'まずここまで貯める' : 'まずここまで貯める（生活費の3〜6か月分）') + '</text>');
    }

    /* --- 横の目盛り線（きりのいい数だけ。5本くらい） --- */
    目盛り一覧(下限, 上限, 6).forEach(function (v) {
      var yy = Y(v);
      s.push('<line x1="' + 左 + '" y1="' + yy.toFixed(1) + '" x2="' + (左 + 幅) + '" y2="' + yy.toFixed(1) +
        '" stroke="' + (v === 0 ? '#8899a6' : 色.grid) + '" stroke-width="' + (v === 0 ? 1.5 : 1) + '"/>');
      s.push('<text x="' + (左 - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="' + 色.sub + '">' +
        目盛り文字(v) + '</text>');
    });

    /* --- 借りられる上限（貸金業法の総量規制）の線 --- */
    if (curve.borrowFloor != null && curve.borrowFloor >= 下限 && curve.borrowFloor <= 上限) {
      var fy = Y(curve.borrowFloor);
      s.push('<line x1="' + 左 + '" y1="' + fy.toFixed(1) + '" x2="' + (左 + 幅) + '" y2="' + fy.toFixed(1) +
        '" stroke="' + 色.floor + '" stroke-width="2" stroke-dasharray="7 4"/>');
      /* 線のはしの名前とかぶらないよう、破線の上に置く */
      s.push('<text x="' + (左 + 4) + '" y="' + (fy - 6).toFixed(1) + '" font-size="11" font-weight="700" fill="' + 色.floor +
        '">' + (縦長 ? 'これ以上は借りられません' : '法律上、これ以上は借りられません（' + esc(curve.borrowFloorLabel || '年収の3分の1') + '）') + '</text>');
    }

    /* --- このままの前提では成り立たない領域（網かけ） --- */
    if (curve.truncated) {
      var 網x = X(描く数 - 1);
      s.push('<defs><pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
        '<line x1="0" y1="0" x2="0" y2="7" stroke="#b7c2cc" stroke-width="2"/></pattern></defs>');
      s.push('<rect x="' + 網x.toFixed(1) + '" y="' + 上 + '" width="' + (左 + 幅 - 網x).toFixed(1) + '" height="' + 高 +
        '" fill="url(#hatch)" opacity="0.35"/>');
      /* 網かけの幅がせまいときは、文字が右にはみ出すので出さない（説明はグラフの下に置く） */
      var 網幅 = 左 + 幅 - 網x;
      if (網幅 >= 90) {
        s.push('<text x="' + (網x + 8).toFixed(1) + '" y="' + (上 + 高 / 2 - 6) + '" font-size="11" font-weight="700" fill="#52616f">この先は</text>');
        s.push('<text x="' + (網x + 8).toFixed(1) + '" y="' + (上 + 高 / 2 + 9) + '" font-size="11" font-weight="700" fill="#52616f">描いていません</text>');
      } else if (網幅 >= 40) {
        s.push('<text x="' + (網x + 6).toFixed(1) + '" y="' + (上 + 高 / 2) + '" font-size="10" font-weight="700" fill="#52616f">この先は</text>');
        s.push('<text x="' + (網x + 6).toFixed(1) + '" y="' + (上 + 高 / 2 + 13) + '" font-size="10" font-weight="700" fill="#52616f">なし</text>');
      }
    }

    /* --- 横軸 --- */
    var 間引き = 縦長 ? Math.max(1, Math.ceil(pts.length / 6)) : (pts.length > 14 ? 2 : 1);
    pts.forEach(function (p, i) {
      if (i % 間引き !== 0 && i !== pts.length - 1) { return; }
      s.push('<text x="' + X(i).toFixed(1) + '" y="' + (上 + 高 + 17) + '" text-anchor="middle" font-size="12" fill="' + 色.sub + '">' + p.youngestAge + '</text>');
    });
    s.push('<text x="' + (左 + 幅 / 2) + '" y="' + (H - 18) + '" text-anchor="middle" font-size="12" fill="' + 色.sub + '">いちばん下のお子さんの年齢（歳）</text>');
    s.push('<text x="' + 左 + '" y="' + (上 - 8) + '" font-size="12" fill="' + 色.sub + '">たまっていく貯金</text>');

    /* --- 折れ線 --- */
    var 末 = 描く数 - 1;
    function 線(key, col, dash) {
      var d = pts.slice(0, 描く数).map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(床(p[key])).toFixed(1); }).join(' ');
      s.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' +
        (dash ? ' stroke-dasharray="6 4"' : '') + '/>');
    }
    線('now', 色.withoutProg, true);
    線('all', 色.withProg, false);

    /* --- 資格を取るルート --- */
    var ラベル = [
      { y: Y(床(pts[末].now)) + 4, col: 色.withoutProg, 名: 'いまのまま' },
      { y: Y(床(pts[末].all)) + 4, col: 色.withProg, 名: '全部使う' }
    ];
    if (tr && 資格描く数 > 0) {
      var td = tr.points.slice(0, 資格描く数).map(function (p, i) {
        return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(床(p.all)).toFixed(1);
      }).join(' ');
      s.push('<path d="' + td + '" fill="none" stroke="' + 色.training +
        '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>');
      /* 学校に通っている期間を、たての帯で示す。
         期間の情報なので、ラベルはグラフの上のほうに置く。
         下のほう（生活防衛資金の帯・借りられる上限の線・網かけ）は
         「金額のしきい目」の情報なので、ぶつからないように上下で分けている。 */
      if (tr.years > 0) {
        var tx = X(Math.min(tr.years, 資格描く数 - 1));
        s.push('<rect x="' + 左 + '" y="' + 上 + '" width="' + Math.max(0, tx - 左).toFixed(1) + '" height="' + 高 +
          '" fill="' + 色.training + '" opacity="0.09"/>');
        s.push('<line x1="' + tx.toFixed(1) + '" y1="' + 上 + '" x2="' + tx.toFixed(1) + '" y2="' + (上 + 高) +
          '" stroke="' + 色.training + '" stroke-width="1" stroke-dasharray="2 3" opacity="0.55"/>');
        s.push('<text x="' + (左 + 4) + '" y="' + (上 + 13) + '" font-size="11" font-weight="700" fill="' + 色.training +
          '">' + (縦長 ? '通学' + tr.years + '年' : '学校に通う期間（' + tr.years + '年）') + '</text>');

        /* 修了した時点に、小さな印をつける */
        if (tr.years < 資格描く数) {
          var my = Y(床(tr.points[tr.years - 1].all));
          s.push('<circle cx="' + tx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="4.5" fill="#fff" stroke="' +
            色.training + '" stroke-width="2.5"/>');
          if (!縦長) {
            s.push('<text x="' + (tx + 5).toFixed(1) + '" y="' + (上 + 27) + '" font-size="10" font-weight="700" fill="' +
              色.training + '">▲資格取得</text>');
          }
        }
      }
      /* 追い越す地点に印をつける */
      if (tr.crossoverOffset !== null && tr.crossoverOffset < 資格描く数) {
        var cx2 = X(tr.crossoverOffset), cy2 = Y(床(tr.points[tr.crossoverOffset].all));
        s.push('<circle cx="' + cx2.toFixed(1) + '" cy="' + cy2.toFixed(1) + '" r="6" fill="none" stroke="' + 色.training + '" stroke-width="2.5"/>');
      }
      ラベル.push({ y: Y(床(tr.points[資格描く数 - 1].all)) + 4, col: 色.training, 名: '資格を取る', x: X(資格描く数 - 1) });
    }
    ラベルの位置(ラベル).forEach(function (L) {
      var 基点 = (L.x != null) ? L.x : X(末);
      var 右寄せ = (基点 > 左 + 幅 * 0.72);
      var x = 右寄せ ? Math.min(基点 - 4, 左 + 幅) : 基点 + 7;
      s.push('<text x="' + x.toFixed(1) + '" y="' + L.y.toFixed(1) + '" font-size="12" font-weight="700" fill="' + L.col +
        '" text-anchor="' + (右寄せ ? 'end' : 'start') + '">' + L.名 + '</text>');
    });

    if (curve.startSavings > 0) {
      var sy = Y(curve.startSavings);
      s.push('<circle cx="' + 左 + '" cy="' + sy.toFixed(1) + '" r="4" fill="#fff" stroke="' + 色.withProg + '" stroke-width="2"/>');
      /* 文字は、グラフの中ではなく上のヘッダーの行に置く。
         中に置くと、帯や床や訓練期間の文とかぶるため。 */
      var ラベルx = 縦長 ? (左 + 4) : (左 + 116);
      var ラベルy = 縦長 ? (上 - 26) : (上 - 12);
      s.push('<circle cx="' + ラベルx + '" cy="' + ラベルy + '" r="4" fill="#fff" stroke="' + 色.withProg + '" stroke-width="2"/>');
      s.push('<text x="' + (ラベルx + 8) + '" y="' + (ラベルy + 4) + '" font-size="11" fill="' + 色.sub + '">いまの貯金 ' +
        Math.round(curve.startSavings).toLocaleString('ja-JP') + '円</text>');
    }

    pts.slice(0, 描く数).forEach(function (p, i) {
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

  function 資産の凡例(資格あり) {
    return '<div class="legend">' +
      '<span><span class="swatch" style="background:' + 色.withProg + '"></span>使える制度を全部使った場合（実線）</span>' +
      '<span><span class="swatch" style="background:' + 色.withoutProg + '"></span>いまのまま（破線）</span>' +
      '<span><span class="swatch" style="background:' + 色.band + ';height:.7rem;border:1px solid ' + 色.bandLine + '"></span>生活防衛資金のゾーン</span>' +
      (資格あり ? '<span><span class="swatch" style="background:' + 色.training + '"></span>資格を取るルート（太い実線）</span>' : '') +
      '</div>';
  }

  return { 描く: 描く, 表: 表, 凡例: 凡例, 資産を描く: 資産を描く, 資産の凡例: 資産の凡例, 色: 色 };
}));
