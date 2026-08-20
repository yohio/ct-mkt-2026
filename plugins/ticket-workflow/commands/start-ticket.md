---
description: Load ticket context and prior work, then produce a phased work plan.
argument-hint: "[ticket key]"
---

# Start Working on Ticket

**Orchestrator** — delegates to specialized agents in sequence.

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
- Pass `ticket_id` if the user provided one as an argument, otherwise let the agent extract it from the current git branch.
- Pass `depth: full`

Display the JIRA summary to the user before continuing.

If no ticket can be identified (branch is `master`/`main` or has no ticket pattern), ask the user which ticket to work on.

## Step 2: Load Prior Work (parallel with Step 1 if ticket_id is known)

Launch the `ticket-context:prior-work-loader` agent:
- Pass the `ticket_id`

If prior work is found, display a summary showing what was found. If a work plan already exists, ask the user whether to update it or start fresh.

## Step 3: Read Relevant Documentation

Based on the ticket type and description from Step 1, read the applicable standards:

| Ticket Involves | Read |
|----------------|------|
| Models/database | `{team_standards_root}/ruby/rails/README.md` |
| Service objects | `{team_standards_root}/ruby/rails/service_objects.md` |
| APIs | `{team_standards_root}/ruby/rails/http_apis.md` |
| Any code | `{team_standards_root}/ruby/rails/testing/README.md` |

## Step 4: Generate Work Plan

Launch the `ticket-workflow:work-planner` agent, passing `team_standards_root` from Step 0a (omit if unresolved) with:
- `ticket_id` and `ticket_title` from Step 1
- `jira_context`: the full JIRA context from Step 1
- `prior_work`: findings from Step 2 (if any)
- `documentation_notes`: key standards summarized from Step 3

## Step 5: Present Plan for Approval

Display the work plan from Step 4 to the user. Wait for approval:
- If approved → proceed to Step 6
- If changes requested → update and re-present
- If rejected → ask how they'd like to approach it differently

## Step 6: Archive Findings

Launch the `ticket-workflow:findings-archiver` agent, passing `notes_root` from Step 0b (omit it entirely if the user chose not to archive) with:
- `source`: `start-ticket`
- `ticket_id` and `ticket_title` from Step 1
- `findings`: the approved work plan from Step 4

Confirm to the user that findings were archived.

---

$ARGUMENTS
