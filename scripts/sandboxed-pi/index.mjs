import { spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MODEL_ID,
  PROVIDER_API,
  PROVIDER_API_KEY,
  PROVIDER_BASE_URL,
  PROVIDER_NAME,
} from "./constants.mjs";
import {
  loadScenarii,
  parseSandboxArgs,
  printSandboxUsage,
} from "./scenarii.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..", "..");
const demoHome = path.join(repoRoot, ".demo", "pi-home");
const demoPiDir = path.join(demoHome, ".pi");
const agentDir = path.join(demoHome, ".pi", "agent");
const extensionsDir = path.join(agentDir, "extensions");
const sandboxDir = path.join(agentDir, "sandboxed-pi");
const extensionLink = path.join(extensionsDir, "pi-aks-user-question");
const demoProviderLink = path.join(extensionsDir, "sandboxed-pi-provider.mjs");
const modelsPath = path.join(agentDir, "models.json");
const scenariiStatePath = path.join(sandboxDir, "scenarii.json");
const sessionsDir = path.join(demoPiDir, "sessions");
const settingsPath = path.join(agentDir, "settings.json");
const piBinary = path.join(repoRoot, "node_modules", ".bin", "pi");
const demoProviderSource = path.join(
  repoRoot,
  "scripts",
  "sandboxed-pi",
  "provider.mjs",
);

const { help, piArgs, scenariiPath } = parseArgsOrExit(process.argv.slice(2));

if (help) {
  printSandboxUsage();
  process.exit(0);
}

const scenarii = loadScenarii(path.resolve(process.cwd(), scenariiPath));

await mkdir(extensionsDir, { recursive: true });
await mkdir(sandboxDir, { recursive: true });
await rm(sessionsDir, { force: true, recursive: true });
await ensureSymlink(repoRoot, extensionLink, "dir");
await ensureSymlink(demoProviderSource, demoProviderLink, "file");
await writeJsonFile(modelsPath, createDemoModels());
await writeJsonFile(settingsPath, createDemoSettings());
await writeJsonFile(scenariiStatePath, scenarii);

const child = spawn(
  piBinary,
  [
    "--no-skills",
    "--no-prompt-templates",
    "--extension",
    demoProviderSource,
    ...piArgs,
  ],
  {
    cwd: demoHome,
    stdio: "inherit",
    env: createSandboxEnv(demoHome),
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

/**
 * Parses CLI arguments. Prints usage and exits with code 1 on any error.
 * Exits with code 0 when --help is requested.
 */
function parseArgsOrExit(argv) {
  try {
    return parseSandboxArgs(argv);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Invalid sandbox arguments",
    );
    console.error("");
    printSandboxUsage();
    process.exit(1);
  }
}

/** Returns true if `error` is a Node.js system error with an `code` property. */
function isNodeError(error) {
  return typeof error === "object" && error !== null && "code" in error;
}

/**
 * Creates or replaces a symlink at `linkPath` pointing to `target`.
 *
 * If a symlink already exists and points to the correct target, it is left
 * untouched. Any other entry (wrong target, regular file, directory) is
 * removed before creating the new symlink.
 *
 * On Windows, directories are linked as junctions to avoid requiring
 * administrator privileges.
 *
 * @param {string} target - Absolute path of the link target.
 * @param {string} linkPath - Absolute path where the symlink should appear.
 * @param {"file" | "dir"} type - Symlink type (only matters on Windows).
 */
async function ensureSymlink(target, linkPath, type) {
  try {
    const entry = await lstat(linkPath);
    if (entry.isSymbolicLink()) {
      const existingTarget = await readlink(linkPath);
      const resolvedTarget = path.resolve(
        path.dirname(linkPath),
        existingTarget,
      );
      if (resolvedTarget === target) return;
    }
    await rm(linkPath, { force: true, recursive: true });
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") throw error;
  }

  const linkType =
    process.platform === "win32"
      ? type === "dir"
        ? "junction"
        : "file"
      : type;

  try {
    await symlink(target, linkPath, linkType);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "EEXIST") throw error;

    const existingTarget = await readlink(linkPath);
    const resolvedTarget = path.resolve(path.dirname(linkPath), existingTarget);
    if (resolvedTarget !== target) throw error;
  }
}

/**
 * Builds pi's settings.json for the sandbox HOME.
 *
 * Sets the demo provider and model as defaults so pi selects them at startup
 * without requiring explicit --provider/--model CLI flags. Skills are disabled
 * to keep the demo session minimal and fully deterministic.
 */
function createDemoSettings() {
  return {
    defaultProvider: PROVIDER_NAME,
    defaultModel: MODEL_ID,
    enableSkillCommands: false,
    quietStartup: true,
  };
}

/**
 * Builds pi's models.json for the sandbox HOME.
 *
 * Writing this file before spawning pi is what makes early model selection
 * work: pi's ModelRegistry loads models.json during startup, before any
 * extensions are processed — so the demo model is already registered when
 * pi resolves the default provider/model from settings.json.
 *
 * The apiKey and baseUrl are placeholder values required by pi's
 * validateProviderConfig() contract, even though the provider never makes
 * real HTTP requests. See constants.mjs for details.
 */
function createDemoModels() {
  return {
    providers: {
      [PROVIDER_NAME]: {
        api: PROVIDER_API,
        apiKey: PROVIDER_API_KEY,
        baseUrl: PROVIDER_BASE_URL,
        models: [
          {
            id: MODEL_ID,
            name: "Scenario-driven demo response",
            reasoning: false,
            input: ["text"],
            contextWindow: 128000,
            maxTokens: 4096,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          },
        ],
      },
    },
  };
}

/**
 * Builds a minimal environment object for the sandbox process.
 *
 * Only variables required for a working TTY terminal session are included.
 * Personal config variables (e.g. API keys in the real HOME) are intentionally
 * excluded so the demo is fully self-contained and reproducible across machines.
 *
 * Optional display/locale variables are forwarded when present in the current
 * environment, because they affect terminal rendering but not reproducibility.
 *
 * @param {string} homeDir - The isolated HOME directory for the sandbox.
 */
function createSandboxEnv(homeDir) {
  const env = {
    HOME: homeDir,
    LANG: process.env.LANG ?? "en_US.UTF-8",
    PATH: process.env.PATH ?? "",
    TERM: process.env.TERM ?? "xterm-256color",
  };

  for (const key of [
    "COLORTERM",
    "LC_ALL",
    "SHELL",
    "TEMP",
    "TERM_PROGRAM",
    "TERM_PROGRAM_VERSION",
    "TMP",
    "TMPDIR",
  ]) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }

  return env;
}

/** Serialises `value` to pretty-printed JSON and writes it to `filePath`. */
async function writeJsonFile(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
