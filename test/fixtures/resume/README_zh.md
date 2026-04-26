# Resume Fixtures

## 目的

这些 fixture 为 acceptance 测试提供稳定的离线 resume 文本。当前版本刻意保持简单：
一个计算机相关 resume 小 CSV，加一个辅助脚本，用来输出接近“用户复制粘贴”的
真实 resume 文本。

## 来源策略

当前提交进仓库的 CSV 是从 `UpdatedResumeDataSet.csv` resume corpus 中筛选出来的。
它只保留计算机相关类别，用作真实测试输入，不作为 resume classification benchmark。

这个来源有一点混乱：

| 来源 | URL | License 备注 |
|---|---|---|
| Kaggle: Updated Resume Dataset | https://www.kaggle.com/datasets/jillanisofttech/updated-resume-dataset | Kaggle 页面标为 CC0: Public Domain |
| Hugging Face mirror: brackozi/Resume | https://huggingface.co/datasets/brackozi/Resume | 实际下载使用的镜像；页面标为 MIT |

本地 CSV 来自 Hugging Face 镜像，因为它不需要 Kaggle CLI credentials。即使相关
Kaggle 页面标为 CC0，这个 fixture 也按 MIT attribution 的要求处理。

## 目录结构

- `raw/computer-related-resumes.csv`：100 条唯一记录，筛向计算机相关类别，包括 Data
  Science、Java Developer、Testing、DevOps Engineer、Python Developer、Web
  Designing、Hadoop、ETL Developer、Blockchain、Database、DotNet Developer、
  Automation Testing、Network Security Engineer、SAP Developer。Resume 内部换行
  用 `<br>` 保存，所以每条 CSV 记录都在物理上的一行里；抽样脚本输出时会把
  `<br>` 转回换行。源数据中重复的 resume 文本已经去掉。
- `scripts/sample_raw_resume.py`：用于输出一份纯文本 resume 的辅助脚本。

## 测试使用方式

Acceptance case 应该用脚本生成“用户复制了一份 resume”的输入：

```bash
python3 test/fixtures/resume/scripts/sample_raw_resume.py --seed 7
python3 test/fixtures/resume/scripts/sample_raw_resume.py --category "Python Developer" --seed 1
python3 test/fixtures/resume/scripts/sample_raw_resume.py --index 0 --metadata
python3 test/fixtures/resume/scripts/sample_raw_resume.py test/fixtures/resume/raw/computer-related-resumes.csv --seed 7
```

脚本只会把 resume 文本输出到 stdout。传 `--metadata` 时，来源 metadata 会输出到
stderr，所以不会污染 resume input。
