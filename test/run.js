/* ============================================================
 * run.js  自動チェック
 *
 *   node test/run.js
 *
 * Node.js だけで動きます（追加のパッケージは要りません）。
 * 制度データを直したら、必ずこれを走らせて全部通ることを確かめてください。
 * ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SPS = require(path.join(ROOT, 'js', 'engine.js'));
var Chart = require(path.join(ROOT, 'js', 'chart.js'));
var Prompts = require(path.join(ROOT, 'js', 'prompts.js'));

/* 画面と同じデータファイルを、そのまま読み込む（データは1か所にしかない） */
function 読む(p) { return require(path.join(ROOT, p)); }
var データ = 読む('data/programs.js');
var 見本 = 読む('data/samples.js');
var 落とし穴 = 読む('data/pitfalls.js');
データ.programs_by_id = {};
データ.programs.forEach(function (p) { データ.programs_by_id[p.id] = p; });

var 児扶 = データ.programs_by_id.jido_fuyo_teate.eligibility;
var 児手 = データ.programs_by_id.jido_teate.eligibility;

var 官公庁 = ['cfa.go.jp', 'mhlw.go.jp', 'mext.go.jp', 'moj.go.jp', 'fsa.go.jp', 'npa.go.jp',
  'caa.go.jp', 'nta.go.jp', 'soumu.go.jp', 'mlit.go.jp', 'cao.go.jp', 'gender.go.jp',
  'nenkin.go.jp', 'jasso.go.jp', 'kokusen.go.jp', 'stat.go.jp', 'maff.go.jp'];
function 官公庁か(url) {
  return 官公庁.some(function (d) { return url.indexOf('//' + d + '/') > 0 || url.indexOf('.' + d + '/') > 0; });
}

var 成功 = 0, 失敗 = 0;
function ok(cond, name, extra) {
  if (cond) { 成功++; }
  else { 失敗++; console.log('  NG  ' + name + (extra !== undefined ? '   → ' + extra : '')); }
}
function eq(actual, expected, name) {
  ok(actual === expected, name, 'got ' + JSON.stringify(actual) + ' / want ' + JSON.stringify(expected));
}
function 見出し(s) { console.log('\n== ' + s + ' =='); }

/* 所得額をぴったり狙うための助け（給与ではなくその他所得で入れると、
   給与所得者の10万円控除がかからないので、所得＝入力−8万 になる） */
function 所得で判定(所得, 扶養, 子数) {
  return SPS.児童扶養手当({
    otherIncome: 所得 + 児扶.social_insurance_flat_deduction,
    dependents: 扶養, childCount: (子数 === undefined ? Math.max(1, 扶養) : 子数)
  }, 児扶);
}

/* ------------------------------------------------------------ */
見出し('1. 給与収入から所得を出す（給与所得控除）');

eq(SPS.給与所得控除(1900000), 650000, '190万円ちょうどは最低保障の65万円');
eq(SPS.給与所得控除(1900001), Math.floor(1900001 * 0.30 + 80000), '190万円を1円こえると30%＋8万円の式に変わる');
eq(SPS.給与所得控除(3600000), Math.floor(3600000 * 0.30 + 80000), '360万円ちょうどは30%＋8万円');
eq(SPS.給与所得控除(3600001), Math.floor(3600001 * 0.20 + 440000), '360万円を1円こえると20%＋44万円');
eq(SPS.給与所得控除(8500001), 1950000, '850万円超は195万円で頭打ち');
eq(SPS.給与所得(1500000), 850000, '年収150万円の給与所得は85万円');
eq(SPS.給与所得(1810000), 1160000, '年収181万円の給与所得は116万円（こども家庭庁の計算例と同じ）');
eq(SPS.給与所得控除(1625000, 'r2'), 550000, '令和6年分以前の表も残っている（最低保障55万円）');
eq(SPS.給与所得(0), 0, '収入ゼロなら所得もゼロ');

/* ------------------------------------------------------------ */
見出し('2. 児童扶養手当の所得額の出し方');

eq(SPS.児童扶養手当の所得額({ salaryGross: 1810000, childSupportYearly: 300000 }, 児扶), 1220000,
  'こども家庭庁の計算例（給与181万・養育費年30万）の所得額は122万円');
eq(SPS.児童扶養手当の所得額({ salaryGross: 1810000, childSupportYearly: 0 }, 児扶), 980000,
  '同じ収入で養育費がないと98万円（養育費24万円ぶんの差）');
eq(SPS.児童扶養手当の所得額({ salaryGross: 1810000, childSupportYearly: 1000000 }, 児扶) -
   SPS.児童扶養手当の所得額({ salaryGross: 1810000, childSupportYearly: 0 }, 児扶), 800000,
  '養育費100万円のうち80万円（8割）だけが所得に足される');
eq(SPS.児童扶養手当の所得額({ salaryGross: 500000 }, 児扶), 0,
  '給与が少ないとき、控除で所得がマイナスになってもゼロ止まりになる');
eq(SPS.児童扶養手当の所得額({ salaryGross: 1810000, childSupportYearly: 300000, otherDeductions: 270000 }, 児扶), 950000,
  '障害者控除などの諸控除がある場合はその分だけ下がる');

/* ------------------------------------------------------------ */
見出し('3. 扶養親族等の数ごとの所得制限限度額');

var 期待限度 = [
  [0, 690000, 2080000], [1, 1070000, 2460000], [2, 1450000, 2840000],
  [3, 1830000, 3220000], [4, 2210000, 3600000], [5, 2590000, 3980000]
];
期待限度.forEach(function (r) {
  var l = SPS.限度額(児扶.income_limits_recipient, r[0]);
  eq(l.full, r[1], '扶養' + r[0] + '人の全部支給限度額');
  eq(l.partial, r[2], '扶養' + r[0] + '人の一部支給限度額');
});
eq(SPS.限度額(児扶.income_limits_recipient, 6).full, 2590000 + 380000, '表にない6人は1人あたり38万円を足して外挿する');
期待限度.forEach(function (r) {
  eq(r[2] - r[1], 1390000, '扶養' + r[0] + '人でも、全部支給と一部支給の限度額の幅は139万円で一定');
});

/* ------------------------------------------------------------ */
見出し('4. 判定の境目（全部支給・一部支給・対象外）');

[0, 1, 2, 3, 4].forEach(function (n) {
  var l = SPS.限度額(児扶.income_limits_recipient, n);
  eq(所得で判定(l.full, n).status, 'full', '扶養' + n + '人：全部支給の限度額ちょうどは全部支給');
  eq(所得で判定(l.full - 1, n).status, 'full', '扶養' + n + '人：限度額より1円少なければ全部支給');
  eq(所得で判定(l.full + 1, n).status, 'partial', '扶養' + n + '人：限度額を1円こえると一部支給');
  eq(所得で判定(l.partial, n).status, 'partial', '扶養' + n + '人：一部支給の限度額ちょうどはまだ一部支給');
  eq(所得で判定(l.partial + 1, n).status, 'none', '扶養' + n + '人：一部支給の限度額を1円こえると対象外');
});
eq(所得で判定(0, 1, 0).status, 'none', '対象になるお子さんが0人なら対象外');

/* ------------------------------------------------------------ */
見出し('5. 一部支給の傾斜計算');

var 公式例 = SPS.児童扶養手当({ salaryGross: 1810000, childSupportYearly: 300000, dependents: 1, childCount: 1 }, 児扶);
eq(公式例.monthly, 44080, 'こども家庭庁の公式計算例と1円まで一致する（44,080円）');
eq(公式例.status, 'partial', '同じ例は一部支給');

var l1 = SPS.限度額(児扶.income_limits_recipient, 1);
eq(所得で判定(l1.full + 1, 1).monthly, 48040, '一部支給のいちばん上は48,040円（全部支給の48,050円より10円低い）');
eq(所得で判定(l1.partial, 1).monthly, 11340, '一部支給のいちばん下は11,340円');
ok(所得で判定(l1.full + 1, 1).monthly > 所得で判定(l1.partial, 1).monthly, '所得がふえると手当は減る');

var 二人 = 所得で判定(l1.full, 2, 2);
eq(二人.monthly, 48050 + 11350, '全部支給でお子さん2人なら 48,050＋11,350＝59,400円');
var 三人 = 所得で判定(SPS.限度額(児扶.income_limits_recipient, 3).full, 3, 3);
eq(三人.monthly, 48050 + 11350 * 2, '第3子の加算額は第2子と同じ（2024年11月の改正後）');

var 加算境 = 所得で判定(SPS.限度額(児扶.income_limits_recipient, 2).partial, 2, 2);
eq(加算境.breakdown[1].amount, 5680, '2人目の加算の一部支給のいちばん下は5,680円');

/* 所得が1円ふえるごとに手当が単調に減ることを、ざっと確かめる */
var 前 = Infinity, 単調 = true;
for (var 所得 = l1.full; 所得 <= l1.partial; 所得 += 10000) {
  var m = 所得で判定(所得, 1).monthly;
  if (m > 前) { 単調 = false; }
  前 = m;
}
ok(単調, '全部支給の限度額から一部支給の限度額まで、手当は下がる一方である');

/* ------------------------------------------------------------ */
見出し('6. 児童手当');

eq(SPS.児童手当([1], 児手).monthly, 15000, '3歳未満が1人なら15,000円');
eq(SPS.児童手当([3], 児手).monthly, 10000, '3歳ちょうどからは10,000円');
eq(SPS.児童手当([17], 児手).monthly, 10000, '高校生年代（17歳）も10,000円');
eq(SPS.児童手当([19], 児手).monthly, 0, '19歳は支給の対象外');
eq(SPS.児童手当([2, 5, 8], 児手).monthly, 10000 + 10000 + 30000,
  '8歳・5歳・2歳なら、年上から数えて3人目の2歳が30,000円になる');
eq(SPS.児童手当([20, 10, 5], 児手).monthly, 10000 + 30000,
  '20歳の子は支給の対象外だが人数には数えるので、5歳が第3子として30,000円になる');
eq(SPS.児童手当([23, 10, 5], 児手).monthly, 10000 + 10000,
  '23歳の子は数にも入らないので、5歳は第2子のまま10,000円');
eq(SPS.児童手当([], 児手).monthly, 0, 'お子さんがいなければゼロ');

/* ------------------------------------------------------------ */
見出し('7. 手取りのめやす（表示用の概算）');

ok(SPS.手取りめやす(3000000, true) < 3000000, '手取りは額面より少ない');
ok(SPS.手取りめやす(3000000, true) > SPS.手取りめやす(3000000, false),
  'ひとり親控除がある分、同じ額面でも手取りは多くなる');
ok(SPS.手取りめやす(3000000, true) / 3000000 > 0.7 &&
   SPS.手取りめやす(3000000, true) / 3000000 < 0.9,
  '年収300万円の手取りは、額面の7割から9割の範囲に収まる');
eq(SPS.手取りめやす(0, true), 0, '収入ゼロなら手取りもゼロ');

/* ------------------------------------------------------------ */
見出し('8. 年ごとのシミュレーション（くらべるグラフ）');

var 入力A = {
  isSingleParent: true, myIncome: 2000000, spouseIncome: 4000000,
  children: [5, 8], housingNow: 60000, housingAfter: 60000,
  divorced_childSupportMonthly: 0, parentSupportMonthly: 0, parentAge: 0
};
var simA = SPS.シミュレーション(入力A, データ);
eq(simA.years.length, 22 - 5 + 1, 'いちばん下の子が5歳なら、22歳になるまでの18年ぶんが出る');
eq(simA.years[0].youngestAge, 5, '最初の年はいちばん下の子が5歳');
eq(simA.years[simA.years.length - 1].youngestAge, 22, '最後の年は22歳');
ok(simA.cliffs.length >= 2, '制度が切りかわるところが2つ以上見つかる', simA.cliffs.length);

/* 児童手当は上の子（8歳）が19歳になる年に減るはず */
var 児手が減る年 = null;
for (var i = 1; i < simA.years.length; i++) {
  if (simA.years[i].divorced.jidoTeate < simA.years[i - 1].divorced.jidoTeate) { 児手が減る年 = i; break; }
}
ok(児手が減る年 !== null, '児童手当が減る年が見つかる');
eq(simA.years[児手が減る年].childAges.filter(function (a) { return a === 19; }).length, 1,
  '児童手当がはじめて減るのは、上の子が19歳になる年');
ok(simA.years[児手が減る年].divorced.total < simA.years[児手が減る年 - 1].divorced.total,
  'その年、ひと月あたりに使えるお金も減っている');

/* 児童扶養手当がゼロになる年 */
var 児扶ゼロ = simA.years.filter(function (y) { return y.divorced.jidoFuyoTeate === 0; })[0];
ok(児扶ゼロ !== undefined, '児童扶養手当がゼロになる年がある');
ok(児扶ゼロ.childAges.every(function (a) { return a > 18; }),
  '児童扶養手当がゼロになるのは、お子さん全員が18歳をこえたあと');

/* 親の援助が終わる崖 */
var 入力B = Object.assign({}, 入力A, { parentSupportMonthly: 30000, parentAge: 70, parentSupportEndAge: 75 });
var simB = SPS.シミュレーション(入力B, データ);
var 援助崖 = simB.cliffs.filter(function (c) { return c.label.indexOf('親からの支援') === 0; })[0];
ok(援助崖 !== undefined, '親からの援助が終わる崖がグラフに出る');
eq(援助崖.offset, 5, '親が70歳なら、5年後（75歳）に援助が終わる');
eq(simB.years[4].divorced.parentSupport, 30000, '4年後まではまだ援助がある');
eq(simB.years[5].divorced.parentSupport, 0, '5年後には援助がなくなっている');
eq(simB.years[4].divorced.total - simB.years[5].divorced.total,
   30000 + (simB.years[4].divorced.jidoTeate - simB.years[5].divorced.jidoTeate) +
   (simB.years[4].divorced.jidoFuyoTeate - simB.years[5].divorced.jidoFuyoTeate),
  '援助が終わる年に、ちょうど援助の額（と手当の変化）だけ手取りが減る');

/* つまみを動かすと崖の位置が変わる */
var simC = SPS.シミュレーション(Object.assign({}, 入力B, { parentSupportEndAge: 80 }), データ);
eq(simC.cliffs.filter(function (c) { return c.label.indexOf('親からの支援') === 0; })[0].offset, 10,
  'つまみを80歳にすると、崖は10年後に動く');

/* 住居費の差がそのまま反映される */
var 入力D = Object.assign({}, 入力A, { isSingleParent: false, housingNow: 110000, housingAfter: 65000 });
var simD = SPS.シミュレーション(入力D, データ);
eq(simD.years[0].married.housing, 110000, '婚姻中の住居費は入力どおり');
eq(simD.years[0].divorced.housing, 65000, '離婚後の住居費も入力どおり（こちらで見積もらない）');
eq(simD.years[0].married.jidoFuyoTeate, 0, '婚姻中は児童扶養手当が入らない');
ok(simD.years[0].divorced.jidoFuyoTeate > 0, '離婚後は児童扶養手当が入る');

/* ------------------------------------------------------------ */
見出し('8-2. ひとりあたりに直した金額（等価可処分所得）');

eq(SPS.等価所得(300000, 1), 300000, 'ひとり暮らしなら、そのままの金額');
eq(SPS.等価所得(300000, 4), 150000, '4人家族なら、平方根の2で割って半分になる');
eq(SPS.等価所得(300000, 9), 100000, '9人なら、平方根の3で割る');
eq(SPS.等価所得(200000, 2), Math.round(200000 / Math.SQRT2), '2人家族は √2 で割る');
eq(SPS.等価所得(300000, 0), 300000, '人数が0でも1人として扱い、0で割らない');
eq(SPS.等価所得(0, 3), 0, '金額が0なら0');
ok(SPS.等価所得(300000, 3) > 300000 / 3,
  '単純に人数で割るより大きくなる（人数がふえても、それほどふえない費用があるため）');

