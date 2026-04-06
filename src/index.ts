import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import express from "express";
import WebSocket, { WebSocketServer } from "ws";

import { CodexAppServerBridge } from "./app-server.js";
import {
  bridgePath,
  defaultHostId,
  defaultPort,
  getDefaultHostConfig,
  normalizeWorkspacePath,
  repoRoot,
  vendorRoot,
  webviewRoot,
} from "./config.js";
import { handleFetchRoute } from "./fetch-routes.js";
import { renderAppHtml, renderProjectPage } from "./html.js";
import { renderManifest, renderServiceWorker } from "./pwa.js";
import { discoverProjects } from "./projects.js";
import { buildInjectedShim } from "./shim.js";
import { HostStateStore } from "./state.js";

const execFileAsync = promisify(execFile);

type BrowserMessage = Record<string, unknown> & {
  type?: string;
};

type ClientSession = {
  id: string;
  projectPath: string;
  socket: WebSocket;
};

type PendingMcpRequest = {
  clientId: string;
  method: string;
  projectPath: string;
};

const IPC_MESSAGE_VERSIONS = new Map<string, number>([
  ["thread-stream-state-changed", 5],
  ["thread-archived", 2],
  ["thread-unarchived", 1],
  ["thread-queued-followups-changed", 1],
]);

const app = express();
const serverState = new HostStateStore();
const appServerBridge = new CodexAppServerBridge();
const sessions = new Map<string, ClientSession>();
const pendingMcpRequests = new Map<string, PendingMcpRequest>();
const threadProjectPaths = new Map<string, string>();

serverState.setSharedObject("remote_connections", []);

function getSession(clientId: string): ClientSession | null {
  return sessions.get(clientId) ?? null;
}

function getSessionProjectPath(clientId: string): string {
  return getSession(clientId)?.projectPath ?? repoRoot;
}

function getSessionScopeKey(clientId: string): string {
  return getSessionProjectPath(clientId);
}

function normalizeThreadProjectPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return normalizeWorkspacePath(value);
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function cacheThreadProjectPath(threadId: unknown, projectPath: unknown): void {
  if (typeof threadId !== "string" || !threadId) {
    return;
  }

  const normalizedProjectPath = normalizeThreadProjectPath(projectPath);
  if (!normalizedProjectPath) {
    return;
  }

  threadProjectPaths.set(threadId, normalizedProjectPath);
}

function cacheThreadProjectPathFromThread(thread: unknown): void {
  const record = getRecord(thread);
  if (!record) {
    return;
  }

  cacheThreadProjectPath(record.id, record.cwd);
}

function cacheThreadProjectPathsFromThreadList(threads: unknown): void {
  if (!Array.isArray(threads)) {
    return;
  }

  for (const thread of threads) {
    cacheThreadProjectPathFromThread(thread);
  }
}

function cacheThreadProjectPathsFromResult(method: string, result: unknown): void {
  const record = getRecord(result);
  if (!record) {
    return;
  }

  switch (method) {
    case "thread/list":
      cacheThreadProjectPathsFromThreadList(record.data);
      return;
    case "thread/read":
    case "thread/start":
    case "thread/resume":
    case "thread/fork":
      cacheThreadProjectPathFromThread(record.thread);
      return;
    case "getConversationSummary": {
      const summary = getRecord(record.summary);
      if (!summary) {
        return;
      }

      cacheThreadProjectPath(summary.conversationId, summary.cwd);
      return;
    }
    default:
      return;
  }
}

function applyProjectScopedMcpRequest(
  clientId: string,
  request: Record<string, unknown>,
): Record<string, unknown> {
  if (request.method !== "thread/list") {
    return request;
  }

  const projectPath = getSessionProjectPath(clientId);
  const params = getRecord(request.params);
  if (params?.cwd === projectPath) {
    return request;
  }

  return {
    ...request,
    params: {
      ...(params ?? {}),
      cwd: projectPath,
    },
  };
}

