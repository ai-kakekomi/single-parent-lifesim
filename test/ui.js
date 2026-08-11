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

    return 待つ(2500).then(function () {
      eq(d.getElementById('loading').style.display, 'none', 'データを読み込むと、読み込み中の表示が消える');
      var btns = d.querySelectorAll('#sample-buttons button');
      eq(btns.length, 6, '例のボタンが6つ並ぶ');

      btns[1].click();
      return 待つ(300).then(function () {
        ok(d.getElementById('stage1').classList.contains('shown'), '例を押すと、制度の一覧が出る');
        eq(d.querySelectorAll('#stage1-body .prog').length, 17, '制度カードが17枚出る');
        eq(d.querySelectorAll('#stage1-body .prog .src a').length, 17, 'どのカードにも出典のリンクが付いている');
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

        /* 貯金のたまり方（資産カーブ）が、いちばん最初の出力になっている */
        ok(d.getElementById('stage2b').classList.contains('shown'), '貯金のたまり方の欄が出る');
        ok(d.getElementById('stage2b').compareDocumentPosition(d.getElementById('stage1')) & 4,
          '貯金のグラフが、制度の一覧より前に出ている');
        ok(d.getElementById('stage1').compareDocumentPosition(d.getElementById('stage2')) & 4,
          '制度の一覧が、離婚の比較グラフより前に出ている');
        eq(d.querySelectorAll('#stage2b-body svg path').length, 2, '貯金のグラフの線が2本');
        ok(d.querySelector('#stage2b-body a[href="#stage1"]') !== null,
          '差の中身（制度の一覧）へ行くリンクがある');
        ok(d.getElementById('stage2b-body').textContent.indexOf('学校にかかるお金') > 0,
          '学校にかかるお金の説明が出る');
        ok(d.getElementById('stage2b-body').textContent.indexOf('すべて全国の平均値です') > 0,
          '平均値であることが画面に書いてある');
        ok(d.querySelector('#stage2b-body a[href*="mext.go.jp"]') !== null, '文部科学省の出典リンクがある');
        ok(d.querySelector('#stage2b-body a[href*="jasso.go.jp"]') !== null, '日本学生支援機構の出典リンクがある');
        ok(d.getElementById('stage2b-body').textContent.indexOf('生活防衛資金') > 0,
          '生活防衛資金の説明が出る');
        ok(d.getElementById('stage2b-body').textContent.indexOf('ここにとどくまで、投資のことは考えなくていいです') > 0,
          '帯の説明が、断言の形で書かれている');
        var 帯文 = d.getElementById('stage2b-body').textContent;
        ok(帯文.indexOf('とどくまで 約') > 0 || 帯文.indexOf('帯（') > 0 || 帯文.indexOf('すでに貯まっています') > 0,
          '帯にとどくまでの時期、または もう貯まっていることが出る', 帯文.slice(0, 160));
        ok(d.querySelector('#stage2b-body .stance') !== null,
          '3〜6か月分という幅が、私たちの立場の表明として分けて書かれている');
        ok(d.querySelector('#stage2b-body a[href*="fsa.go.jp"]') !== null, '金融庁の出典リンクがある');
        ok(d.querySelector('#stage2b-body a[href*="shiruporuto.jp"]') !== null, '金融広報中央委員会の出典リンクがある');

        /* すでに使っている制度は「利用中」と出る */
        eq(d.querySelectorAll('#used-programs input.used-prog').length, 9, 'すでに使っている制度を申告する欄が9つある');
        var 利用中 = d.querySelectorAll('#stage1-body .prog.used');
        eq(利用中.length, 3, '見本2は3件を利用中と申告しているので、3枚が利用中の表示になる', 利用中.length);
        ok(利用中[0].querySelector('.badge.used').textContent.indexOf('利用中') > 0, '利用中のしるしが出ている');
        ok(d.getElementById('stage1-summary').textContent.indexOf('すでに3件を使っている') >= 0,
          'まとめにも、すでに使っている件数が出る', d.getElementById('stage1-summary').textContent);

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
        ok(d.getElementById('stage3-body').textContent.indexOf('生活防衛資金（生活費の3〜6か月分）が貯まるまで、投資はしない') > 0,
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
        ok(d.getElementById('stage3-body').textContent.indexOf('私たちAIかけこみ寺は') > 0,
          '立場表明が「私たちAIかけこみ寺は」で始まっている');

        eq(d.querySelectorAll('#stage4-body textarea').length, 5, 'AIに相談する文章が5本できる');
        var 文 = d.querySelector('#stage4-body textarea').value;
        ok(文.indexOf('東京都板橋区') > 0, '入力した地域が文章に入る');
        ok(文.indexOf('板橋区1-2-3') === -1, '番地のような情報は入らない');

        /* 6番目の例：親の援助が終わる崖 */
        d.querySelectorAll('#sample-buttons button')[5].click();
        return 待つ(300);
      }).then(function () {
        var 崖 = d.querySelector('#stage2-body ul.hint').textContent;
        ok(崖.indexOf('親からの支援が終わる想定（親75歳）') > 0, '親の援助が終わる崖が画面に出る', 崖);
        ok(崖.indexOf('11歳') > 0, '親が68歳なら、いちばん下の子が11歳のときに援助が終わる', 崖);

        /* つまみを動かすと崖が動く */
        var sl = d.getElementById('parent-end-age');
        sl.value = '80';
        sl.dispatchEvent(new w.Event('input'));
        return 待つ(200).then(function () {
          var 崖2 = d.querySelector('#stage2-body ul.hint').textContent;
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
        eq(d.querySelectorAll('#stage1-body .prog').length, 17, 'ファイル直開きでも制度カードが17枚出る');
        eq(d.querySelectorAll('#stage2-body svg path').length, 2, 'ファイル直開きでもグラフが描ける');
        ok(d.querySelectorAll('#stage3-body .pit').length > 0, 'ファイル直開きでも注意書きが出る');
        eq(d.querySelectorAll('#stage4-body textarea').length, 5, 'ファイル直開きでもAIに相談する文章が5本できる');
        ok(エラー.length === 0, 'ファイル直開きでもエラーが出ない', エラー.join(' / '));
        w.close();
      });
    });
  }).then(function () {
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