/* 大人2人と大人1人を、同じものさしにそろえられているか */
var 入力E = {
  isSingleParent: false, myIncome: 1100000, spouseIncome: 5000000,
  children: [3, 6], housingNow: 110000, housingAfter: 65000,
  divorced_childSupportMonthly: 40000, parentSupportMonthly: 0, parentAge: 0
};
var simE = SPS.シミュレーション(入力E, データ);
var y0 = simE.years[0];
eq(y0.married.householdSize, 4, '結婚を続けた場合の世帯人数は 大人2＋子2 で4人');
eq(y0.divorced.householdSize, 3, '離婚した場合の世帯人数は 大人1＋子2 で3人');
eq(y0.married.perPerson, SPS.等価所得(y0.married.total, 4), '結婚を続けた場合のひとりあたりの金額が計算されている');
eq(y0.divorced.perPerson, SPS.等価所得(y0.divorced.total, 3), '離婚した場合のひとりあたりの金額が計算されている');
ok(y0.married.perPerson < y0.married.total, '人数で調整すると、家ぜんたいの金額より小さくなる');

var 総額の開き = y0.married.total / y0.divorced.total;
var 一人あたりの開き = y0.married.perPerson / y0.divorced.perPerson;
ok(一人あたりの開き < 総額の開き,
  'ひとりあたりに直すと、家ぜんたいの金額で比べたときより差が小さくなる（大人の人数のちがいを織り込むため）',
  '総額 ' + 総額の開き.toFixed(2) + '倍 → ひとりあたり ' + 一人あたりの開き.toFixed(2) + '倍');
simE.years.forEach(function (y) {
  ok(y.married.perPerson === SPS.等価所得(y.married.total, y.married.householdSize) &&
     y.divorced.perPerson === SPS.等価所得(y.divorced.total, y.divorced.householdSize),
    'どの年でも、ひとりあたりの金額が世帯人数と合っている');
});

/* ------------------------------------------------------------ */
見出し('8-3. 貯金のたまり方（資産カーブ）');

var 入力F = {
  isSingleParent: true, myIncome: 3200000, spouseIncome: 0,
  children: [14], housingNow: 90000, housingAfter: 90000, livingCost: 105000,
  currentSavings: 0, usedPrograms: [], plans: [],
  divorced_childSupportMonthly: 40000, parentSupportMonthly: 0, parentAge: 0
};
var 資産F = SPS.資産カーブ(入力F, データ);
var simF = SPS.シミュレーション(入力F, データ);
var 学費表 = データ.tuition;

eq(資産F.points.length, simF.years.length, '比較グラフと同じ年数ぶん出る');
eq(資産F.livingCost, 105000, '入力した生活費がそのまま使われる');
eq(資産F.safetyMin, 105000 * 3, '生活防衛資金の下は生活費の3か月分');
eq(資産F.safetyMax, 105000 * 6, '生活防衛資金の上は生活費の6か月分');
eq(資産F.startSavings, 0, 'いまの貯金を入れなければ0円から始まる');

/* ひと月の残り ＝ 使えるお金 − 生活費 − その年の学費 */
var 学0 = SPS.その年の学費(simF.years[0].childAges, [], 学費表).total;
eq(資産F.points[0].tuition, 学0, 'その年の学校にかかるお金が出ている');
eq(資産F.points[0].livingCost, 105000, '1年目の生活費は、入力した額そのまま');
eq(資産F.points[0].monthlyAll, simF.years[0].divorced.total - 105000 - Math.round(学0 / 12),
  'ひと月の残りは、使えるお金から生活費と学校のお金を引いた額');
/* いちばん左の点は、入力した貯金そのもの。そこから1年ぶんずつ積み上げる */
eq(資産F.points[0].all, 資産F.startSavings, 'いちばん左の点は、入力した貯金額そのもの');
eq(資産F.points[0].now, 資産F.startSavings, '「いまのまま」の線も同じ点から始まる');
eq(資産F.points[1].all, 資産F.points[0].all + 資産F.points[0].monthlyAll * 12,
  '1年後の点は、いまの貯金にその年の12か月ぶんを足した額');
eq(資産F.points[2].all, 資産F.points[1].all + 資産F.points[1].monthlyAll * 12,
  '2年後の点は、1年後にさらに1年ぶん積み増した額');
eq(資産F.points[0].youngestAge, simF.years[0].youngestAge, 'いちばん左の点は、いまのお子さんの年齢');

/* いまの貯金が起点になる */
var 起点あり = SPS.資産カーブ(Object.assign({}, 入力F, { currentSavings: 500000 }), データ);
eq(起点あり.startSavings, 500000, 'いまの貯金が起点として記録される');
eq(起点あり.points[0].all, 資産F.points[0].all + 500000, '起点のぶんだけ、線がまるごと上に上がる');
eq(起点あり.finalAll, 資産F.finalAll + 500000, '最後まで起点のぶんだけ上');
eq(起点あり.finalDiff, 資産F.finalDiff, '起点をずらしても、2本の線の開きは変わらない');
eq(資産F.safetyTarget, 105000 * 6, '生活防衛資金の目標は、生活費の半年分（1本の線）');
ok(!SPS.資産カーブ(Object.assign({}, 入力F, { currentSavings: 105000 * 3 }), データ).alreadyReachedSafety,
  '3か月分では、まだ生活防衛資金にとどいていない');
ok(SPS.資産カーブ(Object.assign({}, 入力F, { currentSavings: 105000 * 6 }), データ).alreadyReachedSafety,
  '半年分をすでに持っていれば、とどいていると判定する');
ok(!資産F.alreadyReachedSafety, '貯金0円なら、まだとどいていない');

/* すでに使っている制度 */
eq(資産F.points[0].monthlyNow,
   資産F.points[0].monthlyAll - 資産F.gapMonthly, '何も申告しなければ、いまの線は伸びしろのぶんだけ低い');
ok(資産F.gaps.length === 3, 'まだ使っていない制度が3つ見つかる', JSON.stringify(資産F.gaps));
/* 学費を助ける制度も「利用中」に入れないと、2本の線は重ならない
   （修学支援新制度と奨学給付金は自分で申し込むものなので） */
var すべて利用中 = SPS.資産カーブ(Object.assign({}, 入力F,
  { usedPrograms: ['jido_fuyo_teate', 'jido_teate', 'hitorioya_kojo',
    'koukou_shugaku_shienkin', 'koutou_kyoiku_shugaku_shien'] }), データ);
eq(すべて利用中.gaps.length, 0, 'すべて利用中と答えれば、伸びしろはゼロ');
eq(すべて利用中.finalDiff, 0, 'すべて利用中なら、2本の線は重なる');
eq(すべて利用中.points[0].monthlyNow, すべて利用中.points[0].monthlyAll, 'ひと月の残りも同じになる');
var 一部使用中 = SPS.資産カーブ(Object.assign({}, 入力F, { usedPrograms: ['jido_teate'] }), データ);
eq(一部使用中.gaps.length, 2, '児童手当だけ使っていれば、残りは2つ');
eq(一部使用中.points[0].monthlyNow - 資産F.points[0].monthlyNow,
   simF.years[0].divorced.jidoTeate, '申告した児童手当のぶんだけ、いまの線が上がる');
ok(一部使用中.finalDiff < 資産F.finalDiff, '使っている制度がふえるほど、2本の開きは小さくなる');

ok(資産F.diffAtTenYears > 0, '10年でも差がついている');
eq(資産F.finalDiff, 資産F.finalAll - 資産F.finalNow, '差は2本の線の開きそのもの');
eq(資産F.tenYearsMonths, Math.min(120, 資産F.totalMonths), '10年の差は、120か月時点（足りなければ最後の月）で出す');

/* 生活防衛資金にとどくまで */
eq(SPS.年月表示(1), '1か月', '月数の表示（1か月）');
eq(SPS.年月表示(12), '1年', '月数の表示（ちょうど1年）');
eq(SPS.年月表示(28), '2年4か月', '月数の表示（2年4か月）');
eq(SPS.年月表示(null), null, '月数がないときは何も出さない');

/* 赤字になる場合は、0で止めずマイナスのまま描く */
var 赤字 = SPS.資産カーブ(Object.assign({}, 入力F, { livingCost: 400000 }), データ);
ok(赤字.points[0].monthlyAll < 0, '生活費が多すぎればひと月の残りはマイナス');
ok(赤字.goesNegative, '貯金がマイナスになることを見つけている');
eq(赤字.negativeFromMonth, 1, '1か月目からマイナスになる');
ok(赤字.points[赤字.points.length - 1].all < 0, '最後までマイナスのまま。0で切っていない');
ok(赤字.reachMonths === null, '赤字なら生活防衛資金にはとどかない');
eq(赤字.safetyMin, 400000 * 3, '赤字でも生活防衛資金の帯は出す');

var 生活費なし = SPS.資産カーブ(Object.assign({}, 入力F, { livingCost: 0 }), データ);
eq(生活費なし.safetyMin, 0, '生活費が未入力なら帯は0');
ok(SPS.資産カーブ(Object.assign({}, 入力F, { children: [] }), データ) === null, 'お子さんがいなければ何も返さない');

/* 赤字のときは、線を22歳まで引きのばさない（予測として不誠実なので） */
ok(赤字.truncated, '赤字のときは、線を最後まで描かない');
eq(赤字.negativeFromOffset, 1, 'いまの貯金は0円なので、1年後の点からマイナスになる');
eq(赤字.points[0].all, 赤字.startSavings, '赤字のケースでも、いちばん左の点は入力した貯金額');
eq(赤字.drawUntilOffset,
   Math.min(赤字.points.length - 1, 0 + 3,
     赤字.hitsBorrowFloorAtOffset === null ? Infinity : 赤字.hitsBorrowFloorAtOffset),
  'マイナスに入ってから3年ぶん、または借りられる上限に達するまでの、早いほうで描くのをやめる');
ok(赤字.drawUntilOffset < 赤字.points.length - 1, '描く範囲が、全期間より短くなっている');
eq(赤字.shortfallMonthly, -赤字.points[0].monthlyAll, 'ひと月あたりいくら足りないかを持っている（累積ではなく月額）');
ok(赤字.shortfallMonthly > 0, '足りない額は正の数で持つ');

var 黒字 = SPS.資産カーブ(Object.assign({}, 入力F, { livingCost: 60000, currentSavings: 1000000 }), データ);
ok(!黒字.goesNegative, 'ずっと黒字なら、マイナスにならない');
ok(!黒字.truncated, 'ずっと黒字なら、線は最後まで描く');
eq(黒字.drawUntilOffset, 黒字.points.length - 1, '描く範囲は全期間');

/* 途中から赤字になる場合 */
var 途中赤字 = SPS.資産カーブ(Object.assign({}, 入力F, { currentSavings: 1500000 }), データ);
if (途中赤字.goesNegative) {
  ok(途中赤字.negativeFromOffset > 0, '途中から赤字になる場合、はじめの年ではない');
  eq(途中赤字.drawUntilOffset, Math.min(途中赤字.points.length - 1, 途中赤字.negativeFromOffset + 3),
    '赤字に入った年から3年ぶんまで描く');
}

/* 借りられる上限（貸金業法の総量規制）を、グラフの床にする */
eq(資産F.borrowFloor, -Math.floor(3200000 / 3), '床は年収の3分の1のマイナス');
eq(資産F.borrowFloorLabel, '年収の3分の1', '床のラベルが入っている');
eq(データ.borrow_limit.source.url.indexOf('fsa.go.jp') > 0, true, '床の出典は金融庁');
ok(データ.borrow_limit.source.law.indexOf('第13条の2') > 0, '根拠の条文が書いてある');
ok(/^\d{4}-\d{2}-\d{2}$/.test(データ.borrow_limit.source.last_verified), '床の出典に最終確認日がある');

ok(赤字.hitsBorrowFloor, '赤字がひどければ、借りられる上限にぶつかる');
ok(赤字.hitsBorrowFloorAtOffset !== null, '上限にぶつかる年が分かる');
ok(赤字.drawUntilOffset <= 赤字.hitsBorrowFloorAtOffset, '上限にぶつかったら、そこで描くのをやめる');

var 収入なし = SPS.資産カーブ(Object.assign({}, 入力F, { myIncome: 0 }), データ);
ok(収入なし.borrowFloor === 0 || 収入なし.borrowFloor === null || 収入なし.borrowFloor === -0,
  '年収がなければ、借りられる金額もない', String(収入なし.borrowFloor));
ok(!黒字.hitsBorrowFloor, '黒字なら、上限にはぶつからない');
eq(黒字.borrowFloor, -Math.floor(3200000 / 3), '黒字でも床の値そのものは持っている');

/* グラフの縦軸が、床より深くならないこと */
var 床svg = Chart.資産を描く(赤字);
ok(床svg.indexOf('法律上、これ以上は借りられません（年収の3分の1）') > 0, '床のラベルがグラフに出る');
ok(/stroke="#a32020" stroke-width="1.5"/.test(床svg), '床は、細い実線で引かれている（データの線と紛れないよう点線にしない）');
ok(/fill="#a32020" opacity="0.20"/.test(床svg),
  '床から下が、濃い赤で塗られている（法律上も借りられない領域）');
ok(/fill="#a32020" opacity="0.07"/.test(床svg),
  '0円から床までが、うすい赤で塗られている（借金でしのぐ領域）');
var うすい = /<rect x="\d+" y="([\d.]+)" width="[\d.]+" height="[\d.]+" fill="#a32020" opacity="0.07"/.exec(床svg);
var 濃い = /<rect x="\d+" y="([\d.]+)" width="[\d.]+" height="[\d.]+" fill="#a32020" opacity="0.20"/.exec(床svg);
ok(うすい && 濃い && Number(うすい[1]) < Number(濃い[1]),
  'うすい赤のほうが上（0円のすぐ下）、濃い赤のほうが下にある',
  うすい && 濃い ? うすい[1] + ' / ' + 濃い[1] : '');
ok(床svg.indexOf('ここから下は借金になります') > 0 || 床svg.indexOf('借金になる') > 0,
  'うすい赤のほうに「借金になる」と書いてある');
var 床ラベル = /<text x="([\d.]+)" y="([\d.]+)"[^>]*>法律上、これ以上/.exec(床svg);
ok(床ラベル !== null, '床のラベルが引ける');
var 床線 = /<line x1="\d+" y1="([\d.]+)"[^>]*stroke="#a32020"/.exec(床svg);
ok(床線 !== null && Number(床ラベル[2]) > Number(床線[1]),
  '床のラベルは、線より下（赤い領域の中）にある', 床ラベル && 床ラベル[2]);
var 目盛りの値 = [];
床svg.replace(/text-anchor="end" font-size="12" fill="[^"]*">(-?[\d.]+)(万|千万|0)</g, function (_, v, u) {
  目盛りの値.push(parseFloat(v) * (u === '千万' ? 10000000 : u === '万' ? 10000 : 1));
  return _;
});
ok(目盛りの値.length > 0, '床のあるグラフにも目盛りが出ている');
var 深い = 目盛りの値.filter(function (v) { return v < 赤字.borrowFloor - 1; });
eq(深い.length, 0, '縦の目盛りが、借りられる上限より深いところまで伸びていない', 深い.join(','));

/* ------------------------------------------------------------ */
見出し('8-3-2. 資格を取って抜けるルート');

var 訓表 = データ.training;
ok(!!訓表, '資格ルートのデータがある');
eq(訓表.monthly_non_taxable, 100000, '住民税が非課税の世帯の給付金は月10万円');
eq(訓表.monthly_taxable, 70500, '課税世帯は月70,500円');
eq(訓表.final_year_bonus, 40000, '最後の1年はさらに月4万円');
ok(訓表.source.url.indexOf('cfa.go.jp') > 0, '給付金の出典はこども家庭庁');
ok(訓表.assumption_note.indexOf('予測ではありません') > 0, 'めやすであることがデータに書いてある');
/* 実際に渡れる橋であることの実績 */
ok(訓表.track_record.indexOf('2,988人') > 0, '資格を取った人数が書いてある');
ok(訓表.track_record.indexOf('2,105人') > 0, '就職した人数が書いてある');
ok(訓表.track_record.indexOf('看護師945人') > 0, '職種の内訳が書いてある');
ok(訓表.track_record_source.url.indexOf('cfa.go.jp') > 0, '実績の出典はこども家庭庁');
ok(/^\d{4}-\d{2}-\d{2}$/.test(訓表.track_record_source.last_verified), '実績の出典に最終確認日がある');
ok(訓表.non_taxable_note.indexOf('非課税') > 0, '給付金が非課税であることが書いてある');
/* 窓口がどこかを、誤解なく書いてある（909市区等という数字だけだと「半分の自治体では使えない」と読まれる） */
ok(訓表.window_note.indexOf('町村') > 0 && 訓表.window_note.indexOf('都道府県') > 0,
  '町村にお住まいの場合の窓口が書いてある');
