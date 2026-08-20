---
name: ticket-pipeline
description: Quality-gated, multi-model pipeline that takes a JIRA ticket from plan → execute → adversarial (GAN) verification → independent review, with checkpoints between phases. Use when the user invokes /ticket-pipeline, or asks to run the full plan-execute-review pipeline on a ticket with cross-model verification. Plans on Opus, picks Sonnet/Opus for execution by complexity, uses Codex as an adversarial discriminator, and finishes with an independent Opus review. Never commits or pushes.
---

# Ticket Pipeline

A five-stage pipeline built entirely from native primitives + the already-installed Codex plugin (`codex@openai-codex`). It runs on the main **Opus** session and delegates execution to a subagent whose model is chosen at runtime.

**The point of this skill is not orchestration — it is verification.** Quality and low hallucination come from (a) grounding every stage in the ticket scope and (b) an adversarial discriminator from a *different model family* (Codex/GPT) that tries to break the work. Keep that center of gravity in mind at every step.

## Standing rules (apply to every stage)

- **Never `git commit` or `git push`.** The pipeline ends by telling the user the branch is ready for *them* to push. This is absolute.
- **Review reasoning stays on Opus.** Stages 1, 2, and 4, and the aggregation of GAN verdicts, are done by the main Opus thread or Opus subagents — never delegated to a cheaper model.
- **Honor checkpoints.** Pause and wait for the user at each checkpoint unless `--auto` was passed. Even with `--auto`, still stop before any commit.
- **No silent caps.** If the GAN loop hits its round cap without converging, say so plainly and hand the unresolved findings to the user — never imply a clean pass.

## Argument parsing

From the forwarded args, extract: an optional **ticket id**; `--exec-model <sonnet|opus>` (forces Stage 2); `--max-gan-rounds <n>` (default `3`); `--auto` (skip intermediate checkpoint pauses, still never commit).

---

## Stage 0 — Prerequisite check + Ground

**0a. Codex must be ready.** Resolve the Codex plugin root and confirm the CLI is available:

```bash
CODEX_ROOT=$(ls -d ~/.claude/plugins/marketplaces/*/plugins/codex 2>/dev/null | head -1)
[ -n "$CODEX_ROOT" ] && node "$CODEX_ROOT/scripts/codex-companion.mjs" setup --json
```

If `$CODEX_ROOT` is empty or the setup output reports Codex missing/unauthenticated, **stop** and tell the user to run `/codex:setup` (and `codex login` if needed) before retrying. The GAN discriminator is the core of this pipeline — do not proceed without it. Remember `$CODEX_ROOT` for Stage 3.

**0a-ii. The `pr-review` plugin must be installed.** Stage 4 launches `pr-review:diff-analyzer` and `pr-review:pr-reviewer` for the independent review. Confirm they are available:

```bash
claude plugin list 2>/dev/null | grep -q "pr-review" && echo "pr-review present" || echo "pr-review MISSING"
```

If it is missing, **stop** and tell the user to run `claude plugin install pr-review-tooling`. Do not substitute your own review for Stage 4 — the whole point is that it is independent of the loop that produced the code, and a self-review defeats it. This is deliberately not declared as a hard plugin dependency, so that `/start-ticket` and `/run-spike` stay usable without installing the review stack.

**0b. Load JIRA context.** Launch the `ticket-context:jira-context-loader` agent — pass the ticket id if provided, else let it extract from the branch; pass `depth: full`. If no ticket can be identified (branch is `master`/`main` or has no ticket pattern), ask the user which ticket to run. Display the summary.

**0c. Load prior work.** Launch the `ticket-context:prior-work-loader` agent with the ticket id. Summarize anything relevant.

Keep the JIRA summary, **acceptance criteria**, and prior-work findings as the `grounded_context` — you will inject it into Stages 1, 3, and 4. This is the anti-hallucination foundation; under-specified prompts are where invented behavior comes from.

---

## Stage 1 — Plan (Opus)

Launch the `ticket-workflow:work-planner` agent **with a `model: opus` override** (its frontmatter defaults to Sonnet; force Opus for planning). Pass `ticket_id`, `ticket_title`, `jira_context`, and `prior_work` from Stage 0.

It returns a phased work plan, a **complexity assessment**, a file inventory, and a testing strategy. Keep all of it.

> **Checkpoint 1 — approve plan.** Show the plan + complexity assessment. Ask the user to approve, amend, or redirect. If `--auto`, skip the pause but still print the plan.

---

## Stage 2 — Complexity → model decision (Opus)

If `--exec-model` was passed, use it and skip the rubric (still print which model and why the user forced it).

Otherwise apply this rubric to the Stage 1 complexity assessment:

