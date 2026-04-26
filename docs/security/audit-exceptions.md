# Audit Exceptions

> Tracked vulnerabilities that are temporarily accepted via the `audit-exception` PR label.

## How this file works

When `pnpm audit --audit-level=high` reports a vulnerability that cannot be fixed immediately (e.g. no patch available, upstream issue), document it here so the team has visibility. Add the `audit-exception` label to the PR to bypass the blocking audit step in CI.

Each entry must include:

| Field          | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| **Advisory**   | Link to the npm/GitHub advisory                                 |
| **Package**    | Affected package name and installed version                     |
| **Severity**   | `high` or `critical`                                            |
| **Reason**     | Why it cannot be fixed right now                                |
| **Mitigation** | What reduces the risk (e.g. not used in prod, input validation) |
| **Due date**   | When the exception must be re-evaluated or resolved             |
| **Owner**      | Who is responsible for tracking the fix                         |

## Current exceptions

_None — as of 2026-04-26, `pnpm audit --audit-level=high` passes cleanly._

<!-- Template for adding a new exception:

### <Advisory title>

| Field       | Value                                       |
| ----------- | ------------------------------------------- |
| Advisory    | https://github.com/advisories/GHSA-xxxx     |
| Package     | `some-package@1.2.3`                        |
| Severity    | high                                        |
| Reason      | No patch available; upstream PR pending      |
| Mitigation  | Dev-only dependency, not in production build |
| Due date    | YYYY-MM-DD                                  |
| Owner       | @username                                   |

-->
