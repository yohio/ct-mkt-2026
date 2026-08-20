---
description: "Run a spike: investigate standards and the codebase, then produce a plan with ticket breakdown and estimates."
argument-hint: "[ticket key]"
---

# Run Spike Investigation and Planning

**Orchestrator** — investigation first (with a checkpoint), then planning, then archive.

> **Note on freshly-installed agents:** if `spike-investigator` or `spike-planner` were installed or modified during the current Claude Code session, they may not be dispatchable via `subagent_type` until Claude Code is restarted (the dispatcher snapshots the agent registry at session start). If a dispatch fails with "Agent type ... not found", restart Claude Code and rerun this command — the on-disk agent files will be picked up.

---

## Step 0: Resolve project knowledge (stop-point)

Two inputs below are project-specific. Resolve them **before** launching any agent, so the plan reflects house patterns rather than generic ones, and so nothing gets written where the user did not expect it.

**0a. Team standards documentation** — read before planning, so the plan follows the team's conventions.

1. Read the `teamStandardsRoot` config. If set, resolve `{team_standards_root}` to it.
2. If unset, look for standards the repository already carries: `docs/coding_standards/`, `doc/standards/`, `CONTRIBUTING.md`, or a `.claude/` standards directory.
3. If still unresolved, ask via `AskUserQuestion`:
   - **"They're at `<path>`"** — use it, and tell the user to set `teamStandardsRoot`.
   - **"Plan from the codebase alone"** — proceed, and **say so in the output**: the plan then rests on observed patterns, which are evidence of what was done, not authority on what should be done.

**0b. Notes archive location** — where the spike report or work plan gets written.

1. Read the `notesRoot` config. If set, resolve `{notes_root}` to it.
2. If unset, ask before writing anything:
   - **"Write them to `<path>`"** — use it, and tell the user to set `notesRoot`. If `ticket-context`'s `priorWorkRoot` is already set, **offer that same path** — findings archived somewhere `prior-work-loader` does not look will never be found again.
   - **"Create a notes directory"** — default to `.claude/notes/` inside the repository.
   - **"Don't archive"** — return the findings in the conversation only, and say they were not persisted.

**Never write outside the repository without asking.** Ask any unresolved questions in a single `AskUserQuestion` call, and never ask what the repository already answers.

## Step 1: Load JIRA Context

Launch the `ticket-context:jira-context-loader` agent:

- Pass `ticket_id` if the user provided one as an argument; otherwise let the agent extract it from the current git branch.
- Pass `depth: full`

Display the JIRA summary to the user before continuing.

If no ticket can be identified (branch is `master`/`main` or has no ticket pattern), ask the user which ticket to spike on.

## Step 2: Load Prior Work (parallel with Step 1 if `ticket_id` is known)

Launch the `ticket-context:prior-work-loader` agent with the `ticket_id`.

If a previous spike or investigation exists, summarize it and ask the user whether this is a fresh spike or an update.

## Step 3: Read Relevant Documentation

Based on the ticket type from Step 1, read the applicable standards from `{team_standards_root}`:

- `coding_standards/ruby/rails/README.md` — Rails patterns
- `coding_standards/ruby/rails/testing/README.md` — testing philosophy
- `coding_standards/ruby/rails/service_objects.md` — if service objects relevant
- `coding_standards/ruby/rails/http_apis.md` — if API work relevant

Summarize the key applicable standards into a `documentation_notes` block. You'll pass this to both the investigator and the planner.

---

## Step 4: Investigation

Launch the `ticket-workflow:spike-investigator` agent, passing `team_standards_root` from Step 0a (omit if unresolved). Pass:

- `ticket_id` and `ticket_title` from Step 1
- `jira_context` — the full JIRA context from Step 1
- `prior_work` — findings from Step 2 (if any)
- `documentation_notes` from Step 3

The agent will review standards, investigate the codebase, and produce an **Investigation Report** covering applicable standards, codebase areas in scope, similar implementations, impact surface, risks, and open questions.

---

## Step 5: User checkpoint (RECOMMENDED)

Show a short summary of the Investigation Report to the user (impact surface, top risks, open questions). Ask:

- **Continue to planning?** → proceed to Step 6
- **Investigation needs more depth?** → re-run `spike-investigator` with the user's clarifying questions
- **Scope is wrong?** → stop the spike, advise the user to revisit the JIRA ticket

This checkpoint is not strictly required, but it lets the user redirect before the planner spends effort on the wrong premise. Skip it only if the user told you to run the full spike straight through.

---

## Step 6: Planning

Launch the `ticket-workflow:spike-planner` agent. Pass:

- `ticket_id` and `ticket_title` from Step 1
- `jira_context` from Step 1
- The full **Investigation Report** from Step 4
- `prior_work` from Step 2 (if any) — for reconciliation

The agent will design the technical approach, document key decisions with trade-offs, break the work into JIRA tickets, and estimate sprints. Output: a presentation-ready **Spike Plan**.

---

## Step 7: Archive Findings

Launch the `ticket-workflow:findings-archiver` agent, passing `notes_root` from Step 0b (omit it entirely if the user chose not to archive) with:

- `source`: `run-spike`
- `ticket_id` and `ticket_title` from Step 1
- `findings`: the Investigation Report from Step 4 **and** the Spike Plan from Step 6 (concatenated, with the Plan first since it's the deliverable and the Report is supporting material)

Confirm to the user that findings were archived.

---

$ARGUMENTS
