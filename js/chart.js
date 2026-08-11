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
    withProg: '#2f6f9f',    // 制度活用
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

  /* ------------------------------------------------------------
   * グラフの中に置く注記の文字を、重ならないように並べる。
   *   置きたい場所（y）を希望として受け取り、
   *   先に置いたものとぶつかるときだけ、上下にずらす。
   *   大事なものから先に置くので、大事なものは希望どおりの場所に残る。
   * ---------------------------------------------------------- */
  function 文字幅(文, サイズ) {
    var w = 0;
    for (var i = 0; i < 文.length; i++) { w += (/[\x20-\x7e]/.test(文[i]) ? 0.6 : 1.0) * サイズ; }
    return w;
  }

  function 注記を並べる(一覧, 上端, 下端) {
    var 置いた = [];
    一覧.forEach(function (a) {
      var サイズ = a.size || 10;
      var w = 文字幅(a.text, サイズ);
      var x1 = (a.anchor === 'middle') ? a.x - w / 2 : (a.anchor === 'end') ? a.x - w : a.x;
      var x2 = x1 + w;
      function ぶつかる(y) {
        return 置いた.some(function (q) {
          return Math.abs(q.y - y) < Math.min(q.size, サイズ) * 1.05 && x1 < q.x2 - 1 && q.x1 < x2 - 1;
        });
      }
      var y = a.y, 段 = 0;
      while (ぶつかる(y) && 段 < 12) {
        段++;
        var 下 = a.y + 段 * 13, 上へ = a.y - 段 * 13;
        if (下 <= 下端 && !ぶつかる(下)) { y = 下; break; }
        if (上へ >= 上端 && !ぶつかる(上へ)) { y = 上へ; break; }
        y = 下;
      }
      a.y = Math.min(Math.max(y, 上端), 下端);
      置いた.push({ x1: x1, x2: x2, y: a.y, size: サイズ });
    });
    return 一覧;
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
  /* 「いまのまま」と「制度活用」が、ほとんど重なるか。
     重なった線を2本描くと、にじんで読めなくなるだけなので、その場合は1本にする。 */
  function 一本にまとめるか(curve) {
    if (!curve || !curve.points || !curve.points.length) { return true; }
    var 数 = (curve.drawUntilOffset != null ? curve.drawUntilOffset : curve.points.length - 1) + 1;
    var 値 = [0, curve.safetyTarget, curve.startSavings], 最大差 = 0;
    curve.points.slice(0, 数).forEach(function (p) {
      値.push(p.all, p.now);
      最大差 = Math.max(最大差, Math.abs(p.all - p.now));
    });
    var 幅 = Math.max.apply(null, 値) - Math.min.apply(null, 値);
    if (幅 <= 0) { return true; }
    return (最大差 / 幅) < 0.02;   /* 縦の目盛りはばの2%未満しか離れていなければ、1本にする */
  }

  function 資産を描く(curve, 縦長, カーソル年) {
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
    var 全値 = [0, curve.startSavings];
    var 月列 = curve.monthly || [];
    var 月数見込み = Math.min(月列.length, (描く数 - 1) * 12 + 1);
    月列.slice(0, 月数見込み).forEach(function (q) {
      全値.push(床(q.all), 床(q.now), q.target);
    });
    if (!月列.length) { pts.slice(0, 描く数).forEach(function (p) { 全値.push(床(p.all), 床(p.now)); }); }
    if (tr && tr.monthly) {
      var 資格月数 = Math.min(tr.monthly.length, (資格描く数 - 1) * 12 + 1);
      tr.monthly.slice(0, 資格月数).forEach(function (q) { 全値.push(床(q.all)); });
    }
    var 上限 = Math.max.apply(null, 全値), 下限 = Math.min.apply(null, 全値);
    var 余白 = Math.max((上限 - 下限) * 0.1, 100000);
    上限 += 余白; 下限 -= 余白;
    /* 借りられる上限（年収の3分の1）より下は、実在しない金額なので目盛りも出さない */
    if (curve.borrowFloor != null && 下限 < curve.borrowFloor) {
      /* 床から下を赤く塗るので、塗りが見える程度の余白をとる */
      下限 = curve.borrowFloor - Math.max((上限 - curve.borrowFloor) * 0.10, 40000);
    }

    var 幅1 = pts.length > 1 ? 幅 / (pts.length - 1) : 0;
    function X(i) { return 左 + 幅1 * i; }
    /* 月ごとの位置。12か月で1年ぶん進む */
    function Xm(m) { return 左 + 幅1 * (m / 12); }
    function Y(v) { return 上 + 高 - (v - 下限) / (上限 - 下限) * 高; }
    /* 描くのは、打ち切りの年までの月ぶん */
    var 描く月数 = Math.min((curve.monthly || []).length, (描く数 - 1) * 12 + 1);

    var s = [];
    /* グラフの中に置く文字は、いったんためておいて、最後に重ならないよう並べてから描く。
       大事なものから順に入れる。 */
    var 注記 = [];
    function 注記追加(text, x, y, anchor, fill, size, 優先, クラス, 引き出し) {
      注記.push({ text: text, x: x, y: y, anchor: anchor || 'start', fill: fill,
        size: size || 10, pri: (優先 == null ? 50 : 優先), cls: クラス || null,
        leader: 引き出し || null });
    }
    var 一本 = 一本にまとめるか(curve);
    s.push('<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="貯金のたまり方の見通し。生活防衛資金の線と、借りられる上限つき">');

    /* --- 生活防衛資金（生活費の半年分）の線 ---
           帯にすると、データの線と紛れて読みにくいので、1本の線にする。
           生活費はお子さんの成長で上がるので、この線も右肩上がりになる。 */
    if (curve.safetyTarget > 0) {
      var ys;
      if (月列.length) {
        var 目標線 = 月列.slice(0, 描く月数).map(function (q, k) {
          return (k ? 'L' : 'M') + Xm(k).toFixed(1) + ' ' + Y(q.target).toFixed(1);
        }).join(' ');
        s.push('<path d="' + 目標線 + '" fill="none" stroke="' + 色.bandLine + '" stroke-width="1.5"/>');
        ys = Y(月列[0].target);
      } else {
        ys = Y(curve.safetyTarget);
        s.push('<line x1="' + 左 + '" y1="' + ys.toFixed(1) + '" x2="' + (左 + 幅) + '" y2="' + ys.toFixed(1) +
          '" stroke="' + 色.bandLine + '" stroke-width="1.5"/>');
      }
      /* 上のほうは、大事な地点の文字を並べる場所として空けておく。
         線がそこにかかるときは、文字を線の下に回す。 */
      var 目標額 = Math.round((月列.length ? 月列[0].target : curve.safetyTarget) / 10000);
      注記追加((縦長 ? '生活防衛資金 ' + 目標額 + '万円'
        : '生活防衛資金 ' + 目標額 + '万円（生活費の半年分）'), 左 + 4, ys - 5, 'start', 色.bandLine, 10, 40);
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
    /* --- 0円より下は2段階に分ける ---
           0円から借入上限まで: 借金でしのいでいる領域（うすい赤）
           借入上限より下: 法律上も借りられない領域（濃い赤） */
    var zy = Y(0);
    var 床y = (curve.borrowFloor != null) ? Y(curve.borrowFloor) : (上 + 高);
    if (zy < 上 + 高) {
      var 借金の下 = Math.min(床y, 上 + 高);
      if (借金の下 > zy) {
        s.push('<rect x="' + 左 + '" y="' + zy.toFixed(1) + '" width="' + 幅 + '" height="' +
          (借金の下 - zy).toFixed(1) + '" fill="' + 色.floor + '" opacity="0.07"/>');
        if (借金の下 - zy > 22) {
          注記追加((縦長 ? '借金になる' : 'ここから下は借金になります'),
            左 + 幅 - 4, zy + 14, 'end', 色.floor, 10, 46);
        }
      }
    }
    if (curve.borrowFloor != null && curve.borrowFloor >= 下限 && curve.borrowFloor <= 上限) {
      var fy = Y(curve.borrowFloor);
      /* 床から下は「そもそも存在しない金額」なので、濃く塗ってしまう */
      s.push('<rect x="' + 左 + '" y="' + fy.toFixed(1) + '" width="' + 幅 + '" height="' +
        Math.max(0, (上 + 高) - fy).toFixed(1) + '" fill="' + 色.floor + '" opacity="0.20"/>');
      /* 塗りの上のふちとして、細い実線。データの線と紛れないよう点線にはしない */
      s.push('<line x1="' + 左 + '" y1="' + fy.toFixed(1) + '" x2="' + (左 + 幅) + '" y2="' + fy.toFixed(1) +
        '" stroke="' + 色.floor + '" stroke-width="1.5"/>');
      /* ラベルは、赤く塗った領域の中（左下）に置く。
         データの線のはしの名前は右寄り・床の高さ付近に出るので、そこから離す。 */
      注記追加((縦長 ? 'これ以上は借りられません' : '法律上、これ以上は借りられません（' + esc(curve.borrowFloorLabel || '年収の3分の1') + '）'),
        左 + 幅 - 4, 上 + 高 - 5, 'end', 色.floor, 11, 45);
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
        注記追加('この先は', 網x + 8, 上 + 高 / 2 - 6, 'start', '#52616f', 11, 70);
        注記追加('描いていません', 網x + 8, 上 + 高 / 2 + 9, 'start', '#52616f', 11, 71);
      } else if (網幅 >= 40) {
        注記追加('この先は', 網x + 6, 上 + 高 / 2, 'start', '#52616f', 10, 70);
        注記追加('なし', 網x + 6, 上 + 高 / 2 + 13, 'start', '#52616f', 10, 71);
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
    function 線(key, col, dash, 太さ, 濃さ) {
      var 元 = 月列.length ? 月列.slice(0, 描く月数) : pts.slice(0, 描く数);
      var 目盛 = 月列.length ? Xm : X;
      var d = 元.map(function (p, i) { return (i ? 'L' : 'M') + 目盛(i).toFixed(1) + ' ' + Y(床(p[key])).toFixed(1); }).join(' ');
      s.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (太さ || 2) +
        '" stroke-linejoin="round" stroke-linecap="round"' +
        (濃さ != null && 濃さ < 1 ? ' opacity="' + 濃さ + '"' : '') +
        (dash ? ' stroke-dasharray="6 4"' : '') + '/>');
    }
    /* ほとんど重なるなら、1本だけ描く（重なった線を2本置かない） */
    if (!一本) { 線('now', 色.withoutProg, true, 1.6, 0.8); }
    線('all', 色.withProg, false, 2.5, 1);

    /* --- 資格を取るルート --- */
    /* 線のはしの名前は、いちばん下（床のラベルを置く帯）には入れない */
    var 下限y = 上 + 高 - 24;
    function 収める(v) { return Math.min(Math.max(v, 上 + 10), 下限y); }
    var 末の値 = 月列.length ? 月列[描く月数 - 1] : pts[末];
    var 末x = 月列.length ? Xm(描く月数 - 1) : X(末);
    var ラベル = 一本
      ? [{ y: 収める(Y(床(末の値.all)) + 4), col: 色.withProg, 名: 'いまの見通し', x: 末x }]
      : [
        { y: 収める(Y(床(末の値.now)) + 4), col: 色.withoutProg, 名: 'いまのまま', x: 末x },
        { y: 収める(Y(床(末の値.all)) + 4), col: 色.withProg, 名: '制度活用', x: 末x }
      ];
    if (tr && 資格描く数 > 0) {
      /* 線の長さをだいたい測っておく。
         「左から伸びる」動きをCSSでつけるのに、長さが要るため。 */
      var 資格月数 = tr.monthly ? Math.min(tr.monthly.length, (資格描く数 - 1) * 12 + 1) : 0;
      var 点列 = 資格月数
        ? tr.monthly.slice(0, 資格月数).map(function (q, k) { return { x: Xm(k), y: Y(床(q.all)) }; })
        : tr.points.slice(0, 資格描く数).map(function (p, i) { return { x: X(i), y: Y(床(p.all)) }; });
      var td = 点列.map(function (q, i) {
        return (i ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1);
      }).join(' ');
      var 長さ = 0;
      for (var li = 1; li < 点列.length; li++) {
        長さ += Math.sqrt(Math.pow(点列[li].x - 点列[li - 1].x, 2) + Math.pow(点列[li].y - 点列[li - 1].y, 2));
      }
      長さ = Math.ceil(長さ) + 2;
      s.push('<path d="' + td + '" fill="none" stroke="' + 色.training +
        '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"' +
        (tr.animate ? ' class="draw-in" style="stroke-dasharray:' + 長さ + ';stroke-dashoffset:' + 長さ + '"' : '') +
        '/>');
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
        注記追加((縦長 ? '通学' + tr.years + '年' : '学校に通う期間（' + tr.years + '年）'),
          左 + 4, 上 + 13, 'start', 色.training, 11, 60, (tr.animate ? 'fade-in' : null));

        /* 資格を取る時点は、帯の右はし（破線）が示しているので、
           そこに印や文字はもう置かない。 */
      }
      /* 追い越す地点に印をつける */
      if (tr.crossoverOffset !== null && tr.crossoverOffset < 資格描く数) {
        var cx2 = X(tr.crossoverOffset), cy2 = Y(床(tr.points[tr.crossoverOffset].all));
        s.push('<circle cx="' + cx2.toFixed(1) + '" cy="' + cy2.toFixed(1) + '" r="6" fill="none" stroke="' + 色.training + '" stroke-width="2.5"/>');
      }
      ラベル.push({ y: 収める(点列[点列.length - 1].y + 4), col: 色.training, 名: '資格を取る',
        x: 点列[点列.length - 1].x });
    }
    ラベル.forEach(function (L) {
      var 基点 = (L.x != null) ? L.x : X(末);
      var 右寄せ = (基点 > 左 + 幅 * 0.72);
      var x = 右寄せ ? Math.min(基点 - 4, 左 + 幅) : 基点 + 7;
      注記追加(L.名, x, L.y, (右寄せ ? 'end' : 'start'), L.col, 12, 30);
    });

    /* --- いま見ている年のカーソル線 --- */
    /* 線を途中で打ち切っていても、横軸は最後の年まであるので、
       カーソルはどの年にも置ける */
    if (カーソル年 != null && カーソル年 >= 0 && カーソル年 < pts.length) {
      var kx = X(カーソル年);
      s.push('<line x1="' + kx.toFixed(1) + '" y1="' + 上 + '" x2="' + kx.toFixed(1) + '" y2="' + (上 + 高) +
        '" stroke="#33414f" stroke-width="1.5" opacity="0.45"/>');
      s.push('<circle cx="' + kx.toFixed(1) + '" cy="' + (上 + 高) + '" r="3.5" fill="#33414f" opacity="0.7"/>');
    }

    /* --- 大事な地点の印 ---
       ・貯金が0円を割るところ（底をつく）
       ・借りられる上限に当たるところ（本当に打つ手がなくなる点）
       資格を取るルートを出して、そちらで底をつかなくなる場合は、印を消す。
       「この道なら、そこには行かない」ことを絵で伝えるため。 */
    var 印を出す = !(tr && tr.afterIncome > 0 && !tr.goesNegative);
    var 印の段 = 0;
    if (印を出す) {
      /* 印は「いまのまま」の線に打つ。
         いま何もしなかったらいつ危なくなるか、を指すものだから。
         （制度活用の線に打つと、何の話なのかが伝わらない） */
      印(一本 ? curve.negativeFromMonth : curve.negativeFromMonthNow, '底をつく');
      印(一本 ? curve.hitsBorrowFloorAtMonth : curve.hitsBorrowFloorAtMonthNow, '借りられる上限');
    }
    /** 月の位置に印を打つ（年の折れ線だと、底をつく場所が最大1年ずれて見えるため） */
    function 印(月番号, 名) {
      if (月番号 == null || 月番号 < 0 || !月列.length || 月番号 >= 描く月数) { return; }
      var mx = Xm(月番号), my = Y(床(一本 ? 月列[月番号].all : 月列[月番号].now));
      /* 印はひし形。データの線や点と形で区別できるようにする */
      s.push('<path d="M ' + mx.toFixed(1) + ' ' + (my - 6.5).toFixed(1) +
        ' L ' + (mx + 6.5).toFixed(1) + ' ' + my.toFixed(1) +
        ' L ' + mx.toFixed(1) + ' ' + (my + 6.5).toFixed(1) +
        ' L ' + (mx - 6.5).toFixed(1) + ' ' + my.toFixed(1) + ' Z" fill="' + 色.floor +
        '" stroke="#fff" stroke-width="1.5"/>');
      /* 文字は上のあいたところに置き、細い線で印までつなぐ。
         印が左のほうに寄っているときは、文字を右へずらして引き出す
         （左はしに文字がかたまると読めなくなるため）。 */
      var ty = 上 + 26 + 印の段 * 14;
      印の段++;
      var 幅目安 = 名.length * 10;
      var 左寄り = (mx < 左 + 幅 / 3);
      var tx, 寄せ;
      if (左寄り) {
        寄せ = 'start';
        tx = Math.min(mx + 26, 左 + 幅 - 幅目安 - 2);
        if (tx < mx + 10) { tx = Math.max(左 + 2, 左 + 幅 - 幅目安 - 2); }
      } else {
        寄せ = 'middle';
        tx = Math.min(Math.max(mx, 左 + 幅目安 / 2 + 2), 左 + 幅 - 幅目安 / 2 - 2);
      }
      注記追加(名, tx, ty, 寄せ, 色.floor, 10, 10, null, { mx: mx, my: my, 左寄り: 左寄り });
    }

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
        'お子さん' + p.youngestAge + '歳／' +
        (一本 ? Math.round(p.all).toLocaleString('ja-JP') + '円'
              : '制度活用 ' + Math.round(p.all).toLocaleString('ja-JP') + '円・いまのまま ' +
                Math.round(p.now).toLocaleString('ja-JP') + '円') +
        (p.tuition ? '（この年の学校のお金 ' + Math.round(p.tuition).toLocaleString('ja-JP') + '円）' : '') +
        '</title></rect>');
    });

    /* ためておいた注記を、大事なものから順に、重ならないよう並べて描く */
    注記.sort(function (a, b) { return a.pri - b.pri; });
    注記を並べる(注記, 上 + 11, 上 + 高 - 4).forEach(function (a) {
      if (a.leader) {
        /* 文字の位置が決まってから、印まで線を引く */
        var lx = a.leader.左寄り ? (a.x - 5) : a.x;
        s.push('<path d="M' + lx.toFixed(1) + ' ' + (a.y - 3).toFixed(1) +
          ' L' + a.leader.mx.toFixed(1) + ' ' + (a.y - 3).toFixed(1) +
          ' L' + a.leader.mx.toFixed(1) + ' ' + (a.leader.my - 7).toFixed(1) +
          '" fill="none" stroke="' + 色.floor + '" stroke-width="1" opacity="0.5"/>');
      }
      s.push('<text x="' + a.x.toFixed(1) + '" y="' + a.y.toFixed(1) + '" font-size="' + a.size +
        '" font-weight="700" fill="' + a.fill + '"' +
        (a.anchor !== 'start' ? ' text-anchor="' + a.anchor + '"' : '') +
        (a.cls ? ' class="' + a.cls + '"' : '') + '>' + a.text + '</text>');
    });

    s.push('</svg>');
    return s.join('');
  }

  function 資産の凡例(資格あり, 一本) {
    var h = ['<div class="legend">'];
    if (一本) {
      h.push('<span><span class="swatch" style="background:' + 色.withProg + '"></span>いまの見通し（実線）</span>');
    } else {
      h.push('<span><span class="swatch" style="background:' + 色.withProg + '"></span>制度活用（太い実線）</span>');
      h.push('<span><span class="swatch" style="background:' + 色.withoutProg + ';opacity:.8"></span>いまのまま（細い破線）</span>');
    }
    h.push('<span><span class="swatch" style="background:' + 色.bandLine + '"></span>生活防衛資金（生活費の半年分）</span>');
    h.push('<span><span class="swatch" style="background:' + 色.floor + ';opacity:.22"></span>ここから下は借金になる</span>');
    h.push('<span><span class="swatch" style="background:' + 色.floor + ';opacity:.55"></span>借りることもできない</span>');
    if (資格あり) {
      h.push('<span><span class="swatch" style="background:' + 色.training + '"></span>資格を取るルート（太い実線）</span>');
    }
    h.push('</div>');
    return h.join('');
  }

  return { 描く: 描く, 表: 表, 凡例: 凡例, 資産を描く: 資産を描く, 資産の凡例: 資産の凡例,
    一本にまとめるか: 一本にまとめるか, 色: 色 };
}));
