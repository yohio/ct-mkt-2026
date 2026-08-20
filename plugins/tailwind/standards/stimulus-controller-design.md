# Stimulus Controller Design

When a Tailwind migration introduces a new Stimulus controller (or extends one), three traps come up repeatedly. This file documents them and the patterns that avoid them.

## Trap 1: `static classes` requires markup contract that's easy to forget

Stimulus's `static classes` lets a controller reference a class name configurable per-instance:

```js
static classes = ['hidden'];

#applyState(expanded) {
  if (this.hasHiddenClass) this.panelTarget.classList.remove(this.hiddenClass);
}
```

For this to work, the markup MUST set `data-<controller-name>-hidden-class="hidden"` on the controller element:

```html
<div data-controller="disclosure" data-disclosure-hidden-class="hidden">
  ...
</div>
```

If the markup doesn't set the data attribute, `this.hasHiddenClass` is `false` and the class is never toggled. The controller silently no-ops. The HTML `hidden` attribute may toggle correctly, but Tailwind's `.hidden { display: none }` class wins on specificity → the panel stays invisible.

### Rule

Use `static classes` ONLY when:
- The controller is genuinely reusable across multiple call sites
- AND those call sites need different class names

For one-off controllers — disclosure on a specific page, dialog on a specific page — **hard-code the literal string**:

```js
// Better for one-off use
this.panelTarget.classList.toggle('hidden', !expanded);
```

Simpler, no markup contract to remember, no silent no-op when the data attribute is missing.

## Trap 2: ARIA sync targeted at one element when multiple are clickable

When a disclosure / dropdown / accordion has multiple clickable triggers (e.g. icon link AND question link both opening the same panel), designating a single `trigger` target and syncing ARIA on that target only means OTHER triggers fall out of sync.

In the engagement-program FAQ migration: each disclosure had two `<a>` elements with their own `aria-expanded="false"`, both wired to `disclosure#toggle`. Marking only one as `data-disclosure-target="trigger"` meant clicking the other left its `aria-expanded` permanently at `"false"` → screen readers announce "collapsed" even when the panel is open.

### Rule

Sync ARIA across **every** clickable trigger inside the controller's scope, not just one designated target:

```js
toggle(event) {
  if (event) event.preventDefault();
  const trigger = this.element.querySelector('[aria-expanded]');
  const expanded = trigger?.getAttribute('aria-expanded') === 'true';
  this.#applyState(!expanded);
}

#applyState(expanded) {
  this.element.querySelectorAll('[aria-expanded]').forEach((el) => {
    el.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });
  // ... toggle panel and icons
}
```

`this.element.querySelectorAll('[aria-expanded]')` finds every trigger in scope. They all stay consistent regardless of which one fired the click.

If you genuinely need only ONE clickable element per disclosure, that's fine — the loop will find it and the rule still works.

## Trap 3: `connect()` ignores server-rendered initial state

Stimulus controllers' `connect()` callback fires when the controller attaches. If `connect()` does nothing, server-rendered "open by default" markup (panel without `hidden` attribute, trigger with `aria-expanded="true"`) won't have its visual state synced — the icon swap and class toggling won't run, even though the aria/hidden say "open."

### Rule

In `connect()`, read the existing aria/data attributes and call the same `#applyState` (or equivalent) the toggle uses, so server state always matches visual state:

```js
connect() {
  const trigger = this.element.querySelector('[aria-expanded]');
  const expanded = trigger ? trigger.getAttribute('aria-expanded') === 'true' : false;
  this.#applyState(expanded);
}
```

This pattern composes: any future state-mutation methods (e.g., `expandFromUrlHash()`) call the same `#applyState` and the system stays consistent.

## Trap 4: System spec asserts markup, doesn't verify behavior

System specs that assert `have_css('[data-controller="disclosure"]')` and `have_css('[data-disclosure-target="panel"]')` pass even when the controller has bugs (wrong target name, missing class toggle, broken ARIA sync). Markup-only assertions give false confidence.

### Rule

When introducing a Stimulus controller, pair the markup-presence assertions with a **behavior-driving check** — either:

- A system spec that uses `js: true` and `find('...').click` to fire the action, then asserts the post-click state (`expect(page).to have_css('.faq-container[aria-expanded="true"]')`)
- A separate Playwright debug script run during development to verify the click actually toggles state
- A JS-driver feature spec

Don't ship Stimulus controllers without one of these. The disclosure-controller bug shipped because the markup was right and 65 system-spec assertions passed — but no test actually clicked an FAQ.

## Controller spec template

For new Stimulus controllers, document in the plan:

```markdown
### Stimulus controller: {name}

- **Targets:** {list, e.g., panel, iconClosed, iconOpen}
- **Values:** {list, e.g., id: String} (only if cross-element references needed)
- **Actions:** {list, e.g., toggle, open, close}
- **State management approach:**
  - Class toggling: hard-coded literal string (`'hidden'`) — NOT static classes, unless multiple instances configure different classes
  - ARIA sync: query all `[aria-expanded]` in `this.element` scope — NOT a single trigger target
  - Initial state: `connect()` reads existing markup state and calls `#applyState` for consistency
- **Behavior verification:**
  - System spec drives `click` and asserts post-state (NOT just markup presence)
  - OR Playwright debug script run during development
```

## Fallback if absent

If this file isn't present at runtime, the referencing agent should default to:

> When writing Stimulus controllers, prefer hard-coded class names over `static classes`, sync ARIA across all clickable triggers in scope, sync visual state from server-rendered markup in `connect()`, and verify behavior with a click-driving test rather than markup-presence assertions alone.

— a competent default that lacks the named traps and the spec template.
