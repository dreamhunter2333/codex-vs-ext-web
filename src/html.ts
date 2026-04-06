import path from "node:path";

import { renderPwaHeadTags, renderPwaRegisterScript } from "./pwa.js";
import type { ProjectInfo } from "./projects.js";

const themeStorageKey = "web-cc-theme";

const sharedThemeVariables = `
      :root,
      .vscode-dark {
        --vscode-foreground: #e6edf3;
        --vscode-descriptionForeground: #7d8590;
        --vscode-focusBorder: #1f6feb;
        --vscode-editor-background: #0d1117;
        --vscode-editor-foreground: #e6edf3;
        --vscode-editorWidget-background: #161b22;
        --vscode-editorWidget-border: #30363d;
        --vscode-sideBar-background: #0d1117;
        --vscode-panel-background: #0d1117;
        --vscode-panel-border: #30363d;
        --vscode-input-background: #161b22;
        --vscode-input-foreground: #e6edf3;
        --vscode-input-border: #30363d;
        --vscode-input-placeholderForeground: #6e7681;
        --vscode-button-background: #238636;
        --vscode-button-foreground: #ffffff;
        --vscode-button-hoverBackground: #2ea043;
        --vscode-button-secondaryBackground: #282e33;
        --vscode-button-secondaryForeground: #c9d1d9;
        --vscode-button-secondaryHoverBackground: #30363d;
        --vscode-list-hoverBackground: #6e76811a;
        --vscode-list-activeSelectionBackground: #6e768166;
        --vscode-list-activeSelectionForeground: #ffffff;
        --vscode-menu-background: #161b22;
        --vscode-menu-foreground: #e6edf3;
        --vscode-menu-border: #30363d;
        --vscode-scrollbarSlider-background: #8b949e33;
        --vscode-scrollbarSlider-hoverBackground: #8b949e3d;
        --vscode-scrollbarSlider-activeBackground: #8b949e47;
        --vscode-badge-background: #1f6feb;
        --vscode-badge-foreground: #ffffff;
        --vscode-progressBar-background: #1f6feb;
        --vscode-textLink-foreground: #2f81f7;
        --vscode-textLink-activeForeground: #2f81f7;
        --vscode-toolbar-hoverBackground: #5a5d5e50;
        --vscode-terminal-background: #0d1117;
        --vscode-terminal-foreground: #e6edf3;
        --vscode-terminal-ansiBlack: #484f58;
        --vscode-terminal-ansiRed: #ff7b72;
        --vscode-terminal-ansiGreen: #3fb950;
        --vscode-terminal-ansiYellow: #d29922;
        --vscode-terminal-ansiBlue: #79c0ff;
        --vscode-terminal-ansiMagenta: #d2a8ff;
        --vscode-terminal-ansiCyan: #39c5cf;
        --vscode-terminal-ansiWhite: #b1bac4;
        --vscode-terminal-ansiBrightBlack: #6e7681;
        --vscode-terminal-ansiBrightRed: #ffa198;
        --vscode-terminal-ansiBrightGreen: #56d364;
        --vscode-terminal-ansiBrightYellow: #e3b341;
        --vscode-terminal-ansiBrightBlue: #a5d6ff;
        --vscode-terminal-ansiBrightMagenta: #e2c5ff;
        --vscode-terminal-ansiBrightCyan: #56d4dd;
        --vscode-terminal-ansiBrightWhite: #f0f6fc;
      }

      .vscode-light {
        --vscode-foreground: #1f2328;
        --vscode-descriptionForeground: #656d76;
        --vscode-focusBorder: #0969da;
        --vscode-editor-background: #ffffff;
        --vscode-editor-foreground: #1f2328;
        --vscode-editorWidget-background: #ffffff;
        --vscode-editorWidget-border: #d0d7de;
        --vscode-sideBar-background: #f6f8fa;
        --vscode-panel-background: #f6f8fa;
        --vscode-panel-border: #d0d7de;
        --vscode-input-background: #ffffff;
        --vscode-input-foreground: #1f2328;
        --vscode-input-border: #d0d7de;
        --vscode-input-placeholderForeground: #6e7781;
        --vscode-button-background: #1f883d;
        --vscode-button-foreground: #ffffff;
        --vscode-button-hoverBackground: #1a7f37;
        --vscode-button-secondaryBackground: #ebecf0;
        --vscode-button-secondaryForeground: #24292f;
        --vscode-button-secondaryHoverBackground: #f3f4f6;
        --vscode-list-hoverBackground: #eaeef280;
        --vscode-list-activeSelectionBackground: #afb8c133;
        --vscode-list-activeSelectionForeground: #1f2328;
        --vscode-menu-background: #ffffff;
        --vscode-menu-foreground: #1f2328;
        --vscode-menu-border: #d0d7de;
        --vscode-scrollbarSlider-background: #8c959f33;
        --vscode-scrollbarSlider-hoverBackground: #8c959f3d;
        --vscode-scrollbarSlider-activeBackground: #8c959f47;
        --vscode-badge-background: #0969da;
        --vscode-badge-foreground: #ffffff;
        --vscode-progressBar-background: #0969da;
        --vscode-textLink-foreground: #0969da;
        --vscode-textLink-activeForeground: #0969da;
        --vscode-toolbar-hoverBackground: #b8b8b850;
        --vscode-terminal-background: #ffffff;
        --vscode-terminal-foreground: #1f2328;
        --vscode-terminal-ansiBlack: #24292f;
        --vscode-terminal-ansiRed: #cf222e;
        --vscode-terminal-ansiGreen: #1a7f37;
        --vscode-terminal-ansiYellow: #9a6700;
        --vscode-terminal-ansiBlue: #0550ae;
        --vscode-terminal-ansiMagenta: #8250df;
        --vscode-terminal-ansiCyan: #1b7c83;
        --vscode-terminal-ansiWhite: #57606a;
        --vscode-terminal-ansiBrightBlack: #6e7781;
        --vscode-terminal-ansiBrightRed: #a40e26;
        --vscode-terminal-ansiBrightGreen: #116329;
        --vscode-terminal-ansiBrightYellow: #7d4e00;
        --vscode-terminal-ansiBrightBlue: #0969da;
        --vscode-terminal-ansiBrightMagenta: #6639ba;
        --vscode-terminal-ansiBrightCyan: #096b75;
        --vscode-terminal-ansiBrightWhite: #24292f;
      }
`;

