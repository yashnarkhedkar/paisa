"""IDFC FIRST Bank savings statement (consolidated statement PDF).

Transactions sit in a ruled grid: column edges come from the header row's vertical rules,
row edges from the horizontal rules under the narration column. Narrations wrap above and
below the date line, so words are bucketed by grid cell, not by nearest text line.
"""
import re
from datetime import datetime

DATE = re.compile(r"^(\d\d \w{3} \d\d) \d\d:\d\d$")
SUMMARY = re.compile(r"([\d,]+\.\d\d) (CR|DR) (\d+) (\d+) ([\d,]+\.\d\d) ([\d,]+\.\d\d) ([\d,]+\.\d\d) (CR|DR)")
REF = re.compile(r"^(?:UPI/(?:DR|CR)|NEFT|IMPS|RTGS)/([A-Z0-9]+)/")


def detect(text: str) -> bool:
    return "IDFC FIRST BANK" in text.upper() and "CONSOLIDATED STATEMENT" in text.upper()


def _num(s: str) -> float:
    return float(s.replace(",", ""))


def _bal(s: str) -> float:  # "1,234.00 CR" -> 1234.0, "DR" -> negative
    v, side = s.split()
    return _num(v) * (-1 if side == "DR" else 1)


def _join(lines: list[list[dict]]) -> str:
    out = ""
    for ln in lines:
        txt = " ".join(w["text"] for w in ln)
        # a wrap right at a separator is a mid-token break (e.g. ".../" + "BARB/..."): no space
        out += txt if not out or out.endswith(("/", "@")) or txt.startswith(("/", "@")) else " " + txt
    return out


def _page_rows(page) -> list[dict]:
    words = page.extract_words()
    hdr = next((w for i, w in enumerate(words) if w["text"] == "Transaction"
                and i + 1 < len(words) and words[i + 1]["text"] == "Details"), None)
    if hdr is None:
        return []
    top = hdr["top"]
    xs = sorted({round(l["x0"]) for l in page.lines
                 if abs(l["x0"] - l["x1"]) < 1 and l["top"] <= top + 1 and l["bottom"] >= top + 5})
    if len(xs) != 8:
        raise ValueError(f"IDFC p{page.page_number}: expected 7 columns, found edges {xs}")
    # row rules: horizontal segments spanning exactly the narration column
    ys = sorted({round(l["top"], 1) for l in page.lines if abs(l["top"] - l["bottom"]) < 1
                 and l["top"] > top and abs(l["x0"] - xs[2]) < 2 and abs(l["x1"] - xs[3]) < 2})
    rows = []
    for y0, y1 in zip(ys, ys[1:]):
        cells = [[] for _ in range(7)]
        for w in words:
            if y0 < (w["top"] + w["bottom"]) / 2 < y1:
                c = next((i for i in range(7) if xs[i] <= (w["x0"] + w["x1"]) / 2 < xs[i + 1]), None)
                if c is not None:
                    cells[c].append(w)
        lines = []
        for c in cells:  # group each cell's words into visual lines
            ls = []
            for w in sorted(c, key=lambda w: (round(w["top"]), w["x0"])):
                if ls and abs(ls[-1][0]["top"] - w["top"]) < 2:
                    ls[-1].append(w)
                else:
                    ls.append([w])
            lines.append(ls)
        rows.append([_join(ls) for ls in lines])
    return rows


def parse(pdf):
    first = pdf.pages[0].extract_text() or ""
    m = SUMMARY.search(first)
    if not m:
        raise ValueError("IDFC: savings summary line not found on page 1")
    opening, n_wd, n_dep = _bal(f"{m[1]} {m[2]}"), int(m[3]), int(m[4])
    tot_wd, tot_dep, closing = _num(m[5]), _num(m[6]), _bal(f"{m[7]} {m[8]}")

    out, bal = [], opening
    for page in pdf.pages:
        for date, _vdate, desc, ref, wd, dep, balance in _page_rows(page):
            d = DATE.match(date)
            if not d:
                if desc.lower() in ("opening balance", "closing balance"):
                    continue
                if desc or wd or dep:
                    raise ValueError(f"IDFC p{page.page_number}: row without date: {desc[:40]!r}")
                continue
            if bool(wd) == bool(dep):
                raise ValueError(f"IDFC {d[1]}: need exactly one of withdrawal/deposit: {desc[:40]!r}")
            amt = -_num(wd) if wd else _num(dep)
            bal = round(bal + amt, 2)
            if balance and abs(bal - _bal(balance)) > 0.005:
                raise ValueError(f"IDFC {d[1]}: running balance {bal:.2f} != statement {balance} ({desc[:40]!r})")
            r = REF.match(desc)
            out.append({"date": datetime.strptime(d[1], "%d %b %y").strftime("%Y-%m-%d"),
                        "description": desc, "amount": amt, "ref": ref or (r[1] if r else None)})

    debits = [r["amount"] for r in out if r["amount"] < 0]
    credits = [r["amount"] for r in out if r["amount"] > 0]
    checks = [(len(debits), n_wd, "withdrawal count"), (len(credits), n_dep, "deposit count"),
              (round(-sum(debits), 2), tot_wd, "withdrawals total"), (round(sum(credits), 2), tot_dep, "deposits total"),
              (round(opening + sum(r["amount"] for r in out), 2), closing, "opening + txns vs closing")]
    for got, want, what in checks:
        if abs(got - want) > 0.005:
            raise ValueError(f"IDFC {what}: parsed {got} != statement {want}")
    return "IDFC-SAV", out
