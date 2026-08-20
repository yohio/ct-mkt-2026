---
description: Run RuboCop and the relevant RSpec specs against only the files changed on this branch.
argument-hint: "[all | lint | test]"
---

# Quality Check

**Orchestrator** — runs linting and tests on changed files.

---

## Step 1: Run Quality Checks

Launch the `code-quality:quality-checker` agent with:
- `scope`: determined by arguments:
  - No arguments or `all` → `scope: all` (lint + tests)
  - `lint` → `scope: lint` (RuboCop only)
  - `test` → `scope: test` (RSpec only)

## Step 2: Present Results

Display the quality check results clearly.

If there are auto-correctable RuboCop offenses, ask the user:
> "There are {N} auto-correctable offenses. Want me to run `rubocop -a` to fix them?"

If tests failed, summarize the failures and offer to investigate.

---

$ARGUMENTS