function filterThreadListResultForProject(
  result: unknown,
  projectPath: string,
): Record<string, unknown> | null {
  const record = getRecord(result);
  if (!record || !Array.isArray(record.data)) {
    return null;
  }

  return {
    ...record,
    data: record.data.filter((thread) => {
      const threadRecord = getRecord(thread);
      if (!threadRecord) {
        return false;
      }

      return normalizeThreadProjectPath(threadRecord.cwd) === projectPath;
    }),
  };
}

function filterProjectScopedMcpResponse(
  method: string,
  projectPath: string,
  message: Record<string, unknown>,
): Record<string, unknown> {
  if (method !== "thread/list") {
    return message;
  }

  const nextResult = filterThreadListResultForProject(message.result, projectPath);
  if (!nextResult) {
    return message;
  }

  return {
    ...message,
    result: nextResult,
  };
}

function getThreadProjectPathForNotification(
  method: string,
  params: unknown,
): string | null {
  if (method === "thread/started") {
    const record = getRecord(params);
    const thread = record?.thread;
    cacheThreadProjectPathFromThread(thread);
    const threadRecord = getRecord(thread);
    return normalizeThreadProjectPath(threadRecord?.cwd);
  }

  if (
    method === "thread/status/changed" ||
    method === "thread/archived" ||
    method === "thread/unarchived" ||
    method === "thread/closed" ||
    method === "thread/name/updated" ||
    method === "thread/tokenUsage/updated"
  ) {
    const record = getRecord(params);
    const threadId = typeof record?.threadId === "string" ? record.threadId : null;
    if (!threadId) {
      return null;
    }

    return threadProjectPaths.get(threadId) ?? null;
  }

  return null;
}

