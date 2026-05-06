# Smoke Group: Config

## Purpose

Verify that config reads defaults and writes user changes safely.

## Coverage

- E3 config/profile management behavior

## Case C-01 - `wolf config get tailor.model` returns the default

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `config-C01`

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/config-C01 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/config-C01 npm run wolf -- config get tailor.model
```

### Pass Criteria

- Both commands exit `0`.
- Final stdout contains `anthropic/claude-sonnet-4-6`.
- Dev banner appears on stderr for each wolf invocation.

## Case C-02 - `wolf config set` roundtrips through `wolf.toml`

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `config-C02`

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/config-C02 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/config-C02 npm run wolf -- config set tailor.model anthropic/claude-haiku-4-5
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/config-C02 npm run wolf -- config get tailor.model
```

### Pass Criteria

- All commands exit `0`.
- Final stdout contains `anthropic/claude-haiku-4-5`.
- `wolf.toml.backup1` exists under the test workspace.
- Dev banner appears on stderr for each wolf invocation.

## Report Requirements

Record before/after config evidence and the backup file check.

