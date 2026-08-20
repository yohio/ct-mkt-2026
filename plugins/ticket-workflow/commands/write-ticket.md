---
description: Draft ticket content in your team's story format from the current conversation.
argument-hint: "[brief subject]"
---

# Write JIRA Ticket

**Orchestrator** — gathers conversation context, then delegates to the ticket-writer agent.

---

## Step 0: Resolve the story template (stop-point)

A ticket in the wrong format gets bounced, so resolve the template before drafting.

1. Read the `ticketTemplatePath` config. If set and the file exists, pass it to `ticket-writer` as `ticket_template_path`.
2. If unset, look for a format the repository or tracker already defines: `.github/ISSUE_TEMPLATE/`, `.gitlab/issue_templates/`, `doc/ticket-template.md`, or any file whose name contains `story` or `ticket` and `template`.
3. If still unresolved, ask via `AskUserQuestion`:
   - **"It's at `<path>`"** — pass it through, and tell the user to set `ticketTemplatePath`.
   - **"Create one now"** — copy `${CLAUDE_PLUGIN_ROOT}/templates/ticket-story.md`, ask where to write it (default `.claude/ticket-story.md`), then pass it on. Tell the user to fill in the team-checklist section, since that part cannot be inferred.
   - **"Use a generic structure"** — `ticket-writer` falls back to its built-in structure and states in the output that it is not the team's format.

## Step 1: Gather Context from Current Conversation

Review the current conversation to extract all relevant context:
- What feature, bug, or task has been discussed?
- What decisions have been made?
- What technical details have been uncovered?
- What spike or investigation findings exist?
- What requirements or acceptance criteria have been mentioned?

Summarize this into a structured context block.

## Step 2: Load Prior Work (if applicable)

If a JIRA ticket ID is known (from branch name or user mention), launch these in parallel:

**2a. Prior Work** — Launch the `ticket-context:prior-work-loader` agent:
- Pass the ticket ID (if known)

**2b. Parent Ticket** — Launch the `ticket-context:jira-context-loader` agent:
- Pass the parent ticket ID if the user provided one, or the current ticket if this is a sub-task
- Pass `depth: brief`

If no ticket ID is known, skip this step.

## Step 3: Generate Ticket Content

Launch the `ticket-workflow:ticket-writer` agent, passing `ticket_template_path` from Step 0 (omit if the user chose a generic structure) with:
- `context`: the conversation context summarized in Step 1
- `prior_work`: findings from Step 2a (if any)
- `parent_ticket`: parent context from Step 2b (if any)
- `ticket_type`: Story (default), or Bug/Task/Sub-task if the user specified

## Step 4: Handle Insufficient Context

If the ticket-writer agent returns questions instead of a ticket, present them to the user. After the user answers, re-launch the agent with the original context plus the new answers.

## Step 5: Present the Ticket

Display the generated ticket content. The user will copy-paste it into JIRA.

Ask: "Does this look complete? Let me know if any section needs adjusting."

Iterate until the user is satisfied.

---

$ARGUMENTS
