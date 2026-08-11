/* ============================================================
 * ui.js  画面そのものを動かしてみるチェック
 *
 *   node test/ui.js
 *
 * jsdom というパッケージが要ります。入っていなければ、何もせず終わります。
 *   npm install jsdom
 * 静的サーバーはこのスクリプトの中で立てるので、別に用意する必要はありません。
 * ============================================================ */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

var JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (e) {
  console.log('jsdom が入っていないので、画面のチェックは飛ばします（`npm install jsdom` で入ります）。');
  process.exit(0);
}

var 成功 = 0, 失敗 = 0;
function ok(cond, name, extra) {
  if (cond) { 成功++; }
  else { 失敗++; console.log('  NG  ' + name + (extra !== undefined ? '   → ' + extra : '')); }
}
function eq(a, b, name) { ok(a === b, name, 'got ' + JSON.stringify(a) + ' / want ' + JSON.stringify(b)); }
function 待つ(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var 型 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

/* ============================================================
 * 受け入れ条件:
 *   どの入力でも、脱出ルート（良くなる道筋）が
 *   かならず1つ以上、数字つきで見えること。
 * ============================================================ */
function 道筋のチェック() {
  return JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true
  }).then(function (dom) {
    var w = dom.window, d = w.document;
    w.Element.prototype.scrollIntoView = function () {};
    return 待つ(2200).then(function () {
      var 見本 = require(path.join(ROOT, 'data', 'samples.js')).samples;
      var 期待 = {
        part_two_kids: ['黒字になります', '資格を取って抜ける道'],
        seishain_one_kid: ['申請すれば'],
        over_limit: ['学費の山'],
        considering_divorce: ['養育費を取り決めると'],
        on_the_edge: ['手当が減りはじめます'],
        parent_support: ['援助があるうちに']
      };
      var 数え = [];
      見本.forEach(function (sm, i) {
        d.querySelectorAll('#sample-buttons button')[i].click();
        var 塊 = d.querySelector('#stage2b-body .path-block');
        ok(塊 !== null, '[' + sm.id + '] 「あなたの場合の道筋」が出る');
        if (!塊) { return; }
        var 項目 = d.querySelectorAll('#stage2b-body .path-item');
        ok(項目.length >= 2,
          '[' + sm.id + '] 最後の受け皿だけでなく、その人に固有の道筋が出ている', 項目.length + '個');
        var 文 = 塊.textContent;
        ok(/[0-9][0-9,]*\s*(円|万円|年|か月|%)/.test(文), '[' + sm.id + '] 道筋に数字がついている');
        ok(塊.querySelectorAll('.path-link a').length >= 1, '[' + sm.id + '] 行き先のリンクがある');
        (期待[sm.id] || []).forEach(function (語) {
          ok(文.indexOf(語) > 0, '[' + sm.id + '] 「' + 語 + '」が道筋に出ている',
            文.replace(/\s+/g, ' ').slice(0, 140));
        });
        数え.push(sm.id + ':' + 項目.length);
      });
      console.log('    （道筋の数 ' + 数え.join(' / ') + '）');

      /* きわめて苦しい入力でも、生活保護が「権利」として出ること */
      d.getElementById('my-income').value = '0';
      d.getElementById('child-count').value = '2';
      d.getElementById('child-count').dispatchEvent(new w.Event('change'));
      d.getElementById('child-age-0').value = '4';
      d.getElementById('child-age-1').value = '9';
      d.getElementById('living-cost').value = '120000';
      d.getElementById('current-savings').value = '0';
      d.getElementById('housing-now').value = '60000';
      d.getElementById('training-on').checked = false;
      d.getElementById('calc').click();
      var 極 = d.querySelector('#stage2b-body .path-block');
      ok(極 !== null, '収入0でも、道筋が空にならない');
      if (極) {
        ok(極.textContent.indexOf('生活保護は、負けではありません') > 0,
          '収入0のときは、生活保護を権利として正面から出す',
          極.textContent.replace(/\s+/g, ' ').slice(0, 140));
        ok(極.textContent.indexOf('やり直すための土台') > 0, '再出発の土台というトーンになっている');
      }
      w.close();
    });
  });
}

var server = http.createServer(function (req, res) {
  var p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 型[path.extname(p)] || 'application/octet-stream' });
  res.end(fs.readFileSync(p));
});

