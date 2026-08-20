# JavaScript Behavior Migration

Bootstrap is a JS-loaded framework. Migrating from Bootstrap to Tailwind doesn't include the JS layer — Tailwind itself is CSS-only. The project's own JS conventions (typically Stimulus in modern Rails apps, sometimes plain JS, sometimes React-with-HeadlessUI) handle interactive behaviors.

When migrating a view that uses Bootstrap JS behaviors, **assume Bootstrap JS is NOT loaded under the target Tailwind layout** unless verified otherwise. The existing Bootstrap behaviors will silently break. The plan must propose a JS migration for each behavior in scope.

This file defines the catalogue of common Bootstrap-JS patterns and their preferred migration targets.

## Step 1: Verify whether Bootstrap JS is loaded under the target layout

Read the target layout file (`app/views/layouts/{name}.html.erb`). Check the `<script>` tags and JavaScript bundle imports. If Bootstrap JS / jQuery is not present, every Bootstrap-JS pattern in the migration scope **must** be migrated. Skipping this verification causes silent UX breakage.

## Step 2: Catalogue Bootstrap JS patterns in the target

For each instance, note: pattern name, count, intended behavior, current accessibility attributes (`aria-expanded`, `aria-controls`, etc.).

Common patterns:

| Pattern | Trigger | Behavior |
|---|---|---|
| Modal | `data-toggle="modal"`, `data-target="#x"` | Open / close a modal dialog with backdrop + focus trap |
| Collapse / accordion | `data-toggle="collapse"`, `aria-expanded`, `.collapse` | Show / hide a content region; multiple instances form an accordion |
| Dropdown | `data-toggle="dropdown"` | Show / hide a menu attached to a button |
| Tooltip | `data-toggle="tooltip"`, `data-placement` | Show a positioned tooltip on hover / focus |
| Popover | `data-toggle="popover"`, `data-content` | Tooltip with rich content, dismissible |
| Tabs | `data-toggle="tab"`, `.tab-content`, `.tab-pane` | Switch among tabbed content panels |
| Scrollspy | `data-spy="scroll"`, `data-target` | Highlight nav items based on scroll position |
| Dismissible alert | `.alert`, `data-dismiss="alert"` | Close button on an alert |
| Carousel | `.carousel`, `data-ride="carousel"` | Image / content slider |

## Step 3: Choose a migration target for each behavior

Preference order (best first) — pick the simplest option that fits:

1. **Native HTML element** (`<details>`/`<summary>`, `<dialog>`, `<input type="checkbox">`-driven CSS) — zero JS, lowest maintenance
2. **Existing Stimulus controller in the project** — reuse before extending
3. **New Stimulus controller** — for projects using Stimulus (typical for Rails)
4. **HeadlessUI / Radix UI** — only if the project already uses React
5. **Plain JavaScript with event listeners** — last resort

## Step 4: Common translations

### Modal

- **Native option:** `<dialog>` element + `dialog.showModal()` / `dialog.close()`. Browser-native focus trap, Esc handling, ARIA. Caveat: limited styling control of backdrop without `::backdrop` pseudo-element work.
- **Stimulus option (preferred for most cases):** controller `modal` with `open()` / `close()` actions. Targets: `dialog`, `backdrop`, `firstFocusable`. Handle Esc, click-outside, focus trap, `aria-hidden` toggle, body scroll lock.
- **Replace:** `data-toggle="modal" data-target="#x"` → `data-action="click->modal#open" data-modal-target-value="x"` (or analogous Stimulus pattern).

#### Native `<dialog>` traps

- **`m-0` (or any `margin: 0`) breaks centering.** The user-agent stylesheet centers `<dialog>` via `margin: auto` when opened with `showModal()`. Setting `margin: 0` overrides that → dialog renders at top-left of viewport. Fix: drop `m-0` from the dialog element's class list. If you need to neutralize spacing, use padding utilities, not margin.
- **`close` event vs `hidden.bs.modal`.** Native `<dialog>` fires a `close` event when it closes (any cause: button click, Esc, backdrop click, programmatic). Legacy AJAX response templates may listen for Bootstrap's `hidden.bs.modal` instead. To preserve the contract, attach a controller that listens for the native `close` and dispatches `hidden.bs.modal`. See `bootstrap-tailwind-coexistence.md` flavor 3.
- **Native dialogs are top-layer.** They render above all stacking contexts regardless of `z-index`. Don't fight the cascade trying to position them — they're correctly placed by the browser.

### Collapse / accordion