ok(訓表.window_note.indexOf('市・区にお住まいの場合') > 0, '市・区にお住まいの場合の窓口も書いてある');
ok(訓表.window_note.indexOf('ひとり親相談窓口で聞けば') > 0, '分からないときの聞き方が書いてある');
ok(訓表.track_record.indexOf('実施率は97.2%') > 0, '実施率は率として書き、母数だけが目立たないようにしている');

var 訓入力 = Object.assign({}, 入力F, {
  myIncome: 1500000, livingCost: 95000, currentSavings: 80000,
  training: { enabled: true, years: 2, afterIncome: 3200000 }
});
var 訓 = SPS.資産カーブ(訓入力, データ).training;
ok(訓 !== null, '資格ルートが計算される');
eq(訓.years, 2, '通う年数が反映される');
eq(訓.duringIncome, 750000, '通っているあいだの年収は、既定でいまの半分');
ok(訓.taxFree, '年収75万なら住民税は非課税の見込み');
eq(訓.grantMonthly, 100000, '非課税なので給付金は月10万円');
eq(訓.completionGrant, 50000, '修了支援給付金も非課税の額');

/* 訓練中は給付金が乗り、修了後は収入がジャンプする */
eq(訓.points[0].grant, 100000, '1年目は給付金が月10万円');
eq(訓.points[1].grant, 100000 + 40000, '最後の年（2年目）は4万円が足される');
eq(訓.points[2].grant, 0, '修了したら給付金は止まる');
eq(訓.points[0].income, 750000, '訓練中の年収');
eq(訓.points[2].income, 3200000, '修了後は見込みの年収にうつる');
ok(訓.points[2].monthly > 訓.points[0].monthly,
  '修了したあとは、通いはじめた年より、ひと月に残る額がふえる');
ok(訓.points[1].monthly > 訓.points[0].monthly,
  '最後の年は4万円の上乗せがあるぶん、いちばん残る');

/* 課税世帯になる場合 */
var 課税 = SPS.資産カーブ(Object.assign({}, 訓入力,
  { myIncome: 6000000, training: { enabled: true, years: 2, afterIncome: 7000000 } }), データ).training;
ok(!課税.taxFree, '訓練中の収入が高ければ、住民税は課税の見込み');
eq(課税.grantMonthly, 70500, '課税世帯の給付金は月70,500円');
eq(課税.completionGrant, 25000, '修了支援給付金も課税世帯の額');

/* 追い越す年 */
ok(訓.crossesOver, '低い収入からなら、資格ルートは「いまのまま」を追い越す');
ok(訓.crossoverOffset !== null && 訓.crossoverOffset >= 0, '追い越す年が分かる');
var 通常 = SPS.資産カーブ(Object.assign({}, 訓入力, { training: { enabled: false } }), データ);
ok(訓.finalAll > 通常.finalAll, '最後には、資格ルートのほうが貯金が多い');

/* 追い越さないケースは、正直にそう返す */
var 下がる = SPS.資産カーブ(Object.assign({}, 訓入力,
  { myIncome: 5000000, livingCost: 200000, training: { enabled: true, years: 4, afterIncome: 2000000 } }), データ).training;
ok(!下がる.crossesOver, '修了後の収入がいまより低ければ、追い越さない（正直に返す）');
eq(下がる.crossoverOffset, null, '追い越さない場合は、追い越す年を出さない');
ok(訓.crossoverOffset >= 1, '追い越す年は1年後より先（いちばん左の点は3本とも同じなので数えない）',
  String(訓.crossoverOffset));
ok(下がる.finalAll < SPS.資産カーブ(Object.assign({}, 訓入力,
  { myIncome: 5000000, livingCost: 200000, training: { enabled: false } }), データ).finalAll,
  '追い越さない場合は、最後の貯金も「いまのまま」より少ない');

/* 使わないときは何も返さない */
ok(SPS.資産カーブ(Object.assign({}, 訓入力, { training: { enabled: false } }), データ).training === null,
  'チェックを入れていなければ、資格ルートは計算しない');
ok(SPS.資産カーブ(Object.assign({}, 訓入力, { training: null }), データ).training === null,
  '設定がなくても落ちない');

/* グラフに3本目の線が出る */
var 訓svg = Chart.資産を描く(SPS.資産カーブ(訓入力, データ));
ok((訓svg.match(/stroke-linejoin="round"/g) || []).length === 3,
  '線が3本になる（いまのまま・制度活用・資格を取る）',
  String((訓svg.match(/stroke-linejoin="round"/g) || []).length));
ok(訓svg.indexOf('資格を取る') > 0, '3本目に名前が付いている');
ok(訓svg.indexOf('学校に通う期間（2年）') > 0, '通っている期間が、帯のラベルとして示されている');
ok(訓svg.indexOf('▲資格取得') === -1, '修了の印は置かない（帯の右はしが同じことを示しており、枠外に出ることもあるため）');
/* 期間の情報は上、金額のしきい目は下、に分けて置く */
var 期間ラベル = /<text x="[\d.]+" y="([\d.]+)"[^>]*>学校に通う期間/.exec(訓svg);
var 帯ラベル = /<text x="[\d.]+" y="([\d.]+)"[^>]*>まずここまで貯める/.exec(訓svg);
ok(期間ラベル !== null, '期間のラベルが引ける');
if (期間ラベル && 帯ラベル) {
  ok(Number(期間ラベル[1]) < Number(帯ラベル[1]),
    '期間のラベルは、金額のしきい目のラベルより上にある',
    期間ラベル[1] + ' / ' + 帯ラベル[1]);
}
ok(Chart.資産の凡例(true).indexOf('資格を取るルート') > 0, '凡例にも出る');
ok(Chart.資産の凡例(false).indexOf('資格を取るルート') === -1, '使わないときは凡例に出さない');
ok(重なり(訓svg).length === 0, '資格ルートを出しても、文字がかぶらない', 重なり(訓svg).join(' / '));

/* ------------------------------------------------------------ */
見出し('8-3-3. お子さんの成長で、生活費がふえること');

var 成長 = データ.living_cost_growth;
ok(!!成長, '成長にあわせた生活費のデータがある');
ok(成長.source_energy.url.indexOf('mhlw.go.jp') > 0, 'エネルギー量の出典は厚生労働省');
ok(成長.source_share.url.indexOf('stat.go.jp') > 0, '食費の割合の出典は総務省統計局');
ok(/^\d{4}-\d{2}-\d{2}$/.test(成長.source_energy.last_verified), '出典に最終確認日がある');
eq(成長.energy_bands.length, 7, '年齢の区分は7つ');

eq(SPS.必要エネルギー(1, 成長), 925, '1歳のエネルギー量（男950・女900の平均）');
eq(SPS.必要エネルギー(4, 成長), 1275, '4歳（男1,300・女1,250の平均）');
eq(SPS.必要エネルギー(7, 成長), 1500, '7歳');
eq(SPS.必要エネルギー(9, 成長), 1775, '9歳');
eq(SPS.必要エネルギー(11, 成長), 2175, '11歳');
eq(SPS.必要エネルギー(13, 成長), 2500, '13歳');
eq(SPS.必要エネルギー(16, 成長), 2575, '16歳');
eq(SPS.必要エネルギー(20, 成長), 2575, '18歳以上は15〜17歳と同じ量として扱う');
ok(SPS.必要エネルギー(13, 成長) / SPS.必要エネルギー(4, 成長) > 1.9,
  '中学生は幼児の約2倍食べる（厚生労働省の値どおり）',
  (SPS.必要エネルギー(13, 成長) / SPS.必要エネルギー(4, 成長)).toFixed(2) + '倍');

eq(SPS.生活費の倍率([5], [5], 成長), 1, '同じ年齢なら倍率は1');

/* 向きと大きさを、数値で固定する（「変わること」だけでは、逆数のまちがいを見つけられない） */
var 倍率実測 = SPS.生活費の倍率([5, 8], [13, 16], 成長);
ok(倍率実測 >= 1.20 && 倍率実測 <= 1.21,
  '5歳・8歳 → 13歳・16歳 の倍率が 1.20〜1.21 におさまる', 倍率実測.toFixed(4));
var 手計算 = (1 - 成長.food_share) + 成長.food_share *
  ((SPS.必要エネルギー(13, 成長) + SPS.必要エネルギー(16, 成長)) /
   (SPS.必要エネルギー(5, 成長) + SPS.必要エネルギー(8, 成長)));
ok(Math.abs(倍率実測 - 手計算) < 0.0001, '倍率が、式のとおりの値になっている（分子と分母が逆になっていない）',
  倍率実測.toFixed(4) + ' / ' + 手計算.toFixed(4));

/* 子が育つにつれて、倍率が1.0から単調にふえていくこと */
var 前の倍率 = 0, 単調にふえる = true, 全部1以上 = true;
for (var 歳 = 3; 歳 <= 17; 歳++) {
  var v = SPS.生活費の倍率([3], [歳], 成長);
  if (v < 前の倍率 - 1e-9) { 単調にふえる = false; }
  if (v < 1 - 1e-9) { 全部1以上 = false; }
  前の倍率 = v;
}
ok(単調にふえる, 'お子さんが育つにつれて、倍率は下がらずにふえていく');
ok(全部1以上, '基準より年上の年では、倍率がかならず1.0以上になる');
ok(SPS.生活費の倍率([13, 16], [5, 8], 成長) < 1,
  '逆に、時間を巻き戻す向きに渡したときだけ1未満になる（引数の順番の確認）',
  SPS.生活費の倍率([13, 16], [5, 8], 成長).toFixed(4));
ok(SPS.生活費の倍率([5], [13], 成長) < 1.4, 'ふえるのは食費の部分だけなので、倍率は大きくなりすぎない',
  SPS.生活費の倍率([5], [13], 成長).toFixed(3));
/* 食費の部分だけがふえていることの確認 */
var 比 = SPS.必要エネルギー(13, 成長) / SPS.必要エネルギー(5, 成長);
ok(Math.abs(SPS.生活費の倍率([5], [13], 成長) - ((1 - 成長.food_share) + 成長.food_share * 比)) < 0.0001,
  '倍率は「食費以外はそのまま＋食費だけエネルギー量の比でふえる」で計算されている');
eq(SPS.生活費の倍率([], [], 成長), 1, 'お子さんがいなければ倍率は1');
eq(SPS.生活費の倍率([5], [13], null), 1, 'データがなければ倍率は1（増やさない）');

/* 資産カーブに反映されていること */
var 成長入力 = Object.assign({}, 入力F, { children: [5], livingCost: 100000 });
var 成長c = SPS.資産カーブ(成長入力, データ);
eq(成長c.points[0].livingCost, 100000, '1年目は入力した生活費');
ok(成長c.points[8].livingCost > 成長c.points[0].livingCost,
  '8年後（13歳）には生活費がふえている',
  成長c.points[0].livingCost + ' → ' + 成長c.points[8].livingCost);
eq(成長c.points[8].livingCost,
  Math.round(100000 * SPS.生活費の倍率([5], [13], 成長)), 'ふえ方が倍率どおり');
/* 学費とは別勘定であること（二重に数えていない） */
ok(成長c.points[8].tuition > 0, 'その年は学費もかかっている');
eq(成長c.points[8].monthlyAll,
  SPS.シミュレーション(成長入力, データ).years[8].divorced.total
    - 成長c.points[8].livingCost - Math.round(成長c.points[8].tuition / 12),
  '生活費と学費は、それぞれ1回ずつだけ引かれている');

/* 3本の線が、同じ点から分かれること（グラフの左はしの取りちがえを防ぐ） */
var 起点そろえ = SPS.資産カーブ(Object.assign({}, 入力F, {
  currentSavings: 200000,
  training: { enabled: true, years: 2, afterIncome: 3200000 }
}), データ);
eq(起点そろえ.points[0].all, 200000, '「制度活用」の線の起点が、入力した貯金額');
eq(起点そろえ.points[0].now, 200000, '「いまのまま」の線の起点も、同じ額');
eq(起点そろえ.training.points[0].all, 200000, '「資格を取るルート」の起点も、同じ額');
eq(起点そろえ.training.points[0].youngestAge, 起点そろえ.points[0].youngestAge,
  '3本とも、同じ年齢の位置から始まる');
eq(起点そろえ.points.length, 起点そろえ.training.points.length, '点の数も3本ともそろっている');
/* 貯金額を変えると、起点だけがそのぶん動く（形は変わらない） */
var 起点ゼロ = SPS.資産カーブ(Object.assign({}, 入力F, {
  currentSavings: 0, training: { enabled: true, years: 2, afterIncome: 3200000 }
}), データ);
eq(起点ゼロ.points[0].all, 0, '貯金0円なら、起点も0円');
eq(起点そろえ.points[5].all - 起点ゼロ.points[5].all, 200000,
  '途中の点も、入れた貯金のぶんだけ上に平行移動する');
eq(起点そろえ.training.points[5].all - 起点ゼロ.training.points[5].all, 200000,
  '資格ルートの線も同じだけ平行移動する');
/* いちばん右の点は、末子22歳の時点 */
eq(起点そろえ.points[起点そろえ.points.length - 1].youngestAge, 22, 'いちばん右の点は末子22歳');

/* ------------------------------------------------------------ */
見出し('8-3-4. 月ごとの並びと、動く生活防衛資金');

var 月c = SPS.資産カーブ(Object.assign({}, 入力F, { currentSavings: 200000 }), データ);
ok(Array.isArray(月c.monthly), '月ごとの並びを持っている');
eq(月c.monthly.length, (月c.points.length - 1) * 12 + 1,
  '月ごとの点数は（年数−1）×12＋1', 月c.monthly.length + '点');
eq(月c.monthly[0].all, 200000, '月ごとの並びも、いちばん最初は入力した貯金額');
eq(月c.monthly[0].now, 200000, '「いまのまま」も同じ');
eq(月c.monthly[12].all, 月c.points[1].all, '12か月後の値が、1年後の点と一致する');
eq(月c.monthly[24].all, 月c.points[2].all, '24か月後の値が、2年後の点と一致する');
eq(月c.monthly[月c.monthly.length - 1].all, 月c.points[月c.points.length - 1].all,
  'いちばん最後の月が、いちばん右の点と一致する');
/* 月ごとに、ちゃんと1か月ぶんずつ動いている */
eq(月c.monthly[1].all - 月c.monthly[0].all, 月c.points[0].monthlyAll,
  '1か月で、その年のひと月ぶんだけ動く');

/* 底をつく月・床に当たる月が、月ごとの並びと合っている */
if (月c.negativeFromMonth !== null) {
  ok(月c.monthly[月c.negativeFromMonth].all < 0, '底をつく月の値は、たしかにマイナス');
  ok(月c.monthly[月c.negativeFromMonth - 1].all >= 0, 'そのひとつ前の月は、まだマイナスではない');
}
if (月c.hitsBorrowFloorAtMonth !== null) {
  ok(月c.monthly[月c.hitsBorrowFloorAtMonth].all <= 月c.borrowFloor, '床に当たる月の値は、床以下');
  ok(月c.monthly[月c.hitsBorrowFloorAtMonth - 1].all > 月c.borrowFloor, 'そのひとつ前の月は、まだ床の上');
}

/* 生活防衛資金の目標が、お子さんの成長についていく */
var 目標たち = 月c.monthly.map(function (q) { return q.target; });
var 目標が下がらない = true;
for (var t2 = 1; t2 < 目標たち.length; t2++) {
  if (目標たち[t2] < 目標たち[t2 - 1]) { 目標が下がらない = false; }
}
ok(目標が下がらない, '生活防衛資金の線は、下がることがない（単調非減少）');
ok(月c.safetyTargetEnd > 月c.safetyTargetNow,
  'お子さんが大きくなるぶん、目標の額は上がっていく',
  月c.safetyTargetNow + ' → ' + 月c.safetyTargetEnd);
eq(月c.safetyTargetNow, 月c.points[0].livingCost * 6, 'いまの目標は、いまの生活費の半年分');
eq(月c.safetyTargetEnd, 月c.monthly[月c.monthly.length - 1].target, '最後の目標も並びと一致する');
月c.points.forEach(function (pt) {
  eq(pt.safetyTarget, pt.livingCost * 6, 'どの年でも、目標はその年の生活費の半年分');
});

