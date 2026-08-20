# Cascade Audit (per-element)

The cardinal rule in `frontend-migration-principles.md` is "read the BS3 SCSS per **class** before translating." This file defines the orthogonal axis: **read every CSS rule that targets a given ELEMENT, regardless of which class or selector the rule keyed on.**

Motivated by recurring migration failures where the implementer correctly read one rule for an element and missed a second rule that also matched it via a different selector. See § Failure modes below.

## When this audit runs

- **Discovery (Phase B.5):** produces the audit artifact for every high-risk element in scope (see § High-risk elements). Saved to `tmp/migration-snapshots/{ticket-slug}/pre-migration/cascade-audit.md`.
- **Planner (Section 2.5):** consumes the audit and extends the class-mapping table with specificity + winner-changed flags.
- **Implementer:** treats audit-flagged elements as intra-section gates (pause + screenshot + user check before continuing through the rest of the section).

## High-risk elements (must audit)

The audit is mandatory for any element that meets ANY of:

1. **ID-anchored in BS3.** Selectors like `#page-id .target` or `#page-id .target.variant`. ID specificity (0,1,0,0) dominates over class specificity (0,0,1,0) — page-specific overrides almost always win these duels, and confusing one for the other is the highest-frequency migration mistake.
2. **Form controls.** `<input>`, `<button>`, `<select>`, `<textarea>`, custom checkboxes/radios. State classes (`:focus`, `:invalid`, `[disabled]`) and theme variants (`.green`, `.yellow`, `.cta`) combine into competing selectors.
3. **Modal containers and overlays.** `.modal`, `.modal-dialog`, `.modal-body` — these inherit BS3 modal CSS, custom theme CSS, and JS-added state classes (`.in`, `.show`).
4. **Sticky / fixed elements.** `position: sticky` or `position: fixed` elements with JS-added state classes (e.g., `#stickynav.sticky`). The state class often introduces a whole second cascade.
5. **Elements appearing in multiple selector strands.** If a class appears in BOTH a standalone rule AND as a descendant selector (e.g., `.tool-icon { ... }` AND `#new-solution-set .tool-icon .fa-file-pdf-o { ... }`), audit. Multi-rule cascades on the same element are where combined-selector pairs (`.tool-icon, .tool-desc`) get missed.
6. **Anything the discovery flagged as load-bearing** in the "Shared layout patterns" table.

If unsure, audit. The cost of running the audit on a non-risky element is one extra row; the cost of skipping it on a risky one is a post-migration regression.

## Cascade audit table format

For each high-risk element, list **every** BS3 selector that matches it, with computed specificity and the cascade winner per declaration.

```markdown
### Element: `<input type="submit" class="submit-tag-green submit-tag-green-container">`
DOM path: `#new-solution-set .surfaced-form input[type=submit]`
BS3 source paths: `_publications_solution_sets.scss:3493-3520`, `_2018_buttons.scss:42-58`

| BS3 selector | Specificity (a,b,c,d) | File:line | Declarations |
|---|---|---|---|
| `.submit-tag-green` | 0,0,1,0 | `_2018_buttons.scss:42` | `background: #5cb85c; color: white; padding: 8px 16px; font-size: 14px;` |
| `#new-solution-set .surfaced-form input[type=submit].submit-tag-green-container` | 0,2,3,0 | `_publications_solution_sets.scss:3520` | `background: #ECAF00; color: black; padding: 10px 15px 15px 60px; font-size: 18px;` |

| Declaration | Winning rule | Reason |
|---|---|---|
| `background` | Rule B (`#new-solution-set ...`) | Specificity 0,2,3,0 > 0,0,1,0 |
| `color` | Rule B | Specificity |
| `padding` | Rule B | Specificity |
| `font-size` | Rule B | Specificity |

**Final cascade for this element on the blueprint page:** Rule B (yellow theme). Rule A is overridden in every property.