function sendToClient(clientId: string, message: Record<string, unknown>): void {
  const session = getSession(clientId);
  if (!session) {
    return;
  }

  if (session.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  session.socket.send(JSON.stringify(message));
}

function broadcast(message: Record<string, unknown>): void {
  for (const clientId of sessions.keys()) {
    sendToClient(clientId, message);
  }
}

function broadcastToProject(
  projectPath: string,
  message: Record<string, unknown>,
  excludeClientId?: string,
): void {
  for (const [clientId, session] of sessions.entries()) {
    if (session.projectPath !== projectPath) {
      continue;
    }

    if (excludeClientId && clientId === excludeClientId) {
      continue;
    }

    sendToClient(clientId, message);
  }
}

function getIpcMessageVersion(method: string): number {
  return IPC_MESSAGE_VERSIONS.get(method) ?? 0;
}

function buildSessionHostConfig(clientId: string): Record<string, unknown> {
  return getDefaultHostConfig(getSessionProjectPath(clientId));
}

function sendAppServerState(clientId: string): void {
  const state = appServerBridge.getConnectionState();
  sendToClient(clientId, {
    type: "codex-app-server-connection-changed",
    hostId: defaultHostId,
    state,
    mostRecentErrorMessage: appServerBridge.getErrorMessage(),
    transport: "websocket",
  });

  if (state !== "connected") {
    return;
  }

  sendToClient(clientId, {
    type: "codex-app-server-initialized",
    hostId: defaultHostId,
  });
}

function broadcastClientStatusChanged(
  projectPath: string,
  clientId: string,
  status: "connected" | "disconnected",
): void {
  broadcastToProject(
    projectPath,
    {
      type: "ipc-broadcast",
      method: "client-status-changed",
      sourceClientId: clientId,
      version: getIpcMessageVersion("client-status-changed"),
      params: {
        clientId,
        clientType: "vscode",
        status,
      },
    },
    clientId,
  );
}

function broadcastIpcMessage(
  clientId: string,
  method: string,
  params: Record<string, unknown>,
): void {
  const projectPath = getSessionProjectPath(clientId);
  broadcastToProject(
    projectPath,
    {
      type: "ipc-broadcast",
      method,
      sourceClientId: clientId,
      version: getIpcMessageVersion(method),
      params,
    },
    clientId,
  );
}

function broadcastSharedObjectUpdate(key: string): void {
  const message = {
    type: "shared-object-updated",
    key,
    value: serverState.getSharedObject(key),
  };

  const subscribers = serverState.getSharedObjectSubscribers(key);
  if (subscribers.size === 0) {
    broadcast(message);
    return;
  }

  for (const clientId of subscribers) {
    sendToClient(clientId, message);
  }
}

function sendBootstrapState(clientId: string): void {
  sendToClient(clientId, {
    type: "shared-object-updated",
    key: "host_config",
    value: buildSessionHostConfig(clientId),
  });
  sendToClient(clientId, {
    type: "shared-object-updated",
    key: "remote_connections",
    value: serverState.getSharedObject("remote_connections"),
  });
  sendAppServerState(clientId);
}

function broadcastPersistedAtomUpdate(
  scopeKey: string,
  message: Record<string, unknown>,
): void {
  for (const [clientId, session] of sessions.entries()) {
    if (session.projectPath !== scopeKey) {
      continue;
    }

    sendToClient(clientId, message);
  }
}

function buildFetchSuccess(
  requestId: string,
  status: number,
  headers: Record<string, string>,
  body: unknown,
): Record<string, unknown> {
  return {
    type: "fetch-response",
    requestId,
    responseType: "success",
    status,
    headers,
    bodyJsonString: JSON.stringify(body),
  };
}

function buildFetchError(
  requestId: string,
  status: number,
  error: string,
): Record<string, unknown> {
  return {
    type: "fetch-response",
    requestId,
    responseType: "error",
    status,
    error,
  };
}

function getUrlSearchParam(rawUrl: string | undefined, key: string): string | null {
  if (!rawUrl || !key) {
    return null;
  }

  try {
    const url = new URL(rawUrl, "http://127.0.0.1");
    const value = url.searchParams.get(key);
    if (!value) {
      return null;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    return trimmedValue;
  } catch {
    return null;
  }
}

function encodeProjectParam(projectPath: string): string {
  return Buffer.from(projectPath, "utf8").toString("base64");
}

function decodeProjectParam(input: string): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return "";
  }

  try {
    return Buffer.from(trimmedInput, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function buildInitialRoute(sessionId: string | null): string | null {
  if (!sessionId) {
    return null;
  }

  return `/local/${encodeURIComponent(sessionId)}`;
}

async function resolveProjectPath(input: unknown): Promise<string> {
  if (typeof input !== "string" || !input.trim()) {
    return repoRoot;
  }

  const resolvedPath = normalizeWorkspacePath(decodeProjectParam(input));
  try {
    const stat = await fs.stat(resolvedPath);
    if (stat.isDirectory()) {
      return resolvedPath;
    }
  } catch {
    return repoRoot;
  }

  return repoRoot;
}

async function openInBrowser(url: string): Promise<void> {
  if (!url) {
    return;
  }

  if (process.platform === "darwin") {
    await execFileAsync("open", [url]);
    return;
  }

  if (process.platform === "linux") {
    await execFileAsync("xdg-open", [url]);
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", url]);
  }
}

async function proxyExternalFetch(message: BrowserMessage): Promise<{
  body: unknown;
  headers: Record<string, string>;
  status: number;
}> {
  const rawUrl = typeof message.url === "string" ? message.url : "";
  const url = rawUrl.startsWith("/")
    ? new URL(rawUrl, `http://127.0.0.1:${defaultPort}`).toString()
    : rawUrl;
  const method = typeof message.method === "string" ? message.method : "GET";
  const requestHeaders =
    message.headers && typeof message.headers === "object"
      ? { ...(message.headers as Record<string, string>) }
      : {};

  let body: BodyInit | undefined;
  if (typeof message.body === "string") {
    if (requestHeaders["x-codex-base64"] === "1") {
      body = Buffer.from(message.body, "base64");
      delete requestHeaders["x-codex-base64"];
    } else {
      body = message.body;
    }
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body,
  });
  const responseHeaders = Object.fromEntries(response.headers.entries());
  if (response.status === 204) {
    return {
      body: null,
      headers: responseHeaders,
      status: response.status,
    };
  }

  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      body: text,
      headers: responseHeaders,
      status: response.status,
    };
  }

  try {
    return {
      body: JSON.parse(text),
      headers: responseHeaders,
      status: response.status,
    };
  } catch {
    return {
      body: text,
      headers: responseHeaders,
      status: response.status,
    };
  }
}

