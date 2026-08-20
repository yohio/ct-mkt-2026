# Branded CSS Rules

Rules for `@apply` Tailwind component CSS in projects that support multiple brands within the same codebase. Aligned with the canonical team docs at `{team_standards_root}/css/tailwind/README.md`.

## Rule 1: Tailwind component CSS = single HTML tag only

A `.button { @apply ... }` rule is fine — `<button>` is one tag. A `.user-card { @apply ... bg-white p-4; .user-card-header { @apply ... } .user-card-body { @apply ... } }` rule is not — that's a multi-element pattern, which belongs in a ViewComponent or partial, not in CSS.

This rule comes directly from the team Tailwind docs: *"Tailwind components should be reserved for the most granular level of content; they should match 1:1 with a single HTML tag."* Multi-element bundles get a ViewComponent or partial; the file under `tailwind/components/<name>/<brand>/` is reserved for single-tag styling.

## Rule 2: Never share component CSS across brands

When two brands need the same conceptual element (e.g., a button) but with different visual treatments, they get **separate files in sibling brand directories**. Never merge them with `@apply`-conditioned-on-context tricks, never use parent class selectors like `.brand-a .button` to override.

```
app/assets/stylesheets/tailwind/components/button/brand-a/button.css
app/assets/stylesheets/tailwind/components/button/brand-b/button.css
```

Each brand's application stylesheet imports only its own:

```css
/* app/assets/stylesheets/tailwind/brand-a_components.css */
@import 'components/button/brand-a/button';

/* app/assets/stylesheets/tailwind/brand-b_components.css */
@import 'components/button/brand-b/button';
```

## Why per-brand sibling directories

- Changes to brand A can never leak to brand B.
- The directory structure shows at a glance which brands implement which components.
- Each brand bundle is smaller (only contains the components actually used).
- New components for one brand don't accidentally render in the other if a class collides.

## Naming the brand directory

Match the project's existing naming. For two-brand projects (IT/HR, B2B/B2C, etc.), the brand directory name is short and lowercase (e.g., `it`, `hr`, `b2b`). For projects with more brands or sub-brands, the names should be self-explanatory.

## Grouping variants in one file

Per the team docs' canonical example:

```css
@layer components {
  .button       { @apply inline-block py-2 px-4 rounded-sm; }
  .button-blue  { @apply bg-blue-600 hover:bg-blue-500 text-blue-50; }
  .button-green { @apply bg-green-500 hover:bg-green-400 text-green-50; }
}
```

**Group a component's variants in one file** (`button.css` containing `.button`, `.button-blue`, `.button-green`). Resist over-granular splitting into `button-blue/`, `button-green/` directories — the team docs explicitly warn against component-library bloat. New conceptual components get a new directory; new visual variants of an existing component go in the existing file.

## Raw CSS alongside `@apply`

`@apply` is the canonical pattern for properties that have Tailwind utility equivalents. Properties that have no Tailwind utility (e.g., `filter:` chains for SVG tinting, `clip-path:`, `mask:`, `-webkit-text-stroke:`) can live as raw CSS in the same component file. They are still single-HTML-tag styling — just expressed in native CSS where `@apply` doesn't reach.

```css
@layer components {
  .icon-tinted {
    @apply h-6 w-6 inline-block;
    filter: brightness(0) invert(0.4) sepia(1) saturate(5) hue-rotate(220deg);
  }
}
```

## When the plan calls for new component CSS

The plan must list:
- The component name (e.g., `button`, `icon`, `select`)
- Each brand directory the file lives in (e.g., `it`, `hr`)
- The variants the file will contain (e.g., `.button`, `.button-blue`)

The implementer echoes this in the Migration Summary's "Style approach" section.

## Fallback if absent

If this file isn't present, the referencing agent should default to:

> When introducing `@apply` component CSS, restrict to single-HTML-tag patterns. Group variants in one file per component. If the project supports multiple brands, separate the component CSS by brand to avoid cross-brand style leaks.

— a competent default that lacks the sibling-directory prescription and the grouping-variants guidance.
