# Validation Walkthrough Structure

How to derive a user-validation guide from the migrated code, so the validation is *specific to what changed* — not a generic checklist.

## Why code-derived

A generic checklist ("all buttons work; forms submit") tells the user nothing they didn't already know. A code-derived guide says: "Click `#book-call-link-banner` — modal `#diagnostic-...-modal` should open. Submit it with valid data — expect a redirect to `/thanks`. Click the close X — modal should close, focus should return to the trigger." That's specific. That's actionable. That's what catches regressions.

The implementer must read the migrated artifacts and *catalog* what they do, then write a guide naming concrete elements. Generic items are not acceptable.

## Step A: Analyze the migrated surface

Read everything the migration touches AND everything those things touch:

- **Page migration** — controller action(s), the migrated view, partials it renders, JS files referenced (Stimulus controllers, framework directives like `data-controller=`, jQuery handlers, inline `onclick=`), helpers used, locale strings driving copy.
- **Component migration (ViewComponent)** — class + template + spec, plus a sample of 2–3 views that render it.
- **Layout-partial migration** — the partial + the layouts that include it + sample controllers using those layouts.

## Step B: Catalogue (don't validate yet — enumerate)

1. **Visible elements** — headings, sections, key images, color regions, typography blocks
2. **Interactive elements** — buttons, links, form fields, dropdowns, modals, accordions, tabs
3. **JavaScript behaviors** — Stimulus controllers (`data-controller=`), Bootstrap-era directives (`data-toggle=`, `data-target=`), inline handlers, references to global JS, AJAX endpoints invoked from the page
4. **Controller actions** invoked from the view — form submits, redirects, render targets, before_actions affecting the response (auth, feature flags)
5. **Conditional UI** — logged-in vs logged-out, role-based visibility, feature flags, A/B tests, branded variations
6. **Third-party integrations** — analytics, gainsight events, embedded videos, chat widgets, payment widgets, captcha
7. **Responsive behaviors** — mobile-only / desktop-only elements, hamburger menus, collapse/expand, sticky headers

## Step C: Generate the User Validation Guide

Write a markdown document at `tmp/migration-snapshots/{slug}-validation-guide.md`. Suggested structure:

```markdown
# User Validation Guide — {feature/page name}

**Migration scope:** Page / Component / Layout partial
**Visual fidelity mode:** {Strict / Close-enough / Visually equivalent / New design}
**Date:** {today}
**Source files analyzed:** {list of files read in Step A}

## 1. Visual checks (per breakpoint)
- [ ] Page renders without console errors
- [ ] {Specific section name} renders with {expected appearance}
- [ ] {Each named heading / section from the catalogue}

## 2. Functional checks (page-/component-specific)

### Modal triggers (if any)
- [ ] Click `#{specific-id}` → modal `#{specific-modal-id}` opens
- [ ] Submit modal form with valid data → expected response
- [ ] Click close (X / backdrop / Escape) → modal closes; focus returns to trigger

### Form submissions
- [ ] {Specific form name/id}: invalid → validation errors per-field
- [ ] {Specific form name/id}: valid → expected redirect/response

### Navigation
- [ ] Each link from the catalogue: clicking goes to expected destination

### Conditional UI
- [ ] As {role/state}: {expected state}

### Third-party integrations
- [ ] {Each integration from the catalogue with verification method}

## 3. Documented intentional changes (only if Close-enough fidelity)
For each intentional add/modify/remove:
- [ ] {change description}: confirmed working as designed

## 4. Browser / device checks
- [ ] Chrome (latest) on the project's primary domains
- [ ] Other browsers per the project's user base
- [ ] Mobile breakpoint via DevTools
- [ ] Keyboard navigation: Tab through interactives; focus rings visible

