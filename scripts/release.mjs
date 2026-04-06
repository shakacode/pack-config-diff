#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const CHANGELOG_PATH = path.join(ROOT_DIR, "CHANGELOG.md");
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");

const COLORS = {
  red: "\u001b[0;31m",
  green: "\u001b[0;32m",
  yellow: "\u001b[1;33m",
  bold: "\u001b[1m",
  reset: "\u001b[0m",
};

const state = {
  dryRun: false,
  skipTests: false,
  command: "release",
  syncVersion: null,
  allowSameVersionRelease: false,
  versionStatus: "unknown",
  npmAuthenticated: false,
  ghAuthenticated: false,
  npmUser: null,
  repoSlug: null,
  releaseVersion: null,
  releaseDate: null,
  currentVersion: null,
  packageName: null,
  npmTag: "latest",
};

function usage() {
  console.log(`Usage: node scripts/release.mjs [command] [options]

Commands:
  release                Run the changelog-driven release flow (default)
  sync-github-release    Create or update the GitHub release from CHANGELOG.md

Options:
  --dry-run              Run in dry-run mode
  --skip-tests           Skip test and build checks
  --version <version>    Version to use with sync-github-release (defaults to CHANGELOG.md)
  -h, --help             Show this help message

The release version is always read from CHANGELOG.md for the release command.
`);
}

function colorize(color, message) {
  return `${color}${message}${COLORS.reset}`;
}

function logInfo(message) {
  console.log(colorize(COLORS.green, `[INFO] ${message}`));
}

function logWarn(message) {
  console.warn(colorize(COLORS.yellow, `[WARN] ${message}`));
}

function logError(message) {
  console.error(colorize(COLORS.red, `[ERROR] ${message}`));
}

function fail(message, details = "") {
  logError(message);
  if (details) {
    console.error(details.trim());
  }
  process.exit(1);
}

function parseArgs(argv) {
  const args = [...argv];
  if (args[0] === "release" || args[0] === "sync-github-release") {
    state.command = args.shift();
  }

  while (args.length > 0) {
    const arg = args.shift();
    switch (arg) {
      case "--dry-run":
        state.dryRun = true;
        break;
      case "--skip-tests":
        state.skipTests = true;
        break;
      case "--version":
        state.syncVersion = (args.shift() ?? fail("Missing value for --version")).replace(/^v/, "");
        assertSemverVersion(state.syncVersion, "--version");
        break;
      case "-h":
      case "--help":
        usage();
        process.exit(0);
      default:
        fail(`Unknown option: ${arg}`);
    }
  }
}

function assertSemverVersion(version, source) {
  if (!parseSemver(version)) {
    fail(`Unsupported ${source} version: ${version}`);
  }
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT_DIR,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.stdio ?? ["pipe", "pipe", "pipe"],
  });

  if (result.error) {
    fail(`Failed to run ${command}: ${result.error.message}`);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function capture(command, args, options = {}) {
  return runCommand(command, args, options);
}

function runOrFail(command, args, options = {}) {
  const result = runCommand(command, args, {
    ...options,
    stdio: options.stdio ?? "inherit",
  });

  if (result.status !== 0) {
    fail(`Command failed: ${command} ${args.join(" ")}`);
  }

  return result;
}

function fileText(filePath) {
  return readFileSync(filePath, "utf8");
}

function packageJson() {
  return JSON.parse(fileText(PACKAGE_JSON_PATH));
}

function parseVersionFromChangelog() {
  const lines = fileText(CHANGELOG_PATH).split(/\r?\n/);
  const header = lines.find((line) => /^## \[v[0-9]/.test(line));

  if (!header) {
    fail("No version header found in CHANGELOG.md (expected: ## [vX.Y.Z] - YYYY-MM-DD)");
  }

  const match = header.match(/^## \[v([^\]]+)\] - (\d{4}-\d{2}-\d{2})$/);
  if (!match) {
    fail(`Malformed CHANGELOG version header: ${header}`);
  }

  state.releaseVersion = match[1];
  state.releaseDate = match[2];
  assertSemverVersion(state.releaseVersion, "CHANGELOG.md");
  logInfo(`CHANGELOG version: v${state.releaseVersion} (${state.releaseDate})`);
}

function parseCurrentVersion() {
  const pkg = packageJson();
  state.currentVersion = pkg.version;
  state.packageName = pkg.name;
  assertSemverVersion(state.currentVersion, "package.json");
  logInfo(`package.json version: ${state.currentVersion}`);
}

function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : null,
  };
}

function comparePrerelease(left, right) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];

    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftIsNumber = /^\d+$/.test(leftPart);
    const rightIsNumber = /^\d+$/.test(rightPart);

    if (leftIsNumber && rightIsNumber) {
      return Number(leftPart) < Number(rightPart) ? -1 : 1;
    }

    if (leftIsNumber !== rightIsNumber) {
      return leftIsNumber ? -1 : 1;
    }

    return leftPart < rightPart ? -1 : 1;
  }

  return 0;
}

