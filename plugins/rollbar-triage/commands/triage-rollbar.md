---
description: Triage Rollbar errors — pull the work list, root-cause each item against local code, cross-reference the tracker, and classify noise.
argument-hint: "[project] [environment] [level]"
---

# Triage Rollbar Errors

**Orchestrator** — pulls live Rollbar items, root-causes them against this repo's code, cross-references JIRA, and produces a triage + noise-reduction report.

Requires the `rollbar` MCP server (read-only token) and the `atlassian` MCP server to be connected.

The token is read-only, so this command **never mutates Rollbar state** (`update-item` is out of scope). Noise cleanup is delivered as a to-do list plus proposed code/config changes.

---

## Arguments

`$ARGUMENTS` may narrow the run. Interpret loosely:
- A **project** name → which configured Rollbar project to target. Default: the `defaultProject` plugin config; if that is unset, ask which project to target rather than guessing — the MCP runs in multi-project mode and every call needs an explicit project. The MCP runs in multi-project mode, so **every** `rollbar` tool call must pass `project=<name>`; if unsure of the available names, call `list-projects` first.
- An environment (e.g. `production`, `staging`) → filter items to that env. Default: the `defaultEnvironment` plugin config, or `production` when unset.
- A level (`error`, `critical`, `warning`) → minimum level. Default: `error`.
- A time window (`24h`, `since-deploy`, `7d`) → default `24h`. `since-deploy` uses `get-deployments` to find the latest deploy and filters to items active after it.
- A count (e.g. `top 10`) → how many items to triage. Default: top 10 by occurrences.
- A Rollbar item ID or counter → triage just that one item in depth (skip Step 1).

## Step 1: Pull the work list

Use the `rollbar` MCP:
- For a general sweep: `get-top-items` for the environment/window, or `list-items` with `status=active`, the requested level, and env.
- Rank by occurrence count. Take the requested count (default 10).
- Skip items already in `resolved` or `muted` status unless the user explicitly asks to review them.

Show a one-line-per-item summary (title, level, occurrences, first/last seen) before deep analysis.

## Step 2: Root-cause each item against local code

For each item, in parallel where possible (delegate to a general-purpose subagent per item to keep context lean, passing it the item details):
- `get-item-details` for the item → pull the exception class, message, and top of the stack trace.
- Map trace frames to files **in this repo** and read the relevant `file:line`. Ignore gem/framework frames; focus on app frames (`app/`, `lib/`, `config/`).
- Produce a root-cause hypothesis: is this a real bug, a transient/infra issue, expected-but-unhandled, or already fixed on a newer version (`get-version` / `get-deployments` to check if last-seen predates a recent deploy)?

## Step 3: Cross-reference JIRA

For each item, use the `atlassian` MCP (`searchJiraIssuesUsingJql`) to find an existing ticket:
- Search on the exception class name, a distinctive message fragment, and the suspected file.
- Classify each item as one of:
  - **Ticketed** — matching JIRA issue exists → cite the key and its status.
  - **Untracked bug** — real bug, no ticket → draft a ticket via the `ticket-workflow:ticket-writer` agent if it is available (it belongs to the `ticket-workflow` plugin and applies your team's story format); if it is not installed, output the ticket content inline instead but do **not** create it; present for approval.
  - **Noise** — not worth a ticket (see Step 4).

## Step 4: Noise classification

Flag items as noise candidates when they are: expected exceptions (bot traffic, malformed requests, client aborts), already-ignored-elsewhere patterns, or superseded by a fix. For each noise candidate recommend the cheapest durable fix:
- **Config-side** — add the class to `config.exception_level_filters` (`ignore` or a lower level) in `config/initializers/rollbar.rb`. Note the existing `ActionController::RoutingError => 'ignore'` precedent.
- **Code-side** — rescue/handle at the right layer instead of letting it bubble to Rollbar.
- **Rollbar-side** — items to mute/resolve manually in the Rollbar UI (list them; the read-only token can't do this automatically).

## Step 5: Report

Present a single report:

| Item | Level | Occ. | Root cause | Suspected `file:line` | JIRA | Verdict |
|------|-------|------|------------|----------------------|------|---------|

Then:
- **Untracked bugs** — the drafted tickets, for approval before creating.
- **Noise cleanup** — proposed `rollbar.rb` diff + the manual mute/resolve to-do list.
- **Needs a human** — anything ambiguous, with the specific question.

**Never write to JIRA or Rollbar** (no comments, no ticket creation, no transitions, no `update-item`) — even if asked. Instead, output human-sounding, ready-to-paste text for the user to post themselves. Do not open PRs or edit files without explicit approval.

---

$ARGUMENTS
