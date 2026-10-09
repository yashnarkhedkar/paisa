"""Convert bank / credit-card statement PDFs into the tracker's upload CSV.

Usage:  python scripts/statements/convert.py "C:/Users/me/Downloads/Sept Transactions"
Writes  <folder>/upload.csv  (one file, all statements). Upload it on the /upload page.

Each reader module exposes:
    detect(text: str) -> bool             # text = first page text
    parse(pdf) -> (account_code, rows)    # pdf = open pdfplumber.PDF
rows: dicts with date (YYYY-MM-DD), description, amount (signed: negative = money out), ref (str | None).
A reader raises ValueError if its own totals check fails, so a bad parse never reaches the CSV.
"""
import csv
import os
import sys
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).parent))
import axis, bob, icici, idfc  # noqa: E402

READERS = [bob, idfc, axis, icici]


def passwords() -> list[str]:
    """STATEMENT_PASSWORDS from the environment or tracker/.env. Never hardcode: this repo goes to GitHub."""
    raw = os.environ.get("STATEMENT_PASSWORDS")
    env = Path(__file__).parents[2] / ".env"
    if raw is None and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("STATEMENT_PASSWORDS="):
                raw = line.split("=", 1)[1].strip().strip('"')
    return [""] + [p for p in (raw or "").split(",") if p]


def open_pdf(pdf_path: Path):
    for pw in passwords():
        try:
            pdf = pdfplumber.open(pdf_path, password=pw)
            pdf.pages[0].extract_text()  # wrong password only fails on first read
            return pdf
        except Exception as e:
            if "password" not in repr(e).lower() and "PDFPasswordIncorrect" not in repr(e):
                raise
    raise ValueError("locked PDF, none of STATEMENT_PASSWORDS worked")


def convert(pdf_path: Path) -> tuple[str, list[dict]]:
    with open_pdf(pdf_path) as pdf:
        first = pdf.pages[0].extract_text() or ""
        reader = next((r for r in READERS if r.detect(first)), None)
        if reader is None:
            raise ValueError("unknown statement format")
        return reader.parse(pdf)


def main(folder: str) -> None:
    folder_path = Path(folder)
    out = folder_path / "upload.csv"
    total = 0
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date", "account", "description", "amount", "type", "ref"])
        for pdf_path in sorted(folder_path.glob("*.pdf")):
            try:
                account, rows = convert(pdf_path)
            except Exception as e:  # one bad PDF must not block the rest
                print(f"SKIP {pdf_path.name}: {e}")
                continue
            for r in rows:
                amt = round(r["amount"], 2)
                w.writerow([r["date"], account, " ".join(r["description"].split()), f"{amt:.2f}",
                            "DEBIT" if amt < 0 else "CREDIT", r.get("ref") or ""])
            total += len(rows)
            print(f"OK   {pdf_path.name}: {account}, {len(rows)} rows")
    print(f"\n{total} rows -> {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
