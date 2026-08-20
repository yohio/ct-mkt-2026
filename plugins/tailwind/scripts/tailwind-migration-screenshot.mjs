#!/usr/bin/env node
//
// Tailwind migration visual validation — Playwright capture + diff
//
// Used by this plugin's tailwind-implementer.md per the procedure in
// ${CLAUDE_PLUGIN_ROOT}/standards/tailwind-migration/playwright-visual-validation.md
//
// Modes:
//   prepare-auth  — interactive: open browser, user logs in, save storageState
//   capture       — headless: capture screenshots for one phase (baseline | migrated)
//   diff          — compare baseline vs migrated and write a markdown report
//   run-all       — capture(migrated) + diff in one go (assumes baseline exists)
//
// The script is self-bootstrapping: if `playwright` isn't installed in the
// project, it installs it locally to ${CLAUDE_PLUGIN_ROOT}/scripts/node_modules/ on first
// run. No project-level dependency required.

import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const NODE_MODULES = join(SCRIPT_DIR, "node_modules");

// ----- bootstrap dependencies on first run ----------------------------------

function ensureDeps() {
  const required = ["playwright", "pixelmatch", "pngjs"];
  const missing = required.filter((pkg) => !existsSync(join(NODE_MODULES, pkg)));
  if (missing.length === 0) return;

  console.error(`[bootstrap] installing ${missing.join(", ")} into ${NODE_MODULES} ...`);
  if (!existsSync(join(SCRIPT_DIR, "package.json"))) {
    writeFileSync(
      join(SCRIPT_DIR, "package.json"),
      JSON.stringify({ name: "tailwind-migration-screenshot", private: true, type: "module" }, null, 2),
    );
  }
  const r = spawnSync("npm", ["install", "--no-audit", "--no-fund", "--silent", ...missing], {
    cwd: SCRIPT_DIR,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error("[bootstrap] npm install failed; falling back to ImageMagick-only diff is not supported here.");
    process.exit(2);
  }

  // playwright also needs its browser binaries
  const pwBinDir = join(NODE_MODULES, ".bin");
  const pwInstall = spawnSync("npx", ["--prefix", SCRIPT_DIR, "playwright", "install", "chromium"], {
    cwd: SCRIPT_DIR,
    stdio: "inherit",
    env: { ...process.env, PATH: `${pwBinDir}:${process.env.PATH}` },
  });
  if (pwInstall.status !== 0) {
    console.error("[bootstrap] `playwright install chromium` failed");
    process.exit(2);
  }
}

// ----- arg parsing ----------------------------------------------------------

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function loadConfig(configPath) {
  if (!configPath) return null;
  const resolved = resolve(configPath);
  if (!existsSync(resolved)) {
    console.error(`[config] not found: ${resolved}`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(resolved, "utf8"));
}

// ----- modes ----------------------------------------------------------------

async function prepareAuth(args) {
  ensureDeps();
  const { chromium } = await import(join(NODE_MODULES, "playwright/index.mjs"));

  const role = args.role || "default";
  const loginUrl = args["login-url"];
  const out = args.out || `tmp/migration-snapshots/auth/${role}.json`;
  const hostHeader = args["host-header"];

  if (!loginUrl) {
    console.error("[prepare-auth] --login-url is required");
    process.exit(2);
  }

  mkdirSync(dirname(out), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(
    hostHeader ? { extraHTTPHeaders: { Host: hostHeader } } : {},
  );
  const page = await context.newPage();
  await page.goto(loginUrl);

  console.error(`[prepare-auth] role=${role} — log in, then close the browser window when done.`);
  console.error(`[prepare-auth] when you close the window, the storage state is saved to ${out}`);

  await page.waitForEvent("close", { timeout: 0 }).catch(() => {});
  await context.storageState({ path: out });
  await browser.close();

  console.error(`[prepare-auth] wrote ${out}`);
}

async function capture(args) {
  ensureDeps();
  const { chromium } = await import(join(NODE_MODULES, "playwright/index.mjs"));

  const cfg = loadConfig(args.config);
  if (!cfg) {
    console.error("[capture] --config <path-to-config.json> is required");
    process.exit(2);
  }
  const phase = args.phase || "baseline"; // baseline | migrated
  if (!["baseline", "migrated"].includes(phase)) {
    console.error("[capture] --phase must be 'baseline' or 'migrated'");
    process.exit(2);
  }

  const outDir = cfg.out_dir || `tmp/migration-snapshots/${cfg.ticket_id || "migration"}`;
  const phaseDir = join(outDir, phase);
  mkdirSync(phaseDir, { recursive: true });

  const manifest = { phase, ticket_id: cfg.ticket_id, target_url: cfg.target_url, shots: [] };
  const browser = await chromium.launch({ headless: true });

  for (const role of cfg.roles || ["anonymous"]) {
    const authPath = role === "anonymous" ? null : join(outDir, "auth", `${role}.json`);
    if (authPath && !existsSync(authPath)) {
      console.error(`[capture] missing auth state for role=${role} at ${authPath}`);
      console.error(`[capture] run: prepare-auth --role ${role} --login-url ${cfg.login_url || "http://localhost:3000/login"} --out ${authPath}`);
      process.exit(2);
    }

    for (const width of cfg.breakpoints || [1920, 1150, 768, 480]) {
      for (const scroll of cfg.scroll_states || ["top"]) {
        const urlAlreadyHasHost = cfg.host_header && cfg.target_url && cfg.target_url.includes(cfg.host_header);
        const context = await browser.newContext({
          viewport: { width, height: 1080 },
          storageState: authPath || undefined,
          extraHTTPHeaders: cfg.host_header && !urlAlreadyHasHost ? { Host: cfg.host_header } : undefined,
          ignoreHTTPSErrors: !!cfg.ignore_https_errors,
        });

        const consoleErrors = [];
        const networkFailures = [];
        const page = await context.newPage();
        page.on("console", (msg) => {
          if (msg.type() !== "error") return;
          const text = msg.text();
          if ((cfg.console_ignore_patterns || []).some((p) => text.includes(p))) return;
          consoleErrors.push(text);
        });
        page.on("response", (resp) => {
          const url = resp.url();
          const status = resp.status();
          if (status >= 400 && !(cfg.network_ignore_patterns || []).some((p) => url.includes(p))) {
            networkFailures.push({ url, status });
          }
        });

        try {
          await page.goto(cfg.target_url, { waitUntil: "load", timeout: cfg.nav_timeout_ms || 90000 });
          // trigger lazy loaders
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(300);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(200);

          if (scroll === "scrolled") {
            await page.evaluate(() => window.scrollTo(0, 200));
            await page.waitForTimeout(250);
          }

          // freeze animations for stable diffs
          await page.addStyleTag({
            content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`,
          });

          // mask user-specified dynamic regions
          for (const sel of cfg.mask_selectors || []) {
            await page.evaluate((s) => {
              document.querySelectorAll(s).forEach((el) => {
                el.style.visibility = "hidden";
              });
            }, sel);
          }

          const file = `${role}-${width}-${scroll}.png`;
          const outPath = join(phaseDir, file);
          await page.screenshot({ path: outPath, fullPage: true });
          manifest.shots.push({ role, width, scroll, file, consoleErrors, networkFailures });
          console.error(`[capture] ${phase} ${role} ${width}px ${scroll} → ${outPath}`);
        } catch (err) {
          manifest.shots.push({ role, width, scroll, file: null, error: String(err), consoleErrors, networkFailures });
          console.error(`[capture] FAILED ${phase} ${role} ${width}px ${scroll}: ${err.message}`);
        } finally {
          await context.close();
        }
      }
    }
  }

  await browser.close();
  writeFileSync(join(phaseDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.error(`[capture] wrote manifest ${join(phaseDir, "manifest.json")}`);
}

async function diff(args) {
  ensureDeps();
  const pixelmatch = (await import(join(NODE_MODULES, "pixelmatch/index.js"))).default;
  const { PNG } = await import(join(NODE_MODULES, "pngjs/lib/png.js"));

  const cfg = loadConfig(args.config);
  if (!cfg) {
    console.error("[diff] --config is required");
    process.exit(2);
  }
  const fuzz = args.fuzz !== undefined ? Number(args.fuzz) : (cfg.fidelity_mode === "strict" ? 0 : 5);
  const threshold = fuzz / 100;

  const outDir = cfg.out_dir || `tmp/migration-snapshots/${cfg.ticket_id || "migration"}`;
  const baselineDir = join(outDir, "baseline");
  const migratedDir = join(outDir, "migrated");
  const diffDir = join(outDir, "diff");
  mkdirSync(diffDir, { recursive: true });

  if (!existsSync(baselineDir) || !existsSync(migratedDir)) {
    console.error(`[diff] missing baseline or migrated dir under ${outDir}`);
    process.exit(2);
  }

  const baselineManifest = JSON.parse(readFileSync(join(baselineDir, "manifest.json"), "utf8"));
  const migratedManifest = JSON.parse(readFileSync(join(migratedDir, "manifest.json"), "utf8"));

  const rows = [];
  for (const baseShot of baselineManifest.shots) {
    if (!baseShot.file) continue;
    const migShot = migratedManifest.shots.find(
      (s) => s.role === baseShot.role && s.width === baseShot.width && s.scroll === baseShot.scroll,
    );
    if (!migShot || !migShot.file) {
      rows.push({ ...baseShot, ae: null, verdict: "missing-migrated" });
      continue;
    }
    const basePath = join(baselineDir, baseShot.file);
    const migPath = join(migratedDir, migShot.file);
    const baseImg = PNG.sync.read(readFileSync(basePath));
    const migImg = PNG.sync.read(readFileSync(migPath));
    const w = Math.min(baseImg.width, migImg.width);
    const h = Math.min(baseImg.height, migImg.height);
    const diffImg = new PNG({ width: w, height: h });
    const ae = pixelmatch(
      cropPng(baseImg, w, h),
      cropPng(migImg, w, h),
      diffImg.data,
      w,
      h,
      { threshold, includeAA: false },
    );
    const diffPath = join(diffDir, `${baseShot.role}-${baseShot.width}-${baseShot.scroll}-diff.png`);
    writeFileSync(diffPath, PNG.sync.write(diffImg));
    rows.push({
      ...baseShot,
      migrated_console: migShot.consoleErrors,
      migrated_network: migShot.networkFailures,
      ae,
      verdict: ae === 0 ? "pass" : (cfg.fidelity_mode === "strict" ? "fail" : "review"),
      diff_file: basename(diffPath),
    });
  }

  const reportPath = join(outDir, "playwright-report.md");
  writeFileSync(reportPath, renderReport(cfg, rows, fuzz));
  console.error(`[diff] wrote ${reportPath}`);

  const failures = rows.filter((r) => r.verdict === "fail");
  if (failures.length > 0 && cfg.fidelity_mode === "strict") {
    process.exit(1);
  }
}

function cropPng(img, w, h) {
  if (img.width === w && img.height === h) return img.data;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    img.data.copy(out, y * w * 4, y * img.width * 4, y * img.width * 4 + w * 4);
  }
  return out;
}

function renderReport(cfg, rows, fuzz) {
  const lines = [];
  lines.push(`# Playwright Visual Validation Report — ${cfg.ticket_id || "migration"}`);
  lines.push("");
  lines.push(`**Target:** ${cfg.target_url}`);
  lines.push(`**Fidelity mode:** ${cfg.fidelity_mode || "close_enough"}`);
  lines.push(`**Fuzz:** ${fuzz}%`);
  lines.push(`**Roles:** ${(cfg.roles || ["anonymous"]).join(", ")}`);
  lines.push(`**Breakpoints:** ${(cfg.breakpoints || []).join(", ")}`);
  lines.push(`**Scroll states:** ${(cfg.scroll_states || ["top"]).join(", ")}`);
  lines.push("");
  lines.push("## Diff summary");
  lines.push("");
  lines.push("| Role | Width | Scroll | AE pixels | Verdict |");
  lines.push("|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(`| ${r.role} | ${r.width} | ${r.scroll} | ${r.ae ?? "—"} | ${r.verdict} |`);
  }
  lines.push("");

  const consoleRows = rows.filter((r) => (r.migrated_console || []).length > 0);
  if (consoleRows.length > 0) {
    lines.push("## Console errors (migrated)");
    lines.push("");
    lines.push("| Role | Width | Scroll | Errors |");
    lines.push("|---|---|---|---|");
    for (const r of consoleRows) {
      lines.push(`| ${r.role} | ${r.width} | ${r.scroll} | ${r.migrated_console.map((e) => "`" + e.replace(/\|/g, "\\|") + "`").join("<br>")} |`);
    }
    lines.push("");
  }

  const networkRows = rows.filter((r) => (r.migrated_network || []).length > 0);
  if (networkRows.length > 0) {
    lines.push("## Network failures (migrated, HTTP ≥ 400)");
    lines.push("");
    lines.push("| Role | Width | Scroll | URL | Status |");
    lines.push("|---|---|---|---|---|");
    for (const r of networkRows) {
      for (const f of r.migrated_network) {
        lines.push(`| ${r.role} | ${r.width} | ${r.scroll} | ${f.url} | ${f.status} |`);
      }
    }
    lines.push("");
  }

  lines.push("## Investigation");
  lines.push("");
  lines.push("(Implementer fills this in when verdicts are not all pass.)");
  lines.push("");
  return lines.join("\n");
}

// ----- entry ----------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
const mode = args._[0];

switch (mode) {
  case "prepare-auth":
    await prepareAuth(args);
    break;
  case "capture":
    await capture(args);
    break;
  case "diff":
    await diff(args);
    break;
  case "run-all":
    await capture({ ...args, phase: "migrated" });
    await diff(args);
    break;
  default:
    console.error(`Usage:
  node ${basename(fileURLToPath(import.meta.url))} prepare-auth --role <role> --login-url <url> --out <path> [--host-header <host>]
  node ${basename(fileURLToPath(import.meta.url))} capture --config <config.json> --phase <baseline|migrated>
  node ${basename(fileURLToPath(import.meta.url))} diff --config <config.json> [--fuzz <n>]
  node ${basename(fileURLToPath(import.meta.url))} run-all --config <config.json>

Config JSON shape (see playwright-visual-validation.md § Inputs):
  {
    "ticket_id": "PROJ-1234",
    "target_url": "http://localhost:3000/browse/new",
    "host_header": "segment.localhost",
    "login_url": "http://localhost:3000/login",
    "breakpoints": [1920, 1620, 1150, 768, 480],
    "scroll_states": ["top", "scrolled"],
    "roles": ["anonymous", "member_role"],
    "fidelity_mode": "close_enough",
    "out_dir": "tmp/migration-snapshots/PROJ-1234",
    "mask_selectors": [".timestamp", "#latest-research"],
    "network_ignore_patterns": ["analytics", "gainsight", "intercom"],
    "console_ignore_patterns": ["flowplayer", "Invalid token", "cookieyes"]
  }
`);
    process.exit(2);
}