function compareVersions(currentVersion, releaseVersion) {
  const current = parseSemver(currentVersion);
  const release = parseSemver(releaseVersion);

  if (!current || !release) {
    fail(`Unable to compare versions: ${currentVersion} vs ${releaseVersion}`);
  }

  for (const key of ["major", "minor", "patch"]) {
    if (current[key] < release[key]) return -1;
    if (current[key] > release[key]) return 1;
  }

  return comparePrerelease(current.prerelease, release.prerelease);
}

function versionTagExists(version) {
  const local = capture("git", ["rev-parse", `refs/tags/v${version}`]);
  if (local.status === 0) {
    return true;
  }

  const remote = capture("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/v${version}`]);
  return remote.status === 0;
}

function versionPublishedToNpm(packageName, version) {
  let result = capture("npm", ["view", `${packageName}@${version}`, "version", "--json"]);
  if (result.status === 0) {
    return true;
  }

  if (/E404/.test(result.output)) {
    return false;
  }

  if (/E401|E403|ENEEDAUTH/.test(result.output)) {
    logWarn("npm auth blocked publish-state lookup; retrying anonymously against the public registry.");
    result = capture("npm", ["view", `${packageName}@${version}`, "version", "--json"], {
      env: { ...process.env, NPM_CONFIG_USERCONFIG: "/dev/null" },
    });

    if (result.status === 0) {
      return true;
    }

    if (/E404/.test(result.output)) {
      return false;
    }
  }

  fail(`Unable to verify npm publish state for ${packageName}@${version}.`, result.output);
}

function checkVersionState() {
  const comparison = compareVersions(state.currentVersion, state.releaseVersion);

  switch (comparison) {
    case 0:
      state.versionStatus = "already-updated";

      if (versionTagExists(state.releaseVersion) ||
          versionPublishedToNpm(state.packageName, state.releaseVersion)) {
        logInfo(`No release needed — v${state.releaseVersion} is already tagged or published.`);
        process.exit(0);
      }

      state.allowSameVersionRelease = true;
      logInfo(`Version confirmed: package.json already matches CHANGELOG.md at ${state.releaseVersion}.`);
      break;
    case -1:
      state.versionStatus = "needs-bump";

      if (versionTagExists(state.releaseVersion) ||
          versionPublishedToNpm(state.packageName, state.releaseVersion)) {
        fail(`Release version v${state.releaseVersion} already exists as a tag or published npm version.`);
      }

      logInfo(
        `Version confirmed: release-it will update package.json/package-lock.json ` +
          `from ${state.currentVersion} to ${state.releaseVersion}.`,
      );
      break;
    case 1:
      state.versionStatus = "ahead-of-changelog";
      fail(
        `package.json version ${state.currentVersion} is ahead of CHANGELOG.md version ${state.releaseVersion}.`,
        "Update CHANGELOG.md to the intended release version or reset package.json/package-lock.json before releasing.",
      );
      break;
    default:
      fail(`Unexpected version comparison result: ${comparison}`);
  }
}

function detectNpmTag(version) {
  if (!version.includes("-")) {
    state.npmTag = "latest";
    return;
  }

  const [, prerelease = "next"] = version.split("-", 2);
  state.npmTag = prerelease.split(".", 1)[0] || "next";
  logInfo(`Prerelease detected — npm dist-tag: ${state.npmTag}`);
}

function githubRepoSlug() {
  if (state.repoSlug) {
    return state.repoSlug;
  }

  const result = capture("git", ["remote", "get-url", "origin"]);
  if (result.status !== 0) {
    fail("Unable to determine git origin URL.", result.output);
  }

  const trimmed = result.stdout.trim();
  const match = trimmed.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
  if (!match) {
    fail(`Unable to determine GitHub repository from origin URL: ${trimmed}`);
  }

  state.repoSlug = match[1];
  return state.repoSlug;
}

function ensureCleanWorkingTree() {
  const unstaged = capture("git", ["diff", "--quiet"]);
  const staged = capture("git", ["diff", "--cached", "--quiet"]);
  if (unstaged.status !== 0 || staged.status !== 0) {
    fail("Git working tree must be clean. Commit or stash changes first.");
  }
}

function ensureMainBranch() {
  const result = capture("git", ["branch", "--show-current"]);
  if (result.status !== 0) {
    fail("Unable to determine current git branch.", result.output);
  }

  const branch = result.stdout.trim();
  if (branch !== "main") {
    fail(`Releases must be run from main (current: ${branch || "detached HEAD"}).`);
  }
}

function ensureNpmAuth() {
  const result = capture("npm", ["whoami"]);
  if (result.status === 0) {
    state.npmAuthenticated = true;
    state.npmUser = result.stdout.trim();
    console.log(`  ✓ Logged in to npm as: ${state.npmUser}`);
    return;
  }

  if (state.dryRun) {
    logWarn("npm auth unavailable — continuing because this is a dry run. Actual publish still requires 'npm login'.");
    return;
  }

  console.log("");
  logWarn("npm authentication required. Running 'npm login' now...");
  runOrFail("npm", ["login"], { stdio: "inherit" });

  const verify = capture("npm", ["whoami"]);
  if (verify.status !== 0) {
    fail("npm login failed. Please run 'npm login' manually and retry.", verify.output);
  }

  state.npmAuthenticated = true;
  state.npmUser = verify.stdout.trim();
  console.log(`  ✓ Logged in to npm as: ${state.npmUser}`);
}

function ensureGhAuth() {
  const status = capture("gh", ["auth", "status"]);
  if (status.status !== 0) {
    if (state.dryRun) {
      logWarn("GitHub CLI auth unavailable — continuing because this is a dry run. Actual release creation still requires 'gh auth login'.");
      return;
    }

    console.log("");
    logWarn("GitHub CLI authentication required. Running 'gh auth login' now...");
    runOrFail("gh", ["auth", "login"], { stdio: "inherit" });
  }

  const repoSlug = githubRepoSlug();
  const permission = capture("gh", ["api", `repos/${repoSlug}`, "--jq", ".permissions.push"]);
  if (permission.status !== 0) {
    if (state.dryRun) {
      logWarn(`Unable to verify GitHub write access to ${repoSlug} during dry run.`);
      return;
    }
    fail(`GitHub CLI authenticated, but failed to verify write access to ${repoSlug}.`, permission.output);
  }

  if (permission.stdout.trim() !== "true") {
    if (state.dryRun) {
      logWarn(`GitHub CLI authenticated, but write access to ${repoSlug} could not be confirmed during dry run.`);
      return;
    }

    fail(`GitHub CLI authenticated, but your account/token does not have write access to ${repoSlug}.`);
  }

  state.ghAuthenticated = true;
  console.log(`  ✓ GitHub CLI authenticated with write access to ${repoSlug}`);
}

function preflightChecks() {
  console.log("");
  logInfo("Running pre-flight checks...");

  ensureCleanWorkingTree();
  console.log("  ✓ Clean working tree");

  ensureMainBranch();
  console.log("  ✓ On main branch");

  console.log(`  ✓ Tag v${state.releaseVersion} does not exist`);

  ensureNpmAuth();
  ensureGhAuth();
}

function runTests() {
  if (state.skipTests) {
    logWarn("Skipping tests (--skip-tests).");
    return;
  }

  console.log("");
  logInfo("Running tests and build...");
  runOrFail("npm", ["test"], { stdio: "inherit" });
  runOrFail("npm", ["run", "build"], { stdio: "inherit" });
  logInfo("Tests and build passed.");
}

async function promptYesNo(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail("Interactive confirmation requires a TTY.");
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await new Promise((resolve) => {
      rl.question(`${colorize(COLORS.bold, `${prompt} [y/N] `)}`, resolve);
    });
    return /^y(es)?$/i.test(String(answer).trim());
  } finally {
    rl.close();
  }
}

