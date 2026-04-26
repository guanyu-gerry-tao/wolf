# JD Fixtures

## 目的

这些 fixture 为 smoke 和 acceptance 测试提供稳定的离线职位描述。当前版本刻意保持
简单：一个计算机相关岗位的小 CSV，加一个辅助脚本，用来输出接近“用户复制粘贴”的
真实 JD 文本。

## 来源策略

当前提交进仓库的 CSV 是从 CC0 的 Real / Fake Job Posting Prediction 数据集中筛选
出来的小样本。它只包含 `fraudulent=0` 的普通岗位，并且筛向计算机相关职位。这个
CSV 用作真实测试输入，不作为真假工作识别 benchmark。

当前来源是：

| 来源 | URL | 用途 | License 备注 |
|---|---|---|
| Kaggle: Real / Fake Job Posting Prediction | https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction | 真实 JD 原料池 | CC0: Public Domain |

同一数据集也镜像在 Hugging Face：
https://huggingface.co/datasets/victor/real-or-fake-fake-jobposting-prediction。
本地 CSV 来自这个 CC0 镜像，因为它不需要 Kaggle CLI credentials。

## 目录结构

- `raw/`：从 Real / Fake Job Posting Prediction 数据集中抽出的 CC0 小 CSV。
  这里只包含 `fraudulent=0` 的普通岗位，用作真实 JD 原料池，不作为真假工作识别
  benchmark。
  - `computer-related-job-postings-cc0.csv`：98 条偏计算机相关岗位，包括
    software、data、product、design、QA、platform、technical jobs。
- `scripts/`：用于从 raw JD 中抽样的辅助脚本。

## 测试使用方式

Acceptance case 应该用脚本生成“用户从网页复制了一整段 JD”的输入：

```bash
python3 test/fixtures/jd/scripts/sample_raw_jd.py --seed 7
python3 test/fixtures/jd/scripts/sample_raw_jd.py --row-id 14289 --metadata
python3 test/fixtures/jd/scripts/sample_raw_jd.py test/fixtures/jd/raw/computer-related-job-postings-cc0.csv --seed 7
```

脚本只会把粘贴用的 JD 文本输出到 stdout。传 `--metadata` 时，来源 metadata 会输出
到 stderr，所以不会污染 `jdText`。
