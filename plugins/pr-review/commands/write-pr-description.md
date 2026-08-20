---
description: Generate a complete PR description from tracker context and the branch diff.
argument-hint: "[ticket key]"
---

# Write PR Description

**Orchestrator** — delegates to specialized agents in sequence.

---

## Step 0: Resolve project knowledge (stop-point)

**Coding standards link** — used for one line of the generated requirements checklist.

1. Read the `codingStandardsUrl` config. If set, pass it to `pr-description-writer`.
2. If unset, look for what this repository already points at: a standards link inside `.github/pull_request_template.md`, a `CONTRIBUTING.md`, or a `docs/coding_standards/` or `doc/standards/` directory. If you find one, use it and say where it came from.
3. If still unresolved, ask **once**:
   - **"It's here: `<url or path>`"** — pass it through, and tell the user to set `codingStandardsUrl` to avoid the question next time.
   - **"Omit that line"** — the writer drops the standards checklist item rather than emitting a broken link.

This affects a single checklist line, so keep it to one question and default to omitting. Do not block the description on it.

## Step 1: Load Context (run in parallel)

**1a. JIRA Context** — Launch the `ticket-context:jira-context-loader` agent:
- Let it extract the ticket ID from the current git branch
- Pass `depth: full`

**1b. Diff Analysis** — Launch the `pr-review:diff-analyzer` agent:
- Pass `mode: summary` (file categories and deployment signals, no full diff needed)

## Step 2: Generate PR Description

Launch the `pr-review:pr-description-writer` agent with:
- The JIRA context from Step 1a
- The diff analysis from Step 1b

The agent will:
- Generate the complete PR description using the PR description template defined in that agent
- Auto-detect deployment requirements (migrations, ENV vars, feature flags, gems)
- Auto-determine the requirements checklist (RuboCop, ESLint, docs)
- Ask the user for screenshots, QA notes, and anything else that can't be inferred — in one consolidated message

## Step 3: Offer to Refine

After presenting the draft, ask:
> "Does this look accurate? Let me know if any section needs adjusting — especially QA Notes, Screenshots, or Deployment Notes — and I'll revise it."

Iterate until the user is satisfied.

---

$ARGUMENTS
