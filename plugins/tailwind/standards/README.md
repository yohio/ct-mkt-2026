# Frontend Standards Layer

Plugin standards layer that the migration workflow agents (and any other frontend tooling) reference for opinionated decisions. Each file captures a specific principle distilled from real work — extracted into separate files so the *tooling* stays principles-agnostic.

## Files

| File | What it defines |
|---|---|
| `documentation-precedence.md` | **Read first.** team docs (`{team_standards_root}/`) outrank this plugin standards layer on conflict. Defines the structured conflict-presentation format every migration agent must use when surfacing disagreements. |
| `frontend-migration-principles.md` | Decision flow for where styles should live: single-tag → Tailwind component CSS (`@apply` in `@layer components`); multi-element bundle → ViewComponent or partial; one-off → inline utilities; irreducible page-scoped → page CSS (last resort). **Cardinal rule: read BS3 SCSS per class before translating.** Aligned with the team Tailwind docs. |
| `pre-migration-snapshot.md` | Capture the source-of-truth state of a page before migration starts: rendered HTML, BS3 SCSS files, page CSS, related JS. Lives at `tmp/migration-snapshots/{slug}/pre-migration/`. The `00-INDEX.md` is the planner's and implementer's reference for the "read SCSS per class" rule. |
| `cascade-audit.md` | Per-element cascade audit (orthogonal axis to the class-keyed cardinal rule). For ID-anchored, form-control, modal-container, sticky/fixed, or multi-selector-strand elements, list every BS3 rule that matches with computed specificity. Produces `cascade-audit.md` in the snapshot dir. Catches multi-rule cascades, combined selectors (`.a, .b { ... }`), and specificity-winner mismatches. |
| `top-down-traversal.md` | DOM traversal order for migration: pre-order depth-first (parent first, then each immediate child in source order, recursing into each child before moving to the sibling). Section = contiguous DOM subtree validated as a unit. Stopping rules at section boundaries. |
| `consolidation-and-refactor.md` | Opportunistic spaghetti-code cleanup *during* migration: duplicate markup, deep nesting, non-descriptive class names, conditional scatter. Decision flow — in-scope vs flagged vs leave-alone. Functionality-retention constraint. |
| `visual-fidelity-modes.md` | Four modes (Strict identical / Close-enough identical / Visually equivalent / New design), criteria, fuzz parameters. |
| `validation-walkthrough-structure.md` | Step A/B/C/D structure for code-derived user validation + per-section validation gate during implementation. Cataloguing taxonomy. |
| `branded-css-rules.md` | Single-HTML-tag rule. Never share component CSS across brands. Sibling-directory structure. |
| `page-css-decomposition.md` | When `tailwind/pages/<brand>/<page>.css` is acceptable (last resort: asset-URL background swaps, page-scoped overrides). Decomposition discipline so rules move to their canonical home. The 150-line validator ceiling. |
| `cross-page-impact.md` | Strategy for elements used on multiple pages — fork vs. migrate-in-place vs. extract vs. inline. Caller-count thresholds. |
| `js-behavior-migration.md` | Bootstrap JS → Stimulus / native HTML migration. Pattern catalogue. Stimulus controller spec format. Native `<dialog>` traps (`m-0`, close-event-vs-`hidden.bs.modal`). |
| `icon-migration.md` | Icons go in the DOM as `<i>` / `<svg>`, not `::before` / `::after`. Markup rewrite + CSS pattern + when to use a wrapper for an icon-box visual. |
| `bootstrap-tailwind-coexistence.md` | The four flavors of Bootstrap-era dependency a migrated Tailwind page inherits (global CSS, form partials, AJAX response templates, jQuery handlers). Three resolution strategies (CSS shim / compat-emitting controller / Tailwind variant fork). |
| `stimulus-controller-design.md` | Three traps when writing Stimulus controllers (`static classes` markup contract, single-trigger ARIA sync, `connect()` ignoring server state) + behavior-not-markup verification rule. |
| `playwright-visual-validation.md` | Scripted baseline + post-migration capture across breakpoints / scroll states / role variants. Console + network capture. Diff with fuzz tolerance. Companion script: `${CLAUDE_PLUGIN_ROOT}/scripts/tailwind-migration-screenshot.mjs`. |

## Loading by phase

