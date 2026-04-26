# Tailor Artifact AI Review Prompt

当 acceptance case 要求 AI review tailored resume 或 cover-letter artifacts 时，
使用这个 prompt。

## 需要检查的输入

- Source JD text，以及可用时的 source row id。
- Source resume pool 或 resume fixture text。
- 可用时的 `src/hint.md`。
- 可用时的 `src/tailoring-brief.md`。
- 生成的 `src/resume.html`。
- 可用时的 `resume.pdf` 或 screenshot/preview evidence。
- 生成的 `src/cover_letter.html`。
- 可用时的 `cover_letter.pdf` 或 screenshot/preview evidence。

## Review 任务

1. 根据 source resume facts 检查事实准确性。标出编造的公司、日期、学历、证书、
   指标、项目、工具或职责。
2. 检查 JD relevance。resume 和 cover letter 应该强调 JD 的核心 role、seniority、
   technologies、responsibilities 和 domain themes。
3. 检查一致性。resume、cover letter、hint 和 brief 应该讲述同一个 candidate story。
4. 检查 artifact quality。记录不可读格式、破损 HTML、缺失 PDF、一页布局问题或明显
   layout 缺陷。
5. 检查 unsupported claims。引用或总结具体生成内容，并说明为什么没有依据。

## 输出格式

把 review 写进 group report，包含这些 sections：

- `Review Result`：`PASS`、`PASS_WITH_MINOR_IMPROVEMENTS` 或 `FAIL`。
- `Factual Accuracy`：简洁证据。
- `JD Relevance`：简洁证据。
- `Consistency`：简洁证据。
- `Artifact Quality`：简洁证据。
- `Unsupported Claims`：具体列表，或 `None found`。
- `Bugs`：带复现说明的产品缺陷。
- `Improvements`：非阻塞质量改进。

如果有任何编造的重要事实、缺失必需 artifact，或主要 artifact 不可读，使用 `FAIL`。
只有在问题限于小的措辞、强调或格式改进，且不影响正确性时，才使用
`PASS_WITH_MINOR_IMPROVEMENTS`。