**Translation target:** Tailwind must reproduce Rule B's declarations. Reading only `.submit-tag-green` (Rule A) and translating to a green button is the failure mode this audit prevents.
```

## Computing specificity

Use the standard CSS specificity tuple `(a, b, c, d)`:

- **a** — inline style (always 0 for stylesheet rules)
- **b** — count of ID selectors
- **c** — count of class selectors, attribute selectors, pseudo-classes (`:hover`, `:focus`, `:has`)
- **d** — count of type selectors and pseudo-elements (`::before`)

Examples:

| Selector | (a,b,c,d) |
|---|---|
| `.btn` | 0,0,1,0 |
| `.btn:hover` | 0,0,2,0 |
| `#page .btn` | 0,1,1,0 |
| `#page #header .btn` | 0,2,1,0 |
| `input[type=submit].btn-cta` | 0,0,2,1 |
| `.modal .modal-body p:last-child` | 0,0,3,2 |
| `body[data-site-slug="it"] #x .y` | 0,1,2,1 |

Compare lexicographically. Higher tuple wins. Within equal specificity, source order wins (later rule overrides earlier).

## Output: cascade-audit.md artifact

The discovery agent writes one `cascade-audit.md` file at `tmp/migration-snapshots/{ticket-slug}/pre-migration/cascade-audit.md` containing:

1. **High-risk elements list** with rationale (which classifier criteria each met)
2. **One audit table per element** in the format above
3. **A summary block at the end** — count of elements audited, count of elements where the winning rule isn't the most obvious one (i.e., not the class-named rule), count of combined-selector pairs (e.g., `.tool-icon, .tool-desc { ... }`) where the same declaration applies to multiple elements

The planner reads this artifact when building the class-mapping table — every audit row becomes a constraint on what the Tailwind translation must reproduce.

## Failure modes this audit exists to prevent

Real mistakes from an early proof-of-concept migration (a content detail page):

| Element | What was translated | What the cascade actually said | Why it broke |
|---|---|---|---|
| Surfaced-form submit button | Rule A (`.submit-tag-green`) — green button, 14px padding | Rule B (`#new-solution-set .surfaced-form input[type=submit].submit-tag-green-container`) wins at specificity 0,2,3,0 — yellow `#ECAF00` bg, 18px font, 60px left-padding for icon | Button rendered green + small + missing icon offset. Discovered visually; required re-doing the translation from the higher-specificity rule. |
| `.tool-icon` download-list wrapper | `.tool-desc { padding: 8px 0 }` only | BS3 has `.tool-icon, .tool-desc { padding: 8px 0 }` — same declaration applies to BOTH elements via combined selector | Icon container had no vertical padding while text did; visible vertical misalignment between icon and text in download list. |
| In-table `<ul>` | `.long-content ul { pl-10 }` | BS3 also has `#new-solution-set table ul { padding: 0 0 0 20px }` — specifically reduces ul padding to 20px inside tables. Long-content rule cascades into tables and is overridden by the table-specific rule. | In-table lists had 40px left indent (BS3 had 20px). Visible as wasted whitespace. |
| `.tool-icon` color tinting | (no color rule found via class-keyed search of `.fa-file-pdf-o`) | BS3 has `#new-solution-set .tool-icon .fa-file-pdf-o { color: #b30d00 }` keyed on the WRAPPER, not the icon class itself | File-type icons rendered black instead of per-type tints; required restoring the `.tool-icon` class on the Tailwind wrapper to re-enable the cascade. |

Each of these was preventable by listing every rule that targeted the element BEFORE picking a translation.

## How the audit interacts with the cardinal rule

The two rules are complementary, not redundant:

| Rule | Axis | Catches |
|---|---|---|
| "Read BS3 SCSS per class" (`frontend-migration-principles.md`) | **Class-keyed** | Wrong assumption about what a class means based on its name |
| "Read every rule per element" (this file) | **Element-keyed** | Multiple rules targeting the same element via different selectors; missed combined selectors; lost cascade winners |

The implementer applies both: for each class, read its source rule (cardinal); for each high-risk element, read all rules that match it (audit). They overlap on simple cases (one class, one rule, one element) and diverge on the cases that actually break migrations.

## Fallback if absent

If this file isn't present at runtime, the referencing agent should default to:

> For ID-anchored elements, form controls, modal containers, and sticky/fixed elements, list every BS3 selector matching the element before translating. When two rules match the same element, compute specificity to determine the winner. Document combined selectors (e.g., `.a, .b { ... }`) as applying the same declaration to both elements.

— a competent default that captures the audit's intent without the formal table structure.