- **Native option:** `<details>`/`<summary>` — perfect for single-disclosure cases; CSS-style with `[open]` selector.
- **Stimulus option:** controller `disclosure` with `toggle()` action. Targets: `panel`, `trigger`, `iconClosed`, `iconOpen`. Sync `aria-expanded` on the trigger; toggle `hidden` on the panel; swap icon visibility.
- **Replace:** `data-toggle="collapse" data-target="#collapse1"` + `aria-expanded="false"` → `data-controller="disclosure" data-action="click->disclosure#toggle"`.

### Dropdown

- **Stimulus option:** controller `dropdown` with `toggle()`, `close()`, `closeOnClickOutside()`. Handle Esc, click-outside, keyboard arrow nav.
- **Native option:** `<details>` with custom styling — works for simple dropdowns.

### Tooltip

- **Native option:** `title="..."` attribute — browser-native tooltip; sufficient for most cases.
- **Stimulus option:** controller `tooltip` with `show()` / `hide()` actions on `mouseenter`/`mouseleave`/`focus`/`blur`. Use only when styling matters or when the tooltip needs rich content.

### Tabs

- **Stimulus option (preferred):** controller `tabs` with `select()` action. Targets: `tab`, `panel`. Handle keyboard arrow nav (`Left`/`Right`), Home/End, set ARIA roles (`tablist`, `tab`, `tabpanel`), sync `aria-selected` and `tabindex`.

### Dismissible alert

- **Native option:** small inline JS — `addEventListener('click', () => alert.remove())` on the close button. Or `<dialog>`-style handling.
- **Stimulus option:** controller `dismissible` with `dismiss()` action. Trivially small.

### Scrollspy

- **Stimulus option:** controller `scrollspy` using IntersectionObserver. Sync active class on nav links as sections enter the viewport.
- **CSS-only option:** `:target` pseudo-class for hash-based highlighting (limited).

## Step 5: Discover existing Stimulus controllers

Before specifying new Stimulus controllers, search `app/javascript/controllers/` for existing controllers with relevant names: `modal_controller.js`, `disclosure_controller.js`, `dropdown_controller.js`, `tabs_controller.js`. Reuse if present.

## Step 6: Spec each new Stimulus controller

For each new controller the plan calls for, document:

```markdown
### `{name}_controller.js`

- **Path:** `app/javascript/controllers/{name}_controller.js`
- **Targets:** {list of `static targets = [...]`}
- **Values:** {list of `static values = { ... }` if any}
- **Classes:** {list of `static classes = [...]` if styling toggles}
- **Actions:** {DOM event → method mapping, e.g., `click->modal#open`, `keydown.esc->modal#close`}
- **Keyboard interactions:** {Esc / Tab trap / arrow keys / Home / End — be explicit}
- **ARIA sync:** {which attributes the controller updates: `aria-expanded`, `aria-selected`, `aria-hidden`, etc.}
- **Focus management:** {trap on open / restore on close / move to first focusable / etc.}
- **Tests:** system spec at `spec/system/controllers/{name}_spec.rb` (or co-located with the consuming page)
```

## Required outputs in the plan

For each Bootstrap JS behavior in the migration scope, the plan must include:

```markdown
### Behavior: {pattern name, e.g., "Modal: book-a-call"}

- **Bootstrap source:** `data-toggle="modal" data-target="#diagnostic-engagement-book-analyst-call-modal"`
- **Migration target:** Stimulus `modal` controller / native `<dialog>` / etc.
- **Existing controller?** {yes — `app/javascript/controllers/X_controller.js` / no — new controller required}
- **Spec:** {as above, if new}
- **ARIA / accessibility:** {what the migration preserves or improves}
```

## Implementer responsibilities

- Create the Stimulus controllers per spec; do not invent controllers the plan didn't approve.
- Test each controller end-to-end via system spec — open / close / keyboard / ARIA.
- Update the Migration Summary's "Files added" with each controller path and the system-spec path.
- The user-validation walkthrough (per `validation-walkthrough-structure.md`) must include each migrated behavior with concrete trigger IDs.

## Anti-patterns

- **"It just works because Bootstrap JS is still loaded":** verify, don't assume. Many Tailwind layouts intentionally drop the Bootstrap JS bundle.
- **"We'll add the Stimulus controller later":** the page's interactivity breaks until then. Either the migration includes the JS, or the migration is incomplete.
- **"Use Stimulus for everything":** native `<details>` and `<dialog>` are simpler when they suffice. Don't add JS where the browser already provides the behavior.

## Fallback if absent

If this file isn't present at runtime, the referencing agent should default to:

> Identify each Bootstrap-JS pattern in the migration scope. Verify whether Bootstrap JS is loaded under the target layout. For each pattern, propose a Stimulus controller (preferred for Rails projects) or native HTML element (`<details>`, `<dialog>`) if that suffices. Document each controller's targets, actions, ARIA sync, and focus management.

— a competent default that lacks the pattern-by-pattern translation table and the specific controller specification format.
