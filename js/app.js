/* ============================================================
 * app.js  画面のうごき
 * ============================================================ */
(function () {
  'use strict';

  var データ = null, 見本 = null, 落とし穴 = null;
  var 最新入力 = null, 最新判定 = null, 最新シミュ = null;

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
     読みにいくのは、このツール自身のフォルダの中だけです。
     外のサーバーへは、行きも帰りも一切つながりません。 */
  function 取得(相対パス) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('GET', 相対パス, true);
      x.onload = function () {
        if (x.status === 0 || (x.status >= 200 && x.status < 300)) {
          try { resolve(JSON.parse(x.responseText)); }
          catch (e) { reject(new Error(相対パス + ' の中身を読めませんでした')); }
        } else { reject(new Error(相対パス + ' を読めませんでした（' + x.status + '）')); }
      };
      x.onerror = function () { reject(new Error(相対パス + ' を読めませんでした')); };
      x.send();
    });
  }

  function 読み込む() {
    return Promise.all([
      取得('data/programs.json'),
      取得('data/samples.json'),
      取得('data/pitfalls.json')
    ]).then(function (a) {
      データ = a[0]; 見本 = a[1]; 落とし穴 = a[2];
      データ.programs_by_id = {};
      データ.programs.forEach(function (p) { データ.programs_by_id[p.id] = p; });
    });
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
        '<div class="prog ' + r.status + '">' +
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
    var 差 = y.length ? (y[0].divorced.total - y[0].married.total) : 0;

    $('stage2-body').innerHTML =
      '<p>' + (入力.isSingleParent
        ? 'すでにひとり親の方は、「離婚した場合」の線がいまの状態です。「結婚を続けた場合」の線は参考として、配偶者の年収を入れたときの姿を出しています。'
        : '<strong>いま（お子さん' + y[0].youngestAge + '歳）の時点で、離婚した場合はひと月あたり ' +
          (差 >= 0 ? '約' + SPS.円(差) + ' 多く' : '約' + SPS.円(-差) + ' 少なく') + 'なる見込みです。</strong>') + '</p>' +
      SPSChart.凡例() +
      '<div class="chart-box">' + SPSChart.描く(y, 最新シミュ.cliffs) + '</div>' +
      '<p class="hint">たての線は、制度が切りかわって金額が変わるところです。グラフの上を指でなぞる（マウスを乗せる）と、その年の金額が出ます。</p>' +
      SPSChart.表(y) +
      崖の説明(最新シミュ.cliffs);
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

  function 落とし穴を描く(入力, 判定) {
    var items = 当てはまる落とし穴(入力, 判定);
    var 赤 = items.filter(function (i) { return i.tone === 'red'; });
    var 黄 = items.filter(function (i) { return i.tone === 'yellow'; });

    function 一件(it) {
      var h = ['<div class="pit ' + it.tone + '">'];
      h.push('<h4>' + (it.tone === 'red' ? '🔴 ' : '🟡 ') + esc(it.title) + '</h4>');
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
      h.push('</div>');
      return h.join('');
    }

    $('stage3-body').innerHTML =
      '<h3>とくに気をつけてほしいこと</h3>' + 赤.map(一件).join('') +
      '<h3>入力の内容から、確かめてほしいこと</h3>' + (黄.length ? 黄.map(一件).join('') : '<p class="hint">とくにありません。</p>');
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

    読み込む().then(function () {
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
    }).catch(function (err) {
      $('loading').innerHTML = '<p class="pit red">画面のもとになるデータを読み込めませんでした。' +
        'このページは、インターネット上（ai-kakekomi.com）で開くか、パソコンの中で小さなサーバーを立てて開いてください。' +
        'ファイルを直接ダブルクリックして開くと、ブラウザの決まりごとで読み込めないことがあります。' +
        '（くわしくは使い方マニュアルの「動かし方」をごらんください）</p>';
      if (window.console) { console.error(err); }
    });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', 起動); }
  else { 起動(); }
}());
