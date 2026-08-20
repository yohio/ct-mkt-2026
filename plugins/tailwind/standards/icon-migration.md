# Icon Migration

When migrating buttons or other UI elements that use icons, **icons go in the DOM as `<span>` / `<svg>` elements, not as `::before` / `::after` pseudo-elements with `content: "\fXXX"`.**

This is a hard rule. Pseudo-element content is reserved for visual *chrome* (overlays, dividers, badges, slide-in backgrounds), never for icons.

## Use `<span>`, not `<i>`

Use `<span>` as the icon element, not `<i>`. The FA Kit JS auto-replacement works on either, but:

- `<i>` originally meant "italic" in HTML4; in HTML5 it means "alternate voice or mood." Neither is right for an icon — the semantic is wrong.
- Some assistive tech treats `<i>` differently from `<span>` (e.g., reading style cues that don't apply to icons).
- `<span>` is semantically neutral — purely a styling/scripting hook, exactly what an icon container should be.

The FA Kit JS replaces `<span class="fa-solid fa-X">` with `<svg>` the same way it replaces `<i>`. Same final DOM, better starting markup.

## Why icons go in the DOM (not pseudo-elements)

Pseudo-element icons rely on a fragile four-link chain:

1. The pseudo-element rule fires.
2. `content` is set (in FA 6 via a `--fa` custom property the v4 shim populates).
3. The element has the right compound classes (e.g., `fa fa-arrow-right`, not bare `fa-arrow-right`).
4. The webfont with the matching `font-family` + `font-weight` is loaded.

Each link is a documented foot-gun. Real bugs we've shipped this way:

- Migrating from the Bootstrap bundle to a Tailwind-only layout silently dropped FA 4's CSS rules. Buttons styled with `<a class="fa-arrow-right ...">` rendered without icons because the FA 6 Pro Kit's v4 shim requires the compound `.fa.fa-arrow-right`.
- `font-family: "FontAwesome"` (the FA 4 name) doesn't resolve under FA 6 Pro Kit, which exposes only `"Font Awesome 6 Pro"`. Icons rendered as missing-glyph rectangles.
- FA Kit subsets only the weights you've configured. `font-weight: 500` on a `:before` icon renders as missing-glyph if only weight 900 (Solid) was shipped.
- Pseudo-element `content:` text is poorly handled by screen readers — accessibility gap.

DOM-based icons have **one link**: the FA Kit JS replaces `<span class="fa-solid fa-X">` with inline `<svg>` on page load. SVG renders at correct size immediately, no font-loading race, no `--fa` chain, screen readers handle them properly with `aria-hidden`.

## How to apply

### Markup rewrite

When the migration source has either:

```scss
.btn::after {
  content: "\f019";
  font-family: "FontAwesome";
}
```

```html
<a class="fa-arrow-right">Text</a>
```

— rewrite to put the icon in the DOM. The icon class on the `<span>` itself names the icon, replacing both the variant CSS class on the parent and the `content` rule:

```erb
<%= link_to '...', class: 'btn' do %>
  <span class="fa-solid fa-download" aria-hidden="true"></span>
  Text
<% end %>
```

Block-form `link_to` is required when the link's content is more than just text. Helpers that took `(text, url, options)` positionally must convert to `(url, options) do ... end`.

### CSS pattern

Target the inner element directly. Cover **both** pre- and post-replacement state — there's a brief window where `<span>` exists before the FA Kit JS swaps it for `<svg>`:

```css
.btn > span:first-child,
.btn > svg:first-child {
  margin-right: 0.5em;
  font-size: 1.2em;
}

.btn:hover > span:first-child,
.btn:hover > svg:first-child {
  animation: bounceX 500ms infinite alternate;
}
```

Use `:first-child` when the icon precedes the text; `:last-child` when it follows. Drop the variant classes that existed only to signal "which icon" to the CSS — they're dead code once the markup carries the icon name.

### When the design needs an icon panel

If the original design has a distinctive icon panel (e.g., 45×45 solid square on the left of the button — the Bootstrap mixin button pattern), there are two paths:

**Path 1 — Wrapper.** Preserves the panel visual. Markup:

```erb
<%= link_to '...', class: 'btn-with-panel' do %>
  <span class="btn-icon-box">
    <span class="fa-solid fa-arrow-right" aria-hidden="true"></span>
  </span>
  Text
<% end %>
```

CSS uses the outer `<span class="btn-icon-box">` as the box; the inner FA `<span>` (or its replaced `<svg>`) renders at natural icon size centered in the box. Two nested spans is fine — outer is the panel, inner is the icon hook.

**Path 2 — Drop the panel.** Use a flatter modern button (text + icon inline, no panel). This is "visually equivalent" not "strict identical" — accept the visual evolution. Often the simpler choice for migrations.

The planner picks per-component based on the visual fidelity mode (see `visual-fidelity-modes.md`).

### Accessibility

- Decorative icons: `aria-hidden="true"`. The visible adjacent text carries the meaning.
- Icon-only buttons (no visible text): omit `aria-hidden` from the icon, add `aria-label="..."` to the parent button/link.

### Don't break the FA Kit auto-replacement

The kit's JS rewrites `<span class="fa-solid fa-X">` to `<svg>...</svg>` and **preserves the original classes** on the SVG element. So selectors like `.btn .fa-envelope` still match after replacement. Avoid relying on the element type alone if you can target by class — a class-based selector survives the swap cleanly.

## Discovery / Planner / Implementer responsibilities

- **Discovery** catalogues:
  - Each `:before` / `:after` rule with `content: "\fXXX"` on the source SCSS for the page.
  - Each markup occurrence using legacy FA classes (e.g., `.fa-arrow-right` without `fa-solid` / `fa` modifier).
  - Whether the target Tailwind layout loads FA 6 Pro Kit JS (and confirm the kit URL in the layout file).

- **Planner** specifies the DOM rewrite for each:
  - Which icon (FA 6 class name, e.g. `fa-solid fa-arrow-right`).
  - Position (first vs last child of the parent — left or right of the text).
  - Whether a wrapper is needed for an icon-box visual (panel preserved) or whether to flatten (panel dropped).

- **Implementer** rewrites:
  - Markup: convert positional `link_to` to block-form. Add `<span class="fa-solid fa-X" aria-hidden="true"></span>` with the right icon class.
  - CSS: drop variant `::after` / `::before` rules. Add `> span, > svg` rules. Update hover/focus animation selectors to target the inner element. If the legacy CSS used `font-family: "FontAwesome"` (FA 4), that property is no longer needed — the FA class on the markup carries the font.

## Fallback if absent

Without this principle file, the agent will translate icons "1:1" — keeping `:before` / `:after content` rules in CSS — and may miss the v4-shim-vs-FA6-native compatibility issue. Symptom: buttons render without icons (or as missing-glyph rectangles) under FA 6 Pro Kit, requiring per-page manual fixes after deployment. The agent will not know to introduce DOM-based markup, and may default to `<i>` instead of `<span>` if it does.
