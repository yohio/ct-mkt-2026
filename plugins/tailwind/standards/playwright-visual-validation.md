# Playwright Visual Validation

How the implementer captures, compares, and reports on rendered pages during a migration. Replaces the inline `npx playwright screenshot` snippet with a documented procedure that catches the regressions ad-hoc capture misses (background images that fail to load, fixed-nav slip-under on scroll, breakpoint-specific layout breaks, role-gated UI variants).

This is the **automated half** of the verification step. It is necessary but not sufficient — the user-validation walkthrough (`validation-walkthrough-structure.md`) catches interactive regressions pixel diff cannot see.

## Why this exists

Visual regressions on real Bootstrap-to-Tailwind migrations cluster into a few classes:

1. **Background images that compile but don't render.** Sprockets `image-url()` in a PostCSS-built bundle, asset paths that resolve under the wrong root, broken `@import` chains. The page looks structurally correct in the at-rest screenshot but has a missing texture/image. A naive at-rest screenshot can miss this if the missing image leaves the layout intact (a flat-color block instead of a gradient).
2. **Fixed-nav slip-under.** The migrated page renders correctly at first paint, but on scroll JS adds `body.fixed-nav` (or equivalent) and the nav becomes `position: fixed`, leaving document flow. The hero/header section beneath it slides up and gets clipped. **Static-state screenshots never see this** — the page is fine before scroll, broken after.
3. **Breakpoint-specific layout regressions.** Bootstrap `col-md-6` and Tailwind `md:w-1/2` use different breakpoint values (`col-md-` triggers at 768px; Tailwind `md:` triggers at 768px in default config — but the planner can mistakenly translate `col-lg-7` → `lg:w-7/12`, shifting the activation breakpoint by an entire step). A spot-check at 1920px and 480px would miss the broken 768–1024px range.
4. **Role-gated UI variants.** Reference-seat user sees an upgrade modal trigger; non-ref-seat user sees a plain header. Both must render correctly. A single-screenshot pass against one role gives 50% coverage.
5. **Console errors / network 404s.** The page renders, but JS throws on a missing controller, an asset 404s silently, an analytics call fires to the wrong endpoint. Visual diff is blind to all of this.

The Playwright procedure addresses each: scripted scroll states, role-state files, network/console capture alongside the screenshot, breakpoint coverage at every size the planner listed.

## When to invoke

| Phase | Action |
|---|---|
| Discovery | None — the implementer captures baseline. Discovery only specifies fidelity mode + breakpoints + role variants in the report. |
| Planner | None directly. The plan must list **breakpoints**, **scroll states**, **role variants**, and **fidelity mode** so the implementer knows what to capture. |
| Implementer Step 0 (before edits) | Capture baseline against the unmodified Bootstrap source page — every breakpoint × scroll-state × role combo the plan listed. |
| Implementer Step 10 (after edits) | Capture post-migration — same combos. Run diff. Attach the report to the Migration Summary. |

**Skip the diff (but still capture for the record) when:**
- Fidelity mode is **New design** — there is no meaningful baseline.
- Fidelity mode is **Visually equivalent (manual)** — capture for human review, no automated diff.

**Run the diff when:**
- **Strict identical** — `--fuzz 0%`. Any nonzero pixel count fails.
- **Close-enough identical** — `--fuzz 5%`. Document each remaining nonzero diff in the Migration Summary as either "intentional" (per the plan) or "regression — investigating."

## Inputs the script needs from the plan / discovery

A capture pass is parameterized by:

| Parameter | Source | Example |
|---|---|---|
| `target_url` | Plan / discovery — the route under migration | `http://localhost:3000/browse/new` |
| `host_header` | Discovery — needed when route resolution depends on `Host` (arSiteConstraint, etc.) | `segment.localhost` |
| `breakpoints` | Plan — explicit list of viewport widths | `[1920, 1620, 1150, 768, 480]` |
| `scroll_states` | Plan — `top` always; add `scrolled` if any layout depends on scroll-driven JS (sticky nav, parallax, infinite scroll) | `["top", "scrolled"]` |
| `role_states` | Plan — list of auth contexts to capture | `["anonymous", "member_role", "admin_role"]` |
| `fidelity_mode` | Plan | `close_enough` |
| `fuzz_pct` | Derived from mode | `0` for strict, `5` for close-enough |
| `out_dir` | Convention | `tmp/migration-snapshots/{TICKET-ID}/` |
| `network_ignore_patterns` | Project conventions + planner | `["analytics", "flowplayer", "cookieyes", ...]` — substrings; any matching URL is excluded from network-failure capture |
| `console_ignore_patterns` | Project conventions + planner | `["flowplayer", "Invalid token", "cookieyes"]` — substrings; any matching error message is excluded from console-error capture |

The implementer assembles these into a JSON config and runs the capture script.

## Authentication: storageState pattern

Playwright's `storageState` is a JSON dump of cookies + localStorage that lets a browser context skip the login dance. **Capture once per role, reuse forever** (or until the session expires).

The implementer maintains role state files at `tmp/migration-snapshots/auth/{role}.json`. To create them, the implementer runs the script's `prepare-auth` mode interactively once per role:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/tailwind-migration-screenshot.mjs prepare-auth \
  --role member_role \
  --login-url http://localhost:3000/login \
  --out tmp/migration-snapshots/auth/member_role.json
