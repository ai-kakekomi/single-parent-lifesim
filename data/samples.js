/* ============================================================
 * samples.js  架空の例のデータ（6件）。
 * 画面の「例で試す」ボタンと、自動チェックの期待値が、この同じ数字を使っています。
 *
 *  ブラウザからも Node からも、同じこのファイルを読みます。
 *  （データを2か所に置くと必ずずれるので、1か所にまとめてあります）
 *  ファイルを直接ダブルクリックして開いても動くように、
 *  読み込むだけのプログラムの形にしてあります。中身はただのデータです。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.SPS_DATA_SAMPLES = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
  "version": "1.0.0",
  "generated": "2026-08-11",
  "note": "ここに出てくる人はすべて架空です。実在の方とは関係ありません。動きをためすためと、計算が正しいかを確かめるための例として用意しています。画面の『例で試す』と、開発用の自動チェックの両方が、この同じ数字を使っています。",
  "samples": [
    {
      "id": "part_two_kids",
      "label": "パート勤務・保育園児と小学生のおかあさん",
      "story": "パートで年150万円。5歳と8歳のお子さんと賃貸暮らし。養育費は取り決めをしていません。毎月の生活費95,000円は、かなり切り詰めた場合のめやすです（親子3人・住居費と学校のお金をのぞく）。",
      "input": {
        "isSingleParent": true,
        "myAge": 34,
        "myIncome": 1500000,
        "spouseIncome": 0,
        "children": [5, 8],
        "area": "愛知県名古屋市",
        "housingType": "賃貸",
        "housingNow": 65000,
        "housingAfter": 65000,
        "childSupportState": "取り決めをしていない",
        "childSupportMonthly": 0,
        "parentSupportMonthly": 0,
        "parentAge": 0,
        "livingCost": 95000,
        "currentSavings": 80000,
        "usedPrograms": ["jido_teate"]
      },
      "expect": {
        "jidoFuyoTeate": { "status": "full", "monthly": 59400, "income": 670000 },
        "jidoTeateMonthly": 20000,
        "pitfalls": ["youikuhi_nashi", "gakushi_minogashi"]
      }
    },
    {
      "id": "seishain_one_kid",
      "label": "正社員・中学生のおかあさん（養育費あり）",
      "story": "正社員で年320万円。14歳のお子さんが1人。養育費を月4万円受け取っています。",
      "input": {
        "isSingleParent": true,
        "myAge": 41,
        "myIncome": 3200000,
        "spouseIncome": 0,
        "children": [14],
        "area": "東京都板橋区",
        "housingType": "賃貸",
        "housingNow": 90000,
        "housingAfter": 90000,
        "childSupportState": "公正証書で取り決めている",
        "childSupportMonthly": 40000,
        "parentSupportMonthly": 0,
        "parentAge": 0,
        "livingCost": 105000,
        "currentSavings": 600000,
        "usedPrograms": ["jido_fuyo_teate", "jido_teate", "hitorioya_kojo"],
        "plans": [{ "high": "private", "university": "private_home" }]
      },
      "expect": {
        "jidoFuyoTeate": { "status": "partial", "monthly": 13870, "income": 2364000 },
        "jidoTeateMonthly": 10000,
        "pitfalls": ["gakushi_minogashi", "shunyu_no_gake"]
      }
    },
    {
      "id": "over_limit",
      "label": "フルタイム勤務・所得の制限をこえているおとうさん",
      "story": "年450万円。10歳と16歳のお子さんが2人。養育費は受け取っていません。児童扶養手当は対象外ですが、ほかの制度は使えます。",
      "input": {
        "isSingleParent": true,
        "myAge": 45,
        "myIncome": 4500000,
        "spouseIncome": 0,
        "children": [10, 16],
        "area": "大阪府堺市",
        "housingType": "持ち家",
        "housingNow": 105000,
        "housingAfter": 105000,
        "childSupportState": "受け取っていない",
        "childSupportMonthly": 0,
        "parentSupportMonthly": 0,
        "parentAge": 0,
        "livingCost": 120000,
        "currentSavings": 1500000,
        "usedPrograms": ["jido_teate", "hitorioya_kojo"]
      },
      "expect": {
        "jidoFuyoTeate": { "status": "none", "monthly": 0, "income": 2980000 },
        "jidoTeateMonthly": 20000,
        "pitfalls": ["gakushi_minogashi", "youikuhi_nashi"]
      }
    },
    {
      "id": "considering_divorce",
      "label": "離婚を考えている段階・パート勤務のおかあさん",
      "story": "いまは婚姻中。ご自身はパートで年110万円、配偶者は年500万円。3歳と6歳のお子さん。離婚したら家賃6万5千円のところへ移ることを考えています。養育費は月4万円で話がまとまりそうです。離婚後の生活費95,000円は、かなり切り詰めた場合のめやすです（親子3人・住居費と学校のお金をのぞく）。",
      "input": {
        "isSingleParent": false,
        "myAge": 33,
        "myIncome": 1100000,
        "spouseIncome": 5000000,
        "children": [3, 6],
        "area": "神奈川県横浜市",
        "housingType": "賃貸",
        "housingNow": 110000,
        "housingAfter": 65000,
        "childSupportState": "これから取り決める",
        "childSupportMonthly": 40000,
        "parentSupportMonthly": 0,
        "parentAge": 0,
        "livingCost": 95000,
        "currentSavings": 300000,
        "usedPrograms": ["jido_teate"]
      },
      "expect": {
        "jidoFuyoTeate": { "status": "notApplicableNow" },
        "jidoTeateMonthly": 20000,
        "divorcedJidoFuyoTeateAtStart": { "status": "full", "monthly": 59400 },
        "pitfalls": ["youikuhi_nashi", "gakushi_minogashi"]
      }
    },
    {
      "id": "on_the_edge",
      "label": "あと少しで手当が減るところにいるおかあさん",
      "story": "年190万円。7歳のお子さんが1人。全部支給のちょうど境目にいます。あと1万円多く稼ぐと、手当が減りはじめます。",
      "input": {
        "isSingleParent": true,
        "myAge": 36,
        "myIncome": 1900000,
        "spouseIncome": 0,
        "children": [7],
        "area": "福岡県福岡市",
        "housingType": "賃貸",
        "housingNow": 58000,
        "housingAfter": 58000,
        "childSupportState": "受け取っていない",
        "childSupportMonthly": 0,
        "parentSupportMonthly": 0,
        "parentAge": 0,
        "livingCost": 90000,
        "currentSavings": 150000,
        "usedPrograms": ["jido_fuyo_teate", "jido_teate"]
      },
      "expect": {
        "jidoFuyoTeate": { "status": "full", "monthly": 48050, "income": 1070000 },
        "jidoTeateMonthly": 10000,
        "pitfalls": ["shunyu_no_gake", "gakushi_minogashi", "youikuhi_nashi"]
      }
    },
    {
      "id": "parent_support",
      "label": "実家の援助を受けているおかあさん",
      "story": "年260万円。4歳と9歳のお子さん。68歳のお母さまから月3万円の援助を受けています。この援助がいつまで続くかを、グラフで確かめられます。",
      "input": {
        "isSingleParent": true,
        "myAge": 38,
        "myIncome": 2600000,
        "spouseIncome": 0,
        "children": [4, 9],
        "area": "北海道札幌市",
        "housingType": "賃貸",
        "housingNow": 62000,
        "housingAfter": 62000,
        "childSupportState": "取り決めをしていない",
        "childSupportMonthly": 0,
        "parentSupportMonthly": 30000,
        "parentAge": 68,
        "livingCost": 100000,
        "currentSavings": 400000,
        "usedPrograms": ["jido_teate"]
      },
      "expect": {
        "jidoFuyoTeate": { "status": "partial", "monthly": 56030, "income": 1560000 },
        "jidoTeateMonthly": 20000,
        "pitfalls": ["youikuhi_nashi", "oya_shien_eizoku", "gakushi_minogashi", "shunyu_no_gake"],
        "cliffLabels": ["親からの支援が終わる想定（親75歳）"]
      }
    }
  ]
};
}));
