import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { CodexAppServerBridge } from "./app-server.js";
import {
  appName,
  appVersion,
  codexHome,
  defaultHostId,
  getWorkspaceRoots,
} from "./config.js";
import type { HostStateStore } from "./state.js";

const execFileAsync = promisify(execFile);
const bunTomlParse = (
  globalThis as typeof globalThis & {
    Bun?: {
      TOML?: {
        parse(input: string): unknown;
      };
    };
  }
).Bun?.TOML?.parse;

type FetchContext = {
  bridge: CodexAppServerBridge;
  state: HostStateStore;
  workspaceRoot: string;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type LocalEnvironmentPlatform = "darwin" | "linux" | "win32";
type LocalEnvironmentActionIcon = "tool" | "run" | "debug" | "test";

type LocalEnvironmentAction = {
  name: string;
  icon: LocalEnvironmentActionIcon | null;
  command: string;
  platform?: LocalEnvironmentPlatform;
};

type LocalEnvironmentLifecycle = {
  script: string;
  darwin?: { script: string };
  linux?: { script: string };
  win32?: { script: string };
};

type LocalEnvironment = {
  version: number;
  name: string;
  setup: LocalEnvironmentLifecycle;
  cleanup?: LocalEnvironmentLifecycle;
  actions?: LocalEnvironmentAction[];
};

type LocalEnvironmentResultWithPath =
  | {
      configPath: string;
      cwdRelativeToGitRoot: string;
      type: "success";
      environment: LocalEnvironment;
    }
  | {
      configPath: string;
      cwdRelativeToGitRoot: string;
      type: "error";
      error: {
        message: string;
      };
    };

function parseBody(body: string | undefined): unknown {
  if (!body) {
    return undefined;
  }

  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

async function getGitOriginEntries(
  workspaceRoot: string,
  dirs: string[] | undefined,
): Promise<{ origins: Array<Record<string, string>>; homeDir: string }> {
  const requestedDirs = dirs && dirs.length > 0 ? dirs : getWorkspaceRoots(workspaceRoot);
  const origins: Array<Record<string, string>> = [];

  for (const dir of requestedDirs) {
    try {
      const { stdout: rootStdout } = await execFileAsync("git", [
        "-C",
        dir,
        "rev-parse",
        "--show-toplevel",
      ]);
      const root = rootStdout.trim();
      if (!root) {
        continue;
      }

      let originUrl = "";
      try {
        const { stdout: originStdout } = await execFileAsync("git", [
          "-C",
          dir,
          "remote",
          "get-url",
          "origin",
        ]);
        originUrl = originStdout.trim();
      } catch {
        originUrl = "";
      }

      origins.push({
        dir,
        root,
        originUrl,
      });
    } catch {
      origins.push({
        dir,
        root: dir,
        originUrl: "",
      });
    }
  }

  return {
    origins,
    homeDir: os.homedir(),
  };
}

async function listDirectoryEntries(targetDir: string): Promise<Array<Record<string, JsonValue>>> {
  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  return entries
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
      name: entry.name,
      path: path.join(targetDir, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLifecycle(value: unknown): LocalEnvironmentLifecycle | null {
  if (!isRecord(value) || typeof value.script !== "string") {
    return null;
  }

  const lifecycle: LocalEnvironmentLifecycle = {
    script: value.script,
  };

  for (const platform of ["darwin", "linux", "win32"] as const) {
    const platformValue = value[platform];
    if (!isRecord(platformValue) || typeof platformValue.script !== "string") {
      continue;
    }

    lifecycle[platform] = {
      script: platformValue.script,
    };
  }

  return lifecycle;
}

function parseActions(value: unknown): LocalEnvironmentAction[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const actions = new Array<LocalEnvironmentAction>();
  for (const action of value) {
    if (!isRecord(action)) {
      continue;
    }

    if (typeof action.name !== "string" || typeof action.command !== "string") {
      continue;
    }

    const nextAction: LocalEnvironmentAction = {
      name: action.name,
      icon:
        action.icon === "tool" ||
        action.icon === "run" ||
        action.icon === "debug" ||
        action.icon === "test"
          ? action.icon
          : null,
      command: action.command,
    };

    if (
      action.platform === "darwin" ||
      action.platform === "linux" ||
      action.platform === "win32"
    ) {
      nextAction.platform = action.platform;
    }

    actions.push(nextAction);
  }

  return actions;
}

function parseLocalEnvironment(raw: string): LocalEnvironment {
  if (!bunTomlParse) {
    throw new Error("TOML parser unavailable");
  }

  const parsed = bunTomlParse(raw);
  if (!isRecord(parsed)) {
    throw new Error("Invalid environment config");
  }

  const setup = parseLifecycle(parsed.setup);
  if (!setup) {
    throw new Error("Invalid environment setup");
  }

  const cleanup = parseLifecycle(parsed.cleanup);
  const version = typeof parsed.version === "number" && Number.isFinite(parsed.version)
    ? Math.trunc(parsed.version)
    : 1;

  return {
    version,
    name: typeof parsed.name === "string" ? parsed.name : "",
    setup,
    cleanup: cleanup ?? undefined,
    actions: parseActions(parsed.actions),
  };
}

async function getGitRoot(workspaceRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", [
      "-C",
      workspaceRoot,
      "rev-parse",
      "--show-toplevel",
    ]);
    const root = stdout.trim();
    return root || null;
  } catch {
    return null;
  }
}

function getWorkspaceRootFromConfigPath(configPath: string): string {
  return path.resolve(configPath, "..", "..", "..");
}

async function loadLocalEnvironmentResult(
  configPath: string,
  workspaceRoot: string,
  gitRoot: string | null,
): Promise<LocalEnvironmentResultWithPath> {
  const baseRoot = gitRoot ?? workspaceRoot;
  const relativePath = path.relative(baseRoot, workspaceRoot);
  const cwdRelativeToGitRoot = relativePath === "" ? "" : relativePath;

  try {
    const raw = await fs.readFile(configPath, "utf8");
    return {
      configPath,
      cwdRelativeToGitRoot,
      type: "success",
      environment: parseLocalEnvironment(raw),
    };
  } catch (error) {
    return {
      configPath,
      cwdRelativeToGitRoot,
      type: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

async function listLocalEnvironments(
  workspaceRoot: string,
): Promise<Array<LocalEnvironmentResultWithPath>> {
  const environmentsDir = path.join(workspaceRoot, ".codex", "environments");
  let entries: string[] = [];

  try {
    entries = await fs.readdir(environmentsDir);
  } catch {
    return [];
  }

  const gitRoot = await getGitRoot(workspaceRoot);
  const configPaths = entries
    .filter((entry) => entry.endsWith(".toml"))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => path.join(environmentsDir, entry));

  return Promise.all(
    configPaths.map((configPath) =>
      loadLocalEnvironmentResult(configPath, workspaceRoot, gitRoot),
    ),
  );
}

export async function handleFetchRoute(
  route: string,
  body: string | undefined,
  context: FetchContext,
): Promise<{
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}> {
  const params = parseBody(body) as Record<string, unknown> | undefined;

  switch (route) {
    case "account-info":
      return {
        status: 200,
        body: {
          accountId: null,
          userId: null,
          plan: null,
          email: null,
        },
      };
    case "active-workspace-roots":
      return {
        status: 200,
        body: {
          roots: getWorkspaceRoots(context.workspaceRoot),
        },
      };
    case "app-server-connection-state":
      return {
        status: 200,
        body: {
          state: context.bridge.getConnectionState(),
          errorMessage: context.bridge.getErrorMessage(),
        },
      };
    case "codex-home":
      return {
        status: 200,
        body: {
          codexHome,
          worktreesSegment: "worktrees",
        },
      };
    case "developer-instructions":
      return {
        status: 200,
        body: {
          instructions: typeof params?.baseInstructions === "string"
            ? params.baseInstructions
            : "",
        },
      };
    case "extension-info":
      return {
        status: 200,
        body: {
          version: appVersion,
          buildNumber: null,
          buildFlavor: null,
        },
      };
    case "fast-mode-rollout-metrics":
      return {
        status: 200,
        body: null,
      };
    case "get-copilot-api-proxy-info":
      return {
        status: 200,
        body: null,
      };
    case "get-global-state": {
      const key = typeof params?.key === "string" ? params.key : "";
      return {
        status: 200,
        body: {
          value: context.state.getGlobalState(key),
        },
      };
    }
    case "get-configuration": {
      const key = typeof params?.key === "string" ? params.key : "";
      return {
        status: 200,
        body: {
          value: context.state.getConfiguration(key),
        },
      };
    }
    case "gh-cli-status":
      return {
        status: 200,
        body: {
          isInstalled: false,
          isAuthenticated: false,
        },
      };
    case "gh-pr-status":
      return {
        status: 200,
        body: {
          pullRequest: null,
        },
      };
    case "git-origins":
      return {
        status: 200,
        body: await getGitOriginEntries(
          context.workspaceRoot,
          Array.isArray(params?.dirs)
            ? params.dirs.filter((value): value is string => typeof value === "string")
            : undefined,
        ),
      };
    case "has-custom-cli-executable":
      return {
        status: 200,
        body: {
          hasCustomCliExecutable: false,
        },
      };
    case "ide-context":
      return {
        status: 200,
        body: {
          ideContext: {
            activeFile: null,
            activeSelectionContent: null,
            openTabs: [],
          },
        },
      };
    case "list-pinned-threads":
      return {
        status: 200,
        body: {
          threadIds: context.state.getGlobalState("pinned-thread-ids") ?? [],
        },
      };
    case "local-environment":
      {
        const configPath = typeof params?.configPath === "string" ? params.configPath : "";
        if (!configPath) {
          return {
            status: 400,
            body: {
              error: "configPath is required",
            },
          };
        }

        const workspaceRoot = getWorkspaceRootFromConfigPath(configPath);
        const gitRoot = await getGitRoot(workspaceRoot);
        return {
          status: 200,
          body: {
            environment: await loadLocalEnvironmentResult(
              configPath,
              workspaceRoot,
              gitRoot,
            ),
          },
        };
      }
    case "local-environments":
      return {
        status: 200,
        body: {
          environments: await listLocalEnvironments(
            typeof params?.workspaceRoot === "string" && params.workspaceRoot
              ? params.workspaceRoot
              : context.workspaceRoot,
          ),
        },
      };
    case "local-environment-config": {
      const configPath = typeof params?.configPath === "string" ? params.configPath : "";
      if (!configPath) {
        return {
          status: 400,
          body: {
            error: "configPath is required",
          },
        };
      }

      try {
        const raw = await fs.readFile(configPath, "utf8");
        return {
          status: 200,
          body: {
            configPath,
            exists: true,
            raw,
          },
        };
      } catch {
        return {
          status: 200,
          body: {
            configPath,
            exists: false,
            raw: null,
          },
        };
      }
    }
    case "local-environment-config-save": {
      const configPath = typeof params?.configPath === "string" ? params.configPath : "";
      const raw = typeof params?.raw === "string" ? params.raw : "";
      if (!configPath) {
        return {
          status: 400,
          body: {
            error: "configPath is required",
          },
        };
      }

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, raw, "utf8");
      return {
        status: 200,
        body: {
          configPath,
          success: true,
        },
      };
    }
    case "locale-info":
      {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        return {
          status: 200,
          body: {
            ideLocale: locale,
            systemLocale: locale,
          },
        };
      }
    case "mcp-codex-config":
      return {
        status: 200,
        body: {
          config: {},
        },
      };
    case "openai-api-key":
      return {
        status: 200,
        body: {
          value: process.env.OPENAI_API_KEY ?? null,
        },
      };
    case "os-info":
      return {
        status: 200,
        body: {
          platform: process.platform,
          hasWsl: false,
          isVsCodeRunningInsideWsl: false,
        },
      };
    case "paths-exist": {
      const inputPaths = Array.isArray(params?.paths)
        ? params.paths.filter((value): value is string => typeof value === "string")
        : [];
      const results = await Promise.all(
        inputPaths.map(async (targetPath) => {
          try {
            await fs.access(targetPath);
            return true;
          } catch {
            return false;
          }
        }),
      );
      return {
        status: 200,
        body: {
          existingPaths: inputPaths.filter((_, index) => results[index]),
        },
      };
    }
    case "read-file": {
      const filePath = typeof params?.path === "string" ? params.path : "";
      if (!filePath) {
        return { status: 400, body: { error: "path is required" } };
      }

      const content = await fs.readFile(filePath, "utf8");
      return {
        status: 200,
        body: {
          contents: content,
        },
      };
    }
    case "read-file-binary":
    case "read-git-file-binary": {
      const filePath = typeof params?.path === "string" ? params.path : "";
      if (!filePath) {
        return { status: 400, body: { error: "path is required" } };
      }

      const content = await fs.readFile(filePath);
      return {
        status: 200,
        body: {
          contentsBase64: content.toString("base64"),
        },
      };
    }
    case "set-pinned-threads-order": {
      const ids = Array.isArray(params?.threadIds)
        ? params.threadIds.filter((value): value is string => typeof value === "string")
        : [];
      context.state.setGlobalState("pinned-thread-ids", ids);
      return {
        status: 200,
        body: {
          success: true,
        },
      };
    }
    case "set-global-state": {
      const key = typeof params?.key === "string" ? params.key : "";
      if (!key) {
        return {
          status: 400,
          body: {
            error: "key is required",
          },
        };
      }

      context.state.setGlobalState(key, params?.value);
      return {
        status: 200,
        body: {
          success: true,
        },
      };
    }
    case "set-configuration": {
      const key = typeof params?.key === "string" ? params.key : "";
      if (!key) {
        return {
          status: 400,
          body: {
            error: "key is required",
          },
        };
      }

      context.state.setConfiguration(key, params?.value);
      return {
        status: 200,
        body: {
          success: true,
        },
      };
    }
    case "set-thread-pinned": {
      const threadId = typeof params?.threadId === "string" ? params.threadId : "";
      const pinned = Boolean(params?.pinned);
      const current = context.state.getGlobalState("pinned-thread-ids");
      const currentIds = Array.isArray(current)
        ? current.filter((value): value is string => typeof value === "string")
        : [];

      const nextIds = currentIds.filter((value) => value !== threadId);
      if (threadId && pinned) {
        nextIds.unshift(threadId);
      }

      context.state.setGlobalState("pinned-thread-ids", nextIds);
      return {
        status: 200,
        body: {
          success: true,
        },
      };
    }
    case "thread-terminal-snapshot":
      return {
        status: 200,
        body: {
          session: null,
        },
      };
    case "workspace-directory-entries":
    case "remote-workspace-directory-entries": {
      const targetDir =
        typeof params?.path === "string" && params.path.length > 0
          ? params.path
          : context.workspaceRoot;
      return {
        status: 200,
        body: {
          entries: await listDirectoryEntries(targetDir),
        },
      };
    }
    case "workspace-root-options":
      return {
        status: 200,
        body: {
          roots: getWorkspaceRoots(context.workspaceRoot),
        },
      };
    case "set-vs-context":
      return {
        status: 200,
        body: {
          success: true,
        },
      };
    case "is-copilot-api-available":
      return {
        status: 200,
        body: {
          available: false,
        },
      };
    default:
      return {
        status: 200,
        body: {},
      };
  }
}
