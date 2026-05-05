# SCORE-AC01 - 单次模式将解析后的分数写回

## 目的

验证 `wolf score --single` 能跑完整流程（加载 profile、构造 prompt、调用
AI、解析回复、把 `Job.score` + `Job.scoreJustification` 写回 SQLite），且
不需要任何在线网络调用。借助 dev-only 的 `WOLF_TEST_AI_RESPONSE_FILE` 钩
子注入预制的 `<score>0–10</score><justification>...</justification>` 文本。

## 覆盖

- `UC-03.1.1`（单职位评分）
- `AC-03-1`（分数写回）
- `AC-03-2`（justification 写回）

## 执行方式

`automated`

## 成本 / 风险

- 成本：免费（无网络）
- 风险：低

## Workspace

`WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC01`

## Setup

仅本组首次运行需要构建 dev binary：

```bash
npm run build:dev
```

初始化 workspace 与 ng-swe persona：

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC01
WOLF_DEV_HOME="$WS" npm run wolf -- init --dev --empty
bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh ng-swe "$WS"
```

加入固件职位并记录 jobId：

```bash
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 119)"
ADD_OUT=$(WOLF_DEV_HOME="$WS" npm run wolf -- add --title "Backend Engineer" --company "Fixture Co" --jd-text "$JD_TEXT")
JOB_ID=$(echo "$ADD_OUT" | python3 -c 'import sys,json,re;raw=sys.stdin.read();m=re.search(r"\\{[\\s\\S]*\\}",raw);print(json.loads(m.group(0))["jobId"])')
```

准备预制响应：

```bash
mkdir -p "$WS/test-fixtures/score"
cat > "$WS/test-fixtures/score/single-good.txt" <<'EOF'
<score>8.5</score>
<justification>Backend role; remote OK; sponsorship aligns with profile.</justification>
EOF
```

## 步骤

```bash
WOLF_TEST_AI_RESPONSE_FILE="$WS/test-fixtures/score/single-good.txt" \
  WOLF_DEV_HOME="$WS" npm run wolf -- score --single --jobs "$JOB_ID"
```

## 通过标准

- 所有 setup 命令与 `score` 均以 `0` 退出。
- stdout 包含 `Score: 8.5 / 10` 与 justification 文本。
- `wolf job show <JOB_ID>` 显示 `score: 0.85` 与非空 `scoreJustification`。
- 没有任何 Anthropic 在线调用（dev binary 通过 `WOLF_TEST_AI_RESPONSE_FILE` 旁路 AI dispatcher）。

## 报告要求

记录解析后的 `JOB_ID`、`wolf job show` JSON，以及预制响应文件内容。