Each migration phase loads ONLY the standards files it needs at runtime. This bounds the instruction budget per agent (LLMs follow ~150–200 instructions reliably; loading all 10 standards in every phase exceeds that and degrades attention to specific rules — see HumanLayer's analysis: https://www.heavybit.com/library/article/whats-missing-to-make-ai-agents-mainstream).

The agents enforce this routing at the top of their own prompts. This table is the authoritative source.

### Discovery (`tailwind-discovery`)

**Always load:**
- `visual-fidelity-modes.md` — for the fidelity-mode scoping question
- `pre-migration-snapshot.md` — for the snapshot-capture procedure
- `cascade-audit.md` — for the per-element cascade audit (Phase B.5 — high-risk elements get one audit table each, written to `cascade-audit.md` in the snapshot dir)
- `consolidation-and-refactor.md` — for the consolidation-opportunities audit (surface candidates, don't decide)
- `cross-page-impact.md` — for the cross-page-impact audit framework
- `js-behavior-migration.md` — for the JavaScript-behaviors audit catalog
- `bootstrap-tailwind-coexistence.md` — for the legacy-contracts audit

**Do not load:** `frontend-migration-principles.md`, `page-css-decomposition.md`, `branded-css-rules.md`, `stimulus-controller-design.md`, `validation-walkthrough-structure.md`, `icon-migration.md`, `playwright-visual-validation.md`, `top-down-traversal.md` — these are downstream concerns. Discovery captures the *inputs* the implementer needs (breakpoints, scroll states that depend on JS, role variants, host header for IT/HR routing, snapshot path, consolidation candidates, cascade-audit artifact) in the Discovery Report; it does not run captures or implement traversal itself.

### Planner (`tailwind-planner`)

**Always load:**
- `frontend-migration-principles.md` — decision flow for where styles live + cardinal "read BS3 SCSS per class" rule
- `pre-migration-snapshot.md` — to know where the snapshot lives + how to cite SCSS sources in the class-mapping table
- `cascade-audit.md` — to consume the discovery's per-element cascade audit (extends class-mapping table with specificity columns + winner-changed flag)
- `top-down-traversal.md` — to produce the section-by-section breakdown in the plan output
- `consolidation-and-refactor.md` — to classify each discovery-surfaced consolidation candidate as in-scope / flagged / leave-alone
- `page-css-decomposition.md` — when `pages/` is acceptable; decomposition discipline
- `cross-page-impact.md` — fork/migrate/extract/inline strategy

**Conditional — load only if Discovery Report indicates:**
- `js-behavior-migration.md` — if the report's "JavaScript behaviors" table is non-empty
- `bootstrap-tailwind-coexistence.md` — if the report's "Legacy DOM/CSS/JS contracts" table is non-empty
- `stimulus-controller-design.md` — if any new Stimulus controllers will be planned (i.e., a JS behavior has no existing-Stimulus reuse)
- `branded-css-rules.md` — if the plan introduces new Tailwind component CSS in a multi-brand project
- `icon-migration.md` — if icons are in scope (the discovery report flagged ::before/content: usage, or icons appear in the Bootstrap audit)

The plan must include — for the implementer's Playwright pass — explicit lists of: breakpoints, scroll states (`top` always; `scrolled` if any layout depends on scroll-driven JS such as sticky/fixed nav), role variants to capture, host header (one segment vs another), mask selectors (dynamic content to hide), and network-ignore patterns (analytics endpoints to skip in failure capture). The planner does NOT load `playwright-visual-validation.md` itself — it just emits the inputs the implementer's run consumes.

### Implementer (`tailwind-implementer`)

**Always load:**
- `visual-fidelity-modes.md` — for the verification procedure
- `validation-walkthrough-structure.md` — for the per-section gate during implementation AND the end-of-page Step A/B/C/D/E procedure
- `top-down-traversal.md` — for the section-by-section execution loop (parent before children; user gate at each section)
- `pre-migration-snapshot.md` — to look up BS3 SCSS for each class before translating (mandatory per `frontend-migration-principles.md` cardinal rule)
- `cascade-audit.md` — to identify elements flagged "high-risk" in the discovery audit; these trigger intra-section per-element gates during implementation
- `playwright-visual-validation.md` — for the Step 0 (baseline) and Step 10 (post + diff) capture procedure (skip if fidelity mode is "New design" — captures still run but with no baseline)

**Conditional — load only if the approved Migration Plan has the corresponding section non-empty:**
- `js-behavior-migration.md` — if the plan has a "JavaScript behaviors" / "JS migration targets" section (needed for `<dialog>` traps and Stimulus targeting patterns)
- `stimulus-controller-design.md` — if the plan introduces a new Stimulus controller (needed for the four traps + spec format)
- `bootstrap-tailwind-coexistence.md` — if the plan has a "Legacy DOM/CSS/JS contracts" section (needed for shim wrapper-scoping and compat event dispatch)
- `icon-migration.md` — if the plan's class-mapping or markup steps involve icons
- `branded-css-rules.md` — if the plan introduces new Tailwind component CSS in a multi-brand project
- `consolidation-and-refactor.md` — if the plan has a "Consolidation plan" section with in-scope items

**Do not load (rules are self-contained in the implementer's own ground rules):**
- `frontend-migration-principles.md` — implementer's ground rules already enforce "follow the plan's chosen home for each style; never invent new Tailwind component CSS the plan didn't approve" AND "read BS3 SCSS per class before translating; STOP if a class isn't in the snapshot"
- `page-css-decomposition.md` — implementer's ground rules already enforce "if page CSS exceeds 150 lines, stop and ask"; load on-demand if that trigger fires
- `cross-page-impact.md` — strategy decisions are made by the planner; implementer follows the plan

## Why this is a layer (not embedded in the tools)

Three reasons:

1. **Reusability.** These principles apply beyond migration — to any frontend refactor, any new component work, any styling decision. Coupling them to the migration tool means duplicating them everywhere else.
2. **Iteration.** Principles evolve. Editing one file beats hunting through 6 agent prompts.
3. **Authorship.** The principles are the opinionated work; the tools are mechanics. Keeping them separate makes the boundary visible.

## Format

Each file is plain markdown the agents `Read` at runtime. No frontmatter, no schema. The agents quote or summarize as needed. Files should be:

- Self-contained (don't depend on each other)
- Reference-friendly (have headings the agents can point at)
- Generic enough to apply across projects, specific enough to be opinionated

## Falling back

If a principles file isn't present at runtime, the referencing agent should fall back to a competent generic default and continue. Each principle file includes a "Fallback if absent" note describing what the agent does without it. This keeps the tools usable for someone who hasn't populated the standards layer.
