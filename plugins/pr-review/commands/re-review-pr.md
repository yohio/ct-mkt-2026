---
description: Re-review a PR after the author has addressed the initial review comments.
argument-hint: "[PR number]"
---

# PR Re-Review Command

**Orchestrator** — delegates to specialized agents in sequence.

---

## Step 1: Gather PR and Review Context

**1a. Get PR details and original comments:**

```bash
git branch --show-current
gh pr view --json number,title,url,body,headRefName,state
gh repo view --json owner,name
```

Then fetch all review comments:

```bash
# Inline review comments with file + line context
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --jq '.[] | {id: .id, author: .user.login, path: .path, line: .line, body: .body, created_at: .created_at, in_reply_to_id: .in_reply_to_id}'

# General PR comments
gh api repos/{owner}/{repo}/issues/{pr_number}/comments \
  --jq '.[] | {id: .id, author: .user.login, body: .body, created_at: .created_at}'

# Review submissions
gh pr view --json reviews --jq '.reviews[] | {author: .author.login, state: .state, body: .body, submittedAt: .submittedAt}'
```

**1b. Diff Analysis** (parallel) — Launch the `pr-review:diff-analyzer` agent:
- Pass `mode: full`

## Step 2: Identify Revision Commits

From the commit log, identify which commits were made after the initial review (usually the most recent ones). Use timestamps from the review comments vs commit dates.

```bash
git log {base}..HEAD --oneline --format="%h %s %ai"
```

## Step 3: Run Re-Review

Launch the `pr-review:pr-re-reviewer` agent with:
- `ticket_id`: extracted from branch name
- `diff_analysis`: from Step 1b
- `original_comments`: all review comments from Step 1a
- `author_replies`: any replies to review comments from Step 1a
- `revision_commits`: the commits identified in Step 2

The agent will verify each comment, check for regressions, and produce a verdict.

## Step 4: Run Quality Checks

Launch the `code-quality:quality-checker` agent with:
- `scope: all`

## Step 5: Present Verdict

Present the re-review report from Step 3, followed by quality check results from Step 4.