```

The script opens a non-headless Chromium, the user logs in by hand once, the script saves the cookies and exits. Subsequent capture runs reuse the file.

**Anonymous role** has no auth file; the script opens a fresh context with no `storageState` and no cookies.

If the project has test users seeded by fixtures (e.g., `User.find_by(email: "member_role@example.com")` with a known password), the implementer can fully script `prepare-auth` — but the manual fallback covers projects where seeding is messy or session signing requires CI-only secrets.

**Storage state files are gitignored.** They contain session tokens. Add `tmp/migration-snapshots/auth/` to project `.gitignore` if not already covered by `tmp/`.

## Capture procedure

Per breakpoint × scroll state × role:

1. Open browser context with the role's `storageState` (or no state for anonymous).
2. Set viewport to the breakpoint width × a tall fixed height (1080 is fine — full-page screenshot ignores the viewport height).
3. Set `Host` header if the discovery specified one (HR vs IT routing).
4. Navigate to `target_url`. Wait for `networkidle` or `load` (whichever the page reliably reaches).
5. **Listen for console errors and network failures** during navigation; record them per shot. Any `[error]`-level console message or HTTP ≥ 400 (excluding well-known noise — analytics endpoints in dev) flags the shot.
6. If `scroll_state == "scrolled"`: scroll to the height that triggers fixed-nav / sticky behavior on this project (typically `200px` is enough; the plan can override). Wait 250ms for any class transitions to settle.
7. Take a full-page screenshot.
8. Save to `{out_dir}/{baseline|migrated}-{role}-{width}-{scroll_state}.png`.

After all combos are captured, the script writes a manifest JSON listing every shot, its console errors, and its network failures.

## Diff procedure

For each `(role, width, scroll_state)` triple, compare baseline vs migrated:

1. Resize the migrated screenshot to baseline dimensions if they differ (full-page screenshots can vary in height when content reflows; use the smaller height).
2. Run pixelmatch (Playwright bundles it as `pixelmatch`) with `threshold = fuzz_pct / 100`.
3. Record the **diff pixel count** and write a side-by-side `{out_dir}/diff/{role}-{width}-{scroll_state}.png` showing baseline | migrated | diff overlay.
4. Aggregate into a markdown report at `{out_dir}/playwright-report.md`.

## Report format

```markdown
# Playwright Visual Validation Report — {ticket-id}

**Target:** {target_url}
**Fidelity mode:** {strict | close_enough | manual | new_design}
**Fuzz:** {0% | 5% | n/a}
**Roles:** {anonymous, member_role, ...}
**Breakpoints:** {1920, 1620, 1150, 768, 480}
**Scroll states:** {top, scrolled}

## Diff summary

| Role | Width | Scroll | AE pixels | Verdict |
|---|---|---|---|---|
| anonymous | 1920 | top | 0 | pass |
| anonymous | 1920 | scrolled | 0 | pass |
| member_role | 768 | top | 1247 | **FAIL — investigate** |
...

## Console errors

| Role | Width | Scroll | Errors |
|---|---|---|---|
| member_role | 768 | top | `Uncaught TypeError: ... at customer_request_dialog#open` |

## Network failures (HTTP ≥ 400, excluding analytics)

| Role | Width | Scroll | URL | Status |
|---|---|---|---|---|
| anonymous | all | all | /assets/research-feed/header-purple-pink.png | 404 |

## Investigation

(Implementer fills this in when verdicts are not all pass.)
```

The Migration Summary's "Visual fidelity" subsection points at this report file.

## Failure modes — why a passing report does not mean done

Every gap in `visual-fidelity-modes.md § Pixel-diff is interaction-blind` still applies. In addition:

1. **Animation frames vary.** Bouncing icons, marquee scrollers, GIFs — the diff catches the frame difference, not the animation. Either freeze with `*` `{ animation-duration: 0s !important }` injected via `addStyleTag` before screenshot, or accept noise on those areas.
2. **Dynamic content varies.** Latest-N-research lists, "members online" counters, timestamps. Either inject a fixture in the prepare-auth phase, or add a per-page CSS hide rule to the script (`style.dynamic-block { visibility: hidden }`). The plan must specify which selectors to mask.
3. **Anti-aliasing and font hinting.** Different at the same fuzz level depending on OS / GPU. Run baseline and migrated in the same browser binary on the same machine (the script enforces this).
4. **Lazy-loaded images.** Below-the-fold content may not paint by `networkidle`. Force a full-page scroll-down + scroll-up before screenshot to trigger lazy loaders. The script does this for `top` shots (scroll to bottom, scroll back, then capture).
5. **Cookie banners and modals on first visit.** A consent banner that appears on the anonymous role's first paint will dominate the diff. The prepare-auth flow for the anonymous role can also be used to dismiss banners and capture a "primed anonymous" state.

## Integration with the existing fidelity modes

| Mode | Run capture? | Run diff? | What the report contributes |
|---|---|---|---|
| Strict identical | yes | yes (0% fuzz) | The diff is the verdict. Any nonzero pixel = fail. |
| Close-enough identical | yes | yes (5% fuzz) | Diff plus console + network checks. The Migration Summary documents nonzero diffs as intentional or regression. |
| Visually equivalent | yes | no (manual review) | Captures the side-by-side for the user to eyeball. Console + network checks still run. |
| New design | yes (post only) | no | Captures the migrated state for the record. Console + network checks still run. Skip baseline capture (no meaningful before). |

## Fallback if absent

If this file isn't present at runtime, the implementer falls back to the lightweight Playwright snippet still embedded in the implementer agent prompt — single screenshot per breakpoint, ImageMagick `compare`, no scroll states, no role variants, no console/network capture. That covers ~60% of regressions; the missing 40% (fixed-nav slip, role-gated variants, network 404s) becomes the user's job to find.