async function handleBrowserMessage(clientId: string, message: BrowserMessage): Promise<void> {
  const type = typeof message.type === "string" ? message.type : "";
  if (!type) {
    return;
  }

  switch (type) {
    case "ready":
    case "view-focused":
      return;
    case "log-message":
      console.log("[webview]", message.level ?? "info", message.message ?? "");
      return;
    case "persisted-atom-sync-request":
      sendToClient(clientId, {
        type: "persisted-atom-sync",
        state: serverState.getPersistedAtomState(getSessionScopeKey(clientId)),
      });
      return;
    case "persisted-atom-update": {
      const key = typeof message.key === "string" ? message.key : "";
      const deleted = Boolean(message.deleted);
      const scopeKey = getSessionScopeKey(clientId);
      serverState.setPersistedAtom(scopeKey, key, message.value, deleted);
      broadcastPersistedAtomUpdate(scopeKey, {
        type: "persisted-atom-updated",
        key,
        value: message.value,
        deleted,
      });
      return;
    }
    case "shared-object-subscribe": {
      const key = typeof message.key === "string" ? message.key : "";
      if (!key) {
        return;
      }

      serverState.subscribeSharedObject(clientId, key);
      if (key === "host_config") {
        sendToClient(clientId, {
          type: "shared-object-updated",
          key,
          value: buildSessionHostConfig(clientId),
        });
        return;
      }

      sendToClient(clientId, {
        type: "shared-object-updated",
        key,
        value: serverState.getSharedObject(key),
      });
      return;
    }
    case "shared-object-unsubscribe": {
      const key = typeof message.key === "string" ? message.key : "";
      if (!key) {
        return;
      }

      serverState.unsubscribeSharedObject(clientId, key);
      return;
    }
    case "shared-object-set": {
      const key = typeof message.key === "string" ? message.key : "";
      if (!key || key === "host_config") {
        return;
      }

      serverState.setSharedObject(key, message.value);
      broadcastSharedObjectUpdate(key);
      return;
    }
    case "fetch": {
      const requestId = typeof message.requestId === "string" ? message.requestId : "";
      const url = typeof message.url === "string" ? message.url : "";
      if (!requestId || !url) {
        return;
      }

      try {
        const response = url.startsWith("vscode://codex/")
          ? await handleFetchRoute(
              url.replace(/^vscode:\/\/codex\//, ""),
              typeof message.body === "string" ? message.body : undefined,
              {
                bridge: appServerBridge,
                state: serverState,
                workspaceRoot: getSessionProjectPath(clientId),
              },
            )
          : await proxyExternalFetch(message);
        sendToClient(
          clientId,
          buildFetchSuccess(
            requestId,
            response.status,
            response.headers ?? { "content-type": "application/json" },
            response.body,
          ),
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[fetch] failed", {
          clientId,
          error: errorMessage,
          url,
        });
        sendToClient(clientId, buildFetchError(requestId, 500, errorMessage));
      }
      return;
    }
    case "cancel-fetch":
    case "cancel-fetch-stream":
    case "worker-request":
    case "worker-request-cancel":
    case "heartbeat-automation-thread-state-changed":
      return;
    case "fetch-stream": {
      const requestId = typeof message.requestId === "string" ? message.requestId : "";
      if (!requestId) {
        return;
      }

      sendToClient(clientId, {
        type: "fetch-stream-error",
        requestId,
        error: "Streaming host fetch is not implemented yet.",
        status: 501,
      });
      return;
    }
    case "mcp-request":
      if (message.request && typeof message.request === "object") {
        const request = applyProjectScopedMcpRequest(
          clientId,
          message.request as Record<string, unknown>,
        );
        const requestId = String(request.id ?? "");
        const method = typeof request.method === "string" ? request.method : "";
        if (requestId && method) {
          pendingMcpRequests.set(requestId, {
            clientId,
            method,
            projectPath: getSessionProjectPath(clientId),
          });
        }

        await appServerBridge.sendRequest(request);
      }
      return;
    case "mcp-response":
      if (message.response && typeof message.response === "object") {
        await appServerBridge.sendResponse(message.response as Record<string, unknown>);
      }
      return;
    case "open-in-browser": {
      const url = typeof message.url === "string" ? message.url : "";
      await openInBrowser(url);
      return;
    }
    case "codex-app-server-restart":
      try {
        await appServerBridge.ensureReady();
      } catch (error) {
        console.error("[codex-app-server] restart failed:", error);
      }
      sendAppServerState(clientId);
      return;
    case "thread-stream-state-changed": {
      const conversationId =
        typeof message.conversationId === "string" ? message.conversationId : "";
      const change =
        message.change && typeof message.change === "object"
          ? (message.change as Record<string, unknown>)
          : null;
      if (!conversationId || !change) {
        return;
      }

      broadcastIpcMessage(clientId, type, {
        conversationId,
        change,
      });
      return;
    }
    case "thread-archived": {
      const hostId = typeof message.hostId === "string" ? message.hostId : defaultHostId;
      const conversationId =
        typeof message.conversationId === "string" ? message.conversationId : "";
      const cwd = typeof message.cwd === "string" ? message.cwd : getSessionProjectPath(clientId);
      if (!conversationId) {
        return;
      }

      broadcastIpcMessage(clientId, type, {
        hostId,
        conversationId,
        cwd,
      });
      return;
    }
    case "thread-unarchived": {
      const hostId = typeof message.hostId === "string" ? message.hostId : defaultHostId;
      const conversationId =
        typeof message.conversationId === "string" ? message.conversationId : "";
      if (!conversationId) {
        return;
      }

      broadcastIpcMessage(clientId, type, {
        hostId,
        conversationId,
      });
      return;
    }
    case "thread-queued-followups-changed": {
      const conversationId =
        typeof message.conversationId === "string" ? message.conversationId : "";
      const messages = Array.isArray(message.messages) ? message.messages : [];
      if (!conversationId) {
        return;
      }

      broadcastIpcMessage(clientId, type, {
        conversationId,
        messages,
      });
      return;
    }
    case "terminal-create":
    case "terminal-write":
    case "terminal-resize":
    case "terminal-close":
    case "terminal-attach":
    case "show-settings":
    case "open-extension-settings":
    case "open-config-toml":
    case "open-vscode-command":
    case "show-diff":
    case "set-telemetry-user":
      return;
    default:
      console.log("[bridge] unhandled message type:", type);
  }
}

