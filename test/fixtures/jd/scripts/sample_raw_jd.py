#!/usr/bin/env python3
"""Print one plain-text job description from the sampled CC0 JD CSV."""

from __future__ import annotations

import argparse
import csv
import random
import re
import sys
from pathlib import Path


DEFAULT_CSV = Path(__file__).resolve().parents[1] / "raw" / "computer-related-job-postings-cc0.csv"


def clean(value: str | None) -> str:
    text = value or ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"https?://\S+", "[URL removed]", text)
    text = re.sub(r"\b[\w.%-]+@[\w.-]+\.[A-Za-z]{2,}\b", "[email removed]", text)
    text = re.sub(
        r"\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b",
        "[phone removed]",
        text,
    )
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def load_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open(newline="", encoding="utf-8", errors="replace") as handle:
        return list(csv.DictReader(handle))


def pick_row(rows: list[dict[str, str]], row_id: str | None, seed: int | None) -> dict[str, str]:
    if row_id:
        for row in rows:
            if row.get("job_id") == row_id:
                return row
        raise SystemExit(f"row id not found: {row_id}")

    rng = random.Random(seed)
    return rng.choice(rows)


def build_plain_text(row: dict[str, str]) -> str:
    pieces = [
        clean(row.get("title")),
        clean(row.get("company_profile")),
        clean(row.get("description")),
        clean(row.get("requirements")),
        clean(row.get("benefits")),
    ]
    return "\n\n".join(piece for piece in pieces if piece)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Print a plain-text JD from test/fixtures/jd/raw/computer-related-job-postings-cc0.csv."
    )
    parser.add_argument(
        "filepath",
        nargs="?",
        type=Path,
        help="Optional source CSV path. Defaults to raw/computer-related-job-postings-cc0.csv.",
    )
    parser.add_argument("--csv", type=Path, help="Source CSV path. Overrides the positional filepath.")
    parser.add_argument("--row-id", help="Pick a specific source job_id.")
    parser.add_argument("--seed", type=int, help="Deterministic random seed.")
    parser.add_argument(
        "--metadata",
        action="store_true",
        help="Print source metadata to stderr without adding it to the JD text.",
    )
    args = parser.parse_args()

    csv_path = args.csv or args.filepath or DEFAULT_CSV
    rows = load_rows(csv_path)
    if not rows:
        raise SystemExit(f"no rows found in {csv_path}")

    row = pick_row(rows, args.row_id, args.seed)
    if args.metadata:
        print(
            "source=Real / Fake Job Posting Prediction; license=CC0; "
            f"job_id={row.get('job_id')}; title={clean(row.get('title'))}",
            file=sys.stderr,
        )

    print(build_plain_text(row))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
