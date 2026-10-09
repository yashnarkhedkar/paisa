"""ICICI Bank credit-card statement reader.

Table rows are found by word coordinates: each page with a "Date / SerNo. / Transaction Details / Amount"
header is cut into columns at the header x-positions. A row starts at a dd/mm/yyyy date; description words
wrapped onto the next line (within ~10pt) are appended. Amounts ending in "CR" are credits (positive).
Spends-overview pie labels sit left of the table and are ignored. MITC / offers pages have no header.
EMI: no EMI section seen in samples; ICICI bills EMI instalments as ordinary table rows, so they are taken as-is.
"""
import re
from datetime import datetime

DATE = re.compile(r"\d{2}/\d{2}/\d{4}$")
MONEY = re.compile(r"[\d,]+\.\d{2}$")


def detect(text: str) -> bool:
    return "CREDIT CARD STATEMENT" in text and "ICICI" in text.upper() and "SerNo." in text


def _num(s: str) -> float:
    return float(re.sub(r"[^\d.]", "", s))


def _summary(page) -> dict:
    words = page.extract_words()
    out = {}
    for label, key in [("Previous", "prev"), ("Purchases", "purch"), ("Advances", "cash"), ("Payments", "pay"), ("Total", "due")]:
        lw = next(w for w in words if w["text"] == label)
        val = min((w for w in words if w["text"].lstrip("`₹").replace(",", "").replace(".", "").isdigit()
                   and MONEY.search(w["text"]) and 0 < w["top"] - lw["top"] < 25
                   and abs(w["x0"] - lw["x0"]) < 40), key=lambda w: w["top"] - lw["top"])
        out[key] = _num(val["text"])
    return out


def _rows(page) -> list[dict]:
    words = page.extract_words()
    ser = next((w for w in words if w["text"] == "SerNo."), None)
    if ser is None:
        return []
    hdr = {w["text"]: w for w in words if abs(w["top"] - ser["top"]) < 3
           and w["text"] in ("Date", "SerNo.", "Transaction", "Reward", "Amount")}
    if len(hdr) < 5:
        raise ValueError("ICICI: transaction table header not recognised")
    d0, s0, t0, r0, a0 = (hdr[k]["x0"] for k in ("Date", "SerNo.", "Transaction", "Reward", "Amount"))
    body = sorted((w for w in words if w["top"] > hdr["Date"]["top"] + 12 and w["x0"] >= d0 - 5),
                  key=lambda w: (round(w["top"]), w["x0"]))
    rows, cur = [], None
    for w in body:
        x, t = w["x0"], w["text"]
        if abs(x - d0) < 5 and DATE.match(t):
            cur = {"top": w["top"], "date": t, "ref": None, "desc": [], "amt": [], "_last": w["top"]}
            rows.append(cur)
        elif cur is None or w["top"] - cur["_last"] > 10:
            continue  # card-number line, footer, etc.
        elif abs(w["top"] - cur["top"]) < 3 and s0 - 15 < x < t0 - 5:
            cur["ref"] = t
        elif t0 - 3 <= x < r0 - 3:
            cur["desc"].append(t)
            cur["_last"] = w["top"]
        elif abs(w["top"] - cur["top"]) < 3 and w["x1"] >= a0:
            cur["amt"].append(t)
    out = []
    for r in rows:
        amt = [a for a in r["amt"] if MONEY.match(a)]
        if len(amt) != 1:
            raise ValueError(f"ICICI: cannot read amount for {r['date']} {r['ref']}: {r['amt']}")
        v = _num(amt[0])
        out.append({"date": datetime.strptime(r["date"], "%d/%m/%Y").strftime("%Y-%m-%d"),
                    "description": " ".join(r["desc"]),
                    "amount": v if "CR" in r["amt"] else -v, "ref": r["ref"]})
    return out


def parse(pdf):
    s = _summary(pdf.pages[0])
    rows = [r for p in pdf.pages for r in _rows(p)]
    debit = round(-sum(r["amount"] for r in rows if r["amount"] < 0), 2)
    credit = round(sum(r["amount"] for r in rows if r["amount"] > 0), 2)
    checks = [("debits vs purchases+cash", debit, s["purch"] + s["cash"]),
              ("credits vs payments", credit, s["pay"]),
              ("prev+spend-pay vs total due", s["prev"] + s["purch"] + s["cash"] - s["pay"], s["due"])]
    for name, got, want in checks:
        if abs(got - want) > 0.01:
            raise ValueError(f"ICICI: {name} mismatch: {got:.2f} != {want:.2f}")
    return "ICICI-CC", rows