appServerBridge.on("response", (message) => {
  const responseId = String(message.id ?? "");
  let targetClientId: string | null = null;
  let targetProjectPath: string | null = null;
  let method = "";
  if (responseId) {
    const pendingRequest = pendingMcpRequests.get(responseId) ?? null;
    pendingMcpRequests.delete(responseId);
    method = pendingRequest?.method ?? "";
    targetClientId = pendingRequest?.clientId ?? null;
    targetProjectPath = pendingRequest?.projectPath ?? null;
    if (message.error) {
      console.error("[mcp] response error", {
        id: responseId,
        method,
        error: message.error,
      });
    }
  }

  if (method) {
    cacheThreadProjectPathsFromResult(method, message.result);
  }

  const scopedMessage =
    method && targetProjectPath
      ? filterProjectScopedMcpResponse(
          method,
          targetProjectPath,
          message as Record<string, unknown>,
        )
      : message;

  const responseMessage = {
    type: "mcp-response",
    hostId: defaultHostId,
    message: scopedMessage,
  };

  if (!targetClientId) {
    broadcast(responseMessage);
    return;
  }

  sendToClient(targetClientId, responseMessage);
});

appServerBridge.on("notification", (message) => {
  const method = typeof message.method === "string" ? message.method : "";
  const notificationMessage = {
    type: "mcp-notification",
    hostId: defaultHostId,
    method,
    params: message.params,
  };
  const projectPath = getThreadProjectPathForNotification(method, message.params);
  if (projectPath) {
    broadcastToProject(projectPath, notificationMessage);
    return;
  }

  broadcast(notificationMessage);
});