function extractChangelogSection(version) {
  const lines = fileText(CHANGELOG_PATH).split(/\r?\n/);
  const header = `## [v${version}]`;
  const startIndex = lines.findIndex((line) => line.startsWith(header));
  if (startIndex === -1) {
    return null;
  }

  const contentLines = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^## \[/.test(line)) {
      break;
    }

    if (/^\[.+\]:/.test(line)) {
      continue;
    }

    contentLines.push(line);
  }

  const trimmed = contentLines.join("\n").replace(/^\s*\n+/, "").replace(/\n+\s*$/, "");
  return trimmed || null;
}

async function showSummaryAndConfirm() {
  console.log("");
  console.log("════════════════════════════════════════════════════════════════");
  console.log(`  ${colorize(COLORS.bold, "Release Summary")}`);
  console.log("════════════════════════════════════════════════════════════════");
  console.log(`  Current version:  ${state.currentVersion}`);
  console.log(`  Release version:  ${state.releaseVersion}`);
  console.log(`  Version status:   ${state.versionStatus}`);
  console.log(`  npm dist-tag:     ${state.npmTag}`);
  console.log(`  Same version:     ${state.allowSameVersionRelease}`);
  console.log(`  Dry run:          ${state.dryRun}`);
  console.log("════════════════════════════════════════════════════════════════");
  console.log("");

  if (state.dryRun) {
    logInfo("DRY RUN — no changes will be made.");
    return;
  }

  const hasNotes = Boolean(extractChangelogSection(state.releaseVersion));
  if (!hasNotes) {
    logWarn(`No changelog content found for v${state.releaseVersion}. GitHub release notes will be empty.`);
  }

  const confirmed = await promptYesNo(`Proceed with release v${state.releaseVersion}?`);
  if (!confirmed) {
    console.log("Aborted.");
    process.exit(1);
  }
}

