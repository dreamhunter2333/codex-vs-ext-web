import { EventEmitter } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import WebSocket from "ws";

import {
  appName,
  appVersion,
  defaultAppServerPort,
  resolveCodexBinary,
  repoRoot,
} from "./config.js";

type ConnectionState = "connecting" | "connected" | "disconnected";

type AppServerMessage =
  | { id?: string | number; method?: string; params?: unknown; result?: unknown; error?: unknown }
  | Record<string, unknown>;

export class CodexAppServerBridge extends EventEmitter<{
  response: [AppServerMessage];
  notification: [AppServerMessage];
  request: [AppServerMessage];
  state: [ConnectionState, string | null];
}> {
  private child: ChildProcessWithoutNullStreams | null = null;
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private ready = false;
  private state: ConnectionState = "disconnected";
  private errorMessage: string | null = null;
  private initializeRequestId = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttemptCount = 0;

  getConnectionState(): ConnectionState {
    return this.state;
  }

  getErrorMessage(): string | null {
    return this.errorMessage;
  }

  async ensureReady(): Promise<void> {
    if (this.ready && this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.startInternal();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async sendRequest(request: Record<string, unknown>): Promise<void> {
    await this.ensureReady();
    this.sendRaw(request);
  }

  async sendResponse(response: Record<string, unknown>): Promise<void> {
    await this.ensureReady();
    this.sendRaw(response);
  }

  private async startInternal(): Promise<void> {
    this.setState("connecting", null);
    this.spawnProcessIfNeeded();
    await this.openSocket();
    await this.initialize();
    this.ready = true;
    this.reconnectAttemptCount = 0;
    this.setState("connected", null);
  }

  private spawnProcessIfNeeded(): void {
    if (this.child && !this.child.killed) {
      return;
    }

    const binary = resolveCodexBinary();
    const listenUrl = `ws://127.0.0.1:${defaultAppServerPort}`;
    const child = spawn(
      binary,
      [
        "app-server",
        "--listen",
        listenUrl,
        "--analytics-default-enabled",
      ],
      {
        cwd: repoRoot,
        env: process.env,
        stdio: "pipe",
      },
    );

    child.stdout.on("data", (chunk) => {
      const output = String(chunk).trim();
      if (!output) {
        return;
      }

      console.log("[codex-app-server]", output);
    });

    child.stderr.on("data", (chunk) => {
      const output = String(chunk).trim();
      if (!output) {
        return;
      }

      console.error("[codex-app-server]", output);
    });

    child.on("exit", (code, signal) => {
      this.child = null;
      this.handleUnexpectedDisconnect(
        `app-server exited with code=${code ?? "null"} signal=${signal ?? "null"}`,
      );
    });

    this.child = child;
  }

  private async openSocket(): Promise<void> {
    const url = `ws://127.0.0.1:${defaultAppServerPort}`;
    const maxAttempts = 50;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const socket = await this.tryOpenSocket(url);
        this.socket = socket;
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });
      }
    }
  }

  private tryOpenSocket(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const noopErrorHandler = (): void => {};

      const onOpen = (): void => {
        cleanup();
        socket.on("message", (chunk) => {
          this.handleSocketMessage(String(chunk));
        });
        socket.on("close", () => {
          this.handleUnexpectedDisconnect("app-server websocket closed");
        });
        socket.on("error", (error) => {
          this.ready = false;
          this.errorMessage = error.message;
        });
        resolve(socket);
      };

      const onError = (error: Error): void => {
        cleanup();
        try {
          socket.close();
        } catch {
          // ignore close failures during retry.
        }
        reject(error);
      };

      const cleanup = (): void => {
        socket.off("open", onOpen);
        socket.off("error", onError);
      };

      socket.on("error", noopErrorHandler);
      socket.once("open", onOpen);
      socket.once("error", onError);
    });
  }

  private async initialize(): Promise<void> {
    const requestId = String(++this.initializeRequestId);
    await new Promise<void>((resolve, reject) => {
      const handleResponse = (message: AppServerMessage): void => {
        if (String(message.id ?? "") !== requestId) {
          return;
        }

        this.off("response", handleResponse);
        if (message.error) {
          reject(new Error(JSON.stringify(message.error)));
          return;
        }

        resolve();
      };

      this.on("response", handleResponse);
      this.sendRaw({
        id: requestId,
        method: "initialize",
        params: {
          clientInfo: {
            name: appName,
            version: appVersion,
          },
          capabilities: {
            experimentalApi: true,
          },
        },
      });
    });

    this.sendRaw({ method: "initialized" });
  }

  private sendRaw(payload: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("app-server websocket is not connected");
    }

    this.socket.send(JSON.stringify(payload));
  }

  private handleSocketMessage(raw: string): void {
    let parsed: AppServerMessage;
    try {
      parsed = JSON.parse(raw) as AppServerMessage;
    } catch (error) {
      console.error("[codex-app-server] invalid json:", error);
      return;
    }

    const hasMethod = typeof parsed.method === "string";
    const hasId = parsed.id !== undefined && parsed.id !== null;

    if (hasMethod && hasId) {
      this.emit("request", parsed);
      return;
    }

    if (hasMethod) {
      this.emit("notification", parsed);
      return;
    }

    if (hasId) {
      this.emit("response", parsed);
    }
  }

  private handleUnexpectedDisconnect(reason: string): void {
    this.ready = false;

    if (this.socket) {
      this.socket.removeAllListeners();
    }

    this.socket = null;
    this.errorMessage = reason;
    this.scheduleReconnect(reason);
  }

  private scheduleReconnect(reason: string): void {
    if (this.connectPromise || this.reconnectTimer) {
      return;
    }

    this.setState("connecting", reason);
    const delay = Math.min(1000 * Math.max(this.reconnectAttemptCount + 1, 1), 5000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttemptCount += 1;
      void this.ensureReady().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.errorMessage = errorMessage;
        if (this.reconnectAttemptCount >= 10) {
          this.setState("disconnected", errorMessage);
          return;
        }

        this.scheduleReconnect(errorMessage);
      });
    }, delay);
  }

  private setState(nextState: ConnectionState, errorMessage: string | null): void {
    this.state = nextState;
    this.errorMessage = errorMessage;
    this.emit("state", nextState, errorMessage);
  }
}
