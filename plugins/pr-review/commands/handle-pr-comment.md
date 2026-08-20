---
description: Analyze open PR review comments and decide, per comment, whether it needs a code change or a reply.
argument-hint: "[PR number]"
---

# Handle PR Comment

**Orchestrator** — delegates to specialized agents in sequence.

---

## Step 0: Resolve project knowledge (stop-point)

**Prior work notes** matter more here than in a normal review. This command's core judgment is whether a reviewer's comment contradicts a decision that was already made and recorded — and that verdict is *"reply citing the decision"*, not *"change the code"*. Without prior work, every such comment silently becomes a code change.

1. If `priorWorkRoot` (owned by the `ticket-context` plugin) is set, `prior-work-loader` resolves it itself. Continue.
2. If unset, that agent reports "No prior work directory configured". When it does, ask **once** via `AskUserQuestion`:
   - **"It's at `<path>`"** — re-run `prior-work-loader` with that path passed explicitly for this run, and tell the user to set `priorWorkRoot` so it persists.
   - **"Create a notes directory now"** — create it at a path the user names (default `.claude/prior-work/`), note that it is empty for this ticket, and continue. Tell them to set `priorWorkRoot` to it.
   - **"I don't keep local notes"** — continue, and add a line to your final output stating that comment classification ran without prior-decision context, so the user knows to check any "CODE CHANGE" verdict that touches a settled design question.

Never ask twice in one run, and never ask what the repository already answers.

## Step 1: Load Context (run in parallel)

**1a. JIRA Context** — Launch the `ticket-context:jira-context-loader` agent:
- Let it extract the ticket ID from the current git branch
- Pass `depth: brief` (just scope and acceptance criteria)

**1b. Prior Work** — Launch the `ticket-context:prior-work-loader` agent:
- Pass the ticket ID

## Step 2: Analyze Comments

Launch the `pr-review:pr-comment-handler` agent with:
- The JIRA context from Step 1a (scope and acceptance criteria)
- The prior work from Step 1b (spike decisions, rationale)
- If a specific comment number or author was provided as an argument, pass that along so the agent focuses on it

The agent will:
1. Fetch all PR comments (inline + general)
2. Analyze the branch diff
3. Classify every comment (bug, scope question, code quality, testing gap, architecture, clarification, nitpick, praise)
4. Decide for each: **CODE CHANGE** (with exact fix) or **REPLY ONLY** (with copy-paste reply)

---

$ARGUMENTS