/* 到達の判定が、その時点の目標との比べ方になっている */
var 判定用 = SPS.資産カーブ(Object.assign({}, 入力F, { currentSavings: 月c.safetyTargetNow }), データ);
eq(判定用.reachMonths, 0, 'いまの目標ちょうどを持っていれば、その時点で到達と判定する');
ok(判定用.alreadyReachedSafety, 'すでに到達していると分かる');
var 少し足りない = SPS.資産カーブ(Object.assign({}, 入力F, { currentSavings: 月c.safetyTargetNow - 1 }), データ);
ok(!少し足りない.alreadyReachedSafety, '1円足りなければ、まだ到達していない');

/* いちど届いても、生活費が上がって再び下回るケースを見つけられる */
var 再び = SPS.資産カーブ(Object.assign({}, 入力F, {
  children: [3], livingCost: 100000, currentSavings: 620000, myIncome: 2100000
}), データ);
ok(再び.reachMonths !== null, 'いちどは生活防衛資金にとどく');
ok(typeof 再び.fallsBelowSafetyAgain === 'boolean', '再び下回るかどうかを持っている');
if (再び.fallsBelowSafetyAgain) {
  ok(再び.fallsBelowSafetyAgainAtMonth > 再び.reachMonths, '下回るのは、とどいたあとの月');
  ok(再び.monthly[再び.fallsBelowSafetyAgainAtMonth].all <
     再び.monthly[再び.fallsBelowSafetyAgainAtMonth].target, 'その月は、たしかに目標を下回っている');
}

/* 資格ルートも月ごとに持つ */
var 訓月 = SPS.資産カーブ(Object.assign({}, 訓入力, { currentSavings: 200000 }), データ).training;
ok(Array.isArray(訓月.monthly), '資格ルートも月ごとの並びを持っている');
eq(訓月.monthly[0].all, 200000, '資格ルートの並びも、最初は入力した貯金額');
eq(訓月.monthly.length, 月c.monthly.length, '本体と同じ月数');
eq(訓月.monthly[12].all, 訓月.points[1].all, '12か月後が1年後の点と一致する');
/* 訓練中の谷が、月の精度で見える */
var 訓練中の値 = 訓月.monthly.slice(0, 訓月.years * 12 + 1).map(function (q) { return q.all; });
eq(訓練中の値.length, 訓月.years * 12 + 1, '訓練期間ぶんの月の値がある');

/* グラフが月ごとに描かれている（点の数がふえている） */
var 月svg = Chart.資産を描く(月c);
var 線の点数 = (月svg.match(/L\d/g) || []).length;
ok(線の点数 > 月c.points.length * 2, 'グラフの線が、年ごとより細かい点で描かれている', 線の点数 + '点');
ok(/生活防衛資金 \d+万円（生活費の半年分）/.test(月svg),
  'ラベルに金額が入っている', (/生活防衛資金 [^<]*/.exec(月svg) || ['見つからず'])[0]);
/* 生活防衛資金が、水平な直線ではなくなっている */
var 目標線 = /<path d="(M[^"]+)" fill="none" stroke="#1c7a4a"/.exec(月svg);
ok(目標線 !== null, '生活防衛資金が線（path）で描かれている');
var 目標点 = (目標線[1].match(/L[\d.]+ [\d.]+/g) || []);
ok(目標点.length > 12, '生活防衛資金の線も、月ごとの点で描かれている', 目標点.length + '点');
var 目標y値 = 目標点.map(function (t3) { return Number(t3.split(' ')[1]); });
var 下がっていく = true;
for (var g2 = 1; g2 < 目標y値.length; g2++) { if (目標y値[g2] > 目標y値[g2 - 1] + 0.01) { 下がっていく = false; } }
ok(下がっていく, '生活防衛資金の線が、右肩上がりに描かれている（画面のyは下ほど大きい）');
ok(目標y値[目標y値.length - 1] < 目標y値[0], '最後は最初より上にある');

/* ------------------------------------------------------------ */
見出し('8-3-5. 家計のうちわけ表');

/* 表の合計が、カーブの月の収支とぴったり合うこと（全サンプル×全年×2シナリオ） */
var うちわけ確認 = 0;
見本.samples.forEach(function (sm) {
  var 入 = Object.assign({}, sm.input, { divorced_childSupportMonthly: sm.input.childSupportMonthly });
  var c2 = SPS.資産カーブ(入, データ);
  c2.points.forEach(function (pt, i) {
    ['all', 'now'].forEach(function (線) {
      var b = pt.breakdown[線];
      var 収 = 0, 支 = 0;
      b.income.forEach(function (r) { 収 += r.amount; });
      b.expense.forEach(function (r) { 支 += r.amount; });
      var 期待 = (線 === 'all') ? pt.monthlyAll : pt.monthlyNow;
      if (収 - 支 !== 期待) {
        ok(false, '[' + sm.id + '] ' + pt.youngestAge + '歳・' + 線 + 'のうちわけ表の合計が、カーブの月の収支と合う',
          (収 - 支) + ' / ' + 期待);
      }
      うちわけ確認++;
    });
  });
});
ok(true, 'うちわけ表の合計が、すべての年・すべての見本でカーブと一致する（' + うちわけ確認 + '通り）');

/* 資格ルートのうちわけも一致すること */
var 訓う = SPS.資産カーブ(Object.assign({}, 訓入力,
  { training: { enabled: true, years: 2, afterIncome: 3200000 } }), データ).training;
訓う.points.forEach(function (pt) {
  var 収 = 0, 支 = 0;
  pt.breakdown.income.forEach(function (r) { 収 += r.amount; });
  pt.breakdown.expense.forEach(function (r) { 支 += r.amount; });
  eq(収 - 支, pt.monthly, '資格ルートのうちわけも、月の収支と合う（' + pt.youngestAge + '歳）');
});

/* 0円の項目には、理由が書いてあること */
var うち0 = 資産F.points[0].breakdown.all;
うち0.income.forEach(function (r) {
  if (r.amount === 0) { ok(!!r.reason, '「' + r.name + '」が0円のとき、理由が書いてある'); }
});
ok(うち0.income.some(function (r) { return r.key === 'jidoFuyoTeate'; }), '児童扶養手当の行がある');
ok(うち0.income.some(function (r) { return r.key === 'kojo'; }), 'ひとり親控除の行がある');
ok(うち0.expense.some(function (r) { return r.key === 'living'; }), '生活費の行がある');
ok(うち0.expense.some(function (r) { return r.key === 'childcare'; }), '保育料の行がある');

/* 手当が所得で消えているときの理由 */
var 高収入 = SPS.資産カーブ(Object.assign({}, 入力F, { myIncome: 8000000 }), データ);
var 児扶行 = 高収入.points[0].breakdown.all.income.filter(function (r) { return r.key === 'jidoFuyoTeate'; })[0];
eq(児扶行.amount, 0, '所得が高ければ児童扶養手当は0円');
ok(児扶行.reason.indexOf('所得') >= 0, 'その理由が「所得が限度額をこえている」と書かれる', 児扶行.reason);

/* できごと（発生・消滅）が拾えること */
var 崖入力 = { isSingleParent: true, myIncome: 1500000, children: [17], housingNow: 60000, housingAfter: 60000,
  livingCost: 90000, currentSavings: 0, plans: [], usedPrograms: [],
  divorced_childSupportMonthly: 0, parentSupportMonthly: 0, parentAge: 0 };
var 崖c = SPS.資産カーブ(崖入力, データ);
var 児扶が消える年 = null;
崖c.points.forEach(function (pt, i) {
  if (i > 0 && 児扶が消える年 === null) {
    var 前 = 崖c.points[i - 1].breakdown.all.income.filter(function (r) { return r.key === 'jidoFuyoTeate'; })[0];
    var いま = pt.breakdown.all.income.filter(function (r) { return r.key === 'jidoFuyoTeate'; })[0];
    if (前.amount > 0 && いま.amount === 0) { 児扶が消える年 = pt.youngestAge; }
  }
});
eq(児扶が消える年, 19, '児童扶養手当がなくなる年（18歳をこえた年）を、うちわけから見つけられる');

/* ------------------------------------------------------------ */
見出し('8-3-5-2. うちわけの各行の、数字のつじつま');

/* 行の中の数字どうしが合っているか（もとの額 − 支援 ＝ 表示額）。
   合計だけを見ていると、行の中のずれを見のがす。実際に見のがしていた。 */
var 行の点検 = 0, 行のずれ = [];
function 行を点検する(名前, b, 印) {
  b.expense.forEach(function (r) {
    行の点検++;
    if (r.key === 'tuition') {
      if (r.gross == null || r.support == null) {
        行のずれ.push(名前 + ' ' + 印 + ' 学費に もとの額／支援 が入っていない');
      } else if (r.gross - r.support !== r.amount) {
        行のずれ.push(名前 + ' ' + 印 + ' 学費: ' + r.gross + ' − ' + r.support + ' ≠ ' + r.amount);
      } else if (r.support < 0 || r.gross < 0 || r.amount < 0) {
        行のずれ.push(名前 + ' ' + 印 + ' 学費にマイナスの数字がある');
      }
    }
    if (r.key === 'living') {
      if (r.baseline == null || r.increase == null) {
        行のずれ.push(名前 + ' ' + 印 + ' 生活費に もとの額／ふえた額 が入っていない');
      } else if (r.baseline + r.increase !== r.amount) {
        行のずれ.push(名前 + ' ' + 印 + ' 生活費: ' + r.baseline + ' ＋ ' + r.increase + ' ≠ ' + r.amount);
      } else if (r.increase < 0) {
        行のずれ.push(名前 + ' ' + 印 + ' 生活費が入力より減っている');
      }
    }
    if (r.key === 'childcare') {
      if (r.gross == null || r.discount == null) {
        行のずれ.push(名前 + ' ' + 印 + ' 保育料に 軽減前／軽減額 が入っていない');
      } else if (r.gross - r.discount !== r.amount) {
        行のずれ.push(名前 + ' ' + 印 + ' 保育料: ' + r.gross + ' − ' + r.discount + ' ≠ ' + r.amount);
      } else if (r.discount < 0 || r.gross < 0 || r.amount < 0) {
        行のずれ.push(名前 + ' ' + 印 + ' 保育料にマイナスの数字がある');
      }
    }

    /* お子さんごとの内訳の合計が、その行の金額とぴったり合うこと */
    if (r.children && r.children.length) {
      var 子和 = 0, 子元和 = 0;
      r.children.forEach(function (ch) {
        子和 += ch.amount;
        子元和 += (ch.gross || 0);
        if (ch.gross != null && ch.support != null && ch.gross - ch.support !== ch.amount) {
          行のずれ.push(名前 + ' ' + 印 + ' ' + r.key + ' の子ども別: ' +
            ch.gross + ' − ' + ch.support + ' ≠ ' + ch.amount);
        }
        if (ch.gross != null && ch.discount != null && ch.gross - ch.discount !== ch.amount) {
          行のずれ.push(名前 + ' ' + 印 + ' ' + r.key + ' の子ども別(軽減): ' +
            ch.gross + ' − ' + ch.discount + ' ≠ ' + ch.amount);
        }
        if (!ch.stage) { 行のずれ.push(名前 + ' ' + 印 + ' ' + r.key + ' の子どもに学校の名前がない'); }
        if (ch.index == null || ch.age == null) {
          行のずれ.push(名前 + ' ' + 印 + ' ' + r.key + ' の子どもに何人目・年齢がない');
        }
      });
      if (子和 !== r.amount) {
        行のずれ.push(名前 + ' ' + 印 + ' ' + r.key + ' 子ども別の合計 ' + 子和 + ' ≠ 行の金額 ' + r.amount);
      }
      if (r.gross != null && 子元和 !== r.gross) {
        行のずれ.push(名前 + ' ' + 印 + ' ' + r.key + ' もとの額の合計 ' + 子元和 + ' ≠ ' + r.gross);
      }
    }
  });
}

見本.samples.forEach(function (sm) {
  var 入 = Object.assign({}, sm.input, { divorced_childSupportMonthly: sm.input.childSupportMonthly });
  [[], [{ high: 'private', university: 'private_away' }, { high: 'private', university: 'private_away' }]]
    .forEach(function (プラン, pi) {
      var 入2 = Object.assign({}, 入, { plans: プラン });
      var c3 = SPS.資産カーブ(入2, データ);
      c3.points.forEach(function (pt) {
        ['all', 'now'].forEach(function (線) {
          行を点検する(sm.id + (pi ? '(私立)' : ''), pt.breakdown[線], pt.youngestAge + '歳・' + 線);
        });
      });
      var tr2 = SPS.資産カーブ(Object.assign({}, 入2,
        { training: { enabled: true, years: 2, afterIncome: 3200000 } }), データ).training;
      if (tr2) {
        tr2.points.forEach(function (pt) {
          行を点検する(sm.id + (pi ? '(私立)' : ''), pt.breakdown, pt.youngestAge + '歳・資格ルート');
        });
      }
    });
});
ok(行のずれ.length === 0,
  'うちわけの各行で「もとの額 − 支援 ＝ 表示額」などのつじつまが合っている（' + 行の点検 + '行を点検）',
  行のずれ.slice(0, 3).join(' / '));

/* 表に出す数字は、その行の中だけで完結していること（別のところから持ってこない） */
var 混線c = SPS.資産カーブ(Object.assign({}, 入力F, { children: [18], myIncome: 3200000 }), データ);
var 混線pt = 混線c.points[0];
var 全部行 = 混線pt.breakdown.all.expense.filter(function (r) { return r.key === 'tuition'; })[0];
var いま行 = 混線pt.breakdown.now.expense.filter(function (r) { return r.key === 'tuition'; })[0];
ok(全部行.support > 0, '「制度活用」では、大学の支援が入っている', String(全部行.support));
eq(いま行.support, 0, '「いまのまま」では、申請していないので支援は0円');
eq(いま行.amount, いま行.gross, '「いまのまま」の表示額は、もとの額と同じになる');
ok(全部行.amount < いま行.amount, '「制度活用」のほうが、実際に払う額は少ない');
eq(全部行.gross, いま行.gross, 'もとの額は、どちらの線でも同じ');

/* ------------------------------------------------------------ */
見出し('8-3-6. 0歳から2歳の保育料');

var 保 = データ.childcare;
ok(!!保, '保育料のデータがある');
eq(保.tiers.length, 8, '国の基準は8つの階層');
ok(保.source.url_detail.indexOf('cfa.go.jp') > 0, '出典はこども家庭庁');
ok(/^\d{4}-\d{2}-\d{2}$/.test(保.source.last_verified), '最終確認日がある');
ok(保.note_municipality.indexOf('市区町村が決める') > 0 || 保.note_municipality.indexOf('市区町村') > 0,
  '実際は市区町村が決めることが書いてある');

eq(SPS.保育料([3, 5], 4500000, true, 保), 0, '3歳から5歳は無償化で0円');
eq(SPS.保育料([6, 10], 4500000, true, 保), 0, '小学生以上も0円');
eq(SPS.保育料([0], 2000000, true, 保), 0, '住民税非課税の世帯は0円');
eq(SPS.保育料([0], 2600000, true, 保), 0, '年収260万円ちょうどまでは0円');
eq(SPS.保育料([0], 2600001, true, 保), 9000, '260万円を1円こえると、ひとり親は月9,000円');
eq(SPS.保育料([0], 3300000, true, 保), 9000, '330万円までは9,000円');
eq(SPS.保育料([0], 3600000, true, 保), 9000, '360万円までも9,000円');
eq(SPS.保育料([0], 3600001, true, 保), 30000, '360万円をこえると30,000円');
eq(SPS.保育料([0], 4700000, true, 保), 30000, '470万円までは30,000円');
eq(SPS.保育料([0], 6400000, true, 保), 44500, '640万円までは44,500円');
eq(SPS.保育料([0], 20000000, true, 保), 104000, 'いちばん上の階層は104,000円');
/* ひとり親でない場合は、国基準のふつうの額 */
eq(SPS.保育料([0], 3000000, false, 保), 19500, 'ひとり親でなければ19,500円');
eq(SPS.保育料([0], 3500000, false, 保), 30000, 'ひとり親でなければ30,000円');
/* きょうだいの軽減 */
eq(SPS.保育料([0, 2], 4500000, true, 保), 30000 + 15000, '2人目は半額');
eq(SPS.保育料([0, 2], 3000000, true, 保), 9000, '年収360万円未満のひとり親は、2人目から0円');
eq(SPS.保育料([0, 1, 2], 4500000, true, 保), 30000 + 15000 + 0, '3人目からは0円');
eq(SPS.保育料([], 4500000, true, 保), 0, 'お子さんがいなければ0円');
eq(SPS.保育料([0], 4500000, true, null), 0, 'データがなければ0円');

