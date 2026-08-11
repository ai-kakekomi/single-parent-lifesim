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

        eq(d.querySelectorAll('#stage3-body .pit.red').length, 5, '赤い注意書きが5つ');
        ok(d.querySelectorAll('#stage3-body .pit.yellow').length >= 1, '黄色い注意書きが出る');
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
