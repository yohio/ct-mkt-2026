# Frontend Migration Principles

Where styles should live when migrating from a legacy CSS framework (Bootstrap, custom design system, etc.) to a utility-first framework (Tailwind). Aligned with the canonical team docs at `{team_standards_root}/css/tailwind/README.md`.

## What the team docs prescribe

Two canonical homes for styles:

1. **Tailwind component CSS** (`@apply` inside `@layer components`) — for **single-HTML-tag** patterns. Lives in `app/assets/stylesheets/tailwind/components/<name>/<brand>/<name>.css`. One file per logical component, may contain a base class plus variants (e.g. `.button`, `.button-blue`, `.button-green` together in `button.css`, per the docs' own example).
2. **ViewComponent or partial** — for **multi-element bundles** (anything that is more than one tag with shared styling). Lives in `app/components/` (ViewComponent) or under the relevant view directory (partial).

That is the prescription. The docs do **not** mention a `pages/` directory, do **not** prescribe a hierarchy between component CSS and inline utility classes, and do **not** impose a "duplication threshold" before extracting to component CSS. Treat component CSS as a first-class, natural home for single-tag styling — not a last resort.

## Where inline utility classes fit

Inline Tailwind utility classes on the DOM element (`<div class="grid grid-cols-3 gap-4 py-8">`) are a useful third option for **one-off styling that has no reusable identity**. They are not "the default," and they are not "preferred over `@apply`." They are simply the right tool when:

- The styling is local to this one element on this one page (no repetition planned).
- Naming a component for it would feel manufactured (the styling has no conceptual name).
- The styling is composition / layout, not visual identity (`grid grid-cols-3 gap-4` on a one-off section wrapper).

If a pattern has a name (`btn-acquire`, `feature-card-icon`, `testimonials-icon`), put it in component CSS — that is what the team docs prescribe.

## Where page CSS files fit

The team docs do not prescribe `app/assets/stylesheets/tailwind/pages/<brand>/<page>.css`. The directory exists in the codebase but is not a canonical home. Use it only when no canonical option works — most notably:

- **Multi-stage `background-image: url(...)` swaps with Rails asset paths.** Tailwind's `bg-[url(...)]` arbitrary value doesn't resolve Rails asset digests, and an inline `style="..."` can only carry one breakpoint. A small CSS rule with `url(...)` references inside `@media` blocks is the remaining option.
- **A small page-scoped override of a globally-available class** (e.g. `#page-id .global-icon { filter: drop-shadow(...) }` when the override only applies on this page).

See `page-css-decomposition.md` for size discipline and what to keep out of page CSS.

## Decision flow

When deciding where a style rule belongs:

1. **Is this styling a single HTML tag, possibly with variants?** → Tailwind component CSS in `tailwind/components/<name>/<brand>/<name>.css` with `@apply` inside `@layer components`. Group related variants in the same file (e.g., button + button-blue + button-green per the team docs' example).
2. **Is this styling a bundle of multiple elements (card, modal, feature row, etc.)?** → ViewComponent or partial. Inline the Tailwind utilities on the rendered markup.
3. **Is this one-off styling with no reusable name?** → Inline utility classes on the DOM element.
4. **Is this irreducible to options 1–3** (Rails asset URL background swap across breakpoints, page-scoped override of a global class)? → Page CSS in `tailwind/pages/<brand>/<page>.css`, kept minimal.

This is a decision tree, not a "highest priority that fits" ranking. Pick the option that matches the *shape* of the style, not the lowest-numbered option that *could* be made to work.

## Helper methods (optional)

A Rails helper method that returns a class string can be useful when the same class list repeats across templates whose surrounding markup differs — but the helper hides intent. Prefer Tailwind component CSS for single-tag patterns and ViewComponents/partials for multi-element bundles. Reach for a helper only when neither shape fits.

## Migration mechanics

When migrating an existing CSS rule from a Bootstrap-era file:

- **Identify the markup it styles.** Single tag with variants? Multi-element bundle? One-off layout? Page-only background swap?
- **Place the style in its canonical home** (component CSS / partial-with-inline / inline / page CSS).
- **Never port the SCSS file 1:1 into native CSS in a `pages/` file.** That's a relocation, not a migration. The failure mode this exists to prevent is a 700-line "Tailwind" page CSS file that is functionally still Bootstrap-era SCSS with the framework swapped. See `page-css-decomposition.md`.

## CARDINAL RULE: Read the BS3 SCSS per class before translating

**Before mapping any BS3 class to Tailwind, open and read the BS3 SCSS rule for that exact class.** Do not guess. Do not infer from the class name. Do not skip "because the class name is self-explanatory."

This rule is non-negotiable and applies in both planning and implementation. The pre-migration snapshot (see `pre-migration-snapshot.md`) makes this fast: the SCSS files are already saved locally, and `00-INDEX.md` lists every class with a one-line description and a pointer to the SCSS line.

### Failure modes this rule exists to prevent

These are real mistakes seen on past migrations when the rule wasn't followed:

| Class | What the implementer guessed | What the BS3 SCSS actually said | Why it broke |
|---|---|---|---|
| `.surfaced-form` | "Small absolute-positioned box at top-right of hero" (`absolute top-0 right-0 w-[350px]`) | Full-width banner with vertical gradient at bottom of `.blueprint-page-banner` (`width: 100%; position: static; background: linear-gradient(0deg, $blue 0%, $blue-dark 100%);`) | Form sat misplaced in the top-right; hero content was visually crowded out. There are TWO `.surfaced-form` rules in BS3 — a generic one in `_layout.scss` and the page-specific override in `_publications_solution_sets.scss`. The page-specific one wins on the blueprint page; guessing from the generic one produced the wrong shape. |
| `.container` (Tailwind) | "Same as Bootstrap's `.container` — a fluid wrapper" → translated as `container mx-auto px-4` | Tailwind's `container` IS opinionated: max-width breakpoints (640/768/1024/1280/1536px) + `mx-auto px-4` adds 16px gutters. BS3's `.container` had gutters too, but the project's BS3 page CSS *overrode* `.container` for `#new-solution-set` to be full-width via a specific selector. | Migrated page had a 16px gutter that BS3 didn't, content was visually narrower. Fix was `w-full`, not `container`. |
| `.solution-set-content-holder` | "Just a semantic wrapper" — the implementer omitted it | At md+: `margin: 0 auto; max-width: 900px; padding-right: 25px` — an asymmetric reading-column constraint (the page's editorial layout pattern) | Migrated page had hero + CTAs sprawling across the full 2/3 column instead of being constrained to a 900px reading width with 25px right padding. Recovery required moving the wrapper back into the template and adding the rules to page CSS. |
| `bg-[#F2F2F2]` (Tailwind arbitrary value, uppercase hex) | "Hex is case-insensitive in CSS" | Tailwind JIT treats arbitrary-value class names as string-keyed cache entries; `[#F2F2F2]` and `[#f2f2f2]` are DIFFERENT cache keys, only one of which has a rule emitted | Sharing buttons rendered without backgrounds. Visible only by inspecting the built CSS for the specific class name. |
| `submit-tag-green` + `button-unlock-form-top` | "Some kind of submit button class" — left them in place | Both are BS3-only classes defined in `bootstrap3/global/_2018_buttons.scss` and `_layout.scss` — NOT imported in the IT Tailwind bundle. They render unstyled. Plus the lock icon was added via `.submit-tag-green-container::before { content: '\f023' }` pseudo-element. | Submit button looked unstyled. Icon was missing. Fix required replacing with `button-green-glowing` from the IT Tailwind component CSS and adding the icon as a DOM `<span class="fa-solid fa-unlock-keyhole">` inside the button. |

Every one of these was preventable by *reading the SCSS rule first*. Each cost cycles to discover and fix after the fact. The 30 seconds it takes to read a rule is the cheapest insurance in the workflow.

### How to apply the rule operationally

1. **Discovery phase**: snapshot the BS3 SCSS files (see `pre-migration-snapshot.md`) and build the `00-INDEX.md` class catalogue.
2. **Planning phase**: for every class mapping, cite the SCSS source location (`per pre-migration-snapshot scss/bootstrap3-partials-publications_solution_sets.scss:3493`). The class-mapping table's "BS3 source" column is REQUIRED.
3. **Implementation phase**: before translating any class, the implementer re-reads the SCSS rule (it's already saved locally — no extra steps needed). If the class doesn't appear in the snapshot, **STOP** and surface the gap to the user rather than guessing.

### When the SCSS isn't where you'd expect

Some BS3 classes have rules across multiple files (e.g., a base rule in `_layout.scss` and a page-specific override in `_publications_solution_sets.scss`). When you read one rule, search for the class name in OTHER SCSS files too — the page-specific override is usually the load-bearing one.

If you cannot find any SCSS rule for a class that appears in the rendered HTML, suspect one of:

- The class is purely a JS hook (no styling — verify in JS files before assuming)
- The class is dynamically generated and not in source SCSS
- The class is from an external library loaded at runtime

Document the diagnosis in the plan or migration summary; do not silently translate a class with no styling source.

## Brand separation

If the project supports multiple brands, follow `branded-css-rules.md`: component CSS lives at `tailwind/components/<name>/<brand>/<name>.css`, brand bundles import only the brand's files, and component files are never shared across brands.

## Fallback if absent

If this file isn't present at runtime, the referencing agent should default to:

> Single-HTML-tag styling goes in Tailwind component CSS (`@apply` inside `@layer components`), grouped by component with variants together. Multi-element bundles go in a ViewComponent or partial. Inline utility classes are appropriate for one-off styling. Avoid the `tailwind/pages/` directory unless no canonical home works.

— a competent default that mirrors the team docs' two-bucket rule.
