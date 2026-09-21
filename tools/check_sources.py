# -*- coding: utf-8 -*-
"""税と制度の数字の「出どころ」を取りに行って、前回から変わったかを確かめる。

    python tools/check_sources.py            # 取得して、前回の控え（tools/snapshots/）と比べる
    python tools/check_sources.py --show     # 取得した表を画面にも出す

このアプリの税の表や制度の金額は、官公庁のページを人が読んで写したものです。
公式のAPIは無いので、「変わったことに気づく」ところだけを機械に任せます。

  ・やること   : ページを取得し、表（結合セルも展開）と基準日を文字にして、前回の控えと比べる
  ・やらないこと: アプリの数字を自動で書きかえること
                  （ページの作りが変わったとき、間違った数字が黙って入るのが一番こわいため。
                    変わっていたら、表を目で見て、人とAIで js/engine.js や data/programs.js を直す）

税制改正は年1回（12月に大綱、4月と12月に施行）。年に数回走らせれば足ります。
追加のパッケージは要りません（PDFだけは pypdf があれば中身も比べます。無ければURLだけ出します）。
"""
import difflib
import html
import io
import os
import re
import sys
import urllib.request

# 出どころの一覧。where は、その数字がアプリのどこに入っているか。
SOURCES = [
    {
        "name": "nta_1199_kiso_kojo",
        "title": "国税庁 No.1199 基礎控除",
        "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm",
        "where": "js/engine.js の 基礎控除表",
    },
    {
        "name": "nta_1410_kyuyo_shotoku_kojo",
        "title": "国税庁 No.1410 給与所得控除",
        "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm",
        "where": "js/engine.js の 給与所得控除表（令和10年分以後の表が載ったら r10 を足す。issue #5）",
    },
    {
        "name": "nta_1171_hitorioya_kojo",
        "title": "国税庁 No.1171 ひとり親控除",
        "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1171.htm",
        "where": "data/programs.js の hitorioya_kojo（控除額・本人と子の所得要件）",
    },
    {
        "name": "mext_shiryo6_shugaku_shien",
        "title": "文部科学省 修学支援新制度 資料6（所得に関する要件と目安年収）",
        "url": "https://www.mext.go.jp/content/20250425-mxt_gakushi01_100001055_08.pdf",
        "index_url": "https://www.mext.go.jp/a_menu/koutou/hutankeigen/1409388.htm",
        "where": "js/engine.js の 修学支援の基準（100円・25,600円・51,300円・154,500円）と、test/run.js の目安年収",
        "pdf": True,
    },
]

HERE = os.path.dirname(os.path.abspath(__file__))
SNAP = os.path.join(HERE, "snapshots")
UA = {"User-Agent": "Mozilla/5.0 (single-parent-lifesim check_sources)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


def strip(t):
    return re.sub(r"\s+", "", html.unescape(re.sub(r"<[^>]+>", "", t)))


def expand_table(table_html):
    """rowspan / colspan を展開して、行ごとの文字にする。
    結合セルをそのまま平らに読むと、どの年分の数字なのかを読み違える（実際に読み違えた）。"""
    grid = {}
    for r, row in enumerate(re.findall(r"<tr.*?</tr>", table_html, re.S)):
        c = 0
        for attrs, body in re.findall(r"<t[dh]([^>]*)>(.*?)</t[dh]>", row, re.S):
            while (r, c) in grid:
                c += 1
            rs = int((re.search(r'rowspan="?(\d+)', attrs) or [0, 1])[1])
            cs = int((re.search(r'colspan="?(\d+)', attrs) or [0, 1])[1])
            for i in range(rs):
                for j in range(cs):
                    grid[(r + i, c + j)] = strip(body)
            c += cs
    if not grid:
        return []
    rows = max(k[0] for k in grid) + 1
    cols = max(k[1] for k in grid) + 1
    return [" | ".join(grid.get((r, c), "") for c in range(cols)) for r in range(rows)]


def html_to_text(raw):
    s = raw.decode("utf-8", "ignore")
    i = s.find('id="bodyArea"')
    body = s[i:] if i >= 0 else s
    # コメントにされた古い表（平成の年分など）は、比べる対象から外す
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    out = []
    m = re.search(r"[\[［]([^\]］]*現在法令等)[\]］]", body)
    out.append("基準日: " + (m.group(1) if m else "（見つからず。ページの作りが変わった可能性）"))
    tables = re.findall(r"<table.*?</table>", body, re.S)
    out.append("表の数: %d" % len(tables))
    for n, t in enumerate(tables, 1):
        out.append("")
        out.append("--- 表%d ---" % n)
        out.extend(expand_table(t))
    # 表の外に書いてある金額（ひとり親控除の要件など）も拾う
    plain = re.sub(r"<(script|style).*?</\1>", "", body, flags=re.S)
    plain = re.sub(r"</(p|li|h\d|tr|dd|dt)>", "\n", plain)
    plain = html.unescape(re.sub(r"<[^>]+>", "", plain))
    lines = [re.sub(r"[ \t\r　]+", " ", x).strip() for x in plain.split("\n")]
    money = [x for x in lines if re.search(r"[0-9０-９,，]+万?円", x) and len(x) < 200]
    out.append("")
    out.append("--- 金額が出てくる文 ---")
    seen = set()
    for x in money:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return "\n".join(out) + "\n"


def pdf_to_text(raw):
    try:
        import pypdf  # 任意
    except ImportError:
        return None
    reader = pypdf.PdfReader(io.BytesIO(raw))
    return "\n".join((p.extract_text() or "") for p in reader.pages) + "\n"


def main():
    show = "--show" in sys.argv
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if not os.path.isdir(SNAP):
        os.makedirs(SNAP)
    changed = []
    for src in SOURCES:
        print("■ " + src["title"])
        print("  " + src["url"])
        try:
            raw = fetch(src["url"])
        except Exception as e:  # 取れなかったことも、大事な知らせ
            print("  ！取得できませんでした: %s" % e)
            if src.get("index_url"):
                print("    PDFのURLは年度で変わります。ここから新しいURLを探してください: " + src["index_url"])
            changed.append(src)
            print()
            continue
        text = pdf_to_text(raw) if src.get("pdf") else html_to_text(raw)
        if text is None:
            print("  （pypdf が無いので、PDFの中身は比べていません。 pip install pypdf で入ります）")
            print()
            continue
        path = os.path.join(SNAP, src["name"] + ".txt")
        old = io.open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if old is None:
            print("  はじめての取得です。控えを作りました: tools/snapshots/%s.txt" % src["name"])
        elif old == text:
            print("  変わっていません")
        else:
            print("  ★ 前回から変わっています。アプリの次の場所を見直してください:")
            print("     " + src["where"])
            for line in difflib.unified_diff(old.splitlines(), text.splitlines(), "前回", "今回", lineterm="", n=0):
                if not line.startswith(("---", "+++", "@@")):
                    print("     " + line)
            changed.append(src)
        io.open(path, "w", encoding="utf-8", newline="\n").write(text)
        if show:
            print(text)
        print()
    if changed:
        print("見直しが要るもの: %d 件。直したら npm test を通し、控え（tools/snapshots/）もいっしょにコミットしてください。" % len(changed))
    else:
        print("どの出どころも、前回から変わっていません。")


if __name__ == "__main__":
    main()
