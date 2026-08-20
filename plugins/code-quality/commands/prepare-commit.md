---
description: Run quality checks, then generate a commit message and changed-file list for you to commit yourself.
---

# Prepare Commit

**Orchestrator** — runs quality checks, generates a commit message, and presents everything for the user to commit.

---

## Step 1: Identify the Ticket

Extract a ticket key from the current git branch:

```bash
git branch --show-current
```

Parse a leading tracker key if one is present — e.g. `PROJ-1234` from `PROJ-1234-add-user-export`.

**If the branch name contains no ticket key, skip this step.** Do not invent one, and do not ask the user for it; the commit message simply omits the prefix.

## Step 2: Run Quality Checks

Launch the `code-quality:quality-checker` agent with:
- `scope: all`

If there are RuboCop offenses, stop and report them — do not proceed to commit preparation until the user resolves them.

If tests fail, stop and report — do not proceed.

## Step 3: Gather Changed Files

Resolve the base branch first: use the `baseBranch` plugin config if it is set, otherwise detect it with

```bash
git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||'
```

falling back to `main`, then `master`, whichever exists. Then:

```bash
git diff --name-only {base}...HEAD --diff-filter=AM
git status --short
```

List all modified and new files.

## Step 4: Generate Commit Message

Format: `{TICKET-KEY}: {brief description of changes}` — or just `{brief description of changes}` when no ticket key was found in Step 1.

Look at the changes to write a concise, accurate description. Keep the body simple — no bullet points, no AI attribution.

## Step 5: Present for User

Output in this format:

```
Commit message:
{TICKET-KEY}: {description}

Modified files:
- {file1}
- {file2}
- ...

Quality checks: All passing (rubocop clean, specs green)
```

**Do NOT run `git commit`** — the user will commit themselves.

---

$ARGUMENTS
