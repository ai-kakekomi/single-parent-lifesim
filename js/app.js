/* ============================================================
 * app.js  画面のうごき
 * ============================================================ */
(function () {
  'use strict';

  var データ = null, 見本 = null, 落とし穴 = null;
  var 最新入力 = null, 最新判定 = null, 最新シミュ = null;
  var 最新資産 = null;
  var グラフの見方 = 'perPerson';   // 'perPerson' ひとりあたり ／ 'total' 家ぜんたい

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function 数(id) {
    var el = $(id); if (!el) { return 0; }
    var v = parseFloat(String(el.value).replace(/[^\d.-]/g, ''));
    return isFinite(v) ? Math.max(0, v) : 0;
  }
  function 選択(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  /* ---------- 退避ボタン ---------- */
  function 退避() {
    try { window.location.replace('https://weather.yahoo.co.jp/weather/'); }
    catch (e) { window.location.href = 'https://weather.yahoo.co.jp/weather/'; }
  }

  /* ---------- データの読み込み ----------
     制度データは、この画面と一緒に読み込まれています（index.html の下のほうを見てください）。
     通信は一切していません。だから、インターネットにつながっていなくても、
     ファイルをダブルクリックして開くだけでも動きます。 */
  function 読み込む() {
    データ = window.SPS_DATA_PROGRAMS;
    見本 = window.SPS_DATA_SAMPLES;
    落とし穴 = window.SPS_DATA_PITFALLS;
    if (!データ || !見本 || !落とし穴) {
      throw new Error('制度データが読み込まれていません');
    }
    データ.programs_by_id = {};
    データ.programs.forEach(function (p) { データ.programs_by_id[p.id] = p; });
  }

  /* ---------- 子どもの年齢の入力欄 ---------- */
  function 子ども欄を作る(人数, 年齢たち) {
    var box = $('children-box');
    box.innerHTML = '';
    for (var i = 0; i < 人数; i++) {
      var v = (年齢たち && 年齢たち[i] != null) ? 年齢たち[i] : '';
      var d = document.createElement('div');
      d.className = 'child-row';
      d.innerHTML = '<span class="child-label">' + (i + 1) + '人目</span>' +
        '<input type="number" min="0" max="30" inputmode="numeric" id="child-age-' + i + '" value="' + esc(v) + '" placeholder="年齢">' +
        '<span class="child-label" style="flex:0 0 2rem">歳</span>';
      box.appendChild(d);
    }
  }
  function 子どもの年齢たち() {
    var n = parseInt($('child-count').value, 10) || 0, out = [];
    for (var i = 0; i < n; i++) {
      var el = $('child-age-' + i);
      var v = el ? parseInt(el.value, 10) : NaN;
      if (isFinite(v) && v >= 0) { out.push(v); }
    }
    return out;
  }

  /* ---------- すでに使っている制度 ---------- */
  var 申告できる制度 = ['jido_fuyo_teate', 'jido_teate', 'hitorioya_kojo',
    'shugaku_enjo', 'koukou_shugaku_shienkin', 'koutou_kyoiku_shugaku_shien',
    'kokuho_gengaku', 'nenkin_menjo', 'jukyo_kakuho_kyufukin'];

  function 使っている制度欄を作る() {
    $('used-programs').innerHTML = 申告できる制度.map(function (id) {
      var p = データ.programs_by_id[id];
      if (!p) { return ''; }
      return '<label><input type="checkbox" class="used-prog" value="' + esc(id) + '">' + esc(p.name.replace(/（.*$/, '')) + '</label>';
    }).join('');
  }
  function 使っている制度() {
    return [].map.call(document.querySelectorAll('.used-prog:checked'), function (el) { return el.value; });
  }

  /* ---------- 進路プラン ---------- */
  function 進路欄を作る(年齢たち) {
    var 帯 = (データ.tuition && データ.tuition.bands) || [];
    var box = $('plan-box');
    if (!年齢たち.length) { box.innerHTML = '<p class="hint">お子さんの年齢を入れると、ここに進路の欄が出ます。</p>'; return; }
    box.innerHTML = 年齢たち.map(function (age, i) {
      var 行 = 帯.map(function (b) {
        if (age > b.to) { return ''; }   // もう通り過ぎた段階は聞かない
        var opts = b.choices.map(function (c) {
          return '<option value="' + esc(c.value) + '"' + (c.value === b.default ? ' selected' : '') + '>' +
            esc(c.label) + '（年 ' + Math.round(c.yearly / 10000) + '万円）</option>';
        }).join('');
        return '<div class="plan-row"><span class="plan-label">' + esc(b.label) + '</span>' +
          '<select class="plan-select" data-child="' + i + '" data-stage="' + esc(b.stage) + '">' + opts + '</select></div>';
      }).join('');
      return '<div class="plan-child"><p class="plan-head">' + (i + 1) + '人目（' + age + '歳）</p>' +
        (行 || '<p class="hint">学校にかかるお金の計算は、ここでは出ません。</p>') + '</div>';
    }).join('');
    document.querySelectorAll('.plan-select').forEach(function (el) {
      el.addEventListener('change', function () {
        if (最新入力) { 最新入力.plans = 進路プラン(); 資産を描く(); }
      });
    });
  }
  function 進路プラン() {
    var out = [];
    document.querySelectorAll('.plan-select').forEach(function (el) {
      var i = parseInt(el.getAttribute('data-child'), 10);
      if (!out[i]) { out[i] = {}; }
      out[i][el.getAttribute('data-stage')] = el.value;
    });
    return out;
  }

  /* ---------- 入力をまとめて取り出す ---------- */
  function 入力を読む() {
    var 子 = 子どもの年齢たち();
    return {
      isSingleParent: 選択('status') === 'single',
      myAge: 数('my-age'),
      myIncome: 数('my-income') * 10000,
      spouseIncome: 数('spouse-income') * 10000,
      children: 子,
      eligibleChildCount: 子.filter(function (a) { return a <= 18; }).length,
      area: $('area').value.trim(),
      housingType: 選択('housing-type'),
      livingCost: 数('living-cost'),
      currentSavings: 数('current-savings'),
      usedPrograms: 使っている制度(),
      plans: 進路プラン(),
      housingNow: 数('housing-now'),
      housingAfter: (選択('status') === 'single') ? 数('housing-now') : 数('housing-after'),
      childSupportState: 選択('cs-state'),
      childSupportMonthly: 数('cs-monthly'),
      divorced_childSupportMonthly: 数('cs-monthly'),
      parentSupportMonthly: 数('parent-support'),
      parentAge: 数('parent-age'),
      parentSupportEndAge: 数('parent-end-age') || データ.tables.parent_support_end_age_default
    };
  }

  /* ---------- 見本を入れる ---------- */
  function 見本を入れる(id) {
    var s = 見本.samples.filter(function (x) { return x.id === id; })[0];
    if (!s) { return; }
    var i = s.input;
    document.querySelector('input[name="status"][value="' + (i.isSingleParent ? 'single' : 'married') + '"]').checked = true;
    $('my-age').value = i.myAge;
    $('my-income').value = Math.round(i.myIncome / 10000);
    $('spouse-income').value = Math.round(i.spouseIncome / 10000);
    $('child-count').value = i.children.length;
    子ども欄を作る(i.children.length, i.children);
    $('area').value = i.area;
    var ht = document.querySelector('input[name="housing-type"][value="' + i.housingType + '"]');
    if (ht) { ht.checked = true; }
    $('living-cost').value = i.livingCost;
    $('current-savings').value = i.currentSavings || 0;
    document.querySelectorAll('.used-prog').forEach(function (el) {
      el.checked = (i.usedPrograms || []).indexOf(el.value) >= 0;
    });
    進路欄を作る(i.children);
    (i.plans || []).forEach(function (pl, idx) {
      Object.keys(pl).forEach(function (st) {
        var el = document.querySelector('.plan-select[data-child="' + idx + '"][data-stage="' + st + '"]');
        if (el) { el.value = pl[st]; }
      });
    });
    $('housing-now').value = i.housingNow;
    $('housing-after').value = i.housingAfter;
    var cs = document.querySelector('input[name="cs-state"][value="' + i.childSupportState + '"]');
    if (cs) { cs.checked = true; }
    $('cs-monthly').value = i.childSupportMonthly;
    $('parent-support').value = i.parentSupportMonthly;
    $('parent-age').value = i.parentAge || '';
    婚姻状態を反映();
    $('sample-note').textContent = '「' + s.label + '」を入れました（架空の例です）。' + s.story;
    計算する();
  }

  function 見本ボタンを描く() {
    var box = $('sample-buttons');
    box.innerHTML = 見本.samples.map(function (s) {
      return '<button type="button" class="ghost" data-sample="' + esc(s.id) + '">' + esc(s.label) + '</button>';
    }).join(' ');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-sample]');
      if (b) { 見本を入れる(b.getAttribute('data-sample')); }
    });
  }

  /* ---------- 婚姻状態でフォームの見た目を切り替える ---------- */
  function 婚姻状態を反映() {
    var ひとり親 = 選択('status') === 'single';
    document.querySelectorAll('[data-only="married"]').forEach(function (el) {
      el.style.display = ひとり親 ? 'none' : '';
    });
  }

  /* ---------- Stage 1 制度チェック ---------- */
  function 制度を描く(判定) {
    var 使用中 = {};
    (最新入力.usedPrograms || []).forEach(function (id) { 使用中[id] = true; });
    var 順 = { likely: 0, check: 1, unlikely: 2 };
    var 並び = 判定.results.slice().sort(function (a, b) { return 順[a.status] - 順[b.status]; });
    var ラベル名 = { likely: '対象の可能性が高い', check: '窓口で確認したいもの', unlikely: '対象外の見込み' };
    var 出力 = [], 現在 = null;
    並び.forEach(function (r) {
      if (r.status !== 現在) {
        現在 = r.status;
        出力.push('<p class="cat-head">' + ラベル名[現在] + '</p>');
      }
      var p = r.program;
      出力.push(
        '<div class="prog ' + (使用中[p.id] ? 'used' : r.status) + '" id="prog-' + esc(p.id) + '">' +
        '<h4>' + esc(p.name) +
        (使用中[p.id] ? ' <span class="badge used">✓ 利用中</span>'
                      : ' <span class="badge ' + r.status + '">' + esc(r.label) + '</span>') + '</h4>' +
        '<p>' + esc(p.summary) + '</p>' +
        (r.amountText ? '<p class="amount">' + esc(r.amountText) + '</p>' : '') +
        (r.status !== 'unlikely' ? '<p>' + esc(p.benefit_summary) + '</p>' : '') +
        (r.note ? '<p class="hint">' + esc(r.note) + '</p>' : '') +
        (r.status !== 'unlikely' && p.cautions ? '<ul class="hint">' + p.cautions.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') +
        '<p class="apply">申請するところ: ' + esc(p.how_to_apply) + '</p>' +
        '<p class="src">根拠: ' + esc(p.source.law) + '／' +
        '<a href="' + esc(p.source.url) + '" target="_blank" rel="noopener">' + esc(p.source.publisher) + 'のページを開く</a>' +
        '（最終確認 ' + 日付表示(p.source.last_verified) + '）</p>' +
        '</div>'
      );
    });
    $('stage1-body').innerHTML = 出力.join('');
    var 該当 = 判定.results.filter(function (r) { return r.status === 'likely' && !使用中[r.program.id]; }).length;
    var 要確認 = 判定.results.filter(function (r) { return r.status === 'check' && !使用中[r.program.id]; }).length;
    var 利用中 = 判定.results.filter(function (r) { return 使用中[r.program.id]; }).length;
    $('stage1-summary').innerHTML =
      (利用中 ? 'すでに<strong>' + 利用中 + '件</strong>を使っていると答えていただきました。そのうえで、' : '') +
      'まだ使っていないもののうち<strong>' + 該当 + '件</strong>が対象になりそうです。あわせて<strong>' + 要確認 + '件</strong>は、' +
      'お住まいの市区町村によってあつかいが違うため、窓口での確認が必要です。';
  }

  function 日付表示(iso) {
    if (!iso) { return '不明'; }
    var p = iso.split('-');
    var 曜 = ['日', '月', '火', '水', '木', '金', '土'][new Date(iso + 'T00:00:00').getDay()];
    return Number(p[1]) + '/' + Number(p[2]) + '(' + 曜 + ')';
  }

  /* ---------- Stage 2 くらべるグラフ ---------- */
  function グラフを描く() {
    var 入力 = 最新入力;
    if (!入力.children.length) {
      $('stage2-body').innerHTML = '<p class="hint">お子さんの年齢を入れると、ここにグラフが出ます。</p>';
      return;
    }
    最新シミュ = SPS.シミュレーション(入力, データ);
    var y = 最新シミュ.years;
    var 値 = (グラフの見方 === 'total') ? 'total' : 'perPerson';
    var 差 = y.length ? (y[0].divorced[値] - y[0].married[値]) : 0;

    var 頭 = 入力.isSingleParent
      ? '<p>すでにひとり親の方は、「離婚した場合」の線がいまの姿です。「結婚を続けた場合」の線は、配偶者の年収を入れたときの参考です。</p>'
      : '<p><strong>いま（お子さん' + y[0].youngestAge + '歳）の時点では、離婚した場合のほうが ひと月あたり ' +
        (差 >= 0 ? '約' + SPS.円(差) + ' 多く' : '約' + SPS.円(-差) + ' 少なく') + 'なる見込みです。</strong>' +
        (値 === 'perPerson' ? 'ひとりあたりに直した金額での比較です。' : '家ぜんたいの金額での比較です。') + '</p>';

    $('stage2-body').innerHTML =
      頭 + 見方の切りかえ() + 見方の説明() + SPSChart.凡例() +
      '<div class="chart-box">' + SPSChart.描く(y, 最新シミュ.cliffs, グラフの見方) + '</div>' +
      崖の説明(最新シミュ.cliffs) +
      '<p class="hint">グラフの上を指でなぞる（マウスを乗せる）と、その年の金額が出ます。</p>' +
      SPSChart.表(y, グラフの見方) + お金以外の注意();

    document.querySelectorAll('button[data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        グラフの見方 = b.getAttribute('data-view');
        グラフを描く();
      });
    });
  }

  function 見方の切りかえ() {
    function b(v, 名) {
      var 選 = (グラフの見方 === v);
      return '<button type="button" class="' + (選 ? 'primary' : 'ghost') + '" data-view="' + v + '"' +
        (選 ? ' aria-pressed="true"' : ' aria-pressed="false"') +
        ' style="width:auto;margin:0;padding:.45rem .9rem;font-size:.85rem">' + 名 + '</button>';
    }
    return '<div class="view-switch">' + b('perPerson', 'ひとりあたりに直して見る') + b('total', '家ぜんたいの金額で見る') + '</div>';
  }

  function 見方の説明() {
    if (グラフの見方 === 'total') {
      return '<p class="hint">いま見ているのは <strong>家ぜんたい</strong>の金額です。' +
        '結婚を続けた場合は大人2人ぶん、離婚した場合は大人1人ぶんの暮らしなので、この数字をそのまま比べると、' +
        '結婚を続けたほうが実際より豊かに見えます。比べるときは「ひとりあたりに直して見る」に切りかえてください。</p>';
    }
    return '<p class="hint"><strong>家族の人数がちがうので、そのまま足した金額では比べられません。' +
      'ひとりあたりに直した金額で比べています。</strong><br>' +
      'ひと月の合計を、世帯人数の平方根で割っています。人数で単純に割らないのは、家賃や電気代のように' +
      '「人がふえてもそれほどふえない費用」があるからです。厚生労働省が国民生活基礎調査で貧困の割合を出すときと同じやり方（OECDの作成基準）です。<br>' +
      '<a href="https://www.mhlw.go.jp/toukei/list/dl/20-21a-01.pdf" target="_blank" rel="noopener">厚生労働省「国民生活基礎調査（貧困率）よくあるご質問」</a>（最終確認 8/11(火)）</p>';
  }

  function お金以外の注意() {
    return '<div class="pit yellow" style="margin-top:1rem">' +
      '<h4>🟡 このグラフは、お金の話だけです</h4>' +
      '<p>結婚を続けた場合の金額は、<strong>相手の収入が家計にきちんと入っていることが前提</strong>です。</p>' +
      '<p>生活費を渡してもらえない。使い道を細かく責められる。身の安全に不安がある。' +
      'そういう場合は、お金の多い少ないとは別の問題です。グラフの数字だけで決めないでください。</p>' +
      '<p><a href="#stage3">身の安全のことは、下の「気をつけてほしいこと」を見てください</a>／' +
      '<a href="manual.html#erase" target="_blank" rel="noopener">相談できるところの一覧を開く</a></p>' +
      '</div>';
  }

  /* ---------- 貯金のたまり方（資産カーブ） ---------- */
  function 資産を描く() {
    var 入力 = 最新入力;
    if (!入力 || !入力.children.length) { return; }
    if (!入力.livingCost) {
      $('stage2b-body').innerHTML = '<p class="hint">「毎月の生活費」を入れると、貯金のたまり方のグラフが出ます。' +
        '食費・光熱費・通信費・日用品などの合計のめやすで大丈夫です（家賃と学校のお金はのぞきます）。</p>';
      return;
    }
    最新資産 = SPS.資産カーブ(入力, データ);
    var c = 最新資産;

    var 頭;
    if (c.monthlyBalance < 0) {
      頭 = '<p class="deficit-line"><strong>いま、毎月あと ' + SPS.円(-c.monthlyBalance) + ' 足りない状態です。</strong>' +
        '（使える制度を全部使ったとしても、です）</p>';
    } else if (c.goesNegative && c.shortfallMonthly) {
      頭 = '<p class="deficit-line"><strong>いまは足りていますが、いちばん下のお子さんが' +
        c.points[c.negativeFromOffset].youngestAge + '歳のころに、貯金が底をつく計算です。</strong>' +
        'その時期は、毎月あと ' + SPS.円(c.shortfallMonthly) + ' 足りません。</p>';
    } else {
      頭 = '<p><strong>使える制度を全部使うと、ひと月に約' + SPS.円(c.monthlyBalance) + ' 残る計算です。</strong></p>';
    }

    /* いちばん見せたい数字: まだ使っていない制度でいくら変わるか */
    var 伸びしろ = '';
    if (c.gaps.length) {
      var 名 = c.gaps.map(function (g) { return データ.programs_by_id[g.id].name.replace(/（.*$/, ''); }).join('・');
      伸びしろ = '<div class="headline-box">' +
        '<p class="big">まだ使っていない制度で、<strong>10年で約' +
        Math.round(c.diffAtTenYears / 10000).toLocaleString('ja-JP') + '万円</strong>変わります</p>' +
        '<p>いま申告されていないのは <strong>' + esc(名) + '</strong> です。' +
        'ひと月あたり約' + SPS.円(c.gapMonthly) + '。いちばん下のお子さんが22歳になるまでだと、約' +
        Math.round(c.finalDiff / 10000).toLocaleString('ja-JP') + '万円の差です。</p>' +
        '<p><a href="#stage1" class="jump-big">この差の中身を見る（使えるかもしれない制度の一覧へ）</a></p>' +
        '</div>';
    } else {
      伸びしろ = '<div class="headline-box ok">' +
        '<p class="big">使えるお金の取りこぼしは、見あたりません</p>' +
        '<p>このツールが自動で判定できる制度は、すでに使えているようです。' +
        'あとは市区町村ごとの制度が残っています。' +
        '<a href="#stage1">確認したい制度の一覧を見る</a></p></div>';
    }

    var 到達;
    if (c.alreadyAboveSafety) {
      到達 = '<strong>緑の帯（生活防衛資金）は、すでに貯め終えています。</strong>' +
        '次の段階を考えはじめてもよい段階です。';
    } else if (c.alreadyReachedSafety) {
      到達 = 'いまの貯金は、緑の帯（生活防衛資金）の中に入っています。' +
        'まずは帯の上（' + SPS.円(c.safetyMax) + '）を目指してください。';
    } else if (c.reachMonths !== null) {
      到達 = '緑の帯（生活防衛資金 ' + SPS.円(c.safetyMin) + '）にとどくまで、いまのペースで <strong>約' +
        SPS.年月表示(c.reachMonths) + '</strong> です。';
    } else {
      到達 = '緑の帯（生活防衛資金 ' + SPS.円(c.safetyMin) + '）には、いまのペースではとどきません。';
    }

    $('stage2b-body').innerHTML =
      伸びしろ + 頭 + SPSChart.資産の凡例() +
      '<div class="chart-box">' + SPSChart.資産を描く(c) + '</div>' +
      打ち切りの注記(c) +
      '<p class="band-line">' + 到達 + '</p>' +
      '<details class="explain"><summary>生活防衛資金って？（くわしく）</summary>' + 防衛資金の説明() + '</details>' +
      赤字の警告(c) +
      学費の説明(c) +
      '<p class="hint">' + (c.startSavings > 0
        ? '「いまの貯金」' + SPS.円(c.startSavings) + ' を出発点にしています。'
        : 'いまの貯金を入れていないので、0円から始まるものとして描いています。') +
      '年収は変わらないものとして計算しています。</p>';
  }

  function 打ち切りの注記(c) {
    if (!c.truncated) { return ''; }
    return '<p class="hint cutoff">灰色の網かけから先は、線を描いていません。' +
      '<strong>このままの前提では成り立たない領域だからです。</strong>' +
      '借金をずっと積み増していくことは実際にはできませんし、' +
      'その前に、支出・収入・受けられる支援のどれかを変えることになります。' +
      'ここから先を数字で見せると、かえって嘘になります。</p>';
  }

  /* ---------- 学校にかかるお金 ---------- */
  function 学費の説明(c) {
    var t = データ.tuition;
    if (!t) { return ''; }
    var h = ['<div class="panel tight">'];
    h.push('<h3 style="margin-top:0">学校にかかるお金</h3>');
    h.push('<p>いまの進路の見込みだと、これから <strong>合計およそ ' +
      Math.round(c.tuitionTotal / 10000).toLocaleString('ja-JP') + '万円</strong> かかる計算です。</p>');
    if (c.tuitionExtra > 0) {
      h.push('<p><strong>全部公立（大学は国立で自宅から通う）を選んだ場合との差は、累計で約' +
        Math.round(c.tuitionExtra / 10000).toLocaleString('ja-JP') + '万円です。</strong>' +
        '上の入力欄の「お子さんの進路の見込み」を変えると、グラフがその場で変わります。</p>');
    } else {
      h.push('<p class="hint">上の入力欄の「お子さんの進路の見込み」を変えると、グラフがその場で変わります。私立を選ぶと、どれだけ変わるかが見られます。</p>');
    }
    h.push('<p class="hint"><strong>ここの金額は、すべて全国の平均値です。</strong>まん中の人の金額ではありません。' +
      '塾や習いごとにたくさんかける家庭が平均を押し上げるので、多くの家庭の実感より高めに出ます。</p>');
    h.push('<p class="hint">' + esc(t.note_high_school) + '</p>');
    h.push('<p class="hint">' + esc(t.note_kindergarten) + '</p>');
    h.push('<p class="hint">' + esc(t.note_university) + '</p>');
    h.push('<p class="src">出典: ' +
      '<a href="' + esc(t.source_school.url) + '" target="_blank" rel="noopener">文部科学省「子供の学習費調査」</a>（' +
      日付表示(t.source_school.last_verified) + '確認）／' +
      '<a href="' + esc(t.source_university.url) + '" target="_blank" rel="noopener">日本学生支援機構「学生生活調査」</a>／' +
      '<a href="' + esc(t.source_entrance.url) + '" target="_blank" rel="noopener">文部科学省「私立大学等の学生納付金等調査」</a>／' +
      '<a href="' + esc(t.source_free_preschool.url) + '" target="_blank" rel="noopener">こども家庭庁「幼児教育・保育の無償化」</a></p>');
    h.push('</div>');
    return h.join('');
  }

  /* ---------- 足りないぶんを、どうやって埋めるか ----------
     「崩れます」で終わらせず、そのぶんをどこから持ってくるかの一覧を出す。 */
  function 赤字の警告(c) {
    if (!c.goesNegative && !c.universityDeficit) { return ''; }
    var 入力 = 最新入力, 判定 = 最新判定;
    var 不足 = c.shortfallMonthly || (c.monthlyBalance < 0 ? -c.monthlyBalance : 0);
    var 判定表 = {};
    判定.results.forEach(function (r) { 判定表[r.program.id] = r.status; });
    var 使用中 = {};
    (入力.usedPrograms || []).forEach(function (id) { 使用中[id] = true; });

    var 手 = [];
    function 足す(見出し, 説明, 制度id, 強調) {
      手.push({ head: 見出し, body: 説明, prog: 制度id, strong: !!強調 });
    }

    if (入力.childSupportState.indexOf('取り決めている') === -1) {
      足す('養育費を取り決める・請求する',
        '口約束や、取り決めなしのままになっています。ここがいちばん大きく動く可能性があります。' +
        '公正証書にしておけば、あとから給料や預金を差し押さえられます。' +
        '令和8年4月からは、取り決めがない場合でも一定額を請求できる仕組みが始まっています。',
        'youikuhi', true);
    }
    c.gaps.forEach(function (g) {
      var p = データ.programs_by_id[g.id];
      足す('「' + p.name.replace(/（.*$/, '') + '」を申請する',
        'まだ受け取っていないと答えていただきました。ひと月あたり約' + SPS.円(g.monthly) + 'です。',
        g.id, g.monthly >= 不足);
    });
    if (入力.housingType === '賃貸' && 入力.housingAfter > 0) {
      足す('住まいの費用を見直す',
        'いまの住居費は月' + SPS.円(入力.housingAfter) + 'です。公営住宅は収入に応じて家賃が決まるので、' +
        '民間の賃貸との差が月に数万円になることがあります。募集の時期を調べてみてください。',
        'koei_jutaku', false);
    }
    if (判定表.koutou_shokugyo_kunren) {
      足す('資格を取って、収入を上げる',
        '学校に通う間、住民税が非課税の世帯なら月10万円（課税世帯は月70,500円）を受け取れます。' +
        '最後の1年はさらに月4万円。通いはじめる前に相談することが必要です。',
        'koutou_shokugyo_kunren', false);
    }
    if (入力.children.some(function (a) { return a >= 6 && a <= 15; })) {
      足す('学校のお金を助けてもらう',
        '就学援助は、児童扶養手当を受けていることを基準のひとつにしている市町村が約4分の3あります。' +
        '年度の途中でも受け付けているところがほとんどです。',
        'shugaku_enjo', false);
    }
    if (不足 >= 50000) {
      足す('生活保護の相談に行く',
        '足りない額が大きいときの選択肢です。生活保護は権利です。一時的に受けて、立て直してから抜けることもできます。' +
        '「車があるから」「持ち家だから」と自分で決めず、まず福祉事務所で聞いてください。',
        'seikatsu_hogo', false);
    }
    足す('お住まいの地域の相談窓口に行く',
      '自立相談支援機関では、家計の立て直しを一緒に考えてくれます。' +
      '<a href="https://minna-tunagaru.jp/ichiran/" target="_blank" rel="noopener">全国の窓口一覧</a>から探せます。',
      null, false);

    var h = ['<div class="pit red gap-block">'];
    h.push('<h4>🔴 足りないぶんを、どこから持ってくるか</h4>');
    if (不足 > 0) {
      h.push('<p class="gap-amount">埋めたいのは <strong>ひと月あたり ' + SPS.円(不足) + '</strong> です。</p>');
    }
    h.push('<p><strong>借金では埋められません。</strong>カードローンやリボ払いで足りないぶんを埋めると、' +
      '来月からは返済も足されて、もっと足りなくなります。下の手を1つずつ試してください。</p>');
    h.push('<ol class="gap-list">');
    手.forEach(function (o) {
      h.push('<li' + (o.strong ? ' class="strong"' : '') + '>' +
        '<strong>' + esc(o.head) + '</strong>' + (o.strong ? ' <span class="badge info">大きく効きます</span>' : '') +
        '<br>' + o.body +
        (o.prog ? '<br><a href="#prog-' + esc(o.prog) + '">この制度のくわしい説明を見る</a>' : '') + '</li>');
    });
    h.push('</ol>');
    h.push('<p>全部やらなくて大丈夫です。上から1つずつで十分です。ひとりで抱えないでください。</p>');
    h.push('</div>');

    if (c.universityDeficit) {
      var 修学 = データ.programs_by_id.koutou_kyoiku_shugaku_shien;
      h.push('<div class="pit red"><h4>🔴 進学を決める前に、必ず確認してほしい制度があります</h4>' +
        '<p>いちばん下のお子さんが' + c.universityDeficit.youngestAge + '歳のころ、大学のお金で貯金が底をつく計算です。</p>' +
        '<p><strong>' + esc(修学.name) + '</strong> を使うと、住民税が非課税の世帯なら、私立・自宅外で' +
        '返さなくてよい奨学金が年91万円、あわせて授業料が年70万円まで免除されます。' +
        'ひとり親家庭は満額の対象になることが多い制度です。</p>' +
        '<p><a href="#prog-koutou_kyoiku_shugaku_shien">この制度のくわしい説明を見る</a>／' +
        '<a href="' + esc(修学.source.url) + '" target="_blank" rel="noopener">文部科学省のページを開く</a></p>' +
        '<p class="hint">このグラフの学費には、この制度による減額を入れていません。使えれば、線はこれより上がります。</p>' +
        '</div>');
    }
    return h.join('');
  }

  function 防衛資金の説明() {
    return '<div class="notice">' +
      '<h4>緑の帯は「生活防衛資金」です</h4>' +
      '<p style="margin:.3rem 0"><strong>まずはこの帯にとどくまで貯めることだけ考えれば大丈夫です。' +
      'ここにとどくまで、投資のことは考えなくていいです。</strong></p>' +
      '<p style="margin:.3rem 0">仕事を失ったとき、体をこわしたとき、家電がこわれたとき。' +
      'このお金があれば、借金をせずに乗りきれます。ひとり親家庭は収入が一人分なので、ここがいちばん効きます。</p>' +
      '<p class="hint" style="margin:.4rem 0 0">' +
      '<strong>事実:</strong> 金融庁は「家計管理の基本は、収入と支出をきちんと把握・管理すること、収支を黒字にすること、' +
      'そして黒字分を貯蓄することです」としています（' +
      '<a href="https://www.fsa.go.jp/policy/nisa2/invest/" target="_blank" rel="noopener">金融庁「資産形成の基本」</a>）。' +
      'また金融広報中央委員会は、緊急時の予備資金について「金額は生活費の半年分が目安です」としています（' +
      '<a href="https://www.shiruporuto.jp/public/document/container/shinkon/" target="_blank" rel="noopener">知るぽると</a>' +
      '／アーカイブ。最終確認 8/11(火)）。</p>' +
      '<div class="stance" style="background:#fff"><span class="stance-tag">ここからは、私たちの立場の表明です（事実ではありません）</span>' +
      '私たちAIかけこみ寺は、ひとり親家庭にとっては生活費の3か月分から6か月分を手元に置くことが、' +
      'どんな資産運用よりも先に来ると考えます。3か月分でもまず十分に効きます。' +
      'この帯にとどくまでは、投資のことは考えなくていい、というのが私たちの立場です。' +
      'なお「3か月分から6か月分」という幅は、私たちが目安として置いたものです。</div>' +
      '</div>';
  }

  function 崖の説明(cliffs) {
    if (!cliffs.length) { return ''; }
    return '<div class="cliff-list"><p class="cliff-head">グラフのたて線（金額が変わるところ）</p><ol>' +
      cliffs.map(function (c) {
        return '<li><span class="cliff-no">' + '</span>いちばん下のお子さんが <strong>' +
          c.youngestAge + '歳</strong> のとき: ' + esc(c.label) + '</li>';
      }).join('') + '</ol></div>';
  }

  /* ---------- Stage 3 気をつけたいこと ---------- */
  function 落とし穴の条件(item, 入力, 判定) {
    switch (item.trigger) {
      case 'always': return true;
      case 'no_child_support_agreement':
        return 入力.childSupportState.indexOf('取り決めている') === -1;
      case 'near_income_limit': {
        var j = 判定.jidoFuyoTeate;
        if (!j) { return false; }
        if (j.status === 'partial') { return true; }
        if (j.status === 'full') { return j.income > j.limits.full - 300000; }
        return false;
      }
      case 'has_school_age_child':
        return 入力.children.some(function (a) { return a >= 5 && a <= 22; });
      case 'has_parent_support':
        return 入力.parentSupportMonthly > 0;
      default: return false;
    }
  }

  function 当てはまる落とし穴(入力, 判定) {
    return 落とし穴.items.filter(function (it) { return 落とし穴の条件(it, 入力, 判定); });
  }

  /* ---------- まずやること（チェックリスト） ----------
     長い説明を読む前に、やることだけを short に出します。
     チェックの状態は保存しません。持ち歩けるように、コピーだけできるようにしてあります。 */
  function まずやること(入力, 判定) {
    var 一覧 = [];
    /* いちばん最後の「窓口へ行く」は必ず残したいので、条件つきの項目は6個までにする */
    function 足す(文, 制度id) { if (一覧.length < 6) { 一覧.push({ text: 文, prog: 制度id || null }); } }

    var 判定表 = {};
    判定.results.forEach(function (r) { 判定表[r.program.id] = r.status; });
    var j = 判定.jidoFuyoTeate;

    /* 順番は「取り返しがつかなくなる順」「お金が大きい順」 */
    if (入力.childSupportState.indexOf('取り決めている') === -1) {
      足す('養育費の取り決めを、公正証書にする', 'youikuhi');
    }
    if (判定表.jido_fuyo_teate === 'likely') {
      足す('市区町村の窓口で、児童扶養手当を申し込む', 'jido_fuyo_teate');
    }
    if (判定表.jido_teate === 'likely') {
      足す('児童手当を受け取れているか、確かめる', 'jido_teate');
    }
    if (判定表.hitorioya_kojo === 'likely') {
      足す('ひとり親控除を申告する（5年前までさかのぼれる）', 'hitorioya_kojo');
    }
    if (入力.children.some(function (a) { return a >= 6 && a <= 15; })) {
      足す('学校で、就学援助が使えるか聞く', 'shugaku_enjo');
    }
    if (入力.children.some(function (a) { return a >= 14 && a <= 18; })) {
      足す('高校の授業料の支援を、学校で聞く', 'koukou_shugaku_shienkin');
    }
    if (入力.children.some(function (a) { return a >= 16; })) {
      足す('返さなくてよい奨学金があるか、調べる', 'koutou_kyoiku_shugaku_shien');
    }
    if (j && (j.status === 'partial' || (j.status === 'full' && j.income > j.limits.full - 300000))) {
      足す('働く時間をふやす前に、手当がいくら減るか確かめる', 'jido_fuyo_teate');
    }
    if (入力.parentSupportMonthly > 0) {
      足す('親の援助が終わる年に、月いくら足りなくなるか見ておく', null);
    }
    if (入力.housingType === '賃貸') {
      足す('公営住宅の募集の時期を調べる', 'koei_jutaku');
    }
    /* これだけは、どんなときも最後に置く */
    一覧.push({ text: '聞きたいことをメモして、市区町村のひとり親相談の窓口へ行く', prog: null });
    return 一覧;
  }

  function チェックリストを描く(一覧) {
    if (!一覧.length) { return ''; }
    var h = ['<div class="checklist">',
      '<h3 style="margin-top:0">まずやること</h3>',
      '<p class="hint">上から順に、ひとつずつで大丈夫です。全部やらなくても、1つ進めば前に進みます。</p>',
      '<ul>'];
    一覧.forEach(function (it, i) {
      h.push('<li><label><input type="checkbox" id="todo-' + i + '"><span>' + esc(it.text) + '</span></label>' +
        (it.prog ? ' <a class="jump" href="#prog-' + esc(it.prog) + '">くわしく</a>' : '') + '</li>');
    });
    h.push('</ul>',
      '<div class="copy-row"><button type="button" class="ghost" id="copy-todo">このリストをコピーする</button>',
      '<span class="copy-msg" id="copy-todo-msg"></span></div>',
      '<p class="hint">チェックを入れても、どこにも保存されません。画面を閉じると消えます。' +
      '持っていきたいときは、上のボタンでコピーして、メモ帳などに貼りつけてください。</p>',
      '</div>');
    return h.join('');
  }

  /* ---------- 落とし穴チェック（自分で確かめるための行動のルール） ---------- */
  function 落とし穴チェックを描く(行動) {
    if (!行動.length) { return ''; }
    var h = ['<div class="checklist danger-list">',
      '<h3 style="margin-top:0">落とし穴チェック</h3>',
      '<p class="hint">全部にチェックが付けば、大きく転ぶ道はだいたい避けられます。' +
      'いま付かないものがあっても大丈夫です。付けられるようにしていけば十分です。</p>',
      '<ul>'];
    行動.forEach(function (r, i) {
      h.push('<li><label><input type="checkbox" id="rule-' + i + '"><span>' + esc(r.text) + '</span></label>' +
        (r.pit ? ' <a class="jump" href="#pit-' + esc(r.pit) + '">くわしく</a>' : '') + '</li>');
    });
    h.push('</ul>',
      '<div class="copy-row"><button type="button" class="ghost" id="copy-rule">このチェックをコピーする</button>',
      '<span class="copy-msg" id="copy-rule-msg"></span></div>',
      '<p class="hint">チェックを入れても、どこにも保存されません。</p>',
      '</div>');
    return h.join('');
  }

  /** 「くわしく」で飛んだ先の折りたたみを開く */
  function 飛び先を開く() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a.jump');
      if (!a) { return; }
      var 先 = document.getElementById(a.getAttribute('href').slice(1));
      if (!先) { return; }
      var d = 先.querySelector('details');
      if (d) { d.open = true; }
    });
  }

  function 落とし穴を描く(入力, 判定) {
    var items = 当てはまる落とし穴(入力, 判定);
    var 赤 = items.filter(function (i) { return i.tone === 'red'; });
    var 黄 = items.filter(function (i) { return i.tone === 'yellow'; });
    var やること = まずやること(入力, 判定);

    function 中身(it) {
      var h = [];
      h.push('<p><strong>' + esc(it.title) + '</strong></p>');
      if (it.intro) { h.push('<p>' + esc(it.intro) + '</p>'); }
      if (it.facts && it.facts.length) {
        h.push('<ul>' + it.facts.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>');
      }
      if (it.stance) {
        h.push('<div class="stance"><span class="stance-tag">ここからは、私たちの立場の表明です（事実ではありません）</span>' + esc(it.stance) + '</div>');
      }
      if (it.roi) {
        h.push('<div class="roi"><strong>いますぐのお金と、積み上げるお金</strong><br>' +
          '・いますぐ: ' + esc(it.roi.quick) + '<br>・積み上げ: ' + esc(it.roi.slow) + '</div>');
      }
      if (it.exit_support) {
        h.push('<p><strong>いま使える相談先</strong></p><ul>' + it.exit_support.map(function (e) {
          return '<li><a href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(e.label) + '</a>：' + esc(e.detail) + '</li>';
        }).join('') + '</ul>');
      }
      if (it.action) { h.push('<p><strong>できること: </strong>' + esc(it.action) + '</p>'); }
      if (it.sources && it.sources.length) {
        h.push('<p class="src">出典: ' + it.sources.map(function (s) {
          return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>';
        }).join(' ／ ') + '（最終確認 ' + 日付表示(it.last_verified) + '）</p>');
      }
      return h.join('');
    }

    function 一件(it) {
      return '<div class="pit ' + it.tone + '" id="pit-' + esc(it.id) + '">' +
        '<h4>' + (it.tone === 'red' ? '🔴 ' : '🟡 ') + esc(it.headline || it.title) + '</h4>' +
        '<details><summary>くわしく読む</summary><div class="pit-detail">' + 中身(it) + '</div></details>' +
        '</div>';
    }

    var 出ている = {};
    items.forEach(function (it) { 出ている[it.id] = true; });
    var 行動 = (落とし穴.action_checklist || []).filter(function (r) { return !r.pit || 出ている[r.pit]; });

    $('stage3-body').innerHTML =
      チェックリストを描く(やること) +
      落とし穴チェックを描く(行動) +
      '<h3>とくに気をつけてほしいこと</h3>' +
      '<p class="hint">見出しだけ読めば大丈夫です。気になるものだけ開いてください。</p>' +
      赤.map(一件).join('') +
      '<h3>入力の内容から、確かめてほしいこと</h3>' +
      (黄.length ? 黄.map(一件).join('') : '<p class="hint">とくにありません。</p>');

    var b = $('copy-todo');
    if (b) {
      b.addEventListener('click', function () {
        var 文 = ['まずやること（ひとり親ライフチョイス・シミュレータ）', ''].concat(
          やること.map(function (it) { return '□ ' + it.text; }),
          ['', '※ 金額はすべて概算です。正確な額は市区町村の窓口で確認してください。']).join('\n');
        コピーする(文, $('copy-todo-msg'));
      });
    }
    var b2 = $('copy-rule');
    if (b2) {
      b2.addEventListener('click', function () {
        var 文 = ['落とし穴チェック（ひとり親ライフチョイス・シミュレータ）', ''].concat(
          行動.map(function (r) { return '□ ' + r.text; })).join('\n');
        コピーする(文, $('copy-rule-msg'));
      });
    }
  }

  /* ---------- Stage 4 AIに相談する文章 ---------- */
  function プロンプトを描く(入力, 判定) {
    var list = SPSPrompts.全部作る(入力, 判定);
    $('stage4-body').innerHTML = list.map(function (p, i) {
      return '<div class="prompt-card">' +
        '<h4>' + esc(p.title) + '</h4>' +
        '<p class="hint">' + esc(p.desc) + '</p>' +
        '<textarea readonly id="pr-' + i + '">' + esc(p.text) + '</textarea>' +
        '<div class="copy-row"><button type="button" class="ghost" data-copy="pr-' + i + '">この文章をコピーする</button>' +
        '<span class="copy-msg" id="msg-pr-' + i + '"></span></div>' +
        '</div>';
    }).join('');
  }

  function コピーする(文, msg) {
    function done(ok) {
      msg.textContent = ok ? 'コピーしました' : 'コピーできませんでした。文章を選んでコピーしてください。';
      setTimeout(function () { msg.textContent = ''; }, 3000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(文).then(function () { done(true); }, function () { done(false); });
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = 文; document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta); done(ok);
  }

  function コピー設定() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-copy]');
      if (!b) { return; }
      var ta = $(b.getAttribute('data-copy'));
      var msg = $('msg-' + b.getAttribute('data-copy'));
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      if (!ok && navigator.clipboard) {
        navigator.clipboard.writeText(ta.value).then(function () { msg.textContent = 'コピーしました'; });
      } else {
        msg.textContent = ok ? 'コピーしました' : 'コピーできませんでした。文章を選んでコピーしてください。';
      }
      window.getSelection().removeAllRanges();
      setTimeout(function () { msg.textContent = ''; }, 3000);
    });
  }

  /* ---------- 計算して全部出す ---------- */
  function 計算する() {
    最新入力 = 入力を読む();
    if (!最新入力.children.length) {
      alert('お子さんの年齢を入れてください。');
      return;
    }
    最新判定 = SPS.制度判定(最新入力, データ);
    制度を描く(最新判定);
    グラフを描く();
    資産を描く();
    落とし穴を描く(最新入力, 最新判定);
    プロンプトを描く(最新入力, 最新判定);
    ['stage1', 'stage2', 'stage2b', 'stage3', 'stage4'].forEach(function (id) { $(id).classList.add('shown'); });
    /* いちばん見てほしいのは、貯金のグラフの冒頭のまとめ。そこに目線を合わせる */
    var 先 = $('stage2b');
    if (先 && 先.scrollIntoView) { 先.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }

  /* ---------- 起動 ---------- */
  function 起動() {
    document.querySelectorAll('.escape-btn').forEach(function (b) { b.addEventListener('click', 退避); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { 退避(); } });

    try {
      読み込む();

      見本ボタンを描く();
      子ども欄を作る(1, [null]);
      $('child-count').addEventListener('change', function () {
        子ども欄を作る(parseInt(this.value, 10) || 0, 子どもの年齢たち());
        進路欄を作る(子どもの年齢たち());
      });
      $('children-box').addEventListener('change', function () { 進路欄を作る(子どもの年齢たち()); });
      使っている制度欄を作る();
      進路欄を作る([]);
      document.querySelectorAll('input[name="status"]').forEach(function (r) {
        r.addEventListener('change', 婚姻状態を反映);
      });
      婚姻状態を反映();

      var sl = $('parent-end-age');
      sl.min = データ.tables.parent_support_end_age_min;
      sl.max = データ.tables.parent_support_end_age_max;
      sl.value = データ.tables.parent_support_end_age_default;
      $('parent-end-age-out').textContent = sl.value + '歳';
      sl.addEventListener('input', function () {
        $('parent-end-age-out').textContent = this.value + '歳';
        if (最新入力) { 最新入力.parentSupportEndAge = parseInt(this.value, 10); グラフを描く(); }
      });

      $('calc').addEventListener('click', 計算する);
      コピー設定();
      飛び先を開く();
      $('loading').style.display = 'none';
      $('form-area').style.display = '';
    } catch (err) {
      $('loading').innerHTML = '<p class="pit red">画面のもとになるデータを読み込めませんでした。' +
        'フォルダの中身がそろっているか確かめてください（data というフォルダの中の3つのファイルが必要です）。</p>';
      if (window.console) { console.error(err); }
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', 起動); }
  else { 起動(); }
}());
