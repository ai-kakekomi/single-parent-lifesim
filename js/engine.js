/* ============================================================
 * engine.js  計算のしんぶ（画面には触らない、数だけを扱う部分）
 *
 *  ブラウザからも Node からも同じものを読み込んで使えるようにしてあります。
 *  制度の金額・限度額そのものは、この中には書きません。
 *  すべて data/programs.json 側に置き、ここは「計算のやり方」だけを持ちます。
 *  （制度改正が来たら、data/programs.json の数字を直すだけで済むようにするため）
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.SPS = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAN = 10000;

  /* ------------------------------------------------------------
   * 1. 給与収入 → 給与所得（給与所得控除を引いたあとの金額）
   *
   *   出典: 国税庁 タックスアンサー No.1410「給与所得控除」
   *   https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm
   *   （最終確認日 2026-08-11）
   *
   *   令和7年分以降（最低保障額 65万円）の速算表を既定とする。
   *   令和6年分以前（最低保障額 55万円）の表も残してあるのは、
   *   児童扶養手当の判定はその年の11月〜翌年10月について
   *   「前々年または前年の所得」を使うため、古い年分で計算したい
   *   場合があるから。既定は 'r7'。
   * ---------------------------------------------------------- */
  var 給与所得控除表 = {
    r7: [ /* 令和7年分以降 */
      { upto: 1900000, calc: function () { return 650000; } },
      { upto: 3600000, calc: function (x) { return x * 0.30 + 80000; } },
      { upto: 6600000, calc: function (x) { return x * 0.20 + 440000; } },
      { upto: 8500000, calc: function (x) { return x * 0.10 + 1100000; } },
      { upto: Infinity, calc: function () { return 1950000; } }
    ],
    r2: [ /* 令和2年分〜令和6年分 */
      { upto: 1625000, calc: function () { return 550000; } },
      { upto: 1800000, calc: function (x) { return x * 0.40 - 100000; } },
      { upto: 3600000, calc: function (x) { return x * 0.30 + 80000; } },
      { upto: 6600000, calc: function (x) { return x * 0.20 + 440000; } },
      { upto: 8500000, calc: function (x) { return x * 0.10 + 1100000; } },
      { upto: Infinity, calc: function () { return 1950000; } }
    ]
  };

  /** 給与収入から給与所得控除額を求める */
  function 給与所得控除(給与収入, 年分) {
    var 表 = 給与所得控除表[年分 || 'r7'];
    var x = Math.max(0, Math.floor(給与収入 || 0));
    for (var i = 0; i < 表.length; i++) {
      if (x <= 表[i].upto) { return Math.min(x, Math.floor(表[i].calc(x))); }
    }
    return 0;
  }

  /** 給与収入 → 給与所得（1円未満切り捨て） */
  function 給与所得(給与収入, 年分) {
    var x = Math.max(0, Math.floor(給与収入 || 0));
    return Math.max(0, x - 給与所得控除(x, 年分));
  }

  /* ------------------------------------------------------------
   * 2. 児童扶養手当の「所得額」
   *
   *   所得額 ＝ 給与所得等の合計
   *            − 給与所得等がある人の一律10万円控除
   *            − 社会保険料相当額（一律8万円）
   *            ＋ 受け取った養育費の8割
   *            − 障害者控除などの諸控除（あれば）
   *
   *   ※ 受給者本人には、ひとり親控除・寡婦控除は適用されない。
   *
   *   こども家庭庁の公式計算例（令和8年度）と一致することを確かめてある。
   *     給与収入 181万円、養育費 年30万円、扶養親族等1人 のとき
   *     給与所得 116万 − 10万 − 8万 ＋ 24万 ＝ 所得額 122万円
   *   出典・条文は data/programs.json の jido_fuyo_teate の source を参照。
   * ---------------------------------------------------------- */
  function 児童扶養手当の所得額(入力, テーブル) {
    var t = テーブル || {};
    var 養育費算入率 = (t.child_support_inclusion_rate != null) ? t.child_support_inclusion_rate : 0.8;
    var 社保相当 = (t.social_insurance_flat_deduction != null) ? t.social_insurance_flat_deduction : 80000;
    var 給与一律 = (t.salary_income_flat_deduction != null) ? t.salary_income_flat_deduction : 100000;

    var 給与 = 給与所得(入力.salaryGross || 0, 入力.taxYear);
    var その他 = Math.max(0, Math.floor(入力.otherIncome || 0)); // 事業所得など（すでに所得ベース）
    var 養育費年額 = Math.max(0, Math.floor(入力.childSupportYearly || 0));
    var 諸控除 = Math.max(0, Math.floor(入力.otherDeductions || 0));

    var 額 = 給与 + その他
      - Math.min(給与, 給与一律)
      - 社保相当
      + Math.floor(養育費年額 * 養育費算入率)
      - 諸控除;
    return Math.max(0, 額);
  }

  /* ------------------------------------------------------------
   * 3. 児童扶養手当の判定（全部支給 / 一部支給 / 対象外）
   *
   *   判定式（限度額は「扶養親族等の数」で決まる）
   *     所得額 <= 全部支給限度額            → 全部支給
   *     全部支給限度額 < 所得額 <= 一部支給限度額 → 一部支給
   *     一部支給限度額 < 所得額            → 対象外（支給停止）
   *
   *   一部支給額（傾斜式。かっこの中を計算してから10円未満四捨五入）
   *     本体   = A1 −〔(所得額 − 全部支給限度額) × K1 ＋ 10円〕
   *     加算   = A2 −〔(所得額 − 全部支給限度額) × K2 ＋ 10円〕（2人目以降1人につき）
   *   「＋10円」まで含めてこども家庭庁の計算式どおり。
   *   A・K の値は data/programs.json 側に持たせる。
   *
   *   検算（令和8年度・こども家庭庁の公式計算例）
   *     所得額122万円、扶養親族等1人（全部支給限度額107万円）
   *     48,050 −〔150,000 × 0.0264029 ＋ 10〕＝ 44,079.6 → 44,080円
   * ---------------------------------------------------------- */

  /** 10円未満四捨五入 */
  function 十円丸め(v) { return Math.round(v / 10) * 10; }

  /** 扶養親族等の数から限度額を引く（表にない人数は最終行＋加算額で外挿） */
  function 限度額(表, 扶養人数) {
    var n = Math.max(0, Math.floor(扶養人数 || 0));
    var rows = 表.rows || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].dependents === n) { return { full: rows[i].full, partial: rows[i].partial }; }
    }
    var last = rows[rows.length - 1];
    var 加算 = 表.per_extra_dependent || 380000;
    var 差 = n - last.dependents;
    return { full: last.full + 加算 * 差, partial: last.partial + 加算 * 差 };
  }

  /**
   * 児童扶養手当を判定する。
   * @param {Object} 入力 { salaryGross, otherIncome, childSupportYearly, otherDeductions,
   *                        dependents(扶養親族等の数), childCount(対象児童の数), taxYear }
   * @param {Object} 表   data/programs.json の jido_fuyo_teate.eligibility
   * @return {Object} { status:'full'|'partial'|'none', label, monthly, breakdown, income, limits }
   */
  function 児童扶養手当(入力, 表) {
    var 所得 = 児童扶養手当の所得額(入力, 表);
    var 子 = Math.max(0, Math.floor(入力.childCount || 0));
    var 扶養 = (入力.dependents != null) ? 入力.dependents : 子;
    var lim = 限度額(表.income_limits_recipient, 扶養);
    var A = 表.amounts;

    var 結果 = { income: 所得, limits: lim, breakdown: [], monthly: 0 };

    if (子 <= 0) {
      結果.status = 'none'; 結果.label = '対象外の見込み';
      結果.reason = '18歳になった年度の3月31日までのお子さんがいない場合は対象になりません。';
      return 結果;
    }
    if (所得 > lim.partial) {
      結果.status = 'none'; 結果.label = '対象外の見込み';
      結果.reason = '所得が一部支給の限度額をこえています。';
      return 結果;
    }

    var 全部 = (所得 <= lim.full);
    結果.status = 全部 ? 'full' : 'partial';
    結果.label = 全部 ? '全部支給の可能性が高い' : '一部支給の可能性が高い';

    var 超過 = Math.max(0, 所得 - lim.full);
    var 合計 = 0;
    for (var i = 1; i <= 子; i++) {
      var key = (i === 1) ? 'first' : (i === 2) ? 'second' : 'third_plus';
      var s = A[key];
      var 額;
      if (全部) {
        額 = s.full;
      } else {
        額 = 十円丸め(s.full - (超過 * s.coefficient + 10));
        if (額 > s.partial_max) { 額 = s.partial_max; }
        if (額 < s.partial_min) { 額 = s.partial_min; }
      }
      合計 += 額;
      結果.breakdown.push({ nth: i, amount: 額 });
    }
    結果.monthly = 合計;
    return 結果;
  }

  /* ------------------------------------------------------------
   * 4. 児童手当（所得による制限はない。子の年齢と第何子かで決まる）
   *    第3子のカウントは「22歳になった年度末までの子」を上から数える。
   * ---------------------------------------------------------- */
  function 児童手当(子の年齢一覧, 表) {
    var ages = (子の年齢一覧 || []).slice().sort(function (a, b) { return b - a; }); // 年上から
    var 順位 = 0, 合計 = 0, 明細 = [];
    for (var i = 0; i < ages.length; i++) {
      var age = ages[i];
      if (age <= 表.count_child_upto_age) { 順位++; } else { continue; }
      if (age > 表.pay_upto_age) { continue; } // カウント対象だが支給対象外（大学生年代など）
      var 第3子以降 = (順位 >= 3);
      var 月額;
      if (age < 3) {
        月額 = 第3子以降 ? 表.monthly.under3_third_plus : 表.monthly.under3;
      } else {
        月額 = 第3子以降 ? 表.monthly.age3_to_18_third_plus : 表.monthly.age3_to_18;
      }
      合計 += 月額;
      明細.push({ age: age, nth: 順位, amount: 月額 });
    }
    return { monthly: 合計, detail: 明細 };
  }

  /* ------------------------------------------------------------
   * 5. 手取りのめやす（表示のためだけの概算。判定には一切使わない）
   *
   *   手取り ＝ 額面 − 社会保険料 − 所得税 − 住民税
   *     社会保険料 ＝ 額面 × 14.5%
   *        （健康保険 約5% ＋ 厚生年金 9.15% ＋ 雇用保険 約0.55% の本人負担分をならしたもの）
   *     所得税     ＝ 課税所得 × 累進税率 × 1.021（復興特別所得税）
   *        課税所得 ＝ 額面 − 給与所得控除 − 社会保険料 − 基礎控除 −（ひとり親控除35万）
   *     住民税     ＝ 課税所得(住民税) × 10% ＋ 均等割 5,000円
   *        課税所得(住民税) ＝ 額面 − 給与所得控除 − 社会保険料 − 43万 −（ひとり親控除30万）
   *
   *   扶養している子の扶養控除（16歳以上）や配偶者控除、医療費控除などは入れていません。
   *   あくまで画面表示のためのめやすで、実際の手取りとはずれます。
   * ---------------------------------------------------------- */
  var 基礎控除表 = [ /* 国税庁 No.1199 令和7年分以降 */
    { upto: 1320000, v: 950000 },
    { upto: 3360000, v: 580000 },
    { upto: 4890000, v: 680000 },
    { upto: 6550000, v: 630000 },
    { upto: 23500000, v: 580000 },
    { upto: Infinity, v: 480000 }
  ];
  function 基礎控除(合計所得) {
    for (var i = 0; i < 基礎控除表.length; i++) {
      if (合計所得 <= 基礎控除表[i].upto) { return 基礎控除表[i].v; }
    }
    return 0;
  }
  var 所得税率表 = [ /* 国税庁 No.2260 */
    { upto: 1950000, rate: 0.05, sub: 0 },
    { upto: 3300000, rate: 0.10, sub: 97500 },
    { upto: 6950000, rate: 0.20, sub: 427500 },
    { upto: 9000000, rate: 0.23, sub: 636000 },
    { upto: 18000000, rate: 0.33, sub: 1536000 },
    { upto: 40000000, rate: 0.40, sub: 2796000 },
    { upto: Infinity, rate: 0.45, sub: 4796000 }
  ];
  function 所得税額(課税所得) {
    var x = Math.max(0, Math.floor(課税所得 / 1000) * 1000);
    for (var i = 0; i < 所得税率表.length; i++) {
      if (x <= 所得税率表[i].upto) {
        return Math.max(0, Math.floor((x * 所得税率表[i].rate - 所得税率表[i].sub) * 1.021));
      }
    }
    return 0;
  }

  function 手取りめやす(額面年収, ひとり親か) {
    var 額面 = Math.max(0, Math.floor(額面年収 || 0));
    if (額面 === 0) { return 0; }
    var 社保 = Math.floor(額面 * 0.145);
    var 所得 = 給与所得(額面);
    var 所得税課税 = Math.max(0, 所得 - 社保 - 基礎控除(所得) - (ひとり親か ? 350000 : 0));
    var 住民税課税 = Math.max(0, 所得 - 社保 - 430000 - (ひとり親か ? 300000 : 0));
    var 所得税 = 所得税額(所得税課税);
    var 住民税 = (住民税課税 > 0) ? Math.floor(住民税課税 * 0.10) + 5000 : 0;
    return Math.max(0, 額面 - 社保 - 所得税 - 住民税);
  }

  /* ------------------------------------------------------------
   * 5-2. ひとりあたりに直した金額（等価可処分所得）
   *
   *   家族の人数がちがう暮らしを、同じものさしで比べるための計算です。
   *
   *     ひとりあたりに直した金額 ＝ ひと月の合計 ÷ √世帯人数
   *
   *   ただ人数で割らないのは、電気代や家賃のように
   *   「人数がふえてもそれほどふえない費用」があるためです。
   *   人数の平方根で割ると、そこをうまく織り込めます。
   *
   *   これは私たちが考えた計算ではありません。
   *   厚生労働省が国民生活基礎調査で相対的貧困率を出すときに使っている、
   *   OECDの作成基準にもとづくやり方と同じです。
   *   出典: 厚生労働省「国民生活基礎調査（貧困率）よくあるご質問」
   *   https://www.mhlw.go.jp/toukei/list/dl/20-21a-01.pdf
   *   （最終確認日 2026-08-11）
   * ---------------------------------------------------------- */
  function 等価所得(ひと月の合計, 世帯人数) {
    var n = Math.max(1, Math.floor(世帯人数 || 1));
    return Math.round((ひと月の合計 || 0) / Math.sqrt(n));
  }

  /* ------------------------------------------------------------
   * 6. 年ごとのシミュレーション（Stage 2）
   *
   *   末子が22歳になる年まで、1年きざみで
   *     「結婚を続けた場合」と「離婚した場合」の
   *     ひと月あたりの お金（手取り＋手当−住居費）を出す。
   *
   *   出す数字は2とおり
   *     ・total     ... 家全体で、ひと月に使えるお金
   *     ・perPerson ... それをひとりあたりに直した金額（÷√世帯人数）
   *   ふだん見せるのは perPerson のほう。
   *   結婚を続けた場合は大人2人、離婚した場合は大人1人で暮らすので、
   *   家全体の金額をそのまま並べると、結婚を続けた側が実際より豊かに見えるため。
   *
   *   仮定（画面にも出す）
   *     ・年収は変わらない（昇給・転職を織り込まない）
   *     ・変わるのは、子の年齢で変わる手当と、親からの支援の終わり
   *     ・物価の上昇、税制・制度の改正は織り込まない
   *     ・世帯人数は「大人＋お子さんの人数」。結婚を続けた場合は大人2人、
   *       離婚した場合は大人1人。お子さんは期間中ずっと一緒に暮らすものとする
   * ---------------------------------------------------------- */
  function シミュレーション(入力, データ) {
    var t = データ.tables;
    var 児扶表 = データ.programs_by_id.jido_fuyo_teate.eligibility;
    var 児手表 = データ.programs_by_id.jido_teate.eligibility;

    var 子 = (入力.children || []).slice().sort(function (a, b) { return a - b; });
    if (!子.length) { return { years: [], cliffs: [] }; }
    var 末子 = 子[0];
    var 年数 = Math.max(1, t.simulate_until_youngest_age - 末子 + 1);

    var 自分手取り月 = Math.floor(手取りめやす(入力.myIncome, true) / 12);
    var 婚姻中手取り月 = Math.floor(手取りめやす(入力.myIncome, false) / 12)
      + Math.floor(手取りめやす(入力.spouseIncome, false) / 12);

    var 養育費月 = 入力.divorced_childSupportMonthly || 0;
    var 親支援月 = 入力.parentSupportMonthly || 0;
    var 親の年齢 = 入力.parentAge || 0;
    var 親支援終了年齢 = (入力.parentSupportEndAge != null) ? 入力.parentSupportEndAge : t.parent_support_end_age_default;

    var years = [], cliffs = [];
    for (var y = 0; y < 年数; y++) {
      var ages = 子.map(function (a) { return a + y; });
      // 児童手当の対象年齢の子だけ数える
      var 児扶対象数 = ages.filter(function (a) { return a <= 児扶表.pay_upto_age; }).length;

      /* --- 結婚を続けた場合 --- */
      var 婚児手 = 児童手当(ages, 児手表).monthly;
      var 婚親支援 = (親の年齢 && (親の年齢 + y) >= 親支援終了年齢) ? 0 : 親支援月;
      var 婚合計 = 婚姻中手取り月 + 婚児手 + 婚親支援 - (入力.housingNow || 0);

      /* --- 離婚した場合 --- */
      var 離児手 = 児童手当(ages, 児手表).monthly;
      var 離児扶 = 児童扶養手当({
        salaryGross: 入力.myIncome,
        childSupportYearly: 養育費月 * 12,
        dependents: 児扶対象数,
        childCount: 児扶対象数
      }, 児扶表);
      var 離親支援 = 婚親支援;
      var 離合計 = 自分手取り月 + 離児手 + 離児扶.monthly + 養育費月 + 離親支援 - (入力.housingAfter || 0);

      /* 世帯人数（大人＋子ども）。結婚を続けた場合は大人2人、離婚した場合は大人1人 */
      var 婚人数 = 2 + 子.length;
      var 離人数 = 1 + 子.length;

      years.push({
        offset: y,
        youngestAge: 末子 + y,
        childAges: ages,
        married: {
          takehome: 婚姻中手取り月, jidoTeate: 婚児手, jidoFuyoTeate: 0, childSupport: 0,
          parentSupport: 婚親支援, housing: (入力.housingNow || 0),
          total: 婚合計, householdSize: 婚人数, perPerson: 等価所得(婚合計, 婚人数)
        },
        divorced: {
          takehome: 自分手取り月, jidoTeate: 離児手, jidoFuyoTeate: 離児扶.monthly,
          jidoFuyoTeateStatus: 離児扶.status, childSupport: 養育費月,
          parentSupport: 離親支援, housing: (入力.housingAfter || 0),
          total: 離合計, householdSize: 離人数, perPerson: 等価所得(離合計, 離人数)
        }
      });
    }

    /* --- 制度の崖（金額が下がる年）を拾う --- */
    function 崖(条件, ラベル) {
      for (var i = 1; i < years.length; i++) {
        if (条件(years[i - 1], years[i])) { cliffs.push({ offset: i, youngestAge: years[i].youngestAge, label: ラベル }); return; }
      }
    }
    崖(function (a, b) { return b.divorced.jidoFuyoTeate < a.divorced.jidoFuyoTeate; }, '児童扶養手当が減る／終わる');
    崖(function (a, b) { return b.divorced.jidoTeate < a.divorced.jidoTeate; }, '児童手当が減る／終わる');
    if (親支援月 > 0 && 親の年齢) {
      for (var j = 0; j < years.length; j++) {
        if ((親の年齢 + j) >= 親支援終了年齢) {
          cliffs.push({ offset: j, youngestAge: years[j].youngestAge, label: '親からの支援が終わる想定（親' + 親支援終了年齢 + '歳）' });
          break;
        }
      }
    }
    cliffs.sort(function (a, b) { return a.offset - b.offset; });
    return { years: years, cliffs: cliffs };
  }

  /* ------------------------------------------------------------
   * 6-1-2. お子さんの成長で、生活費がふえること
   *
   *   生活費をずっと同じ金額にしておくと、
   *   お子さんが中学生・高校生になったあとの姿が甘く出ます。
   *   実際には、食べる量がふえます。
   *
   *   そこで、生活費のうち食費にあたる部分（母子世帯の平均で約31%）だけを、
   *   年齢ごとに必要なエネルギー量の比で増やします。
   *   エネルギー量は厚生労働省の「日本人の食事摂取基準（2025年版）」の値です。
   *
   *   食費以外（家賃以外の固定費、通信費、日用品など）は増やしません。
   *   学校にかかるお金は別に計算しているので、ここには入れません（二重に数えないため）。
   * ---------------------------------------------------------- */
  function 必要エネルギー(年齢, 表) {
    if (!表 || !表.energy_bands) { return null; }
    var b = 表.energy_bands;
    for (var i = 0; i < b.length; i++) {
      if (年齢 >= b[i].from && 年齢 <= b[i].to) { return b[i].kcal; }
    }
    return b[b.length - 1].kcal;
  }

  /**
   * その年の生活費が、入力した時点の何倍になるかを返す。
   *
   *   倍率 ＝ (1 − 食費割合) ＋ 食費割合 × (その年の必要エネルギー ÷ 基準の必要エネルギー)
   *
   * 【引数の順番に注意】第1引数が「基準（入力した時点）」、第2引数が「知りたい年」です。
   * 逆に渡すと、時間を巻き戻した倍率（1未満）が返ります。それは誤りではなく、
   * 「巻き戻したらどうだったか」の答えです。呼ぶ側が順番を守ってください。
   *
   *   生活費の倍率([5, 8], [13, 16], 表)  →  1.2079  … 子が育つ向き（正しい使い方）
   *   生活費の倍率([13, 16], [5, 8], 表)  →  0.8750  … 巻き戻す向き
   *
   * @param {Array} 基準の年齢たち   入力した時点の、お子さんの年齢
   * @param {Array} その年の年齢たち 知りたい年の、お子さんの年齢
   */
  function 生活費の倍率(基準の年齢たち, その年の年齢たち, 表) {
    if (!表 || !表.energy_bands || !基準の年齢たち.length) { return 1; }
    var 基準 = 0, その年 = 0;
    基準の年齢たち.forEach(function (a) { 基準 += 必要エネルギー(a, 表); });
    その年の年齢たち.forEach(function (a) { その年 += 必要エネルギー(a, 表); });
    if (基準 <= 0) { return 1; }
    var 食費割合 = (表.food_share != null) ? 表.food_share : 0;
    /* 食費の部分だけが、エネルギー量の比で増える */
    return (1 - 食費割合) + 食費割合 * (その年 / 基準);
  }

  /* ------------------------------------------------------------
   * 6-2. 貯金のたまり方（資産カーブ）
   *
   *   ひと月の残り ＝ 手取り ＋ 手当 ＋ 養育費 ＋ 親の援助 − 住居費 − 生活費
   *   これを、いちばん下のお子さんが22歳になるまで、1か月ずつ積み上げます。
   *
   *   線は2本
   *     ・制度を申請した場合   ... 児童扶養手当・児童手当・ひとり親控除が入る
   *     ・申請しなかった場合   ... それらが入らない
   *   ひらいた差が、取りこぼしの金額です。
   *
   *   ひとり親になったあとの姿を出します。
   *   （離婚を考えている段階の方には「離婚した場合」の姿として出します）
   *
   *   貯金は0円から始まるものとして計算します。
   *   いま持っているお金は聞いていないので、足し引きの積み上がり方だけを見てください。
   *   赤字になる場合も、0で止めずにマイナスのまま描きます。
   *
   *   生活防衛資金（生活費の3か月分から6か月分）の帯もいっしょに返します。
   * ---------------------------------------------------------- */
  /** その年齢のお子さん1人に、1年でかかる学校のお金 */
  function 学費(年齢, プラン, 学費表) {
    if (!学費表) { return 0; }
    var p = プラン || {};
    var b = 学費表.bands;
    for (var i = 0; i < b.length; i++) {
      if (年齢 >= b[i].from && 年齢 <= b[i].to) {
        var 選択 = p[b[i].stage] || b[i].default;
        var v = b[i].costs[選択];
        if (v == null) { return 0; }
        /* 入学のときだけかかるお金（大学の入学料）は、その学校に入る年に足す */
        if (b[i].entrance && 年齢 === b[i].from && b[i].entrance[選択]) { v += b[i].entrance[選択]; }
        return v;
      }
    }
    return 0;   // その年齢は、学校にかかるお金を数えない（幼稚園・保育園は無償化のためゼロ）
  }

  /* ------------------------------------------------------------
   * 学費を助けてくれる制度
   *
   *   低い収入の世帯ほど手厚くなります。これを入れないと
   *   「私立に行ったら終わり」という、実際とちがう絵になります。
   *
   *   分け方
   *     ・高校の就学支援金 … 学校から案内があり、ほぼ全員が手続きするので
   *                          「いまのまま」の線にも入れる
   *     ・高校の奨学給付金 … 都道府県へ自分で申し込むので「制度活用」側だけ
   *     ・大学の修学支援新制度 … 自分で申し込むので「制度活用」側だけ
   *
   *   判定できないときは、支援なしの側に倒します（甘く見せないため）。
   * ---------------------------------------------------------- */
  function 大学の支援割合(年収, 子の人数, 表) {
    var u = 表.university;
    var 多子 = (子の人数 >= (u.multi_child_min_children || 3));
    var 割合 = 0;
    for (var i = 0; i < u.tiers.length; i++) {
      if (年収 <= u.tiers[i].income_max) { 割合 = u.tiers[i].ratio; break; }
    }
    if (割合 === 0 && 多子 && u.multi_child_tier && 年収 <= u.multi_child_tier.income_max) {
      割合 = u.multi_child_tier.ratio;
    }
    return { ratio: 割合, multiChild: 多子 };
  }

  /**
   * その年、そのお子さん1人にかかる学費のうち、制度で助けてもらえる額。
   * @param {Object} 状況 { income, children, taxFree, withRequest }
   *        withRequest が false のときは、自分で申し込む制度を数えない。
   */
  function 学費の支援(年齢, プラン, 学費表, 状況) {
    if (!学費表 || !学費表.support) { return 0; }
    var 支 = 学費表.support, p = プラン || {};
    var b = 学費表.bands;
    var 帯 = null;
    for (var i = 0; i < b.length; i++) {
      if (年齢 >= b[i].from && 年齢 <= b[i].to) { 帯 = b[i]; break; }
    }
    if (!帯) { return 0; }
    var 選択 = p[帯.stage] || 帯.default;
    var 支援 = 0;

    if (帯.stage === 'high') {
      var hs = 支.high_school;
      /* 就学支援金は、ここでは引かない。
         学習費調査の金額は「保護者が実際に払った額」で、支援金のぶんはすでに引かれているため。
         （公立高校の授業料は年45,272円。法律上の授業料118,800円よりずっと少ない）
         重ねて引くと、高校が実際よりずっと安く見えてしまう。 */
      /* 奨学給付金（授業料以外に充てるお金）は、自分で申し込む必要があり、
         学習費調査にも反映されていないので、「制度活用」側にだけ入れる */
      if ((状況.grants ? 状況.grants.kyufukin : 状況.withRequest) && hs.kyufukin_tiers) {
        var 年収 = 状況.income || 0;
        for (var t = 0; t < hs.kyufukin_tiers.length; t++) {
          var 段 = hs.kyufukin_tiers[t];
          if (段.income_max > 0 && 年収 <= 段.income_max) {
            支援 += (選択 === 'private') ? 段.private : 段.public;
            break;
          }
        }
      }
        } else if (帯.stage === 'university' && 選択 !== 'none') {
      if (!(状況.grants ? 状況.grants.university : 状況.withRequest)) { return 0; }
      var u = 支.university;
      var 私立 = (選択.indexOf('private') === 0);
      var 自宅外 = (選択.indexOf('away') > 0);
      var 額 = 私立 ? u.full.private : u.full.national;
      var 判定 = 大学の支援割合(状況.income || 0, 状況.children || 0, 支);
      if (判定.ratio <= 0 && !(判定.multiChild && u.multi_child_waiver_no_income_limit)) { return 0; }
      /* 授業料の減免。お子さん3人以上なら収入の制限なく満額 */
      var 減免割合 = (判定.multiChild && u.multi_child_waiver_no_income_limit) ? 1 : 判定.ratio;
      支援 += Math.round(額.tuition * 減免割合);
      if (帯.entrance && 年齢 === 帯.from) {
        支援 += Math.round(額.entrance * 減免割合);
      }
      /* 給付型奨学金は、収入に応じた割合 */
      支援 += Math.round((自宅外 ? 額.grant_away : 額.grant_home) * 判定.ratio);
    }
    return 支援;
  }

  /** ある年に、お子さん全員でかかる学校のお金の合計 */
  function その年の学費(子の年齢たち, プラン一覧, 学費表, 状況) {
    var 合計 = 0, 支援合計 = 0, 明細 = [];
    (子の年齢たち || []).forEach(function (age, i) {
      var プラン = (プラン一覧 || [])[i];
      var v = 学費(age, プラン, 学費表);
      var 支 = 状況 ? Math.min(v, 学費の支援(age, プラン, 学費表, 状況)) : 0;
      if (v > 0) {
        明細.push({ index: i, age: age, amount: v, support: 支, net: v - 支,
          stage: 段階の名前(age, プラン, 学費表) });
      }
      合計 += v;
      支援合計 += 支;
    });
    return { total: 合計, support: 支援合計, net: Math.max(0, 合計 - 支援合計), detail: 明細 };
  }

  /** お子さんごとの金額を、行の合計にぴったり合わせる。
      1人ずつ12で割って丸めると、合計が行の金額と1円ずれることがあるため、
      最後のひとりで差を吸収する（表の「小計＝内訳の合計」を必ず成り立たせる）。 */
  function 端数をそろえる(明細, 合計, 欄) {
    if (!明細.length) { return 明細; }
    var 和 = 0;
    明細.forEach(function (x) { 和 += x[欄]; });
    var 差 = 合計 - 和;
    if (差 !== 0) { 明細[明細.length - 1][欄] += 差; }
    return 明細;
  }

  /** 学費の子ども別明細を、行の合計に合わせてそろえる。
      実負担ともとの額をそろえたあと、支援額はその差として出し直す
      （先に丸めた支援額を残すと、引き算が合わなくなる）。 */
  function 子ども別をそろえる(明細, 実負担合計, 総額合計) {
    端数をそろえる(明細, 実負担合計, 'amount');
    端数をそろえる(明細, 総額合計, 'gross');
    明細.forEach(function (x) {
      x.support = x.gross - x.amount;
      if (x.support < 0) { x.support = 0; x.gross = x.amount; }
    });
    return 明細;
  }

  /** その年齢のお子さんが通う学校の名前（「公立の中学校」など） */
  function 段階の名前(年齢, プラン, 学費表) {
    if (!学費表) { return null; }
    var b = 学費表.bands, p = プラン || {};
    for (var i = 0; i < b.length; i++) {
      if (年齢 >= b[i].from && 年齢 <= b[i].to) {
        var 選択 = p[b[i].stage] || b[i].default;
        var ch = b[i].choices.filter(function (c) { return c.value === 選択; })[0];
        return ch ? ch.label : b[i].label;
      }
    }
    return null;
  }

  /** 全部いちばん安い道（すべて公立・大学は国公立で自宅から）を選んだときのプラン */
  function いちばん安いプラン(学費表) {
    var p = {};
    (学費表.bands || []).forEach(function (b) { p[b.stage] = b.baseline || b.default; });
    return p;
  }

  /* ------------------------------------------------------------
   * 0歳から2歳の保育料（ひと月）
   *
   *   3歳から5歳は無償化されているので0円。
   *   0歳から2歳も、住民税が非課税の世帯は0円です。
   *   ここで使うのは「国が定めた上限額」。実際の保育料は、
   *   この範囲内で市区町村が決めるので、これより安いことが多いです。
   * ---------------------------------------------------------- */
  function 保育料(子の年齢たち, 年収, ひとり親か, 表) {
    if (!表 || !表.tiers) { return 0; }
    var 対象 = (子の年齢たち || []).filter(function (a) {
      return a >= 表.applies_from_age && a <= 表.applies_to_age;
    });
    if (!対象.length) { return 0; }

    var 段 = null;
    for (var i = 0; i < 表.tiers.length; i++) {
      var t = 表.tiers[i];
      if (t.income_max === null || 年収 <= t.income_max) { 段 = t; break; }
    }
    if (!段) { return 0; }
    var 基本 = ひとり親か ? 段.single_parent_amount : 段.amount;
    if (基本 <= 0) { return 0; }

    /* 小学校に上がる前のお子さんを、上から数えて2人目・3人目を軽くする。
       年収360万円未満のひとり親世帯は、2人目から0円。 */
    var 未就学 = (子の年齢たち || []).filter(function (a) { return a <= 5; })
      .slice().sort(function (a, b) { return b - a; });
    var m = 表.multi_child || {};
    var 低所得ひとり親 = (ひとり親か && m.single_parent_low_income_max &&
      年収 <= m.single_parent_low_income_max);

    var 合計 = 0, 軽減前 = 0, 明細 = [];
    (子の年齢たち || []).forEach(function (age, i) {
      if (age < 表.applies_from_age || age > 表.applies_to_age) { return; }
      /* 未就学の子のなかで、上から何番目か */
      var 順位 = 未就学.indexOf(age) + 1;
      var 割合 = 1;
      if (低所得ひとり親) {
        割合 = (順位 >= 2) ? 0 : 1;
      } else if (順位 >= 3) {
        割合 = (m.third_child_ratio != null) ? m.third_child_ratio : 0;
      } else if (順位 === 2) {
        割合 = (m.second_child_ratio != null) ? m.second_child_ratio : 0.5;
      }
      var 額 = Math.round(基本 * 割合);
      軽減前 += 基本;
      合計 += 額;
      明細.push({ index: i, age: age, amount: 額, gross: 基本, discount: 基本 - 額,
        rank: 順位, stage: '保育園・こども園（' + age + '歳児）' });
    });
    保育料.内訳 = { total: 合計, gross: 軽減前, discount: 軽減前 - 合計, detail: 明細 };
    return 合計;
  }

  /** 保育料の内訳（軽減前の額と、きょうだい軽減の額）を返す */
  function 保育料の内訳(子の年齢たち, 年収, ひとり親か, 表) {
    var 額 = 保育料(子の年齢たち, 年収, ひとり親か, 表);
    var 内 = 保育料.内訳 || { total: 額, gross: 額, discount: 0, detail: [] };
    return { total: 額, gross: 内.gross, discount: 内.discount, detail: 内.detail || [] };
  }

  /** その年、児童扶養手当の対象になる年齢のお子さんがいるか */
  /** 0歳から2歳のお子さんがいるか */
  function 対象の未就学児(年齢たち, 表) {
    if (!表) { return false; }
    return (年齢たち || []).some(function (a) {
      return a >= 表.applies_from_age && a <= 表.applies_to_age;
    });
  }

  function 対象の子がいるか(年齢たち, 児扶表) {
    return (年齢たち || []).some(function (a) { return a <= 児扶表.pay_upto_age; });
  }

  function 資産カーブ(入力, データ) {
    var sim = シミュレーション(入力, データ);
    if (!sim.years.length) { return null; }

    var 生活費 = Math.max(0, Math.floor(入力.livingCost || 0));
    var 学費表 = データ.tuition;
    var 成長表 = データ.living_cost_growth;
    var いまの子の年齢 = sim.years.length ? sim.years[0].childAges : [];
    var 子の人数 = (入力.children || []).length;
    var 児扶表 = データ.programs_by_id.jido_fuyo_teate.eligibility;
    var 児手表 = データ.programs_by_id.jido_teate.eligibility;
    var 非課税か = (給与所得(入力.myIncome) <= ((データ.training || {}).resident_tax_free_limit || 1350000));
    var プラン一覧 = 入力.plans || [];
    var 使用中 = {};
    (入力.usedPrograms || []).forEach(function (id) { 使用中[id] = true; });

    /* ひとり親控除があるときと、ないときの手取りの差（ひと月あたり） */
    var 控除の効果 = Math.floor(手取りめやす(入力.myIncome, true) / 12)
      - Math.floor(手取りめやす(入力.myIncome, false) / 12);
    var 控除が使える = 入力.isSingleParent
      && (給与所得(入力.myIncome) <= データ.programs_by_id.hitorioya_kojo.eligibility.income_ceiling);

    var 起点 = Math.floor(入力.currentSavings || 0);
    /* 生活防衛資金は「生活費の半年分」を目標の1本にする。
       3か月分から6か月分の幅を帯で見せると、グラフの線と紛れて読みにくいため。
       半年分は、金融広報中央委員会が示している目安とも一致する。 */
    var 防衛下限 = 生活費 * 3, 防衛上限 = 生活費 * 6;
    var 目標 = 防衛上限;

    /* 月ごとの並び。いちばん最初（month 0）は「いまの貯金」そのもの。
       グラフはこの並びで線を描くので、底をつく位置が月の精度で出る。 */
    var 月ごと = [];
    var 貯金いま = 起点, 貯金全部 = 起点;
    var 到達月 = null, 到達月いま = null, 赤字になる月 = null;
    var 床に当たる月 = null, 目標を割り直す月 = null;
    /* 「いまのまま」の線でいつ危なくなるか。警告の印は、こちらの線に打つ。
       （制度活用の線に打つと、「いま何が起きるのか」が伝わらないため） */
    var 赤字になる月いま = null, 床に当たる月いま = null;
    /* 借りられる上限（貸金業法の総量規制。年収の3分の1）。
       ここより下は、そもそも実在しない金額なので、線も目盛りもそこで止める。
       年収150万円の人に「マイナス500万円」の目盛りを見せても、
       そんなお金は借りられないので、意味のない数字になるため。 */
    var 床 = (データ.borrow_limit && 入力.myIncome > 0)
      ? -Math.floor(入力.myIncome * データ.borrow_limit.ratio) : null;



    var points = [], 学費の合計 = 0, いちばん安い学費の合計 = 0;
    var 学費の総額 = 0, 学費の支援合計 = 0;
    var 大学で赤字 = null;
    var 安いプラン = 学費表 ? いちばん安いプラン(学費表) : null;

    /* 【グラフの点の意味】
       points[i] は「いちばん下のお子さんが（末子+i）歳になった時点」の貯金です。
       だから points[0] は、入力していただいた貯金額そのもの（まだ1円も足していない状態）。
       そこから1年ぶん足したものが points[1]、という並びにします。
       （先に足してから点を置くと、グラフの左はしが1年後の残高になってしまうため） */
    sim.years.forEach(function (y, i) {
      var d = y.divorced;

      /* この年の、お子さん全員ぶんの学校のお金。
         学費を助ける制度は、収入が低い世帯ほど手厚い。
         これを入れないと「私立に行ったら終わり」という、実際とちがう絵になる。
           ・就学支援金は学校経由でほぼ全員が手続きするので、両方の線に入れる
           ・奨学給付金と修学支援新制度は自分で申し込むので「制度活用」側だけ */
      var 状況いま = { income: 入力.myIncome, children: 子の人数, taxFree: 非課税か,
        grants: {
          kyufukin: !!使用中.koukou_shugaku_shienkin,
          university: !!使用中.koutou_kyoiku_shugaku_shien
        } };
      var 状況全部 = { income: 入力.myIncome, children: 子の人数, taxFree: 非課税か,
        grants: { kyufukin: true, university: true } };
      var 学 = その年の学費(y.childAges, プラン一覧, 学費表, 状況いま);
      var 学全部 = その年の学費(y.childAges, プラン一覧, 学費表, 状況全部);
      var 安 = その年の学費(y.childAges, y.childAges.map(function () { return 安いプラン; }), 学費表, 状況全部);
      var 学費月いま = Math.round(学.net / 12);
      var 学費月全部 = Math.round(学全部.net / 12);
      /* お子さんが大きくなったぶん、生活費（の食費部分）がふえる */
      var 今年の生活費 = Math.round(生活費 * 生活費の倍率(いまの子の年齢, y.childAges, 成長表));

      /* 制度活用（使える制度をすべて使った場合） */
      var 全部の給付 = d.jidoFuyoTeate + d.jidoTeate + (控除が使える ? 控除の効果 : 0);
      /* いまのまま（もう使っていると答えたものだけ） */
      var いまの給付 = (使用中.jido_fuyo_teate ? d.jidoFuyoTeate : 0)
        + (使用中.jido_teate ? d.jidoTeate : 0)
        + ((使用中.hitorioya_kojo && 控除が使える) ? 控除の効果 : 0);

      /* 0歳から2歳の保育料（国が定めた上限額のめやす） */
      var 保育の内訳 = 保育料の内訳(y.childAges, 入力.myIncome, !!入力.isSingleParent, データ.childcare);
      var 今年の保育料 = 保育の内訳.total;
      var 土台 = d.total - d.jidoFuyoTeate - d.jidoTeate - (控除が使える ? 控除の効果 : 0)
        - 今年の生活費 - 今年の保育料;
      var 月収支全部 = 土台 + 全部の給付 - 学費月全部;
      var 月収支いま = 土台 + いまの給付 - 学費月いま;

      /* 家計のうちわけ。「なぜこの年に落ちるのか」を、あとから確かめられるようにする。
         手取りには、ひとり親控除のぶんがすでに入っているので、いったん外に出しておく。 */
      var 手取りのみ = d.takehome - (控除が使える ? 控除の効果 : 0);
      function うちわけ(全部か) {
        var 児扶 = 全部か ? d.jidoFuyoTeate : (使用中.jido_fuyo_teate ? d.jidoFuyoTeate : 0);
        var 児手 = 全部か ? d.jidoTeate : (使用中.jido_teate ? d.jidoTeate : 0);
        var 控除 = (控除が使える && (全部か || 使用中.hitorioya_kojo)) ? 控除の効果 : 0;
        var 学費 = 全部か ? 学費月全部 : 学費月いま;
        var 収入 = [
          { key: 'takehome', name: '手取り（給料から税と社会保険料を引いたもの）', amount: 手取りのみ },
          { key: 'jidoFuyoTeate', name: '児童扶養手当', amount: 児扶,
            reason: (児扶 === 0 ? (d.jidoFuyoTeateStatus === 'none'
              ? '所得が限度額をこえているため対象外'
              : (対象の子がいるか(y.childAges, 児扶表) ? 'まだ申請していない' : '対象の年齢のお子さんがいない')) : null) },
          { key: 'jidoTeate', name: '児童手当', amount: 児手,
            reason: (児手 === 0 ? (児童手当(y.childAges, 児手表).monthly > 0
              ? 'まだ申請していない' : '高校生年代までのお子さんがいない') : null) },
          { key: 'kojo', name: 'ひとり親控除で税が軽くなるぶん', amount: 控除,
            reason: (控除 === 0 ? (控除が使える ? 'まだ申告していない' : '所得が500万円をこえているため対象外') : null) },
          { key: 'childSupport', name: '養育費', amount: d.childSupport,
            reason: (d.childSupport === 0 ? '受け取っていない（取り決めをすると変わります）' : null) },
          { key: 'parentSupport', name: '親からの援助', amount: d.parentSupport,
            reason: (d.parentSupport === 0 ? 'なし、または終わったあと' : null) }
        ];
        /* 学費は、その線で実際に使っている数字をそのまま持たせる。
           表示のために別で計算し直すと、線と表がずれる（実際にずれていた）。 */
        var 学の元 = 全部か ? 学全部 : 学;
        var 支出 = [
          { key: 'living', name: '生活費（食費・光熱費など）', amount: 今年の生活費,
            baseline: 生活費, increase: 今年の生活費 - 生活費 },
          { key: 'housing', name: '住居費', amount: d.housing },
          { key: 'tuition', name: '学校にかかるお金（支援を引いたあと）', amount: 学費,
            gross: Math.round(学の元.total / 12), support: Math.round(学の元.total / 12) - 学費,
            children: 子ども別をそろえる(学の元.detail.map(function (x) {
              return { index: x.index, age: x.age, stage: x.stage,
                amount: Math.round(x.net / 12), gross: Math.round(x.amount / 12), support: 0 };
            }), 学費, Math.round(学の元.total / 12)) },
          { key: 'childcare', name: '保育料（0歳から2歳）', amount: 今年の保育料,
            gross: 保育の内訳.gross, discount: 保育の内訳.discount,
            children: 保育の内訳.detail.map(function (x) {
              return { index: x.index, age: x.age, stage: x.stage,
                amount: x.amount, gross: x.gross, discount: x.discount };
            }),
            reason: (今年の保育料 === 0 ? (対象の未就学児(y.childAges, データ.childcare)
              ? '住民税が非課税の世帯なので0円、または2人目以降で0円'
              : '3歳から5歳は無償化されているため0円') : null) }
        ];
        var 収入計 = 0, 支出計 = 0;
        収入.forEach(function (r) { 収入計 += r.amount; });
        支出.forEach(function (r) { 支出計 += r.amount; });
        return { income: 収入, expense: 支出, incomeTotal: 収入計, expenseTotal: 支出計,
          balance: 収入計 - 支出計 };
      }

      /* 生活防衛資金は「その年の生活費の半年分」。
         お子さんが大きくなると生活費が上がるので、この目標も上がっていく。 */
      var 今年の目標 = 今年の生活費 * 6;

      /* 月ごとの並びの、いちばん最初の1点（いまの貯金）を置く */
      if (i === 0) {
        月ごと.push({ month: 0, now: 貯金いま, all: 貯金全部, target: 今年の目標 });
        if (今年の目標 > 0 && 貯金全部 >= 今年の目標) { 到達月 = 0; }
        if (今年の目標 > 0 && 貯金いま >= 今年の目標) { 到達月いま = 0; }
      }

      /* まず、いまの時点の貯金を点として置く */
      points.push({
        offset: i,
        youngestAge: y.youngestAge,
        childAges: y.childAges,
        tuition: 学全部.net,
        tuitionGross: 学全部.total,
        tuitionSupport: 学全部.support,
        tuitionNow: 学.net,
        tuitionCheapest: 安.net,
        livingCost: 今年の生活費,
        childcare: 今年の保育料,
        safetyTarget: 今年の目標,
        monthlyNow: 月収支いま,
        monthlyAll: 月収支全部,
        breakdown: { all: うちわけ(true), now: うちわけ(false) },
        now: 貯金いま,
        all: 貯金全部
      });

      /* いちばん最後の点は「末子22歳の時点」なので、そこから先は積まない */
      if (i >= sim.years.length - 1) { return; }

      学費の合計 += 学全部.net;
      学費の総額 += 学全部.total;
      学費の支援合計 += 学全部.support;
      いちばん安い学費の合計 += 安.net;

      for (var m = 0; m < 12; m++) {
        貯金いま += 月収支いま;
        貯金全部 += 月収支全部;
        /* 次の年に入る月は、次の年の目標で見る */
        var 次の目標 = (m === 11 && sim.years[i + 1])
          ? Math.round(生活費 * 生活費の倍率(いまの子の年齢, sim.years[i + 1].childAges, 成長表)) * 6
          : 今年の目標;
        月ごと.push({ month: 月ごと.length, now: 貯金いま, all: 貯金全部, target: 次の目標 });
        var いま番号 = 月ごと.length - 1;
        if (到達月 === null && 次の目標 > 0 && 貯金全部 >= 次の目標) { 到達月 = いま番号; }
        if (到達月いま === null && 次の目標 > 0 && 貯金いま >= 次の目標) { 到達月いま = いま番号; }
        /* いちど届いたあとに、生活費が上がって届かなくなることもある */
        if (到達月 !== null && 目標を割り直す月 === null && 次の目標 > 0 && 貯金全部 < 次の目標
            && いま番号 > 到達月) { 目標を割り直す月 = いま番号; }
        if (赤字になる月 === null && 貯金全部 < 0) { 赤字になる月 = いま番号; }
        if (床 != null && 床に当たる月 === null && 貯金全部 <= 床) { 床に当たる月 = いま番号; }
        if (赤字になる月いま === null && 貯金いま < 0) { 赤字になる月いま = いま番号; }
        if (床 != null && 床に当たる月いま === null && 貯金いま <= 床) { 床に当たる月いま = いま番号; }
      }

      /* 大学に通う年で赤字になっていないか */
      if (大学で赤字 === null && 貯金全部 < 0 && 学全部.detail.some(function (x) { return x.age >= 18; })) {
        大学で赤字 = { youngestAge: sim.years[i + 1].youngestAge, offset: i + 1 };
      }
    });

    /* 赤字のときは、線をどこまで描くか。
       マイナスに入ってから3年ぶんだけ描き、その先は
       「このままの前提では成り立たない領域」として網かけにする。
       現実には借金を積み続けることはできず、その前に人は何かを変えるため、
       22歳まで直線でのばした金額を出すのは予測として不誠実だから。 */
    var 赤字の年 = null;
    for (var k = 0; k < points.length; k++) {
      if (points[k].all < 0) { 赤字の年 = k; break; }
    }

    var 借入上限 = 床, 上限に達する年 = null;
    if (借入上限 != null) {
      for (var b = 0; b < points.length; b++) {
        if (points[b].all <= 借入上限) { 上限に達する年 = b; break; }
      }
    }

    var 描くところまで = (赤字の年 === null) ? points.length - 1
      : Math.min(points.length - 1, 赤字の年 + 3);
    if (上限に達する年 !== null) {
      描くところまで = Math.min(描くところまで, 上限に達する年);
    }

    /* ひと月あたり、いくら足りないか（累積ではなく、これを主役にする） */
    var 足りない月額 = null;
    for (var q = 0; q < points.length; q++) {
      if (points[q].monthlyAll < 0) { 足りない月額 = -points[q].monthlyAll; break; }
    }

    var 十年 = 月ごと[Math.min(119, 月ごと.length - 1)];
    var 最後 = 月ごと[月ごと.length - 1];

    /* 伸びしろ（まだ使っていない制度が、ひと月いくらになるか） */
    var d0 = sim.years[0].divorced;
    var 伸びしろ = [];
    if (d0.jidoFuyoTeate > 0 && !使用中.jido_fuyo_teate) { 伸びしろ.push({ id: 'jido_fuyo_teate', monthly: d0.jidoFuyoTeate }); }
    if (d0.jidoTeate > 0 && !使用中.jido_teate) { 伸びしろ.push({ id: 'jido_teate', monthly: d0.jidoTeate }); }
    if (控除が使える && !使用中.hitorioya_kojo) { 伸びしろ.push({ id: 'hitorioya_kojo', monthly: 控除の効果 }); }

    /* 資格を取って抜けるルート（オプション） */
    sim.assetNow = points.map(function (pt) { return pt.now; });
    var 資格 = 資格ルート(入力, データ, sim);

    return {
      points: points,
      training: 資格,
      startSavings: 起点,
      livingCost: 生活費,
      safetyMin: 防衛下限,
      safetyMax: 防衛上限,
      safetyTarget: (月ごと.length ? 月ごと[0].target : 目標),
      alreadyReachedSafety: (到達月 === 0),
      alreadyAboveSafety: (到達月 === 0),
      monthly: 月ごと,
      reachMonths: 到達月,
      reachMonthsNow: 到達月いま,
      negativeFromMonthNow: 赤字になる月いま,
      goesNegativeNow: 赤字になる月いま !== null,
      hitsBorrowFloorAtMonthNow: 床に当たる月いま,
      hitsBorrowFloorNow: 床に当たる月いま !== null,
      fallsBelowSafetyAgainAtMonth: 目標を割り直す月,
      fallsBelowSafetyAgain: 目標を割り直す月 !== null,
      hitsBorrowFloorAtMonth: 床に当たる月,
      safetyTargetNow: (月ごと.length ? 月ごと[0].target : 0),
      safetyTargetEnd: (月ごと.length ? 月ごと[月ごと.length - 1].target : 0),
      negativeFromMonth: 赤字になる月,
      negativeFromOffset: 赤字の年,
      borrowFloor: 借入上限,
      borrowFloorLabel: (データ.borrow_limit ? データ.borrow_limit.ratio_label : null),
      hitsBorrowFloorAtOffset: 上限に達する年,
      hitsBorrowFloor: 上限に達する年 !== null,
      drawUntilOffset: 描くところまで,
      truncated: 描くところまで < points.length - 1,
      shortfallMonthly: 足りない月額,
      goesNegative: 赤字になる月 !== null,
      universityDeficit: 大学で赤字,
      monthlyBalance: points.length ? points[0].monthlyAll : 0,
      monthlyBalanceNow: points.length ? points[0].monthlyNow : 0,
      gaps: 伸びしろ,
      gapMonthly: 伸びしろ.reduce(function (a, b) { return a + b.monthly; }, 0),
      finalAll: 最後.all,
      finalNow: 最後.now,
      finalDiff: 最後.all - 最後.now,
      diffAtTenYears: 十年.all - 十年.now,
      tenYearsMonths: Math.min(120, 月ごと.length),
      totalMonths: 月ごと.length,
      tuitionTotal: 学費の合計,
      tuitionGrossTotal: 学費の総額,
      tuitionSupportTotal: 学費の支援合計,
      tuitionCheapestTotal: いちばん安い学費の合計,
      tuitionExtra: 学費の合計 - いちばん安い学費の合計
    };
  }

  /** 月数を「◯年◯か月」の日本語にする */
  function 年月表示(月数) {
    if (月数 == null) { return null; }
    var y = Math.floor(月数 / 12), m = 月数 % 12;
    if (y === 0) { return m + 'か月'; }
    if (m === 0) { return y + '年'; }
    return y + '年' + m + 'か月';
  }

  /* ------------------------------------------------------------
   * 6-3. 資格を取って抜けるルート
   *
   *   いまの収入のまま22歳まで進む線だけを見せると、
   *   収入が低い方には「詰み」しか見えません。
   *   でも実際には、資格を取って収入を上げる道があり、
   *   その間の生活費を支える給付金も用意されています。
   *   その道を、同じグラフの上に線として描きます。
   *
   *   モデル
   *     ・訓練中（既定2年）は、働ける時間が減るので就労収入が下がる（既定で半分）
   *     ・そのあいだ、高等職業訓練促進給付金が毎月入る
   *       （住民税が非課税の世帯は月10万円、課税世帯は月70,500円。
   *         修業期間の最後の12か月はさらに月4万円）
   *     ・修了したときに、修了支援給付金が1回入る
   *     ・修了後は、その資格の仕事の収入水準にうつる
   *
   *   給付金は非課税で、児童扶養手当の所得にも入らないものとして扱います。
   *   修了後の収入は全国の平均値であって、約束された金額ではありません。
   * ---------------------------------------------------------- */
  function 資格ルート(入力, データ, sim) {
    var t = 入力.training;
    if (!t || !t.enabled) { return null; }
    var 学費表 = データ.tuition;
    var 児扶表 = データ.programs_by_id.jido_fuyo_teate.eligibility;
    var 児手表 = データ.programs_by_id.jido_teate.eligibility;
    var 訓練表 = データ.training;
    if (!訓練表) { return null; }

    var 年数 = Math.max(1, Math.min(訓練表.years_max, Math.floor(t.years || 訓練表.years_default)));
    var 訓練中年収 = Math.max(0, Math.floor(
      (t.duringIncome != null) ? t.duringIncome : 入力.myIncome * (訓練表.during_income_ratio_default)));
    var 修了後年収 = Math.max(0, Math.floor(t.afterIncome || 0));

    /* 訓練中に住民税が非課税かどうか（ひとり親の非課税限度と、その年の所得で見る） */
    var 非課税 = (給与所得(訓練中年収) <= 訓練表.resident_tax_free_limit);
    var 給付月額 = 非課税 ? 訓練表.monthly_non_taxable : 訓練表.monthly_taxable;
    var 修了時 = 非課税 ? 訓練表.completion_non_taxable : 訓練表.completion_taxable;

    var 生活費 = Math.max(0, Math.floor(入力.livingCost || 0));
    var 成長表 = データ.living_cost_growth;
    var いまの子の年齢 = sim.years.length ? sim.years[0].childAges : [];
    var 養育費月 = 入力.divorced_childSupportMonthly || 0;
    var 親支援月 = 入力.parentSupportMonthly || 0;
    var 親の年齢 = 入力.parentAge || 0;
    var 親支援終了年齢 = (入力.parentSupportEndAge != null)
      ? 入力.parentSupportEndAge : データ.tables.parent_support_end_age_default;
    var 住居 = 入力.housingAfter || 0;
    var プラン一覧 = 入力.plans || [];

    var 貯金 = Math.floor(入力.currentSavings || 0);
    var points = [], 月ごと = [];
    var 床 = (データ.borrow_limit && 入力.myIncome > 0)
      ? -Math.floor(入力.myIncome * データ.borrow_limit.ratio) : null;
    var 床に当たる年 = null, 谷の底 = null, 赤字になる年 = null;
    var 床に当たる月 = null, 赤字になる月 = null;

    sim.years.forEach(function (y, i) {
      var 訓練中 = (i < 年数);
      var 年収 = 訓練中 ? 訓練中年収 : 修了後年収;

      var 給付 = 0;
      if (訓練中) {
        給付 = 給付月額 + ((i === 年数 - 1) ? 訓練表.final_year_bonus : 0);
      }

      var 児扶対象数 = y.childAges.filter(function (a) { return a <= 児扶表.pay_upto_age; }).length;
      var 児扶 = 児童扶養手当({
        salaryGross: 年収, childSupportYearly: 養育費月 * 12,
        dependents: 児扶対象数, childCount: 児扶対象数
      }, 児扶表);
      var 児手 = 児童手当(y.childAges, 児手表).monthly;
      var 手取り月 = Math.floor(手取りめやす(年収, true) / 12);
      var 親支援 = (親の年齢 && (親の年齢 + i) >= 親支援終了年齢) ? 0 : 親支援月;
      var 学の全体 = その年の学費(y.childAges, プラン一覧, 学費表, {
        income: 年収, children: (入力.children || []).length,
        taxFree: (給与所得(年収) <= (訓練表.resident_tax_free_limit || 1350000)),
        grants: { kyufukin: true, university: true }
      });
      var 学 = 学の全体.net, 学の総額 = 学の全体.total;

      /* お子さんが大きくなったぶん、生活費（の食費部分）がふえる。
         こちらの線も、本体のカーブと同じ扱いにそろえる。 */
      var 今年の生活費 = Math.round(生活費 * 生活費の倍率(いまの子の年齢, y.childAges, 成長表));
      var 保育の内訳2 = 保育料の内訳(y.childAges, 年収, true, データ.childcare);
      var 今年の保育料 = 保育の内訳2.total;
      var 月収支 = 手取り月 + 児扶.monthly + 児手 + 給付 + 養育費月 + 親支援
        - 住居 - 今年の生活費 - Math.round(学 / 12) - 今年の保育料;

      /* こちらも、貯めるより先に点を置く。
         いちばん左の点は「いまの貯金」で、3本の線がそこから分かれる形にする。 */
      points.push({
        offset: i, youngestAge: y.youngestAge,
        training: 訓練中, income: 年収, grant: 給付,
        livingCost: 今年の生活費,
        monthly: 月収支, all: 貯金,
        breakdown: {
          income: [
            { key: 'takehome', name: '手取り（' + (訓練中 ? '学校に通いながら働くぶん' : '資格を取ったあと') + '）',
              amount: 手取り月 },
            { key: 'grant', name: '高等職業訓練促進給付金', amount: 給付,
              reason: (給付 === 0 ? '学校に通い終わったあとなので、もう出ません' : null) },
            { key: 'jidoFuyoTeate', name: '児童扶養手当', amount: 児扶.monthly,
              reason: (児扶.monthly === 0 ? '所得が限度額をこえているため対象外' : null) },
            { key: 'jidoTeate', name: '児童手当', amount: 児手,
              reason: (児手 === 0 ? '高校生年代までのお子さんがいない' : null) },
            { key: 'childSupport', name: '養育費', amount: 養育費月, reason: (養育費月 === 0 ? '受け取っていない' : null) },
            { key: 'parentSupport', name: '親からの援助', amount: 親支援,
              reason: (親支援 === 0 ? 'なし、または終わったあと' : null) }
          ],
          expense: [
            { key: 'living', name: '生活費（食費・光熱費など）', amount: 今年の生活費,
              baseline: 生活費, increase: 今年の生活費 - 生活費 },
            { key: 'housing', name: '住居費', amount: 住居 },
            { key: 'tuition', name: '学校にかかるお金（支援を引いたあと）', amount: Math.round(学 / 12),
              gross: Math.round(学の総額 / 12), support: Math.round(学の総額 / 12) - Math.round(学 / 12),
              children: 子ども別をそろえる(学の全体.detail.map(function (x) {
                return { index: x.index, age: x.age, stage: x.stage,
                  amount: Math.round(x.net / 12), gross: Math.round(x.amount / 12), support: 0 };
              }), Math.round(学 / 12), Math.round(学の総額 / 12)) },
            { key: 'childcare', name: '保育料（0歳から2歳）', amount: 今年の保育料,
              gross: 保育の内訳2.gross, discount: 保育の内訳2.discount,
              children: 保育の内訳2.detail.map(function (x) {
                return { index: x.index, age: x.age, stage: x.stage,
                  amount: x.amount, gross: x.gross, discount: x.discount };
              }) }
          ]
        }
      });
      if (谷の底 === null || 貯金 < 谷の底) { 谷の底 = 貯金; }
      if (赤字になる年 === null && 貯金 < 0) { 赤字になる年 = i; }
      if (床 != null && 床に当たる年 === null && 貯金 <= 床) { 床に当たる年 = i; }

      if (i === 0) { 月ごと.push({ month: 0, all: 貯金 }); }
      if (i >= sim.years.length - 1) { return; }

      for (var m = 0; m < 12; m++) {
        貯金 += 月収支;
        /* 修了したその年の最後の月に、修了支援給付金が1回入る */
        if (m === 11 && i === 年数 - 1) { 貯金 += 修了時; }
        月ごと.push({ month: 月ごと.length, all: 貯金 });
        if (床 != null && 床に当たる月 === null && 貯金 <= 床) { 床に当たる月 = 月ごと.length - 1; }
        if (赤字になる月 === null && 貯金 < 0) { 赤字になる月 = 月ごと.length - 1; }
        if (谷の底 === null || 貯金 < 谷の底) { 谷の底 = 貯金; }
      }
    });

    /* 「いまのまま」を追い越す年。
       いちばん左の点は3本とも同じ（いまの貯金）なので、そこは数えない。 */
    var 逆転 = null;
    for (var k = 1; k < points.length; k++) {
      if (points[k].all >= sim.assetNow[k]) { 逆転 = k; break; }
    }
    /* 生活防衛資金にとどく年 */
    var 帯到達 = null;
    var 帯 = 生活費 * 6;   /* 生活防衛資金は生活費の半年分 */
    if (帯 > 0) {
      for (var q = 0; q < points.length; q++) {
        if (points[q].all >= 帯) { 帯到達 = q; break; }
      }
    }

    return {
      points: points,
      monthly: 月ごと,
      negativeFromMonth: 赤字になる月,
      hitsBorrowFloorAtMonth: 床に当たる月,
      years: 年数,
      duringIncome: 訓練中年収,
      afterIncome: 修了後年収,
      taxFree: 非課税,
      grantMonthly: 給付月額,
      grantFinalYearBonus: 訓練表.final_year_bonus,
      completionGrant: 修了時,
      crossoverOffset: 逆転,
      crossesOver: 逆転 !== null,
      reachSafetyOffset: 帯到達,
      valleyBottom: 谷の底,
      goesNegative: 赤字になる年 !== null,
      negativeFromOffset: 赤字になる年,
      hitsBorrowFloorAtOffset: 床に当たる年,
      hitsBorrowFloor: 床に当たる年 !== null,
      borrowFloor: 床,
      finalAll: points.length ? points[points.length - 1].all : 0
    };
  }

  /* ------------------------------------------------------------
   * 7. 制度の当てはまりを判定する（Stage 1）
   *    judgment_type が 'auto' のものだけ、入力から判定する。
   *    'check' のものは「窓口で確認」として、そのまま案内に回す。
   * ---------------------------------------------------------- */
  function 制度判定(入力, データ) {
    var out = [];
    var 児扶 = null;
    データ.programs.forEach(function (p) {
      var r = { program: p, status: 'check', label: '確認したいもの', note: '', amountText: '' };
      if (p.judgment_type === 'check') {
        out.push(r); return;
      }
      var e = p.eligibility || {};
      switch (p.id) {

        case 'jido_fuyo_teate': {
          if (!入力.isSingleParent) {
            r.status = 'unlikely'; r.label = '今は対象外の見込み';
            r.note = 'ひとり親になった場合に対象になり得ます。下の比較グラフでは、離婚した場合の額を見込んで計算しています。';
            break;
          }
          var j = 児童扶養手当({
            salaryGross: 入力.myIncome,
            childSupportYearly: (入力.childSupportMonthly || 0) * 12,
            dependents: 入力.eligibleChildCount,
            childCount: 入力.eligibleChildCount
          }, e);
          児扶 = j;
          if (j.status === 'none') { r.status = 'unlikely'; r.label = '対象外の見込み'; r.note = j.reason || ''; }
          else {
            r.status = 'likely';
            r.label = (j.status === 'full') ? '全部支給の可能性が高い' : '一部支給の可能性が高い';
            r.amountText = 'ひと月あたり およそ ' + 円(j.monthly) + '（年およそ ' + 円(j.monthly * 12) + '）';
            r.note = '判定に使った所得は およそ ' + 円(j.income) + '。全部支給の限度額 ' + 円(j.limits.full)
              + '／一部支給の限度額 ' + 円(j.limits.partial) + '（お子さん等の数 ' + (入力.eligibleChildCount) + '人として）。';
          }
          break;
        }

        case 'jido_teate': {
          var h = 児童手当(入力.children || [], e);
          if (h.monthly > 0) {
            r.status = 'likely'; r.label = '対象の可能性が高い';
            r.amountText = 'ひと月あたり ' + 円(h.monthly) + '（年 ' + 円(h.monthly * 12) + '）';
            r.note = '収入による制限はありません。受け取っていない場合は、さかのぼれる分に限りがあるので早めに窓口へ。';
          } else {
            r.status = 'unlikely'; r.label = '対象外の見込み';
            r.note = '高校生年代（18歳になった年度の3月31日）までのお子さんがいる場合が対象です。';
          }
          break;
        }

        case 'hitorioya_kojo': {
          var 合計所得 = 給与所得(入力.myIncome) + (入力.otherIncome || 0);
          if (入力.isSingleParent && 合計所得 <= e.income_ceiling && (入力.children || []).length > 0) {
            r.status = 'likely'; r.label = '対象の可能性が高い';
            var 効果 = Math.floor(概算節税(入力.myIncome, e));
            r.amountText = '税が 年およそ ' + 円(効果) + ' 軽くなる見込み';
            r.note = '勤め先の年末調整、または確定申告で申告します。申告していない年があれば、5年前までさかのぼって取り戻せます。';
          } else if (!入力.isSingleParent) {
            r.status = 'unlikely'; r.label = '今は対象外の見込み';
            r.note = 'ひとり親になった場合に対象になり得ます。';
          } else {
            r.status = 'unlikely'; r.label = '対象外の見込み';
            r.note = '合計所得が ' + 円(e.income_ceiling) + ' をこえていると使えません。';
          }
          break;
        }

        default:
          r.status = 'check'; r.label = '確認したいもの';
      }
      out.push(r);
    });
    return { results: out, jidoFuyoTeate: 児扶 };
  }

  /** ひとり親控除・寡婦控除による税の軽さのめやす（表示用の概算） */
  function 概算節税(額面, e) {
    var 課税前 = 給与所得(額面);
    var 社保 = Math.floor(額面 * 0.145);
    var 課税所得 = Math.max(0, 課税前 - 社保 - 基礎控除(課税前));
    if (課税所得 <= 0) { return 0; }
    var 所得税率 = 0.05;
    for (var i = 0; i < 所得税率表.length; i++) {
      if (課税所得 <= 所得税率表[i].upto) { 所得税率 = 所得税率表[i].rate; break; }
    }
    return Math.floor(e.deduction_income_tax * 所得税率 * 1.021 + e.deduction_resident_tax * 0.10);
  }

  /** 金額を「◯万◯千円」ではなく、読みやすい円表示にする */
  function 円(v) {
    var n = Math.round(v || 0);
    return n.toLocaleString('ja-JP') + '円';
  }

  /** 万円まるめの表示（グラフの目盛りなど） */
  function 万円(v) {
    return (Math.round((v / MAN) * 10) / 10) + '万円';
  }

  return {
    給与所得控除: 給与所得控除,
    給与所得: 給与所得,
    児童扶養手当の所得額: 児童扶養手当の所得額,
    児童扶養手当: 児童扶養手当,
    児童手当: 児童手当,
    手取りめやす: 手取りめやす,
    等価所得: 等価所得,
    シミュレーション: シミュレーション,
    資産カーブ: 資産カーブ,
    必要エネルギー: 必要エネルギー,
    生活費の倍率: 生活費の倍率,
    資格ルート: 資格ルート,
    学費: 学費,
    その年の学費: その年の学費,
    段階の名前: 段階の名前,
    保育料: 保育料,
    保育料の内訳: 保育料の内訳,
    学費の支援: 学費の支援,
    大学の支援割合: 大学の支援割合,
    いちばん安いプラン: いちばん安いプラン,
    年月表示: 年月表示,
    制度判定: 制度判定,
    限度額: 限度額,
    十円丸め: 十円丸め,
    円: 円,
    万円: 万円
  };
}));
