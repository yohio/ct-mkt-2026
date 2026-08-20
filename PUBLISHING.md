# Publishing and installing

Operational runbook for this repository. Paths are filled in for the machine this was
built on — adjust if either location moves.

- **Build workspace** (source of truth, local disk): `/Users/Shared/claude-workspace`
- **This repo** (export + git remote, SMB volume): `/Volumes/AraratWorks/Work Related/claude-plugins`

The build workspace also holds `src/` (raw unsanitised source) and `content/` (company
knowledge). **Neither belongs here.** Both are in `.gitignore` as a backstop, but the
export step below simply never copies them.

---

## 1. First push

```bash
cd "/Volumes/AraratWorks/Work Related/claude-plugins"

git add .
git commit -m "Add Claude Code plugin marketplace with eight engineering plugins

Stack-agnostic tooling for docs, code quality, PR review, Tailwind migration,
ticket workflow, Rails testing, and Rollbar triage. Company-specific knowledge
is supplied via plugin config rather than bundled; plugins stop and ask where
project details live instead of guessing."

git remote add origin git@github.com:<your-org>/<repo>.git
git push -u origin main
```

---

## 2. Re-exporting after changes

Edit plugins in the **build workspace**, not here — then re-export. The flags matter:
`cp -RX` skips extended attributes, and the `xattr`/`find` lines clear anything that rode
along. Without them, macOS scatters `._*` sidecars across the tree (see §6).

```bash
W=/Users/Shared/claude-workspace
R="/Volumes/AraratWorks/Work Related/claude-plugins"

# refresh plugins and the marketplace manifest
rm -rf "$R/plugins"
cp -RX "$W/plugins" "$R/"
cp -X "$W/.claude-plugin/marketplace.json" "$R/.claude-plugin/"

# strip macOS metadata
xattr -rc "$R" 2>/dev/null || true
find "$R" -name '._*' -delete 2>/dev/null || true
find "$R" -name '.DS_Store' -delete 2>/dev/null || true

# confirm the private layers did not follow
[ -d "$R/src" ] && echo "ERROR: src/ leaked" || echo "OK: src/ absent"
[ -d "$R/content" ] && echo "ERROR: content/ leaked" || echo "OK: content/ absent"
```

Then verify before committing (§4), and:

```bash
cd "$R"
git add .
git commit -m "<PLUGIN>: <what changed and why>"
git push
```

---

## 3. Version bumping and release tags

Bump `version` in the plugin's `.claude-plugin/plugin.json` **and** keep the marketplace
entry in agreement. Then tag:

```bash
cd "/Volumes/AraratWorks/Work Related/claude-plugins"
claude plugin tag ./plugins/<name>
```

That creates a `<name>--v<version>` tag and validates that `plugin.json` and the enclosing
marketplace entry agree. Push tags explicitly:

```bash
git push --tags
```

Installed copies do not auto-update. Consumers run:

```bash
claude plugin update <name>          # restart required to apply
```

---

## 4. Verification before every commit

```bash
R="/Volumes/AraratWorks/Work Related/claude-plugins"

# manifests
claude plugin validate "$R"
for p in docs code-quality ticket-context pr-review tailwind ticket-workflow rails-testing rollbar-triage; do
  printf "%-17s " "$p"; claude plugin validate "$R/plugins/$p" 2>&1 | grep -qE '✔' && echo ok || echo FAIL
done

# nothing private, nothing macOS, in the commit set
cd "$R"
git add -An . | grep -E '\._|/content/|/src/' && echo "ERROR: unwanted files staged" || echo "OK: commit set clean"
```

`validate` reports warnings as well as errors. A command with no YAML frontmatter, or with
an unquoted `description:` containing a colon, loads at runtime with **empty metadata and
no error** — the validator is the only place that surfaces it. Treat warnings as failures.

---

## 5. Installing and configuring

```bash
claude plugin marketplace add <your-org>/<repo>
claude plugin install docs@yararat-tooling
claude plugin details docs                     # components + projected token cost
```

Config is applied **at install time**:

```bash
claude plugin install tailwind@yararat-tooling --config conventionsPath=.claude/tailwind-conventions.md
```

Passing `--config` to an already-installed plugin is a **no-op** — it reports "already
installed" and silently discards the values. To change a setting afterwards, use
`/plugin configure <name>@yararat-tooling` in a session, or uninstall and reinstall.

Dependency order, if installing individually:

```bash
claude plugin install code-quality@yararat-tooling
claude plugin install ticket-context@yararat-tooling
claude plugin install pr-review@yararat-tooling        # needs both of the above
claude plugin install ticket-workflow@yararat-tooling  # needs ticket-context
```

Every setting is optional. Where a missing value would change the output, the plugin stops
and asks where the detail lives, offering to scaffold it from a template. Two are worth
setting deliberately:

- `tailwind.conventionsPath` — wrong module casing fails at boot rather than in review, and
  editing a Tailwind config that the view does not load produces no visible change at all.
- `ticket-workflow.notesRoot` and `ticket-context.priorWorkRoot` — point them at the **same**
  directory, or one plugin archives findings where the other never looks.

---

## 6. Why the macOS steps are not optional

This repo lives on an SMB volume (`//ararathome@linksysararat/AraratWorks`). macOS cannot
store extended attributes there natively, so it writes them to `._*` AppleDouble sidecars
instead. They reappear constantly — 29 were created within seconds of `git init`.

They must never be committed. Claude Code refreshes a marketplace by renaming directories,
and a leftover `._` file makes that rename fail with `ENOTEMPTY`. The failure mode is
silent: the marketplace ends up wedged mid-refresh with a partial download and no
`marketplace.json`, and every plugin sourced from it reports `failed to load` with no
indication of why. This is not hypothetical — it is exactly what happened to
`claude-plugins-official` on this machine, taking six plugins offline.

Reduce the noise at source:

```bash
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
```

If a marketplace ever wedges this way, the repair is:

```bash
find ~/.claude/plugins/marketplaces -name '._*' -delete
claude plugin marketplace update <marketplace-name>
```

Git on SMB is also slow and has weak file locking. It is fine for committing and pushing;
for sustained branch work, clone to local disk and treat this as a remote.
