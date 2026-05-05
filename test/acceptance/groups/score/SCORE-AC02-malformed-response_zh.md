# SCORE-AC02 - 异常 AI 响应被记录为 score_error

## 目的

验证当 AI 输出不符合 `<score>...</score><justification>...</justification>`
契约时，同步 `--single` 路径会向用户返回明确错误，而不是默默写入默认分数。

## 覆盖

- `UC-03.1.2`（score 错误语义）
- `AC-03-3`（错误对用户可见）
- `AC-03-4`（拒绝沉默回退）

## 执行方式

`automated`

## 成本 / 风险

- 成本：免费
- 风险：低

## Workspace

`WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC02`

## Setup

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC02
WOLF_DEV_HOME="$WS" npm run wolf -- init --dev --empty
bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh ng-swe "$WS"
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 119)"
ADD_OUT=$(WOLF_DEV_HOME="$WS" npm run wolf -- add --title "Backend Engineer" --company "Fixture Co" --jd-text "$JD_TEXT")
JOB_ID=$(echo "$ADD_OUT" | python3 -c 'import sys,json,re;raw=sys.stdin.read();m=re.search(r"\\{[\\s\\S]*\\}",raw);print(json.loads(m.group(0))["jobId"])')

mkdir -p "$WS/test-fixtures/score"
# 缺少 <score> 标签
cat > "$WS/test-fixtures/score/single-bad.txt" <<'EOF'
I cannot help with that request.
EOF
```

## 步骤

```bash
WOLF_TEST_AI_RESPONSE_FILE="$WS/test-fixtures/score/single-bad.txt" \
  WOLF_DEV_HOME="$WS" npm run wolf -- score --single --jobs "$JOB_ID" ; echo "exit=$?"
```

## 通过标准

- `score` 调用以非 0 退出（`exit=1`）。
- stderr / stdout 包含 `parse` 或 `score` 字样，便于用户定位问题。
- `wolf job show <JOB_ID>` 仍显示 `score: null`（未写入默认值）。`--single`
  路径以抛出错误的形式让用户感知失败；批量轮询路径中"标记为
  score_error"的语义由单元测试 `scoreApplicationService.test.ts` 覆盖。

## 报告要求

记录退出码、错误消息内容，以及 `wolf job show` 在执行前后的输出。
