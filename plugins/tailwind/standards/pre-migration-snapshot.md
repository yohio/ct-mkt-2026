# Pre-Migration Snapshot

Capture the source-of-truth state of a page before the migration starts. The snapshot is a reference the planner and implementer consult repeatedly — to verify a class translation matches the original, to diff intent vs. result, and to anchor user-validation conversations.

## Why snapshot before migration

When a migration runs without a reference snapshot:

- The implementer guesses at BS3 styling instead of reading it (the "350px absolute box" failure mode where `.surfaced-form` was translated as a small misplaced container when it was a full-width banner)
- BS3-class mappings drift because the original visual context is gone after the first edit
- Visual-diff baselines only capture screenshots — they don't capture the CSS *rules* that produced them, so when a translation goes wrong it's hard to know what the right rules were
- The user has to remember "what the page used to look like" instead of pointing at a saved reference

The snapshot solves this by capturing **markup + SCSS + JS** at one point in time so the migration can be verified against ground truth at every step.

## What to snapshot

For the target page being migrated, snapshot:

1. **Rendered HTML** — full DOM output from production (or master branch local render). View-source format is fine if that's what's available. Save the actual page HTML at the URL.
2. **All BS3 SCSS files referenced by the page** — every `_<partial>.scss` whose rules apply on the target page. Trace via:
   - The page's controller/layout → which CSS bundle imports
   - The bundle's imports — collect every relevant `bootstrap3/partials/*.scss` and `bootstrap3/global/*.scss`
   - Search for class names that appear in the page's HTML/ERB inside those SCSS files
3. **Page-level CSS file** — if the page has a dedicated `_<page>.scss` partial, snapshot it in full
4. **Related JS files** — every jQuery handler, Stimulus controller, or inline `<script>` that touches the page's DOM. Include any `.js.erb` AJAX response templates the page's forms hit.
5. **External script references** — note URLs of third-party scripts (FormFill, FontAwesome kit, analytics) — these don't need to be downloaded but their *presence* needs to be recorded

## Where to save the snapshot

```
tmp/migration-snapshots/{ticket-id-or-slug}/pre-migration/
├── 00-INDEX.md                          # human-readable index of the snapshot
├── rendered-html/
│   ├── prod.html                         # from production
│   └── local-master.html                 # from local master (optional, for sanity check)
├── scss/
│   ├── bootstrap3-partials-*.scss        # one per relevant partial, original filename
│   ├── bootstrap3-global-*.scss
│   └── page-specific.scss                # if the page has its own
├── javascript/
│   ├── jquery-handlers.js                # extracted from BS3 .js files; one section per pattern
│   ├── stimulus-controllers/             # paths of existing controllers the page uses
│   └── js-erb-responses/                 # AJAX response templates
└── external-scripts.md                   # URLs and purpose of third-party scripts
```

The `00-INDEX.md` is critical — it's the single page the planner and implementer reference. It should contain:

- Target URL + branch + commit hash + capture date
- File-by-file purpose summary
- "Class catalogue" — every distinct CSS class appearing in the rendered HTML, with a one-line "what does this style" derived from the SCSS

## How the planner uses the snapshot

For every BS3 class mapping in the Migration Plan:

1. Open `00-INDEX.md` → find the class in the class catalogue
2. Open the referenced SCSS file → read the rule end-to-end
3. Translate only after reading. Cite the source line number (`per pre-migration-snapshot scss/bootstrap3-partials-publications_solution_sets.scss:3493`) in the plan's mapping table

This is the "Read BS3 SCSS per class before translating" rule made operational — the snapshot makes it trivial to do.

## How the implementer uses the snapshot

For every section being migrated:

1. Open `rendered-html/prod.html` → find the section in the DOM
2. Re-confirm the structure matches what the planner described
3. Cross-reference the SCSS for every class in that section before writing the translated markup
4. When the user reports "looks different from BS3," the FIRST diagnostic is to open the snapshot HTML and the live local URL side-by-side

## How visual validation uses the snapshot

The Playwright baseline capture (Step 0 of the plan) produces *screenshots*. The pre-migration snapshot produces *code*. Both are reference artifacts for different parts of the workflow:

- Screenshots → visual diff comparison
- Code snapshot → translation verification + user-facing "see, BS3 does this on line N" pointer

When the user reports a visual issue, the implementer reaches for the code snapshot first (because it explains the *intent*), and the screenshot second (because it shows the *result*).

## When to refresh the snapshot

The snapshot is captured ONCE at the start of discovery. It does NOT update during the migration. If the source page on master changes during the migration (rare but possible if another developer touches it), the implementer should:

1. Note the divergence
2. Surface to the user — "master moved during migration; should we re-snapshot?"
3. Do not silently overwrite the snapshot — it's the reference for everything done so far

## Fallback if absent

If this file isn't present at runtime, the referencing agent should default to:

> Save a copy of the rendered HTML and any BS3 SCSS files referenced by the page to a `tmp/migration-snapshots/<slug>/pre-migration/` directory before starting the migration. Reference these files when translating each class.

— a competent default that captures the intent without the structured index format.
