# Cross-Page Impact Analysis

When a migration touches an element (partial, ViewComponent, helper, CSS file, or shared markup pattern) that's also used on **other pages**, the plan must explicitly address what happens to those other usages. Otherwise the migration creates one of three failure modes:

1. **Silent break** — the element is migrated; other callers depend on its old behavior; they break.
2. **Style drift** — the element is forked into Tailwind; other callers still use the Bootstrap version; over time the two diverge and visual consistency erodes.
3. **Maintenance debt** — both versions are maintained forever; nobody knows which to use.

This file defines the four acceptable strategies and a decision framework for choosing.

## The four strategies

### Option 1: Migrate in place (replace everywhere)

Update the partial / component to its Tailwind version. All N callers update at once.

- **Best when:** the change is small, mechanical, and visually equivalent (e.g., color class swap on a button)
- **Worst when:** the partial has callers in active development, or the migration risks visual regressions across many pages
- **Cost:** highest scope (every caller's tests must pass)
- **Reward:** zero maintenance debt; one source of truth

### Option 2: Fork (parallel Bootstrap + Tailwind versions)

Create a new Tailwind version at a sibling path (e.g., `customer_requests/bootstrap3/modal` → `customer_requests/tailwind/modal`). Use the new fork in the migration target only. Other callers unchanged until they themselves migrate.

- **Best when:** the partial has many callers (>10 typically) and migration must be incremental
- **Worst when:** the partial is small enough to inline, or the team commits to migrating all callers in one effort
- **Cost:** ongoing maintenance debt — two versions to track; risk of drift; requires a retirement plan for the Bootstrap version
- **Reward:** smallest immediate scope; lowest risk per migration

### Option 3: Extract to a shared ViewComponent

Wrap the element in a ViewComponent that branches its rendering based on layout context (Tailwind vs. legacy). All callers — Bootstrap-layout and Tailwind-layout — use the same component, which knows how to render in either world.

- **Best when:** the element is structural (button, card, modal scaffold) and used widely; the project commits to Tailwind eventually for all callers
- **Worst when:** the branching logic is complex (the component becomes hard to read), or the element is one-off
- **Cost:** medium upfront (ViewComponent design, dual rendering paths); pays back once 5+ callers have migrated
- **Reward:** unified call site; easier eventual retirement of the Bootstrap rendering branch

### Option 4: Migrate inline (skip the partial entirely)

For the migrated page only, copy the partial's markup inline (now in Tailwind) and don't render the partial. Other callers continue using the partial.

- **Best when:** the partial is small and one-off-ish; the migrated page is one of the last using it; the partial is being retired anyway
- **Worst when:** the partial encapsulates real logic or is used heavily
- **Cost:** the migrated page no longer benefits from partial-level changes
- **Reward:** smallest possible diff for THIS migration; doesn't touch shared code

## Decision framework

For each cross-page element, the planner must answer:

1. **How many callers?** Run `grep -r "render '<path>'"` (or equivalent for ViewComponents/helpers) and report the count.
2. **What's the change?** Pure-class swap, structural change, or behavioral change?
3. **Which option fits?**

| Caller count | Change scope | Recommended option |
|---|---|---|
| 0 callers (only this page uses it) | any | Option 1 (migrate in place) — there's nothing else to consider |
| 1–4 callers | mechanical (class swap, color) | Option 1 — small enough to update all callers; pays the lowest debt |
| 1–4 callers | structural | Option 3 (ViewComponent extract) if the element is reusable; Option 1 otherwise |
| 5–10 callers | mechanical | Option 1 if confident; Option 2 (fork) if risk-averse |
| 5–10 callers | structural / behavioral | Option 3 (extract) — pays back via callers' eventual migrations |
| 10+ callers | any | Option 2 (fork) by default. Migrating 10+ pages in one effort is a separate project. |
| Active development on other callers | any | Option 2 — don't merge into someone else's in-flight work |

## Required outputs in the plan

For each cross-page element identified in discovery, the plan must include:

```markdown
### Element: {path or identifier}

- **Callers:** {N} files (list at most 5; ellipsis the rest)
- **Strategy:** Option 1 / 2 / 3 / 4
- **Justification:** {one-line reason — change scope, caller activity, future plan}
- **Retirement plan (if Option 2):** how does the Bootstrap version eventually go away?
```

The implementer enforces the choice — never silently widens scope by editing other callers, never narrows scope by skipping a partial that the plan said to fork.

## Anti-patterns

- **"Just migrate the partial; the other 190 callers will be fine":** they won't.
- **"Fork now; figure out retirement later":** the Bootstrap version becomes permanent. Document the retirement plan in the Migration Summary even if it's "TBD — track in a follow-up ticket."
- **"Migrate the partial AND its callers in one PR":** PR review burden grows linearly with caller count. 10+ callers in one PR is risky; split into separate efforts.

## Companion check: `.js.erb` AJAX response templates

When a form in scope uses `remote: true` (Rails UJS) — `form_for ..., remote: true` or `data-remote="true"` — the response is a `.js.erb` template that runs JS against the live DOM. Those templates were written assuming the Bootstrap-modal structure that wraps the form.

For each `remote: true` form in scope:

1. Find the controller action that handles the submission (`grep "def create" app/controllers/.../<resource>_controller.rb`).
2. Find the matching response template (`app/views/<resource>/create.js.erb` or `update.js.erb`).
3. Read it end-to-end. List every selector and every event listener it uses.
4. Those selectors / events are **DOM contracts** the migrated wrapper must preserve OR translate.

The cross-page-impact strategy choice (Options 1-4) applies here too:

- **Preserve the legacy class names** on the migrated wrapper (cheapest)
- **Wrap a modern element with a controller that emits the legacy events** (e.g., custom Stimulus controller dispatching `hidden.bs.modal` from a native `<dialog>`'s `close` event)
- **Migrate the `.js.erb` template** alongside the wrapper if no other callers depend on the contract

For the cross-flavor catalogue of these contracts, see `bootstrap-tailwind-coexistence.md`.

## Fallback if absent

If this file isn't present at runtime, the referencing agent should default to:

> When a migrated element is used by other pages, prefer forking (Tailwind version alongside Bootstrap version) for elements with many callers, and migrating in place for elements with few callers. Surface the caller count in the plan.

— a competent default that lacks the four-option taxonomy and the threshold-based decision framework.
