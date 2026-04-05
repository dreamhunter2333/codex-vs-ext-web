import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

export const repoRoot = path.resolve(currentDir, "..");
export const vendorRoot = path.join(repoRoot, "vendor", "codex");
export const webviewRoot = path.join(vendorRoot, "webview");
export const defaultPort = Number(process.env.PORT ?? 4187);
export const defaultAppServerPort = Number(
  process.env.CODEX_APP_SERVER_PORT ?? 4188,
);
export const bridgePath = "/__codex_bridge";
export const defaultHostId = "local";
export const appName = "codex-vs-ext-web";
export const appVersion = "0.1.0";
export const codexHome = path.join(os.homedir(), ".codex");

export function normalizeWorkspacePath(workspacePath?: string): string {
  if (!workspacePath) {
    return repoRoot;
  }

  return path.resolve(workspacePath);
}

function getVendorCodexCandidates(): string[] {
  const executableName = process.platform === "win32" ? "codex.exe" : "codex";

  if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      return [
        path.join(vendorRoot, "bin", "macos-aarch64", executableName),
        path.join(vendorRoot, "bin", "darwin-arm64", executableName),
      ];
    }

    if (process.arch === "x64") {
      return [
        path.join(vendorRoot, "bin", "macos-x86_64", executableName),
        path.join(vendorRoot, "bin", "macos-x64", executableName),
        path.join(vendorRoot, "bin", "darwin-x64", executableName),
      ];
    }
  }

  if (process.platform === "linux") {
    if (process.arch === "arm64") {
      return [
        path.join(vendorRoot, "bin", "linux-aarch64", executableName),
        path.join(vendorRoot, "bin", "linux-arm64", executableName),
      ];
    }

    if (process.arch === "x64") {
      return [
        path.join(vendorRoot, "bin", "linux-x86_64", executableName),
        path.join(vendorRoot, "bin", "linux-x64", executableName),
      ];
    }
  }

  if (process.platform === "win32") {
    if (process.arch === "arm64") {
      return [
        path.join(vendorRoot, "bin", "windows-aarch64", executableName),
        path.join(vendorRoot, "bin", "windows-arm64", executableName),
      ];
    }

    if (process.arch === "x64") {
      return [
        path.join(vendorRoot, "bin", "windows-x86_64", executableName),
        path.join(vendorRoot, "bin", "windows-x64", executableName),
      ];
    }
  }

  return [
    path.join(vendorRoot, "bin", executableName),
  ];
}

function isRunnableCodexBinary(binaryPath: string): boolean {
  if (!existsSync(binaryPath)) {
    return false;
  }

  try {
    execFileSync(binaryPath, ["--version"], {
      timeout: 5000,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function resolveSystemCodexBinary(): string {
  const envBinary = process.env.CODEX_CLI_PATH?.trim();
  if (envBinary) {
    return envBinary;
  }

  try {
    if (process.platform === "win32") {
      const systemPath = execSync("where.exe codex", {
        timeout: 5000,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
        .split(/\r?\n/)
        .map((value) => value.trim())
        .find(Boolean);
      return systemPath ?? "codex.exe";
    }

    const systemPath = execSync("command -v codex", {
      timeout: 5000,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: "/bin/zsh",
    }).trim();
    return systemPath || "codex";
  } catch {
    return process.platform === "win32" ? "codex.exe" : "codex";
  }
}

export function resolveCodexBinary(): string {
  for (const candidate of getVendorCodexCandidates()) {
    if (isRunnableCodexBinary(candidate)) {
      return candidate;
    }
  }

  return resolveSystemCodexBinary();
}

export function getWorkspaceRoots(workspacePath?: string): string[] {
  return [normalizeWorkspacePath(workspacePath)];
}

export function getDefaultHostConfig(workspacePath?: string): Record<string, unknown> {
  const resolvedWorkspacePath = normalizeWorkspacePath(workspacePath);

  return {
    id: defaultHostId,
    display_name: "Local",
    kind: "local",
    default_workspaces: getWorkspaceRoots(resolvedWorkspacePath).map((currentWorkspacePath) => ({
      name: path.basename(currentWorkspacePath),
      path: currentWorkspacePath,
    })),
    home_dir: os.homedir(),
    websocket_url: `ws://127.0.0.1:${defaultAppServerPort}`,
  };
}
