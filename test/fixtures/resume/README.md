# Resume Fixtures

## Purpose

These fixtures provide stable offline resume text for acceptance tests. The
current fixture set is intentionally simple: one small CSV of computer-related
resumes plus one helper script that prints a realistic pasted resume.

## Source Policy

The checked-in CSV is filtered from the `UpdatedResumeDataSet.csv` resume corpus.
It keeps only computer-related categories and is used as realistic test input,
not as a resume-classification benchmark.

The source situation is slightly messy:

| Source | URL | License Notes |
|---|---|---|
| Kaggle: Updated Resume Dataset | https://www.kaggle.com/datasets/jillanisofttech/updated-resume-dataset | Kaggle page lists CC0: Public Domain |
| Hugging Face mirror: brackozi/Resume | https://huggingface.co/datasets/brackozi/Resume | Mirror used for download; page lists MIT |

The local CSV was generated from the Hugging Face mirror because it does not
require Kaggle CLI credentials. Treat MIT attribution as required for this
fixture even though the related Kaggle page lists CC0.

## Layout

- `raw/computer-related-resumes.csv`: 100 unique rows filtered to computer-related
  categories such as Data Science, Java Developer, Testing, DevOps Engineer,
  Python Developer, Web Designing, Hadoop, ETL Developer, Blockchain, Database,
  DotNet Developer, Automation Testing, Network Security Engineer, and SAP
  Developer. Internal resume newlines are stored as `<br>` so each CSV record
  stays on one physical line; the sampling script converts `<br>` back to
  newlines before printing. Duplicate resume texts from the source dataset were
  removed.
- `scripts/sample_raw_resume.py`: helper script for printing one plain-text
  resume.

## Use In Tests

Acceptance cases should generate "user pasted a resume" input with:

```bash
python3 test/fixtures/resume/scripts/sample_raw_resume.py --seed 7
python3 test/fixtures/resume/scripts/sample_raw_resume.py --category "Python Developer" --seed 1
python3 test/fixtures/resume/scripts/sample_raw_resume.py --index 0 --metadata
python3 test/fixtures/resume/scripts/sample_raw_resume.py test/fixtures/resume/raw/computer-related-resumes.csv --seed 7
```

The script prints only the resume text to stdout. Source metadata goes to stderr
when `--metadata` is passed, so it does not pollute the resume input.
