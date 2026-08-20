# Story template

> Scaffold. Replace the bracketed guidance with your team's own process items, and
> delete sections your tracker does not use. The Acceptance Criteria and QA Plan
> guidance below is worth keeping — it is what makes a ticket testable.

Summary:

{One sentence, fewest words possible. No fluff.}

Background:

{Context for the change. Explain the issue and its history *without* proposing a
solution or drawing conclusions. Link related tickets, spikes, or design docs.}

Work Required:

{The work in business language — what changes from the user's perspective, not how it
is implemented. Keep it high-level; do not restate the whole workflow.}

Dependencies / Exceptions:

{Blockers, prerequisites, or anything needing visibility. If none: "None identified."}

Team checklist (remove any that do not apply):

{<TODO: replace with your team's standing checklist. Common items: specs written,
strings internationalized, analytics identifiers added, accessibility pass, asset
weight check, performance check, design sign-off, notify QA. Add who to notify for
shared surfaces such as nav, header, footer, and modals.>}

Acceptance Criteria:

{All functional requirements, as assertions. Cover:
- Every on-screen control and non-interactive element
- The initial state of the page or component
- The result of every interaction, across every workflow path
- Valid and invalid paths, distinguished
- Effects on at-rest data and on services
- The full workflow from entry through completion
- Non-functional requirements (design, performance) where they apply

Write them as testable assertions:
- GIVEN [precondition] WHEN [action] THEN [expected result]
- Or: "[Element] displays [content or behaviour] when [condition]"}

QA Plan:

{What a tester needs in order to prepare:
- User role and permissions required
- Environment setup
- Test data to create or configure
- Feature flags to enable
- Pages or URLs to exercise
- Specific browser or device requirements
- Edge cases to verify}
