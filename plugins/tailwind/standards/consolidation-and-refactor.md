# Consolidation and Refactor (In-Scope Cleanup During Migration)

A migration touches every line of a page. That's the cheapest moment to clean up structural debt that has accumulated — but it's also the easiest moment to overreach. This file defines when consolidation is *in scope* for a migration vs. *flagged for a separate ticket* vs. *left alone*.

## Why consolidation is opportunistic during migration

When the markup is being rewritten anyway:

- Renaming a class costs nothing extra (you're already editing the file)
- Extracting a ViewComponent or partial has a natural boundary (the section being migrated)
- Removing dead code is verified by the migration's tests
- Untangling nested wrappers is easier in fresh Tailwind utilities than in BS3 SCSS

But: consolidation done badly extends migration scope unpredictably and obscures the migration's diff for review. The discipline is to consolidate **only when the consolidation costs less than NOT consolidating** — i.e., when leaving the spaghetti in place would force the migrated code to inherit the mess.

## Spaghetti-code patterns to look for during discovery

The discovery phase should surface these patterns alongside the Bootstrap audit:

### 1. Duplicate markup blocks

The same multi-element structure rendered in 2+ places on the page (e.g., the same hero-image-with-caption pattern repeated for premium_content, learning_content, and standard variants).

**Consolidation candidate:** extract a partial or ViewComponent. Migration cost is the same per variant (you'd inline-Tailwind each); consolidation cost is the partial extraction (~30 minutes).

### 2. Deeply nested wrappers with single children

`<div><div><div><div class="actual-content">...</div></div></div></div>` — wrappers that exist for historical layout reasons that newer flexbox/grid handles in one element.

**Consolidation candidate:** flatten in the migrated output. Don't preserve nesting for nostalgia.

### 3. Class names that don't describe their content

`.section-2`, `.helper-3`, `.outer-wrapper-v2`, `.col-thing` — names that were meaningful at some past moment but don't describe what the element IS.

**Consolidation candidate:** rename to semantic identifiers (`.feature-row`, `.hero-cta`) in the migrated markup. The class won't have CSS rules attached (we're using inline Tailwind), so the rename is purely for readability.

### 4. Conditional rendering scattered across the partial

A 200-line partial with 12 `<% if some_state %>` blocks interspersed throughout the markup.

**Consolidation candidate:** consider splitting into variant-specific partials (one per state) OR a Strategy pattern with sub-partials. Surface during planning; usually too big to do during migration itself.

### 5. Mixed concerns in one partial

A partial that handles BOTH presentation AND business logic decisions (e.g., a view partial that calls `Publication.where(...)` directly to filter what to render).

**Consolidation candidate:** extract the query into a helper, controller, or model method. Don't touch this during migration unless it's trivial — it's a Rails refactor, not a frontend migration.

### 6. Helper proliferation for trivial cases

A `app/helpers/` method that just wraps one Tailwind class string with no conditional logic.

**Consolidation candidate:** inline the class string into the template. Helpers should hide complexity, not class names.

### 7. Repeated inline `<style>` blocks

`<style>` tags in the middle of the markup containing one-off rules.

**Consolidation candidate:** move to page CSS or component CSS depending on scope. Inline `<style>` is almost never the right home long-term.

## Discovery phase: audit and catalogue

The discovery agent surfaces consolidation opportunities in a dedicated section of the Discovery Report:

```markdown
## Consolidation opportunities

| Pattern | Location | Severity | Recommended action |
|---|---|---|---|
| Duplicate markup — hero-image-with-caption | `_solution_set_template.html.erb:124-160, 175-220, 240-280` (3x) | Med | Extract `hero_image_caption` partial during migration |
| Deeply nested wrappers — main column | `_solution_set_template.html.erb:99-120` (4 levels) | Low | Flatten to 2 levels via grid utility |
| Class name `.solution-set-content` not descriptive | `_solution_set_template.html.erb:102` | Low | Leave alone — used as JS hook |
| Conditional rendering scatter — variant branching | `_solution_set_template.html.erb` (3 sub-templates inline) | High | Surface in planning — full split is out of scope for this migration |
| Inline `<style>` blocks | none | — | — |
```

The discovery agent does NOT decide *whether* to consolidate — only flags candidates. Decision happens in planning.

## Planning phase: in-scope vs out-of-scope vs leave-alone

For each consolidation opportunity surfaced in discovery, the planner classifies it:

| Classification | When | Action |
|---|---|---|
| **In-scope** | Cleanup costs ≤ 30% of section migration time AND retains functionality with confidence | Include in the section's step list; implementer does it inline |
| **Flagged** | Cleanup is worthwhile but exceeds migration scope (would extend session significantly) | Document in "Deferred consolidation" section of the plan; create a follow-up ticket reference |
| **Leave alone** | Cleanup would change behavior, touch out-of-scope partials, or introduce risk disproportionate to the gain | Note in plan with brief reasoning ("class name kept as JS hook; rename would require coordinated JS update") |

The plan's "Consolidation plan" section is parallel to the class-mapping section — both are part of the planner's output. Sample:

```markdown
## Consolidation plan

### In-scope (will execute during migration)
- Extract `hero_image_caption` partial. Three sites in the template; partial is ~40 lines after extraction. Tests cover all three render paths.
- Rename `.outer-wrapper-v2` → `.feature-grid` in migrated markup. No CSS dependency; class is purely structural.

### Flagged for follow-up (NOT in this migration)
- Variant branching: the three sub-templates (premium_content / learning_content / standard) share an outer skeleton and diverge in body content. A clean refactor would split into three full templates with a dispatcher. Out of scope; flag for a follow-up ticket.

### Leave alone
- `.solution-set-content` class on main column wrapper. Used as a JS selector in `gainsight_publication_page_view.js`. Renaming requires coordinated JS update — out of scope.
```

## Implementation phase: execute the in-scope cleanup with the migration

For each section the implementer migrates, the section's step list includes any in-scope consolidations from the plan. The consolidations are committed as part of the migration, not separate commits — because they don't make sense without the migration's markup changes.

**Critical rule:** functionality MUST be retained. Tests pass before and after each section. If a consolidation breaks a test, the consolidation is reverted (not the migration) — the migration is the goal; consolidation is opportunistic.

## When to STOP consolidating

If during implementation a consolidation reveals more work than expected (e.g., extracting the partial requires touching 5 other files), the implementer stops the consolidation, reverts that piece, and continues the migration without it. Add an entry to "Flagged for follow-up" in the migration summary. **Don't expand scope under pressure.**

## How this differs from a refactor

A refactor improves code without changing behavior; it has its own ticket, its own scope, its own tests. Consolidation during migration is *opportunistic cleanup* — it rides along with the migration's natural diff. The distinction matters because:

- Migration tests verify visual/functional equivalence (Playwright + RSpec).
- Refactor tests verify behavioral equivalence at a different granularity.
- A refactor done as a consolidation might pass migration tests but break a behavior the migration's tests don't cover.

**Rule:** if a consolidation cannot be tested by the same tests that validate the migration, it's not opportunistic — it's a refactor wearing migration clothes. Flag for a separate ticket.

## Fallback if absent

If this file isn't present at runtime, the referencing agent should default to:

> Don't aggressively refactor during migration. If you spot duplicate markup, deeply nested wrappers, or non-descriptive class names, flag them as comments in the migrated code or in the migration summary. Resist the temptation to fix everything at once.

— a competent default that errs on the side of staying focused on the migration goal.
