#!/usr/bin/env node
// tailwind-migration-validate.mjs
//
// Deterministic gate for Bootstrap-to-Tailwind migrations.
//
// Fails (exit 1) when Bootstrap leaks into the Tailwind output. Designed to be
// run by the tailwind-implementer agent before producing a Migration Summary,
// and (later) wired into pre-commit and CI as a second/third line of defense.
//
// Usage:
//   node ${CLAUDE_PLUGIN_ROOT}/scripts/tailwind-migration-validate.mjs
//   node ${CLAUDE_PLUGIN_ROOT}/scripts/tailwind-migration-validate.mjs --base master --branch HEAD
//   node ${CLAUDE_PLUGIN_ROOT}/scripts/tailwind-migration-validate.mjs --json
//
// Override mechanism: each violation can be acknowledged with a magic comment
// in the file, within the 3 lines preceding the violating line:
//   /* tailwind-migration-allow-shim: <one-line justification> */     (R1/R2/R3)
//   /* tailwind-migration-allow-large: <one-line justification> */    (R5, in file header)
//   /* tailwind-migration-allow-native: <one-line justification> */   (R7)
// And one ERB override:
//   <%# tailwind-migration-allow-bs-class: <justification> %>         (R4)
// And one commit-trailer override:
//   Tailwind-migration-allow-outside-tree: <path>                     (R8)

import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Config ────────────────────────────────────────────────────────────────

const TAILWIND_TREE = 'app/assets/stylesheets/tailwind/';
const TAILWIND_PAGES = 'app/assets/stylesheets/tailwind/pages/';
const TAILWIND_COMPONENTS = 'app/assets/stylesheets/tailwind/components/';
const PAGE_CSS_CEILING = 150;
const NATIVE_CSS_DECL_THRESHOLD = 5;

// Properties with no practical Tailwind utility equivalent. Declarations using
// these properties don't count toward R7's "should be @apply" budget — per
// branded-css-rules.md "Raw CSS alongside @apply", these can coexist with
// @apply lines in the same component file. CSS custom properties (--*) are
// also exempt.
const RE_NATURAL_RAW_PROP = /^\s*(?:--[\w-]+|filter|-webkit-filter|backdrop-filter|clip-path|mask(?:-image|-size|-repeat|-position)?|-webkit-mask(?:-image|-size|-repeat|-position)?|-webkit-text-stroke(?:-color|-width)?|-webkit-text-fill-color|background-image|paint-order|text-rendering|font-feature-settings|font-variation-settings)\s*:/;

// Bootstrap-grid selector defs (R1)
const BS_GRID = String.raw`\.(?:row|container(?:-fluid)?|col-(?:xs|sm|md|lg)-\d+|col-(?:xs|sm|md|lg)-offset-\d+)`;

// Bootstrap component selector defs (R2)
const BS_COMPONENT = String.raw`\.(?:btn(?:-\w+)?|form-(?:control|group)|control-label|help-block|panel(?:-\w+)?|modal(?:-\w+)?|alert(?:-\w+)?|well|dropdown-menu|nav-(?:tabs|pills))`;

// Bootstrap visibility / utility selector defs (R3)
const BS_UTILITY = String.raw`\.(?:hidden-(?:xs|sm|md|lg)|visible-(?:xs|sm|md|lg)|pull-(?:left|right))`;

// Builds a regex that matches a selector definition: optional `&`, optional
// leading whitespace, the selector, optionally chained with pseudo-classes or
// additional class selectors, then `{` or `,`.
// Each pseudo/chain segment requires `:` or `.` + at least one word char, so
// the outer `*` cannot zero-width-loop — no catastrophic backtracking.
function selectorDef(body) {
  return new RegExp(`(?:^|\\s|&\\s*)${body}(?:[:.][\\w-]+)*\\s*[\\{,]`);
}

const RE_BS_GRID = selectorDef(BS_GRID);
const RE_BS_COMPONENT = selectorDef(BS_COMPONENT);
const RE_BS_UTILITY = selectorDef(BS_UTILITY);

// Bootstrap class USE in ERB markup (R4)
const RE_BS_CLASS_USE = /class\s*=\s*["']([^"']*)["']/g;
const BS_CLASS_TOKEN = /\b(?:row|col-(?:xs|sm|md|lg)-\d+|col-(?:xs|sm|md|lg)-offset-\d+|btn(?=$|\s|-)|form-control|form-group|control-label|help-block|pull-(?:left|right)|hidden-(?:xs|sm|md|lg)|visible-(?:xs|sm|md|lg))\b/;

