# 项目文档结构

## 面向人类

| 文件 | 用途 |
|---|---|
| `README.md` | 项目介绍、安装方式、使用方法。第一印象。 |
| `CONTRIBUTING.md` | 如何贡献 — 分支命名、PR 流程、提交格式。 |
| `CHANGELOG.md` | 每个版本的变更内容。面向用户。 |
| `docs/ARCHITECTURE.md` | 系统设计、模块关系、技术决策和推理。 |
| `docs/API.md` | 每个命令/tool 的完整参考 — 参数、返回值、示例。 |

## 面向 AI

| 文件 | 用途 |
|---|---|
| `CLAUDE.md` | 项目结构、当前里程碑、常用命令。Claude Code 自动读取。 |
| `docs/TYPES.md` | 所有共享类型及描述。AI 编写代码时了解数据结构。 |

## 面向项目定义

| 文件 | 用途 |
|---|---|
| `docs/DECISIONS.md` | 重要技术决策日志及原因。如"为什么选 SQLite 而不是 MongoDB"。 |
| `docs/SCOPE.md` | 项目做什么，明确不做什么。防止范围蔓延。 |

## wolf 的优先级

**现在就开始：**
- `README.md`
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`

**开始协作时添加：**
- `CONTRIBUTING.md`
- `docs/API.md`

**随时开始，每次一条决策：**
- `docs/DECISIONS.md`