server.listen(0, '127.0.0.1', function () {
  var base = 'http://127.0.0.1:' + server.address().port;
  JSDOM.fromURL(base + '/index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true
  }).then(function (dom) {
    var w = dom.window, d = w.document, エラー = [];
    w.addEventListener('error', function (e) { エラー.push(String(e.error || e.message)); });

    /* どこへスクロールしたかを記録できるようにする（jsdom には本物がないので入れる） */
    var 移動先 = [];
    w.Element.prototype.scrollIntoView = function () { 移動先.push(this.id); };

    return 待つ(2500).then(function () {
      eq(d.getElementById('loading').style.display, 'none', 'データを読み込むと、読み込み中の表示が消える');
      var btns = d.querySelectorAll('#sample-buttons button');
      eq(btns.length, 6, '例のボタンが6つ並ぶ');

      btns[1].click();
      return 待つ(300).then(function () {
        ok(d.getElementById('stage1').classList.contains('shown'), '例を押すと、制度の一覧が出る');
        eq(d.querySelectorAll('#stage1-body .prog').length, 18, '制度カードが18枚出る');
        eq(d.querySelectorAll('#stage1-body .prog .src a').length, 18, 'どのカードにも出典のリンクが付いている');
        ok(d.querySelector('#stage1-body .prog .src').textContent.indexOf('最終確認') > 0, '最終確認日が出ている');
        ok(d.querySelector('#stage1-body .prog .amount').textContent.indexOf('13,870円') > 0,
          '一部支給の金額（13,870円）が画面に出る', d.querySelector('#stage1-body .prog .amount').textContent);

        eq(d.querySelectorAll('#stage2-body svg path').length, 2, 'グラフの線が2本');
        ok(d.querySelectorAll('#stage2-body table.compare tr').length > 2, '数字だけの表も出る');

        /* ひとりあたりに直した金額が既定で、切りかえもできる */
        ok(d.getElementById('stage2-body').textContent.indexOf('ひとりあたりに直した金額で比べています') > 0,
          '人数がちがうから比べられない、という説明が出ている');
        ok(d.querySelector('#stage2-body svg').textContent.indexOf('ひとりあたりに直した、ひと月のお金') >= 0,
          'グラフの縦軸が、ひとりあたりの金額になっている');
        var 切替 = d.querySelectorAll('#stage2-body button[data-view]');
        eq(切替.length, 2, '見方の切りかえボタンが2つある');
        eq(切替[0].getAttribute('aria-pressed'), 'true', 'はじめは「ひとりあたり」が選ばれている');
        切替[1].click();
        ok(d.getElementById('stage2-body').textContent.indexOf('家ぜんたい') > 0,
          '切りかえると、家ぜんたいの金額が見られる');
        d.querySelectorAll('#stage2-body button[data-view]')[0].click();
        ok(d.getElementById('stage2-body').textContent.indexOf('ひとりあたりに直した金額で比べています') > 0,
          'もう一度切りかえると、ひとりあたりに戻る');
        ok(d.getElementById('stage2-body').textContent.indexOf('相手の収入が家計にきちんと入っていることが前提') > 0,
          'お金の話だけである、という注記が出ている');
        ok(d.querySelector('#stage2-body a[href="#stage3"]') !== null,
          '身の安全のことを見に行くリンクがある');

        /* グラフの左はしが、入力した貯金額であること（1年ずれていないこと） */
        (function () {
          var 見本一覧 = require(path.join(ROOT, 'data', 'samples.js')).samples;
          var SPSe = require(path.join(ROOT, 'js', 'engine.js'));
          var データ本 = require(path.join(ROOT, 'data', 'programs.js'));
          データ本.programs_by_id = {};
          データ本.programs.forEach(function (p2) { データ本.programs_by_id[p2.id] = p2; });
          見本一覧.forEach(function (sm) {
            var c2 = SPSe.資産カーブ(Object.assign({}, sm.input,
              { divorced_childSupportMonthly: sm.input.childSupportMonthly }), データ本);
            eq(c2.points[0].all, sm.input.currentSavings,
              '[' + sm.id + '] グラフの左はしが、入力した貯金額と同じ');
          });
        }());

        /* 貯金のたまり方（資産カーブ）が、いちばん最初の出力になっている */
        ok(d.getElementById('stage2b').classList.contains('shown'), '貯金のたまり方の欄が出る');
        ok(d.getElementById('stage2b').compareDocumentPosition(d.getElementById('stage1')) & 4,
          '貯金のグラフが、制度の一覧より前に出ている');
        ok(d.getElementById('stage1').compareDocumentPosition(d.getElementById('stage2')) & 4,
          '制度の一覧が、離婚の比較グラフより前に出ている');
        /* 記入例では画面を動かさない。ユーザーは自分のペースで下りていく */
        eq(移動先.length, 0,
          '記入例を押しても、画面が勝手にスクロールしない', 移動先.join(' / '));
        ok(d.getElementById('sample-note').textContent.indexOf('記入例が入りました') >= 0,
          '「記入例が入りました」のお知らせが出る');
        ok(d.getElementById('sample-note').classList.contains('shown-note'),
          'お知らせが目立つ形で出ている');
        /* 色づけは、次の描画で消えていく（CSSのtransitionで元にもどる）。
           押した直後に見ないと確かめられないので、ここで押して、すぐ数える。 */
        d.querySelectorAll('#sample-buttons button')[2].click();
        var 光った = d.querySelectorAll('#form-area .flash').length;
        ok(光った > 3, '値が入った欄が、いったん色づく', 光った + '個');
        ok(d.querySelector('#living-cost').classList.contains('flash') ||
           d.querySelector('#my-income').classList.contains('flash'),
          '金額を入れた欄も色づいている');
        d.querySelectorAll('#sample-buttons button')[1].click();
        /* 自分で「この内容で見てみる」を押したときは、結果まで送る */
        d.getElementById('calc').click();
        eq(移動先[移動先.length - 1], 'stage2b',
          '「この内容で見てみる」を押したときは、結果まで画面が動く', 移動先.join(' / '));
        /* 次に何かを入力すると、お知らせは消える */
        var 欄 = d.getElementById('my-age');
        欄.value = '40';
        欄.dispatchEvent(new w.Event('input', { bubbles: true }));
        eq(d.getElementById('sample-note').textContent, '', '次の操作でお知らせが消える');
        eq(d.querySelectorAll('#stage2b-body svg path[stroke-linejoin]').length, 2, '貯金のグラフの線が2本');
        ok(d.querySelector('#stage2b-body a[href="#stage1"]') !== null,
          '差の中身（制度の一覧）へ行くリンクがある');
        ok(d.getElementById('stage2b-body').textContent.indexOf('学校にかかるお金') > 0,
          '学校にかかるお金の説明が出る');
        ok(d.getElementById('stage2b-body').textContent.indexOf('すべて全国の平均値です') > 0,
          '平均値であることが画面に書いてある');
        ok(d.getElementById('stage2b-body').textContent.indexOf('制度が助けてくれます') > 0,
          '学費のうち、制度が助けてくれる額が出ている');
        ok(d.querySelector('#stage2b-body .support-amount') !== null, '助けてくれる額が目立つ形で出る');
        ok(d.querySelector('#stage2b-body a[href*="mext.go.jp"]') !== null, '文部科学省の出典リンクがある');
        ok(d.querySelector('#stage2b-body a[href*="jasso.go.jp"]') !== null, '日本学生支援機構の出典リンクがある');
        ok(d.getElementById('stage2b-body').textContent.indexOf('生活防衛資金') > 0,
          '生活防衛資金の説明が出る');
        ok(d.getElementById('stage2b-body').textContent.indexOf('ここにとどくまで、投資のことは考えなくていいです') > 0,
          '帯の説明が、断言の形で書かれている');
        var 帯文 = d.getElementById('stage2b-body').textContent;
        ok(帯文.indexOf('にとどくまで、いまのペースで') > 0 ||
           帯文.indexOf('すでに貯め終えています') > 0 ||
           帯文.indexOf('とどきません') > 0,
          '生活防衛資金にとどくまでの時期、または もう貯まっていることが出る', 帯文.slice(0, 160));
        ok(帯文.indexOf('生活費の半年分') > 0, '生活防衛資金は半年分で書かれている');
        ok(d.querySelector('#stage2b-body .stance') !== null,
          '3〜6か月分という幅が、私たちの立場の表明として分けて書かれている');
        ok(d.querySelector('#stage2b-body a[href*="fsa.go.jp"]') !== null, '金融庁の出典リンクがある');
        ok(d.querySelector('#stage2b-body a[href*="shiruporuto.jp"]') !== null, '金融広報中央委員会の出典リンクがある');

        /* 生活費のうちわけ（任意）*/
        var うち = d.querySelector('details.breakdown');
        ok(うち !== null, '生活費のうちわけの欄がある');
        ok(!うち.open, 'はじめは閉じている（入れなくてもいい）');
        eq(d.querySelectorAll('.cost-item').length, 5, 'うちわけの費目が5つある');
        eq(d.getElementById('cost-total').textContent, '', '入れる前は、合計は出ない');
        var 前の生活費 = d.getElementById('living-cost').value;
        function 入れる(id, v) {
          var el = d.getElementById(id); el.value = String(v);
          el.dispatchEvent(new w.Event('input', { bubbles: true }));
        }
        入れる('cost-food', 60000); 入れる('cost-utility', 18000);
        入れる('cost-comm', 22000); 入れる('cost-insurance', 5000); 入れる('cost-other', 15000);
        eq(d.getElementById('living-cost').value, '120000', 'うちわけの合計が、毎月の生活費に自動で入る');
        ok(d.getElementById('cost-total').textContent.indexOf('120,000円') > 0, '合計が表示される');
        var 見立て = d.getElementById('cost-advice').textContent;
        ok(d.querySelectorAll('#cost-advice ul.cost-share li').length === 5, '費目ごとの割合が出る');
        ok(見立て.indexOf('通信費') > 0 && 見立て.indexOf('プランや会社を変えて') > 0,
          '通信費が重いときは、見直しの候補として出る（断言はしない）');
        ok(見立て.indexOf('母子世帯の平均') > 0,
          '母子世帯の平均とくらべた結果が出る');
        ok(見立て.indexOf('平均より多いからといって、使いすぎということではありません') > 0,
          '平均より多くても責める書き方になっていない');
        ok(見立て.indexOf('必ず') === -1 && 見立て.indexOf('すべきです') === -1,
          '断言口調になっていない');
        /* 入れ直すと、貯金のグラフも追いかけて変わる */
        入れる('cost-food', 40000);
        eq(d.getElementById('living-cost').value, '100000', '入れ直すと合計も変わる');

        /* 家計のうちわけ表 */
        var 表 = d.querySelector('#stage2b-body .balance-block');
        ok(表 !== null, '家計のうちわけ表が出ている');
        /* グラフの直下（警告カードや道筋ブロックより上）にあること */
        var 絵 = d.getElementById('curve-chart');
        ok(絵 !== null, 'グラフに入れものがある');
        ok(絵.compareDocumentPosition(表) & 4, '家計の表は、グラフより下にある');
        var カード0 = d.querySelector('#stage2b-body .alert-card');
        if (カード0) {
          ok(表.compareDocumentPosition(カード0) & 4, '家計の表は、警告カードより上にある');
        }
        var 道 = d.querySelector('#stage2b-body .path-block');
        ok(道 !== null && (表.compareDocumentPosition(道) & 4), '家計の表は、道筋ブロックより上にある');
        var 年欄 = d.getElementById('balance-year');
        ok(年欄 !== null, '年を選ぶつまみがある');
        eq(年欄.type, 'range', '年の選び方が、左右に動かすつまみになっている');
        eq(年欄.min, '0', 'つまみの左はしは0');
        ok(Number(年欄.max) > 5, 'つまみの右はしまで年がならんでいる', 年欄.max);
        ok(d.getElementById('balance-year-out') !== null, 'いま選んでいる年が数字で出ている');
        ok(d.getElementById('balance-year-out').textContent.indexOf('歳') > 0,
          'その数字が「◯歳」の形', d.getElementById('balance-year-out').textContent);
        ok(表.querySelector('table.balance') !== null, '表そのものが出ている');
        ok(表.textContent.indexOf('入ってくるお金') > 0, '収入の欄がある');
        ok(表.textContent.indexOf('出ていくお金') > 0, '支出の欄がある');
        ok(表.textContent.indexOf('ひと月の残り') > 0, '差引の行がある');
        ok(表.textContent.indexOf('保育料') > 0, '保育料の行がある');
        ok(表.querySelectorAll('button[data-scenario]').length >= 2, 'シナリオを切りかえるボタンがある');
        /* つまみを動かすと中身が変わる（動かしている最中の input でも変わること） */
        var 前の表 = 表.querySelector('table.balance').textContent;
        年欄.value = String(Math.min(5, Number(年欄.max)));
        年欄.dispatchEvent(new w.Event('input', { bubbles: true }));
        var 後の表 = d.querySelector('#stage2b-body table.balance').textContent;
        ok(後の表 !== 前の表, 'つまみを動かすと、表の中身がその場で変わる');
        ok(d.getElementById('balance-year-out').textContent.indexOf('歳') > 0,
          '選んでいる年の表示も変わる', d.getElementById('balance-year-out').textContent);
        /* つまみ自体は消えない（消えると指でのドラッグが途切れる） */
        ok(d.getElementById('balance-year') === 年欄,
          'つまみを動かしても、つまみ自体は作り直されない（ドラッグが途切れない）');
        /* グラフに、いま見ている年のカーソル線が出る */
        ok(d.querySelector('#curve-chart svg line[stroke="#33414f"]') !== null,
          'グラフに、いま見ている年のたて線が出る');
        ok(d.querySelector('#stage2b-body .balance-events') !== null,
          'その年に変わることが出ている');
        /* シナリオを切りかえると変わる */
        d.querySelector('#stage2b-body button[data-scenario="now"]').click();
        var いまの表 = d.querySelector('#stage2b-body table.balance').textContent;
        ok(いまの表 !== 後の表, 'シナリオを変えると、表の中身が変わる');
        d.querySelector('#stage2b-body button[data-scenario="all"]').click();
        /* 表に出ている数字どうしが合っていること（画面の文字から読みとって確かめる） */
        (function () {
          function 円を数に(t) { var m = /([\d,]+)円/.exec(t); return m ? Number(m[1].replace(/,/g, '')) : null; }
          ['now', 'all'].forEach(function (線) {
            d.querySelector('#stage2b-body button[data-scenario="' + 線 + '"]').click();
            var 行たち = d.querySelectorAll('#stage2b-body table.balance tr');
            [].forEach.call(行たち, function (tr) {
              var 名 = (tr.cells[0] || {}).textContent || '';
              if (名.indexOf('学校にかかるお金') < 0) { return; }
              var 表示 = 円を数に((tr.cells[1] || {}).textContent || '');
              var 補足 = tr.querySelector('.why');
              if (!補足) { return; }
              var 数字 = (補足.textContent.match(/([\d,]+)円/g) || []).map(function (x) {
                return Number(x.replace(/[円,]/g, ''));
              });
              if (数字.length >= 2) {
                eq(数字[0] - 数字[1], 表示,
                  '[' + 線 + '] 学費の行「もとの額 − 支援 ＝ 表示額」が画面上で合っている',
                  数字[0] + ' − ' + 数字[1] + ' ≠ ' + 表示);
              }
            });
          });
          d.querySelector('#stage2b-body button[data-scenario="all"]').click();
        }());

        /* 子どもごとの内訳（お子さんが2人以上のとき） */
        (function () {
          var 年欄2 = d.getElementById('balance-year');
          年欄2.value = String(Math.min(3, Number(年欄2.max)));
          年欄2.dispatchEvent(new w.Event('input', { bubbles: true }));
          var 子行 = d.querySelectorAll('#stage2b-body table.balance tr.child-row');
          if (子行.length) {
            ok(true, 'お子さんごとの内訳が出ている（' + 子行.length + '行）');
            var 文2 = 子行[0].textContent;
            ok(/上のお子さん|下のお子さん|上から\d人目|お子さん/.test(文2),
              '内訳に、どの子かの呼び名が入っている', 文2.slice(0, 30));
            ok(/\d+歳/.test(文2), '内訳に年齢が入っている');
            ok(/公立|私立|国立|保育園/.test(文2), '内訳に学校の種類が入っている', 文2.slice(0, 40));
            /* 内訳の合計が、その行の小計と合っている */
            function 円を数に2(t) { var m = /([\d,]+)円/.exec(t); return m ? Number(m[1].replace(/,/g, '')) : null; }
            var 行たち2 = [].slice.call(d.querySelectorAll('#stage2b-body table.balance tr'));
            行たち2.forEach(function (tr, idx) {
              if (tr.className.indexOf('has-children') < 0) { return; }
              var 小計 = 円を数に2(tr.cells[1].textContent);
              var 和 = 0, k = idx + 1;
              while (k < 行たち2.length && 行たち2[k].className.indexOf('child-row') >= 0) {
                和 += 円を数に2(行たち2[k].cells[1].textContent) || 0;
                k++;
              }
              eq(和, 小計, '子どもごとの内訳の合計が、その行の小計と一致する（画面上）');
            });
          }
        }());

        /* 0円の項目には理由が出る */
        ok(d.querySelector('#stage2b-body table.balance .why') !== null,
          '0円の項目や増えた項目に、理由が書いてある');

        /* このグラフの前提（常設） */
        var 前提 = d.querySelector('#stage2b-body .assumption-box');
        ok(前提 !== null, '「このグラフの前提」がグラフの下に常に出ている');
        var 前提文 = 前提.textContent;
        ok(前提文.indexOf('収入は、いまのまま変わらない前提です') > 0, '収入が一定であることが書いてある');
        ok(前提文.indexOf('生活費は、いまと同じ金額がずっと続く前提です') > 0, '生活費の扱いが書いてある');
        ok(前提文.indexOf('後半の線は甘め') > 0,
          'お子さんの成長で食費がふえるぶん、後半が甘く出ることを正直に書いてある');
        ok(前提文.indexOf('全国の平均値です') > 0, '学費が平均値であることが書いてある');
        ok(前提文.indexOf('毎年その年のお子さんの年齢で計算し直しています') > 0,
          '手当が毎年計算し直されることが書いてある');
        ok(前提文.indexOf('物価の上昇') > 0, '物価と制度改正を入れていないことが書いてある');
        ok(前提文.indexOf('返さなくていいお金だけです') > 0,
          'グラフに入れているのは給付だけ、と書いてある');
        ok(前提文.indexOf('二重には引いていません') > 0,
          '高校の就学支援金を二重に引いていないことが書いてある');
        ok(前提文.indexOf('小学校・中学校の就学援助は、差し引いていません') > 0,
          '小中の就学援助を入れていないことが書いてある');
        ok(前提.querySelector('.warn-inline') !== null, '甘く出るところが目立つ形になっている');

        /* 資格ルートは、はじめは切れている（まず現実だけを見せる） */
        ok(!d.getElementById('training-on').checked, '記入例を入れても、資格ルートは切れたまま');
        eq(d.getElementById('training-box').style.display, 'none', '資格ルートの設定も、はじめは出さない');
        eq(d.querySelectorAll('#stage2b-body svg path[stroke-linejoin]').length, 2,
          'はじめのグラフは2本（いまのまま・制度活用）だけ');

        /* 資格ルート: 働き方の3択 */
        eq(d.querySelectorAll('input[name="training-work"]').length, 4,
          '通っているあいだの働き方が4つから選べる（働かない・半分・いまのまま・自分で入れる）');
        ok(d.querySelector('input[name="training-work"][value="none"]') !== null, '「働かない」が選べる');
        ok(d.getElementById('training-during-row').style.display === 'none',
          '「自分で入れる」以外のときは、金額の欄を出さない');

        /* グラフの網かけと赤い線の説明も、折りたたみに入っている */
        var 網たたみ = [].filter.call(d.querySelectorAll('#stage2b-body details.explain'), function (x) {
          return x.querySelector('summary').textContent.indexOf('網かけ') >= 0;
        })[0];
        ok(網たたみ !== undefined, 'グラフの網かけと赤い線の説明が、折りたたみになっている');
        ok(!網たたみ.open, 'はじめは閉じている');
        eq(網たたみ.querySelector('summary').textContent, 'グラフの網かけと赤い線の意味（くわしく）',
          '閉じた見出しが1行で分かりやすい');
        ok(網たたみ.querySelector('.explain-body') !== null, '中身が入れものに入っている');
        ok(網たたみ.textContent.indexOf('うすい赤') > 0 && 網たたみ.textContent.indexOf('濃い赤') > 0,
          '2段階の赤の意味が中に書いてある');
        /* 長い説明はたたんでも、グラフの中の短いラベルは残っている */
        var 絵の字 = d.querySelector('#curve-chart svg').textContent;
        ok(絵の字.indexOf('借りられません') > 0, 'グラフの中の「借りられません」のラベルは残っている');
        if (d.querySelector('#curve-chart svg [fill="url(#hatch)"]')) {
          ok(絵の字.indexOf('描いていません') > 0 || 絵の字.indexOf('この先は') > 0 || 絵の字.indexOf('なし') > 0,
            'グラフの中の網かけのラベルも残っている', 絵の字.slice(0, 60));
        }
        /* 2つの折りたたみが、同じ見た目のしくみを使っている */
        var たたみ全部 = d.querySelectorAll('#stage2b-body details.explain');
        ok(たたみ全部.length >= 2, '折りたたみが2つある（網かけの説明・生活防衛資金の説明）');
        [].forEach.call(たたみ全部, function (x) {
          ok(x.classList.contains('explain'), 'どちらも同じ見た目のしくみ（explain）を使っている');
          ok(x.querySelector('summary').textContent.indexOf('くわしく') > 0,
            '閉じた見出しに「くわしく」が付いている', x.querySelector('summary').textContent);
        });

        /* 生活防衛資金の長い説明は、折りたたみに入っている */
        var 帯たたみ = [].filter.call(d.querySelectorAll('#stage2b-body details.explain'), function (x) {
          return x.querySelector('summary').textContent.indexOf('生活防衛資金') >= 0;
        })[0];
        ok(帯たたみ !== null, '生活防衛資金の説明が折りたたみになっている');
        ok(!帯たたみ.open, 'はじめは閉じている');
        ok(帯たたみ.querySelector('summary').textContent.indexOf('生活防衛資金って？') >= 0,
          '閉じた状態の見出しが分かりやすい', 帯たたみ.querySelector('summary').textContent);
        ok(d.querySelector('#stage2b-body .band-line') !== null, '生活防衛資金についての1行だけは、いつも見えている');
        ok(d.querySelector('#stage2b-body .band-line').textContent.indexOf('半年分') > 0,
          'その1行も「半年分」で書かれている');
        ok(帯たたみ.textContent.indexOf('ここにとどくまで、投資のことは考えなくていいです') > 0,
          '断言そのものは、折りたたみの中に残っている');
        ok(帯たたみ.textContent.indexOf('生活費の半年分') > 0,
          '生活防衛資金は「半年分」で統一されている');
        ok(帯たたみ.textContent.indexOf('3か月分から6か月分') === -1, '古い「3〜6か月」の表現が残っていない');
        ok(帯たたみ.querySelector('a[href*="fsa.go.jp"]') !== null, '出典も折りたたみの中にある');
        ok(帯たたみ.querySelector('.stance') !== null, '立場表明も折りたたみの中にある');

        /* すでに使っている制度は「利用中」と出る */
        eq(d.querySelectorAll('#used-programs input.used-prog').length, 9, 'すでに使っている制度を申告する欄が9つある');
        var 利用中 = d.querySelectorAll('#stage1-body .prog.used');
        eq(利用中.length, 2, '見本2は2件を利用中と申告しているので、2枚が利用中の表示になる', 利用中.length);
        ok(利用中[0].querySelector('.badge.used').textContent.indexOf('利用中') > 0, '利用中のしるしが出ている');
        ok(d.getElementById('stage1-summary').textContent.indexOf('すでに2件を使っている') >= 0,
          'まとめにも、すでに使っている件数が出る', d.getElementById('stage1-summary').textContent);

        /* 返さなくていいお金と、あとで返すお金の区別 */
        eq(d.querySelectorAll('#stage1-body .badge.grant').length + d.querySelectorAll('#stage1-body .badge.loan').length,
          18, 'すべての制度カードに、返すか返さないかのしるしが付く');
        eq(d.querySelectorAll('#stage1-body .badge.loan').length, 1, '「あとで返す」は1件だけ');
        ok(d.querySelector('#prog-fukushi_shikin_kashitsuke .badge.loan') !== null,
          '福祉資金貸付が「あとで返す」になっている');
        ok(d.querySelector('#prog-koutou_kyoiku_shugaku_shien .badge.grant') !== null,
          '修学支援新制度が「返さなくていい」になっている');
        ok(d.querySelector('#prog-koutou_kyoiku_shugaku_shien .misunderstanding') !== null,
          '修学支援新制度に、誤解を解く一文が出ている');
        ok(d.querySelector('#prog-koutou_kyoiku_shugaku_shien .misunderstanding').textContent.indexOf('返す必要がありません') > 0,
          'その一文に「返す必要がありません」と書いてある');

        /* 進路プラン: 私立にすると、その場でグラフが変わる */
        var 進路 = d.querySelectorAll('.plan-select');
        ok(進路.length >= 2, 'お子さんの進路を選ぶ欄がある', 進路.length);
        var 高校 = d.querySelector('.plan-select[data-stage="high"]');
        eq(高校.value, 'private', '見本2は私立の高校を選んでいる');
        ok(d.getElementById('stage2b-body').textContent.indexOf('全部公立（大学は国立で自宅から通う）を選んだ場合との差は、累計で約') > 0,
          '公立との差が、累計いくらかで出る');
        var 前の文 = d.getElementById('stage2b-body').textContent;
        高校.value = 'public';
        高校.dispatchEvent(new w.Event('change'));
        ok(d.getElementById('stage2b-body').textContent !== 前の文, '進路を変えると、その場でグラフが描き直される');
        高校.value = 'private';
        高校.dispatchEvent(new w.Event('change'));

        /* まずやること（チェックリスト） */
        var todo = d.querySelectorAll('#stage3-body .checklist:not(.danger-list) li');
        ok(todo.length >= 5 && todo.length <= 7, 'まずやることが5〜7個に絞られている', todo.length + '個');
        eq(d.querySelectorAll('#stage3-body .checklist:not(.danger-list) input[type="checkbox"]').length, todo.length,
          'どの項目にもチェックの四角が付いている');
        ok(d.getElementById('copy-todo') !== null, 'リストをコピーするボタンがある');
        ok(d.querySelector('#stage3-body .checklist:not(.danger-list) a.jump[href^="#prog-"]') !== null,
          '該当する制度カードへのリンクが付いている');
        var 飛び先 = d.querySelector('#stage3-body .checklist:not(.danger-list) a.jump').getAttribute('href').slice(1);
        ok(d.getElementById(飛び先) !== null, 'リンク先の制度カードが実在する', 飛び先);

        /* 長い解説は、はじめは全部閉じている（ここは何も押す前に確かめる） */
        eq([].filter.call(d.querySelectorAll('#stage3-body .pit details'), function (x) { return x.open; }).length, 0,
          'はじめは、どの説明も閉じている');

        /* 落とし穴チェック（行動のルール） */
        var rules = d.querySelectorAll('#stage3-body .danger-list li');
        ok(rules.length >= 6, '落とし穴チェックが6個以上ある', rules.length + '個');
        eq(d.querySelectorAll('#stage3-body .danger-list input[type="checkbox"]').length, rules.length,
          'どの項目にもチェックの四角が付いている');
        ok(d.getElementById('copy-rule') !== null, '落とし穴チェックにもコピーのボタンがある');
        ok(d.getElementById('stage3-body').textContent.indexOf('生活防衛資金（生活費の半年分）が貯まるまで、投資はしない') > 0,
          '投資は生活防衛資金のあと、という項目がある');
        ok(d.getElementById('stage3-body').textContent.indexOf('FX・暗号資産・信用取引はやらない') > 0,
          'FXなどをやらない、という項目がある');
        /* 「くわしく」を押すと、折りたたみが開く */
        var 飛ぶ = d.querySelector('#stage3-body .danger-list a.jump');
        var 先id = 飛ぶ.getAttribute('href').slice(1);
        var 先 = d.getElementById(先id);
        ok(先 !== null, '落とし穴チェックのリンク先が実在する', 先id);
        ok(!先.querySelector('details').open, '飛ぶ前は閉じている');
        飛ぶ.click();
        ok(先.querySelector('details').open, '「くわしく」を押すと、その説明が開く');

        /* 長い解説は折りたたまれている */
        eq(d.querySelectorAll('#stage3-body .pit.red').length, 5, '赤い注意書きが5つ');
        ok(d.querySelectorAll('#stage3-body .pit.yellow').length >= 1, '黄色い注意書きが出る');
        eq(d.querySelectorAll('#stage3-body .pit details').length,
          d.querySelectorAll('#stage3-body .pit').length, 'どの注意書きも折りたたまれている');
        ok(d.querySelector('#stage3-body .pit h4').textContent.indexOf('闇バイト') > 0,
          '閉じたままでも、結論の1行が読める', d.querySelector('#stage3-body .pit h4').textContent);
        ok(d.querySelectorAll('#stage3-body .stance').length >= 4, '立場表明の枠が、事実と分けて表示される');
        ok(d.querySelector('#stage3-body .roi a.roi-link[href="#stage2b"]') !== null,
          '即金の話から、積み上げルートのグラフへ行けるリンクがある');
        ok(d.getElementById('stage3-body').textContent.indexOf('私たちAIかけこみ寺は') > 0,
          '立場表明が「私たちAIかけこみ寺は」で始まっている');

        eq(d.querySelectorAll('#stage4-body textarea').length, 5, 'AIに相談する文章が5本できる');
        var 文 = d.querySelector('#stage4-body textarea').value;
        ok(文.indexOf('東京都板橋区') > 0, '入力した地域が文章に入る');
        ok(文.indexOf('板橋区1-2-3') === -1, '番地のような情報は入らない');

        /* 赤字の見せ方（例1をもとに、生活費を上げて赤字にする） */
        d.querySelectorAll('#sample-buttons button')[0].click();
        d.getElementById('living-cost').value = '150000';
        /* 資格ルートはいったん切って、カードのボタンで入ることを確かめる */
        d.getElementById('training-on').checked = false;
        d.getElementById('training-after').value = '';
        d.getElementById('calc').click();
        return 待つ(300).then(function () {
          var 本文 = d.getElementById('stage2b-body').textContent;
          ok(本文.indexOf('毎月あと') > 0 && 本文.indexOf('足りない状態です') > 0,
            '赤字のときは、ひと月あたりいくら足りないかを先に出す', 本文.slice(0, 120));
          /* 警告カードになっていること */
          var カード = d.querySelector('#stage2b-body .alert-card');
          ok(カード !== null, '足りないことが、枠付きの警告カードで出る');
          ok(カード.querySelector('.alert-head').textContent.indexOf('毎月あと') >= 0,
            'カードの見出しに、足りない額が出ている', カード.querySelector('.alert-head').textContent);
          ok(カード.querySelector('.alert-sub[href="#gap-block"]') !== null,
            'いますぐ穴を塞ぐ手への副リンクがある');
          var ボタン = カード.querySelector('#go-training');
          ok(ボタン !== null, '資格ルートへ誘導する主ボタンがある');
          ok(ボタン.classList.contains('pulse'), '主ボタンが、目を引く形（脈打つ）になっている');
          ok(ボタン.textContent.indexOf('資格を取って収入を上げた場合を見る') >= 0,
            '主ボタンの文言が分かりやすい', ボタン.textContent);

          /* 押すと、資格ルートがONになって線が増える */
          ok(!d.getElementById('training-on').checked, '押す前は資格ルートがOFF');
          var 前の本数 = d.querySelectorAll('#stage2b-body svg path[stroke-linejoin]').length;
          ボタン.click();
          ok(d.getElementById('training-on').checked, 'ボタンを押すと資格ルートがONになる');
          ok(Number(d.getElementById('training-after').value) > 0,
            '資格を取ったあとの年収に、初期値が入る', d.getElementById('training-after').value);
          eq(移動先[移動先.length - 1], 'training-box',
            '資格ルートの設定まで画面が動く', 移動先.join(' / '));
          var 後の本数 = d.querySelectorAll('#stage2b-body svg path[stroke-linejoin]').length;
          ok(後の本数 > 前の本数, 'グラフの線が増える（資格ルートが描かれる）',
            前の本数 + ' → ' + 後の本数);
          /* 押した瞬間だけ、線が伸びる動きがつく */
          ok(d.querySelector('#stage2b-body path.draw-in') !== null,
            '押した瞬間、線が伸びる動きで描かれる');
          /* 資格ルートで底つきが消えるなら、印も消える */
          var カード3 = d.querySelector('#stage2b-body .alert-card');
          if (カード3 && カード3.querySelector('.alert-good')) {
            ok(d.querySelector('#stage2b-body svg').textContent.indexOf('底をつく') === -1,
              '資格ルートで底をつかなくなったら、グラフの印も消える');
          }
          d.getElementById('training-years').dispatchEvent(new w.Event('change', { bubbles: true }));
          ok(d.querySelector('#stage2b-body path.draw-in') === null,
            'そのあとの描き直しでは、動きをくり返さない');

          /* カードの文言が、資格ルートONの結果を反映して切りかわる */
          var カード2 = d.querySelector('#stage2b-body .alert-card');
          ok(カード2.querySelector('.alert-good') !== null || カード2.querySelector('.alert-warn-more') !== null,
            '資格ルートを出したあと、その結果がカードに反映される',
            カード2.textContent.replace(/\s+/g, ' ').slice(0, 160));
          ok(カード2.textContent.indexOf('底をつきません') > 0 ||
             カード2.textContent.indexOf('通っているあいだは苦しくなる') > 0,
            '底つきが解消するか、しないかが、はっきり書かれる',
            カード2.textContent.replace(/\s+/g, ' ').slice(0, 160));
          ok(カード2.querySelector('#go-training').textContent.indexOf('見直す') >= 0,
            'ONのあとは、ボタンが「設定を見直す」に変わる');
          d.getElementById('training-on').checked = false;
          d.getElementById('training-on').dispatchEvent(new w.Event('change', { bubbles: true }));
          ok(本文.indexOf('灰色の網かけから先は、線を描いていません') > 0,
            'このままの前提では成り立たない領域を、描いていないと明記している');
          ok(d.querySelector('#stage2b-body svg [fill="url(#hatch)"]') !== null,
            'グラフに網かけが出ている');
          /* 2段の言い分け（いまのまま／制度活用） */
          var 頭2 = カード.querySelector('.alert-head').textContent;
          var 体2 = カード.querySelector('.alert-body').textContent;
          ok(頭2.indexOf('いまのままだと') >= 0 || 頭2.indexOf('毎月あと') >= 0,
            'カードの見出しが「いまのまま」か「毎月の不足」から始まる', 頭2);
          if (頭2.indexOf('いまのままだと') >= 0) {
            ok(体2.indexOf('制度を活用すれ') >= 0 || 体2.indexOf('制度を活用すると') >= 0,
              '制度活用との違いが、2段目で語られる', 体2.slice(0, 100));
          }

          /* 印と、カードの文言が同じ年を指していること */
          var svg文 = d.querySelector('#stage2b-body svg').textContent;
          var 頭文 = カード.querySelector('.alert-head').textContent;
          if (頭文.indexOf('底をつく') > 0) {
            ok(svg文.indexOf('底をつく') >= 0, 'カードが底つきを言うときは、グラフにも印が出る');
          }
          ok(svg文.indexOf('借りられる上限') >= 0 || svg文.indexOf('底をつく') >= 0,
            '大事な地点に印が出ている', svg文.slice(0, 80));
          /* 借りられる上限が、グラフの床になっている */
          ok(d.querySelector('#stage2b-body svg').textContent.indexOf('法律上、これ以上は借りられません') > 0,
            '借りられる上限の線に、説明が付いている');
          ok(本文.indexOf('借りられる上限に先にぶつかる場合、そこから先は本当に打つ手がなくなります') > 0,
            '上限にぶつかる場合の注記が出ている');
          ok(d.querySelector('#stage2b-body .floor-note a[href*="fsa.go.jp"]') !== null,
            '金融庁の出典リンクがある');
          ok(d.querySelector('#stage2b-body .floor-note a[href="#gap-block"]') !== null,
            '埋める手のリストへのリンクがある');
          ok(d.getElementById('gap-block') !== null, 'リンク先の埋める手のリストが実在する');
          var 手 = d.querySelectorAll('#stage2b-body ol.gap-list li');
          ok(手.length >= 4, '足りないぶんを埋める手が4つ以上ならんでいる', 手.length + '個');
          ok(本文.indexOf('借金では埋められません') > 0, '借金では埋められないと書いてある');
          ok(本文.indexOf('カードローンやリボ払い') > 0, 'カードローン・リボ払いに触れている');
          ok(d.querySelector('#stage2b-body ol.gap-list a[href^="#prog-"]') !== null,
            '埋める手から、制度のカードへリンクしている');
          ok(手[0].textContent.indexOf('養育費') >= 0,
            '養育費が未取り決めなら、いちばん上に出す', 手[0].textContent.slice(0, 40));
          var 手の文 = d.querySelector('#stage2b-body ol.gap-list').textContent;
          /* 穴が小さいときは、今週から動けるものが上、時間のかかるものが下 */
          var 見出したち = [].map.call(手, function (li) { return li.textContent; });
          var 資格の位置 = 見出したち.findIndex(function (t) { return t.indexOf('資格を取って') >= 0; });
          var 食の位置 = 見出したち.findIndex(function (t) { return t.indexOf('食べるものを') >= 0; });
          if (資格の位置 >= 0 && 食の位置 >= 0) {
            ok(食の位置 < 資格の位置,
              '穴が小さいときは、今週から動けるものが、時間のかかるものより上に来る',
              '食 ' + 食の位置 + ' / 資格 ' + 資格の位置);
          }
          ok(手の文.indexOf('食べるものを助けてもらう') > 0, '食の支援が、埋める手に入っている');
          ok(d.querySelector('#stage2b-body ol.gap-list a[href="#prog-shoku_shien"]') !== null,
            '食の支援のカードへリンクしている');
          ok(d.getElementById('stage3-body').textContent.indexOf('カードローンやリボ払いで埋めない') > 0,
            '落とし穴チェックにも、借金で埋めない項目がある');
        }).then(function () {
          d.querySelectorAll('#sample-buttons button')[1].click();
          return 待つ(300);
        });
      }).then(function () {
        /* 「働かない」を選ぶと、線がその場で引き直される */
        d.querySelectorAll('#sample-buttons button')[0].click();
        d.getElementById('go-training').click();   /* まず資格ルートを出す */
        var 前の絵 = d.querySelector('#stage2b-body svg').outerHTML;
        d.querySelector('input[name="training-work"][value="none"]').checked = true;
        d.querySelector('input[name="training-work"][value="none"]')
          .dispatchEvent(new w.Event('change', { bubbles: true }));
        ok(d.querySelector('#stage2b-body svg').outerHTML !== 前の絵,
          '働き方を変えると、その場でグラフが引き直される');
        ok(d.getElementById('stage2b-body').textContent.indexOf('働かない</strong>ものとして') > 0 ||
           d.getElementById('stage2b-body').innerHTML.indexOf('働かない</strong>ものとして') > 0,
          '「働かない」を選んだことが説明に出る');
        ok(d.querySelector('input[name="training-work"][value="custom"]') !== null, '自由入力も選べる');
        d.querySelector('input[name="training-work"][value="half"]').checked = true;
        d.querySelector('input[name="training-work"][value="half"]')
          .dispatchEvent(new w.Event('change', { bubbles: true }));

        /* 6番目の例：親の援助が終わる崖 */
        d.querySelectorAll('#sample-buttons button')[5].click();
        return 待つ(300);
      }).then(function () {
        var 崖 = d.querySelector('#stage2-body .cliff-list').textContent;
        ok(崖.indexOf('親からの支援が終わる想定（親75歳）') > 0, '親の援助が終わる崖が画面に出る', 崖);
        ok(崖.indexOf('11歳') > 0, '親が68歳なら、いちばん下の子が11歳のときに援助が終わる', 崖);

        /* つまみを動かすと崖が動く */
        var sl = d.getElementById('parent-end-age');
        sl.value = '80';
        sl.dispatchEvent(new w.Event('input'));
        return 待つ(200).then(function () {
          var 崖2 = d.querySelector('#stage2-body .cliff-list').textContent;
          ok(崖2.indexOf('16歳') > 0, 'つまみを80歳にすると、崖が5年うしろにずれる', 崖2);
        });
      }).then(function () {
        ok(エラー.length === 0, '画面を動かしてもエラーが出ない', エラー.join(' / '));
        w.close();
      });
    });
  }).then(function () {
    /* ファイルを直接ダブルクリックして開いた場合（file://）でも動くこと。
       非技術者の方はサーバーの立て方を知らないので、ここが動かないと使えません。 */
    return JSDOM.fromFile(path.join(ROOT, 'index.html'), {
      runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true
    }).then(function (dom) {
      var w = dom.window, d = w.document, エラー = [];
      w.addEventListener('error', function (e) { エラー.push(String(e.error || e.message)); });
      return 待つ(2500).then(function () {
        ok(d.location.href.indexOf('file://') === 0, 'ファイルを直接開いた状態で試している');
        eq(d.getElementById('loading').style.display, 'none',
          'ファイルを直接開いても、データが読み込める');
        eq(d.querySelectorAll('#sample-buttons button').length, 6, 'ファイル直開きでも例のボタンが出る');
        d.querySelectorAll('#sample-buttons button')[3].click();
        return 待つ(300);
      }).then(function () {
        eq(d.querySelectorAll('#stage1-body .prog').length, 18, 'ファイル直開きでも制度カードが18枚出る');
        eq(d.querySelectorAll('#stage2-body svg path').length, 2, 'ファイル直開きでもグラフが描ける');
        ok(d.querySelectorAll('#stage3-body .pit').length > 0, 'ファイル直開きでも注意書きが出る');
        eq(d.querySelectorAll('#stage4-body textarea').length, 5, 'ファイル直開きでもAIに相談する文章が5本できる');
        ok(エラー.length === 0, 'ファイル直開きでもエラーが出ない', エラー.join(' / '));
        w.close();
      });
    });
  }).then(道筋のチェック).then(function () {
    server.close();
    console.log('\n============================================');
    console.log('  画面のチェック: 成功 ' + 成功 + ' 件 ／ 失敗 ' + 失敗 + ' 件');
    console.log('============================================');
    process.exit(失敗 === 0 ? 0 : 1);
  }).catch(function (e) {
    server.close();
    console.log('  NG  画面のチェックが途中で止まりました → ' + e.message);
    process.exit(1);
  });
});