// Override magic comments
const RE_ALLOW_SHIM = /tailwind-migration-allow-shim:/;
const RE_ALLOW_SHIM_BLOCK = /tailwind-migration-allow-shim-block:\s*\.([\w-]+)/;
const RE_ALLOW_LARGE = /tailwind-migration-allow-large:/;
const RE_ALLOW_NATIVE = /tailwind-migration-allow-native:/;
const RE_ALLOW_BS_CLASS = /tailwind-migration-allow-bs-class:/;

// ─── Args ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  // Default base is HEAD: validates uncommitted working-tree changes against
  // the last commit. This is the right mode for the implementer's pre-Summary
  // gate. For CI / post-commit checks, pass --base origin/master explicitly.
  const out = { base: 'HEAD', branch: 'HEAD', json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') out.base = argv[++i];
    else if (a === '--branch') out.branch = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '-h' || a === '--help') {
      console.log(readFileSync(new URL(import.meta.url), 'utf8').match(/^\/\/.*$/gm).slice(0, 30).join('\n'));
      process.exit(0);
    }
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));

// ─── Git helpers ───────────────────────────────────────────────────────────

function gitDiffFiles(filter) {
  // Two-dot range against the working tree: includes both committed branch
  // changes AND uncommitted edits, so the validator catches issues during
  // active development, not just after commit. The branch arg is ignored
  // for working-tree mode (which is the only mode that makes sense for a
  // pre-commit / pre-summary gate).
  try {
    const out = execSync(
      `git diff --name-only --diff-filter=${filter} ${ARGS.base}`,
      { encoding: 'utf8' }
    );
    return out.split('\n').filter(Boolean);
  } catch (e) {
    console.error(`git diff failed: ${e.message}`);
    process.exit(2);
  }
}

function commitMessages() {
  try {
    return execSync(`git log --format=%B ${ARGS.base}..${ARGS.branch}`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

// ─── Override detection ────────────────────────────────────────────────────

function hasOverrideAbove(lines, lineIndex, pattern, lookback = 3) {
  const start = Math.max(0, lineIndex - lookback);
  for (let i = start; i < lineIndex; i++) {
    if (pattern.test(lines[i])) return true;
  }
  return false;
}

function hasOverrideInFile(lines, pattern) {
  // File-wide check. Magic comments for file-level overrides (allow-large,
  // allow-native) live in the file header but length varies; scan everything.
  for (const line of lines) {
    if (pattern.test(line)) return true;
  }
  return false;
}

// ─── Rules ─────────────────────────────────────────────────────────────────

const violations = [];

function violate(file, line, rule, level, msg, override) {
  violations.push({ file, line, rule, level, msg, override });
}

// R1 / R2 / R3 — Bootstrap selectors DEFINED in the Tailwind CSS tree.
// Allowed via either:
//   - /* tailwind-migration-allow-shim: ... */ in the 3 lines above the rule, OR
//   - /* tailwind-migration-allow-shim-block: .<wrapper-class>; ... */ anywhere
//     in the file, when the rule is nested inside `<wrapper-class> { ... }`.
function checkBootstrapSelectorsDefined(file) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const allowedWrappers = collectAllowedShimWrappers(lines);

  // Track CSS brace depth + ALL ancestor class selectors so a line nested
  // deeper than 1 (e.g. inside `@layer components { .wrapper { ... } }`)
  // can still be matched by allow-shim-block: .wrapper.
  const ancestorsAt = computeAncestorWrappers(lines);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Strip comments to avoid matching inside them
    const codeLine = line.replace(/\/\*[^*]*\*\//g, '').replace(/\/\/.*$/, '');
    let rule = null;
    let category = null;
    if (RE_BS_GRID.test(codeLine)) { rule = 'R1'; category = 'Bootstrap-grid selector'; }
    else if (RE_BS_COMPONENT.test(codeLine)) { rule = 'R2'; category = 'Bootstrap component selector'; }
    else if (RE_BS_UTILITY.test(codeLine)) { rule = 'R3'; category = 'Bootstrap visibility/utility selector'; }
    if (!rule) continue;
    if (hasOverrideAbove(lines, i, RE_ALLOW_SHIM)) continue;
    const ancestors = ancestorsAt[i];
    if (ancestors.some(a => allowedWrappers.has(a))) continue;
    violate(
      file,
      i + 1,
      rule,
      'error',
      `${category} defined in Tailwind tree: ${codeLine.trim()}`,
      'Add /* tailwind-migration-allow-shim: <justification> */ on the line above, or — for many selectors nested under one wrapper class — /* tailwind-migration-allow-shim-block: .<wrapper-class>; <justification> */ anywhere in the file. Otherwise rewrite as Tailwind utilities.'
    );
  }
}

function collectAllowedShimWrappers(lines) {
  const set = new Set();
  for (const line of lines) {
    const m = line.match(RE_ALLOW_SHIM_BLOCK);
    if (m) set.add(m[1]);
  }
  return set;
}

// For each line index, return the set of bare class names of all ancestor
// rule selectors enclosing that line. A line nested at depth 3 returns up
// to 3 names. Compound selectors at any depth contribute nothing.
// This handles cases like `@layer components { .foo { & .row { ... } } }` —
// `.foo` is a depth-2 ancestor that the shim-block check should consider.
// Tracks multi-line block comments (`/* ... */`) so commented selectors are
// not interpreted as real ones.
function computeAncestorWrappers(lines) {
  const out = new Array(lines.length).fill(null).map(() => []);
  const stack = []; // bare class names per depth, null for non-class wrappers
  let pendingSelector = '';
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      const next = line[j + 1];
      if (inBlockComment) {
        if (c === '*' && next === '/') {
          inBlockComment = false;
          j++; // skip the '/'
        }
        continue;
      }
      if (c === '/' && next === '*') {
        inBlockComment = true;
        j++; // skip the '*'
        continue;
      }
      if (c === '/' && next === '/') {
        break; // rest of line is a single-line comment
      }
      if (c === '{') {
        const sel = pendingSelector.trim();
        const m = sel.match(/^\.([\w-]+)$/);
        stack.push(m ? m[1] : null);
        pendingSelector = '';
      } else if (c === '}') {
        stack.pop();
        pendingSelector = '';
      } else {
        pendingSelector += c;
      }
    }
    out[i] = stack.filter(Boolean);
  }
  return out;
}