function isPrereleaseVersion(version) {
  return version.includes("-");
}

function releaseItArgs() {
  const args = [
    state.releaseVersion,
    "--npm.publish",
    `--npm.tag=${state.npmTag}`,
    "--no-git.requireCleanWorkingDir",
    "--no-github.release",
    "--git.tagName=v${version}",
    "--git.commitMessage=Release v${version}",
    "--git.tagAnnotation=Release v${version}",
  ];

  if (state.allowSameVersionRelease) {
    args.push("--npm.skipChecks", "--npm.ignoreVersion", "--npm.allowSameVersion");
  } else if (state.dryRun && !state.npmAuthenticated) {
    args.push("--npm.skipChecks");
  }

  if (state.dryRun) {
    args.push("--dry-run", "--verbose", "--ci");
  }

  return args;
}

function runReleaseIt() {
  console.log("");
  logInfo("Running release-it...");
  const args = releaseItArgs();
  console.log(`  npx release-it ${args.join(" ")}`);

  const result = runCommand("npx", ["release-it", ...args], { stdio: "inherit" });
  if (result.status !== 0) {
    fail("release-it failed.");
  }
}

function ensureGitTagExists(version) {
  const fetch = capture("git", ["fetch", "--tags", "--quiet"]);
  if (fetch.status !== 0) {
    fail(`Unable to fetch git tags before verifying v${version}.`, fetch.output);
  }

  const local = capture("git", ["rev-parse", "--verify", "--quiet", `refs/tags/v${version}`]);
  if (local.status === 0) {
    return;
  }

  fail(`Git tag v${version} was not found locally or remotely.`);
}

function changelogDirty() {
  const result = capture("git", ["status", "--porcelain", "--", "CHANGELOG.md"]);
  if (result.status !== 0) {
    fail("Unable to check CHANGELOG.md status.", result.output);
  }

  return result.stdout.trim().length > 0;
}