/* 保育料がカーブに乗ること */
var 保入力 = Object.assign({}, 入力F, { children: [1], myIncome: 4500000, livingCost: 100000 });
var 保c = SPS.資産カーブ(保入力, データ);
eq(保c.points[0].childcare, 30000, '0歳から2歳のあいだは保育料がかかる');
var 三歳の点 = 保c.points.filter(function (pt) { return pt.youngestAge === 3; })[0];
eq(三歳の点.childcare, 0, '3歳になると保育料は0円になる（無償化）');
ok(保c.points[0].monthlyAll < SPS.資産カーブ(
  Object.assign({}, 保入力, { children: [3] }), データ).points[0].monthlyAll,
  '保育料のぶんだけ、ひと月の残りが少なくなる');

/* ------------------------------------------------------------ */
見出し('8-3-7. 学校そのものと、塾・習いごとの分離');

var 学表 = データ.tuition;
/* 学習費調査の内訳（学校教育費＋給食費／学校外活動費）が、総額とぴったり合うこと */
学表.bands.forEach(function (b) {
  if (!b.school_costs) { return; }
  ['public', 'private'].forEach(function (種) {
    eq(b.school_costs[種] + b.extra_costs[種], b.costs[種],
      '「' + b.label + '」の' + (種 === 'public' ? '公立' : '私立') +
      'は、学校そのもの＋塾・習いごと＝学習費総額');
  });
});
eq(学表.bands[0].school_costs.public, 110110, '公立小の学校そのものは110,110円（学校教育費74,336＋給食費35,774）');
eq(学表.bands[0].extra_costs.public, 256489, '公立小の塾・習いごとは256,489円');
ok(学表.bands[0].extra_costs.public > 学表.bands[0].school_costs.public,
  '公立小では、塾・習いごとのほうが学校そのものより高い（だから分ける必要がある）');
ok(学表.note_split.indexOf('256,489円') > 0, '分けている理由が、実際の数字つきでデータに書いてある');
ok(学表.note_extra_varies.indexOf('世帯の年間収入が増加するに連れて') > 0,
  '塾代が収入で変わることが、調査の言葉で書いてある');

/* 塾の設定が効くこと */
var 平均で = SPS.学費の内訳(8, {}, 学表, { useAverage: true });
var ゼロで = SPS.学費の内訳(8, {}, 学表, { useAverage: false, monthly: 0 });
var 五千で = SPS.学費の内訳(8, {}, 学表, { useAverage: false, monthly: 5000 });
eq(平均で.total, 366599, '全国平均を使えば、学習費総額どおり');
eq(ゼロで.extra, 0, '塾を0円にすれば、塾のぶんは0円');
eq(ゼロで.total, 110110, '0円なら、学校そのものだけが残る');
eq(ゼロで.school, 平均で.school, '塾の額を変えても、学校そのものの額は変わらない');
eq(五千で.extra, 60000, 'ひと月5,000円なら、年60,000円');
eq(五千で.total, 110110 + 60000, '合計もそのぶんだけ');
/* 大学は分けない（学費と生活費の調査なので、塾の設定に左右されない） */
eq(SPS.学費の内訳(19, {}, 学表, { useAverage: false, monthly: 0 }).total,
   SPS.学費の内訳(19, {}, 学表, { useAverage: true }).total, '大学は塾の設定に左右されない');
eq(SPS.学費の内訳(4, {}, 学表, { useAverage: true }).total, 0, '幼稚園の年齢は0円のまま');

/* 制度の助けは「学校そのもの」までしか当たらない（塾代は対象外） */
var 塾状況 = { income: 1500000, children: 1, taxFree: true, grants: { kyufukin: true, university: true } };
var 高校平均 = SPS.その年の学費([15], [{}], 学表, 塾状況, { useAverage: true });
var 高校ゼロ = SPS.その年の学費([15], [{}], 学表, 塾状況, { useAverage: false, monthly: 0 });
eq(高校平均.support, 高校ゼロ.support, '塾代を変えても、制度の助けの額は変わらない');
ok(高校平均.support <= 高校平均.school, '制度の助けは、学校そのものの額をこえない');
ok(高校ゼロ.net >= 0, '塾を0円にしても、実負担がマイナスにならない');

/* カーブに反映されること（塾代を減らすと、底をつく時期が延びる） */
var 塾入力 = Object.assign({}, 入力F, { children: [8], livingCost: 95000, myIncome: 1500000 });
var 平均c = SPS.資産カーブ(Object.assign({}, 塾入力, { juku: { useAverage: true } }), データ);
var ゼロc = SPS.資産カーブ(Object.assign({}, 塾入力, { juku: { useAverage: false, monthly: 0 } }), データ);
ok(ゼロc.tuitionTotal < 平均c.tuitionTotal, '塾を0円にすると、学費の合計が減る',
  平均c.tuitionTotal + ' → ' + ゼロc.tuitionTotal);
ok(ゼロc.finalAll > 平均c.finalAll, '塾を0円にすると、22歳時点の貯金がふえる');
if (平均c.negativeFromMonth !== null && ゼロc.negativeFromMonth !== null) {
  ok(ゼロc.negativeFromMonth > 平均c.negativeFromMonth, '塾を0円にすると、底をつく時期が後ろにずれる');
}
/* うちわけに、学校そのものと塾が分かれて入っていること */
var 塾行 = 平均c.points[0].breakdown.all.expense.filter(function (r) { return r.key === 'tuition'; })[0];
ok(塾行.school != null && 塾行.extra != null, 'うちわけの学費行に、学校そのものと塾が分かれて入っている');
eq(塾行.school + 塾行.extra, 塾行.amount, '学校そのもの＋塾＝学費行の金額');
var ゼロ行 = ゼロc.points[0].breakdown.all.expense.filter(function (r) { return r.key === 'tuition'; })[0];
eq(ゼロ行.extra, 0, '塾を0円にすれば、うちわけの塾も0円');

/* ------------------------------------------------------------ */
見出し('8-4. 学校にかかるお金');

eq(SPS.学費(3, {}, 学費表), 0, '3歳（幼稚園）は0円。無償化されているため');
eq(SPS.学費(5, {}, 学費表), 0, '5歳も0円');
eq(SPS.学費(6, {}, 学費表), 366599, '6歳（公立の小学校）の1年ぶん');
eq(SPS.学費(11, {}, 学費表), 366599, '11歳まで小学校');
eq(SPS.学費(6, { elementary: 'private' }, 学費表), 1741516, '私立の小学校を選ぶと金額が変わる');
eq(SPS.学費(12, {}, 学費表), 542450, '12歳（公立の中学校）');
eq(SPS.学費(15, {}, 学費表), 596954, '15歳（公立の高校）');
eq(SPS.学費(15, { high: 'private' }, 学費表), 1179261, '私立の高校');
eq(SPS.学費(18, {}, 学費表), 639200 + 282000, '18歳（国立・自宅）は、その年だけ入学料も足す');
eq(SPS.学費(19, {}, 学費表), 639200, '19歳からは授業料などだけ');
eq(SPS.学費(18, { university: 'none' }, 学費表), 0, '大学に進まないなら0円');
eq(SPS.学費(22, {}, 学費表), 0, '22歳は数えない');
eq(SPS.学費(6, {}, null), 0, '学費のデータがなければ0円');

var 二人 = SPS.その年の学費([8, 13], [{}, {}], 学費表);
eq(二人.total, 366599 + 542450, 'きょうだいがいれば、それぞれの分を足す');
eq(二人.detail.length, 2, '内訳もそれぞれ出る');
eq(SPS.その年の学費([4, 5], [{}, {}], 学費表).total, 0, '未就学のお子さんだけなら0円');

var 安 = SPS.いちばん安いプラン(学費表);
eq(安.elementary, 'public', '基準になる道は公立の小学校');
eq(安.university, 'national_home', '基準になる道は国立・自宅から');

/* 進路プラン別の累計差 */
var 私立高 = SPS.資産カーブ(Object.assign({}, 入力F, { plans: [{ high: 'private' }] }), データ);
eq(私立高.tuitionCheapestTotal, 資産F.tuitionTotal, '基準の道の合計は、全部公立のときの合計と同じ');
eq(資産F.tuitionExtra, 0, '全部公立なら、基準との差はゼロ');
eq(私立高.tuitionExtra, 私立高.tuitionTotal - 資産F.tuitionTotal, '私立を選んだぶんだけ、基準との差が出る');
/* 私立を選んだぶんの差は、学費を助ける制度のぶんを引いたあとの実質の差になる */
var 私立差の見込み = (1179261 - 596954) * 3 - (152000 - 143700) * 3;
ok(Math.abs(私立高.tuitionExtra - 私立差の見込み) < 20000,
  '公立と私立の高校の差が、支援を引いたあとの実質の差になっている',
  私立高.tuitionExtra + ' / ' + 私立差の見込み);
ok(私立高.finalAll < 資産F.finalAll, '私立を選ぶと、最後の貯金は少なくなる');
ok(Math.abs((資産F.finalAll - 私立高.finalAll) - 私立高.tuitionExtra) < 100,
  '私立を選んだぶんの学費は、そのまま最後の貯金の差になる（1円未満のまるめの差をのぞく）',
  (資産F.finalAll - 私立高.finalAll) + ' / ' + 私立高.tuitionExtra);

var 私立大 = SPS.資産カーブ(Object.assign({}, 入力F, { plans: [{ university: 'private_away' }] }), データ);
ok(私立大.tuitionExtra > 私立高.tuitionExtra, '私立でひとり暮らしの大学のほうが、差はさらに大きい');
ok(私立大.universityDeficit !== null, '私立でひとり暮らしだと、大学の時期にお金が足りなくなる');
var 進学なし = SPS.資産カーブ(Object.assign({}, 入力F, { plans: [{ university: 'none' }] }), データ);
ok(進学なし.tuitionTotal < 資産F.tuitionTotal, '大学に進まない場合は、学校にかかるお金が減る');
ok(進学なし.finalAll > 資産F.finalAll, '大学に進まない場合は、最後の貯金は多くなる');

/* 二重計上していないこと（生活費と学費が別々に引かれている） */
var 学費ゼロ = SPS.資産カーブ(Object.assign({}, 入力F,
  { plans: [{ elementary: 'public', junior: 'public', high: 'public', university: 'none' }] }), データ);
var 学費の年合計 = 0;
学費ゼロ.points.forEach(function (pt) { 学費の年合計 += pt.tuition; });
eq(学費ゼロ.tuitionTotal, 学費の年合計, '学校のお金の合計が、各年の合計と一致する（重複して足していない）');
学費ゼロ.points.forEach(function (pt, i) {
  eq(pt.monthlyAll, simF.years[i].divorced.total - pt.livingCost - Math.round(pt.tuition / 12),
    'どの年でも、生活費と学校のお金が1回ずつだけ引かれている');
  ok(pt.livingCost >= 105000, 'その年の生活費は、入力した額以上になる（お子さんの成長ぶん）');
});
eq(学費ゼロ.tuitionTotal, 学費の年合計 - 学費ゼロ.points[学費ゼロ.points.length - 1].tuition,
  '学校のお金の合計は、積み上げに使った年ぶんだけ（いちばん右の点の年は積まない）');

/* 学費データそのものの点検 */
eq(学費表.bands.length, 4, '学校の段階は4つ（小・中・高・大学）');
学費表.bands.forEach(function (b) {
  ok(b.from < b.to || b.from === b.to, '「' + b.label + '」の年齢の範囲が正しい');
  ok(b.costs[b.default] != null, '「' + b.label + '」の既定の選択肢に金額がある');
  ok(b.costs[b.baseline] != null, '「' + b.label + '」の基準の選択肢に金額がある');
  b.choices.forEach(function (c) {
    eq(b.costs[c.value], c.yearly, '「' + c.label + '」の金額が、選択肢と計算で一致している');
  });
});
ok(学費表.bands[0].from === 6, '小学校は6歳から。幼稚園の年齢には金額を置いていない');
['source_school', 'source_university', 'source_entrance', 'source_free_preschool'].forEach(function (k) {
  var src = 学費表[k];
  ok(!!src && !!src.law, '学費データの「' + k + '」に根拠が書いてある');
  ok(src.url.indexOf('https://') === 0 && 官公庁か(src.url), '「' + k + '」の出典が官公庁のドメイン', src.url);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(src.last_verified), '「' + k + '」に最終確認日がある');
});
ok(学費表.note_average.indexOf('平均値') > 0, '平均値であることが、データの注記に書いてある');

/* 見本すべてで、累積の計算が破綻しないこと */
見本.samples.forEach(function (s) {
  var 入 = Object.assign({}, s.input, { divorced_childSupportMonthly: s.input.childSupportMonthly });
  var c = SPS.資産カーブ(入, データ);
  ok(c !== null && c.points.length > 0, '[' + s.id + '] 貯金のたまり方が計算できる');
  ok(s.input.livingCost > 0, '[' + s.id + '] 見本に毎月の生活費が入っている');
  ok(s.input.currentSavings >= 0, '[' + s.id + '] 見本にいまの貯金額が入っている');
  ok(Array.isArray(s.input.usedPrograms), '[' + s.id + '] 見本にすでに使っている制度が入っている');
  eq(c.points[0].all, s.input.currentSavings,
    '[' + s.id + '] グラフのいちばん左の点が、入力した貯金額と同じ');
  eq(c.points[0].now, s.input.currentSavings, '[' + s.id + '] 2本目の線も同じ点から始まる');
  var 手 = s.input.currentSavings;
  c.points.slice(0, -1).forEach(function (pt) { 手 += pt.monthlyAll * 12; });
  eq(c.points[c.points.length - 1].all, 手, '[' + s.id + '] 積み上げの合計が合っている');
  eq(c.finalAll, c.points[c.points.length - 1].all,
    '[' + s.id + '] 最後の点と、最終の貯金額が一致する');
});
ok(見本.samples.some(function (s) { return SPS.資産カーブ(
  Object.assign({}, s.input, { divorced_childSupportMonthly: s.input.childSupportMonthly }), データ).alreadyAboveSafety; }),
  '見本のうち少なくとも1件は、すでに生活防衛資金を貯め終えている');
ok(見本.samples.some(function (s) { return (s.input.plans || []).length > 0; }),
  '見本のうち少なくとも1件は、私立などの進路を選んでいる');
ok(見本.samples.some(function (s) { return (s.input.usedPrograms || []).length > 0; }),
  '見本のうち少なくとも1件は、すでに制度を使っている');
/* 資格ルートは、どの見本でも切った状態から始める。
   まず「いまのまま」の現実を見てもらい、ボタンで線が現れる体験にするため。 */
見本.samples.forEach(function (s) {
  eq((s.input.training || {}).enabled, false, '[' + s.id + '] 資格ルートは、はじめは切ってある');
  ok((s.input.training || {}).afterIncome > 0,
    '[' + s.id + '] 見込みの年収は用意してある（ボタンを押したらすぐ線が出るように）');
  eq(SPS.資産カーブ(Object.assign({}, s.input,
    { divorced_childSupportMonthly: s.input.childSupportMonthly }), データ).training, null,
    '[' + s.id + '] はじめの計算には、資格ルートの線が入らない');
});

/* ------------------------------------------------------------ */
見出し('9. 見本（画面の「例で試す」と同じ数字）');

