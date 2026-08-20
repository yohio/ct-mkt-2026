---
description: Plan, execute, adversarially verify, and independently review a ticket across models.
argument-hint: "[ticket key]"
---

# Ticket Pipeline

**Entry point** — a quality-gated, multi-model pipeline that takes a JIRA ticket from plan → execute → adversarial (GAN) verification → independent review, with a human checkpoint between phases. Never commits, never pushes.

Use this **deliberately, for substantial tickets** — it makes several extra model calls per run (some on OpenAI's meter via Codex). It is overkill for a typo or a one-line fix; use a normal edit for those.

---

## What this command does

It runs the `ticket-pipeline` skill, which orchestrates five stages on the main Opus session:

0. **Ground** — load JIRA scope + prior work (injected into every later stage).
1. **Plan** (Opus) — phased work plan + complexity assessment. *Checkpoint.*
2. **Model decision** (Opus) — rubric picks Sonnet vs Opus for execution. *Checkpoint.*
3. **Execute + multi-vote GAN loop** — execution subagent at the chosen model; Codex adversarial-review run with three framings (correctness / scope-drift / pattern-fit), majority-accept, fix-and-recheck until converged or capped. *Checkpoint.*
4. **Independent review** (Opus) — `pr-reviewer` against quality + existing patterns + JIRA scope. Stops at "ready to push."

The anti-hallucination design lives in the skill: grounding first, a *different model family* (Codex/GPT) as the adversary, multi-vote majority with diverse framings, review always on Opus, an explicit scope leash against acceptance criteria, and loud reporting when the GAN loop fails to converge.

---

## Arguments

`$ARGUMENTS` may contain, all optional:

- A **ticket id** (e.g. `PROJ-1234`). If omitted, the skill extracts it from the current git branch.
- `--exec-model <sonnet|opus>` — skip the Stage 2 rubric and force the execution model.
- `--max-gan-rounds <n>` — cap the GAN fix/recheck loop (default 3).
- `--auto` — run through to the final review without pausing at the intermediate checkpoints (still stops before any commit; still never pushes). Default is to pause at each checkpoint.

---

## Do this

Invoke the `ticket-pipeline` skill via the `Skill` tool, forwarding `$ARGUMENTS` verbatim as its args. Follow the skill's stage sequence and honor every checkpoint. Do not commit or push at any point — the pipeline ends by telling the user the branch is ready for them to push.

$ARGUMENTS
