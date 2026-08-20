# PR Review Checklist

> Scaffold. Keep items your team actually enforces and delete the rest — a checklist
> nobody applies makes reviews longer without making them better. Add the conventions
> that are specific to this codebase, since those are the ones a general reviewer misses.

## Correctness

- [ ] Behaviour matches the ticket's acceptance criteria, including edge cases named there
- [ ] Error and empty states handled, not just the happy path
- [ ] No behaviour change smuggled in beyond the stated scope
- [ ] <TODO: domain invariants this codebase must never violate>

## Data access

- [ ] No N+1 queries introduced — associations preloaded where iterated
- [ ] Indexes exist for new query patterns and new foreign keys
- [ ] Migrations are safe against a live table (no blocking locks, no unbacked NOT NULL)
- [ ] Destructive migrations are reversible, or their irreversibility is deliberate and noted
- [ ] <TODO: this project's migration-safety tooling or constraints>

## Security

- [ ] No string-interpolated SQL; parameters bound
- [ ] Output escaped — no unsafe raw/html_safe on user-supplied content
- [ ] Mass assignment constrained by strong parameters
- [ ] Authorization enforced at the action, not just hidden in the view
- [ ] No secrets, tokens, or credentials in code, fixtures, or logs
- [ ] <TODO: this project's authorization library and where policies live>

## Tests

- [ ] New behaviour is covered at the level the team tests at
- [ ] Tests assert behaviour, not implementation detail
- [ ] Failure modes covered, not only success
- [ ] No test depends on another test's side effects or on execution order
- [ ] <TODO: this project's testing conventions and preferred test level>

## Readability and maintenance

- [ ] Names say what the thing is; no abbreviations a newcomer must decode
- [ ] Follows patterns already established in this codebase
- [ ] Complexity is in one place rather than smeared across layers
- [ ] Comments explain *why*, not *what*
- [ ] Code teaches a less experienced reader well — idiomatic, not merely correct

## Operations

- [ ] New environment variables documented and defaulted
- [ ] Background jobs idempotent and safe to retry
- [ ] Feature flags named in the PR description with their rollout plan
- [ ] Logging sufficient to diagnose this code failing in production
- [ ] <TODO: deployment steps this project requires>
