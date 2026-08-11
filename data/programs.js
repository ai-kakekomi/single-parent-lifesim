/* ============================================================
 * programs.js  制度データ（17件）。金額・所得制限限度額・出典URL・最終確認日は、すべてこのファイルにあります。
 * 制度改正が来たときは、ここの数字を直してください。直したら必ず自動チェック（test/run.js）を走らせてください。
 *
 *  ブラウザからも Node からも、同じこのファイルを読みます。
 *  （データを2か所に置くと必ずずれるので、1か所にまとめてあります）
 *  ファイルを直接ダブルクリックして開いても動くように、
 *  読み込むだけのプログラムの形にしてあります。中身はただのデータです。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.SPS_DATA_PROGRAMS = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
  "version": "1.0.0",
  "generated": "2026-08-11",
  "note": "全国共通の制度だけを収めています。お住まいの市区町村だけの制度は入っていません。",
  "tuition": {
    "note": "学校にかかるお金の、1年ぶんの目安です。すべて全国の平均値です。実際にかかる額は、地域や学校、習いごとの有無で大きく変わります。",
    "note_split": "小学校・中学校・高校の金額は、「学校そのものにかかるお金」（授業料・教材費・給食費など）と「塾・習いごとなど」（学校外活動費）に分けています。たとえば公立の小学校の年366,599円のうち、256,489円（7割）は塾や習いごとの全国平均です。",
    "note_extra_varies": "塾・習いごとの金額は、家庭によってまったく違います。文部科学省の調査でも「世帯の年間収入が増加するに連れて、おおむね支出が多い傾向がみられる」とされています。全国平均は収入の高い家庭に引っ張られるので、入力欄で自分の家に合った額に変えてください。0円にもできます。",
    "note_average": "ここに出している金額は、すべて平均値です。まん中の人の金額（中央値）ではありません。塾や習いごとにたくさんかける家庭が平均を押し上げるため、多くの家庭の実感より高めに出ます。",
    "note_kindergarten": "幼稚園・保育所・認定こども園は、3歳から5歳のクラスの利用料が無償になっているため、このツールでは0円として計算しています（0歳から2歳は住民税非課税世帯が対象）。ただし、給食の食材料費・通園送迎費・行事費は別にかかります。",
    "note_high_school": "高校の金額は、授業料をふくむ平均です。高等学校等就学支援金（公立で年118,800円、私立で年457,200円まで）が授業料にあてられるので、実際の負担はこの金額より軽くなります。申請しないと受け取れません。",
    "note_university": "大学の金額は、自宅から通う場合は「学費」だけ、ひとり暮らしの場合は「学費と生活費の合計」です。自宅から通う場合の食費などは、毎月の生活費のほうに入っているとみなして、二重に数えないようにしています。入学した年には、入学料も足しています。",
    "bands": [
      {
        "stage": "elementary", "label": "小学校", "from": 6, "to": 11,
        "default": "public", "baseline": "public",
        "costs": { "public": 366599, "private": 1741516 },
        "school_costs": { "public": 110110, "private": 1031849 },
        "extra_costs": { "public": 256489, "private": 709667 },
        "choices": [
          { "value": "public", "label": "公立の小学校", "yearly": 366599 },
          { "value": "private", "label": "私立の小学校", "yearly": 1741516 }
        ]
      },
      {
        "stage": "junior", "label": "中学校", "from": 12, "to": 14,
        "default": "public", "baseline": "public",
        "costs": { "public": 542450, "private": 1560359 },
        "school_costs": { "public": 186432, "private": 1137378 },
        "extra_costs": { "public": 356018, "private": 422981 },
        "choices": [
          { "value": "public", "label": "公立の中学校", "yearly": 542450 },
          { "value": "private", "label": "私立の中学校", "yearly": 1560359 }
        ]
      },
      {
        "stage": "high", "label": "高校", "from": 15, "to": 17,
        "default": "public", "baseline": "public",
        "costs": { "public": 596954, "private": 1179261 },
        "school_costs": { "public": 351523, "private": 832650 },
        "extra_costs": { "public": 245431, "private": 346611 },
        "choices": [
          { "value": "public", "label": "公立の高校", "yearly": 596954 },
          { "value": "private", "label": "私立の高校", "yearly": 1179261 }
        ]
      },
      {
        "stage": "university", "label": "大学", "from": 18, "to": 21,
        "default": "national_home", "baseline": "national_home",
        "costs": {
          "none": 0,
          "national_home": 639200, "national_away": 1800700,
          "private_home": 1399100, "private_away": 2689100
        },
        "entrance": { "none": 0, "national_home": 282000, "national_away": 282000, "private_home": 240365, "private_away": 240365 },
        "choices": [
          { "value": "national_home", "label": "国立・自宅から通う", "yearly": 639200 },
          { "value": "national_away", "label": "国立・ひとり暮らし", "yearly": 1800700 },
          { "value": "private_home", "label": "私立・自宅から通う", "yearly": 1399100 },
          { "value": "private_away", "label": "私立・ひとり暮らし", "yearly": 2689100 },
          { "value": "none", "label": "大学には進まない", "yearly": 0 }
        ]
      }
    ],
    "support": {
      "note": "学費を助けてくれる制度。低い収入の世帯ほど手厚くなるので、これを入れないと『私立に行ったら終わり』という、実際とちがう絵になります。",
      "high_school": {
        "note": "高校の学費については、就学支援金のぶんはすでに差し引かれています。この表の金額が、保護者が実際に払った額の平均だからです。",
        "shugaku_shienkin_already_deducted": true,
        "shugaku_shienkin_note": "高等学校等就学支援金（令和8年度は所得制限なし。公立118,800円・私立457,200円）は、学校が代わりに受け取って授業料と相殺します。子供の学習費調査の金額は保護者が実際に払った額なので、支援金のぶんはすでに引かれています（公立高校の授業料は年45,272円で、法律上の授業料118,800円よりずっと少ない）。だから、このツールでは重ねて引きません。引くと、高校が実際よりずっと安く見えてしまいます。",
        "kyufukin_needs_request": true,
        "kyufukin_note": "高校生等奨学給付金は、授業料以外（教科書・教材・修学旅行費など）に充てる返さなくてよいお金です。都道府県へ自分で申し込む必要があり、学習費調査の金額には反映されていないので、『制度活用』の線にだけ入れています。",
        "kyufukin_tiers": [
          { "label": "生活保護世帯", "income_max": 0, "public": 32300, "private": 52600 },
          { "label": "住民税非課税世帯（年収270万円程度まで）", "income_max": 2700000, "public": 143700, "private": 152000 },
          { "label": "年収270万〜380万円程度", "income_max": 3800000, "public": 47900, "private": 50670 },
          { "label": "年収380万〜490万円程度", "income_max": 4900000, "public": 35930, "private": 38000 }
        ],
        "kyufukin_expanded_note": "令和8年度から、年収270万〜490万円程度の世帯にも広がりました。",
        "source": {
          "law": "高等学校等就学支援金の支給に関する法律／高校生等奨学給付金（令和8年度）。就学支援金の支給限度額は 公立118,800円・私立（全日制）457,200円で、新制度では所得制限なし",
          "url": "https://www.mext.go.jp/a_menu/shotou/mushouka/index.htm",
          "url_detail": "https://www.mext.go.jp/content/20260616-mxt_shuukyo03-100002595_7.pdf",
          "url_kyufukin": "https://www.mext.go.jp/content/20260616-mxt_shuukyo03-100002595_18.pdf",
          "publisher": "文部科学省",
          "last_verified": "2026-08-11"
        }
      },
      "university": {
        "note": "高等教育の修学支援新制度。授業料・入学金の減免と、返さなくてよい給付型奨学金がセットです。自分で申し込む必要があるので、『制度活用』の線にだけ入れています。",
        "needs_request": true,
        "tiers": [
          { "id": 1, "label": "第Ⅰ区分（住民税非課税。年収の目安 約300万円まで）", "income_max": 3000000, "ratio": 1 },
          { "id": 2, "label": "第Ⅱ区分（年収の目安 約400万円まで）", "income_max": 4000000, "ratio": 0.6667 },
          { "id": 3, "label": "第Ⅲ区分（年収の目安 約460万円まで）", "income_max": 4600000, "ratio": 0.3333 }
        ],
        "multi_child_tier": { "id": 4, "label": "第Ⅳ区分（お子さん3人以上。年収の目安 約700万円まで）", "income_max": 7000000, "ratio": 0.25 },
        "multi_child_min_children": 3,
        "multi_child_waiver_no_income_limit": true,
        "multi_child_note": "お子さんが3人以上いる世帯は、収入の制限なく、授業料と入学金が下の金額まで免除されます（令和7年度から）。給付型奨学金のほうは収入に応じた割合です。",
        "full": {
          "national": { "grant_home": 350400, "grant_away": 800400, "tuition": 535800, "entrance": 282000 },
          "private": { "grant_home": 459600, "grant_away": 909600, "tuition": 700000, "entrance": 260000 }
        },
        "income_guide_note": "年収の目安は、世帯の人数などで変わります。正確には、住民税の課税標準額から計算した「支給額算定基準額」で判定されます。このツールの区分けは、あくまで目安です。",
        "gross_note": "大学の学費・生活費の金額は、学生全体の平均です。修学支援新制度を受けている人は一部なので、この平均はほぼ支援を受ける前の額と考えて、そこから支援額を引いています。",
        "source": {
          "law": "大学等における修学の支援に関する法律。令和8年度（2026年度）の満額支援は、大学の場合 国公立：授業料減免535,800円・入学金282,000円・給付型奨学金 月29,200円（自宅）／66,700円（自宅外）、私立：授業料減免700,000円・入学金260,000円・給付型奨学金 月38,300円（自宅）／75,800円（自宅外）",
          "url": "https://www.mext.go.jp/kyufu/index.htm",
          "url_detail": "https://www.mext.go.jp/content/20260206-mxt_gakushi01-100001062-1-2gakusei.pdf",
          "url_amount": "https://www.jasso.go.jp/shogakukin/about/kyufu/kingaku.html",
          "publisher": "文部科学省／日本学生支援機構",
          "last_verified": "2026-08-11"
        }
      },
      "elementary_junior": {
        "note": "小学校・中学校の就学援助は、金額も条件も市区町村ごとに違います。国の単価を一次資料で確かめられなかったので、このグラフでは差し引いていません。実際の負担は、ここに出る金額より軽くなります。",
        "modeled": false
      }
    },
    "source_school": {
      "law": "文部科学省「令和5年度 子供の学習費調査」の学習費総額（学校教育費・学校給食費・学校外活動費の合計）の平均値。令和6年12月25日公表、令和8年1月16日の訂正版",
      "url": "https://www.mext.go.jp/b_menu/toukei/chousa03/gakushuuhi/kekka/k_detail/mext_00002.html",
      "url_detail": "https://www.mext.go.jp/content/20260116-mxt_chousa01-000039333_3.pdf",
      "publisher": "文部科学省",
      "last_verified": "2026-08-11"
    },
    "source_university": {
      "law": "日本学生支援機構「令和6年度 学生生活調査」（令和8年3月31日公表）。自宅から通う場合は設置者別の「学費」、ひとり暮らしの場合は設置者別×居住形態別の「学生生活費」",
      "url": "https://www.jasso.go.jp/statistics/gakusei_chosa/2024.html",
      "url_detail": "https://www.jasso.go.jp/statistics/gakusei_chosa/__icsFiles/afieldfile/2026/03/25/data24_1_3.pdf",
      "publisher": "日本学生支援機構",
      "last_verified": "2026-08-11"
    },
    "source_entrance": {
      "law": "国立は「国立大学等の授業料その他の費用に関する省令」の標準額282,000円。私立は文部科学省「私立大学等の令和7年度入学者に係る学生納付金等調査結果」（令和7年12月26日公表）の入学料の平均額240,365円",
      "url": "https://www.mext.go.jp/a_menu/koutou/shinkou/07021403/1412031_00006.htm",
      "url_detail": "https://www.mext.go.jp/content/20251226-mxt_sigakujo-000046463_1.pdf",
      "publisher": "文部科学省",
      "last_verified": "2026-08-11"
    },
    "source_free_preschool": {
      "law": "子ども・子育て支援法（幼児教育・保育の無償化。令和元年10月1日施行）",
      "url": "https://www.cfa.go.jp/policies/kokoseido/mushouka/gaiyou/",
      "publisher": "こども家庭庁",
      "last_verified": "2026-08-11"
    }
  },
  "training": {
    "note": "資格を取って抜けるルートの計算に使う数字です。金額は高等職業訓練促進給付金の制度上の額で、こども家庭庁のページで確認しています。",
    "years_default": 2,
    "years_min": 1,
    "years_max": 4,
    "during_income_ratio_default": 0.5,
    "during_income_note": "学校に通うあいだは働ける時間が減るので、いまの年収の半分を既定にしています。これは制度で決まった数字ではなく、計算のための仮置きです。画面で変えられます。",
    "monthly_non_taxable": 100000,
    "monthly_taxable": 70500,
    "final_year_bonus": 40000,
    "completion_non_taxable": 50000,
    "completion_taxable": 25000,
    "resident_tax_free_limit": 1350000,
    "resident_tax_free_note": "訓練中に住民税が非課税かどうかは、その年の給与所得が135万円以下かどうかで見込んでいます。これは私たちが置いた仮定です。実際の判定は市区町村が行います。どちらになるかで、給付金は月100,000円と月70,500円に分かれます。",
    "after_income_note": "資格を取ったあとの年収は、ご自身で入れていただく見込みの数字です。このツールは、特定の職種の平均年収を示すことはしません。職種ごとの相場は、下の「仕事・収入の相談」の文章をAIに渡して調べてください。",
    "assumption_note": "この線は「こうなる」という予測ではありません。「この道を選ぶと、数字の上ではこう動く」という見取り図です。実際には、学校に通えるか、資格が取れるか、その仕事に就けるかで変わります。",
    "target_qualifications": "看護師・准看護師・保育士・介護福祉士・理学療法士・作業療法士・調理師・製菓衛生師などの国家資格のほか、デジタル分野の民間資格も対象です（6か月以上のカリキュラムであることが必要）。",
    "track_record": "この道を実際に渡っている人がいます。令和5年度は、この給付金を使って2,988人が資格を取りました（看護師945人、准看護師686人、保育士245人、美容師160人など）。そのうち2,105人が就職しています（看護師812人、准看護師359人、保育士191人、美容師108人など）。令和5年度の実施率は97.2%（884／909市区等）です。",
    "window_note": "この給付金を実施するのは、都道府県・市・福祉事務所を置いている町村です。お住まいが町村の場合は、都道府県（県の福祉事務所）が窓口になります。市・区にお住まいの場合は、お住まいの市・区が窓口です（ごく一部、実施していない市区があります）。どちらか分からないときは、市区町村のひとり親相談窓口で聞けば案内してもらえます。",
    "track_record_source": {
      "law": "こども家庭庁支援局家庭福祉課「ひとり親家庭等の支援について」（令和7年4月）高等職業訓練促進給付金の実績",
      "url": "https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/0a870592-1814-4b21-bf56-16f06080c594/cf899379/20250411_policies_hitori-oya_78.pdf",
      "publisher": "こども家庭庁",
      "last_verified": "2026-08-11"
    },
    "non_taxable_note": "この給付金は法律で非課税とされています。児童扶養手当の所得にも入りません。",
    "source": {
      "law": "母子及び父子並びに寡婦福祉法（高等職業訓練促進給付金等事業）",
      "url": "https://www.cfa.go.jp/policies/hitori-oya/syokugyou-kunren",
      "publisher": "こども家庭庁",
      "last_verified": "2026-08-11"
    }
  },
  "childcare": {
    "note": "0歳から2歳のお子さんの保育料です。3歳から5歳は無償化されているので0円。0歳から2歳も、住民税が非課税の世帯は0円です。",
    "applies_from_age": 0,
    "applies_to_age": 2,
    "note_municipality": "ここに出しているのは、国が定めた上限額です。実際の保育料は、この範囲内で市区町村が決めるので、これより安いことが多いです。",
    "note_single_parent": "ひとり親世帯には、国基準でも軽い額が定められています（年収330万円・360万円の区分で月9,000円）。このツールはひとり親家庭を想定しているので、その額を使っています。",
    "note_hours": "「保育標準時間」（フルタイム勤務向け）の額です。短い時間の区分だと、もう少し安くなります。",
    "tiers": [
      { "label": "生活保護世帯・住民税非課税世帯（年収の目安 約260万円まで）", "income_max": 2600000, "amount": 0, "single_parent_amount": 0 },
      { "label": "所得割課税額48,600円未満（年収の目安 約330万円まで）", "income_max": 3300000, "amount": 19500, "single_parent_amount": 9000 },
      { "label": "所得割課税額57,700円未満（年収の目安 約360万円まで）", "income_max": 3600000, "amount": 30000, "single_parent_amount": 9000 },
      { "label": "所得割課税額97,000円未満（年収の目安 約470万円まで）", "income_max": 4700000, "amount": 30000, "single_parent_amount": 30000 },
      { "label": "所得割課税額169,000円未満（年収の目安 約640万円まで）", "income_max": 6400000, "amount": 44500, "single_parent_amount": 44500 },
      { "label": "所得割課税額301,000円未満（年収の目安 約930万円まで）", "income_max": 9300000, "amount": 61000, "single_parent_amount": 61000 },
      { "label": "所得割課税額397,000円未満（年収の目安 1,130万円まで）", "income_max": 11300000, "amount": 80000, "single_parent_amount": 80000 },
      { "label": "所得割課税額397,000円以上", "income_max": null, "amount": 104000, "single_parent_amount": 104000 }
    ],
    "multi_child": {
      "note": "小学校に上がる前のお子さんが同時に保育を利用している場合、上の子から数えて2人目は半額、3人目からは0円です。",
      "second_child_ratio": 0.5,
      "third_child_ratio": 0,
      "single_parent_low_income_note": "年収360万円未満程度のひとり親世帯は、2人目から0円になり、年齢の制限もなくなります。",
      "single_parent_low_income_max": 3600000
    },
    "source": {
      "law": "子ども・子育て支援法にもとづく利用者負担額。こども家庭庁「幼児教育・保育の無償化 利用者負担」（令和7年10月時点）の「国が定める利用者負担の上限額基準」（3号認定・保育標準時間）",
      "quote": "新制度における利用者負担については、世帯の所得の状況その他の事情を勘案して定めることとされており、新制度施行前の利用者負担の水準を基に国が定める水準を限度として、実施主体である市町村が定めることとなる。",
      "url": "https://www.cfa.go.jp/policies/kokoseido/mushouka/gaiyou/",
      "url_detail": "https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/e4b817c9-5282-4ccc-b0d5-ce15d7b5018c/0cd8a3fc/20251029_policies_hoiku_169.pdf",
      "publisher": "こども家庭庁",
      "last_verified": "2026-08-11"
    }
  },
  "living_cost_growth": {
    "note": "お子さんが大きくなると食べる量がふえるので、そのぶん生活費もふえます。年齢ごとの必要なエネルギー量の比で、食費の部分だけを増やしています。",
    "food_share": 0.3132,
    "food_share_note": "母子世帯の消費支出のうち、食料が占める割合です。住居費と教育費をのぞいた金額（263,111円 − 住居27,559円 − 教育25,240円 = 210,312円）に対する食料65,841円の割合として出しています。生活費のうち、この割合の部分だけがお子さんの成長でふえるものとして計算します。",
    "energy_note": "厚生労働省が定める、1日に必要なエネルギー量（推定エネルギー必要量、身体活動レベル「ふつう」）の男女の平均です。この比を、食べる量の比として使っています。",
    "energy_bands": [
      { "from": 0, "to": 2, "kcal": 925, "label": "0〜2歳", "detail": "1〜2歳 男950・女900 kcal/日" },
      { "from": 3, "to": 5, "kcal": 1275, "label": "3〜5歳", "detail": "男1,300・女1,250 kcal/日" },
      { "from": 6, "to": 7, "kcal": 1500, "label": "6〜7歳", "detail": "男1,550・女1,450 kcal/日" },
      { "from": 8, "to": 9, "kcal": 1775, "label": "8〜9歳", "detail": "男1,850・女1,700 kcal/日" },
      { "from": 10, "to": 11, "kcal": 2175, "label": "10〜11歳", "detail": "男2,250・女2,100 kcal/日" },
      { "from": 12, "to": 14, "kcal": 2500, "label": "12〜14歳", "detail": "男2,600・女2,400 kcal/日" },
      { "from": 15, "to": 99, "kcal": 2575, "label": "15歳以上", "detail": "15〜17歳 男2,850・女2,300 kcal/日" }
    ],
    "adult_note": "18歳以上は、15〜17歳と同じ量として計算しています。報告書には成人の一覧の数値が載っていないためです（基礎代謝量から計算する形になっています）。少なめに見積もる側の扱いです。",
    "zero_age_note": "0歳は、1〜2歳と同じ量として扱っています。",
    "source_energy": {
      "law": "厚生労働省「日本人の食事摂取基準（2025年版）」策定検討会報告書（令和6年10月）の推定エネルギー必要量（身体活動レベル「ふつう」）。令和7年度から令和11年度まで使用",
      "url": "https://www.mhlw.go.jp/stf/newpage_44138.html",
      "url_detail": "https://www.mhlw.go.jp/content/10904750/001316472.pdf",
      "publisher": "厚生労働省",
      "last_verified": "2026-08-11"
    },
    "source_share": {
      "law": "総務省統計局「家計調査（家計収支編）2025年（令和7年）平均」詳細結果表 第3-6表の「母親と18歳未満の子供のみの世帯」",
      "url": "https://www.stat.go.jp/data/kakei/sokuhou/tsuki/index.html",
      "url_detail": "https://www.e-stat.go.jp/stat-search/files?tclass=000000330002&cycle=7&year=20250",
      "publisher": "総務省統計局",
      "last_verified": "2026-08-11"
    }
  },
  "living_cost_reference": {
    "note": "母子世帯（母親と18歳未満の子どもだけの世帯）の、1か月あたりの平均。比べるための参考にだけ使います。",
    "caution": "平均をとった世帯の数が70世帯と少ないため、年によって数字が動きます。あくまで参考の値です。世帯の人数（平均2.61人）や地域によっても大きく変わります。",
    "household": "母親と18歳未満の子供のみの世帯（平均世帯人員2.61人、うち18歳未満1.61人、世帯主の平均年齢43.3歳）",
    "monthly": {
      "cost-food": 65841,
      "cost-utility": 20972,
      "cost-comm": 10468
    },
    "labels": {
      "cost-food": "食料",
      "cost-utility": "光熱・水道",
      "cost-comm": "通信"
    },
    "not_available": ["cost-insurance", "cost-other"],
    "not_available_note": "保険料とそのほかは、統計の区分が違うので比べられません。",
    "total_consumption": 263111,
    "source": {
      "law": "総務省統計局「家計調査（家計収支編）2025年（令和7年）平均」詳細結果表 第3-6表「世帯類型別1世帯当たり1か月間の収入と支出」（用途分類）",
      "url": "https://www.stat.go.jp/data/kakei/sokuhou/tsuki/index.html",
      "url_detail": "https://www.e-stat.go.jp/stat-search/files?tclass=000000330002&cycle=7&year=20250",
      "publisher": "総務省統計局",
      "last_verified": "2026-08-11"
    }
  },
  "borrow_limit": {
    "note": "貸金業者からお金を借りられる上限。年収の3分の1です。グラフでこれ以上マイナスにならないのは、そこから先は実際には借りられないからです。",
    "ratio": 0.3333333333333333,
    "ratio_label": "年収の3分の1",
    "source": {
      "law": "貸金業法第13条の2（過剰貸付け等の禁止。いわゆる総量規制）",
      "quote": "貸金業者からの借入残高が年収の3分の1を超える場合、新規の借入れをすることができなくなります。",
      "note_exception": "銀行からの借入れや、住宅ローンなど一部の貸付けは総量規制の対象外です。",
      "url": "https://www.fsa.go.jp/policy/kashikin/kihon.html",
      "url_detail": "https://www.fsa.go.jp/policy/kashikin/qa.html",
      "publisher": "金融庁",
      "last_verified": "2026-08-11"
    }
  },
  "tables": {
    "simulate_until_youngest_age": 22,
    "parent_support_end_age_default": 75,
    "parent_support_end_age_min": 65,
    "parent_support_end_age_max": 90
  },
  "programs": [
    {
      "id": "jido_fuyo_teate",
      "name": "児童扶養手当",
      "category": "毎月お金が入るもの",
      "judgment_type": "auto",
      "repayment": "none",
      "summary": "ひとり親家庭などのお子さんのために、市区町村から毎月（実際は2か月分ずつ年6回）支払われるお金です。",
      "eligibility": {
        "pay_upto_age": 18,
        "pay_upto_age_note": "18歳になった年度の3月31日まで。心身に一定の障害があるお子さんは20歳未満まで。",
        "child_support_inclusion_rate": 0.8,
        "social_insurance_flat_deduction": 80000,
        "salary_income_flat_deduction": 100000,
        "amounts": {
          "first": { "full": 48050, "partial_max": 48040, "partial_min": 11340, "coefficient": 0.0264029 },
          "second": { "full": 11350, "partial_max": 11340, "partial_min": 5680, "coefficient": 0.0040719 },
          "third_plus": { "full": 11350, "partial_max": 11340, "partial_min": 5680, "coefficient": 0.0040719 }
        },
        "income_limits_recipient": {
          "per_extra_dependent": 380000,
          "rows": [
            { "dependents": 0, "full": 690000, "partial": 2080000, "full_salary_ref": 1520000, "partial_salary_ref": 3343000 },
            { "dependents": 1, "full": 1070000, "partial": 2460000, "full_salary_ref": 1900000, "partial_salary_ref": 3850000 },
            { "dependents": 2, "full": 1450000, "partial": 2840000, "full_salary_ref": 2443000, "partial_salary_ref": 4325000 },
            { "dependents": 3, "full": 1830000, "partial": 3220000, "full_salary_ref": 2986000, "partial_salary_ref": 4800000 },
            { "dependents": 4, "full": 2210000, "partial": 3600000, "full_salary_ref": 3529000, "partial_salary_ref": 5275000 },
            { "dependents": 5, "full": 2590000, "partial": 3980000, "full_salary_ref": 4013000, "partial_salary_ref": 5750000 }
          ]
        },
        "income_limits_others": {
          "note": "同居している親きょうだいなど、扶養義務者がいる場合は、その人の所得も見られます。",
          "per_extra_dependent": 380000,
          "rows": [
            { "dependents": 0, "limit": 2360000 },
            { "dependents": 1, "limit": 2740000 },
            { "dependents": 2, "limit": 3120000 },
            { "dependents": 3, "limit": 3500000 },
            { "dependents": 4, "limit": 3880000 },
            { "dependents": 5, "limit": 4260000 }
          ]
        }
      },
      "benefit_summary": "お子さん1人なら、全部支給で月48,050円。2人目からは1人につき月11,350円が足されます。所得が全部支給の限度額をこえると、そこから少しずつ減っていきます（一部支給）。",
      "how_to_apply": "お住まいの市区町村の、ひとり親支援・こども家庭の担当窓口",
      "cautions": [
        "受け取り始めてから5年（申請できる状態になってから7年）たつと、はたらいていることなどの届出をしないかぎり半分に減らされます。届出を忘れないでください。",
        "養育費を受け取っている場合、その8割が所得に足されて判定されます。",
        "同居している親やきょうだいの所得も見られます。同居の相談も含めて窓口へ。"
      ],
      "source": {
        "law": "児童扶養手当法／児童扶養手当法施行令（昭和36年政令第405号）第2条の4・第4条",
        "url": "https://www.cfa.go.jp/policies/hitori-oya/fuyou-teate",
        "url_detail": "https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/0a870592-1814-4b21-bf56-16f06080c594/0f69b7f8/20260424_policies_hitori-oya_112.pdf",
        "publisher": "こども家庭庁",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "jido_teate",
      "name": "児童手当",
      "category": "毎月お金が入るもの",
      "judgment_type": "auto",
      "repayment": "none",
      "summary": "高校生年代までのお子さんがいる家庭に支払われるお金です。2024年10月から、所得による制限がなくなりました。",
      "eligibility": {
        "pay_upto_age": 18,
        "pay_upto_age_note": "18歳になった年度の3月31日まで",
        "count_child_upto_age": 22,
        "count_child_upto_age_note": "第3子かどうかを数えるときは、22歳になった年度の3月31日までのお子さんを、年上から順に数えます。",
        "monthly": {
          "under3": 15000,
          "under3_third_plus": 30000,
          "age3_to_18": 10000,
          "age3_to_18_third_plus": 30000
        }
      },
      "benefit_summary": "3歳未満は月15,000円、3歳から高校生年代までは月10,000円。第3子からは年齢にかかわらず月30,000円です。",
      "how_to_apply": "お住まいの市区町村の子育て支援担当窓口（公務員の方は勤め先）",
      "cautions": [
        "さかのぼって受け取れる分にはかぎりがあります。まだ手続きしていない場合は急いでください。",
        "離婚して別居している場合は、お子さんと一緒に暮らしている側が受け取れます。手続きが必要です。"
      ],
      "source": {
        "law": "児童手当法（子ども・子育て支援法等の一部を改正する法律による改正。令和6年10月分から）",
        "url": "https://www.cfa.go.jp/policies/kokoseido/jidouteate/annai",
        "publisher": "こども家庭庁",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "hitorioya_kojo",
      "name": "ひとり親控除・寡婦控除（税が軽くなる）",
      "category": "税が軽くなるもの",
      "judgment_type": "auto",
      "repayment": "none",
      "summary": "ひとり親であることを申告すると、所得税と住民税が軽くなります。申告しないと自動では適用されません。",
      "eligibility": {
        "income_ceiling": 5000000,
        "income_ceiling_note": "合計所得金額が500万円以下（給与だけの方なら、額面でおよそ677万円以下）",
        "child_income_ceiling": 580000,
        "child_income_ceiling_note": "生計を一にするお子さんの総所得金額等が58万円以下（令和7年12月1日以降）",
        "deduction_income_tax": 350000,
        "deduction_resident_tax": 300000,
        "widow_deduction_income_tax": 270000,
        "widow_deduction_resident_tax": 260000,
        "not_de_facto_marriage": true
      },
      "benefit_summary": "所得税で35万円、住民税で30万円を、税をかける前の所得から差し引けます。手取りベースでは年におよそ5万円から8万円ほど変わります（収入により違います）。",
      "how_to_apply": "勤め先の年末調整（扶養控除等申告書）、または確定申告",
      "cautions": [
        "申告しそこねた年があっても、5年前までさかのぼって取り戻せます（更正の請求・還付申告）。",
        "事実上の婚姻関係にある方がいる場合は使えません。",
        "死別などでひとり親にあたらない場合は、寡婦控除（所得税27万円・住民税26万円）を確認してください。"
      ],
      "source": {
        "law": "所得税法第81条（ひとり親控除）・第80条（寡婦控除）、地方税法",
        "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1171.htm",
        "url_detail": "https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/144643_01.html",
        "publisher": "国税庁／総務省",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "shugaku_enjo",
      "name": "就学援助（小中学校の費用を助けてもらう）",
      "category": "学校のお金",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "小中学校の学用品費・給食費・修学旅行費などを、市区町村が援助してくれる制度です。",
      "eligibility": {
        "note": "誰が対象になるかは市区町村ごとに決めています。このツールでは判定できません。",
        "typical_standard": "生活保護の基準額に一定の倍率をかけた額を基準にしている市町村が79.2%（1,397／1,763）。そのうち1.3倍以下としているところが45.6%でいちばん多い。",
        "other_standards": "生活保護の停止・廃止（77.1%）、児童扶養手当を受けていること（75.9%）、市町村民税が非課税（74.5%）なども基準に使われています。"
      },
      "benefit_summary": "学用品費、体育の用具、新入学の学用品費、通学費、修学旅行費、校外活動費、医療費、給食費、クラブ活動費、卒業アルバム代、オンライン学習の通信費などが対象です。",
      "how_to_apply": "お子さんが通う学校、または市区町村の教育委員会",
      "cautions": [
        "児童扶養手当を受けていることを基準のひとつにしている市町村が約4分の3あります。手当を受けている方は、ほぼ確実に確認する価値があります。",
        "年度の途中でも受け付けている市町村が95.1%あります。「今年はもう遅い」とあきらめないでください。",
        "小中学校の入学前に前倒しで支給しているところが約87%あります。入学の前年の秋には確認を。",
        "給食費も対象です。食費の負担が重いときは、この就学援助と、こども食堂などの食の支援をあわせて考えてください。"
      ],
      "source": {
        "law": "学校教育法第19条",
        "url": "https://www.mext.go.jp/a_menu/shotou/career/05010502/017.htm",
        "url_detail": "https://www.mext.go.jp/content/20260708-mxt_shuugaku-000018788_1.pdf",
        "publisher": "文部科学省",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "koutou_shokugyo_kunren",
      "name": "高等職業訓練促進給付金",
      "category": "仕事・資格",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "ひとり親の方が資格を取るために学校に通う間、生活費として毎月お金を受け取れる制度です。",
      "eligibility": {
        "note": "児童扶養手当を受けている方、または同じくらいの所得水準の方が対象です。仕事や子育てと勉強の両立が難しいことも要件です。",
        "income_example": "こども1人の場合、年収385万円未満が目安（こども家庭庁ページの例示）",
        "course_min_months": 6,
        "monthly_non_taxable": 100000,
        "monthly_taxable": 70500,
        "final_year_bonus": 40000,
        "completion_non_taxable": 50000,
        "completion_taxable": 25000
      },
      "benefit_summary": "住民税が非課税の世帯なら月100,000円（課税世帯は月70,500円）。最後の1年間はさらに月40,000円が足されます。修了したときに50,000円（課税世帯25,000円）。",
      "how_to_apply": "お住まいの市区町村（町村にお住まいの方は都道府県）のひとり親支援窓口。必ず通い始める前に相談してください。",
      "cautions": [
        "看護師・准看護師・保育士・介護福祉士・理学療法士・作業療法士・調理師・製菓衛生師などの国家資格のほか、シスコシステムズ認定資格やLPI認定資格といったデジタル分野の民間資格も対象です。",
        "6か月以上のカリキュラムであることが必要です。",
        "この給付金は「これから通う人」のための制度です。通い始めてからでは間に合わないことがあります。"
      ],
      "source": {
        "law": "母子及び父子並びに寡婦福祉法（令和8年4月9日 こ支家第181号 こども家庭庁支援局長通知）",
        "url": "https://www.cfa.go.jp/policies/hitori-oya/syokugyou-kunren",
        "publisher": "こども家庭庁",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "jiritsu_shien_kyoiku",
      "name": "自立支援教育訓練給付金",
      "category": "仕事・資格",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "ひとり親の方が指定された講座を受けたとき、受講料の一部が戻ってくる制度です。",
      "eligibility": {
        "note": "20歳未満のお子さんを扶養しているひとり親の方で、自立支援プログラムの策定などを受けていることが要件です。",
        "rate": 0.6,
        "min_amount": 12001,
        "cap_general": 200000,
        "cap_specialized_per_year": 400000,
        "cap_specialized_total": 1600000
      },
      "benefit_summary": "受講にかかった費用の6割（下限12,001円）。一般教育訓練で上限20万円、専門実践教育訓練では修業年数×40万円で上限160万円。資格を取って就職した場合は8割5分（上限240万円）になる仕組みもあります。",
      "how_to_apply": "お住まいの市（町村にお住まいの方は都道府県）のひとり親支援窓口",
      "cautions": [
        "受ける前に、自治体から講座の指定を受ける必要があります。申し込んでしまってからでは対象外になります。必ず先に相談してください。",
        "雇用保険の教育訓練給付金を受けられる場合は、その分が差し引かれます。"
      ],
      "source": {
        "law": "母子及び父子並びに寡婦福祉法",
        "url": "https://www.cfa.go.jp/policies/hitori-oya/jiritsu-shien-kyuufukin",
        "publisher": "こども家庭庁",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "kokuho_gengaku",
      "name": "国民健康保険料の軽減・減免",
      "category": "毎月の負担を減らすもの",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "勤め先の健康保険ではなく国民健康保険に入っている方は、所得が低いと保険料が7割・5割・2割軽くなります。",
      "eligibility": {
        "note": "所得の基準で自動的に軽くなる部分（法定軽減）と、事情を申し立てて軽くしてもらう部分（条例減免）があります。金額や運用は市区町村ごとに違うため、このツールでは判定できません。",
        "involuntary_unemployment": "会社の都合で仕事を失った方（65歳未満で雇用保険の特定受給資格者・特定理由離職者）は、前年の給与所得を100分の30とみなして計算してもらえます。これは申請しないと適用されません。"
      },
      "benefit_summary": "軽減されると、年間の保険料が数万円単位で変わることがあります。会社都合の離職による軽減は、離職した日の翌日が属する月からその年度の翌年度末まで続きます。",
      "how_to_apply": "お住まいの市区町村の国民健康保険の窓口",
      "cautions": [
        "所得の基準による軽減は申請なしで適用されますが、そもそも所得の申告をしていないと適用されません。収入がなくても申告してください。",
        "会社都合で辞めた方の軽減は、自分から申請しないと受けられません。離職票を持って窓口へ。"
      ],
      "source": {
        "law": "国民健康保険法第77条（減免）、地方税法第703条の5（法定軽減）",
        "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryouhoken/iryouhoken01/index.html",
        "publisher": "厚生労働省",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "nenkin_menjo",
      "name": "国民年金保険料の免除・納付猶予",
      "category": "毎月の負担を減らすもの",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "国民年金の保険料を払うのが難しいとき、全額または一部を免除してもらえます。ひとり親には専用の基準があります。",
      "eligibility": {
        "note": "本人・世帯主・配偶者の所得がそれぞれ基準以下であることが必要です（納付猶予は世帯主の所得を見ません）。",
        "single_parent_threshold": 1350000,
        "single_parent_note": "ひとり親・寡婦・障害のある方は、前年の所得が135万円以下なら全額免除の対象になります（申請が必要）。",
        "full_exemption_formula": "（扶養親族等の数＋1）×35万円＋32万円",
        "student_formula": "128万円＋扶養親族等の数×38万円＋社会保険料控除等"
      },
      "benefit_summary": "全額免除を受けた期間も、将来受け取る年金額に2分の1が反映されます。「払えないから放っておく」と、この2分の1すら残りません。10年以内ならあとから納めることもできます。",
      "how_to_apply": "お住まいの市区町村の国民年金窓口、年金事務所、マイナポータル",
      "cautions": [
        "免除は自分から申請しないと受けられません。放置して未納にすると、老後の年金だけでなく、障害を負ったときの障害年金や、亡くなったときの遺族年金も受け取れなくなることがあります。",
        "2年1か月前までさかのぼって申請できます。",
        "納付猶予（50歳未満）は、受給資格の期間には入りますが、年金額には反映されません。"
      ],
      "source": {
        "law": "国民年金法第89条・第90条・第90条の2・第90条の3",
        "url": "https://www.nenkin.go.jp/service/kokunen/menjo/20150428.html",
        "publisher": "日本年金機構",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "koei_jutaku",
      "name": "公営住宅の優先入居",
      "category": "住まい",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "都道府県や市区町村が持っている住宅です。家賃が収入に応じて決まり、ひとり親世帯やDV被害者は入りやすくなる扱いがあります。",
      "eligibility": {
        "note": "収入基準も、ひとり親をどう優遇するかも、自治体の条例で決まります。このツールでは判定できません。",
        "income_standard_general": 158000,
        "income_standard_discretionary": 259000,
        "income_standard_note": "月収（政令月収）の全国的なめやすは158,000円。高齢者や小学校就学前のお子さんがいる世帯などは259,000円まで広げられます。収入の計算ではひとり親控除35万円などが引かれます。",
        "priority_types": "母子・父子世帯、DV被害者世帯などを含む8つの類型について、抽選の倍率を上げる・専用の戸数枠を設ける・点数をつけるといった方法で優先されます。"
      },
      "benefit_summary": "家賃は収入・立地・広さ・築年数などで決まります。事情によってはさらに減免を受けられます。民間の賃貸との差は、月に数万円になることがあります。",
      "how_to_apply": "都道府県・市区町村の住宅担当課（住宅供給公社が窓口のこともあります）",
      "cautions": [
        "募集の時期が決まっていることが多く、いつでも申し込めるとはかぎりません。年間の募集スケジュールを先に調べてください。",
        "DV被害を受けている方は、単身でも入居できる扱いがあります。まず配偶者暴力相談支援センターへ相談してください。"
      ],
      "source": {
        "law": "公営住宅法／公営住宅法施行令第6条、国住備第57号（平成25年6月27日 優先入居の取扱いについて）",
        "url": "https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000096.html",
        "url_detail": "https://www.cao.go.jp/bunken-suishin/doc/4-20-kokudokoutsu_yusennyukyo.pdf",
        "publisher": "国土交通省",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "fukushi_shikin_kashitsuke",
      "name": "母子父子寡婦福祉資金貸付金",
      "category": "借りる",
      "judgment_type": "check",
      "repayment": "loan",
      "repayment_note": "あとで返すお金です。ただし無利子、または年1.0%という低い利率です。カードローンや消費者金融より、はるかに有利です。",
      "summary": "ひとり親の方が、無利子または年1.0%という低い利率でお金を借りられる公的な制度です。12種類あります。",
      "eligibility": {
        "note": "貸付を受けられるかどうかは都道府県・指定都市・中核市が審査します。",
        "kinds": ["事業開始", "事業継続", "修学", "技能習得", "修業", "就職支度", "医療介護", "生活", "住宅", "転宅", "就学支度", "結婚"],
        "interest": "貸付金の種類と連帯保証人の有無によって、無利子または年利1.0%",
        "repayment": "一定の据置期間ののち、3年から20年"
      },
      "benefit_summary": "たとえば修学資金は、大学で月71,000円から146,000円。就学支度資金は私立大学等で580,000円から590,000円。私立高校の入学時は410,000円から420,000円。",
      "how_to_apply": "都道府県・指定都市・中核市のひとり親支援窓口（母子・父子自立支援員）",
      "cautions": [
        "これは「あとで返すお金」です。ただし無利子か年1.0%で、カードローンや消費者金融とは利率がまったく違います。手を出す前に、必ずこちらを先に相談してください。",
        "審査と手続きに時間がかかります。お金が要る時期の2〜3か月前には相談を。"
      ],
      "source": {
        "law": "母子及び父子並びに寡婦福祉法第13条ほか",
        "url": "https://www.mhlw.go.jp/web/t_doc?dataId=00tc4886&dataType=1&pageNo=1",
        "url_detail": "https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/0a870592-1814-4b21-bf56-16f06080c594/0f69b7f8/20260424_policies_hitori-oya_112.pdf",
        "publisher": "こども家庭庁／厚生労働省",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "koukou_shugaku_shienkin",
      "name": "高等学校等就学支援金・高校生等奨学給付金",
      "category": "学校のお金",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "高校の授業料を国が負担する仕組み（就学支援金）と、授業料以外の費用を助ける仕組み（奨学給付金）の2本立てです。",
      "eligibility": {
        "shugaku_shienkin_income_limit": "令和8年度から所得による制限はありません",
        "shugaku_shienkin_public": 118800,
        "shugaku_shienkin_private": 457200,
        "shugaku_shienkin_private_correspondence": 337200,
        "kyufukin_note": "奨学給付金のほうは所得で決まります。令和8年度から年収490万円程度の世帯まで対象が広がりました。",
        "kyufukin_amounts": {
          "seikatsuhogo": { "public": 32300, "private": 52600 },
          "hikazei_zennichi": { "public": 143700, "private": 152000 },
          "hikazei_tsushin": { "public": 50500, "private": 52100 },
          "kakudai_270_380_zennichi": { "public": 47900, "private": 50670 },
          "kakudai_380_490_zennichi": { "public": 35930, "private": 38000 }
        }
      },
      "benefit_summary": "授業料は公立で年118,800円、私立（全日制）で年457,200円まで国が持ちます。そのうえで、住民税が非課税の世帯なら、教科書代や通学費などにあてる奨学給付金が年143,700円（国公立・全日制）受け取れます。",
      "how_to_apply": "就学支援金は在学する高校を通じてオンライン申請システム（e-Shien）で。奨学給付金は都道府県（通常は高校を通じて）。",
      "cautions": [
        "就学支援金は所得制限がなくなりましたが、申請しないと受け取れません。入学時と毎年7月ごろの手続きを忘れないでください。",
        "奨学給付金は「授業料以外」のためのお金です。就学支援金とは別に申請が必要です。",
        "私立高校を選択肢から外す前に、必ずいまの支給額を確認してください。数年前の常識とは変わっています。"
      ],
      "source": {
        "law": "高等学校等就学支援金の支給に関する法律",
        "url": "https://www.mext.go.jp/a_menu/shotou/mushouka/index.htm",
        "url_detail": "https://www.mext.go.jp/content/20260408-mxt_shuukyo03-100002595_2.pdf",
        "publisher": "文部科学省",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "koutou_kyoiku_shugaku_shien",
      "name": "高等教育の修学支援新制度（返さなくてよい奨学金＋授業料の減免）",
      "category": "学校のお金",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "大学・短大・高専・専門学校の授業料や入学金を減らし、あわせて返さなくてよい奨学金を受け取れる制度です。",
      "misunderstanding_note": "昔の「奨学金＝借りたら返す」とは、別の制度です。この制度の給付型奨学金と授業料の減免は、返す必要がありません。「奨学金は借金だから」と進学をあきらめる前に、必ず確認してください。日本学生支援機構の貸与型（第一種・第二種）は、こちらとは別の、あとで返すお金です。",
      "eligibility": {
        "note": "世帯の収入と資産で区分が決まります。お子さんが3人以上いる世帯は、収入の制限なく授業料等の減免が受けられます。",
        "income_guide": {
          "full": "約300万円まで（住民税非課税）",
          "two_thirds": "約400万円まで",
          "one_third": "約460万円まで",
          "one_fourth": "約700万円まで（お子さん3人以上の世帯、私立の理工農系学部など）"
        },
        "grant_yearly_full": {
          "national_home": 350000, "national_away": 800000,
          "private_home": 460000, "private_away": 910000
        },
        "tuition_waiver_cap_university": { "national_tuition": 540000, "national_entrance": 280000, "private_tuition": 700000, "private_entrance": 260000 }
      },
      "benefit_summary": "住民税が非課税の世帯なら、私立大学で自宅外から通う場合、返さなくてよい奨学金が年91万円。あわせて授業料が年70万円まで、入学金が26万円まで免除されます。",
      "how_to_apply": "在学中の高校または大学等を通じて申し込みます（日本学生支援機構）。相談は 0570-666-301（平日9時〜20時）。",
      "cautions": [
        "申し込みは春（4月〜6月）と秋（9月〜11月）の年2回です。春に外れても秋にもう一度申し込めます。",
        "お子さんが3人以上いる世帯で減免だけが対象になる場合も、申し込みは必要です。",
        "「うちは大学は無理」と決める前に、必ずこの制度を確認してください。ひとり親家庭は満額の対象になることが多い制度です。"
      ],
      "source": {
        "law": "大学等における修学の支援に関する法律",
        "url": "https://www.mext.go.jp/a_menu/koutou/hutankeigen/",
        "url_detail": "https://www.jasso.go.jp/shogakukin/about/kyufu/__icsFiles/afieldfile/2026/01/27/r8_zaigaku_leaflet_2.pdf",
        "publisher": "文部科学省／日本学生支援機構",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "jukyo_kakuho_kyufukin",
      "name": "住居確保給付金",
      "category": "住まい",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "仕事を失ったり収入が大きく減ったりして家賃が払えないとき、家賃を自治体が大家さんに直接支払ってくれる制度です。",
      "eligibility": {
        "note": "離職・廃業から2年以内、または自分のせいではない休業などで収入が減ったこと。世帯の収入と金融資産にも基準があります（基準額は自治体ごと）。",
        "asset_test": "金融資産の合計が、基準額の6倍（100万円を超えない額）以下",
        "period": "原則3か月。延長して最長9か月",
        "job_search": "月4回以上の面談、月2回以上のハローワークでの職業相談、週1回以上の求人への応募",
        "moving_cost_support": "2025年4月から、家賃の安い住宅へ引っ越す費用の補助が新しくできました。就労中の方も対象になり得ます。家財の運搬費・礼金・仲介手数料・保証料・鍵の交換費用などが対象で、上限は引っ越し先の住宅扶助基準額の3倍。敷金は対象外です。"
      },
      "benefit_summary": "家賃額（住宅扶助基準額が上限）が原則3か月、最長9か月支給されます。大家さんや不動産会社の口座へ自治体が直接振り込みます。",
      "how_to_apply": "お住まいの地域の自立相談支援機関（全国の一覧 https://minna-tunagaru.jp/ichiran/ ）",
      "cautions": [
        "滞納してからでは選択肢が減ります。「来月あぶないかも」の段階で相談してください。",
        "2025年4月の法改正で、就労中でも家賃の安い住まいへの引っ越し費用を助けてもらえる仕組みができました。知られていない新しい制度です。"
      ],
      "source": {
        "law": "生活困窮者自立支援法第3条第3項（令和6年法律第21号による改正、令和7年4月1日施行）",
        "url": "https://corona-support.mhlw.go.jp/jukyokakuhokyufukin/index.html",
        "url_detail": "https://www.mhlw.go.jp/content/001506373.pdf",
        "publisher": "厚生労働省",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "seikatsu_hogo",
      "name": "生活保護",
      "category": "くらしの土台",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "収入が国の定める最低生活費に届かないとき、その差額が支給されます。ひとり親には母子加算があります。",
      "eligibility": {
        "note": "このツールでは金額の計算をしません。最低生活費はお住まいの地域・世帯の人数・年齢で変わるためです。該当するかどうかは福祉事務所で確認してください。",
        "structure": "8つの扶助（生活・住宅・教育・医療・介護・出産・生業・葬祭）",
        "additions": "母子加算（お子さん1人で月18,800円程度）、児童養育加算（18歳までのお子さん1人につき月10,190円程度）",
        "temporary_addition": "令和7年度・令和8年度は臨時の特例として1人あたり月1,500円が加算されています（令和8年10月から1年間は2,500円に引き上げられることが決まっています）"
      },
      "benefit_summary": "住まいの費用（住宅扶助）や医療費（医療扶助・自己負担なし）も含まれます。「車があるから無理」「持ち家だから無理」と自己判断せず、まず相談してください。",
      "how_to_apply": "お住まいの地域を担当する福祉事務所（市区は市区が、町村は都道府県が設置）",
      "cautions": [
        "生活保護は権利です。ためらう必要はありません。",
        "一時的に受けて、生活を立て直してから抜けることもできます。",
        "窓口で追い返されそうになったら、ひとりで行かず、支援団体に付き添いを頼んでください。"
      ],
      "source": {
        "law": "生活保護法",
        "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/seikatsuhogo/seikatuhogo/index.html",
        "url_detail": "https://www.mhlw.go.jp/content/12002000/001662704.pdf",
        "publisher": "厚生労働省",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "youikuhi",
      "name": "養育費の取り決めと、受け取れないときの手立て",
      "category": "養育費",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "養育費は、取り決めの「形」で、あとで取り立てられるかどうかが決まります。口約束はほぼ無力です。",
      "eligibility": {
        "note": "強制執行認諾文言のついた公正証書があれば、裁判をしなくてもすぐに給料や預金を差し押さえられます。この文言がないと差し押さえはできません。調停調書・審判書も同じ効力があります。",
        "enforcement": "財産開示手続や、第三者からの情報取得手続（預貯金・不動産・勤務先を裁判所を通じて調べる仕組み）が使えます。",
        "law_change_2026": "民法等の改正（令和6年法律第33号）が令和8年4月1日に施行されました。取り決めがなくても一定額を請求できる法定養育費の仕組みと、養育費に先取特権（他の債権より優先して回収できる権利）が新しくできています。"
      },
      "benefit_summary": "取り決めの形を「公正証書（強制執行認諾文言つき）」にしておくだけで、あとから取り立てられる可能性が大きく変わります。費用は数万円です。",
      "how_to_apply": "公証役場（公正証書）、家庭裁判所（調停）。相談は 法テラス・サポートダイヤル 0570-078374（平日9時〜21時、土曜9時〜17時）、養育費・親子交流相談支援センター 0120-965-419",
      "cautions": [
        "「もめたくないから」と口約束で済ませるのが、いちばん多い落とし穴です。",
        "すでに離婚していて取り決めがない場合でも、あとから請求できます。あきらめないでください。",
        "令和8年4月1日から、取り決めがない場合の法定養育費の仕組みが始まっています。相談窓口で最新の扱いを確認してください。"
      ],
      "source": {
        "law": "民法（令和6年法律第33号による改正、令和8年4月1日施行）、民事執行法",
        "url": "https://www.moj.go.jp/MINJI/minji07_00357.html",
        "url_detail": "https://www.moj.go.jp/MINJI/1-1-1-2-2-3.html",
        "publisher": "法務省",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "azukesaki",
      "name": "ファミリー・サポート・センター／病児保育／ショートステイ",
      "category": "預ける・助けてもらう",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "子どもを一時的に預けたり、送り迎えを頼んだりできる仕組みです。判定はしません。存在を知っておいてください。",
      "eligibility": {
        "note": "いずれも市区町村が実施主体です。あるかないか、いくらかかるかは地域によって違います。",
        "family_support": "地域の会員どうしの助け合いの仕組み。保育所への送り迎え、放課後の預かりなど。病児対応・緊急対応・ひとり親家庭への対応も要綱に位置づけられています。",
        "byoji_hoiku": "病児対応型・病後児対応型・体調不良児対応型・訪問型・送迎対応の5つの型があります。",
        "short_stay": "保護者の病気などで一時的に家庭で育てるのが難しいとき、児童養護施設などで数日間預かってもらえます（子育て短期支援事業）。"
      },
      "benefit_summary": "「熱を出したら仕事を休むしかない」を避けるための備えです。使う予定がなくても、先に登録だけしておくのが実践的です。",
      "how_to_apply": "お住まいの市区町村の子育て支援担当課",
      "cautions": [
        "ファミリー・サポート・センターも病児保育も、事前の登録・面談が必要なことがほとんどです。必要になってからでは間に合いません。",
        "ショートステイは「親が倒れたとき」の命綱です。ひとり親の方はとくに、使える施設を先に確認しておいてください。"
      ],
      "source": {
        "law": "児童福祉法（子育て援助活動支援事業・病児保育事業・子育て短期支援事業）",
        "url": "https://www.cfa.go.jp/policies/kosodateshien/family-support",
        "url_detail": "https://www.cfa.go.jp/policies/kosodateshien/jido-short",
        "publisher": "こども家庭庁",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "shoku_shien",
      "name": "食の支援（こども食堂・フードバンク・フードパントリー）",
      "category": "くらしの土台",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "食事や食材を、無料または安く受け取れる場所です。制度の申請ではないので、思い立った日に行けます。",
      "eligibility": {
        "note": "あるかないか、だれが使えるかは地域ごとに違います。このツールでは判定しません。多くのこども食堂は、だれでも来ていい形にしています。",
        "kodomo_shokudo": "こども食堂。地域の人が運営し、こどもや保護者が集まって食事をする場所です。国は「地域こどもの生活支援強化事業」として、年間を通じた食事の提供や、文房具・生理用品などのこども用品の提供を支援しています。",
        "takushoku_pantry": "こども宅食・フードパントリー。家まで食品を届ける形や、決まった日に食品を受け取りに行く形です。長期の休みの時期に集中して行われることもあります。",
        "food_bank": "フードバンク。農林水産省の説明では「食品関連事業者その他の者から未利用食品の寄附を受けて、こども食堂、こども宅食、生活困窮者、福祉施設等に未利用食品を無償で提供する」団体です。農林水産省が「フードバンクオープンリスト」を公開しており、令和8年7月時点で340団体が載っています。",
        "count": "こども食堂は全国に12,602か所あります（2025年度・認定NPO法人 全国こども食堂支援センター・むすびえの調査。2025年12月公表）。公立の小学校・義務教育学校の数の約7割にあたります。",
        "search": "むすびえのサイトから、近くのこども食堂を探せます（https://musubie.org/search）。",
        "kyushoku": "学校の給食費は、就学援助でまかなえることがあります。食費の負担を減らす手としては、こちらのほうが金額が大きくなります。"
      },
      "benefit_summary": "食費の負担が減ります。申請も審査もいらない場所がほとんどで、行けばその日から使えます。食事だけでなく、文房具や生理用品を配っているところもあります。",
      "how_to_apply": "お住まいの市区町村の子育て支援担当課、または社会福祉協議会に「近くのこども食堂やフードパントリーを教えてください」と聞くのがいちばん早いです。むすびえのサイト（https://musubie.org/search）でも探せます。フードバンクは、農林水産省の「フードバンクオープンリスト」から地域の団体をたどれます。",
      "cautions": [
        "「困っている人だけが行く場所」ではありません。多くのこども食堂は、地域のだれでも来ていい場所として開かれています。気がねはいりません。",
        "こどもの食事の心配は、学校の給食費とセットで考えてください。給食費は就学援助の対象になります。",
        "開催日が月に1回や2回のところが多いので、先に日程を調べておくと使いやすくなります。",
        "全国に12,602か所あります。小学校の数の約7割にあたる数なので、近くにある可能性は高いです。"
      ],
      "source": {
        "law": "児童福祉法にもとづく「地域こどもの生活支援強化事業」（こども食堂・こども宅食・フードパントリー等への支援）、食品ロスの削減の推進に関する法律（フードバンク）",
        "url": "https://www.cfa.go.jp/policies/kodomonohinkon/seikatsushien/",
        "url_detail": "https://www.maff.go.jp/j/syouan/access/index.html",
        "url_food_bank_list": "https://www.maff.go.jp/j/syouan/access/index.html",
        "url_search": "https://musubie.org/search",
        "search_publisher": "認定NPO法人 全国こども食堂支援センター・むすびえ（民間団体）",
        "publisher": "こども家庭庁／農林水産省",
        "last_verified": "2026-08-11"
      }
    },
    {
      "id": "dv_support",
      "name": "DVから離れるための仕組み（住民票の閲覧制限・保護命令・相談窓口）",
      "category": "身の安全",
      "judgment_type": "check",
      "repayment": "none",
      "summary": "暴力から離れるときに、居場所を知られないようにする手立てと、法律で相手を近づけない手立てがあります。",
      "eligibility": {
        "note": "まず相談してください。手続きの多くは、警察や配偶者暴力相談支援センターへの相談が前提になります。",
        "shien_sochi": "住民基本台帳の閲覧等制限（DV等支援措置）。住民票や戸籍の附票のある市区町村へ申し出ます。警察や支援センターに相談したうえで申出書を提出し、関係機関への意見照会を経て開始されます。期間は1年で、終了1か月前から延長できます。",
        "hogo_meirei": "保護命令は地方裁判所へ書面で申し立てます。2024年4月施行の改正で、自由・名誉・財産への加害の告知（精神的な暴力）も対象になり、接近禁止命令の期間が6か月から1年に延び、罰則も2年以下の拘禁刑・200万円以下の罰金に引き上げられました。連続したSNS送信、深夜（22時〜6時）の送信、性的画像の送信、無断でのGPS位置情報の取得も禁止の対象です。",
        "centers": "配偶者暴力相談支援センターは全国327か所（令和8年6月19日現在。うち市町村設置155か所）"
      },
      "benefit_summary": "住民票の閲覧制限をかけると、相手があなたの住所を役所で調べることができなくなります。保護命令が出れば、近づくこと自体が犯罪になります。",
      "how_to_apply": "DV相談ナビ #8008（はれれば）／DV相談＋ 0120-279-889（24時間）／警察相談専用電話 #9110／お住まいの市区町村（住民票の閲覧制限）／地方裁判所（保護命令）",
      "cautions": [
        "引っ越しても、住民票を移すと相手に居場所が分かることがあります。移す前に必ず閲覧制限の相談をしてください。",
        "証拠（けがの写真、診断書、録音、メッセージ）は、安全な場所に残しておいてください。",
        "この画面は右上のボタンでいつでも消せます。"
      ],
      "source": {
        "law": "配偶者からの暴力の防止及び被害者の保護等に関する法律（令和6年4月1日施行の改正を含む）、住民基本台帳事務におけるDV等支援措置",
        "url": "https://www.gender.go.jp/policy/no_violence/dv_navi/index.html",
        "url_detail": "https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/dv_shien.html",
        "publisher": "内閣府男女共同参画局／総務省",
        "last_verified": "2026-08-11"
      }
    }
  ]
};
}));