appServerBridge.on("request", (message) => {
  broadcast({
    type: "mcp-request",
    hostId: defaultHostId,
    request: message,
  });
});

appServerBridge.on("state", (state, errorMessage) => {
  broadcast({
    type: "codex-app-server-connection-changed",
    hostId: defaultHostId,
    state,
    mostRecentErrorMessage: errorMessage,
    transport: "websocket",
  });

  if (state === "connected") {
    broadcast({
      type: "codex-app-server-initialized",
      hostId: defaultHostId,
    });
  }
});

app.use(express.json());
app.use("/resources", express.static(path.join(vendorRoot, "resources"), { fallthrough: false }));
app.use("/webview", express.static(webviewRoot, { fallthrough: false }));
app.use("/static", express.static(path.join(repoRoot, "static"), { fallthrough: false }));

app.get("/sw.js", (_request, response) => {
  response.type("application/javascript").send(renderServiceWorker());
});

app.get("/manifest.json", (_request, response) => {
  response.json(renderManifest());
});

app.get(/^\/apple-touch-icon.*\.png$/, (_request, response) => {
  response.sendFile(path.join(repoRoot, "static", "pwa", "apple-touch-icon.png"));
});

app.get("/", async (_request, response) => {
  const projects = await discoverProjects();
  response.type("html").send(renderProjectPage(projects));
});

app.get("/app", async (request, response) => {
  const projectPath = await resolveProjectPath(request.query.project);
  const sessionId =
    typeof request.query.session === "string" && request.query.session.trim()
      ? request.query.session.trim()
      : null;
  const rawHtml = await fs.readFile(path.join(webviewRoot, "index.html"), "utf8");
  response
    .type("html")
    .send(
      renderAppHtml(
        rawHtml,
        projectPath,
        buildInjectedShim(projectPath),
        buildInitialRoute(sessionId),
      ),
    );
});

app.get("/favicon.ico", (_request, response) => {
  response.sendFile(path.join(repoRoot, "static", "pwa", "icon-192.png"));
});

app.get("/healthz", (_request, response) => {
  response.json({
    ok: true,
    cwd: repoRoot,
    appServerState: appServerBridge.getConnectionState(),
    sessions: sessions.size,
  });
});

app.get("/wham/accounts/check", (_request, response) => {
  response.json({
    account_ordering: [],
    accounts: {},
  });
});

const httpServer = app.listen(defaultPort, () => {
  console.log(`codex-vs-ext-web listening on http://127.0.0.1:${defaultPort}`);
});

const wss = new WebSocketServer({
  server: httpServer,
  path: bridgePath,
});

wss.on("connection", async (socket, request) => {
  const clientId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const encodedProject = getUrlSearchParam(request.url, "project");
  const projectPath = await resolveProjectPath(encodedProject);
  sessions.set(clientId, { id: clientId, projectPath, socket });
  broadcastClientStatusChanged(projectPath, clientId, "connected");

  socket.on("message", async (chunk) => {
    try {
      const message = JSON.parse(String(chunk)) as BrowserMessage;
      await handleBrowserMessage(clientId, message);
    } catch (error) {
      console.error("[bridge] message handling failed:", error);
    }
  });

  socket.on("close", () => {
    broadcastClientStatusChanged(projectPath, clientId, "disconnected");
    serverState.removeClient(clientId);
    sessions.delete(clientId);
  });

  sendBootstrapState(clientId);
});

void appServerBridge.ensureReady().catch((error) => {
  console.error("[codex-app-server] startup failed:", error);
});

process.on("SIGINT", () => {
  httpServer.close();
  process.exit(0);
});
