# Documentation Types and Index Template

Defines the six documentation categories and provides a reusable index template. Load this when a project has no documentation tree yet, or when an existing index needs regenerating.

**Do not impose this layout on a project that already has one.** Check for `doc/`, `docs/`, `documentation/`, or `wiki/` first and match what is there. A repository using `doc/` (singular, with its own subdirectories) is a convention this template would wrongly override.

## The six categories

Audience is the axis that matters. A reader who opens the wrong category wastes time; a reader who finds admin steps inside an end-user guide follows instructions they lack permission to complete.

| Category | Directory | Audience | Contains |
|---|---|---|---|
| **User guides** | `user-guides/` | End users with no privileged access | Task-oriented walkthroughs of the primary UI. Assumes no system knowledge. |
| **Admin guides** | `admin-guides/` | Administrators, managers, privileged roles | Configuration, bulk operations, user and permission management, reporting. Assumes product familiarity. |
| **API documentation** | `api/` | Integrators, external developers | Endpoints, authentication, request/response shapes, error codes, versioning, rate limits. |
| **Setup and configuration** | `setup/` | Implementers, ops, IT contacts | Installation, environment variables, third-party integration (SSO, provisioning, mail), deployment. |
| **Troubleshooting** | `troubleshooting/` | Support staff and self-serve users | Symptom → cause → resolution. Organized by symptom as observed, not by subsystem as designed. |
| **Developer documentation** | `developer/` | Engineers on the codebase | Architecture, data flow, state machines, local setup, testing strategy, extension points. |

### Choosing between adjacent categories

The boundaries that actually cause misfiling:

- **User vs admin** — decided by *required permission*, not by difficulty. If the reader needs a privileged role to perform step 1, it is an admin guide.
- **Setup vs admin** — setup is one-time or per-environment work, usually done once by an implementer. Admin is recurring operational work.
- **Troubleshooting vs the guide it relates to** — a failure mode inherent to the happy path belongs in that guide's Troubleshooting section. A cross-cutting failure with many causes earns its own file.
- **Developer vs API** — API docs describe a contract for outside consumers. Developer docs describe internals that consumers must not depend on.

## Index template

Adapt to the categories that actually exist. Omit directories with no content — an index promising an empty `api/` is worse than no index. Replace `[Project]` with the product's own name.

```markdown
# [Project] Documentation

[One or two sentences: what this product does and who these docs serve.]

## Documentation Structure

### 📘 User Guides (`user-guides/`)
End-user documentation for people using the system day to day.

### 👨‍💼 Admin Guides (`admin-guides/`)
Documentation for administrators configuring and managing the system.

### 🔌 API Documentation (`api/`)
Reference documentation for integrations.

### ⚙️ Setup & Configuration (`setup/`)
Installation, configuration, and deployment guides.

### 🔧 Troubleshooting (`troubleshooting/`)
Common issues and their resolutions.

### 💻 Developer Documentation (`developer/`)
Technical documentation for developers working on the codebase.

---

## Contents

[Link every file, grouped by category. Keep in sync when adding docs.]

## Generating and Updating

Documentation here is generated and maintained with the `/generate-docs` command,
which reads the current code rather than prior documentation.

- Document a subject:      `/generate-docs <what you need documented>`
- Reconcile after changes: `/generate-docs` (documents the current branch's diff)

Generated docs are **drafts pending human verification** — see the Unverified Claims
section of each generation report before treating a statement as authoritative.
```

## Notes on the template

**Multi-audience projects** need audience separation inside the tree, not just inside files. Prefer a segment in the path (`user-guides/hr/`, `user-guides/it/`) over a suffix, and state the choice in the generation report so the next run stays consistent.

**No date or version footer.** The POC template carried `*Last updated: [DATE]*` and `*Version: [APP VERSION]*`; both were dropped deliberately. An agent cannot reliably know the current date, and a stale "last updated" line actively misleads — it claims freshness the content does not have. Git history is the source of truth for currency.

**The "drafts pending verification" line is load-bearing.** Generated documentation reads as authoritative regardless of how it was produced. Saying plainly that it was generated, and that unverified claims are tracked, is what keeps a confident wrong sentence from being treated as a specification.
