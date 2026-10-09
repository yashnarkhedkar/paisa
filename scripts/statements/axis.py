"""Axis Bank credit card statement (Flipkart Axis, Neo, ...)."""
import re
from datetime import datetime

DATE = re.compile(r"\d{2}/\d{2}/\d{4}$")
AMT = re.compile(r"[\d,]+\.\d\d$")
# Previous Balance - Payments - Credits + Purchase + Cash Advance + Other Debit&Charges = Total Payment Due
SUMMARY = re.compile(r"([\d,]+\.\d\d) (Dr|Cr) ([\d,]+\.\d\d) ([\d,]+\.\d\d) ([\d,]+\.\d\d) ([\d,]+\.\d\d) "
                     r"([\d,]+\.\d\d) ([\d,]+\.\d\d) (Dr|Cr)")


def detect(text: str) -> bool:
    return "Credit Card Statement" in text and "Axis Bank" in text


def _num(s):
    return float(s.replace(",", ""))


def _lines(page):
    """Words grouped into visual lines (top within 3pt), left to right."""
    lines = []
    for w in sorted(page.extract_words(), key=lambda w: (round(w["top"]), w["x0"])):
        if lines and abs(lines[-1][0]["top"] - w["top"]) < 3:
            lines[-1].append(w)
        else:
            lines.append([w])
    return [sorted(l, key=lambda w: w["x0"]) for l in lines]


def parse(pdf):
    first = pdf.pages[0].extract_text() or ""
    low = first.lower()
    # pick account by card product, not card digits (repo is public)
    account = "AXIS-FK" if "flipkart" in low else "AXIS-NEO" if "neo" in low else None
    if not account:
        raise ValueError("Axis: unknown card product (add it in axis.py)")

    rows, cat_x, done = [], None, False
    for page in pdf.pages:
        for line in _lines(page):
            text = " ".join(w["text"] for w in line)
            if "End of Statement" in text:
                done = True
                break
            if line[0]["text"] == "DATE" and "MERCHANT" in text:
                # category values sit left of their centred header: split midway DETAILS-end / MERCHANT-start
                x = {w["text"]: w for w in line}
                cat_x = (x["DETAILS"]["x1"] + x["MERCHANT"]["x0"]) / 2
                continue
            if cat_x is None or not DATE.match(line[0]["text"]):
                continue
            # first "<amount> Dr|Cr" pair is the txn amount; a second one (Flipkart) is cashback earned
            i = next((i for i in range(1, len(line) - 1)
                      if AMT.match(line[i]["text"]) and line[i + 1]["text"] in ("Dr", "Cr")), None)
            if i is None:
                raise ValueError(f"Axis: no amount on line {text!r}")
            amt = _num(line[i]["text"]) * (-1 if line[i + 1]["text"] == "Dr" else 1)
            desc = " ".join(w["text"] for w in line[1:i] if w["x0"] < cat_x)
            date = datetime.strptime(line[0]["text"], "%d/%m/%Y").strftime("%Y-%m-%d")
            rows.append({"date": date, "description": desc, "amount": amt, "ref": None})
        if done:
            break
    if not done or cat_x is None:
        raise ValueError("Axis: transaction table not found")

    m = SUMMARY.search(first)
    if not m:
        raise ValueError("Axis: account summary line not found")
    g = m.groups()
    prev = _num(g[0]) * (-1 if g[1] == "Dr" else 1)
    credits = _num(g[2]) + _num(g[3])
    debits = _num(g[4]) + _num(g[5]) + _num(g[6])
    due = _num(g[7]) * (-1 if g[8] == "Dr" else 1)
    got_cr = round(sum(r["amount"] for r in rows if r["amount"] > 0), 2)
    got_dr = round(-sum(r["amount"] for r in rows if r["amount"] < 0), 2)
    if abs(got_cr - credits) > 0.01 or abs(got_dr - debits) > 0.01:
        raise ValueError(f"Axis {account}: rows Cr {got_cr} / Dr {got_dr} != summary Cr {credits} / Dr {debits}")
    if abs(prev + credits - debits - due) > 0.01:
        raise ValueError(f"Axis {account}: summary does not add up ({prev} + {credits} - {debits} != {due})")
    return account, rows
