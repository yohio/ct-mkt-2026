---
description: Interactive Bootstrap-to-Tailwind migration — scope, audit the cascade, plan, implement behind approval gates, verify visually.
argument-hint: "[view path | ticket key]"
---

# Migrate to Tailwind

**Orchestrator** — verifies the standards layer is present, then runs the three-phase migration with an approval gate after planning. Each agent loads its own phase-specific subset of the standards (see `${CLAUDE_PLUGIN_ROOT}/standards/README.md § Loading by phase`) — the orchestrator itself does not load them.

> **Note on freshly-installed agents:** if `tailwind-discovery`, `tailwind-planner`, `tailwind-implementer`, or `tailwind-adversary` were installed or modified during the current Claude Code session, they may not be dispatchable via `subagent_type` until Claude Code is restarted (the dispatcher snapshots the agent registry at session start). If a dispatch fails with "Agent type ... not found", restart Claude Code and rerun this command — the on-disk agent files will be picked up.

---

## Step 0: Resolve project knowledge (stop-point)

Three things below differ per repository and cannot be inferred from the diff. Resolve them **before** launching any agent — a migration built on a guessed path produces code that silently loads nothing.

**0a. Codebase conventions** — where views, partials, components, helpers, and Tailwind configs live, and the module casing the autoloader requires.

1. Read the `conventionsPath` config. If set and the file exists, use it.
2. If unset, look for one this repository may already carry: `.claude/tailwind-conventions.md`, `doc/tailwind-conventions.md`, or any file whose name contains both `tailwind` and `convention`.
3. If still unresolved, ask via `AskUserQuestion`:
   - **"It's at `<path>`"** — pass it to every agent as `conventions_path`.
   - **"Create one now"** — copy `${CLAUDE_PLUGIN_ROOT}/templates/tailwind-conventions.md`, then fill in what you can verify by reading the repository: glob `tailwind*.config.*`; read `app/views/layouts/` for bundle entry points; read one existing component for module casing; check `config/initializers/inflections.rb`; grep `config/routes.rb` for constraints. Mark everything you could not confirm as `TODO`. Ask where to write it, defaulting to `.claude/tailwind-conventions.md`. Then pass it on.
   - **"Proceed without one"** — the agents derive what they can and record it under **Assumed conventions**, unverified. Say plainly that the risk of a wrong path now sits with the reviewer rather than the tooling.

**This is the highest-stakes of the three.** Module casing the autoloader rejects fails at boot, not in review. And where a repository has more than one Tailwind config, editing the one the view does *not* load produces no visible change — which reads to everyone as "the migration did nothing".

**0b. Team standards documentation** — the authoritative docs that outrank this plugin's standards layer.

1. Read the `teamStandardsRoot` config. If set, the paths in Step 1 resolve under it.
2. If unset, check whether the repository carries its own: `docs/coding_standards/`, `doc/standards/`, `CONTRIBUTING.md`.
3. If still unresolved, ask once:
   - **"They're at `<path>`"** — use it, and tell the user to set `teamStandardsRoot`.
   - **"We have no separate standards docs"** — the plugin standards layer becomes authoritative for this run. **Record that in the final report**, because the precedence rule below then has only one tier and conflicts cannot be detected at all.

**0c. Notes output location** — where resume documents and saved plans get written.

1. Read the `notesRoot` config. If set, `{notes_root}` resolves to it.
2. If unset, and the user asks to stop mid-migration or to save a plan, ask where to write it, defaulting to `.claude/migration-notes/`. **Never write outside the repository without asking.**

Ask any unresolved questions in a **single** `AskUserQuestion` call. Never ask what the repository already answers, and never ask twice in one run.

## Step 1: Read Documentation and Standards

The migration workflow is **principles-driven** — opinionated rules live in standalone standards files that the agents reference, not embedded in the agent prompts. This step assembles the standards layer for this run.

### Team documentation (read these for project-level context)

Resolve `{team_standards_root}` from Step 0b. If it resolved, read whichever of these exist beneath it:

1. **Tailwind / CSS standards**
2. **Framework standards** (Rails, or whatever this repository uses)
3. **Testing standards**

Layouts vary per team — glob under the root rather than assuming a path. If Step 0b established that there are no separate team standards, skip this and note that the plugin standards layer is authoritative for this run.

> **Documentation precedence rule:** team documentation outranks the plugin standards layer (`${CLAUDE_PLUGIN_ROOT}/standards/`) whenever they disagree. Each migration agent loads `${CLAUDE_PLUGIN_ROOT}/standards/documentation-precedence.md` at startup and must STOP and surface conflicts to the user with a structured presentation — both options, with quotes, code examples, risk, benefit, and conformity verdicts — before proceeding. Codebase patterns observed on the base branch are evidence, not authority: a file existing there does not make it the convention when it conflicts with the docs.

