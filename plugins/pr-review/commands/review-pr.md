---
description: Full PR review — code quality, Rails patterns, testing, security, and performance.
argument-hint: "[PR number | branch]"
---

# PR Review Command

**Orchestrator** — delegates to specialized agents in sequence.

---

## Step 0: Resolve project knowledge (stop-point)

Two inputs below are project-specific and cannot be inferred from the diff. Resolve them **before** launching any agent, so the review is not silently shallower than the user expects.

**0a. Review checklist** — the extended list of review items beyond the reviewer's built-in criteria.

1. Read the `checklistPath` config. If set and the file exists, use it.
2. If unset, look for one this repository may already carry: `.claude/PR_REVIEW_CHECKLIST.md`, `.github/pull_request_review_checklist.md`, `doc/review-checklist.md`, or any file whose name contains both `review` and `checklist`.
3. If still unresolved, ask via `AskUserQuestion`:
   - **"It's at `<path>`"** — pass that path to `pr-reviewer`.
   - **"Create one now"** — copy this plugin's template from `${CLAUDE_PLUGIN_ROOT}/templates/review-checklist.md`, ask where to write it (default `.claude/PR_REVIEW_CHECKLIST.md`), then use it. Afterwards, tell the user to set `checklistPath` so later runs skip this question.
   - **"Review without one"** — proceed on the reviewer's built-in criteria alone, and **state that in the final report** so the user knows the depth of review they got.

**0b. Prior work notes** — local spike and investigation notes for this ticket.

1. If `priorWorkRoot` (owned by the `ticket-context` plugin) is set, `prior-work-loader` resolves it itself. Nothing to do.
2. If unset, that agent reports "No prior work directory configured". When it does, ask once:
   - **"It's at `<path>`"** — re-run `prior-work-loader` with the path passed explicitly for this run, and tell the user to set `priorWorkRoot` to make it stick.
   - **"I don't keep local notes"** — continue. This is a normal answer, not a gap; do not raise it again this run.

When both are unresolved, ask them in a **single** `AskUserQuestion` call. Never ask what the repository already answers, and never ask the same question twice in one run.

## Step 1: Load Context (run all three in parallel)

**1a. JIRA Context** — Launch the `ticket-context:jira-context-loader` agent:
- Let it extract the ticket ID from the current git branch
- Pass `depth: full`

**1b. Prior Work** — Launch the `ticket-context:prior-work-loader` agent:
- Pass the ticket ID (extracted from branch name)
- If Step 0b resolved a notes path explicitly, pass it too

**1c. Diff Analysis** — Launch the `pr-review:diff-analyzer` agent:
- Pass `mode: full` (include actual diff content)

## Step 2: Run Code Review

Launch the `pr-review:pr-reviewer` agent with:
- `ticket_id`: from Step 1a
- `jira_context`: structured context from Step 1a
- `diff_analysis`: categorized analysis from Step 1c
- `prior_work`: findings from Step 1b (if any)
- `full_diff`: the diff content from Step 1c
- `checklist_path`: the checklist resolved in Step 0a, or omit if the user chose to review without one

The agent will review code quality, Rails patterns, testing, security, performance, and frontend framework usage, then produce a structured report.

## Step 3: Run Quality Checks

Launch the `code-quality:quality-checker` agent with:
- `scope: all` (both linting and tests)

## Step 4: Present Report

Present the review report from Step 2, followed by the quality check results from Step 3.

If quality checks found issues, note them alongside the review findings.