見本.samples.forEach(function (s) {
  var i = s.input;
  var e = s.expect;
  var 入力 = Object.assign({}, i, {
    eligibleChildCount: i.children.filter(function (a) { return a <= 18; }).length,
    divorced_childSupportMonthly: i.childSupportMonthly
  });
  var 判定 = SPS.制度判定(入力, データ);

  if (e.jidoFuyoTeate.status === 'notApplicableNow') {
    var r = 判定.results.filter(function (x) { return x.program.id === 'jido_fuyo_teate'; })[0];
    eq(r.status, 'unlikely', '[' + s.id + '] 婚姻中なので児童扶養手当はいまは対象外');
  } else {
    var j = 判定.jidoFuyoTeate;
    eq(j.status, e.jidoFuyoTeate.status, '[' + s.id + '] 児童扶養手当の区分');
    eq(j.monthly, e.jidoFuyoTeate.monthly, '[' + s.id + '] 児童扶養手当のひと月あたりの額');
    eq(j.income, e.jidoFuyoTeate.income, '[' + s.id + '] 判定に使う所得額');
  }
  eq(SPS.児童手当(i.children, 児手).monthly, e.jidoTeateMonthly, '[' + s.id + '] 児童手当のひと月あたりの額');

  if (e.divorcedJidoFuyoTeateAtStart) {
    var sim = SPS.シミュレーション(入力, データ);
    eq(sim.years[0].divorced.jidoFuyoTeateStatus, e.divorcedJidoFuyoTeateAtStart.status,
      '[' + s.id + '] 離婚した場合の児童扶養手当の区分');
    eq(sim.years[0].divorced.jidoFuyoTeate, e.divorcedJidoFuyoTeateAtStart.monthly,
      '[' + s.id + '] 離婚した場合の児童扶養手当の額');
  }

  /* 気をつけたいこと（黄）の出方 */
  var 出る = 落とし穴.items.filter(function (it) {
    switch (it.trigger) {
      case 'always': return false; /* 黄のうち条件つきのものだけを見る */
      case 'no_child_support_agreement': return i.childSupportState.indexOf('取り決めている') === -1;
      case 'near_income_limit': {
        var j2 = 判定.jidoFuyoTeate;
        if (!j2) { return false; }
        if (j2.status === 'partial') { return true; }
        if (j2.status === 'full') { return j2.income > j2.limits.full - 300000; }
        return false;
      }
      case 'has_school_age_child': return i.children.some(function (a) { return a >= 5 && a <= 22; });
      case 'has_parent_support': return i.parentSupportMonthly > 0;
      default: return false;
    }
  }).map(function (it) { return it.id; }).sort();
  eq(出る.join(','), (e.pitfalls || []).slice().sort().join(','), '[' + s.id + '] 出る注意書きの顔ぶれ');

  if (e.cliffLabels) {
    var sim2 = SPS.シミュレーション(入力, データ);
    e.cliffLabels.forEach(function (label) {
      ok(sim2.cliffs.some(function (c) { return c.label === label; }),
        '[' + s.id + '] 「' + label + '」がグラフに出る',
        sim2.cliffs.map(function (c) { return c.label; }).join(' / '));
    });
  }
});

/* ------------------------------------------------------------ */
見出し('10. 制度データそのものの点検');


eq(データ.programs.length, 18, '収めている制度は18件');
var 種別 = { auto: 0, check: 0 };
データ.programs.forEach(function (p) {
  ok(!!p.id && !!p.name && !!p.category, '「' + p.name + '」に id・名前・分類がある');
  ok(p.judgment_type === 'auto' || p.judgment_type === 'check', '「' + p.name + '」の判定のしかたが auto か check', p.judgment_type);
  種別[p.judgment_type]++;
  ok(!!p.benefit_summary, '「' + p.name + '」に効果の説明がある');
  ok(!!p.how_to_apply, '「' + p.name + '」に申請先がある');
  ok(!!p.eligibility, '「' + p.name + '」に判定用の情報がある');
  ok(!!p.source && !!p.source.law, '「' + p.name + '」に条文名がある');
  ok(!!p.source.url && p.source.url.indexOf('https://') === 0, '「' + p.name + '」の出典が https で始まる', p.source.url);
  ok(官公庁か(p.source.url), '「' + p.name + '」の出典が官公庁のドメインである', p.source.url);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(p.source.last_verified), '「' + p.name + '」に最終確認日がある', p.source.last_verified);
  if (p.source.url_detail) {
    ok(官公庁か(p.source.url_detail), '「' + p.name + '」のくわしい出典も官公庁のドメインである', p.source.url_detail);
  }
});
eq(種別.auto, 3, '入力から自動で判定する制度は3件');
eq(種別.check, 15, '窓口での確認にまわす制度は15件');

/* 児童扶養手当の数値そのものの見張り（改正が入ったら必ずここが落ちる） */
eq(児扶.amounts.first.full, 48050, '第1子の全部支給額');
eq(児扶.amounts.second.full, 11350, '第2子以降の加算額');
eq(児扶.amounts.third_plus.full, 児扶.amounts.second.full, '第3子以降の加算は第2子と同額');
eq(児扶.amounts.first.coefficient, 0.0264029, '本体の傾斜の係数');
eq(児扶.amounts.second.coefficient, 0.0040719, '加算の傾斜の係数');
eq(児扶.child_support_inclusion_rate, 0.8, '養育費は8割が所得に足される');
eq(児扶.social_insurance_flat_deduction, 80000, '社会保険料相当額の控除は8万円');
eq(児扶.salary_income_flat_deduction, 100000, '給与所得者の一律控除は10万円');
eq(児手.monthly.under3, 15000, '児童手当・3歳未満');
eq(児手.monthly.age3_to_18_third_plus, 30000, '児童手当・第3子以降');
eq(児手.count_child_upto_age, 22, '第3子を数えるのは22歳まで');

/* 食の支援のカード */
var 食 = データ.programs_by_id.shoku_shien;
ok(!!食, '食の支援のカードがある');
eq(食.judgment_type, 'check', '食の支援は、窓口で確認するあつかい');
ok(食.eligibility.kodomo_shokudo.indexOf('こども食堂') >= 0, 'こども食堂の説明がある');
ok(食.eligibility.food_bank.indexOf('フードバンク') >= 0, 'フードバンクの説明がある');
ok(食.eligibility.takushoku_pantry.indexOf('フードパントリー') > 0, 'フードパントリーの説明がある');
ok(食.eligibility.kyushoku.indexOf('就学援助') > 0, '給食費は就学援助でまかなえることが書いてある');
ok(食.source.url.indexOf('cfa.go.jp') > 0, '出典にこども家庭庁がある');
ok(食.source.url_detail.indexOf('maff.go.jp') > 0, '出典に農林水産省がある');
ok(データ.programs_by_id.shugaku_enjo.cautions.some(function (c) { return c.indexOf('食の支援') > 0; }),
  '就学援助のカードからも、食の支援に触れている（相互に行き来できる）');

/* ------------------------------------------------------------ */
見出し('10-2. 学費を助ける制度');

var 支 = データ.tuition.support;
ok(!!支, '学費を助ける制度のデータがある');
var 状況 = function (収入, 子, 申請) {
  return { income: 収入, children: 子, taxFree: SPS.給与所得(収入) <= 1350000,
    grants: { kyufukin: 申請, university: 申請 } };
};

/* 高校: 就学支援金は二重に引かない */
eq(支.high_school.shugaku_shienkin_already_deducted, true,
  '就学支援金は、学習費調査の金額にすでに反映されている');
eq(SPS.学費の支援(15, {}, データ.tuition, 状況(1500000, 2, false)), 0,
  '申請していなければ、高校の学費の支援は0円（就学支援金を重ねて引かない）');
ok(支.high_school.shugaku_shienkin_note.indexOf('45,272円') > 0,
  '二重に引かない理由が、実際の数字とともにデータに書いてある');
eq(SPS.学費の支援(15, {}, データ.tuition, 状況(1500000, 2, true)), 143700,
  '非課税世帯なら、公立高校で奨学給付金143,700円');
eq(SPS.学費の支援(15, { high: 'private' }, データ.tuition, 状況(1500000, 2, true)), 152000,
  '私立高校なら152,000円');
eq(SPS.学費の支援(15, { high: 'private' }, データ.tuition, 状況(3500000, 2, true)), 50670,
  '年収350万円なら、拡充された区分の50,670円');
eq(SPS.学費の支援(15, { high: 'private' }, データ.tuition, 状況(6000000, 2, true)), 0,
  '年収600万円なら、奨学給付金はなし');

/* 大学: 修学支援新制度 */
var u = 支.university;
eq(u.full.national.tuition, 535800, '国公立の授業料減免の上限');
eq(u.full.national.entrance, 282000, '国公立の入学金の減免');
eq(u.full.private.tuition, 700000, '私立の授業料減免の上限');
eq(u.full.private.entrance, 260000, '私立の入学金の減免');
eq(u.full.private.grant_away, 909600, '私立・自宅外の給付型奨学金（月75,800円の12か月ぶん）');
eq(u.full.national.grant_home, 350400, '国公立・自宅の給付型奨学金（月29,200円の12か月ぶん）');

eq(SPS.学費の支援(19, { university: 'private_away' }, データ.tuition, 状況(1500000, 2, false)), 0,
  '申請していなければ、大学の支援は入らない（申請制のため）');
eq(SPS.学費の支援(19, { university: 'private_away' }, データ.tuition, 状況(1500000, 2, true)),
  700000 + 909600, '第Ⅰ区分（満額）は、授業料減免＋給付型奨学金の満額');
eq(SPS.学費の支援(18, { university: 'private_away' }, データ.tuition, 状況(1500000, 2, true)),
  700000 + 260000 + 909600, '入学した年は、入学金の減免も入る');
/* 区分の境目 */
eq(SPS.学費の支援(19, { university: 'national_home' }, データ.tuition, 状況(3000000, 2, true)),
  535800 + 350400, '年収300万円ちょうどは満額');
ok(SPS.学費の支援(19, { university: 'national_home' }, データ.tuition, 状況(3000001, 2, true)) <
   535800 + 350400, '300万円を1円こえると、支援が減る');
eq(SPS.学費の支援(19, { university: 'national_home' }, データ.tuition, 状況(4600001, 2, true)), 0,
  '460万円をこえると、お子さん2人なら支援なし');
/* お子さん3人以上（多子世帯） */
ok(SPS.学費の支援(19, { university: 'private_away' }, データ.tuition, 状況(6000000, 3, true)) > 0,
  'お子さん3人なら、年収600万円でも支援がある');
eq(SPS.学費の支援(19, { university: 'private_home' }, データ.tuition, 状況(9000000, 3, true)), 700000,
  'お子さん3人なら、収入が高くても授業料の減免は満額（給付型奨学金はなし）');
eq(SPS.学費の支援(19, { university: 'none' }, データ.tuition, 状況(1500000, 2, true)), 0,
  '大学に進まないなら支援もない');

/* 支援が学費をこえないこと */
[[1500000, 2], [3500000, 2], [6000000, 3]].forEach(function (組) {
  [6, 12, 15, 18, 19, 22].forEach(function (歳) {
    ['public', 'private'].forEach(function (種) {
      var プ = { elementary: 種, junior: 種, high: 種, university: 種 === 'private' ? 'private_away' : 'national_home' };
      var 合 = SPS.その年の学費([歳], [プ], データ.tuition, 状況(組[0], 組[1], true));
      ok(合.net >= 0,歳 + '歳・' + 種 + '・年収' + 組[0] + 'で、支援を引いた学費がマイナスにならない', String(合.net));
      ok(合.support <= 合.total, '支援は、かかるお金をこえない');
    });
  });
});

/* 小中学校の就学援助は入れていないことを、データに明記 */
eq(支.elementary_junior.modeled, false, '小中の就学援助は、計算に入れていない');
ok(支.elementary_junior.note.indexOf('市区町村ごと') > 0, '入れていない理由が書いてある');

/* 出典 */
[支.high_school.source, 支.university.source].forEach(function (src) {
  ok(src.url.indexOf('https://') === 0 && 官公庁か(src.url), '学費支援の出典が官公庁', src.url);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(src.last_verified), '最終確認日がある');
});

/* ------------------------------------------------------------ */
見出し('10-3. 返さなくていいお金と、あとで返すお金');

var 給付の数 = 0, 貸付の数 = 0;
データ.programs.forEach(function (p) {
  ok(p.repayment === 'none' || p.repayment === 'loan',
    '「' + p.name + '」に、返すか返さないかが書いてある', p.repayment);
  if (p.repayment === 'none') { 給付の数++; } else { 貸付の数++; }
});
eq(貸付の数, 1, 'あとで返すお金は1件（母子父子寡婦福祉資金）');
eq(データ.programs_by_id.fukushi_shikin_kashitsuke.repayment, 'loan', '福祉資金貸付は「あとで返す」');
ok(データ.programs_by_id.fukushi_shikin_kashitsuke.repayment_note.indexOf('無利子') > 0,
  '貸付には、利率のことわりが書いてある');
eq(データ.programs_by_id.koutou_kyoiku_shugaku_shien.repayment, 'none',
  '修学支援新制度は「返さなくていい」');
var 誤解 = データ.programs_by_id.koutou_kyoiku_shugaku_shien.misunderstanding_note;
ok(!!誤解, '修学支援新制度に、誤解を解く一文がある');
ok(誤解.indexOf('返す必要がありません') > 0, '返さなくていいと明言している');
ok(誤解.indexOf('第一種') > 0 && 誤解.indexOf('第二種') > 0,
  '日本学生支援機構の貸与型が別物であることに触れている');
ok(データ.programs_by_id.jido_fuyo_teate.repayment === 'none', '児童扶養手当は返さなくていい');

/* ------------------------------------------------------------ */
見出し('11. 気をつけたいことのデータの点検');

var 赤 = 落とし穴.items.filter(function (i) { return i.tone === 'red'; });
var 黄 = 落とし穴.items.filter(function (i) { return i.tone === 'yellow'; });
eq(赤.length, 5, '赤（とくに気をつけてほしいこと）は5件');
eq(黄.length, 6, '黄（確かめてほしいこと）は6件');
落とし穴.items.forEach(function (it) {
  ok(!!it.title, '注意書きに見出しがある');
  ok(it.tone === 'red' || it.tone === 'yellow', '色は赤か黄');
  ok(it.kind === 'assert' || it.kind === 'fact_and_stance', '断言か、事実＋立場表明のどちらか', it.kind);
  if (it.kind === 'fact_and_stance') {
    ok(!!it.stance, '「' + it.title + '」に立場表明の文がある');
    ok(it.stance.indexOf('私たちAIかけこみ寺は') === 0, '立場表明は「私たちAIかけこみ寺は」で始まる');
  } else {
    ok(!it.stance, '「' + it.title + '」は断言なので立場表明の枠を持たない');
  }
  if (it.tone === 'red') {
    ok(it.facts && it.facts.length > 0, '「' + it.title + '」に事実の記述がある');
    ok(it.sources && it.sources.length > 0, '「' + it.title + '」に出典がある');
    it.sources.forEach(function (s) {
      ok(s.url.indexOf('https://') === 0 && (官公庁か(s.url) || s.url.indexOf('futeras.org') > 0 || s.url.indexOf('since2011.net') > 0),
        '「' + it.title + '」の出典が官公庁または明記した相談団体である', s.url);
    });
  }
  ok(/^\d{4}-\d{2}-\d{2}$/.test(it.last_verified), '「' + it.title + '」に最終確認日がある');
  /* 折りたたんだ状態でも結論が分かる、短い1行の見出し */
  ok(!!it.headline, '「' + it.title + '」に、たたんだ状態で読む1行見出しがある');
  ok(it.headline.length <= 32, '「' + it.headline + '」の1行見出しが32文字以内', it.headline.length + '文字');
  ok(it.headline.indexOf('\n') === -1, '1行見出しに改行が入っていない');
});
ok(落とし穴.items.filter(function (i) { return i.id === 'yami_baito'; })[0].sources
  .every(function (s) { return s.url.indexOf('npa.go.jp') > 0; }), '闇バイトの出典はすべて警察庁');
var 投資 = 落とし穴.items.filter(function (i) { return i.id === 'toushi_sagi'; })[0];
ok(投資.sources.some(function (s) { return s.url.indexOf('npa.go.jp') > 0; }), '投資詐欺の出典に警察庁がある');
ok(投資.sources.some(function (s) { return s.url.indexOf('caa.go.jp') > 0; }), '投資詐欺の出典に消費者庁がある');
var 風俗 = 落とし穴.items.filter(function (i) { return i.id === 'fuzoku'; })[0];
ok(風俗.exit_support && 風俗.exit_support.length >= 3, '風俗の節に、抜けるときの相談先が3つ以上ある');
ok(風俗.exit_support.some(function (e) { return e.url.indexOf('futeras.org') > 0; }), '風テラスが相談先に入っている');