const sharedCodexTokenVariables = `
    .vscode-dark,
    .vscode-light {
      --color-token-bg-primary: var(--vscode-editor-background);
      --color-token-bg-secondary: var(--vscode-editorWidget-background);
      --color-token-bg-tertiary: var(--vscode-button-secondaryBackground);
      --color-token-main-surface-primary: var(--vscode-editor-background);
      --color-token-side-bar-background: var(--vscode-sideBar-background);
      --color-token-dropdown-background: var(--vscode-menu-background);
      --color-token-menu-background: var(--vscode-menu-background);
      --color-token-menu-border: var(--vscode-menu-border);
      --color-token-editor-background: var(--vscode-editor-background);
      --color-token-editor-foreground: var(--vscode-editor-foreground);
      --color-token-foreground: var(--vscode-foreground);
      --color-token-text-primary: var(--vscode-foreground);
      --color-token-text-secondary: var(--vscode-descriptionForeground);
      --color-token-text-tertiary: var(--vscode-input-placeholderForeground);
      --color-token-description-foreground: var(--vscode-descriptionForeground);
      --color-token-text-link-foreground: var(--vscode-textLink-foreground);
      --color-token-text-link-active-foreground: var(--vscode-textLink-activeForeground);
      --color-token-border: var(--vscode-panel-border);
      --color-token-border-default: var(--vscode-panel-border);
      --color-token-panel-border: var(--vscode-panel-border);
      --color-token-border-light: var(--vscode-panel-border);
      --color-token-focus-border: var(--vscode-focusBorder);
      --color-token-list-hover-background: var(--vscode-list-hoverBackground);
      --color-token-list-active-selection-background: var(--vscode-list-activeSelectionBackground);
      --color-token-list-active-selection-foreground: var(--vscode-list-activeSelectionForeground);
      --color-token-list-active-selection-icon-foreground: var(--vscode-textLink-foreground);
      --color-token-button-background: var(--vscode-button-background);
      --color-token-button-foreground: var(--vscode-button-foreground);
      --color-token-button-border: var(--vscode-button-background);
      --color-token-button-secondary-hover-background: var(--vscode-button-secondaryHoverBackground);
      --color-token-toolbar-hover-background: var(--vscode-toolbar-hoverBackground);
      --color-token-input-background: var(--vscode-input-background);
      --color-token-input-foreground: var(--vscode-input-foreground);
      --color-token-input-border: var(--vscode-input-border);
      --color-token-input-placeholder-foreground: var(--vscode-input-placeholderForeground);
      --color-token-badge-background: var(--vscode-badge-background);
      --color-token-badge-foreground: var(--vscode-badge-foreground);
      --color-token-terminal-background: var(--vscode-terminal-background);
      --color-token-terminal-foreground: var(--vscode-terminal-foreground);
      --color-token-terminal-border: var(--vscode-panel-border);
      --color-token-terminal-selection-background: color-mix(in srgb, var(--vscode-textLink-foreground) 18%, transparent);
      --color-token-terminal-inactive-selection-background: color-mix(in srgb, var(--vscode-textLink-foreground) 10%, transparent);
      --color-token-terminal-ansi-black: var(--vscode-terminal-ansiBlack);
      --color-token-terminal-ansi-red: var(--vscode-terminal-ansiRed);
      --color-token-terminal-ansi-green: var(--vscode-terminal-ansiGreen);
      --color-token-terminal-ansi-yellow: var(--vscode-terminal-ansiYellow);
      --color-token-terminal-ansi-blue: var(--vscode-terminal-ansiBlue);
      --color-token-terminal-ansi-magenta: var(--vscode-terminal-ansiMagenta);
      --color-token-terminal-ansi-cyan: var(--vscode-terminal-ansiCyan);
      --color-token-terminal-ansi-white: var(--vscode-terminal-ansiWhite);
      --color-token-terminal-ansi-bright-black: var(--vscode-terminal-ansiBrightBlack);
      --color-token-terminal-ansi-bright-red: var(--vscode-terminal-ansiBrightRed);
      --color-token-terminal-ansi-bright-green: var(--vscode-terminal-ansiBrightGreen);
      --color-token-terminal-ansi-bright-yellow: var(--vscode-terminal-ansiBrightYellow);
      --color-token-terminal-ansi-bright-blue: var(--vscode-terminal-ansiBrightBlue);
      --color-token-terminal-ansi-bright-magenta: var(--vscode-terminal-ansiBrightMagenta);
      --color-token-terminal-ansi-bright-cyan: var(--vscode-terminal-ansiBrightCyan);
      --color-token-terminal-ansi-bright-white: var(--vscode-terminal-ansiBrightWhite);
      --color-token-scrollbar-slider-background: var(--vscode-scrollbarSlider-background);
      --color-token-scrollbar-slider-hover-background: var(--vscode-scrollbarSlider-hoverBackground);
      --color-token-scrollbar-slider-active-background: var(--vscode-scrollbarSlider-activeBackground);
      --color-token-git-decoration-added-resource-foreground: var(--vscode-terminal-ansiGreen);
      --color-token-git-decoration-deleted-resource-foreground: var(--vscode-terminal-ansiRed);
      --color-token-git-decoration-modified-resource-foreground: var(--vscode-terminal-ansiYellow);
      --color-token-charts-blue: var(--vscode-textLink-foreground);
      --color-token-charts-green: var(--vscode-terminal-ansiGreen);
      --color-token-charts-orange: var(--vscode-terminal-ansiYellow);
      --color-token-charts-purple: var(--vscode-terminal-ansiMagenta);
      --color-token-charts-red: var(--vscode-terminal-ansiRed);
      --color-token-charts-yellow: var(--vscode-terminal-ansiBrightYellow);
      --color-token-radio-active-foreground: var(--vscode-textLink-foreground);
    }
`;
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderProjectPage(projects: ProjectInfo[]): string {
  const serializedProjects = JSON.stringify(projects);
  const pwaHeadTags = renderPwaHeadTags();
  const pwaRegisterScript = renderPwaRegisterScript();

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${pwaHeadTags}
    <title>Codex Projects</title>
    <style>
${sharedThemeVariables}

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      html,
      body {
        height: 100%;
      }

      body {
        min-height: 100vh;
        background: var(--vscode-editor-background, #0d1117);
        color: var(--vscode-foreground, #e6edf3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .app {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }

      .web-cc-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 36px;
        padding: 0 12px;
        background: var(--vscode-sideBar-background, #252526);
        border-bottom: 1px solid var(--vscode-panel-border, #80808059);
        font-size: 13px;
        flex-shrink: 0;
      }

      .web-cc-nav-left,
      .web-cc-nav-right {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .nav-brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .nav-logo {
        width: 18px;
        height: 18px;
        display: block;
        flex: 0 0 auto;
      }

      .nav-logo-light {
        display: none;
      }

      .vscode-light .nav-logo-dark {
        display: none;
      }

      .vscode-light .nav-logo-light {
        display: block;
      }

      .nav-title {
        color: var(--vscode-foreground, #cccccc);
        font-size: 13px;
        font-weight: 500;
      }

      .nav-theme-btn,
      .nav-refresh-btn {
        background: none;
        border: 1px solid var(--vscode-button-secondaryBackground, #3a3d41);
        color: var(--vscode-foreground, #cccccc);
        padding: 2px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        min-width: 28px;
        min-height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .nav-theme-btn:hover,
      .nav-refresh-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground, #45494e);
      }

      .theme-icon {
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1.5px solid currentColor;
        background: linear-gradient(to right, currentColor 50%, transparent 50%);
      }

      .main-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }

      .main-content-inner {
        max-width: 1200px;
        margin: 0 auto;
      }

      .project-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }

      .project-card {
        appearance: none;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 20px;
        text-align: left;
        cursor: pointer;
        border: 1px solid var(--vscode-panel-border, #333);
        border-radius: 8px;
        background: var(--vscode-sideBar-background, #252526);
        color: inherit;
        transition: border-color 0.15s, background 0.15s;
      }

      .project-card:hover {
        border-color: var(--vscode-focusBorder, #007acc);
        background: var(--vscode-list-hoverBackground, #2a2d2e);
      }

      .project-name-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .project-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--vscode-editor-foreground, #e0e0e0);
      }

      .path-copy {
        font-size: 12px;
        color: var(--vscode-descriptionForeground, #888);
        word-break: break-all;
        margin-bottom: 8px;
      }

      .meta-line {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        font-size: 11px;
        color: var(--vscode-descriptionForeground, #666);
        margin-bottom: 12px;
      }

      .project-badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: 500;
      }

      .badge-git {
        background: #2d4a22;
        color: #89d185;
      }

      .badge-manual {
        background: #4a3522;
        color: #d97757;
      }

      .vscode-light .badge-git {
        background: #d6ecd0;
        color: #388a34;
      }

      .vscode-light .badge-manual {
        background: #f5e0d0;
        color: #b35c37;
      }

      .empty {
        grid-column: 1 / -1;
        padding: 40px;
        text-align: center;
        color: var(--vscode-descriptionForeground, #888);
      }

      @media (max-width: 860px) {
        .main-content {
          padding: 12px;
        }
      }
    </style>
    <script>
      (function () {
        var savedTheme = localStorage.getItem(${JSON.stringify(themeStorageKey)});
        var cls = savedTheme === "light" ? "vscode-light" : "vscode-dark";
        document.documentElement.classList.add(cls);
        document.addEventListener("DOMContentLoaded", function () {
          document.body.classList.remove("vscode-dark", "vscode-light");
          document.body.classList.add(cls);
        }, { once: true });
      })();
    </script>
  </head>
  <body class="vscode-dark">
    <div class="app">
      <nav class="web-cc-nav">
        <div class="web-cc-nav-left">
          <span class="nav-brand">
            <img class="nav-logo nav-logo-dark" src="/resources/blossom-white.svg" alt="Codex" />
            <img class="nav-logo nav-logo-light" src="/resources/blossom-black.svg" alt="Codex" />
            <span class="nav-title">Codex Projects</span>
          </span>
        </div>
        <div class="web-cc-nav-right">
          <button class="nav-theme-btn" id="themeToggle" type="button" title="切换主题"><span class="theme-icon"></span></button>
          <button class="nav-refresh-btn" id="refreshProjects" type="button" title="刷新">&#x21BB;</button>
        </div>
      </nav>
      <main class="main-content">
        <div class="main-content-inner">
          <div class="project-grid" id="projectList">
          <div class="empty">正在整理项目列表…</div>
          </div>
        </div>
      </main>
    </div>
    <script>
      (function () {
        var discoveredProjects = ${serializedProjects};
        var themeStorageKey = ${JSON.stringify(themeStorageKey)};
        var themeColorByMode = { dark: "#0d1117", light: "#ffffff" };

        function applyTheme(theme) {
          var nextClass = theme === "light" ? "vscode-light" : "vscode-dark";
          document.documentElement.classList.remove("vscode-dark", "vscode-light");
          document.documentElement.classList.add(nextClass);
          document.body.classList.remove("vscode-dark", "vscode-light");
          document.body.classList.add(nextClass);
          document.documentElement.style.colorScheme = theme;
          var metaTheme = document.querySelector('meta[name="theme-color"]');
          if (metaTheme) {
            metaTheme.setAttribute("content", themeColorByMode[theme] || themeColorByMode.dark);
          }
          localStorage.setItem(themeStorageKey, theme);
        }

        function formatTime(timestamp) {
          if (!timestamp) {
            return "无记录";
          }

          try {
            return new Intl.DateTimeFormat("zh-CN", {
              dateStyle: "medium",
              timeStyle: "short"
            }).format(new Date(timestamp));
          } catch (_) {
            return String(timestamp);
          }
        }

        function buildProjects() {
          var byPath = new Map();
          discoveredProjects.forEach(function (project) {
            byPath.set(project.path, project);
          });

          return Array.from(byPath.values());
        }

        function getProjectBadge(project) {
          if (project.source === "current") {
            return "当前";
          }

          if (project.sessionCount > 0) {
            return project.sessionCount + " 次会话";
          }

          return "手动";
        }

        function encodeProjectParam(projectPath) {
          var bytes = new TextEncoder().encode(projectPath);
          var binary = "";
          bytes.forEach(function (byte) {
            binary += String.fromCharCode(byte);
          });
          return btoa(binary);
        }

        function openProject(projectPath) {
          var url = new URL("/app", window.location.origin);
          url.searchParams.set("project", encodeProjectParam(projectPath));
          window.location.href = url.toString();
        }

        function renderProjects() {
          var root = document.getElementById("projectList");
          if (!root) {
            return;
          }

          var projects = buildProjects();
          root.innerHTML = "";

          if (projects.length === 0) {
            root.innerHTML = '<div class="empty">没有可用项目。</div>';
            return;
          }

          projects.forEach(function (project) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = "project-card";
            button.addEventListener("click", function () {
              openProject(project.path);
            });

            var meta = [];
            meta.push(project.hasGit ? "Git 项目" : "普通目录");
            if (project.sessionCount > 0) {
            meta.push("会话 " + project.sessionCount);
            }
            meta.push("最近 " + formatTime(project.lastUsedAt));

            var titleRow = document.createElement("div");
            titleRow.className = "project-name-row";

            var name = document.createElement("div");
            name.className = "project-name";
            name.textContent = project.name;

            titleRow.appendChild(name);

            var pathNode = document.createElement("div");
            pathNode.className = "path-copy";
            pathNode.textContent = project.path;

            var metaNode = document.createElement("div");
            metaNode.className = "meta-line";
            meta.forEach(function (item) {
              var text = document.createElement("span");
              text.textContent = item;
              metaNode.appendChild(text);
            });

            var badgeWrap = document.createElement("div");
            badgeWrap.className = "project-badges";

            var stateBadge = document.createElement("span");
            stateBadge.className = "badge " + (project.hasGit ? "badge-git" : "badge-manual");
            stateBadge.textContent = project.hasGit ? "Git" : "Directory";
            badgeWrap.appendChild(stateBadge);

            var sourceBadge = document.createElement("span");
            sourceBadge.className = "badge badge-manual";
            sourceBadge.textContent = getProjectBadge(project);
            badgeWrap.appendChild(sourceBadge);

            button.appendChild(titleRow);
            button.appendChild(pathNode);
            button.appendChild(metaNode);
            button.appendChild(badgeWrap);

            root.appendChild(button);
          });
        }

        document.getElementById("themeToggle")?.addEventListener("click", function () {
          var nextTheme = document.documentElement.classList.contains("vscode-light") ? "dark" : "light";
          applyTheme(nextTheme);
        });

        document.getElementById("refreshProjects")?.addEventListener("click", function () {
          window.location.reload();
        });

        renderProjects();
      })();
    </script>
    ${pwaRegisterScript}
  </body>
</html>`;
}

export function renderAppHtml(
  rawHtml: string,
  projectPath: string,
  injectedShim: string,
  _initialRoute: string | null,
): string {
  const projectName = path.basename(projectPath) || projectPath;
  const pwaHeadTags = renderPwaHeadTags();
  const pwaRegisterScript = renderPwaRegisterScript();
  const themeScript = `<script>
    (function () {
      var themeStorageKey = ${JSON.stringify(themeStorageKey)};
      var themeColorByMode = { dark: "#0d1117", light: "#ffffff" };
      var savedTheme = localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";

      function syncThemeToHost(theme) {
        try {
          if (typeof window.acquireVsCodeApi !== "function") {
            return;
          }
          var vscode = window.acquireVsCodeApi();
          if (!vscode || typeof vscode.postMessage !== "function") {
            return;
          }
          vscode.postMessage({
            type: "fetch",
            requestId: "codex-shell-theme-" + theme + "-" + Date.now(),
            url: "vscode://codex/set-configuration",
            method: "POST",
            body: {
              key: "appearanceTheme",
              value: theme,
            },
          });
        } catch (_) {}
      }

      function applyThemeClasses(theme) {
        var cls = theme === "light" ? "vscode-light" : "vscode-dark";
        document.documentElement.classList.remove("vscode-dark", "vscode-light");
        document.documentElement.classList.add(cls);
        document.documentElement.style.colorScheme = theme;
        if (document.body) {
          document.body.classList.remove("vscode-dark", "vscode-light");
          document.body.classList.add(cls);
          document.body.style.colorScheme = theme;
        }
        var metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
          metaTheme.setAttribute("content", themeColorByMode[theme] || themeColorByMode.dark);
        }
      }

      applyThemeClasses(savedTheme);
      document.addEventListener("DOMContentLoaded", function () {
        applyThemeClasses(savedTheme);
        window.setTimeout(function () {
          syncThemeToHost(savedTheme);
        }, 0);
      }, { once: true });
      window.__codexThemeStorageKey = themeStorageKey;
      window.applyCodexShellTheme = function (theme) {
        var nextTheme = theme === "light" ? "light" : "dark";
        savedTheme = nextTheme;
        applyThemeClasses(nextTheme);
        localStorage.setItem(themeStorageKey, nextTheme);
        syncThemeToHost(nextTheme);
      };
      window.toggleCodexShellTheme = function () {
        var nextTheme = document.documentElement.classList.contains("vscode-light") ? "dark" : "light";
        window.applyCodexShellTheme(nextTheme);
      };
    })();
  </script>`;
  const shellRuntimeScript = `<script>
    (function () {
      var routeObserver = null;
      var resumeObserver = null;
      var routePollTimer = null;
      var routeCheckTimer = null;
      var pendingResumePath = getRouteFromUrl();
      var resumeTargetPath = pendingResumePath !== "/" ? pendingResumePath : null;
      var lastKnownPath = null;
      var resumeProbeTimer = null;
      var resumeProbeAttempts = 0;
      var resumeState = "idle";
      var resumeStartedAt = resumeTargetPath ? Date.now() : 0;
      var resumeDeadlineTimer = null;
      var resumeCompletionTimer = null;
      var resumeDeadlineAt = resumeTargetPath ? Date.now() + 45000 : 0;
      var minimumResumeVisibleMs = 0;
      var resumeSuccessSettleMs = 3000;
      var resumeQuietAfterNotFoundMs = 3000;
      var resumeLastConversationNotFoundAt = 0;

      if (resumeTargetPath) {
        resumeState = "resuming";
        document.documentElement.dataset.codexSessionResumeState = "resuming";
      }

      function ensureDocumentVisible() {
        if (document.documentElement.style.display === "none") {
          document.documentElement.style.removeProperty("display");
        }
      }

      function getRouteFromUrl() {
        try {
          var url = new URL(window.location.href);
          var sessionId = url.searchParams.get("session");
          if (sessionId && sessionId.trim()) {
            return "/local/" + encodeURIComponent(sessionId.trim());
          }
        } catch (_) {}

        return "/";
      }

      function getReactContainerNode() {
        var root = document.getElementById("root");
        if (!(root instanceof HTMLElement)) {
          return null;
        }

        var keys = Object.getOwnPropertyNames(root);
        for (var index = 0; index < keys.length; index += 1) {
          var key = keys[index];
          if (!key.startsWith("__reactContainer$")) {
            continue;
          }

          return root[key];
        }

        return null;
      }

      function getCurrentRoutePath() {
        var containerNode = getReactContainerNode();
        if (!containerNode) {
          return null;
        }

        var stack = [containerNode];
        var seen = new Set();
        while (stack.length > 0) {
          var node = stack.pop();
          if (!node || typeof node !== "object" || seen.has(node)) {
            continue;
          }

          seen.add(node);
          var props = node.memoizedProps;
          if (
            props &&
            typeof props === "object" &&
            props.value &&
            typeof props.value === "object" &&
            typeof props.value.pathname === "string"
          ) {
            return props.value.pathname;
          }

          if (node.sibling) {
            stack.push(node.sibling);
          }
          if (node.child) {
            stack.push(node.child);
          }
        }

        return null;
      }

      function buildAppUrl(pathname) {
        var url = new URL(window.location.href);
        if (pathname && pathname.startsWith("/local/")) {
          var sessionId = pathname.slice("/local/".length);
          if (sessionId) {
            try {
              url.searchParams.set("session", decodeURIComponent(sessionId));
            } catch (_) {
              url.searchParams.set("session", sessionId);
            }
            return url;
          }
        }

        url.searchParams.delete("session");
        return url;
      }

      function syncRouteToUrl() {
        var pathname = getCurrentRoutePath();
        if (!pathname || pathname === lastKnownPath) {
          return;
        }

        if (pendingResumePath && pathname === "/") {
          return;
        }

        lastKnownPath = pathname;
        if (pendingResumePath === pathname) {
          pendingResumePath = null;
        } else if (pendingResumePath && pathname !== pendingResumePath) {
          pendingResumePath = null;
        }

        var nextUrl = buildAppUrl(pathname);
        if (nextUrl.toString() === window.location.href) {
          return;
        }

        var currentUrl = new URL(window.location.href);
        var shouldReplace = currentUrl.searchParams.get("session") == null;
        var method = shouldReplace ? "replaceState" : "pushState";
        window.history[method](null, "", nextUrl.toString());
      }

      function scheduleRouteSync() {
        if (routeCheckTimer != null) {
          return;
        }

        routeCheckTimer = window.setTimeout(function () {
          routeCheckTimer = null;
          syncRouteToUrl();
        }, 60);
      }

      function navigateToCurrentUrlRoute() {
        var targetPath = getRouteFromUrl();
        if (!targetPath || targetPath === lastKnownPath) {
          return;
        }

        pendingResumePath = targetPath;
        window.postMessage(
          {
            type: "navigate-to-route",
            path: targetPath,
          },
          window.location.origin,
        );
      }

      function probeInitialResumeRoute() {
        if (!pendingResumePath || pendingResumePath === "/") {
          return;
        }

        var currentPath = getCurrentRoutePath();
        if (!currentPath) {
          resumeProbeAttempts += 1;
          if (resumeProbeAttempts >= 30) {
            navigateToCurrentUrlRoute();
            return;
          }

          resumeProbeTimer = window.setTimeout(function () {
            resumeProbeTimer = null;
            probeInitialResumeRoute();
          }, 120);
          return;
        }

        lastKnownPath = currentPath;
        if (currentPath === pendingResumePath) {
          pendingResumePath = null;
          return;
        }

        navigateToCurrentUrlRoute();
      }

      function scheduleInitialResumeProbe() {
        if (!pendingResumePath || pendingResumePath === "/" || resumeProbeTimer != null) {
          return;
        }

        resumeProbeAttempts = 0;
        resumeProbeTimer = window.setTimeout(function () {
          resumeProbeTimer = null;
          probeInitialResumeRoute();
        }, 120);
      }

      function normalizeInlineText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
      }

      function syncResumeOverlayContent() {
        var titleNode = document.getElementById("codex-resume-overlay-title");
        var subtitleNode = document.getElementById("codex-resume-overlay-subtitle");
        var retryButton = document.getElementById("codex-resume-overlay-retry");
        if (!(titleNode instanceof HTMLElement) || !(subtitleNode instanceof HTMLElement)) {
          return;
        }

        if (resumeState === "timed_out") {
          titleNode.textContent = "Still restoring session";
          subtitleNode.textContent = "恢复时间比预期更长，御坂会继续等待；你也可以手动刷新重试。";
          if (retryButton instanceof HTMLElement) {
            retryButton.style.display = "inline-flex";
          }
          return;
        }

        titleNode.textContent = "Restoring session";
        subtitleNode.textContent = "正在恢复当前会话，恢复完成后会自动显示。";
        if (retryButton instanceof HTMLElement) {
          retryButton.style.display = "none";
        }
      }

      function getSuppressedConversationToastNodes() {
        if (!(document.body instanceof HTMLElement)) {
          return [];
        }

        return Array.from(
          document.body.querySelectorAll("[data-codex-suppressed-conversation-toast='true']"),
        );
      }

      function hasConversationNotFoundToast() {
        if (!(document.body instanceof HTMLElement)) {
          return false;
        }

        var toastNodes = document.body.querySelectorAll(".toast-root.no-drag, [role='alert']");
        for (var index = 0; index < toastNodes.length; index += 1) {
          var node = toastNodes[index];
          if (!(node instanceof HTMLElement)) {
            continue;
          }

          var text = normalizeInlineText(node.innerText || node.textContent || "");
          if (text === "Conversation not found") {
            return true;
          }
        }

        return false;
      }

      function restoreSuppressedConversationToasts() {
        var suppressedNodes = getSuppressedConversationToastNodes();
        for (var index = 0; index < suppressedNodes.length; index += 1) {
          var node = suppressedNodes[index];
          if (!(node instanceof HTMLElement)) {
            continue;
          }

          var previousDisplay = node.dataset.codexRestoreDisplay || "";
          if (previousDisplay) {
            node.style.display = previousDisplay;
          } else {
            node.style.removeProperty("display");
          }

          delete node.dataset.codexRestoreDisplay;
          delete node.dataset.codexSuppressedConversationToast;
        }
      }

      function discardSuppressedConversationToasts() {
        var suppressedNodes = getSuppressedConversationToastNodes();
        for (var index = 0; index < suppressedNodes.length; index += 1) {
          var node = suppressedNodes[index];
          if (!(node instanceof HTMLElement)) {
            continue;
          }

          node.remove();
        }
      }

      function suppressConversationNotFoundToasts() {
        if (
          (resumeState !== "resuming" && resumeState !== "timed_out") ||
          !(document.body instanceof HTMLElement)
        ) {
          return;
        }

        var toastNodes = document.body.querySelectorAll(".toast-root.no-drag, [role='alert']");
        for (var index = 0; index < toastNodes.length; index += 1) {
          var node = toastNodes[index];
          if (!(node instanceof HTMLElement)) {
            continue;
          }

          var text = normalizeInlineText(node.innerText || node.textContent || "");
          if (text !== "Conversation not found") {
            continue;
          }

          resumeLastConversationNotFoundAt = Date.now();

          if (node.dataset.codexSuppressedConversationToast !== "true") {
            node.dataset.codexSuppressedConversationToast = "true";
            node.dataset.codexRestoreDisplay = node.style.display || "";
          }

          node.style.display = "none";
        }
      }

      function hasResumeSuccessSignal() {
        if (!resumeTargetPath) {
          return false;
        }

        if (getCurrentRoutePath() !== resumeTargetPath) {
          return false;
        }

        return document.querySelector(
          'button[aria-label="Copy message"], button[aria-label="Fork from this message"], button[aria-label="Edit message"]',
        ) instanceof HTMLElement;
      }

      function clearResumeDeadlineTimer() {
        if (resumeDeadlineTimer == null) {
          return;
        }

        window.clearTimeout(resumeDeadlineTimer);
        resumeDeadlineTimer = null;
      }

      function clearResumeCompletionTimer() {
        if (resumeCompletionTimer == null) {
          return;
        }

        window.clearTimeout(resumeCompletionTimer);
        resumeCompletionTimer = null;
      }

      function setResumeState(nextState) {
        if (resumeState === nextState) {
          return;
        }

        resumeState = nextState;
        document.documentElement.dataset.codexSessionResumeState = nextState;
        syncResumeOverlayContent();

        if (nextState === "resuming") {
          if (!resumeStartedAt) {
            resumeStartedAt = Date.now();
          }
          clearResumeDeadlineTimer();
          clearResumeCompletionTimer();
          if (!resumeDeadlineAt) {
            resumeDeadlineAt = Date.now() + 45000;
          }
          var delay = Math.max(0, resumeDeadlineAt - Date.now());
          resumeDeadlineTimer = window.setTimeout(function () {
            resumeDeadlineTimer = null;
            if (resumeState !== "resuming") {
              return;
            }

            setResumeState("timed_out");
          }, delay);
          suppressConversationNotFoundToasts();
          return;
        }

        clearResumeDeadlineTimer();
        clearResumeCompletionTimer();
        if (nextState === "completed") {
          discardSuppressedConversationToasts();
        } else {
          suppressConversationNotFoundToasts();
        }
      }

      function maybeCompleteSessionResume() {
        if (resumeState !== "resuming" && resumeState !== "timed_out") {
          return;
        }

        suppressConversationNotFoundToasts();
        if (!hasResumeSuccessSignal() || hasConversationNotFoundToast()) {
          clearResumeCompletionTimer();
          return;
        }

        if (resumeCompletionTimer != null) {
          return;
        }

        var earliestVisibleAt = resumeStartedAt + minimumResumeVisibleMs;
        var quietAfterNotFoundAt = resumeLastConversationNotFoundAt
          ? resumeLastConversationNotFoundAt + resumeQuietAfterNotFoundMs
          : 0;
        var completionAt = Math.max(
          earliestVisibleAt,
          quietAfterNotFoundAt,
          Date.now() + resumeSuccessSettleMs,
        );
        var delay = Math.max(0, completionAt - Date.now());
        resumeCompletionTimer = window.setTimeout(function () {
          resumeCompletionTimer = null;
          if (
            (resumeState !== "resuming" && resumeState !== "timed_out") ||
            !hasResumeSuccessSignal() ||
            hasConversationNotFoundToast()
          ) {
            return;
          }

          resumeTargetPath = null;
          setResumeState("completed");
        }, delay);
      }

      function hideCodexAppPromo() {
        var dismissButton = document.querySelector(
          'button[aria-label="Dismiss Codex app banner"]',
        );
        if (!(dismissButton instanceof HTMLElement)) {
          return false;
        }

        var banner = dismissButton.closest("aside");
        if (!(banner instanceof HTMLElement)) {
          return false;
        }

        banner.style.display = "none";
        return true;
      }

      function schedulePromoHide() {
        var attempts = 0;

        function tick() {
          attempts += 1;
          var didHide = false;
          didHide = hideCodexAppPromo() || didHide;
          if (didHide || attempts >= 20) {
            return;
          }

          window.setTimeout(tick, 250);
        }

        tick();
      }

      var visibilityObserver = new MutationObserver(function () {
        ensureDocumentVisible();
      });

      document.addEventListener("DOMContentLoaded", function () {
        ensureDocumentVisible();
        schedulePromoHide();
        scheduleInitialResumeProbe();
        scheduleRouteSync();
        syncResumeOverlayContent();
        if (resumeTargetPath) {
          suppressConversationNotFoundToasts();
          setResumeState("resuming");
        }
        visibilityObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["style"],
        });
        if (document.body instanceof HTMLElement) {
          resumeObserver = new MutationObserver(function () {
            maybeCompleteSessionResume();
          });
          resumeObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
          });
        }
        var root = document.getElementById("root");
        if (root instanceof HTMLElement) {
          routeObserver = new MutationObserver(function () {
            scheduleRouteSync();
            maybeCompleteSessionResume();
          });
          routeObserver.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
          });
        }

        routePollTimer = window.setInterval(function () {
          syncRouteToUrl();
          maybeCompleteSessionResume();
        }, 800);
      }, { once: true });

      window.addEventListener("popstate", function () {
        navigateToCurrentUrlRoute();
      });
    })();
  </script>`;
  const shellStyle = `<style>
${sharedThemeVariables}
${sharedCodexTokenVariables}
    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100dvh !important;
      overflow: hidden !important;
    }

    body {
      background: var(--vscode-editor-background) !important;
      color: var(--vscode-foreground) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }

    .vscode-dark {
      color-scheme: dark;
    }

    .vscode-light {
      color-scheme: light;
    }

    .web-cc-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      max-width: 100vw;
      overflow: hidden;
    }

    .web-cc-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 36px;
      padding: 0 12px;
      background: var(--vscode-sideBar-background, #252526);
      border-bottom: 1px solid var(--vscode-panel-border, #80808059);
      font-size: 13px;
      flex-shrink: 0;
    }

    .web-cc-nav-left,
    .web-cc-nav-right {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .web-cc-nav-left a {
      color: var(--vscode-textLink-foreground, #3794ff);
      text-decoration: none;
      font-size: 13px;
    }

    .web-cc-nav-left a:hover {
      text-decoration: underline;
    }

    .nav-separator {
      color: var(--vscode-descriptionForeground, #ccccccb3);
    }

    .nav-project {
      color: var(--vscode-foreground, #cccccc);
      font-size: 13px;
      font-weight: 500;
      min-width: 0;
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .nav-theme-btn {
      background: none;
      border: 1px solid var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-foreground, #cccccc);
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      min-width: 28px;
      min-height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .nav-theme-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    .theme-icon {
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1.5px solid currentColor;
      background: linear-gradient(to right, currentColor 50%, transparent 50%);
    }

    .web-cc-main {
      display: flex;
      flex: 1;
      min-height: 0;
      width: 100%;
      overflow: hidden;
      position: relative;
    }

    .codex-resume-overlay {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-descriptionForeground, #ccccccb3);
      z-index: 5;
      pointer-events: auto;
    }

    .codex-resume-overlay-copy {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 24px;
      text-align: center;
    }

    .codex-resume-overlay-spinner {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 2px solid color-mix(in srgb, var(--vscode-descriptionForeground, #ccccccb3) 30%, transparent);
      border-top-color: var(--vscode-textLink-foreground, #3794ff);
      animation: codex-resume-spin 0.8s linear infinite;
    }

    .codex-resume-overlay-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-foreground, #cccccc);
    }

    .codex-resume-overlay-subtitle {
      font-size: 12px;
      line-height: 1.5;
      max-width: 280px;
    }

    .codex-resume-overlay-retry {
      display: none;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 6px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground, #cccccc));
      cursor: pointer;
      font-size: 12px;
    }

    .codex-resume-overlay-retry:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    @keyframes codex-resume-spin {
      from {
        transform: rotate(0deg);
      }

      to {
        transform: rotate(360deg);
      }
    }

    #root {
      display: flex;
      flex: 1;
      min-height: 0;
      width: 100%;
      max-width: 100%;
      overflow: hidden;
      height: 100% !important;
    }

    #root > * {
      min-height: 0;
      flex: 1 1 auto;
    }

    #root > .pointer-events-none.fixed.inset-0.z-0.overflow-hidden,
    #root .pointer-events-none.absolute.inset-0.-ml-6,
    body > video[style*="display: none"],
    body > canvas[style*="display: none"] {
      display: none !important;
    }

    html[data-codex-session-resume-state="resuming"] .toast-root.no-drag,
    html[data-codex-session-resume-state="timed_out"] .toast-root.no-drag {
      display: none !important;
    }

    html[data-codex-session-resume-state="resuming"] body > :not(.web-cc-wrapper):not(script):not(style),
    html[data-codex-session-resume-state="timed_out"] body > :not(.web-cc-wrapper):not(script):not(style) {
      display: none !important;
    }

    html[data-codex-session-resume-state="resuming"] .web-cc-main > :not(.codex-resume-overlay),
    html[data-codex-session-resume-state="timed_out"] .web-cc-main > :not(.codex-resume-overlay) {
      visibility: hidden !important;
      pointer-events: none !important;
    }

    html[data-codex-session-resume-state="resuming"] .web-cc-main > #root,
    html[data-codex-session-resume-state="timed_out"] .web-cc-main > #root {
      visibility: hidden;
    }

    html[data-codex-session-resume-state="resuming"] .codex-resume-overlay,
    html[data-codex-session-resume-state="timed_out"] .codex-resume-overlay {
      display: flex;
    }

  </style>`;
  const shellNav = `<div class="web-cc-wrapper"><nav class="web-cc-nav"><div class="web-cc-nav-left"><a href="/">← Projects</a><span class="nav-separator">/</span><span class="nav-project" title="${escapeHtml(projectPath)}">${escapeHtml(projectName)}</span></div><div class="web-cc-nav-right"><button class="nav-theme-btn" type="button" onclick="toggleCodexShellTheme()" title="Theme"><span class="theme-icon"></span></button><button class="nav-theme-btn" type="button" onclick="location.reload()" title="Reload">&#x21BB;</button></div></nav>`;

  return rawHtml
    .replace("<title>Codex</title>", `<title>${escapeHtml(projectName)} · Codex</title>`)
    .replace("<!-- PROD_BASE_TAG_HERE -->", '<base href="/webview/">')
    .replace(
      "<!-- PROD_CSP_TAG_HERE -->",
      "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; connect-src 'self' ws: wss: https: data:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; worker-src 'self' blob:;\">",
    )
    .replace(
      "</head>",
      `${pwaHeadTags}${themeScript}${shellRuntimeScript}${shellStyle}${injectedShim}${pwaRegisterScript}</head>`,
    )
    .replace(/<body([^>]*)>/, `<body$1>${shellNav}`)
    .replace(
      '<div id="root">',
      '<main class="web-cc-main"><div class="codex-resume-overlay" aria-hidden="true"><div class="codex-resume-overlay-copy"><div class="codex-resume-overlay-spinner"></div><div class="codex-resume-overlay-title" id="codex-resume-overlay-title">Restoring session</div><div class="codex-resume-overlay-subtitle" id="codex-resume-overlay-subtitle">正在恢复当前会话，恢复完成后会自动显示。</div><button class="codex-resume-overlay-retry" id="codex-resume-overlay-retry" type="button" onclick="location.reload()">刷新重试</button></div></div><div id="root">',
    )
    .replace("</body>", "</main></div></body>");
}
