# Documentation Standards Layer

Standards layer that the `docs:docs-writer` agent and the `/generate-docs` command reference. Each file captures reusable documentation practice — extracted into separate files so the *tooling* stays project-agnostic and each run loads only what it needs.

Origin: distilled from a documentation-generation proof of concept. The reusable guidance lives here; project-specific worked examples stay out of this layer entirely so they never leak into an unrelated project.

## Files

| File | What it defines |
|---|---|
| `doc-types-and-index.md` | The six documentation categories (user, admin, API, setup, troubleshooting, developer), what belongs in each, and the reusable `docs/README.md` index template for scaffolding a docs tree in a project that has none. |
| `prompt-patterns.md` | Stack-agnostic prompt shapes per documentation type, the three levers that make a vague request specific, and the maintenance patterns (gap analysis, stale-doc reconciliation) that a from-scratch generator misses. |
| _project-scoped examples_ | Not shipped. Concrete worked prompts calibrated to one product domain belong beside that project's profile under the `projectProfilesRoot` config, not in this layer. They are useful as calibration for prompt altitude and useless as literal input anywhere else. |

## Loading by phase

Do not load all three by default. The instruction-budget principle from `the frontend standards layer` applies here too — an agent that loads every standards file attends to none of them well.

| Situation | Load |
|---|---|
| Writing docs, structure already established in the repo | nothing — follow the repo's existing convention |
| Project has no docs tree yet, or needs a new index | `doc-types-and-index.md` |
| The request is vague and must be sharpened, or is a gap-analysis / stale-doc sweep | `prompt-patterns.md` |
| Working in a project that has worked examples recorded beside its profile | those examples, from `projectProfilesRoot` |

## Precedence

The precedence order in `the precedence rule described below` applies unchanged: team documentation outranks this plugin layer, which outranks patterns merely observed in a codebase.

One addition specific to documentation work: **code outranks all three.** A standards file, a README, or an existing guide that contradicts the implementation is wrong about the implementation. Documentation is the artifact nobody re-verifies, so drift accumulates in prose and never in the code.
