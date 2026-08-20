# Page CSS Decomposition

When (rarely) `tailwind/pages/<brand>/<page>.css` is acceptable, and how to keep it minimal. Aligned with the canonical team docs at `{team_standards_root}/css/tailwind/README.md`.

The team docs do not describe a `pages/` directory. They describe:

- **Tailwind components** (`@apply` inside `@layer components`, 1:1 single-HTML-tag) at `tailwind/components/<name>/<brand>/`
- **ViewComponents / partials** for multi-element bundles

The `pages/` directory exists in the codebase as a legacy convention from early Tailwind setup. Treat it as a last resort.

## The default answer is no page CSS file at all

Per the team docs and recent migration PRs, a Tailwind migration produces:

1. **Tailwind component CSS** at `tailwind/components/<name>/<brand>/<name>.css` for single-HTML-tag patterns — `@apply` inside `@layer components`, variants grouped together.
2. **Partials or ViewComponents** for repeating multi-element bundles. Each feature card, testimonial, FAQ item lives in its own `_card.html.erb` partial under `app/views/<scope>/<parent>/`.
3. **Inline Tailwind utilities** on the DOM for one-off styling on a single element that has no reusable name.

If you find yourself writing a `tailwind/pages/<brand>/<page>.css` file, walk back and ask whether the rules belong in one of the three categories above instead.

## When page CSS is genuinely justified

The narrow case: a rule that **cannot be expressed in component CSS / partial / inline AND is intrinsically page-scoped**. The clearest example is **a multi-stage background-image swap with Rails asset paths**:

```css
& .section-3 {
  background-image: url('hr/hr-diagnostics/engaged-employees-bg.png');
  @media (max-width: 1199px) { background-image: url('hr/hr-diagnostics/engaged-employees-bg-mid.png'); }
  @media (max-width: 767px)  { background-image: url('hr/hr-diagnostics/mobile-test.png'); background-position: top; }
}
```

This can't be inline because Tailwind's `bg-[url(...)]` arbitrary value is compiled at CSS time and won't resolve Rails asset digests. The `style="background-image: url(<%= image_path ... %>)"` inline approach only handles one breakpoint. So this rule earns its place in `pages/<brand>/<page>.css`.