### Migration principles layer

Each phase loads only the standards files relevant to its phase — see `${CLAUDE_PLUGIN_ROOT}/standards/README.md § Loading by phase` for the authoritative routing table. The orchestrator does NOT load the standards files itself; each agent loads its own subset at startup. This is for instruction-budget reasons (LLMs follow ~150–200 instructions reliably; loading every standards file in every phase exceeds that and degrades attention to specific rules — see https://www.heavybit.com/library/article/whats-missing-to-make-ai-agents-mainstream).

Verify the standards layer is present and note any missing files for fallback handling:

```bash
ls ${CLAUDE_PLUGIN_ROOT}/standards/
```

Expected files (per the `Files` table in the layer README):

- `frontend-migration-principles.md` (now includes the cardinal "Read BS3 SCSS per class" rule)
- `pre-migration-snapshot.md` (defines the snapshot-before-migration capture)
- `cascade-audit.md` (per-element cascade audit — orthogonal axis to the class-keyed cardinal rule; defines high-risk-element classifier + audit table format)
- `top-down-traversal.md` (DOM traversal order: parent → children, top-to-bottom siblings)
- `consolidation-and-refactor.md` (opportunistic spaghetti-code cleanup during migration)
- `visual-fidelity-modes.md`
- `validation-walkthrough-structure.md` (includes per-section validation gate during implementation)
- `branded-css-rules.md`
- `page-css-decomposition.md`
- `cross-page-impact.md`
- `js-behavior-migration.md`
- `icon-migration.md`
- `bootstrap-tailwind-coexistence.md`
- `stimulus-controller-design.md`
- `playwright-visual-validation.md`

Also verify the companion script:

```bash
test -f ${CLAUDE_PLUGIN_ROOT}/scripts/tailwind-migration-screenshot.mjs && echo "script ok"
```

If any standards files are missing, the referencing agent uses the "Fallback if absent" guidance documented at the bottom of each file. If the Playwright script is missing, the implementer falls back to the lightweight `npx playwright screenshot` snippet in its own prompt (see `tailwind-implementer.md § Fallback procedure`). Note any missing pieces in `standards_summary` so the user knows the workflow is operating without the full layer.

### Summarize for the agents

Build a `standards_summary` block to pass to discovery / planner / implementer:

- **Project standards loaded:** {paths from the project documentation list above}
- **Principles layer:** {`all 10 present` OR `missing: <list>`} — agents will load the subset they need per `${CLAUDE_PLUGIN_ROOT}/standards/README.md § Loading by phase`
- IT/HR branding separation (separate stylesheets, route constraints — project-specific)
- Testing requirements (outside-in, request specs, system specs, ≥ 90% coverage — project-specific)

Don't restate the principles content in the summary — each agent loads what it needs directly.

---

## Step 2: Discovery

Launch the `tailwind:tailwind-discovery` agent. Pass:

- `standards_summary` from Step 1
- `conventions_path` from Step 0a (omit if the user chose to proceed without one)
- Any user-provided context (target view, IT/secondary segment, etc.)

The agent will:

- **Phase A**: ask the user scoping questions
- **Phase B**: locate and audit the target (Bootstrap usage, shared layout patterns, JS behaviors, cross-page impact, legacy contracts, controller findings)
- **Phase B.5**: per-element **cascade audit** for high-risk elements (ID-anchored, form controls, modals, sticky/fixed, multi-strand selectors). Produces `cascade-audit.md` in the snapshot dir — every rule that matches each element, with computed specificity and per-declaration cascade winners. Orthogonal axis to the cardinal "read BS3 SCSS per class" rule.
- **Phase C**: capture the **pre-migration snapshot** — rendered HTML + BS3 SCSS + related JS files saved to `tmp/migration-snapshots/{ticket-slug}/pre-migration/`, with `00-INDEX.md` class catalogue. This is the ground truth the cardinal "Read BS3 SCSS per class" rule operates against.
- **Phase D**: audit consolidation opportunities (duplicate markup, deep nesting, non-descriptive class names) — surfaces candidates without deciding.

When it returns, capture its output as the **Discovery Report**. Show a one-paragraph summary to the user (target view, site, approach, snapshot path, cascade-audit summary counts, key consolidation candidates) and confirm before proceeding.

---

## Step 3: Planning

Launch the `tailwind:tailwind-planner` agent. Pass:

- The full **Discovery Report** from Step 2
- The `standards_summary` from Step 1
- `conventions_path` from Step 0a (omit if the user chose to proceed without one)

The agent will produce a **Migration Plan** with:

- Class mappings with **mandatory BS3 SCSS source citations** (per the cardinal rule — every row in the mapping table must cite the file:line where the SCSS rule lives in the pre-migration snapshot). Table now includes **BS3 specificity (a,b,c,d), Tailwind selector specificity, and Winner-changed? columns** — any row marked YES must have a matching reconciliation block in Section 2.5.
- **Section 2.5 — Cascade audit review** — one reconciliation block per high-risk element from the discovery audit: winning BS3 rule, translation target, naive-translation trap, combined-selector partners, intra-section gate flag.
- **Section-by-section breakdown** — DOM regions listed in pre-order depth-first traversal order, with section IDs the implementer will execute one at a time
- **Consolidation plan** — each discovery-surfaced candidate classified as in-scope / flagged / leave-alone
- ViewComponent decisions, route/controller changes, file-by-file step list, testing strategy

---

## Step 4: User approval gate (REQUIRED)

Display the Migration Plan to the user. Wait for one of:

- **Approved** → proceed to Step 5
- **Changes requested** → relay the changes to `tailwind-planner` and re-present
- **Rejected** → ask how the user wants to approach it differently; consider re-running `tailwind-discovery` if scope changes materially

Do NOT proceed to implementation without explicit approval. The plan is the user's last chance to redirect cheaply.

---

## Step 5: Implementation

Launch the `tailwind:tailwind-implementer` agent. Pass:

- The **approved Migration Plan** from Step 3 (with any modifications from Step 4)
- The **Discovery Report** from Step 2 (for context, especially the snapshot path)
- The `standards_summary` from Step 1
- `conventions_path` from Step 0a (omit if the user chose to proceed without one)

The agent will execute the plan **section-by-section, top-down depth-first**, per the breakdown table in the plan. After every section is migrated, the agent:

1. Captures a mid-migration screenshot of the just-migrated section
2. Diffs against the pre-migration screenshot of the same DOM region
3. Surfaces to the user via `AskUserQuestion` with section-specific context: "Section N: <name> migrated. Anything off before I move to section N+1?"
4. Waits for explicit approval before advancing to the next section

The agent reads the BS3 SCSS rule for every class **before translating it**, per the cardinal rule documented in `frontend-migration-principles.md`. The pre-migration snapshot from Step 2 (Phase C) provides the SCSS files locally and the class catalogue with source-line pointers.

The agent ALSO reads the per-element cascade audit (`cascade-audit.md`) for every element the plan's Section 2.5 flagged "High-risk flag = Yes," and triggers an intra-section element gate after migrating each one (in addition to the section gate). The two-level gate structure — element gate inside a section, then the section gate — is the implementation of QRSPI's per-element checkpoint adoption (see `cascade-audit.md` § Failure modes for the specific mistakes this prevents).

**Adversarial review for high-risk elements.** Before each per-element user gate, the implementer spawns the `tailwind:tailwind-adversary` agent (read-only, scoped to one element, prompted to disprove the translation). The adversary anchors on the cascade-audit row rather than the implementer's class-by-class reading, catching specificity miscounts, missed combined selectors, FA4 leaks, and hex-case traps that the implementer's own attention has glossed over. Loop runs up to 3 iterations — on iteration-3 FAIL the disagreement is surfaced to the user in the per-element gate. PASS does not substitute for the user gate; both run.

After all sections complete, the agent runs the end-of-page validation walkthrough (per `validation-walkthrough-structure.md`), runs RuboCop and RSpec on changed files, and produces a Migration Summary.

**At any point the user can choose "Stop here for now"** at a section gate. The agent writes a resume doc capturing state and returns control to the user — the migration becomes a multi-session effort with natural commit boundaries at section completions.

**Session-restart discipline.** The implementer surfaces a "consider restarting in a fresh session" recommendation after every 5 completed section gates (blocking at 10). LLM context windows degrade past ~40% utilization, and long migration sessions accumulate conversation history that pushes the model toward instruction-drift. The orchestrator does not need to enforce this — the implementer does, with a resume doc at `{notes_root}/{TICKET-ID}/RESUME-{date}-{section}.md`.

---

## Step 6: Report back

Show the user the implementation agent's Migration Summary. Suggest committing in a logical sequence — natural commit boundaries are the section completions from the per-section gate flow (Step 5). Remind them of the end-of-page validation walkthrough and any deferred items from the consolidation plan.

---

$ARGUMENTS