// R4 — Bootstrap classes USED in new Tailwind ERB markup.
function checkBootstrapClassUse(file) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    RE_BS_CLASS_USE.lastIndex = 0;
    while ((m = RE_BS_CLASS_USE.exec(line)) !== null) {
      const classList = m[1];
      const tokenMatch = classList.match(BS_CLASS_TOKEN);
      if (!tokenMatch) continue;
      if (hasOverrideAbove(lines, i, RE_ALLOW_BS_CLASS)) continue;
      violate(
        file,
        i + 1,
        'R4',
        'error',
        `Bootstrap class "${tokenMatch[0]}" used in Tailwind ERB`,
        'Rewrite with Tailwind utilities, or add <%# tailwind-migration-allow-bs-class: <justification> %> on the line above (e.g. for a wrapped Bootstrap partial).'
      );
    }
  }
}

// R5 — Page CSS line ceiling (>150 lines).
function checkPageCssLineCount(file) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const lineCount = lines.length;
  if (lineCount <= PAGE_CSS_CEILING) return;
  if (hasOverrideInFile(lines, RE_ALLOW_LARGE)) return;
  violate(
    file,
    1,
    'R5',
    'error',
    `Page CSS file is ${lineCount} lines (ceiling: ${PAGE_CSS_CEILING}). Likely a SCSS-to-CSS port instead of an inline-first decomposition.`,
    'Decompose per ${CLAUDE_PLUGIN_ROOT}/standards/page-css-decomposition.md — move grid/padding/margin/colors to inline Tailwind utilities on the ERB. If the file is genuinely irreducible, add /* tailwind-migration-allow-large: <justification> */ to the file header.'
  );
}

// R6 — No .scss in the Tailwind tree (added files only).
function checkNoScssInTailwindTree(file) {
  if (!file.endsWith('.scss')) return;
  if (!file.startsWith(TAILWIND_TREE)) return;
  violate(
    file,
    1,
    'R6',
    'error',
    'New .scss file under the Tailwind tree. Use .css.',
    'Rename to .css and remove any SCSS-only syntax (variables, @mixin, nested @include). Native CSS nesting is fine.'
  );
}

