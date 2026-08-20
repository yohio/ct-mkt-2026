# Bootstrap-Tailwind Coexistence

A migrated Tailwind page is rarely standalone. Even after the markup is fully Tailwind, the page typically still depends on Bootstrap-era code — global button CSS, shared form partials, modal AJAX response templates, jQuery handlers — that lives elsewhere in the codebase and isn't being touched in the migration's scope.

If those dependencies break under the new Tailwind layout, the page renders but doesn't *work*: forms look unstyled, modals open but don't close, AJAX submissions silently fail. Visual diff doesn't catch any of it.

This file defines the four flavors of dependency that come up, how to find them at discovery time, and the three resolution strategies.

## The four flavors

### 1. Global Bootstrap CSS not loaded under the Tailwind layout

The Tailwind layout's stylesheet bundle (`<segment>_application_tailwind.css`) doesn't include `bs_upgrade*.scss`, `bootstrap3/global/_buttons.scss`, or any other shared Bootstrap CSS. Classes like `.btn`, `.btn-cta`, `.btn-acquire`, `.form-control`, `.row`, `.col-sm-*`, `.standard-height`, `.alert` — used by markup the migration didn't touch — render unstyled.

**How to detect:** at discovery time, for every styling class on a button, form, or shared markup pattern in scope, grep `app/assets/stylesheets/bootstrap3/` for the rule. If it's there but not in the Tailwind bundle's imports, it's a missing dependency.

### 2. Shared form partials with Bootstrap classes

Forms rendered via shared partials (typical: `customer_requests/bootstrap3/...`, `prospects/bootstrap3/...`) emit Bootstrap grid + form-control HTML. When that partial is rendered inside a Tailwind page (whether directly or through a wrapper modal), its `.row`, `.col-sm-12`, `.form-control`, `.right-padding`, etc. classes have no styles → form fields render as bare unstyled inputs.

**How to detect:** find the partial path. Read it. Look for `class="row"`, `class="col-..."`, `class="form-control"`, `class="standard-height"`, `class="left-padding"`, `class="right-padding"`. If any present and the Tailwind bundle doesn't define them, you have this dependency.

### 3. Legacy AJAX response templates

`form_for ... remote: true` triggers Rails UJS, which executes a `.js.erb` response template against the live DOM. Those response templates were written assuming Bootstrap-modal structure: they query for `.js-customer_request_modal.in`, manipulate `.modal-body`, dispatch / listen for `hidden.bs.modal`, etc.

If your migrated wrapper doesn't preserve those class names AND emit those events, the response template can't update anything → form submit appears to do nothing.

**How to detect:** for every `form_for ... remote: true` (or `data-remote="true"`) in scope, find the matching `<resource>/create.js.erb`, `update.js.erb`, etc. Read it end-to-end. List every selector and every event listener it uses. Those are the DOM contracts your wrapper must honor.

### 4. Legacy jQuery handlers in shared `.js` / `.coffee` files

Files like `customer_requests.js`, `appointments.js` register `$(document).on('click', '.js-foo-link', ...)` handlers globally. They run on every page that loads that JS. If your trigger has the right class, they run. If you renamed the class while migrating, they don't.

**How to detect:** for every JS-hook class on a trigger or form in scope (`js-inline-form-link`, `js-customer_request_modal`, `js-back-to-browsing`, etc.), grep the `app/assets/javascripts/` and `app/javascript/` directories for handlers attached to that class. Renaming the class breaks the handler unless the JS is updated too.

## Resolution strategies

For each dependency, the planner picks one:

### A. Bootstrap-CSS shim scoped to a wrapper class

Re-implement just the needed Bootstrap rules, scoped to a stable class on the wrapping container so the rules don't leak.

```css
.js-customer_request_modal {
  & .row { display: flex; flex-wrap: wrap; margin: 0 -15px; }
  & .col-sm-6 { flex: 0 0 50%; max-width: 50%; padding: 0 15px; }
  & .form-control { display: block; width: 100%; height: 36px; padding: 6px 12px; ... }
}
```