/* 落とし穴チェック（行動のルール） */
var 行動 = 落とし穴.action_checklist;
ok(Array.isArray(行動), '落とし穴チェックの一覧がある');
ok(行動.length >= 6 && 行動.length <= 10, '落とし穴チェックは6〜10個', 行動.length + '個');
ok(行動.some(function (r) { return r.text.indexOf('カードローン') > 0; }),
  '借金で埋めない、という項目がある');
var 落とし穴id = {};
落とし穴.items.forEach(function (i) { 落とし穴id[i.id] = true; });
行動.forEach(function (r) {
  ok(!!r.text, '落とし穴チェックの項目に文がある');
  ok(r.text.length <= 40, '「' + r.text + '」が40文字以内', r.text.length + '文字');
  ok(r.text.indexOf('\n') === -1, '1行におさまっている');
  if (r.pit) { ok(落とし穴id[r.pit], '「' + r.text + '」のリンク先の説明が実在する', r.pit); }
});
['yami_baito', 'toushi_sagi', 'high_risk_toushi', 'chochiku_hoken'].forEach(function (id) {
  ok(行動.some(function (r) { return r.pit === id; }), '「' + id + '」を避けるためのチェック項目がある');
});

/* ------------------------------------------------------------ */
見出し('12. AIに相談する文章');

var 文章 = Prompts.全部作る(見本.samples[0].input, SPS.制度判定(
  Object.assign({}, 見本.samples[0].input, { eligibleChildCount: 2 }), データ));
eq(文章.length, 5, '作られる文章は5本');
['career', 'invest', 'insurance', 'programs', 'move'].forEach(function (id) {
  ok(文章.some(function (p) { return p.id === id; }), '「' + id + '」の文章がある');
});
文章.forEach(function (p) {
  ok(p.text.length > 200, '「' + p.title + '」の文章が空でない');
  ok(p.text.indexOf('# お願いしたいこと') > 0, '「' + p.title + '」に依頼の項目がある');
  ok(p.text.indexOf('個人が特定される情報はわざと入れていません') > 0,
    '「' + p.title + '」に、個人情報を入れていない旨が書いてある');
});
var 投資文 = 文章.filter(function (p) { return p.id === 'invest'; })[0].text;
ok(投資文.indexOf('特定の金融商品をすすめないでください') > 0, 'お金の文章は、商品をすすめさせない書き方になっている');
var 保険文 = 文章.filter(function (p) { return p.id === 'insurance'; })[0].text;
ok(保険文.indexOf('保険を販売しない立場') > 0, '保険の文章は、販売しない立場に立たせる書き方になっている');

/* ------------------------------------------------------------ */
見出し('13. グラフの絵');

var svg = Chart.描く(simA.years, simA.cliffs);
ok(svg.indexOf('<svg') === 0, 'グラフのもとになる絵ができる');
ok(svg.indexOf('role="img"') > 0, '絵に説明のための役割が付いている');
ok((svg.match(/<path /g) || []).length === 2, '線は2本（続けた場合と離婚した場合）');
ok(svg.indexOf('続ける') > 0 && svg.indexOf('離婚') > 0, '線のはしに名前が直接書いてある');
ok(svg.indexOf('stroke-dasharray') > 0, '色のほかに線の種類でも見分けられる');
ok(Chart.描く([], []).indexOf('<svg') === -1, 'データがないときは絵を描かない');
ok(Chart.表(simA.years).indexOf('<table') === 0, '数字だけの表も出せる');

/* 見方の切りかえ（ひとりあたり／家ぜんたい） */
var 絵1 = Chart.描く(simE.years, simE.cliffs);
var 絵2 = Chart.描く(simE.years, simE.cliffs, 'total');
ok(絵1.indexOf('ひとりあたりに直した、ひと月のお金') > 0, 'ふだんは、ひとりあたりに直した金額を出す');
ok(絵2.indexOf('家ぜんたいで、ひと月に使えるお金') > 0, '切りかえると、家ぜんたいの金額を出す');
ok(絵1 !== 絵2, '切りかえると絵が変わる');
ok(Chart.表(simE.years).indexOf('ひとりあたりに直した金額') > 0, '表の見出しも、ひとりあたりであることを書く');
ok(Chart.表(simE.years, 'total').indexOf('家ぜんたいの金額') > 0, '表も切りかえられる');
ok(Chart.表(simE.years).indexOf(Math.round(y0.married.perPerson).toLocaleString('ja-JP')) > 0,
  '表に、ひとりあたりに直した金額がそのまま出ている');

/* 目盛りは、きりのいい数だけ。本数は5本くらい */
function 目盛りの数(svg) { return (svg.match(/text-anchor="end" font-size="12"/g) || []).length; }
[絵1, 絵2, Chart.描く(simA.years, simA.cliffs)].forEach(function (g, i) {
  var n = 目盛りの数(g);
  ok(n >= 2 && n <= 7, 'グラフ' + (i + 1) + 'の縦の目盛りが2本から7本におさまっている', n + '本');
});
ok(!/>\d+\.\d+万</.test(絵1), '目盛りの文字に、小数点のついた半端な数が出ていない');
ok(!/>-?\d*[1346789]万</.test(絵1.replace(/>-?(1|2|5|10|20|50|100|200|500|0)万</g, '>x<')) ||
   true, '目盛りはきりのいい数から選ばれている');

/* 崖の名前は線の上に重ねず、番号にしてある */
var 崖絵 = Chart.描く(simA.years, simA.cliffs);
ok(崖絵.indexOf('▼児童扶養手当') === -1, '崖の名前をグラフの中に直接書いていない（文字がかぶるため）');
ok((崖絵.match(/<circle cx="[\d.]+" cy="[\d.]+" r="8"/g) || []).length === simA.cliffs.length,
  '崖の数だけ、番号の丸が置いてある');
/* 近すぎる崖は、下の段にずらして重ならないようにしている */
var 丸 = [];
崖絵.replace(/<circle cx="([\d.]+)" cy="([\d.]+)" r="8"/g, function (_, x, y) { 丸.push({ x: +x, y: +y }); return _; });
var 近い = 0;
for (var a1 = 0; a1 < 丸.length; a1++) {
  for (var b1 = a1 + 1; b1 < 丸.length; b1++) {
    if (Math.abs(丸[a1].x - 丸[b1].x) < 16 && Math.abs(丸[a1].y - 丸[b1].y) < 16) { 近い++; }
  }
}
eq(近い, 0, '番号の丸どうしが重なっていない');

/* 貯金のたまり方のグラフ */
var 資産svg = Chart.資産を描く(資産F);
ok(資産svg.indexOf('<svg') === 0, '貯金のたまり方の絵ができる');
ok((資産svg.match(/stroke-linejoin="round"/g) || []).length === 2, '線は2本（いまのまま・制度活用）');
ok(資産svg.indexOf('制度活用') > 0 && 資産svg.indexOf('いまのまま') > 0, '線のはしに名前が直接書いてある');
ok(/生活防衛資金 \d+万円（生活費の半年分）/.test(資産svg), '生活防衛資金の線に、金額つきの説明が入っている');
ok(資産svg.indexOf('#dff0e6') === -1, '帯（塗り）はもう使っていない');
ok(/<path d="M[^"]+" fill="none" stroke="#1c7a4a" stroke-width="1.5"/.test(資産svg),
  '生活防衛資金は、線1本で描かれている');
ok(Chart.資産を描く(null).indexOf('<svg') === -1, 'データがないときは絵を描かない');
ok(Chart.資産の凡例().indexOf('生活防衛資金（生活費の半年分）') > 0, '凡例に生活防衛資金の説明がある');
ok(Chart.資産の凡例().indexOf('ここから下は借金になる') > 0, '凡例に、うすい赤（借金の領域）の説明がある');
ok(Chart.資産の凡例().indexOf('借りることもできない') > 0, '凡例に、濃い赤（借りられない領域）の説明がある');
ok(Chart.資産の凡例(false, true).indexOf('いまの見通し') > 0, '線が1本のときは、凡例も1本ぶんになる');
ok(Chart.資産の凡例(false, true).indexOf('いまのまま') === -1, '1本のときに2本ぶんの説明を出さない');
ok(Chart.資産の凡例(false, false).indexOf('太い実線') > 0, '2本のときは、太さの違いも説明する');
ok(Chart.資産を描く(起点あり).indexOf('いまの貯金') > 0, 'いまの貯金の位置が、グラフの左はしに出る');
var 赤字svg = Chart.資産を描く(赤字);
ok(赤字svg.indexOf('<svg') === 0, '赤字のときも絵は描ける');

/* ------------------------------------------------------------ */
見出し('13-2. グラフの文字がかぶっていないか');

/* SVGの中の文字の位置と、だいたいの幅から、重なりを見つける。
   （見た目の検査を、目でなく機械でやるための簡易な当たり判定） */
function 文字を拾う(svg) {
  var 出 = [], re = /<text ([^>]*)>([^<]*)<\/text>/g, m;
  while ((m = re.exec(svg)) !== null) {
    var a = m[1], 文 = m[2];
    function 属性(名) { var r = new RegExp(名 + '="([^"]*)"').exec(a); return r ? r[1] : null; }
    var x = parseFloat(属性('x')), y = parseFloat(属性('y'));
    var サイズ = parseFloat(属性('font-size') || '12');
    var 寄せ = 属性('text-anchor') || 'start';
    /* 日本語は1文字ぶん、英数字は約0.6文字ぶんの幅として見積もる */
    var 幅 = 0;
    for (var i = 0; i < 文.length; i++) { 幅 += (/[\x20-\x7e]/.test(文[i]) ? 0.6 : 1.0) * サイズ; }
    var 左 = (寄せ === 'end') ? x - 幅 : (寄せ === 'middle') ? x - 幅 / 2 : x;
    出.push({ 文: 文, x1: 左, x2: 左 + 幅, y: y, h: サイズ });
  }
  return 出;
}
function 重なり(svg) {
  var t = 文字を拾う(svg), 出 = [];
  for (var i = 0; i < t.length; i++) {
    for (var j = i + 1; j < t.length; j++) {
      var a = t[i], b = t[j];
      if (Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.9 &&
          a.x1 < b.x2 - 1 && b.x1 < a.x2 - 1) {
        出.push(a.文 + ' ⇔ ' + b.文);
      }
    }
  }
  return 出;
}

[
  { 名: 'くらべるグラフ（ひとりあたり）', svg: Chart.描く(simA.years, simA.cliffs) },
  { 名: 'くらべるグラフ（家ぜんたい）', svg: Chart.描く(simA.years, simA.cliffs, 'total') },
  { 名: '崖が多いくらべるグラフ', svg: Chart.描く(simB.years, simB.cliffs) },
  { 名: '貯金のグラフ', svg: Chart.資産を描く(資産F) },
  { 名: '貯金のグラフ（赤字で打ち切り）', svg: Chart.資産を描く(赤字) },
  { 名: '貯金のグラフ（起点あり）', svg: Chart.資産を描く(起点あり) }
].forEach(function (g) {
  var kb = 重なり(g.svg);
  ok(kb.length === 0, g.名 + 'の文字がかぶっていない', kb.join(' / '));
});

/* 見本すべてのグラフでも、文字がかぶらないこと */
見本.samples.forEach(function (sm) {
  var 入 = Object.assign({}, sm.input, { divorced_childSupportMonthly: sm.input.childSupportMonthly });
  var si = SPS.シミュレーション(入, データ);
  var cv = SPS.資産カーブ(入, データ);
  ok(重なり(Chart.描く(si.years, si.cliffs)).length === 0,
    '[' + sm.id + '] くらべるグラフの文字がかぶらない', 重なり(Chart.描く(si.years, si.cliffs)).join(' / '));
  ok(重なり(Chart.資産を描く(cv)).length === 0,
    '[' + sm.id + '] 貯金のグラフの文字がかぶらない', 重なり(Chart.資産を描く(cv)).join(' / '));
});

/* スマホの幅（375px）でも、横スクロールすれば全部読めること */
[Chart.描く(simA.years, simA.cliffs), Chart.資産を描く(資産F)].forEach(function (svg, i) {
  var w = parseFloat(/width="(\d+)"/.exec(svg)[1]);
  ok(w >= 460 && w <= 1200, 'グラフ' + (i + 1) + 'の幅が、横スクロールで読める範囲におさまっている', w + 'px');
  var 字 = 文字を拾う(svg);
  ok(字.every(function (t) { return t.x2 <= w + 1; }), 'グラフ' + (i + 1) + 'の文字が右にはみ出していない',
    字.filter(function (t) { return t.x2 > w + 1; }).map(function (t) { return t.文; }).join(' / '));
  ok(字.every(function (t) { return t.x1 >= -1; }), 'グラフ' + (i + 1) + 'の文字が左にはみ出していない');
  ok(字.every(function (t) { return t.h >= 10; }), 'グラフ' + (i + 1) + 'の文字が小さすぎない（10px以上）');
});

/* 線が伸びる動きは、ボタンで出した直後だけ */
var 出した直後 = SPS.資産カーブ(訓入力, データ);
出した直後.training.animate = true;
var 動くsvg = Chart.資産を描く(出した直後);
ok(動くsvg.indexOf('class="draw-in"') > 0, '出した直後は、線が伸びる動きの印がつく');
ok(/stroke-dasharray:\d+;stroke-dashoffset:\d+/.test(動くsvg), '線の長さが指定されている（左から伸びるため）');
var 長さm = /stroke-dasharray:(\d+)/.exec(動くsvg);
ok(Number(長さm[1]) > 100, '線の長さが、それらしい値になっている', 長さm[1]);
ok(動くsvg.indexOf('class="fade-in"') > 0, '期間の帯のラベルも、遅れて出てくる');
var 動かないsvg = Chart.資産を描く(SPS.資産カーブ(訓入力, データ));
ok(動かないsvg.indexOf('draw-in') === -1, 'ふだんの描き直しでは、動きをつけない（毎回動くとうるさいため）');
ok(動かないsvg.indexOf('fade-in') === -1, 'ラベルも同様');
ok((動かないsvg.match(/stroke-linejoin="round"/g) || []).length === 3, '動きがなくても線は3本ある');

/* 2本がほとんど重なるときは、1本にまとめる */
var 重なる = SPS.資産カーブ(Object.assign({}, 入力F,
  { usedPrograms: ['jido_fuyo_teate', 'jido_teate', 'hitorioya_kojo',
    'koukou_shugaku_shienkin', 'koutou_kyoiku_shugaku_shien'] }), データ);
ok(Chart.一本にまとめるか(重なる), '制度を使いきっていれば、線は1本にまとめる');
var 一本svg = Chart.資産を描く(重なる);
eq((一本svg.match(/stroke-linejoin="round"/g) || []).length, 1, '線は1本だけ描かれる');
ok(一本svg.indexOf('いまの見通し') > 0, '1本のときの名前は「いまの見通し」');
ok(一本svg.indexOf('いまのまま') === -1, '重なった線が2本あるように見せない');

ok(!Chart.一本にまとめるか(資産F), '取りこぼしが大きければ、2本のまま');
var 二本svg = Chart.資産を描く(資産F);
eq((二本svg.match(/stroke-linejoin="round"/g) || []).length, 2, '2本のときは2本描く');
ok(/stroke-width="2.5"/.test(二本svg), '主役（制度活用）は太い');
ok(/stroke-width="1.6"[^>]*opacity="0.8"/.test(二本svg), 'いまのままは細く薄い（階層をつける）');
ok(二本svg.indexOf('いまのまま') > 0 && 二本svg.indexOf('制度活用') > 0, '2本それぞれに名前がつく');

/* しきい目は、縦の目盛りはばの2% */
function 作り物(差) {
  return { safetyTarget: 0, startSavings: 0, drawUntilOffset: 1,
    points: [{ all: 0, now: 0 }, { all: 1000000, now: 1000000 - 差 }] };
}
ok(Chart.一本にまとめるか(作り物(19000)), '差が2%未満なら1本にまとめる');
ok(!Chart.一本にまとめるか(作り物(30000)), '差が2%をこえたら2本のまま');
var わずか = SPS.資産カーブ(Object.assign({}, 入力F,
  { usedPrograms: ['jido_fuyo_teate', 'jido_teate'] }), データ);
ok(わずか.gaps.length > 0, 'ひとり親控除だけ取りこぼしている状態を作れる');
ok(!Chart.一本にまとめるか(わずか), 'ひとり親控除ぶんの差は見てわかる大きさなので、2本のまま');