// R7 — CSS under tailwind/components/ should use @apply for properties that
// have Tailwind utility equivalents. Per the team docs' canonical example,
// component CSS uses @apply inside @layer components. Properties with no
// Tailwind utility (filter chains, clip-path, mask, CSS custom properties)
// may live as raw CSS in the same file — branded-css-rules.md § "Raw CSS
// alongside @apply".
function checkComponentApply(file) {
  if (!file.startsWith(TAILWIND_COMPONENTS)) return;
  if (!file.endsWith('.css')) return;
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  // Count declaration lines that COULD have been @apply (i.e. exclude
  // properties without Tailwind utility equivalents), and count @apply lines.
  let declCount = 0;
  let applyCount = 0;
  for (const line of lines) {
    if (/^\s*@apply\b/.test(line)) {
      applyCount++;
    } else if (/^\s*[a-z-]+\s*:\s*[^;]+;/.test(line) && !RE_NATURAL_RAW_PROP.test(line)) {
      declCount++;
    }
  }
  if (declCount <= NATIVE_CSS_DECL_THRESHOLD) return;
  if (applyCount > 0) return;
  if (hasOverrideInFile(lines, RE_ALLOW_NATIVE)) return;
  violate(
    file,
    1,
    'R7',
    'error',
    `Component CSS file has ${declCount} native declarations (excluding properties without Tailwind utility equivalents) and zero @apply directives. Component CSS should use @apply for Tailwind-expressible properties, per the team Tailwind docs' canonical pattern.`,
    'Rewrite the Tailwind-expressible rules using @apply, keep filter/clip-path/mask/etc. as raw CSS in the same file, or add /* tailwind-migration-allow-native: <justification> */ to the file header.'
  );
}

// R8 — New CSS files added outside the Tailwind tree during a migration.
function checkOutsideTreeAddition(file, commitText) {
  if (!file.endsWith('.css') && !file.endsWith('.scss')) return;
  if (file.startsWith(TAILWIND_TREE)) return;
  const trailer = new RegExp(`Tailwind-migration-allow-outside-tree:\\s*${file.replace(/[.+?^${}()|[\\]\\\\]/g, '\\\\$&')}`, 'i');
  if (trailer.test(commitText)) return;
  violate(
    file,
    1,
    'R8',
    'warn',
    'New CSS file outside the Tailwind tree.',
    `Acknowledge with a commit trailer: "Tailwind-migration-allow-outside-tree: ${file}"`
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const changedFiles = gitDiffFiles('AM');
  const addedFiles = new Set(gitDiffFiles('A'));
  const commitText = commitMessages();

  for (const file of changedFiles) {
    if (!existsSync(file)) continue;
    try {
      if (statSync(file).isDirectory()) continue;
    } catch { continue; }

    const isInTailwindTree = file.startsWith(TAILWIND_TREE);
    const isCss = file.endsWith('.css') || file.endsWith('.scss');
    const isErb = file.endsWith('.erb');
    const isTailwindErb = isErb && (file.includes('/tailwind/') || file.includes('/views/hr/'));

    if (isInTailwindTree && isCss) {
      checkBootstrapSelectorsDefined(file);
      if (addedFiles.has(file)) checkNoScssInTailwindTree(file);
    }
    if (file.startsWith(TAILWIND_PAGES) && file.endsWith('.css') && addedFiles.has(file)) {
      checkPageCssLineCount(file);
    }
    if (file.startsWith(TAILWIND_COMPONENTS) && file.endsWith('.css')) {
      checkComponentApply(file);
    }
    if (isTailwindErb) {
      checkBootstrapClassUse(file);
    }
    if (addedFiles.has(file)) {
      checkOutsideTreeAddition(file, commitText);
    }
  }

  const errors = violations.filter(v => v.level === 'error');
  const warnings = violations.filter(v => v.level === 'warn');

  if (ARGS.json) {
    console.log(JSON.stringify({ violations, summary: { errors: errors.length, warnings: warnings.length } }, null, 2));
  } else {
    if (violations.length === 0) {
      console.log('✓ tailwind-migration-validate: no Bootstrap leakage detected.');
    } else {
      console.log(`tailwind-migration-validate: ${errors.length} error(s), ${warnings.length} warning(s)\n`);
      for (const v of violations) {
        const tag = v.level === 'error' ? 'ERROR' : 'WARN ';
        console.log(`[${tag} ${v.rule}] ${v.file}:${v.line}`);
        console.log(`  ${v.msg}`);
        if (v.override) console.log(`  fix: ${v.override}`);
        console.log('');
      }
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
