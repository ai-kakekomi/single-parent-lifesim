/* ============================================================
 * app.js  画面のうごき
 * ============================================================ */
(function () {
  'use strict';

  var データ = null, 見本 = null, 落とし穴 = null;
  var 最新入力 = null, 最新判定 = null, 最新シミュ = null;
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
        '<div class="prog ' + r.status + '" id="prog-' + esc(p.id) + '">' +
        '<h4>' + esc(p.name) + ' <span class="badge ' + r.status + '">' + esc(r.label) + '</span></h4>' +
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
    var 該当 = 判定.results.filter(function (r) { return r.status === 'likely'; }).length;
    var 要確認 = 判定.results.filter(function (r) { return r.status === 'check'; }).length;
    $('stage1-summary').innerHTML =
      '入力の内容から、<strong>' + 該当 + '件</strong>が対象になりそうです。あわせて<strong>' + 要確認 + '件</strong>は、' +
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
      '<p class="hint">たての線は、制度が切りかわって金額が変わるところです。グラフの上を指でなぞる（マウスを乗せる）と、その年の金額が出ます。</p>' +
      SPSChart.表(y, グラフの見方) +
      崖の説明(最新シミュ.cliffs) + お金以外の注意();

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

  function 崖の説明(cliffs) {
    if (!cliffs.length) { return ''; }
    return '<h3>金額が変わるところ</h3><ul class="hint">' + cliffs.map(function (c) {
      return '<li>いちばん下のお子さんが <strong>' + c.youngestAge + '歳</strong> のとき: ' + esc(c.label) + '</li>';
    }).join('') + '</ul>';
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
      return '<div class="pit ' + it.tone + '">' +
        '<h4>' + (it.tone === 'red' ? '🔴 ' : '🟡 ') + esc(it.headline || it.title) + '</h4>' +
        '<details><summary>くわしく読む</summary><div class="pit-detail">' + 中身(it) + '</div></details>' +
        '</div>';
    }

    $('stage3-body').innerHTML =
      チェックリストを描く(やること) +
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
    落とし穴を描く(最新入力, 最新判定);
    プロンプトを描く(最新入力, 最新判定);
    ['stage1', 'stage2', 'stage3', 'stage4'].forEach(function (id) { $(id).classList.add('shown'); });
    if ($('stage1').scrollIntoView) { $('stage1').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
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
      });
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
