# JD Fixtures

## Purpose

These fixtures provide stable offline job descriptions for smoke and acceptance
tests. The current fixture set is intentionally simple: one small CSV of
computer-related jobs plus one helper script that prints a realistic pasted JD.

## Source Policy

The checked-in CSV is a filtered sample from the CC0 Real / Fake Job Posting
Prediction dataset. It contains only `fraudulent=0` rows and is filtered toward
computer-related jobs. The CSV is used as realistic test input, not as a
fraud-detection benchmark.

The current source is:

| Source | URL | Use | License Notes |
|---|---|---|
| Kaggle: Real / Fake Job Posting Prediction | https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction | Realistic JD source pool | CC0: Public Domain |

The same dataset is also mirrored on Hugging Face at
https://huggingface.co/datasets/victor/real-or-fake-fake-jobposting-prediction.
The local CSV was generated from that CC0 source because Kaggle CLI credentials
are not required for the mirror.

## Layout

- `raw/`: a small checked-in CC0 CSV sample from the Real / Fake Job Posting
  Prediction dataset. It contains only `fraudulent=0` rows and is used as a
  realistic JD source pool, not as a fraud-detection benchmark.
  - `computer-related-job-postings-cc0.csv`: 98 postings filtered toward
    computer-related roles such as software, data, product, design, QA,
    platform, and technical jobs.
- `scripts/`: helper scripts for sampling raw JD text.
## Use In Tests

Acceptance cases should generate "user pasted a JD" input with:

```bash
python3 test/fixtures/jd/scripts/sample_raw_jd.py --seed 7
python3 test/fixtures/jd/scripts/sample_raw_jd.py --row-id 14289 --metadata
python3 test/fixtures/jd/scripts/sample_raw_jd.py test/fixtures/jd/raw/computer-related-job-postings-cc0.csv --seed 7
```

The script prints only the pasted JD text to stdout. Source metadata goes to
stderr when `--metadata` is passed, so it does not pollute `jdText`.
