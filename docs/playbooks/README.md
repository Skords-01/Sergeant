# Playbooks

Repeatable step-by-step recipes for common tasks in the Sergeant monorepo.
Each playbook is a checklist that **AI agents and human developers** can follow to reduce variance and avoid missed steps.

> **Origin:** `docs/ai-coding-improvements.md` Block 2.
> **Format:** Option A — markdown files in-repo. If the team later wants GUI-driven execution, these can be imported into Devin webapp as `playbook-<uuid>`.

## Available Playbooks

| Playbook                                                       | Trigger                                                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [add-feature-flag.md](add-feature-flag.md)                     | "Put feature X behind a flag" / new experimental feature                          |
| [cleanup-dead-code.md](cleanup-dead-code.md)                   | "Remove X and all its usages" / dead code cleanup                                 |
| [hotfix-prod-regression.md](hotfix-prod-regression.md)         | "Прод впав" / HTTP 500 на `/health` / Sentry alert / production incident response |
| [add-monobank-event-handler.md](add-monobank-event-handler.md) | "Треба обробити нову подію X від Monobank" / новий тип webhook event              |

## Future Candidates

These are described in `docs/ai-coding-improvements.md § 2.2` and can be added as the need arises:

- `bump-dep-safely.md` — dependency upgrade protocol

## How to Use

1. **AI agents:** When a task matches a playbook trigger, read the playbook and follow it step-by-step. Confirm completion of each step before moving to the next.
2. **Humans:** Use as a PR checklist — copy the steps into your PR description or mentally tick them off.
3. **Adding a new playbook:** Create a new `.md` file in this folder, add a row to the table above, and follow the same format (trigger, steps, verification, notes).
