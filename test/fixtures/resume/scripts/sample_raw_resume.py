#!/usr/bin/env python3
"""Print one plain-text resume from the sampled computer-related resume CSV."""

from __future__ import annotations

import argparse
import csv
import random
import re
import sys
from pathlib import Path


DEFAULT_CSV = Path(__file__).resolve().parents[1] / "raw" / "computer-related-resumes.csv"


def clean(value: str | None) -> str:
    text = value or ""
    text = text.replace("<br>", "\n")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
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


def pick_row(
    rows: list[dict[str, str]],
    index: int | None,
    category: str | None,
    seed: int | None,
) -> tuple[int, dict[str, str]]:
    candidates = rows
    if category:
        wanted = category.casefold()
        candidates = [row for row in rows if row.get("Category", "").casefold() == wanted]
        if not candidates:
            raise SystemExit(f"category not found: {category}")

    if index is not None:
        if index < 0 or index >= len(candidates):
            raise SystemExit(f"index out of range: {index}")
        row = candidates[index]
        return rows.index(row), row

    rng = random.Random(seed)
    row = rng.choice(candidates)
    return rows.index(row), row


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Print a plain-text resume from test/fixtures/resume/raw/computer-related-resumes.csv."
    )
    parser.add_argument(
        "filepath",
        nargs="?",
        type=Path,
        help="Optional source CSV path. Defaults to raw/computer-related-resumes.csv.",
    )
    parser.add_argument("--csv", type=Path, help="Source CSV path. Overrides the positional filepath.")
    parser.add_argument("--index", type=int, help="Pick a specific zero-based row index after filtering.")
    parser.add_argument("--category", help="Restrict sampling to one resume category.")
    parser.add_argument("--seed", type=int, help="Deterministic random seed.")
    parser.add_argument(
        "--metadata",
        action="store_true",
        help="Print source metadata to stderr without adding it to the resume text.",
    )
    args = parser.parse_args()

    csv_path = args.csv or args.filepath or DEFAULT_CSV
    rows = load_rows(csv_path)
    if not rows:
        raise SystemExit(f"no rows found in {csv_path}")

    index, row = pick_row(rows, args.index, args.category, args.seed)
    if args.metadata:
        print(
            "source=Updated Resume Dataset mirror; license=MIT mirror / Kaggle page CC0; "
            f"index={index}; category={row.get('Category')}",
            file=sys.stderr,
        )

    print(clean(row.get("Resume")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
