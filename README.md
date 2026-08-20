# Claude Code plugin marketplace

Eight stack-agnostic engineering plugins for [Claude Code](https://claude.com/claude-code).

Company- and project-specific knowledge is **not bundled**. Each plugin that needs such
knowledge reads it from configuration, and where a missing fact would change its output,
it stops and asks you where that detail lives — offering to scaffold the file from a
template rather than guessing.

## Install

```bash
claude plugin marketplace add <your-org>/<this-repo>
claude plugin install docs@yararat-tooling
```

Install only what you need; the plugins are independent apart from the dependencies noted
below. To see a plugin's components and its projected token cost before committing:

```bash
claude plugin details docs
```

## Plugins

| Plugin | What it does | Config |
|---|---|---|
| `docs` | Generates and refreshes documentation from the code itself. Detects the project, stack, and audience segment before writing, and traces every factual claim to code read during the run. | `projectProfilesRoot`, `teamStandardsRoot` |
| `code-quality` | Runs RuboCop and the relevant RSpec specs against only the files changed on your branch, then stages a commit message for review. | `baseBranch` |
| `ticket-context` | Loader agents that gather issue-tracker context and prior local investigation notes. Dependency-only — provides agents, no commands. | `jiraBaseUrl`, `priorWorkRoot` |
| `pr-review` | Senior-level PR review for Rails: correctness, Rails patterns, testing, security, performance. Re-reviews after feedback, decides which comments need code changes versus replies, drafts the description. | `baseBranch`, `checklistPath`, `codingStandardsUrl` |
| `tailwind` | Principles-driven Bootstrap-to-Tailwind migration: scopes, audits the existing cascade per element, plans, implements behind approval gates, verifies adversarially and visually with Playwright. | `conventionsPath`, `teamStandardsRoot`, `notesRoot` |
| `ticket-workflow` | Takes a ticket from investigation to plan: spike, phased work plan or estimated spike plan, ticket drafting, and archives findings for later sessions. | `notesRoot`, `teamStandardsRoot`, `ticketTemplatePath` |
| `rails-testing` | Writes behaviour-focused RSpec tests and I18n locale files. Tests at the highest useful level of abstraction and covers failure paths, not just the happy one. | `testingStandardsPath`, `localeStandardsPath` |
| `rollbar-triage` | Triages Rollbar errors into an actionable work list: root-causes each item against local code, cross-references the tracker, separates real bugs from noise. | `defaultProject`, `defaultEnvironment` |

### Dependencies

- `pr-review` requires `code-quality` and `ticket-context`
- `ticket-workflow` requires `ticket-context`
- `ticket-workflow`'s `/ticket-pipeline` additionally needs the `codex` plugin for its
  adversarial stage, and stops with a clear message if it is absent
- `rollbar-triage` and `ticket-context` need their respective MCP servers connected

## Configuration

```bash
claude plugin install <name>@yararat-tooling --config KEY=VALUE
```

or `/plugin configure <name>@yararat-tooling` inside a session. Note that `--config` is
applied at install time only; passing it to an already-installed plugin is a no-op.

**Every setting is optional.** Nothing silently degrades: where a missing value would
change the output, the plugin asks. Where it would not, the plugin auto-detects — for
example `baseBranch` falls back to `origin/HEAD`, then `main`, then `master`.

Two settings are worth getting right:

- **`tailwind.conventionsPath`** — records where views, partials, components, helpers and
  Tailwind configs live, plus the module casing your autoloader requires. Wrong casing
  fails at boot rather than in review; and where a repo has more than one Tailwind config,
  editing the one a view does *not* load produces no visible change at all.
- **`ticket-workflow.notesRoot`** and **`ticket-context.priorWorkRoot`** should point at
  the same directory. Otherwise one plugin archives findings where the other never looks,
  and the work is lost to every future run.

## A note on macOS and network volumes

If you clone this repo onto an SMB or AFP volume, macOS will create `._*` AppleDouble
sidecars beside files carrying extended attributes. They are ignored here, and they should
stay that way: Claude Code refreshes a marketplace by renaming directories, and a stray
`._` file makes that rename fail with `ENOTEMPTY` — which silently breaks plugin loading
until the sidecars are removed. To stop them being written at all:

```bash
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
```

## Licence

See `LICENSE`, if present. Otherwise all rights reserved by the author.
