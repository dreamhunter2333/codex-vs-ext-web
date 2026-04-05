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

export function resolveCodexBinary(): string {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error(
      `暂时只支持 darwin-arm64，当前环境是 ${process.platform}-${process.arch}`,
    );
  }

  return path.join(vendorRoot, "bin", "macos-aarch64", "codex");
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