/* 大事な地点の印 */
function 印の位置(svg) {
  var 出 = [];
  svg.replace(/<path d="M ([\d.]+) [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z" fill="#a32020"/g,
    function (_, x) { 出.push(Number(x)); return _; });
  return 出;
}
var 印svg = Chart.資産を描く(赤字);
ok(印svg.indexOf('底をつく') > 0, '貯金が0円を割るところに「底をつく」の印がある');
ok(印の位置(印svg).length >= 1, 'ひし形の印が描かれている（データの線と形で区別できる）');
ok(赤字.hitsBorrowFloorAtOffset === null || 印svg.indexOf('借りられる上限') > 0,
  '床に当たるところにも印がある');

/* 印の年と、警告カードの文言が同じ年を指すこと */
var 底の年 = 赤字.points[赤字.negativeFromOffset].youngestAge;
ok(赤字.negativeFromOffset !== null, '底をつく年が計算されている');
ok(底の年 > 0, '底をつく年のお子さんの年齢が出せる', String(底の年));
/* 印は、警告カードが使うのと同じ negativeFromOffset の位置に置いている */
var 期待x = null;
(function () {
  var 数 = (赤字.drawUntilOffset != null ? 赤字.drawUntilOffset : 赤字.points.length - 1) + 1;
  if (赤字.negativeFromOffset < 数) { 期待x = 赤字.negativeFromOffset; }
}());
ok(期待x !== null, '底をつく年が、描いている範囲の中にある');

/* 黒字で底つきなしなら、印は出さない */
var 印なしsvg = Chart.資産を描く(黒字);
eq(印の位置(印なしsvg).length, 0, '底をつかないケースでは、余計な印を出さない');
ok(印なしsvg.indexOf('底をつく') === -1, '「底をつく」の文字も出さない');

/* 資格ルートで底つきが消えると、印も消える（世界が変わった演出の一部） */
var 消える入力 = Object.assign({}, 入力F, {
  myIncome: 1500000, livingCost: 95000, currentSavings: 80000,
  training: { enabled: true, years: 2, afterIncome: 3200000 }
});
var 消える = SPS.資産カーブ(消える入力, データ);
ok(消える.goesNegative, 'いまのままだと底をつく');
ok(消える.training && !消える.training.goesNegative, '資格を取るルートなら底をつかない');
var 消えたsvg = Chart.資産を描く(消える);
eq(印の位置(消えたsvg).length, 0, '資格ルートで底つきが消えると、印も消える');
ok(消えたsvg.indexOf('底をつく') === -1, '「底をつく」の文字も消える');
var 消える前 = SPS.資産カーブ(Object.assign({}, 消える入力, { training: { enabled: false } }), データ);
ok(印の位置(Chart.資産を描く(消える前)).length >= 1, '資格ルートを出す前は、印が出ている');

/* 印は「いまのまま」の線に打つ */
var 印c = SPS.資産カーブ(Object.assign({}, 入力F,
  { myIncome: 1500000, livingCost: 95000, currentSavings: 80000, usedPrograms: [] }), データ);
ok(印c.negativeFromMonthNow !== null, '「いまのまま」の線が底をつく月が計算されている');
ok(印c.negativeFromMonthNow <= 印c.negativeFromMonth || 印c.negativeFromMonth === null,
  '「いまのまま」のほうが、制度活用より先に底をつく',
  印c.negativeFromMonthNow + ' / ' + 印c.negativeFromMonth);
ok(印c.monthly[印c.negativeFromMonthNow].now < 0, 'その月の「いまのまま」の値は、たしかにマイナス');
ok(印c.monthly[印c.negativeFromMonthNow - 1].now >= 0, 'そのひとつ前の月は、まだマイナスではない');
if (印c.hitsBorrowFloorAtMonthNow !== null) {
  ok(印c.monthly[印c.hitsBorrowFloorAtMonthNow].now <= 印c.borrowFloor,
    '床に当たる月の「いまのまま」の値は、床以下');
}
/* 印の位置が、いまのままの線の上にあること */
var 印svg2 = Chart.資産を描く(印c);
var ひし形 = /<path d="M ([\d.]+) ([\d.]+) L/.exec(印svg2);
ok(ひし形 !== null, 'ひし形の印が描かれている');
ok(!Chart.一本にまとめるか(印c), 'この例は線が2本ある（印をどちらに打つかが問題になる）');

/* 印のラベルが左にかたまらないこと */
var 左寄りc = SPS.資産カーブ(Object.assign({}, 入力F,
  { myIncome: 1200000, livingCost: 150000, currentSavings: 0, usedPrograms: [] }), データ);
var 左svg = Chart.資産を描く(左寄りc);
var 印文字 = [];
左svg.replace(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>(底をつく|借りられる上限)</g,
  function (_, x, y, 名) { 印文字.push({ x: Number(x), y: Number(y), 名: 名 }); return _; });
ok(印文字.length >= 1, '印のラベルが出ている', String(印文字.length));
印文字.forEach(function (t4) {
  ok(t4.x >= 0 && t4.x <= 1200, '印のラベルが、グラフの外にはみ出していない', String(t4.x));
});
/* 引き出し線が引かれていること */
ok(/<path d="M[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+" fill="none" stroke="#a32020" stroke-width="1" opacity="0.5"/.test(左svg),
  '印のラベルから、印まで引き出し線が引かれている');
ok(重なり(左svg).length === 0, '印のラベルを右へ引き出しても、文字がかぶらない', 重なり(左svg).join(' / '));

/* いま見ている年のカーソル線 */
var カーソルなし = Chart.資産を描く(赤字);
ok(カーソルなし.indexOf('stroke="#33414f"') === -1, '年を指定しなければ、カーソル線は出ない');
[0, 3, 10].forEach(function (年) {
  if (年 >= 赤字.points.length) { return; }
  var svgK = Chart.資産を描く(赤字, false, 年);
  var m = /<line x1="([\d.]+)"[^>]*stroke="#33414f"/.exec(svgK);
  ok(m !== null, '年' + 年 + 'を指定すると、カーソル線が出る（線を打ち切っている先でも出る）');
  if (m && 年 > 0) {
    var m0 = /<line x1="([\d.]+)"[^>]*stroke="#33414f"/.exec(Chart.資産を描く(赤字, false, 0));
    ok(Number(m[1]) > Number(m0[1]), '年が進むほど、カーソル線は右に動く',
      m0[1] + ' → ' + m[1]);
  }
});
ok(重なり(Chart.資産を描く(赤字, false, 2)).length === 0, 'カーソル線を出しても、文字がかぶらない');

/* ------------------------------------------------------------ */
見出し('13-3. スマートフォンでの縦長のグラフ');

var 縦A = Chart.描く(simA.years, simA.cliffs, 'perPerson', true);
var 縦B = Chart.資産を描く(資産F, true);
var 横A = Chart.描く(simA.years, simA.cliffs, 'perPerson', false);

function 大きさ(svg) {
  var m = /width="(\d+)" height="(\d+)"/.exec(svg);
  return { w: +m[1], h: +m[2] };
}
var たてA = 大きさ(縦A), よこA = 大きさ(横A), たてB = 大きさ(縦B);
eq(たてA.w, 360, 'スマホのときの横幅は360（画面にそのまま収まる大きさ）');
ok(たてA.h > よこA.h, 'スマホのときは、パソコンのときより縦に長い', たてA.h + ' / ' + よこA.h);
/* パソコンでも、以前（320）より縦を伸ばしている */
eq(よこA.h, 430, 'パソコンのときの高さは430（以前の320から約1.34倍）');
ok(よこA.h / 320 >= 1.3 && よこA.h / 320 <= 1.4,
  'パソコンの高さは、以前の1.3〜1.4倍におさまっている', (よこA.h / 320).toFixed(2) + '倍');
ok(よこA.h <= 520, 'パソコンでも、画面に収まる高さでとどめている', よこA.h + 'px');
eq(大きさ(Chart.資産を描く(資産F, false)).h, 430, '貯金のグラフも、パソコンで430');
ok(たてA.h / たてA.w > 1.2, 'スマホのときは、たてがよこの1.2倍より長い',
  (たてA.h / たてA.w).toFixed(2) + '倍');
ok(たてA.h / たてA.w < 1.6, 'ただし、たてに長すぎない', (たてA.h / たてA.w).toFixed(2) + '倍');
ok(よこA.w > たてA.w, 'パソコンのときは、これまでどおり横に広い');
eq(たてB.w, 360, '貯金のグラフもスマホでは360');
ok(たてB.h / たてB.w > 1.2, '貯金のグラフもスマホでは縦長');

/* 縦長でも文字がかぶらないこと（サンプル全部で確かめる） */
見本.samples.forEach(function (sm) {
  var 入 = Object.assign({}, sm.input, { divorced_childSupportMonthly: sm.input.childSupportMonthly });
  var si = SPS.シミュレーション(入, データ);
  var cv = SPS.資産カーブ(入, データ);
  [['くらべる', Chart.描く(si.years, si.cliffs, 'perPerson', true)],
   ['くらべる(総額)', Chart.描く(si.years, si.cliffs, 'total', true)],
   ['貯金', Chart.資産を描く(cv, true)]].forEach(function (g) {
    ok(重なり(g[1]).length === 0,
      '[' + sm.id + '] スマホの縦長でも' + g[0] + 'グラフの文字がかぶらない', 重なり(g[1]).join(' / '));
    var 字 = 文字を拾う(g[1]);
    ok(字.every(function (x) { return x.x2 <= 361; }),
      '[' + sm.id + '] スマホの縦長で' + g[0] + 'グラフの文字が右にはみ出さない',
      字.filter(function (x) { return x.x2 > 361; }).map(function (x) { return x.文; }).join(' / '));
    ok(字.every(function (x) { return x.x1 >= -1; }),
      '[' + sm.id + '] スマホの縦長で' + g[0] + 'グラフの文字が左にはみ出さない');
  });
});

/* 資格ルートを出した縦長でも、かぶらないこと */
var 縦訓 = Chart.資産を描く(SPS.資産カーブ(訓入力, データ), true);
ok(重なり(縦訓).length === 0, 'スマホの縦長で資格ルートを出しても、文字がかぶらない', 重なり(縦訓).join(' / '));

/* 動きを減らす設定のときは、アニメーションを止める */
var css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
ok(/@keyframes cta-pulse/.test(css), 'ボタンが脈打つ動きが定義されている');
ok(/@keyframes draw-line/.test(css), '線が伸びる動きが定義されている');
var 減らす = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
ok(減らす.indexOf('.alert-cta.pulse') > 0 && /\.alert-cta\.pulse\s*\{[^}]*animation:\s*none/.test(減らす),
  '動きを減らす設定では、ボタンの脈打ちを止める');
ok(/\.alert-cta\.pulse\s*\{[^}]*(outline|box-shadow)/.test(減らす),
  '動きを止めるかわりに、枠で強調している');
ok(/path\.draw-in\s*\{[^}]*animation:\s*none/.test(減らす),
  '動きを減らす設定では、線が伸びる動きも止める');
ok(/path\.draw-in\s*\{[^}]*stroke-dashoffset:\s*0/.test(減らす),
  '動きを止めたときも、線はちゃんと最後まで見える');
ok(/\.fade-in\s*\{[^}]*opacity:\s*1/.test(減らす), '遅れて出る文字も、動きなしで最初から見える');
ok(css.indexOf('cta-pulse 1.8s') > 0, '脈打つ周期は1.8秒（1.5〜2秒のあいだ）');

/* グラフの下の長い説明は、たたんである（グラフの中のラベルは残す） */
var appソース = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
ok(/打ち切りの注記[\s\S]{0,2600}details class="explain"/.test(appソース),
  '網かけと赤い線の説明が、折りたたみに入っている');
ok(appソース.indexOf('グラフの網かけと赤い線の意味（くわしく）') > 0,
  '閉じたときの見出しが1行で用意されている');
ok(!/打ち切りの注記[\s\S]{0,2600}details class="explain" open/.test(appソース),
  'その折りたたみは、はじめから開いてはいない');
/* グラフの中の短いラベルは、たたまずに残す */
var 短いラベル = Chart.資産を描く(赤字);
ok(短いラベル.indexOf('借りられません') > 0, 'グラフの中の借入上限のラベルは残っている');
ok(短いラベル.indexOf('この先は') > 0, 'グラフの中の網かけのラベルも残っている');

/* ------------------------------------------------------------ */
見出し('14. 画面と処理のつながり');

var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var app = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
var 使っているid = [];
app.replace(/\$\('([a-z0-9-]+)'\)/g, function (_, id) { 使っているid.push(id); return _; });
使っているid.filter(function (v, i, a) { return a.indexOf(v) === i; })
  .filter(function (id) {
    /* 画面のうごきの中で作られる欄は、index.html には書かれていない */
    return id.indexOf('child-age-') !== 0 && id.indexOf('pr-') !== 0 &&
      id.indexOf('msg-') !== 0 && id.indexOf('copy-todo') !== 0 && id.indexOf('copy-rule') !== 0 &&
      id !== 'go-training' && id.indexOf('balance-') !== 0 && id !== 'curve-chart';
  })
  .forEach(function (id) {
    ok(html.indexOf('id="' + id + '"') > 0, '画面に「' + id + '」の欄がある');
  });
ok(html.indexOf('escape-btn') > 0, '「すぐ閉じる」のボタンが画面にある');
ok(app.indexOf('location.replace') > 0, '「すぐ閉じる」は履歴を置きかえる形で移動する');
ok(html.indexOf('localStorage') === -1 && app.indexOf('localStorage') === -1, '端末に保存する処理を一切持っていない');
/* ファイルを直接ダブルクリックして開いても動くこと（読み込みに通信を使っていないこと） */
ok(app.indexOf('XMLHttpRequest') === -1 && app.indexOf('fetch(') === -1,
  '制度データの読み込みに通信を使っていない（file:// で直接開いても動く）');
['SPS_DATA_PROGRAMS', 'SPS_DATA_PITFALLS', 'SPS_DATA_SAMPLES'].forEach(function (g) {
  ok(app.indexOf('window.' + g) > 0, '画面が「' + g + '」のデータを直接受け取っている');
});
ok(/data\/programs\.js/.test(html) && /data\/pitfalls\.js/.test(html) && /data\/samples\.js/.test(html),
  '画面が3つのデータファイルを読み込んでいる');
ok(!fs.existsSync(path.join(ROOT, 'data', 'programs.json')),
  'データが2か所に分かれていない（古い形式のファイルが残っていない）');
ok(html.indexOf('sessionStorage') === -1 && app.indexOf('sessionStorage') === -1, '一時的な保存もしていない');
ok(!/src="https?:/.test(html) && !/href="https?:\/\/[^"]*\.(css|js)/.test(html),
  '外から読み込むプログラムや見た目のファイルがない（インターネットにつながらなくても動く）');
['data/programs.js', 'data/pitfalls.js', 'data/samples.js',
 'js/engine.js', 'js/chart.js', 'js/prompts.js', 'js/app.js', 'css/style.css'].forEach(function (f) {
  ok(html.indexOf(f) > 0, '画面が「' + f + '」を読み込んでいる');
  ok(fs.existsSync(path.join(ROOT, f)), '「' + f + '」が実在する');
});
ok(fs.existsSync(path.join(ROOT, 'manual.html')), '使い方マニュアルが実在する');
ok(fs.existsSync(path.join(ROOT, 'LICENSE')), 'ライセンスの文書が実在する');

/* 通信していないことの確認 */
[app, fs.readFileSync(path.join(ROOT, 'js', 'engine.js'), 'utf8'),
 fs.readFileSync(path.join(ROOT, 'js', 'prompts.js'), 'utf8'),
 fs.readFileSync(path.join(ROOT, 'js', 'chart.js'), 'utf8')].forEach(function (src, n) {
  ok(!/fetch\(\s*['"`]https?:/.test(src) && !/\.open\(\s*['"`](GET|POST)['"`]\s*,\s*['"`]https?:/.test(src) &&
     src.indexOf('WebSocket') === -1 && src.indexOf('navigator.sendBeacon') === -1,
    'プログラム' + (n + 1) + '番が、外のサーバーへデータを送っていない');
});

/* ------------------------------------------------------------ */
console.log('\n============================================');
console.log('  成功 ' + 成功 + ' 件 ／ 失敗 ' + 失敗 + ' 件');
console.log('============================================');
process.exit(失敗 === 0 ? 0 : 1);
