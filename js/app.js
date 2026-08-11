/* ============================================================
 * app.js  画面のうごき
 * ============================================================ */
(function () {
  'use strict';

  var データ = null, 見本 = null, 落とし穴 = null;
  var 最新入力 = null, 最新判定 = null, 最新シミュ = null;
  var 最新資産 = null;
  var 資格ルートを出したところ = false;   // 線を伸ばす動きは、出した直後の1回だけ
  var グラフの見方 = 'perPerson';   // 'perPerson' ひとりあたり ／ 'total' 家ぜんたい

  function $(id) { return document.getElementById(id); }
  /** 画面が狭いか（スマートフォンのとき、グラフを縦長にする） */
  function 狭い画面() {
    return (window.innerWidth || document.documentElement.clientWidth || 0) < 600;
  }
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

  /* ---------- 生活費のうちわけ（任意） ----------
     入れた合計を「毎月の生活費」に自動で入れます。
     よその家庭の平均と比べることはしません（世帯の人数や地域で大きく変わるため）。
     かわりに、その方自身の生活費の中で何が重いかを、割合で見せます。 */
  var 費目 = [
    { id: 'cost-food', name: '食費' },
    { id: 'cost-utility', name: '水道・光熱費' },
    { id: 'cost-comm', name: '通信費' },
    { id: 'cost-insurance', name: '保険料' },
    { id: 'cost-other', name: 'そのほか' }
  ];

  function うちわけを読む() {
    var 出 = { items: [], total: 0, 入力あり: false };
    費目.forEach(function (f) {
      var v = 数(f.id);
      if (v > 0) { 出.入力あり = true; }
      出.items.push({ id: f.id, name: f.name, value: v });
      出.total += v;
    });
    return 出;
  }

  function うちわけを反映() {
    var u = うちわけを読む();
    if (!u.入力あり) {
      $('cost-total').textContent = '';
      $('cost-advice').innerHTML = '';
      return;
    }
    $('living-cost').value = u.total;
    $('cost-total').innerHTML = '合計 <strong>' + SPS.円(u.total) + '</strong>（この金額を、上の「毎月の生活費」に入れました）';
    $('cost-advice').innerHTML = うちわけの見立て(u);
    if (最新入力) {
      最新入力.livingCost = u.total;
      資産を描く();
    }
  }

  /** 入れてもらったうちわけから、見直しの候補を出す（断言はしない） */
  function うちわけの見立て(u) {
    var h = ['<p class="cost-share-head">生活費の中での割合</p><ul class="cost-share">'];
    u.items.forEach(function (it) {
      if (it.value <= 0) { return; }
      var 割 = Math.round(it.value / u.total * 100);
      h.push('<li><span class="cost-name">' + esc(it.name) + '</span>' +
        '<span class="cost-bar"><span style="width:' + Math.min(100, 割) + '%"></span></span>' +
        '<span class="cost-pct">' + 割 + '%</span></li>');
    });
    h.push('</ul>');

    /* 母子世帯の平均とのくらべ（比べられる費目だけ） */
    var 参 = データ.living_cost_reference;
    if (参) {
      h.push('<p class="cost-share-head">母子世帯の平均とくらべると</p><ul class="cost-ref">');
      u.items.forEach(function (it) {
        if (it.value <= 0) { return; }
        var 目安 = 参.monthly[it.id];
        if (目安 == null) {
          h.push('<li><span class="cost-name">' + esc(it.name) + '</span><span class="cost-ref-v">' +
            '比べられる統計がありません</span></li>');
          return;
        }
        var 差 = it.value - 目安;
        var 語 = (Math.abs(差) < 目安 * 0.15) ? '平均くらい'
          : (差 > 0 ? '平均より ' + SPS.円(差) + ' 多い' : '平均より ' + SPS.円(-差) + ' 少ない');
        h.push('<li><span class="cost-name">' + esc(it.name) + '</span>' +
          '<span class="cost-ref-v">' + esc(語) + '</span>' +
          '<span class="cost-ref-b">（平均 ' + SPS.円(目安) + '）</span></li>');
      });
      h.push('</ul>');
      h.push('<p class="hint">くらべているのは、' + esc(参.household) + 'の平均です。' +
        esc(参.caution) + esc(参.not_available_note) + '<br>' +
        '<span class="src">出典: <a href="' + esc(参.source.url_detail) + '" target="_blank" rel="noopener">' +
        esc(参.source.law) + '</a>（' + 日付表示(参.source.last_verified) + '確認）</span></p>');
    }

    var 候補 = [];
    function 割合(id) {
      var it = u.items.filter(function (x) { return x.id === id; })[0];
      return (it && u.total > 0) ? it.value / u.total : 0;
    }
    function 目安差(id) {
      var it = u.items.filter(function (x) { return x.id === id; })[0];
      var 目安 = 参 && 参.monthly[id];
      return (it && 目安) ? it.value - 目安 : 0;
    }
    if (割合('cost-comm') >= 0.12 || 目安差('cost-comm') >= 5000) {
      候補.push('<strong>通信費</strong>が生活費の' + Math.round(割合('cost-comm') * 100) + '%' +
        (目安差('cost-comm') >= 5000 ? '、母子世帯の平均より ' + SPS.円(目安差('cost-comm')) + ' 多い状態' : '') +
        'です。プランや会社を変えて下がったという家庭は多いです。いまの契約内容を見るところから始めてみてください。');
    }
    if (割合('cost-insurance') >= 0.10) {
      候補.push('<strong>保険料</strong>が生活費の' + Math.round(割合('cost-insurance') * 100) +
        '%を占めています。公的な保障でまかなえる部分を確かめてから、足りない分だけ掛け捨てで持つ、という順で見直せます。' +
        '<a href="#pit-chochiku_hoken">保険についての説明を見る</a>');
    }
    if (割合('cost-food') >= 0.45) {
      候補.push('<strong>食費</strong>が生活費の' + Math.round(割合('cost-food') * 100) +
        '%を占めています。こども食堂やフードパントリーなど、食の支援が使えるかもしれません。学校の給食費は就学援助の対象です。' +
        '<a href="#prog-shoku_shien">食の支援を見る</a>');
    }
    if (候補.length) {
      h.push('<p class="cost-advice-head">見直しの候補</p><ul class="cost-advice-list">' +
        候補.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul>');
      h.push('<p class="hint">平均より多いからといって、使いすぎということではありません。' +
        '世帯の人数も、住んでいる場所も、事情も違います。見直す候補として見てください。</p>');
    } else {
      h.push('<p class="hint">とくに目立って重い費目はありませんでした。</p>');
    }
    return h.join('');
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

  /* ---------- 資格を取って抜けるルート ---------- */
  function 訓練の入力() {
    var on = $('training-on') && $('training-on').checked;
    var t = データ.training || {};
    var いま = 数('my-income') * 10000;
    var 働き方 = 選択('training-work') || 'half';
    var 中;
    switch (働き方) {
      case 'none': 中 = 0; break;
      case 'same': 中 = いま; break;
      case 'custom': 中 = 数('training-during') * 10000; break;
      default: 中 = Math.floor(いま * (t.during_income_ratio_default || 0.5));
    }
    return {
      enabled: !!on,
      years: parseInt(($('training-years') || {}).value, 10) || t.years_default,
      work: 働き方,
      duringIncome: 中,
      afterIncome: 数('training-after') * 10000
    };
  }

  function 訓練欄を反映() {
    var on = $('training-on').checked;
    $('training-box').style.display = on ? '' : 'none';
    $('training-during-row').style.display = (選択('training-work') === 'custom') ? '' : 'none';
    if (on && !数('training-after')) {
      /* 何も入っていないと線が引けないので、いまの年収を初期値として置く */
      $('training-after').value = Math.max(Math.round(数('my-income')), 200);
    }
    if (最新入力) { 最新入力.training = 訓練の入力(); 資産を描く(); }
  }

  /* ---------- 塾・習いごとにかけるお金 ---------- */
  function 塾の入力() {
    var 決め方 = 選択('juku-mode') || 'average';
    return { useAverage: (決め方 === 'average'), monthly: 数('juku-cost') };
  }
  function 塾欄を反映() {
    var 自分で = (選択('juku-mode') === 'custom');
    $('juku-row').style.display = 自分で ? '' : 'none';
    if (最新入力) { 最新入力.juku = 塾の入力(); 資産を描く(); }
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
      training: 訓練の入力(),
      plans: 進路プラン(),
      juku: 塾の入力(),
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
    document.querySelectorAll('.cost-item').forEach(function (el) { el.value = ''; });
    $('cost-total').textContent = '';
    $('cost-advice').innerHTML = '';
    $('living-cost').value = i.livingCost;
    $('current-savings').value = i.currentSavings || 0;
    document.querySelectorAll('.used-prog').forEach(function (el) {
      el.checked = (i.usedPrograms || []).indexOf(el.value) >= 0;
    });
    /* 資格ルートは、いつも切った状態から始める。
       まず「いまのまま」の現実だけを見てもらい、
       ボタンを押したときに線が現れる体験にするため。 */
    var j = i.juku || { useAverage: true };
    var jEl = document.querySelector('input[name="juku-mode"][value="' + (j.useAverage ? 'average' : 'custom') + '"]');
    if (jEl) { jEl.checked = true; }
    $('juku-cost').value = j.monthly ? j.monthly : '';
    $('juku-row').style.display = j.useAverage ? 'none' : '';

    var tr = i.training || { enabled: false };
    $('training-on').checked = false;
    $('training-years').value = String(tr.years || 2);
    var w = tr.work || 'half';
    var wEl = document.querySelector('input[name="training-work"][value="' + w + '"]');
    if (wEl) { wEl.checked = true; }
    $('training-during').value = tr.duringIncome ? Math.round(tr.duringIncome / 10000) : '';
    $('training-during-row').style.display = (w === 'custom') ? '' : 'none';
    $('training-after').value = tr.afterIncome ? Math.round(tr.afterIncome / 10000) : '';
    $('training-box').style.display = 'none';
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
    $('sample-note').innerHTML = '<strong>記入例が入りました。内容を見ながら下に進んでください。</strong><br>' +
      esc('「' + s.label + '」（架空の例です）。' + s.story);
    $('sample-note').classList.add('shown-note');
    光らせる();
    計算する(false);
  }

  /* 値が入った欄を、いったん色づけしてから、ゆっくり元にもどす。
     どこに何が入ったのかを、目で追えるようにするため。
     動きを減らす設定にしている方には、色づけをしない。 */
  function 光らせる() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    var 対象 = [];
    document.querySelectorAll('#form-area input, #form-area select').forEach(function (el) {
      if (el.type === 'radio' || el.type === 'checkbox') {
        if (el.checked) { 対象.push(el.closest('label') || el); }
      } else if (String(el.value).trim() !== '') {
        対象.push(el);
      }
    });
    対象.forEach(function (el) { el.classList.remove('flash'); });
    /* いったん描き直させてから色をつけると、続けて押したときも光る */
    void document.body.offsetWidth;
    対象.forEach(function (el) { el.classList.add('flash'); });
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        対象.forEach(function (el) { el.classList.remove('flash'); });
      });
    });
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
        '<h4>' + esc(p.name) + 返済バッジ(p) +
        (使用中[p.id] ? ' <span class="badge used">✓ 利用中</span>'
                      : ' <span class="badge ' + r.status + '">' + esc(r.label) + '</span>') + '</h4>' +
        '<p>' + esc(p.summary) + '</p>' +
        (r.amountText ? '<p class="amount">' + esc(r.amountText) + '</p>' : '') +
        (r.status !== 'unlikely' ? '<p>' + esc(p.benefit_summary) + '</p>' : '') +
        (r.note ? '<p class="hint">' + esc(r.note) + '</p>' : '') +
        (p.misunderstanding_note ? '<p class="misunderstanding">' + esc(p.misunderstanding_note) + '</p>' : '') +
        (p.repayment_note ? '<p class="hint">' + esc(p.repayment_note) + '</p>' : '') +
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

  /** 返さなくていいお金か、あとで返すお金かを、ひと目で分かるようにする */
  function 返済バッジ(p) {
    if (p.repayment === 'loan') {
      return ' <span class="badge loan">あとで返す</span>';
    }
    if (p.repayment === 'none') {
      return ' <span class="badge grant">返さなくていい</span>';
    }
    return '';
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
      '<div class="chart-box">' + SPSChart.描く(y, 最新シミュ.cliffs, グラフの見方, 狭い画面()) + '</div>' +
      崖の説明(最新シミュ.cliffs) +
      '<p class="hint">グラフの上を指でなぞる（マウスを乗せる）と、その年の金額が出ます。' +
      '<a href="#stage2b">このグラフが置いている前提を見る</a></p>' +
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
      $('stage2b-body').innerHTML = '<p class="hint">「毎月の生活費」を入れると、貯金シミュレーションのグラフが出ます。' +
        '食費・光熱費・通信費・日用品などの合計のめやすで大丈夫です（家賃と学校のお金はのぞきます）。</p>';
      return;
    }
    最新資産 = SPS.資産カーブ(入力, データ);
    var c = 最新資産;
    if (c.training) { c.training.animate = 資格ルートを出したところ; }
    資格ルートを出したところ = false;

    var 頭 = 不足の警告カード(c);

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

    var 上がる = (c.safetyTargetEnd > c.safetyTargetNow)
      ? 'この金額は、お子さんが大きくなって生活費が上がるにつれて、末子22歳のころには ' +
        SPS.円(c.safetyTargetEnd) + ' まで上がります。' : '';
    var 到達;
    if (c.alreadyReachedSafety) {
      到達 = '<strong>生活防衛資金（いまなら生活費の半年分 ' + SPS.円(c.safetyTargetNow) +
        '）は、すでに貯め終えています。</strong>次の段階を考えはじめてもよい段階です。' + 上がる;
    } else if (c.reachMonths !== null) {
      到達 = '生活防衛資金（いまなら生活費の半年分 ' + SPS.円(c.safetyTargetNow) +
        '）にとどくまで、いまのペースで <strong>約' + SPS.年月表示(c.reachMonths) + '</strong> です。' + 上がる;
    } else {
      到達 = '生活防衛資金（いまなら生活費の半年分 ' + SPS.円(c.safetyTargetNow) +
        '）には、いまのペースではとどきません。' + 上がる;
    }
    if (c.fallsBelowSafetyAgain) {
      到達 += '<br><strong>いちど届いたあと、' + (月を年齢で(c, c.fallsBelowSafetyAgainAtMonth) || '') +
        'にまた下回ります。</strong>生活費が上がって、必要な額のほうが先に伸びるからです。';
    }

    /* グラフのすぐ下に家計の表を置く。
       グラフを見ながら指で年をなぞって、そのまま内訳を読めるようにするため。 */
    $('stage2b-body').innerHTML =
      伸びしろ +
      SPSChart.資産の凡例(!!(c.training && c.training.afterIncome > 0), SPSChart.一本にまとめるか(c)) +
      線の本数の注記(c) +
      '<div class="chart-box" id="curve-chart">' + SPSChart.資産を描く(c, 狭い画面(), 選んだ年) + '</div>' +
      打ち切りの注記(c) +
      うちわけ表を描く(c) +
      頭 + 資格ルートの説明(c) +
      道筋を描く(道筋(入力, データ, c, 最新判定)) +
      '<p class="band-line">' + 到達 + '</p>' +
      '<details class="explain"><summary>生活防衛資金って？（くわしく）</summary>' + 防衛資金の説明() + '</details>' +
      赤字の警告(c) +
      学費の説明(c) +
      前提のボックス(c);

    /* つまみを動かしているあいだ、画面ぜんぶを作り直すと、
       指でつかんでいるつまみ自体が消えてドラッグが途切れる。
       だから、表とグラフの中身だけを入れかえる。 */
    function 見ている年を反映(c2) {
      var 並び2 = 選んだ並び(c2);
      var 出 = $('balance-year-out');
      if (出) { 出.textContent = 並び2[選んだ年].youngestAge + '歳'; }
      var 体 = $('balance-body');
      if (体) { 体.innerHTML = 表の中身(c2); }
      var 絵 = $('curve-chart');
      if (絵) { 絵.innerHTML = SPSChart.資産を描く(c2, 狭い画面(), 選んだ年); }
    }

    var 年欄 = $('balance-year');
    if (年欄) {
      年欄.addEventListener('input', function () {
        選んだ年 = parseInt(this.value, 10) || 0;
        見ている年を反映(c);
      });
      年欄.addEventListener('change', function () {
        選んだ年 = parseInt(this.value, 10) || 0;
        見ている年を反映(c);
      });
    }
    document.querySelectorAll('button[data-scenario]').forEach(function (b2) {
      b2.addEventListener('click', function () {
        選んだ線 = b2.getAttribute('data-scenario');
        資産を描く();
      });
    });

    var cta = $('go-training');
    if (cta) { cta.addEventListener('click', 資格ルートを開く); }
  }

  /* ============================================================
   * あなたの場合の道筋
   *
   *   このツールの約束: どんな入力でも、
   *   「次の一手 → それでこうなる」が、数字つきで必ず1つ以上出ること。
   *   だからこの関数は、けっして空の配列を返しません。
   * ============================================================ */
  function 道筋(入力, データ, c, 判定) {
    var 道 = [];
    function 足す(見出し, 本文, リンク, リンク名) {
      道.push({ head: 見出し, body: 本文, href: リンク || null, linkName: リンク名 || 'くわしく見る' });
    }
    function 別の場合(変える) {
      return SPS.資産カーブ(Object.assign({}, 入力, 変える), データ);
    }

    /* --- 1. 使っていない制度で、赤字が黒字になるか --- */
    if (c.gaps.length) {
      var 名 = c.gaps.map(function (g) { return データ.programs_by_id[g.id].name.replace(/（.*$/, ''); }).join('・');
      if (c.monthlyBalanceNow < 0 && c.monthlyBalance >= 0) {
        足す('いま申請すれば、毎月の赤字がなくなります',
          esc(名) + ' を申請すると、毎月 ' + SPS.円(c.gapMonthly) + ' 入ります。' +
          'いまは毎月 ' + SPS.円(-c.monthlyBalanceNow) + ' 足りませんが、' +
          '<strong>申請すれば毎月 ' + SPS.円(c.monthlyBalance) + ' 残る計算になります。つまり黒字になります。</strong>',
          '#stage1', '申請先を見る');
      } else if (c.monthlyBalance < 0) {
        足す('申請すると、足りない額がここまで小さくなります',
          esc(名) + ' を申請すると、毎月 ' + SPS.円(c.gapMonthly) + ' 入ります。' +
          'いま足りないのは毎月 ' + SPS.円(-c.monthlyBalanceNow) + ' ですが、' +
          '<strong>申請すれば ' + SPS.円(-c.monthlyBalance) + ' まで小さくなります。</strong>' +
          '残りは、就学援助（給食費）やこども食堂などで埋められる大きさです。',
          '#stage1', '申請先を見る');
      } else {
        var 早まる = (c.reachMonthsNow !== null && c.reachMonths !== null)
          ? c.reachMonthsNow - c.reachMonths : null;
        var 文 = esc(名) + ' を申請すると、毎月 ' + SPS.円(c.gapMonthly) + ' 入ります。' +
          '10年で約' + Math.round(c.diffAtTenYears / 10000).toLocaleString('ja-JP') + '万円の差です。';
        if (早まる && 早まる > 0) {
          文 += '<strong>生活防衛資金にとどくのが、' + SPS.年月表示(早まる) + ' 早まります。</strong>';
        } else if (c.reachMonthsNow === null && c.reachMonths !== null) {
          文 += '<strong>いまのままでは生活防衛資金（生活費の半年分）にとどきませんが、申請すれば ' +
            SPS.年月表示(c.reachMonths) + ' でとどきます。</strong>';
        }
        足す('まだ受け取れるお金があります', 文, '#stage1', '申請先を見る');
      }
    }

    /* --- 2. 資格を取るルート --- */
    var t = c.training;
    if (t && t.afterIncome > 0) {
      if (t.crossesOver) {
        var いつ = (t.crossoverOffset <= 1)
          ? '<strong>通いはじめて1年で</strong>'
          : '<strong>' + t.crossoverOffset + '年後に</strong>';
        足す('資格を取る道なら、' + (t.crossoverOffset <= 1 ? '1年で追い越します' : t.crossoverOffset + '年後に追い越します'),
          '学校に通う' + t.years + '年のあいだ、高等職業訓練促進給付金が毎月 ' + SPS.円(t.grantMonthly) +
          '（最後の1年はさらに ' + SPS.円(t.grantFinalYearBonus) + '）入ります。' +
          'そのおかげで、' + いつ + '「いまのまま」の線を追い越します。' +
          (t.reachSafetyOffset !== null
            ? '生活防衛資金にとどくのは、' + (t.reachSafetyOffset === 0 ? 'すぐ' : t.reachSafetyOffset + '年後') + 'です。' : '') +
          '22歳のときの貯金は、約' + Math.round(t.finalAll / 10000).toLocaleString('ja-JP') + '万円になります。' +
          '<strong>令和5年度は、この給付金で2,988人が資格を取り、2,105人が就職しています。</strong>' +
          '窓口は、市・区にお住まいならその市・区、町村にお住まいなら都道府県です。',
          '#prog-koutou_shokugyo_kunren', 'この給付金のくわしい説明を見る');
      } else {
        足す('資格を取る道は、この見込みでは追い越しません',
          '入れていただいた「資格を取ったあとの年収 ' + SPS.円(t.afterIncome) + '」だと、' +
          '通う' + t.years + '年間の落ち込みを取り戻せない計算です。正直にお伝えします。' +
          '年数を短くするか、資格を取ったあとの年収の見込みを変えて、もう一度見てください。' +
          'どの資格ならどのくらいの収入になるかは、下の「仕事・収入の相談」の文章をAIに渡すと調べられます。',
          '#stage4', 'AIに聞く文章を見る');
      }
      if (t.hitsBorrowFloor) {
        足す('ただし、通っているあいだの生活が持ちません',
          '学校に通う期間中に、借りられる上限にぶつかる計算です。' +
          'この期間は、母子父子寡婦福祉資金の技能習得資金・生活資金の貸付や、' +
          '生活保護との併用が使えることがあります。通いはじめる前に、必ず窓口で相談してください。',
          '#prog-fukushi_shikin_kashitsuke', '貸付のくわしい説明を見る');
      }
    } else if (!t || !t.enabled) {
      var 現年収 = 入力.myIncome;
      if (現年収 > 0 && 現年収 < 2500000) {
        足す('資格を取って抜ける道も、数字で見られます',
          '学校に通うあいだ、高等職業訓練促進給付金が毎月 ' +
          SPS.円((データ.training || {}).monthly_non_taxable || 100000) +
          '（住民税が非課税の世帯の場合）入ります。' +
          '上の入力欄の「資格を取って収入を上げる道も見てみる」にチェックを入れると、' +
          'この道を選んだ場合の線がグラフに増えます。',
          '#prog-koutou_shokugyo_kunren', 'この給付金のくわしい説明を見る');
      }
    }

    /* --- 3. 養育費を取り決めた場合の差（受け取っていない方むけ） --- */
    if (入力.childSupportState.indexOf('取り決めている') === -1) {
      var いま受取 = 入力.divorced_childSupportMonthly || 0;
      var 見込み = いま受取 > 0 ? いま受取 : 40000;
      var 差, 養;
      if (いま受取 > 0) {
        /* すでに見込みの額を入れている場合は、取り決めなかったときとの差を出す */
        養 = 別の場合({ divorced_childSupportMonthly: 0, childSupportMonthly: 0 });
        差 = c.finalAll - 養.finalAll;
      } else {
        養 = 別の場合({ divorced_childSupportMonthly: 見込み, childSupportMonthly: 見込み });
        差 = 養.finalAll - c.finalAll;
      }
      if (差 > 0) {
        足す('養育費を取り決めると、22歳までで約' + Math.round(差 / 10000).toLocaleString('ja-JP') + '万円ちがいます',
          '月 ' + SPS.円(見込み) + ' を受け取れた場合の計算です。' +
          '児童扶養手当は養育費の8割が所得に入るので、手当が少し減ります。それを差し引いても、この額が残ります。' +
          '公正証書にしておけば、あとから差し押さえもできます。費用は数万円です。',
          '#prog-youikuhi', '手続きのくわしい説明を見る');
      }
    }

    /* --- 4. 収入の崖（働き控えが要るかどうかを、数字で） --- */
    var j = 判定.jidoFuyoTeate;
    if (j && (j.status === 'full' || j.status === 'partial')) {
      var 余裕 = j.limits.full - j.income;
      if (j.status === 'full' && 余裕 >= 0 && 余裕 < 300000) {
        var 増 = 別の場合({ myIncome: 入力.myIncome + 200000 });
        var 手取り差 = 増.points[0].monthlyAll - c.points[0].monthlyAll;
        足す('あと ' + SPS.円(余裕) + ' 稼ぐと、手当が減りはじめます',
          'いまは全部支給のぎりぎりの内側です。年収を20万円ふやすと、' +
          (手取り差 >= 0
            ? '手当は減りますが、<strong>手元に残るお金は月 ' + SPS.円(手取り差) + ' ふえます。働き控えをする必要はありません。</strong>'
            : '<strong>手元に残るお金は月 ' + SPS.円(-手取り差) + ' 減ります。この範囲で増やすなら、いまのままのほうが得です。</strong>') +
          '「働きすぎると損」ではなく、どこを越えると損かを知っておくのが大事です。',
          '#pit-shunyu_no_gake', 'くわしい説明を見る');
      }
    }

    /* --- 5. 学費の山への備え（もう帯を越えている方むけ） --- */
    if (c.alreadyReachedSafety && c.tuitionTotal > 0) {
      var 児手累計 = 0;
      c.points.forEach(function (pt) { 児手累計 += 0; });
      var 児手月 = SPS.児童手当(入力.children, データ.programs_by_id.jido_teate.eligibility).monthly;
      var 埋まる = Math.min(100, Math.round(児手月 * 12 * c.points.length / c.tuitionTotal * 100));
      足す('次に備えるのは、学費の山です',
        'これからかかる学校のお金は、合計およそ ' +
        Math.round(c.tuitionTotal / 10000).toLocaleString('ja-JP') + '万円です。' +
        '<strong>児童手当（いま月 ' + SPS.円(児手月) + '）を使わずに全部ためておくだけで、その約' + 埋まる + '%がまかなえます。</strong>' +
        '進路の見込みを変えると、この金額がどう動くかも見られます。',
        '#stage4', 'お金の守り方をAIに聞く文章を見る');
    }

    /* --- 6. 親の援助が終わるまでの猶予 --- */
    if (入力.parentSupportMonthly > 0 && 入力.parentAge) {
      var 終わり = (入力.parentSupportEndAge || データ.tables.parent_support_end_age_default) - 入力.parentAge;
      if (終わり > 0) {
        足す('援助があるうちに、やっておけることがあります',
          '親御さんからの月 ' + SPS.円(入力.parentSupportMonthly) + ' の援助は、あと ' + 終わり + '年ほどの想定です。' +
          'この間は、ふつうより毎月それだけ多く残せます。' +
          '<strong>この' + 終わり + '年で、生活防衛資金をためきることと、資格を取ることの両方ができます。</strong>' +
          '援助が止まってからでは、どちらも難しくなります。',
          '#prog-koutou_shokugyo_kunren', '資格の給付金を見る');
      }
    }

    /* --- 7. どうしても数字が動かないとき --- */
    if (!道.length || c.monthlyBalance < 0) {
      足す('生活保護は、負けではありません。やり直すための土台です',
        '数字の上では、いまの収入と支出のままでは足りません。でも、そこで終わりではありません。' +
        '生活保護は<strong>権利</strong>です。一時的に受けて、生活を立て直し、資格を取って、抜けていく方はたくさんいます。' +
        '医療費の自己負担もなくなるので、体を治すこともできます。' +
        '「車があるから」「持ち家だから」と自分で判断せず、まず福祉事務所で聞いてください。' +
        'ひとりで行くのが不安なら、支援団体に付き添いを頼めます。',
        '#prog-seikatsu_hogo', '相談先を見る');
    }

    /* --- 8. 最後の受け皿（かならず1つは出る） --- */
    足す('お住まいの地域だけの制度が、まだ残っています',
      'このツールが見ているのは、全国どこでも同じ制度だけです。' +
      '市区町村ごとの医療費の助成、水道料金の減免、交通機関の割引、保育料の軽減などは入っていません。' +
      '下の「4. 住んでいる地域の制度を調べる」の文章をAIに渡すと、あなたの地域のものを洗い出せます。',
      '#stage4', 'AIに聞く文章を見る');

    return 道;
  }

  function 道筋を描く(道) {
    var h = ['<div class="path-block"><h3>あなたの場合の道筋</h3>',
      '<p class="hint">入力の内容から、いまのあなたに効く順に出しています。全部やらなくて大丈夫です。</p>'];
    道.forEach(function (o, i) {
      h.push('<div class="path-item"><p class="path-head"><span class="path-no">' + (i + 1) + '</span>' +
        esc(o.head) + '</p><p class="path-body">' + o.body + '</p>' +
        (o.href ? '<p class="path-link"><a href="' + esc(o.href) + '">' + esc(o.linkName) + '</a></p>' : '') +
        '</div>');
    });
    h.push('</div>');
    return h.join('');
  }

  function 資格ルートの説明(c) {
    var t = c.training;
    if (!t || !(t.afterIncome > 0)) { return ''; }
    var 訓 = データ.training;
    var h = ['<div class="notice"><h4>むらさきの線「資格を取るルート」について</h4>'];
    var 働き方の文 = (t.duringIncome === 0)
      ? '学校に通う' + t.years + '年間は<strong>働かない</strong>ものとして計算しています。'
      : '学校に通う' + t.years + '年間の収入を、年 ' + SPS.円(t.duringIncome) + ' として計算しています。';
    h.push('<p style="margin:.3rem 0">' + 働き方の文 +
      '（この金額は上の入力欄で変えられます。制度で決まった数字ではありません）' +
      'そのあいだ、高等職業訓練促進給付金が毎月 ' + SPS.円(t.grantMonthly) +
      '（最後の1年はさらに ' + SPS.円(t.grantFinalYearBonus) + '）入り、修了したときに ' +
      SPS.円(t.completionGrant) + ' 入ります。修了後は、入れていただいた見込みの年収 ' +
      SPS.円(t.afterIncome) + ' にうつるものとしています。</p>');
    h.push('<p class="hint" style="margin:.3rem 0">' + esc(訓.resident_tax_free_note) + '</p>');
    h.push('<p class="hint" style="margin:.3rem 0"><strong>' + esc(訓.assumption_note) + '</strong>' +
      esc(訓.after_income_note) + '</p>');
    h.push('<p class="hint" style="margin:.3rem 0">' + esc(訓.target_qualifications) + '</p>');
    h.push('<p class="track-record"><strong>この橋は、実際に渡れます。</strong>' + esc(訓.track_record) + '</p>');
    h.push('<p class="hint" style="margin:.3rem 0">' + esc(訓.window_note) + '</p>');
    h.push('<p class="hint" style="margin:.3rem 0">' + esc(訓.non_taxable_note) + '</p>');
    h.push('<p class="src">根拠: ' + esc(訓.source.law) + '／<a href="' + esc(訓.source.url) +
      '" target="_blank" rel="noopener">' + esc(訓.source.publisher) + 'のページを開く</a>（最終確認 ' +
      日付表示(訓.source.last_verified) + '）<br>実績の出典: <a href="' + esc(訓.track_record_source.url) +
      '" target="_blank" rel="noopener">' + esc(訓.track_record_source.law) + '</a>（最終確認 ' +
      日付表示(訓.track_record_source.last_verified) + '）</p>');
    h.push('</div>');
    return h.join('');
  }

  /* ---------- 足りないことのお知らせカード ----------
     数字を言いっぱなしにせず、その場から次の一手に進めるようにする。 */
  /** 何か月後かを「◯歳◯か月ごろ」に直す（いちばん下のお子さんの年齢で言う） */
  function 月を年齢で(c, 月番号) {
    if (月番号 == null || !c.points.length) { return null; }
    var 年 = Math.floor(月番号 / 12), か月 = 月番号 % 12;
    var 歳 = c.points[0].youngestAge + 年;
    if (か月 === 0) { return 歳 + '歳になるころ'; }
    return 歳 + '歳' + か月 + 'か月ごろ';
  }

  function 不足の警告カード(c) {
    var t = c.training;
    var 不足あり = (c.monthlyBalance < 0) || c.goesNegativeNow ||
      (c.goesNegative && c.shortfallMonthly);
    if (!不足あり) {
      var 入口 = (t && t.afterIncome > 0) ? ''
        : '<p class="quiet-cta"><button type="button" class="ghost" id="go-training">' +
          '収入を上げるルートも見てみる</button></p>';
      return '<p><strong>制度を活用すると、ひと月に約' + SPS.円(c.monthlyBalance) + ' 残る計算です。</strong></p>' + 入口;
    }

    /* 「いまのまま」と「制度活用」を、2段で言い分ける。
       グラフの印は「いまのまま」の線に打っているので、まずそちらを主語にする。 */
    var いま底 = 月を年齢で(c, c.negativeFromMonthNow);
    var 全部底 = 月を年齢で(c, c.negativeFromMonth);
    var 見出し, 説明;

    if (c.monthlyBalance < 0) {
      見出し = 'いま、毎月あと ' + SPS.円(-c.monthlyBalance) + ' 足りない状態です';
      説明 = '<strong>制度を活用しても、足りません。</strong>' +
        (全部底 ? 'このままだと、いちばん下のお子さんが' + 全部底 + 'に貯金が底をつきます。' : '') +
        'ただし、ここからできることがあります。';
    } else if (c.goesNegativeNow && !c.goesNegative) {
      見出し = 'いまのままだと、いちばん下のお子さんが' + いま底 + 'に貯金が底をつきます';
      説明 = '<strong>でも、制度を活用すれば、底をつきません。</strong>' +
        'グラフのひし形の印が、いまのままの線が0円を割るところです。' +
        'まだ申請していない制度を出すだけで、この危機はなくなります。';
    } else if (c.goesNegativeNow && c.goesNegative) {
      見出し = 'いまのままだと、いちばん下のお子さんが' + いま底 + 'に貯金が底をつきます';
      説明 = '制度を活用すると' +
        (全部底 ? '、' + 全部底 + 'まで延びます' : '、底をつかなくなります') +
        '。それでも足りない分は、下の手で埋めていきます。';
    } else {
      見出し = 'いちばん下のお子さんが' + (全部底 || '') + '、貯金が底をつく計算です';
      説明 = 'いまは足りています。その時期に、毎月あと ' + SPS.円(c.shortfallMonthly) +
        ' 足りなくなる見込みです。いまのうちに手を打てば、変えられます。';
    }

    var h = ['<div class="alert-card">'];
    h.push('<p class="alert-head">' + esc(見出し) + '</p>');
    h.push('<p class="alert-body">' + esc(説明) + '</p>');

    /* 資格ルートを出したあとの結果を、このカードに反映する */
    if (t && t.afterIncome > 0) {
      var 文;
      if (!t.goesNegative && (c.goesNegativeNow || c.goesNegative || c.monthlyBalance < 0)) {
        文 = '<strong>資格を取るルートなら、貯金が底をつきません。</strong>' +
          (いま底 ? 'いまのままだと' + いま底 + 'に底をつくところが、そうならなくなります。' : '') +
          (t.crossesOver
            ? (t.crossoverOffset === 0
              ? '通いはじめて1年で、いまのままの線を追い越します。'
              : t.crossoverOffset + '年後に、いまのままの線を追い越します。')
            : '');
        h.push('<p class="alert-good">' + 文 + '</p>');
      } else if (t.goesNegative) {
        文 = '資格を取るルートでも、通っているあいだは苦しくなる計算です' +
          (t.negativeFromOffset !== null && t.negativeFromOffset < t.years
            ? '（学校に通っている' + t.years + '年のうちに底をつきます）' : '') +
          '。この期間は、母子父子寡婦福祉資金の貸付や、生活保護との併用が使えることがあります。' +
          '通いはじめる前に、必ず窓口で相談してください。';
        h.push('<p class="alert-warn-more">' + 文 +
          ' <a href="#prog-fukushi_shikin_kashitsuke">貸付のくわしい説明を見る</a></p>');
      }
    }

    h.push('<div class="alert-actions">');
    if (!(t && t.afterIncome > 0)) {
      h.push('<button type="button" class="primary alert-cta pulse" id="go-training">' +
        '資格を取って収入を上げた場合を見る</button>');
    } else {
      h.push('<button type="button" class="ghost alert-cta" id="go-training">' +
        '資格を取るルートの設定を見直す</button>');
    }
    h.push('<a class="alert-sub" href="#gap-block">いますぐ月の穴を塞ぐ手を見る</a>');
    h.push('</div>');
    h.push('</div>');
    return h.join('');
  }

  /** カードのボタンから、資格ルートを出して設定までスクロールする */
  function 資格ルートを開く() {
    var 変えた = false;
    if (!$('training-on').checked) { $('training-on').checked = true; 変えた = true; 資格ルートを出したところ = true; }
    if (!数('training-after')) {
      $('training-after').value = Math.max(Math.round(数('my-income')), 200);
      変えた = true;
    }
    訓練欄を反映();   /* この中で1回だけ描き直す（2回描くと、線が伸びる動きが消えてしまう） */
    var 先 = $('training-box');
    if (先 && 先.scrollIntoView) { 先.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    var 入 = $('training-after');
    if (入 && 入.focus) { try { 入.focus(); } catch (e) { /* 気にしない */ } }
  }

  /* ---------- このグラフの前提 ----------
     甘く出るところ・厳しく出るところを、どちらも正直に書きます。 */
  function 前提のボックス(c) {
    var h = ['<div class="assumption-box"><h4>このグラフの前提</h4>'];
    h.push('<ul>');
    h.push('<li><strong>収入は、いまのまま変わらない前提です。</strong>昇給も、転職も、働く時間をふやすことも入れていません。' +
      '（資格を取るルートだけは別で、そこだけ収入が変わります）</li>');
    h.push('<li><strong>生活費は、いまと同じ金額がずっと続く前提です。</strong>' +
      '実際には、お子さんが中学生・高校生になると食費などが増えます。' +
      '<span class="warn-inline">その分、後半の線は甘め（実際より良く）に出ます。</span>' +
      'お子さんが大きくなったときの姿を見たいときは、生活費の欄を多めに入れて試してください。</li>');
    h.push('<li><strong>学校にかかるお金は、全国の平均値です。</strong>まん中の人の金額ではありません。' +
      'しかも、この金額には<strong>塾・習いごとの費用が入っています</strong>。' +
      '公立の小学校では、年366,599円のうち256,489円（7割）が塾・習いごとです。' +
      'この平均は収入の高い家庭に引っぱられて高めに出るので、' +
      '<strong>入力欄で自分の家に合った額に変えられます（0円にもできます）</strong>。' +
      '学校そのものにかかるお金（授業料・教材費・給食費など）とは分けて計算しています。' +
      'また、1年ぶんの金額を<strong>12か月に等分して</strong>引いています。' +
      '入学金のように実際は一度に出ていくお金も、ならして引いているので、' +
      '入学の月の落ち込みは実際よりゆるやかに出ます。</li>');
    h.push('<li><strong>グラフに入れているのは、返さなくていいお金だけです。</strong>' +
      '貸付（あとで返すお金）は、収入として数えていません。' +
      '借りれば一時的に貯金はふえますが、あとで返すぶん、実際には楽になっていないからです。</li>');
    h.push('<li><strong>高校の学費は、就学支援金を引いたあとの金額です。</strong>' +
      'もとにしている調査の金額が、保護者が実際に払った額だからです。二重には引いていません。' +
      '大学の学費からは、修学支援新制度の減免と給付型奨学金を引いています（申請した場合の線のみ）。</li>');
    h.push('<li><strong>小学校・中学校の就学援助は、差し引いていません。</strong>' +
      '市区町村ごとに金額が違い、国の目安を確かめられなかったためです。' +
      '実際の負担は、ここに出る金額より軽くなります。</li>');
    h.push('<li><strong>生活防衛資金の線も、右肩上がりです。</strong>' +
      '生活費の半年分なので、お子さんが大きくなって生活費が上がると、目標の額も上がります。</li>');
    h.push('<li><strong>手当は、毎年その年のお子さんの年齢で計算し直しています。</strong>' +
      '児童扶養手当も児童手当も、年齢で切れるところがあります。そこがグラフの段差になります。</li>');
    h.push('<li><strong>物価の上昇と、これから先の制度改正は入れていません。</strong></li>');
    if (c.startSavings > 0) {
      h.push('<li>いまの貯金 ' + SPS.円(c.startSavings) + ' を出発点にしています。</li>');
    } else {
      h.push('<li>いまの貯金を入れていないので、<strong>0円から始まる</strong>ものとして描いています。</li>');
    }
    h.push('<li>ここに出る金額は、すべて<strong>概算</strong>です。正確な額は市区町村の窓口で確認してください。</li>');
    h.push('</ul></div>');
    return h.join('');
  }

  function 線の本数の注記(c) {
    if (!SPSChart.一本にまとめるか(c)) { return ''; }
    if (c.gaps.length) {
      return '<p class="hint">「いまのまま」と「制度活用」の差がごくわずかなので、' +
        '線は1本にしています。</p>';
    }
    return '<p class="hint"><strong>制度はすでに使いきっています。線は1本です。</strong>' +
      'このツールが自動で判定できる制度に、取りこぼしは見あたりませんでした。</p>';
  }

  /* ============================================================
   * 家計のうちわけ表
   *   グラフの「なぜこの年に落ちるのか」を、その年の月ごとの収支で確かめる。
   * ============================================================ */
  var 選んだ年 = 0;
  var 選んだ線 = 'all';   // 'all' 制度活用 ／ 'now' いまのまま ／ 'training' 資格ルート

  /** お子さんの呼び名（上のお子さん・下のお子さん・上から◯人目） */
  function 子の呼び名(index, 年齢たち) {
    var n = (年齢たち || []).length;
    if (n <= 1) { return 'お子さん'; }
    var 順 = 年齢たち.map(function (a, i) { return { a: a, i: i }; })
      .sort(function (x, y) { return y.a - x.a; });
    var 位置 = 0;
    順.forEach(function (o, k) { if (o.i === index) { 位置 = k + 1; } });
    if (n === 2) { return (位置 === 1) ? '上のお子さん' : '下のお子さん'; }
    return '上から' + 位置 + '人目';
  }

  /** いま選んでいる年の点の並び（シナリオごと） */
  function 選んだ並び(c) {
    var 資格 = c.training;
    if (選んだ線 === 'training' && !(資格 && 資格.afterIncome > 0)) { 選んだ線 = 'all'; }
    return (選んだ線 === 'training') ? 資格.points : c.points;
  }

  function うちわけ表を描く(c) {
    var 並び = 選んだ並び(c);
    if (選んだ年 >= 並び.length) { 選んだ年 = 並び.length - 1; }
    if (選んだ年 < 0) { 選んだ年 = 0; }
    var 資格 = c.training;

    var h = ['<div class="balance-block">'];
    h.push('<h3>その年の家計を見る</h3>');
    h.push('<p class="hint">つまみを左右に動かすと、その年に何にお金が出ていくのかが分かります。' +
      'グラフのたて線が、いま見ている年です。</p>');

    /* 年を選ぶつまみ */
    h.push('<div class="balance-controls">');
    h.push('<label for="balance-year">いちばん下のお子さんが</label>');
    h.push('<output id="balance-year-out" class="balance-age">' + 並び[選んだ年].youngestAge + '歳</output>');
    h.push('<input type="range" id="balance-year" min="0" max="' + (並び.length - 1) +
      '" step="1" value="' + 選んだ年 + '" aria-label="見たい年を選ぶ">');
    h.push('</div>');

    h.push('<div class="balance-scenario">');
    [['now', 'いまのまま'], ['all', '制度活用']].concat(
      (資格 && 資格.afterIncome > 0) ? [['training', '資格を取る']] : []
    ).forEach(function (o) {
      h.push('<button type="button" class="' + (選んだ線 === o[0] ? 'primary' : 'ghost') +
        '" data-scenario="' + o[0] + '" style="width:auto;margin:0;padding:.35rem .7rem;font-size:.82rem">' +
        o[1] + '</button>');
    });
    h.push('</div>');

    h.push('<div id="balance-body">' + 表の中身(c) + '</div>');
    h.push('</div>');
    return h.join('');
  }

  /** つまみを動かしたときに入れかえる部分だけ */
  function 表の中身(c) {
    var 並び = 選んだ並び(c);
    var pt = 並び[選んだ年];
    if (!pt) { return ''; }
    var b = (選んだ線 === 'training') ? pt.breakdown : pt.breakdown[選んだ線];
    if (!b) { return ''; }

    var 収入計 = 0, 支出計 = 0;
    b.income.forEach(function (r) { 収入計 += r.amount; });
    b.expense.forEach(function (r) { 支出計 += r.amount; });
    var 差引 = 収入計 - 支出計;

    var h = [];
    var できごと = その年のできごと(c, 並び, 選んだ年);
    if (できごと.length) {
      h.push('<div class="balance-events"><p class="balance-events-head">この年に変わること</p><ul>' +
        できごと.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul></div>');
    }

    h.push('<table class="balance"><tbody>');
    h.push('<tr class="sec"><th colspan="2">入ってくるお金（ひと月）</th></tr>');
    b.income.forEach(function (r) {
      h.push('<tr' + (r.amount === 0 ? ' class="zero"' : '') + '><td>' + esc(r.name) +
        (r.amount === 0 && r.reason ? '<span class="why">' + esc(r.reason) + '</span>' : '') +
        '</td><td class="num">' + SPS.円(r.amount) + '</td></tr>');
    });
    h.push('<tr class="sum"><td>入ってくるお金の合計</td><td class="num">' + SPS.円(収入計) + '</td></tr>');
    h.push('<tr class="sec"><th colspan="2">出ていくお金（ひと月）</th></tr>');
    b.expense.forEach(function (r) {
      /* 補足の数字は、その行が持っている数字だけから作る。
         別のところから持ってくると、行の金額と合わなくなる（実際に合わなくなっていた）。 */
      var 追記 = '';
      if (r.key === 'living' && r.increase > 0) {
        追記 = '<span class="why">いまより ' + SPS.円(r.increase) + ' 多い（お子さんの成長ぶん）</span>';
      }
      if (r.key === 'childcare') {
        if (r.discount > 0) {
          追記 = '<span class="why">きょうだいの軽減で ' + SPS.円(r.discount) + ' 安くなっています（軽減前 ' +
            SPS.円(r.gross) + '）。' + esc((データ.childcare || {}).note_municipality || '') + '</span>';
        } else if (r.amount > 0 && データ.childcare) {
          追記 = '<span class="why">' + esc(データ.childcare.note_municipality) + '</span>';
        }
      }
      if (r.key === 'tuition') {
        var 内 = [];
        if (r.school != null) { 内.push('学校そのもの ' + SPS.円(r.school)); }
        if (r.extra != null) {
          内.push('塾・習いごと ' + SPS.円(r.extra) +
            ((最新入力.juku && 最新入力.juku.useAverage === false) ? '（自分で決めた額）' : '（全国平均）'));
        }
        if (r.support > 0) {
          内.push('もとの額 ' + SPS.円(r.gross) + ' から制度が ' + SPS.円(r.support) + ' 助けたあと');
        }
        if (内.length) { 追記 = '<span class="why">' + 内.join(' ／ ') + '</span>'; }
      }
      var 小計か = (r.children && r.children.length > 1);
      h.push('<tr' + (r.amount === 0 ? ' class="zero"' : '') + (小計か ? ' class="has-children"' : '') +
        '><td>' + esc(r.name) + 追記 +
        '</td><td class="num' + (小計か ? ' subtotal' : '') + '">' + SPS.円(r.amount) + '</td></tr>');
      /* お子さんが2人以上いるときは、だれにいくらかかっているかを出す */
      if (小計か) {
        r.children.forEach(function (ch) {
          var 呼び名 = 子の呼び名(ch.index, pt.childAges || []);
          var 補 = '';
          if (ch.school != null && ch.extra != null && (ch.school > 0 || ch.extra > 0)) {
            補 = '<span class="why">学校そのもの ' + SPS.円(ch.school) +
              ' ／ 塾・習いごと ' + SPS.円(ch.extra) +
              (ch.support > 0 ? '（もとの額 ' + SPS.円(ch.gross) + ' から制度が ' + SPS.円(ch.support) + ' 助けたあと）' : '') +
              '</span>';
          } else if (ch.support > 0) {
            補 = '<span class="why">もとの額 ' + SPS.円(ch.gross) + ' − 制度の助け ' + SPS.円(ch.support) + '</span>';
          } else if (ch.discount > 0) {
            補 = '<span class="why">きょうだいの軽減で ' + SPS.円(ch.discount) + ' 安く（軽減前 ' + SPS.円(ch.gross) + '）</span>';
          }
          h.push('<tr class="child-row"><td><span class="child-mark">▸</span>' +
            esc(呼び名) + '（' + ch.age + '歳・' + esc(ch.stage || '') + '）' + 補 +
            '</td><td class="num">' + SPS.円(ch.amount) + '</td></tr>');
        });
      }
    });
    h.push('<tr class="sum"><td>出ていくお金の合計</td><td class="num">' + SPS.円(支出計) + '</td></tr>');
    h.push('<tr class="total ' + (差引 < 0 ? 'minus' : 'plus') + '"><td>ひと月の残り</td><td class="num">' +
      (差引 < 0 ? '−' + SPS.円(-差引) : SPS.円(差引)) + '</td></tr>');
    h.push('</tbody></table>');
    if (差引 < 0) {
      h.push('<p class="hint balance-minus">この年は、ひと月に ' + SPS.円(-差引) +
        ' ずつ貯金が減っていきます。</p>');
    }
    return h.join('');
  }

  /** その年に、新しく始まったこと・終わったことを見つける */
  function その年のできごと(c, 並び, i) {
    var 出 = [];
    if (i === 0) { return 出; }
    var 前 = 並び[i - 1], いま = 並び[i];
    var b1 = (選んだ線 === 'training') ? 前.breakdown : 前.breakdown[選んだ線];
    var b2 = (選んだ線 === 'training') ? いま.breakdown : いま.breakdown[選んだ線];
    if (!b1 || !b2) { return 出; }

    b2.income.forEach(function (r, k) {
      var 前額 = b1.income[k] ? b1.income[k].amount : 0;
      if (前額 > 0 && r.amount === 0) {
        出.push('<strong>' + esc(r.name) + 'がなくなります</strong>（月 ' + SPS.円(前額) + ' 減）');
      } else if (前額 === 0 && r.amount > 0) {
        出.push('<strong>' + esc(r.name) + 'が始まります</strong>（月 ' + SPS.円(r.amount) + ' 増）');
      } else if (前額 > 0 && r.amount > 0 && Math.abs(r.amount - 前額) >= 3000) {
        出.push(esc(r.name) + 'が 月 ' + SPS.円(Math.abs(r.amount - 前額)) +
          (r.amount < 前額 ? ' 減ります' : ' ふえます'));
      }
    });
    b2.expense.forEach(function (r, k) {
      var 前額 = b1.expense[k] ? b1.expense[k].amount : 0;
      if (Math.abs(r.amount - 前額) >= 3000) {
        出.push(esc(r.name) + 'が 月 ' + SPS.円(Math.abs(r.amount - 前額)) +
          (r.amount > 前額 ? ' ふえます' : ' 減ります'));
      }
    });
    /* 学校の段階が変わる年は、名前で言う */
    var 帯 = (データ.tuition || {}).bands || [];
    (いま.childAges || []).forEach(function (age, k) {
      帯.forEach(function (b) {
        if (age === b.from) {
          var プ = (最新入力.plans || [])[k] || {};
          var 選 = プ[b.stage] || b.default;
          var 名 = (b.choices.filter(function (ch) { return ch.value === 選; })[0] || {}).label || b.label;
          出.push('お子さんが' + esc(b.label) + 'に入ります（' + esc(名) + '）');
        }
      });
    });
    return 出.slice(0, 4);
  }

  /* グラフの網かけと赤い領域の説明。
     一目で分かる最低限はグラフの中のラベルに残し、長い説明だけをたたんでおく。 */
  function 打ち切りの注記(c) {
    var h = '';
    if (c.truncated) {
      h += '<p class="hint cutoff">灰色の網かけから先は、線を描いていません。' +
        '<strong>このままの前提では成り立たない領域だからです。</strong>' +
        '借金をずっと積み増していくことは実際にはできませんし、' +
        'その前に、支出・収入・受けられる支援のどれかを変えることになります。' +
        'ここから先を数字で見せると、かえって嘘になります。</p>';
    }
    h += '<p class="hint red-zone-note">0円より下は、赤の濃さで2つに分けています。' +
      '<strong>うすい赤</strong>は0円から借りられる上限までで、ここから下は<strong>借金</strong>になります。' +
      '<strong>濃い赤</strong>は借りられる上限より下で、ここは<strong>借りることもできない</strong>金額です。</p>';
    if (c.hitsBorrowFloor && c.borrowFloor != null) {
      h += '<p class="hint floor-note">赤い線は、<strong>貸金業者から借りられる上限（' +
        esc(c.borrowFloorLabel || '年収の3分の1') + ' ＝ ' + SPS.円(-c.borrowFloor) + '）</strong>です。' +
        'グラフがこれより下に行かないのは、そこから先は実際には借りられないからです。' +
        '<strong>借りられる上限に先にぶつかる場合、そこから先は本当に打つ手がなくなります。その前に相談窓口へ。</strong>' +
        '<a href="#gap-block">下の「足りないぶんをどこから持ってくるか」を見る</a><br>' +
        '<span class="src">根拠: 貸金業法第13条の2（総量規制）／' +
        '<a href="https://www.fsa.go.jp/policy/kashikin/kihon.html" target="_blank" rel="noopener">金融庁「貸金業法のキホン」</a>' +
        '（最終確認 8/11(火)）。銀行からの借入れや住宅ローンなど、対象外のものもあります。</span></p>';
    }
    return '<details class="explain"><summary>グラフの網かけと赤い線の意味（くわしく）</summary>' +
      '<div class="explain-body">' + h + '</div></details>';
  }

  /* ---------- 学校にかかるお金 ---------- */
  function 学費の説明(c) {
    var t = データ.tuition;
    if (!t) { return ''; }
    var h = ['<div class="panel tight">'];
    h.push('<h3 style="margin-top:0">学校にかかるお金</h3>');
    if (c.tuitionSupportTotal > 0) {
      h.push('<p>いまの進路の見込みだと、学校にかかるお金は これから合計およそ <strong>' +
        Math.round(c.tuitionGrossTotal / 10000).toLocaleString('ja-JP') + '万円</strong>。' +
        'そのうち <strong class="support-amount">およそ ' +
        Math.round(c.tuitionSupportTotal / 10000).toLocaleString('ja-JP') + '万円は制度が助けてくれます</strong>ので、' +
        '実際の負担は <strong>およそ ' + Math.round(c.tuitionTotal / 10000).toLocaleString('ja-JP') + '万円</strong> です。</p>');
      h.push('<p class="hint">助けてくれるのは、高校生等奨学給付金と、高等教育の修学支援新制度（授業料・入学金の減免＋返さなくてよい給付型奨学金）です。' +
        '<strong>どちらも自分で申し込む必要があります。</strong>収入が低い世帯ほど手厚くなります。' +
        '<a href="#prog-koutou_kyoiku_shugaku_shien">修学支援新制度のくわしい説明を見る</a></p>');
    } else {
      h.push('<p>いまの進路の見込みだと、これから <strong>合計およそ ' +
        Math.round(c.tuitionTotal / 10000).toLocaleString('ja-JP') + '万円</strong> かかる計算です。</p>');
    }
    if (c.tuitionExtra > 0) {
      h.push('<p><strong>全部公立（大学は国立で自宅から通う）を選んだ場合との差は、累計で約' +
        Math.round(c.tuitionExtra / 10000).toLocaleString('ja-JP') + '万円です。</strong>' +
        '上の入力欄の「お子さんの進路の見込み」を変えると、グラフがその場で変わります。</p>');
    } else {
      h.push('<p class="hint">上の入力欄の「お子さんの進路の見込み」を変えると、グラフがその場で変わります。私立を選ぶと、どれだけ変わるかが見られます。</p>');
    }
    h.push('<p class="hint"><strong>ここの金額は、すべて全国の平均値です。</strong>まん中の人の金額ではありません。' +
      '塾や習いごとにたくさんかける家庭が平均を押し上げるので、多くの家庭の実感より高めに出ます。</p>');
    h.push('<p class="hint">' + esc(t.support.high_school.shugaku_shienkin_note) + '</p>');
    h.push('<p class="hint">' + esc(t.support.elementary_junior.note) + '</p>');
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

    /* 手は「今週から動けるもの（すぐ）」と「時間のかかるもの（あと）」に分ける。
       穴が小さいのに「資格を取って収入を上げる」から始めさせるのは、釣り合いが悪い。
       穴が小さいときは、すぐ動けるものを上に。大きいときは、金額の大きい制度を上に。 */
    var 小さい穴 = (不足 > 0 && 不足 < 10000);
    var 手 = [];
    function 足す(見出し, 説明, 制度id, 強調, すぐ) {
      手.push({ head: 見出し, body: 説明, prog: 制度id, strong: !!強調, quick: !!すぐ });
    }

    if (入力.childSupportState.indexOf('取り決めている') === -1) {
      足す('養育費を取り決める・請求する',
        '口約束や、取り決めなしのままになっています。ここがいちばん大きく動く可能性があります。' +
        '公正証書にしておけば、あとから給料や預金を差し押さえられます。' +
        '令和8年4月からは、取り決めがない場合でも一定額を請求できる仕組みが始まっています。',
        'youikuhi', true, true);
    }
    c.gaps.forEach(function (g) {
      var p = データ.programs_by_id[g.id];
      足す('「' + p.name.replace(/（.*$/, '') + '」を申請する',
        'まだ受け取っていないと答えていただきました。ひと月あたり約' + SPS.円(g.monthly) + 'です。',
        g.id, g.monthly >= 不足, true);
    });
    if (入力.children.some(function (a) { return a >= 6 && a <= 15; })) {
      足す('学校のお金を助けてもらう',
        '就学援助は、学用品費や給食費が対象です。児童扶養手当を受けていることを基準のひとつにしている市町村が約4分の3あり、' +
        '年度の途中でも受け付けているところがほとんどです。学校か教育委員会に聞くだけで始められます。',
        'shugaku_enjo', false, true);
    }
    足す('食べるものを助けてもらう',
      'こども食堂・フードパントリー・こども宅食など、食事や食材を無料か安く受け取れる場所があります。' +
      '申請も審査もいらないところがほとんどで、行けばその日から使えます。' +
      '市区町村の子育て担当課か社会福祉協議会に「近くのこども食堂を教えてください」と聞くのがいちばん早いです。',
      'shoku_shien', false, true);
    if (入力.housingType === '賃貸' && 入力.housingAfter > 0) {
      足す('住まいの費用を見直す',
        'いまの住居費は月' + SPS.円(入力.housingAfter) + 'です。公営住宅は収入に応じて家賃が決まるので、' +
        '民間の賃貸との差が月に数万円になることがあります。募集の時期を調べてみてください。',
        'koei_jutaku', false, true);
    }
    if (判定表.koutou_shokugyo_kunren) {
      足す('資格を取って、収入を上げる',
        '学校に通う間、住民税が非課税の世帯なら月10万円（課税世帯は月70,500円）を受け取れます。' +
        '最後の1年はさらに月4万円。通いはじめる前に相談することが必要です。時間はかかりますが、いちばん大きく変わる手です。',
        'koutou_shokugyo_kunren', false, false);
    }
    if (不足 >= 50000) {
      足す('生活保護の相談に行く',
        '足りない額が大きいときの選択肢です。生活保護は権利です。一時的に受けて、立て直してから抜けることもできます。' +
        '「車があるから」「持ち家だから」と自分で決めず、まず福祉事務所で聞いてください。',
        'seikatsu_hogo', true, false);
    }
    足す('お住まいの地域の相談窓口に行く',
      '自立相談支援機関では、家計の立て直しを一緒に考えてくれます。' +
      '<a href="https://minna-tunagaru.jp/ichiran/" target="_blank" rel="noopener">全国の窓口一覧</a>から探せます。',
      null, false, true);

    /* 穴が小さいときだけ、今週から動けるものを上に持ってくる */
    if (小さい穴) {
      手.sort(function (a, b) { return (b.quick ? 1 : 0) - (a.quick ? 1 : 0); });
    }

    var h = ['<div class="pit red gap-block" id="gap-block">'];
    h.push('<h4>🔴 足りないぶんを、どこから持ってくるか</h4>');
    if (不足 > 0) {
      h.push('<p class="gap-amount">埋めたいのは <strong>ひと月あたり ' + SPS.円(不足) + '</strong> です。</p>');
      if (小さい穴) {
        h.push('<p>この大きさなら、<strong>今週から動けることで埋まる見込みです。</strong>' +
          '大きな決断をする前に、上から順に試してみてください。</p>');
      }
    }
    h.push('<p><strong>借金では埋められません。</strong>カードローンやリボ払いで足りないぶんを埋めると、' +
      '来月からは返済も足されて、もっと足りなくなります。下の手を1つずつ試してください。</p>');
    h.push('<ol class="gap-list">');
    手.forEach(function (o) {
      var 制度 = o.prog ? データ.programs_by_id[o.prog] : null;
      h.push('<li' + (o.strong ? ' class="strong"' : '') + '>' +
        '<strong>' + esc(o.head) + '</strong>' + (制度 ? 返済バッジ(制度) : '') +
        (o.strong ? ' <span class="badge info">大きく効きます</span>' : '') +
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
      '<h4>緑の線は「生活防衛資金」です</h4>' +
      '<p style="margin:.3rem 0"><strong>まずはこの線にとどくまで貯めることだけ考えれば大丈夫です。' +
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
      '私たちAIかけこみ寺は、ひとり親家庭にとっては生活費の半年分を手元に置くことが、' +
      'どんな資産運用よりも先に来ると考えます。半年分に届く前でも、貯まっているぶんだけ確実に効きます。' +
      'この線にとどくまでは、投資のことは考えなくていい、というのが私たちの立場です。</div>' +
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
      var 制度2 = it.prog ? データ.programs_by_id[it.prog] : null;
      h.push('<li><label><input type="checkbox" id="todo-' + i + '"><span>' + esc(it.text) + '</span></label>' +
        (制度2 ? 返済バッジ(制度2) : '') +
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
          '・いますぐ: ' + esc(it.roi.quick) + '<br>・積み上げ: ' + esc(it.roi.slow) +
          '<br><a href="#stage2b" class="roi-link">積み上げルートを数字で見る（貯金のグラフへ）</a></div>');
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
  function 計算する(スクロールする) {
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
    /* 記入例を入れたときは、画面を動かさない。
       いきなり飛ばされると、どこに何が入ったのか分からなくなるため。
       自分で「この内容で見てみる」を押したときだけ、結果まで送る。 */
    if (スクロールする !== false) {
      var 先 = $('stage2b');
      if (先 && 先.scrollIntoView) { 先.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
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
      document.querySelectorAll('.cost-item').forEach(function (el) {
        el.addEventListener('input', うちわけを反映);
      });
      document.querySelectorAll('input[name="juku-mode"]').forEach(function (el) {
        el.addEventListener('change', 塾欄を反映);
      });
      $('juku-cost').addEventListener('input', 塾欄を反映);
      $('training-on').addEventListener('change', 訓練欄を反映);
      ['training-years', 'training-during', 'training-after'].forEach(function (id) {
        $(id).addEventListener('input', 訓練欄を反映);
        $(id).addEventListener('change', 訓練欄を反映);
      });
      document.querySelectorAll('input[name="training-work"]').forEach(function (el) {
        el.addEventListener('change', 訓練欄を反映);
      });
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

      $('form-area').addEventListener('input', function () {
        var n = $('sample-note');
        if (n.classList.contains('shown-note')) { n.classList.remove('shown-note'); n.innerHTML = ''; }
      });

      var 前の狭さ = 狭い画面();
      window.addEventListener('resize', function () {
        var いま = 狭い画面();
        if (いま !== 前の狭さ && 最新入力) {
          前の狭さ = いま;
          グラフを描く();
          資産を描く();
        }
      });
      $('calc').addEventListener('click', function () { 計算する(true); });
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