A page-scoped filter override or single-property tweak (e.g. `& .fa-button-dark-purple { filter: drop-shadow(...) }` scoping a global component's shadow to this page only) is also acceptable if a per-instance inline `style="..."` would mean repeating the override on every instance on the page.

## What does NOT belong in page CSS

These were once permitted by this file. They no longer are; they belong in component CSS / partials / ViewComponents per team docs:

- **Single-HTML-tag styling reused across multiple instances** (e.g. `.btn-acquire`, an icon tint). Belongs in `tailwind/components/<name>/<brand>/<name>.css`.
- **Long filter() chains used as icon tints.** Single-HTML-tag pattern. Belongs in `tailwind/components/<icon-name>/<brand>/<icon-name>.css` (raw CSS sits alongside `@apply` lines in the component file).
- **Repeating multi-element layouts** (feature cards, testimonial cards, FAQ items). These are partials or ViewComponents per the team docs' "bundles of elements" rule.
- **Named `grid-template-areas` reorders across multiple breakpoints.** Replace with `grid-cols-N` + `col-span-N` on the title (for "title spans top row" patterns) and let cells auto-flow. If the layout truly needs named areas, put the rule **inside the partial or ViewComponent template** that renders the grid container, not in a page CSS file.

## The failure mode this file exists to prevent

**Do not port the source SCSS file 1:1 into native CSS in a `pages/` file.** The single most common failure: "the SCSS file is 948 lines, I'll translate it to native CSS and put it under `tailwind/pages/`." The result is a 700+ line "Tailwind" page CSS file that is functionally still Bootstrap-era SCSS with the framework swapped. It is not a migration. It is a relocation.

**Correct starting point:** open an EMPTY page CSS file (or no file). Walk the source SCSS rule by rule. For each rule, choose its canonical home:

1. **Single-HTML-tag pattern with variants** → Tailwind component CSS at `tailwind/components/<name>/<brand>/<name>.css` (`@apply` inside `@layer components`).
2. **Multi-element bundle** → partial or ViewComponent. Inline the Tailwind utilities on the rendered markup.
3. **One-off styling with no reusable name** → inline utility classes on the DOM element.
4. **Irreducible page-specific rule** (asset-URL background swap across breakpoints, page-scoped override of a global class) → page CSS, kept small.

If the resulting `pages/` file is anything more than ~20–30 lines, you almost certainly missed a component / partial / ViewComponent opportunity.

## What can go in a `pages/<brand>/<page>.css` file (narrowly)

After exhausting component-CSS / partial / ViewComponent / inline options, these are the remaining cases:

- **Multi-stage `background-image: url(...)` swaps with Rails asset paths.** Tailwind's `bg-[url(...)]` doesn't resolve asset digests; an inline `style="..."` can't carry multiple breakpoints. A small CSS rule with `url(...)` calls inside `@media` blocks is the answer.
- **A small page-scoped override of a globally-available class** (e.g. `#page-id .global-component { filter: drop-shadow(...) }` when the override is specifically for this page only). Inlining would mean repeating the override on every instance of the class on this page.

Notable absences from this list compared to older versions of this doc:

- ~~Grid-template-areas reorders~~ → use `grid-cols-N` + `col-span-N` on the title, or put the rule inside the partial/ViewComponent that renders the grid container.
- ~~Long filter() chains on icons~~ → single-HTML-tag pattern; goes in `tailwind/components/<icon-name>/<brand>/`.
- ~~Keyframe animations~~ → put them next to the component that uses them, in that component's CSS file.
- ~~Pseudo-elements~~ → if they style a single HTML tag, they belong in a `tailwind/components/` file.

## Size expectations and validator behavior

A justifiable `pages/<brand>/<page>.css` file typically lands at **<30 lines**. If you're writing more, you almost certainly missed an extraction opportunity. Stop and decompose further.

**Enforcement.** `${CLAUDE_PLUGIN_ROOT}/scripts/tailwind-migration-validate.mjs` (rule R5) fails on any added file under `app/assets/stylesheets/tailwind/pages/` over 150 lines. That ceiling exists to catch egregious cases (the 700-line SCSS-port failure mode); it is intentionally lenient. The aspirational target is much tighter — most page CSS files should be 10–30 lines or not exist at all.

If a file genuinely needs to exceed 150 lines, the override is a file-header magic comment:

```css
/* tailwind-migration-allow-large: <justification with rule budget> */
```

Before adding the override, exhaust the component / partial / ViewComponent options. Overrides are visible in PR review and require justification.

## How to do the decomposition

When the migration plan involves an existing page with a large SCSS source:

1. List every rule in the source CSS / SCSS.
2. For each rule, ask: "What is the *shape* of what this styles?"
   - Single tag with variants → Tailwind component CSS.
   - Multi-element bundle → partial or ViewComponent (inline utilities on the markup).
   - One-off element styling with no reusable name → inline utility classes.
   - Asset-URL multi-breakpoint background or page-scoped override → page CSS.
3. After the split, the page CSS file should have only the irreducible rules.
4. If it still feels large, walk the rules again — there is almost always more that could move to a component file or partial.

## Counterexample (what NOT to do)

A 313-line page CSS file that ports the entire SCSS `_page_layout.scss` 1:1 — including button styles, icon filter chains, card grids, typography — is wrong. Those rules each have a canonical home (button → component CSS; icon tint → component CSS; card → partial; typography → inline utilities). The page CSS file should retain only the irreducible asset-URL swap or page-scoped override — typically far fewer than 50 lines.

The earlier engagement_program migration is a real example (root-cause writeup in `{notes_root}PROJ-1234-Migration-Tool-Postmortem.md`). The refactored version brought the page CSS from 735 lines to 19.

## Where the file lives

`app/assets/stylesheets/tailwind/pages/<brand>/<page-slug>.css`

Wired into the Tailwind asset bundle for that brand via `@import 'pages/<brand>/<page-slug>'` in the brand's application stylesheet.

## Scoping with a page-level ID

The CSS file's rules should all be scoped under the page's wrapping ID (`#new-hire-survey { ... }`) so they don't leak to other pages. If the view doesn't have a stable page-level ID, add one to the wrapping element before the migration.

## Fallback if absent

If this file isn't present, the referencing agent should default to:

> When the migration involves a page layout that's too complex for component CSS / partials / inline utilities, place a page-specific CSS file scoped to a page ID and keep it as small as possible.

— a competent default that lacks the explicit "what goes where" decomposition, the 150-line ceiling, and the decomposition discipline.
