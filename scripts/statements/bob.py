"""Bank of Baroda savings-account statement reader.

Text-layer rows are misaligned (narration wraps above/below its amounts), so we use word
coordinates: each BALANCE value ("... Cr") anchors one row; date/amounts on the same line,
narration lines go to the nearest anchor.
"""
import re

ACCOUNT = "BOB-SAV"
DATE = re.compile(r"\d\d-\d\d-\d{4}$")
NUM = re.compile(r"\d+\.\d\d$")
NEAR = 14  # max vertical distance (pt) between a narration line and its anchor


def detect(text: str) -> bool:
    return "bankofbaroda" in text.lower() and "WITHDRAWAL (DR)" in text


def _page_rows(page):
    words = page.extract_words()
    head = {w["text"]: w for w in words if w["text"] in ("DATE", "CHQ.NO.", "DEPOSIT", "BALANCE")}
    if len(head) < 4:
        return []
    chq_x, dep_x, bal_x = head["CHQ.NO."]["x0"], head["DEPOSIT"]["x0"], head["BALANCE"]["x0"] - 20
    body = [w for w in words if w["top"] > head["DATE"]["bottom"] + 2]

    anchors = []  # balance + "Cr"/"Dr" marker pairs
    for i, w in enumerate(body[:-1]):
        nxt = body[i + 1]
        if w["x0"] >= bal_x and NUM.match(w["text"]) and nxt["text"] in ("Cr", "Dr") and abs(nxt["top"] - w["top"]) < 3:
            bal = float(w["text"]) * (1 if nxt["text"] == "Cr" else -1)
            anchors.append({"top": w["top"], "bal": bal, "date": None, "amt": None, "lines": {}})
    if not anchors:
        return []

    for w in body:
        if w["x0"] >= bal_x or w["text"] in ("Cr", "Dr"):
            continue
        a = min(anchors, key=lambda a: abs(a["top"] - w["top"]))
        if abs(a["top"] - w["top"]) > NEAR:
            continue
        same = abs(a["top"] - w["top"]) < 3
        if same and DATE.match(w["text"]) and w["x0"] < chq_x:
            a["date"] = w["text"]
        elif same and w["x0"] >= chq_x and NUM.match(w["text"]):
            a["amt"] = float(w["text"]) * (1 if w["x0"] >= dep_x - 10 else -1)
        elif w["x0"] < chq_x:
            a["lines"].setdefault(round(w["top"]), []).append(w["text"])
    return anchors


def _narration(lines):
    out, prev = "", ""
    for _, ws in sorted(lines.items()):
        piece = " ".join(ws)
        # previous line was one token -> it wrapped mid-token (UPI ids): glue; else keep a space
        out += piece if not out or " " not in prev else " " + piece
        prev = piece
    return out


def parse(pdf):
    anchors = [a for page in pdf.pages for a in _page_rows(page)]
    opening = closing = None
    rows, bal = [], None
    for a in anchors:
        desc = _narration(a["lines"])
        if desc.startswith("Opening Balance"):
            opening = bal = a["bal"]
            continue
        if desc.startswith("Closing Balance"):
            closing = a["bal"]
            break
        if bal is None or a["date"] is None or a["amt"] is None:
            raise ValueError(f"BoB: malformed row near balance {a['bal']}: {desc!r}")
        if round(bal + a["amt"] - a["bal"], 2) != 0:
            raise ValueError(f"BoB: running balance mismatch at {a['date']} {desc!r}: "
                             f"{bal:.2f} + {a['amt']:.2f} != {a['bal']:.2f}")
        bal = a["bal"]
        d, m, y = a["date"].split("-")
        ref = re.match(r"(?:UPI|MBK)/(\d{9,})/", desc) or re.match(r"NEFT-(\w+)-", desc)
        rows.append({"date": f"{y}-{m}-{d}", "description": desc, "amount": a["amt"],
                     "ref": ref.group(1) if ref else None})
    if opening is None or closing is None:
        raise ValueError("BoB: opening/closing balance not found")
    total = round(opening + sum(r["amount"] for r in rows), 2)
    if total != round(closing, 2):
        raise ValueError(f"BoB: opening {opening:.2f} + sum {total - opening:.2f} != closing {closing:.2f}")
    return ACCOUNT, rows
