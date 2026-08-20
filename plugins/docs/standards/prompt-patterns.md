# Documentation Prompt Patterns

Stack-agnostic prompt shapes for `/generate-docs`, plus the levers that turn a vague request into one that produces usable output. Load this when a request needs sharpening, or when running a gap-analysis or stale-doc sweep.

For domain-calibrated worked examples, consult any examples recorded beside the project profile under `projectProfilesRoot` — but read them as calibration for *altitude*, not as input for other projects.

---

## The three levers

Almost every weak documentation request is missing one of three things. Naming the missing one is faster than rewriting the request.

| Lever | Weak | Strong |
|---|---|---|
| **Audience** | "Document authentication" | "Document authentication **for end users** who cannot reach admin settings" |
| **Scope boundary** | "Document reporting" | "Document the compliance reports **including how to interpret each column**" |
| **Output shape** | "Document the upload" | "Create a **step-by-step guide** for the CSV upload, **including error handling**" |

### What good looks like

- Names the feature concretely, not the subsystem: "the CSV bulk upload process", not "users".
- States the audience explicitly: "for administrators", "for end users", "for integrators".
- Bounds the scope: "including error handling", "excluding the legacy flow".
- Specifies the shape: "step-by-step guide", "technical reference", "troubleshooting guide".

### What fails

- **Too vague** — "Document users." Produces a shapeless summary of a model.
- **No audience** — "Document authentication." The end-user and integrator versions share almost no content.
- **Too broad** — "Document everything about reports." Produces uniform shallowness across a dozen features.
- **No context** — "Write docs for profiles." Ambiguous between the concept, the UI, and the data model.

### Three rewrites, as worked examples

```
Weak:   Document SSO
Strong: Create a setup guide for SSO integration with Okta, including SAML
        configuration and attribute mapping
```
```
Weak:   Document acknowledgements
Strong: Create a step-by-step user guide for acknowledging documents, including
        how deadlines and reminders behave
```
```
Weak:   Document reporting
Strong: Document the compliance reporting features — which reports exist, what
        each column means, and how to export for an external audit
```

---

## Patterns by documentation type

Substitute your own domain nouns. The *shape* transfers; the nouns never do.

### User guides

```
Create a user guide for <primary task> covering <the states the user will hit>
Document how end users <perform task> and what happens when <it fails>
Explain <feature> for users who <constraint — no admin access, mobile only, first login>
```

### Workflow documentation

```
Document the complete workflow from <trigger> to <terminal state>, including error paths
Trace what happens when <actor> does <action> — every state transition and who is notified
```

Workflows are where generated docs beat hand-written ones, because tracing every branch is mechanical and tedious. Always ask for the error paths explicitly; the happy path alone is the most common omission.

### Admin guides

```
Create a guide for <bulk or configuration operation> including <input format> and error handling
Document how to manage <roles / permissions / entities> and what each level can actually do
Explain how to use <targeting or segmentation mechanism> to <achieve outcome>
```

Permissions claims are the highest-risk content in any doc. Always phrase the request so the answer must come from the authorization layer, not from role names.

### API documentation

```
Generate API documentation for <endpoint group> with request/response examples
Document authentication for <API> including scopes and token lifecycle
Document the error responses for <endpoint group> and what each status code means
```

### Setup and configuration

```
Create a step-by-step guide for configuring <integration> including <the mapping step people get wrong>
Document all required environment variables and configuration settings
Create a deployment guide for <environment>
```

Never ask for, and never accept, actual secret values — variable names and descriptions of what they hold, only.

### Troubleshooting

```
Create a troubleshooting guide for <symptom area> with symptoms, causes, and resolutions
Document common <integration> errors and how to resolve them
```

Organize by symptom as the reader observes it, not by subsystem as the code organizes it. The reader does not know which subsystem failed — that is the thing they are trying to find out.

### Developer documentation

```
Document the architecture of <subsystem> — data flow, key patterns, extension points
Create a guide explaining the <entity> state machine and its valid transitions
Document the local development setup from a clean checkout
```

---

## Maintenance patterns

These matter more over time than first-pass generation, and a generator built only for greenfield writing misses them entirely.

### Reconciliation after a change

The default, argument-free invocation:

```
/generate-docs
```

Documents the current branch's diff. Its real job is finding docs the change just falsified — higher value than adding new ones, because a false statement in an existing doc is trusted while a missing doc is merely absent.

### Gap analysis

```
/generate-docs Analyze commits from the last <N> releases and identify features that need documentation
/generate-docs Review CHANGELOG.md and document any feature with no coverage
```

### Targeted update

```
/generate-docs Update <exact/path/to/doc.md> to reflect <specific change>
/generate-docs Review all <topic> documentation against the current implementation and correct what drifted
```

Verify the path before using it. The POC's own examples referenced `docs/user-guides/acknowledgements.md` while the file it had actually generated was `acknowledging-documents.md` — the examples file had drifted from its own output within one commit. Prefer describing the subject over asserting a path you have not confirmed, and never pin a version number ("added in v2.25.0") into a request; versions in prose go stale silently.

### Cross-feature and role-specific guides

```
/generate-docs Document the complete flow from <feature A> through <feature B> to <outcome>
/generate-docs Create a complete guide for <role> — everything that role can do and needs to know
```

These are the requests most likely to produce something no human would have written, because they cut across the module boundaries a codebase is organized by. They are also the most likely to overreach — expect a longer Unverified Claims section and read it.

---

## What happens after you run it

The generator front-loads its questions and then runs to completion. It does **not** iterate with you mid-write, so there is no approval step before files are saved.

That changes the review model from the POC's original interactive loop:

1. Answer the scoping questions if any are asked — this is the only interactive point.
2. Files are written to the repository's existing docs convention.
3. **Read the Unverified Claims section first.** It lists every statement the agent could not confirm in code. This is where wrong documentation would be, and it is the section the generation exists to make legible.
4. Check the "Deliberately not documented" list — confirm you agree nothing behavioural was skipped.
5. Check "Discrepancies found" — contradictions between `CLAUDE.md` / `README` / existing docs and the code. Often the most valuable output of a run, independent of the docs produced.
6. Add screenshots where placeholders were left. The agent cannot produce images.
7. Stage and commit yourself. The agent never commits or pushes.

If the report says no documentation was needed, that is a real answer. A change with no user-visible surface should not produce a guide.
