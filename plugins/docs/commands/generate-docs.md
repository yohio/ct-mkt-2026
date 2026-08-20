---
description: Generate or refresh documentation from the code — any project, any stack. No arguments documents this branch's changes.
argument-hint: "[subject | this branch | ticket key]"
---

# Generate Documentation

**Orchestrator** — delegates to the `docs:docs-writer` agent, which reads the actual code and writes documentation for whatever project you are currently in.

Works on any project and any stack. The agent detects the project, the stack, and (for multi-site/multi-tenant projects) which audience the subject belongs to before writing anything.

---

## Step 1: Interpret the Request

`$ARGUMENTS` is the documentation request. Interpret loosely.

**If arguments name a subject** — a feature, workflow, topic, or setup task — this is a **prompt-driven** run. Pass the request through verbatim; do not rewrite the user's intent into your own words.

Examples:
```
/generate-docs Document the user acknowledgement workflow including deadlines and reminders
/generate-docs Create a setup guide for SSO integration with Okta
/generate-docs Generate API documentation for the SCIM user provisioning endpoints
/generate-docs Troubleshooting guide for PDF generation failures
```

**If arguments are empty**, or refer to changes rather than a subject (`this branch`, `my changes`, `this ticket`, a ticket key), this is a **diff-driven** run. Tell the agent to run in Mode B against the current branch.

Examples:
```
/generate-docs
/generate-docs update the docs for the changes on this branch
/generate-docs PROJ-4711
```

If a ticket key appears in the arguments or the branch name, pass it along as scoping context — the agent uses it to find the relevant change set and any existing docs, not to fetch the ticket.

## Step 2: Delegate

Launch the `docs:docs-writer` agent with:

- The verbatim request (Mode A) or the instruction to reconcile docs against the current branch diff (Mode B)
- The current working directory, so it detects the right project
- Any ticket key found

Do **not** pre-analyse the codebase yourself before delegating. The agent's Phase 0 detection is the point — duplicating it here wastes context and risks handing it stale assumptions about the stack.

## Step 3: Present the Result

Relay the agent's report. Lead with the parts the user must act on rather than the file list:

1. **Unverified claims** — anything a human must confirm. Surface this first; it is the difference between usable docs and confident fiction.
2. **Files written or updated** — with paths.
3. **Stale docs corrected** — statements that were false before this run.
4. **Deliberately not documented** — and why. Do not drop this; silence here reads as full coverage.
5. **Discrepancies found** — where `CLAUDE.md`, `README`, or existing docs contradict the code. Worth raising even when the docs themselves were the goal.
6. **Screenshot placeholders** — where images are needed.

If the agent reported no documentation was needed, say so plainly and stop. Do not pad the result.

## Step 4: Hand Off

Never commit or push. List the files that were written or changed so the user can stage them, and offer a suggested commit message if the set is coherent.

If the agent flagged unverified claims or discrepancies, ask whether to dig into any of them before the user commits.
