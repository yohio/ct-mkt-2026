# Top-Down DOM Traversal

How to order migration work within a single page. Migrate the DOM top-down, depth-first, with user validation at each section boundary. This bounds risk: every committed change is small enough to inspect and the user can redirect cheaply if a section goes off-track.

## Why this order matters

Migrating a whole page as one big diff has three failure modes:

1. **Compounding mistakes** — a wrong translation in section A breaks how section B reads, but the implementer doesn't notice until the whole thing is done. By then it's a 30-file diff to unwind.
2. **Late validation** — the user only sees output after everything is done, at which point pointing at "this region looks wrong" requires bisecting which section caused it.
3. **Structural cascades** — restructuring section A's wrapper (e.g., adding `.solution-set-content-holder`) affects every child section. If sections were migrated bottom-up, the children get re-fitted; top-down means the structure is set before children are placed inside.

Top-down depth-first solves all three: each section is small, validated before the next starts, and structural decisions cascade downward correctly.

## The traversal order

Given a DOM tree, migrate in this order:

```
<div id="1">                  ← (1) outermost wrapper
  <div id="2">                ← (2) first immediate child
    <div id="3"></div>        ← (3) first grandchild
    <div id="4"></div>        ← (4) second grandchild
  </div>
  <div id="5">                ← (5) second immediate child
    <div id="6"></div>        ← (6) first grandchild of #5
    <div id="7"></div>        ← (7) second grandchild of #5
  </div>
</div>
```

Order: 1 → 2 → 3 → 4 → 5 → 6 → 7

In words: **migrate the outermost wrapper first; then recurse into each immediate child in source order; for each child, migrate the child itself THEN recurse into its children.**

This is *pre-order depth-first traversal*. The parent's structure is set before any descendants are touched.

## Section boundary definition

A "section" for migration purposes is **a contiguous DOM subtree that is meaningful as a visual unit and that can be validated independently**. Examples on a typical page:

- The page wrapper / `#new-solution-set` shell
- The hero region
- A CTA bar
- The main content column wrapper
- An individual feature row
- The sidebar wrapper
- The footer

Section boundaries should usually align with **semantic HTML landmarks** (`<header>`, `<nav>`, `<main>`, `<section>`, `<aside>`, `<footer>`) or **conceptual UI regions** (hero, CTA, body, sidebar).

A section is NOT typically:

- A single utility-class span deep inside a paragraph
- An icon inside a button
- A label inside a form-column

Those are translated *within* the section that contains them.

## Per-section workflow

For each section, in traversal order:

1. **Read the BS3 source for this section.** Pull up the snapshot HTML + relevant SCSS file. Catalogue every distinct class in the section.
2. **Read the BS3 SCSS rule per class** before mapping. Do not guess.
3. **Translate the section's outer wrapper + immediate content** to Tailwind. Leave nested children as-is for now (they'll be visited in subsequent iterations of this loop).
4. **Capture a screenshot** of the section in its current (mid-migration) state. Compare to the pre-migration screenshot of the same section.
5. **Surface to user** — "Section X migrated; here's the diff. Anything look off before I move on?"
6. **Wait for user gate** — Approved / Changes requested / Skip with note
7. **Move to next section in traversal order** (depth-first: descend into this section's children before moving to sibling sections)

## What "translate the section's outer wrapper + immediate content" means

When migrating section #2 in the example, you're migrating:

- The `<div id="2">` wrapper itself (its class names, structure)
- Any **direct content** of `<div id="2">` that isn't itself a section (text, inline images, links, simple spans)
- You are NOT migrating `<div id="3">` and `<div id="4">` yet — those are nested sections that get their own iteration

In practice this means: don't translate a wrapper that contains other regions in a single edit. Translate the wrapper, leave child regions as placeholders or with their existing BS3 classes, validate, then recurse.

## When a section is a forked partial

If a section is rendered via a forked Tailwind partial (e.g., `research/blueprints/tailwind/_solution_set_ctas.html.erb`), the section is the partial's content. Migrate the partial top-down using the same rules: outer wrapper first, then inner content, then any nested partials it renders.

## When a section is a retained BS3 partial

If a section renders a BS3 partial that the plan deferred (i.e., not in scope for this migration), document it in the parent section's notes as "Retained BS3 — see deferral list." Don't try to style the retained partial inline; if scoped page CSS is needed, place it in the page's CSS file scoped to the page wrapper.

## Sibling order matters

For sibling sections at the same depth, migrate in **source order** (top to bottom in the file). This matches the visual reading order on the page and lets the user validate visually as they scroll down.

Exception: if a sibling section is conditional (e.g., shown only for `internal_user?` or `premium_content?`), migrate the always-shown siblings first, then handle conditional ones. The reason: conditional sections require role-switching during validation, which is more work for the user — front-load the work they can validate from a single role.

## Stopping mid-page

The user can stop the migration at any section boundary. The section just completed should be in a working state (rendered, styled, validated). The remaining sections stay BS3-classed and will look unstyled — but the page won't crash.

This is the migration's natural commit boundary: after each section, the branch is in a *consistent* state where further work can be deferred.

## Re-traversal on user feedback

If during validation of section N, the user spots an issue in section N-2 (already-migrated), do NOT just patch section N-2 in place. Stop, return to section N-2, re-validate, then resume. Sequential validation is the point — patches-out-of-order reintroduce the compounding-mistakes failure mode this discipline exists to prevent.

## Fallback if absent

If this file isn't present at runtime, the referencing agent should default to:

> Migrate the page top-down: page wrapper first, then each immediate child region top-to-bottom; for each region, migrate it before descending into its children. Validate with the user at each region boundary before continuing.

— a competent default that captures the order but lacks the section-definition rigor and the stopping-rules.
