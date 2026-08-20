# Project profile: <repository name>

> Fill in what you can verify by reading the code. Delete sections that do not apply.
> Leave `TODO` where you are unsure — a `TODO` is honest and useful; a confident wrong
> answer is neither. Every claim here is prose, so an agent reading it must still verify
> against the code and report drift.

## Stack

- **Language / framework:** <e.g. Rails 7.1, Symfony 6, Angular 17>
- **Manifest read:** <Gemfile / composer.json / package.json / pyproject.toml>
- **Authentication:** <gem or library actually present, not what docs claim>
- **Authorization:** <gem or library actually present; note if these differ>

## Audience segmentation

Does this repository serve more than one audience, brand, site, or tenant?

- [ ] **No** — single audience. Still distinguish end-user / administrator / developer voice.
- [ ] **Yes** — complete the table below.

**How segmentation is resolved at runtime:**

<e.g. host-based site lookup, tenant middleware, theme directory, locale-scoped routes.
Name the file and method that does it, so it can be re-verified.>

**Identifiers** — verify these each run; IDs and slugs change:

| Identifier | Audience | Notes |
|---|---|---|
| `<CONST or id>` | `<audience name>` | `<domain, brand, or scope>` |

**Classification signals**, strongest first:

| Signal | Segment |
|---|---|
| `<path prefix, e.g. app/views/<seg>/>` | `<segment>` |
| `<filename prefix or keyword>` | `<segment>` |
| `<route constraint class>` | `<segment>` |
| `<predicate or branch, e.g. #<seg>?>` | `<segment>` |
| None of the above, reachable from several | **Shared** |

> **Guard against a binary classifier when there are three or more segments.** If the code
> has a "neither A nor B" predicate, that case exists and something depends on it —
> filing it under A publishes to the wrong audience.

**Shared code:** when code serves several segments, document it once and state which
audiences it applies to. If behaviour *differs* per segment, document the difference
explicitly — a guide that silently describes only one variant is the common failure here.

## Local development caveats

Anything that changes how a reader reproduces behaviour locally — segment overrides,
fallback hosts, seeded fixtures, feature flags.

- `<helper or param that overrides the segment>` — <what it does, why it matters for "how to test this">

## Documentation conventions

- **Docs live in:** `<doc/ | docs/ | wiki/ | external site>`
- **Index or nav file to update:** `<path, or "none">`
- **Existing subdirectories:** `<e.g. features/, api/, runbooks/>`