## 5. Accessibility spot-check
- [ ] Images have meaningful `alt=` (or `alt=""` for decorative)
- [ ] Color contrast meets WCAG AA at the brand colors used
- [ ] Form labels associated with inputs (clicking label focuses input)
- [ ] Modal traps focus when open; restores on close
```

## Per-section validation during implementation (use this BEFORE Step D)

When the implementer migrates a page top-down (see `top-down-traversal.md`), each section is validated as it completes — NOT only at the end. This bounds risk: if a section translation is wrong, it surfaces immediately, before subsequent sections inherit the mistake.

### The per-section gate

After every section is migrated, before moving to the next section in traversal order, the implementer:

1. **Captures a mid-migration screenshot** of the just-completed section at the project's primary breakpoint (e.g., 1920px desktop). Lower-priority breakpoints can be captured at end-of-page instead, to avoid validation fatigue.
2. **Computes a quick visual diff** against the pre-migration screenshot of the same DOM region (the screenshot is masked to the section's bounding box).
3. **Presents to the user via `AskUserQuestion`** with section-specific context:

```ruby
{
  question: "Section <section-name> migrated. Inspect the live page (URL: ...) and the diff (path). Anything off before I move to the next section?",
  header: "Section gate: <section-name>",
  options: [
    { label: "Looks right — proceed" },
    { label: "Issues — I'll describe" },
    { label: "Stop here for now (save state and pause)" }
  ],
  multiSelect: false
}
```

4. **Waits for response.** Do not migrate the next section without explicit approval.

### What "section" means here

Per `top-down-traversal.md`: a section is a contiguous DOM subtree that is meaningful as a visual unit. The implementer follows the section breakdown in the approved Migration Plan, in traversal order (parent before children, top-to-bottom for siblings).

### On "Issues — I'll describe"

When the user reports an issue with the just-completed section:

1. Resolve the issue in the SAME section before moving on. Do not migrate forward with a known regression.
2. Re-run the section gate after the fix.
3. Only proceed when the user approves explicitly.

If the issue spans multiple sections (e.g., "the surfaced-form positioning is wrong AND the hero is hidden"), surface both — but pause at the earliest affected section in traversal order and resolve in order.

### On "Stop here for now"

The current state is a valid stopping point. The implementer:

1. Writes a resume doc (see team documentation for resume doc format) capturing what was completed, what's deferred, and how to resume.
2. Returns control to the user with a brief summary of state.
3. Does NOT auto-commit. The user owns commits.

### Why per-section AND end-of-page walkthrough

The per-section gate (this section) catches *translation correctness* at the section boundary. The end-of-page walkthrough (Step D below) catches *interaction correctness* across the whole page (form submissions, role variants, cross-section behaviors). Both are required:

- Per-section gates verify the BS3-to-Tailwind translation matches intent
- End-of-page walkthrough verifies user flows still work after all translations are in place

A page that passes every per-section gate but fails the end-of-page walkthrough has a behavior regression (e.g., a Stimulus controller wasn't wired). A page that passes the end-of-page walkthrough but never had per-section gates has untracked translation drift (e.g., section #3 looks right because the user didn't notice the missing padding, but it'll surface later in production).

---

## Step D: Walk through with the user

Use `AskUserQuestion` group by group (visual / functional / integrations / browser / accessibility). Tight binary-ish answers:

```ruby
{
  question: "Functional checks: do all interactive elements behave correctly?",
  header: "Functional",
  options: [
    { label: "All pass" },
    { label: "Some issues — I'll describe" },
    { label: "Skip — testing later" }
  ],
  multiSelect: false
}
```

Any "some issues" answer captures the issue as a follow-up. **Do NOT produce the Migration Summary until reported issues are resolved or explicitly accepted by the user.** When an issue is resolved, re-run that section's check before moving on.

## Step E: Record the validation results

The Migration Summary's "User validation" section captures:

- Path to the validation guide markdown
- Pass / deferred / resolved counts
- Any unresolved items the user explicitly accepted as out-of-scope (with reasoning)

## Required, regardless of fidelity mode

The functional walkthrough runs even when the visual diff is skipped (Visually equivalent / New design modes). Visual diff catches "looks wrong"; this catches "behaves wrong." Both are load-bearing.

## Fallback if absent

If this file isn't present, the referencing agent should default to:

> Generate a manual-test checklist covering visible regions, interactive elements, and major user flows. Walk the user through it.

— a competent default that lacks the cataloguing taxonomy, the code-derived requirement, and the structured walkthrough.