- **Best when:** the dependency is CSS-only (flavor 1 or 2) and the rules are stable enough to inline. The shim is intentionally minimal — only what the rendered HTML actually uses.
- **Cost:** a small piece of legacy CSS lives in your Tailwind file. Document it as a shim with a deletion path (e.g., "delete when per-reason Tailwind form variants exist for X and Y").
- **Pitfall:** un-scoped Bootstrap rules collide with Tailwind utilities. ALWAYS scope to a wrapper class.

### B. Compat-emitting Stimulus controller

Wrap the modern element (native `<dialog>`, custom Tailwind div) in a controller that adds the legacy class names AND fires the legacy events.

```js
// On open: add 'in' class, dispatch 'shown.bs.modal'
// On close: remove 'in', dispatch 'hidden.bs.modal'
```

- **Best when:** the dependency is on JS event flow (flavor 3) — the response template needs to find `.js-customer_request_modal.in` and react to `hidden.bs.modal`.
- **Cost:** the controller carries Bootstrap-isms in its API. Document why ("preserves contract for legacy `create.js.erb`").
- **Pitfall:** native `<dialog>` close fires the `close` event, NOT `hidden.bs.modal`. The controller has to translate between them.

### C. Full Tailwind variant fork

Author a per-reason / per-context Tailwind variant of the partial, and switch the page to render the Tailwind subfolder.

```ruby
# Before
render 'customer_requests/bootstrap3/...'
# After
render 'customer_requests/tailwind/...'
```

- **Best when:** the legacy partial is in active migration AND a Tailwind variant for THIS specific reason / use already exists or is being authored.
- **Cost:** highest scope — author the variant + tests + ensure parity. Often out of scope for one migration.
- **Pitfall:** the helper that picks the partial (e.g., `customer_request_form_partial(customer_request, subfolder)`) raises if the variant doesn't exist for the specific reason. Verify the path resolves before committing to this strategy.

## Discovery output

The Discovery Report's "Cross-page impact" section already catalogues partial / component dependencies. Add a parallel **"Legacy DOM/CSS/JS contracts"** subsection that catalogues:

```markdown
### Legacy DOM/CSS/JS contracts in scope

| Contract | Source | Selectors/events depended on | Strategy |
|---|---|---|---|
| `customer_requests/create.js.erb` | AJAX response to form submit | `.js-customer_request_modal.in`, `.modal-body`, `.modal-form`, `hidden.bs.modal` event | Compat-emitting Stimulus controller |
| `customer_requests.js` jQuery handlers | global | `.js-inline-form-link`, `.js-customer_request_modal[data-submission-ajax-path-present=true]` | Preserve class names; no rename |
| Bootstrap form CSS (`.row`, `.col-sm-*`, `.form-control`) | bootstrap3 form partial | grid + input styling | CSS shim scoped to `.js-customer_request_modal` |
| `.btn-cta` / `.btn-acquire` global rules | `bs_upgrade*.scss` (not loaded by Tailwind layout) | base button typography / sizing / colors | Replicate inline in page CSS |
```

For each contract: name what's depended on, where the dependency lives, and which strategy will resolve it.

## Why this exists

Without this audit, migrations ship pages that look right in static screenshots but don't function. The user clicks Submit; nothing happens. The user opens an FAQ; nothing toggles. The user fills out a form; the AJAX response runs against the wrong DOM and silently no-ops.

Pixel diff doesn't catch any of it. System-spec markup assertions don't catch any of it. Only an explicit catalogue of legacy contracts + a chosen strategy per contract catches it before merge.

## Fallback if absent

If this file isn't present at runtime, the referencing agent should default to:

> Before migrating, identify whether the page's forms, modals, or shared partials depend on Bootstrap CSS classes or jQuery event handlers that aren't loaded under the Tailwind layout. If so, either re-implement the styling locally (scoped to a wrapper class) or preserve the legacy class names and event flow.

— a competent default that lacks the four-flavor taxonomy and the contract-by-contract audit format.
