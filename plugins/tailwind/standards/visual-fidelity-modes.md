# Visual Fidelity Modes

How strict the before/after visual comparison should be when migrating a view. Captured at scoping time; drives the verification step.

## The four modes

### 1. Strict identical (0-pixel diff)

The migrated page must match the source pixel-for-pixel.

**When to choose:** pure refactors that should not change anything visible — e.g., moving CSS rules from a stylesheet to inline classes without intent to alter visuals; reorganizing files without touching markup; switching the layout the controller renders without changing the layout's content.

**Verification:** ImageMagick `compare -metric AE -fuzz 0% before.png after.png diff.png`. Pass = 0 pixels different.

### 2. Close-enough identical (~5% fuzz)

Visually identical with tolerance for minor differences.

**When to choose:** the migration intentionally adds, modifies, or removes elements — e.g., new modal markup, updated icons, removed deprecated features, brand-driven visual updates that are still "the same page." Strict mode would fail by definition because of the intentional changes.

**Verification:** `compare -metric AE -fuzz 5% before.png after.png diff.png`. Pass = 0 pixels exceed the 5% per-pixel tolerance. The plan must list intentional element changes so the implementer can document them when the diff highlights expected differences.

### 3. Visually equivalent (manual check only)

Same overall design intent; minor differences (anti-aliasing, font rendering, sub-pixel layout) acceptable. No automated diff.

**When to choose:** the migration includes enough intentional layout/spacing reflow that even 5% fuzz would generate noisy diffs; or the project doesn't have screenshot tooling set up; or the user prefers eyeball verification for this particular change.

**Verification:** the plan lists breakpoints; the implementer's user-validation walkthrough includes a "spot-check at each breakpoint" section.

### 4. New design (no comparison)

The migration is also updating the visual design. Old appearance is irrelevant.

**When to choose:** the work is half-migration, half-redesign; or the page is being rewritten as part of a brand refresh; or the user is intentionally changing layout/colors/typography.

**Verification:** no before/after diff. The user-validation walkthrough still applies — the implementer catalogues interactive behavior and the user confirms it works (separate from how it looks).

## Choosing the right mode

Discovery should ask the user explicitly. The mode is captured in the Discovery Report's "Scope" section and propagated through the plan. The user-validation walkthrough runs regardless of mode (visual diff is conditional; functional validation isn't — even a "New design" migration's interactive behavior must work).

## Capture procedure

The implementer runs the procedure in `playwright-visual-validation.md` for Strict, Close-enough, and Visually-equivalent modes (with diff for the first two; capture only for the third). New-design mode skips baseline capture but still runs post-migration capture for the record + console + network checks. The companion script is at `${CLAUDE_PLUGIN_ROOT}/scripts/tailwind-migration-screenshot.mjs`.

The procedure adds three things over a single full-page screenshot pass:

- **Scroll states** — captures `scrolled` in addition to `top` so fixed/sticky nav slip-under regressions are caught (a class of bug a static screenshot is blind to).
- **Role variants** — captures each auth state the page renders differently for (anonymous, ref-seat, advisory, admin, etc.) so role-gated UI variants are exercised.
- **Console + network checks** — records `[error]` console messages and HTTP ≥ 400 responses, surfacing missing assets, broken JS, and 404s alongside the pixel diff.

The plan supplies the inputs (breakpoints, scroll states, roles, host header, mask selectors, network-ignore patterns); the implementer assembles a JSON config and runs the script.

## Why "Close-enough" exists

Real Bootstrap-to-Tailwind migrations almost always add or modify SOMETHING — fonts render differently, anti-aliasing differs, button hit-targets get adjusted, modals get wrapped in new containers. Strict 0-fuzz mode would fail by definition. Close-enough mode at 5% fuzz gives the diff useful signal (catches unintentional regressions) without blocking on intentional changes.

## Visual rhythm vs pixel detail (close-enough mode only)

When the source has a distinctive visual treatment — a button's icon-panel + lighter body split via `linear-gradient` hard-stop, a hero's gradient backdrop, a card's two-tone divider — `close-enough` does NOT mean "drop the visual rhythm because we changed the underlying technique."

The user reads the *rhythm* (darker icon area → divider → lighter body), not the technique (`::before` panel + `::after` icon vs `<span>` in DOM + linear-gradient). When migrating with a different underlying technique (e.g., icons-in-DOM per `icon-migration.md`), preserve the rhythm by re-implementing with the new mechanism.

Practical procedure:

1. Capture the BEFORE element close-up (crop the rendered button / card / hero from a baseline screenshot).
2. Identify the rhythm — what the eye reads. Usually 2-3 characteristics: "darker left panel of width X," "divider line," "bold text starts at panel edge."
3. Re-implement those characteristics with the new mechanism. A `linear-gradient(to right, $color N px, rgba($color, 0.75) N px)` at a hard-stop replicates an icon panel without using `::before`. Width, padding, font-weight track the original.
4. Crop AFTER and confirm the rhythm matches.

If the user reports "this doesn't match" after a close-enough diff passes, the missing piece is almost always rhythm, not pixels. Don't argue from the diff metric — re-look with the user at a side-by-side crop.

## Pixel-diff is interaction-blind

Visual diff captures static-state regressions only. **A passing pixel diff does not prove the page works.** Three classes of bug pixel diff cannot detect, all of which we have shipped:

1. **Modals that open but have broken JS event flow** — modal opens, form renders, submit returns silently because the AJAX response template selects DOM the new modal doesn't have. Visual diff sees no problem; clicking the button reveals the regression.

2. **Accordions with correct markup that don't actually toggle** — Stimulus controller is registered and attached, panel has the right targets, but the controller has a bug (e.g., uses `static classes` without matching markup contract — see `stimulus-controller-design.md`). Visual diff sees the closed-state markup correctly; click does nothing.

3. **Buttons rendered with the wrong base color but visually similar to the user's eye** — `rgba(75, 30, 105, 0.85)` (plum) vs `rgba(64, 66, 153, 0.85)` (legacy indigo). 5% fuzz tolerance hides this. Pixel diff passes; the user's design eye flags it.

### Rule

Visual diff is **necessary but not sufficient** for migration sign-off. Always pair with the user-validation walkthrough's interaction steps (see `validation-walkthrough-structure.md`).

System-spec assertions that only validate markup (`have_css('[data-controller="disclosure"]')`, `have_css('.faq-container')`) give the same false confidence — pair with click-driving behavior assertions, NOT markup-presence-only.

If the user reports a bug after pixel diff and specs are green, **trust the user, not the metric.** Capture a fresh interaction (Playwright click + state inspection, browser DevTools session, screenshot of the broken state) and reason from that.

## Fallback if absent

If this file isn't present, agents should default to:

> Ask the user "should the migrated page look identical to the source?" Yes/no. If yes, run a visual diff at 5% fuzz tolerance. If no, run a manual user-validation walkthrough only.

— a competent default that lacks the four-mode taxonomy and the strict-vs-close-enough distinction.

If `playwright-visual-validation.md` is also absent, the implementer falls back to the lightweight Playwright snippet in its own agent prompt — single screenshot per breakpoint at the top scroll state only, ImageMagick `compare`, no role variants, no console/network capture. That covers ~60% of regressions.
