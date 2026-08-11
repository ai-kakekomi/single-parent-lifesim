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
    制度判定: 制度判定,
    限度額: 限度額,
    十円丸め: 十円丸め,
    円: 円,
    万円: 万円
  };
}));
