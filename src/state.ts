type SharedObjectValue = unknown;

const globalStateDefaults = new Map<string, unknown>([
  ["viewed2025-09-15-nux", true],
  ["viewed2025-09-15-full-chatgpt-auth-nux", true],
  ["viewed2025-09-15-apikey-auth-nux", true],
  ["show-copilot-login-first", false],
  ["use-copilot-auth-if-available", false],
  ["git-always-force-push", false],
  ["git-create-pull-request-as-draft", false],
  ["git-pull-request-merge-method", "merge"],
  ["git-show-sidebar-pr-icons", false],
  ["git-branch-prefix", "codex/"],
  ["git-commit-instructions", ""],
  ["git-pr-instructions", ""],
  ["worktree-auto-cleanup-enabled", true],
  ["worktree-keep-count", 15],
]);

const configurationDefaults = new Map<string, unknown>([
  ["appearanceTheme", "dark"],
  ["appearanceLightChromeTheme", "GitHub Light"],
  ["appearanceDarkChromeTheme", "GitHub Dark"],
  ["appearanceLightCodeThemeId", "github-light-default"],
  ["appearanceDarkCodeThemeId", "github-dark-default"],
]);

const persistedAtomDefaults = new Map<string, unknown>([
  ["has-seen-app-upsell-banner", true],
  ["composer-auto-context-enabled", false],
]);

export class HostStateStore {
  private readonly globalState = new Map<string, unknown>();
  private readonly configuration = new Map<string, unknown>();
  private readonly sharedObjects = new Map<string, SharedObjectValue>();
  private readonly persistedAtomsByScope = new Map<string, Map<string, unknown>>();
  private readonly sharedObjectSubscriptions = new Map<string, Set<string>>();

  getGlobalState(key: string): unknown {
    if (this.globalState.has(key)) {
      return this.globalState.get(key);
    }

    return globalStateDefaults.get(key);
  }

  setGlobalState(key: string, value: unknown): void {
    if (value === undefined) {
      this.globalState.delete(key);
      return;
    }

    this.globalState.set(key, value);
  }

  getConfiguration(key: string): unknown {
    if (this.configuration.has(key)) {
      return this.configuration.get(key);
    }

    return configurationDefaults.get(key);
  }

  setConfiguration(key: string, value: unknown): void {
    if (value === undefined) {
      this.configuration.delete(key);
      return;
    }

    this.configuration.set(key, value);
  }

  getSharedObject(key: string): SharedObjectValue {
    return this.sharedObjects.get(key);
  }

  setSharedObject(key: string, value: SharedObjectValue): void {
    if (value === undefined) {
      this.sharedObjects.delete(key);
      return;
    }

    this.sharedObjects.set(key, value);
  }

  subscribeSharedObject(clientId: string, key: string): void {
    const subscribers = this.sharedObjectSubscriptions.get(key) ?? new Set();
    subscribers.add(clientId);
    this.sharedObjectSubscriptions.set(key, subscribers);
  }

  unsubscribeSharedObject(clientId: string, key: string): void {
    const subscribers = this.sharedObjectSubscriptions.get(key);
    if (!subscribers) {
      return;
    }

    subscribers.delete(clientId);
    if (subscribers.size === 0) {
      this.sharedObjectSubscriptions.delete(key);
    }
  }

  getSharedObjectSubscribers(key: string): Set<string> {
    return this.sharedObjectSubscriptions.get(key) ?? new Set();
  }

  removeClient(clientId: string): void {
    for (const [key, subscribers] of this.sharedObjectSubscriptions.entries()) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.sharedObjectSubscriptions.delete(key);
      }
    }
  }

  getPersistedAtomState(scope: string): Record<string, unknown> {
    const persistedAtoms = this.persistedAtomsByScope.get(scope);
    if (!persistedAtoms) {
      return Object.fromEntries(persistedAtomDefaults.entries());
    }

    return Object.fromEntries([
      ...persistedAtomDefaults.entries(),
      ...persistedAtoms.entries(),
    ]);
  }

  setPersistedAtom(scope: string, key: string, value: unknown, deleted = false): void {
    const persistedAtoms = this.persistedAtomsByScope.get(scope) ?? new Map<string, unknown>();
    this.persistedAtomsByScope.set(scope, persistedAtoms);

    if (deleted) {
      persistedAtoms.delete(key);
      if (persistedAtoms.size === 0) {
        this.persistedAtomsByScope.delete(scope);
      }
      return;
    }

    persistedAtoms.set(key, value);
  }
}
