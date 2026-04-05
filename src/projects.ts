import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";

import { codexHome, normalizeWorkspacePath, repoRoot } from "./config.js";

const sessionRoot = path.join(codexHome, "sessions");
const maxRecentSessionFiles = 200;
const maxProbeBytes = 8192;

export type ProjectInfo = {
  hasGit: boolean;
  lastUsedAt: number;
  name: string;
  path: string;
  sessionCount: number;
  source: "current" | "session";
};

type SessionFileInfo = {
  mtimeMs: number;
  path: string;
  size: number;
};

type ProjectAggregate = {
  hasGit: boolean;
  lastUsedAt: number;
  path: string;
  sessionCount: number;
  source: "current" | "session";
};

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function collectSessionFiles(rootPath: string): Promise<SessionFileInfo[]> {
  const queue = [rootPath];
  const files: SessionFileInfo[] = [];

  while (queue.length > 0) {
    const currentPath = queue.pop();
    if (!currentPath) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
        continue;
      }

      try {
        const stat = await fs.stat(entryPath);
        files.push({
          mtimeMs: stat.mtimeMs,
          path: entryPath,
          size: stat.size,
        });
      } catch {
        continue;
      }
    }
  }

  files.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return files.slice(0, maxRecentSessionFiles);
}

async function readSessionProjectPath(file: SessionFileInfo): Promise<string | null> {
  let handle: FileHandle | null = null;

  try {
    handle = await fs.open(file.path, "r");
    const buffer = Buffer.alloc(Math.min(file.size, maxProbeBytes));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead === 0) {
      return null;
    }

    const head = buffer.toString("utf8", 0, bytesRead);
    const lines = head.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmedLine) as {
          cwd?: unknown;
          payload?: { cwd?: unknown };
          type?: unknown;
        };
        const cwd =
          typeof parsed.payload?.cwd === "string"
            ? parsed.payload.cwd
            : typeof parsed.cwd === "string"
              ? parsed.cwd
              : null;
        if (!cwd) {
          continue;
        }

        return normalizeWorkspacePath(cwd);
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

async function hasGitMetadata(projectPath: string): Promise<boolean> {
  return exists(path.join(projectPath, ".git"));
}

function toProjectInfo(project: ProjectAggregate): ProjectInfo {
  return {
    hasGit: project.hasGit,
    lastUsedAt: project.lastUsedAt,
    name: path.basename(project.path) || project.path,
    path: project.path,
    sessionCount: project.sessionCount,
    source: project.source,
  };
}

export async function discoverProjects(): Promise<ProjectInfo[]> {
  const aggregates = new Map<string, ProjectAggregate>();
  const currentProjectPath = normalizeWorkspacePath(repoRoot);

  aggregates.set(currentProjectPath, {
    hasGit: await hasGitMetadata(currentProjectPath),
    lastUsedAt: Date.now(),
    path: currentProjectPath,
    sessionCount: 0,
    source: "current",
  });

  if (!(await isDirectory(sessionRoot))) {
    return Array.from(aggregates.values()).map(toProjectInfo);
  }

  const sessionFiles = await collectSessionFiles(sessionRoot);
  for (const file of sessionFiles) {
    const projectPath = await readSessionProjectPath(file);
    if (!projectPath || !(await isDirectory(projectPath))) {
      continue;
    }

    const existing = aggregates.get(projectPath);
    if (!existing) {
      aggregates.set(projectPath, {
        hasGit: await hasGitMetadata(projectPath),
        lastUsedAt: file.mtimeMs,
        path: projectPath,
        sessionCount: 1,
        source: projectPath === currentProjectPath ? "current" : "session",
      });
      continue;
    }

    existing.lastUsedAt = Math.max(existing.lastUsedAt, file.mtimeMs);
    existing.sessionCount += 1;
  }

  return Array.from(aggregates.values())
    .sort((left, right) => {
      if (left.source !== right.source) {
        return left.source === "current" ? -1 : 1;
      }

      if (left.lastUsedAt !== right.lastUsedAt) {
        return right.lastUsedAt - left.lastUsedAt;
      }

      return left.path.localeCompare(right.path);
    })
    .map(toProjectInfo);
}
