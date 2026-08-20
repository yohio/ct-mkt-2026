# Documentation Precedence and Conflict Handling

When two sources of guidance disagree, this file defines which one wins and how to surface the disagreement to the user.

## Precedence order

1. **team documentation** at `{team_standards_root}/` — the canonical, team-shared source of truth.
2. **Plugin standards layer** at `${CLAUDE_PLUGIN_ROOT}/standards/` — an opinionated extension of the docs, maintained for migration tooling.
3. **Codebase patterns observed in old files** — useful evidence but never authoritative. A pattern existing in master does not make it "the convention," especially if it was committed years ago, by one developer, or as part of WIP/legacy work.

**On conflict, the higher-precedence source wins** unless the user explicitly directs otherwise for the specific case.

## What counts as a conflict

A conflict exists when applying the plugin standards layer (or following observed codebase patterns) would produce a result that **directly contradicts an explicit instruction in the team docs**. Examples that have actually occurred:

- team docs say multi-element bundles go in ViewComponents or partials. Plugin standards add a third option (`tailwind/pages/<brand>/<page>.css` for "irreducible" multi-element grid layouts). For the same case, the docs prescribe a partial; the plugin standards prescribe page CSS. → **Conflict.**
- team docs say Tailwind components match 1:1 with a single HTML tag. Codebase has a `tailwind/hr_components.css` file containing native-CSS rules for a multi-element shim (`.js-customer_request_modal { & .row { ... } & .form-control { ... } }`). → **Conflict** with the 1:1 rule, but the plugin standards' `bootstrap-tailwind-coexistence.md` documents this as a temporary coexistence pattern. The conflict is acknowledged and the resolution (wrapper-scoped shim with magic-comment override) is the personal layer's deliberate exception.

A NON-conflict: a case the team docs simply don't address. E.g., the docs don't describe a `tailwind/pages/` directory at all. That's a gap, not a conflict — the plugin standards layer can fill it, but the gap-filling rule must not contradict anything the docs DO say.

## Behavior on conflict detection

When an agent detects a conflict during discovery, planning, or implementation:

1. **STOP.** Do not silently pick a side.
2. **Surface the conflict to the user** using the structured format below.
3. **Wait for explicit user direction** before proceeding. The default recommendation is always the team-docs option; the user must explicitly choose otherwise to deviate.

## Presentation format

When flagging a conflict, the agent emits a block of this shape:

```markdown
## ⚠ Documentation conflict detected

**Context:** <one sentence describing what we're trying to decide — e.g., "Where to put the `.features` grid-template-areas reorder used 6 times on the engagement_program page.">

### Option A — per team documentation

- **Source:** `coding_standards/css/tailwind/README.md` line 48
- **Quote:** _"Bundles of elements that make up something should not be represented by a Tailwind component, but rather a View Component or a partial view."_
- **Decision for this case:** Extract a `FeatureCardComponent` (or partial) that renders one feature cell. The grid container's layout lives inline on the section element using `grid-cols-3` + `col-span-3` on the title; cells auto-flow.
- **Resulting code:**
    ```erb
    <section class="grid grid-cols-3 max-[767px]:grid-cols-1 gap-24" id="features">
      <div class="col-span-3 max-[767px]:col-span-1"><h4>...</h4></div>
      <%= render 'engagement_program/feature_card', ... %>
      <%= render 'engagement_program/feature_card', ... %>
      <%= render 'engagement_program/feature_card', ... %>
    </section>
    ```
- **Risk:** More files (one partial), slightly more abstraction for a single-page use.
- **Benefit:** team-standards-compliant. Matches active migration patterns (an active migration PR). Repeating cells become reusable. Page CSS file stays minimal or empty.
- **Conformity:**
  - team docs: ✓ compliant
  - Plugin standards: ✓ compatible (matches the "multi-element bundle → ViewComponent or partial" branch in `frontend-migration-principles.md`)

### Option B — per plugin standards layer

- **Source:** `${CLAUDE_PLUGIN_ROOT}/standards/page-css-decomposition.md` § "What goes in the page CSS file"
- **Quote:** _"Named `grid-template-areas` with multiple breakpoint reorderings... CSS is dramatically simpler [than inline composition]."_
- **Decision for this case:** Put `.features { grid-template-areas: ...; @media(max-width: 767px) { grid-template-areas: ... } } & > .cell-1 { grid-area: cell-1 } ...` in `tailwind/pages/hr/engagement_program.css`.
- **Resulting code:**
    ```css
    & .features {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-areas: "title title title" "cell-1 cell-2 cell-3";
      @media (max-width: 767px) {
        grid-template-columns: 1fr;
        grid-template-areas: "title" "cell-1" "cell-2" "cell-3";
      }
      & > .section-title { grid-area: title; }
      & > .cell-1 { grid-area: cell-1; }
      & > .cell-2 { grid-area: cell-2; }
      & > .cell-3 { grid-area: cell-3; }
    }
    ```
- **Risk:** Diverges from team docs. Page CSS file grows. Future cleanup will be needed if/when the team converges on the inline-first pattern. Reviewers may push back.
- **Benefit:** Fewer new files. Localized to one CSS file.
- **Conformity:**
  - team docs: ✗ violates the "multi-element bundles → ViewComponent or partial" rule
  - Plugin standards: ✗ also discouraged (`pages/` is last-resort; this is a multi-element layout that belongs in a partial)

### Recommendation

**Option A** (team docs). The plugin standards layer also points toward the partial in this case — page CSS for multi-element bundles is explicitly out of scope per `page-css-decomposition.md`. Recent migration PRs use Option A exclusively.

Proceeding requires your explicit direction. Type "A", "B", or describe a different option if neither fits.
```

## How to apply this in practice

### For the migration agents (discovery, planner, implementer)

At the start of each phase, after loading the required standards files:

1. Compare planned decisions against the team docs you've also loaded.
2. For each planned use of the plugin standards layer that has an team-docs answer, check whether the answers agree.
3. If any disagree, emit the conflict-presentation block above and wait. Do not proceed.

The implementer specifically must also check during implementation when an unanticipated case arises:

- A planned page CSS rule turns out to be a multi-element layout → conflict (docs say partial)
- A planned Tailwind component CSS file turns out to need raw native CSS for a property without a Tailwind utility equivalent (e.g. `filter:` chains) → NOT a conflict. Raw CSS may sit alongside `@apply` lines in the same component file, per `branded-css-rules.md` "Raw CSS alongside `@apply`". The component file still satisfies the 1:1 single-HTML-tag rule.
- A planned helper method turns out to encapsulate multi-element markup → conflict (docs say partial or ViewComponent)

### For the validator

The validator (`${CLAUDE_PLUGIN_ROOT}/scripts/tailwind-migration-validate.mjs`) currently catches Bootstrap leakage by class name and file size. It does not yet detect "you put a multi-element layout in a CSS file that should be a partial." A future extension could add an R9 rule: warn when a `pages/<brand>/<page>.css` file contains nested child selectors (`& .foo`, `& > .bar`) suggesting multi-element structure. Until that rule exists, the agents bear responsibility for spotting these conflicts at plan time.

## Fallback if this file is absent

If the migration agent can't read this file, the safe default is: **assume team docs win, flag any ambiguity to the user before proceeding.** This is more conservative than silent fallback to the plugin standards layer and matches the failure-loud principle in the agent preambles.