function createOrUpdateGitHubRelease(version, { dryRun, requireCommittedChangelog = false } = {}) {
  if (requireCommittedChangelog && changelogDirty()) {
    fail("CHANGELOG.md has uncommitted changes. Commit or stash CHANGELOG.md before syncing the GitHub release.");
  }

  const notes = extractChangelogSection(version);
  if (!notes) {
    fail(`Could not find changelog notes for v${version} in CHANGELOG.md.`);
  }

  if (dryRun) {
    logInfo(`DRY RUN: Would create or update GitHub release v${version}`);
    console.log("  Release notes:");
    console.log(notes.split("\n").slice(0, 20).join("\n"));
    return;
  }

  ensureGitTagExists(version);
  ensureGhAuth();

  const repoSlug = githubRepoSlug();
  const tagName = `v${version}`;
  const title = tagName;
  const tempDir = mkdtempSync(path.join(tmpdir(), "pack-config-diff-release-notes-"));
  const notesPath = path.join(tempDir, "notes.md");
  writeFileSync(notesPath, `${notes}\n`);

  try {
    const existing = capture("gh", ["release", "view", tagName, "--repo", repoSlug]);
    const prerelease = isPrereleaseVersion(version);
    const args =
      existing.status === 0
        ? ["release", "edit", tagName, "--repo", repoSlug, "--title", title, "--notes-file", notesPath]
        : [
            "release",
            "create",
            tagName,
            "--repo",
            repoSlug,
            "--verify-tag",
            "--title",
            title,
            "--notes-file",
            notesPath,
          ];

    if (prerelease) {
      args.push("--prerelease");
    }

    console.log("");
    logInfo(`${existing.status === 0 ? "Updating" : "Creating"} GitHub release...`);
    runOrFail("gh", args, { stdio: "inherit" });
    logInfo(`GitHub release ${existing.status === 0 ? "updated" : "created"}: v${version}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function printCompletion() {
  console.log("");
  console.log("════════════════════════════════════════════════════════════════");
  if (state.dryRun) {
    console.log(`  ${colorize(`${COLORS.green}${COLORS.bold}`, "DRY RUN COMPLETE")}`);
  } else {
    console.log(`  ${colorize(`${COLORS.green}${COLORS.bold}`, `RELEASE COMPLETE: v${state.releaseVersion}`)}`);
    console.log("");
    console.log(`  npm: https://www.npmjs.com/package/${state.packageName}`);
    console.log(`  GitHub: https://github.com/${githubRepoSlug()}/releases`);
  }
  console.log("════════════════════════════════════════════════════════════════");
  console.log("");
}

async function runReleaseCommand() {
  console.log("");
  console.log(colorize(COLORS.bold, "pack-config-diff release"));
  console.log("");

  parseVersionFromChangelog();
  parseCurrentVersion();
  checkVersionState();
  detectNpmTag(state.releaseVersion);
  preflightChecks();
  runTests();
  await showSummaryAndConfirm();
  runReleaseIt();
  createOrUpdateGitHubRelease(state.releaseVersion, { dryRun: state.dryRun });
  printCompletion();
}

function syncReleaseVersion() {
  if (state.syncVersion) {
    return state.syncVersion;
  }

  parseVersionFromChangelog();
  return state.releaseVersion;
}

async function runSyncGitHubReleaseCommand() {
  const version = syncReleaseVersion();
  console.log("");
  console.log(colorize(COLORS.bold, "pack-config-diff sync-github-release"));
  console.log("");
  logInfo(`Target version: v${version}`);
  createOrUpdateGitHubRelease(version, {
    dryRun: state.dryRun,
    requireCommittedChangelog: !state.dryRun,
  });
}

async function main() {
  parseArgs(process.argv.slice(2));

  switch (state.command) {
    case "release":
      await runReleaseCommand();
      break;
    case "sync-github-release":
      await runSyncGitHubReleaseCommand();
      break;
    default:
      fail(`Unknown command: ${state.command}`);
  }
}

main().catch((error) => {
  fail(error.message, error.stack ?? "");
});