- **Choose Opus if ANY hold:** cross-cutting/architectural change; ambiguous or thin requirements; a new pattern/abstraction is being introduced; security- or money-sensitive; touches many subsystems; non-trivial ActiveRecord/query logic or a data migration/backfill.
- **Choose Sonnet only if ALL hold:** localized change; a clear existing pattern to copy; unambiguous acceptance criteria; few files; largely mechanical.
- **Tiebreak → Opus.** Quality over cost.

State the decision and the one or two rubric signals that drove it.

> **Checkpoint 2 — approve model.** Let the user override. If `--auto`, skip the pause but print the decision + rationale.

Call the chosen model `EXEC_MODEL` for the next stage.

---

## Stage 3 — Execute + multi-vote GAN loop

### 3a. Execute

Spawn an execution subagent via the `Agent` tool: `subagent_type: general-purpose`, **`model: <EXEC_MODEL>`**. In its prompt include:

- `grounded_context` (JIRA summary + **acceptance criteria** + prior work) and the approved Stage 1 work plan.
- An explicit instruction to **study the existing patterns it must match *before* editing** (read the neighboring code, mirror the conventions already in the repo) — do not invent new abstractions unless the plan calls for them.
- Stay strictly within the ticket scope; implement what the acceptance criteria require and nothing more.
- Return a **per-file summary** of what changed and why (so the main thread can teach it at Checkpoint 3).

### 3b. GAN discriminator (multi-vote, majority-accept)

Run the Codex adversarial reviewer over the working-tree changes **three times**, once per framing. Sequential `--wait` calls are the reliable default:

```bash
node "$CODEX_ROOT/scripts/codex-companion.mjs" adversarial-review --wait --scope working-tree "<framing focus>"
```

Use these three framings verbatim as the focus text:

1. **Correctness** — "Focus only on correctness: logic errors, unhandled edge cases, nil/exception paths, off-by-one, wrong assumptions about the data. Ignore style and naming."
2. **Scope-drift** — "Focus only on scope against the ticket's acceptance criteria: <paste acceptance criteria>. Flag any behavior, feature, file, or abstraction added beyond what the criteria require, and any criterion left unmet."
3. **Pattern-fit** — "Focus only on whether this matches how similar things are already done in this repo and team Rails conventions. Flag deviations from existing patterns."

### 3c. Aggregate (Opus judgment)

Read all three outputs. Classify each as **CLEAN** (no must-fix / should-fix issues; nits don't count) or **ISSUES**. 

- **Converged** when **≥2 of 3 are CLEAN.** Proceed to Checkpoint 3.
- **Not converged** — consolidate the real (must-fix / should-fix) issues across all three reviews, dedupe them, and send them back to a fresh execution subagent (same `EXEC_MODEL`) with an instruction to fix **only** those issues. Then re-run 3b. 
- Increment a round counter each fix cycle. **Stop at `--max-gan-rounds` (default 3).** If the cap is reached still not converged, **do not proceed silently** — present the outstanding findings to the user and let them decide (fix manually, raise the cap, or accept the risk).

> **Checkpoint 3 — walk the diff.** Once converged (or capped), the main **Opus** thread walks the user through the actual diff: what changed, what Codex flagged across the rounds, and how each real issue was resolved. This is the teaching beat — explain the *why*, not just the *what*. If `--auto`, still print this walkthrough; do not pause.

---

## Stage 4 — Independent final review (Opus)

This review must be **independent** of the loop that produced the code — do not reuse the execution subagent's reasoning.

1. Launch the `pr-review:diff-analyzer` agent (`mode: full`) to categorize the branch changes and capture the diff.
2. Launch the `pr-review:pr-reviewer` agent **with a `model: opus` override**, passing: `ticket_id`, `jira_context` (including acceptance criteria), `diff_analysis`, `prior_work`, and the `full_diff`. Instruct it to explicitly cover the three axes the user cares about:
   - **(a)** code quality / Rails and team standards,
   - **(b)** fit with existing approaches and patterns,
   - **(c)** within **JIRA scope** — cite each acceptance criterion and whether it's met, and flag anything beyond scope.

Present the review report. If it surfaces must-fix issues, offer to loop back into a targeted fix (execution subagent at `EXEC_MODEL`, then a re-review) rather than declaring done.

> For a heavier gate, note that `/wwbs` (the full staged self-review) is available as a drop-in alternative to `pr-reviewer` here.

---

## Finish

When Stage 4 is clean (or the user accepts remaining items), tell the user:

> The pipeline is complete. The branch is ready — **you** push it (I don't push, per your git-safety rule). Nothing was committed automatically.

Summarize: execution model used, number of GAN rounds and whether it converged, and the final review verdict.
