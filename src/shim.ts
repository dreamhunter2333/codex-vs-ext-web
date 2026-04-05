import { bridgePath } from "./config.js";

export function buildInjectedShim(projectPath: string): string {
  const stateKey = "__codex_vs_ext_web_state";
  const bridgeUrl = `${bridgePath}`;
  const themeStorageKey = "web-cc-theme";

  return `<script>
(function () {
  var queue = [];
  var socket = null;
  var state = null;
  var stateKey = ${JSON.stringify(stateKey)};
  var bridgePath = ${JSON.stringify(bridgeUrl)};
  var projectPath = ${JSON.stringify(projectPath)};
  var themeStorageKey = ${JSON.stringify(themeStorageKey)};
  var themeConfigKeys = {
    appearanceTheme: true,
    appearanceLightChromeTheme: true,
    appearanceDarkChromeTheme: true,
    appearanceLightCodeThemeId: true,
    appearanceDarkCodeThemeId: true
  };

  try {
    var raw = window.sessionStorage.getItem(stateKey);
    state = raw ? JSON.parse(raw) : null;
  } catch (_) {
    state = null;
  }

  function dispatchToView(message) {
    window.postMessage(message, window.location.origin);
  }

  function getStoredTheme() {
    try {
      return window.localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";
    } catch (_) {
      return "dark";
    }
  }

  function applyTheme(theme) {
    var nextTheme = theme === "light" ? "light" : "dark";
    var nextClass = nextTheme === "light" ? "vscode-light" : "vscode-dark";
    document.documentElement.classList.remove("vscode-dark", "vscode-light");
    document.documentElement.classList.add(nextClass);
    if (document.body) {
      document.body.classList.remove("vscode-dark", "vscode-light");
      document.body.classList.add(nextClass);
    }
  }

  function getThemeConfigurationValue(key) {
    var theme = getStoredTheme();
    if (key === "appearanceTheme") {
      return theme;
    }
    if (key === "appearanceLightChromeTheme") {
      return "GitHub Light";
    }
    if (key === "appearanceDarkChromeTheme") {
      return "GitHub Dark";
    }
    if (key === "appearanceLightCodeThemeId") {
      return "github-light-default";
    }
    if (key === "appearanceDarkCodeThemeId") {
      return "github-dark-default";
    }
    return null;
  }

  function handleThemeConfigurationRequest(message) {
    if (!message || message.type !== "fetch" || typeof message.url !== "string") {
      return false;
    }

    if (typeof message.requestId !== "string" || !message.requestId) {
      return false;
    }

    if (message.url !== "vscode://codex/get-configuration" && message.url !== "vscode://codex/set-configuration") {
      return false;
    }

    var body = message.body && typeof message.body === "object" ? message.body : {};
    var key = typeof body.key === "string" ? body.key : "";
    if (!themeConfigKeys[key]) {
      return false;
    }

    if (message.url === "vscode://codex/get-configuration") {
      dispatchToView({
        type: "fetch-response",
        requestId: message.requestId,
        responseType: "success",
        status: 200,
        headers: {
          "content-type": "application/json"
        },
        bodyJsonString: JSON.stringify({
          value: getThemeConfigurationValue(key)
        })
      });
      return true;
    }

    if (key === "appearanceTheme") {
      var theme = body.value === "light" ? "light" : "dark";
      try {
        window.localStorage.setItem(themeStorageKey, theme);
      } catch (_) {}
      applyTheme(theme);
    }

    dispatchToView({
      type: "fetch-response",
      requestId: message.requestId,
      responseType: "success",
      status: 200,
      headers: {
        "content-type": "application/json"
      },
      bodyJsonString: JSON.stringify({
        success: true
      })
    });
    return true;
  }

  function flushQueue() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    while (queue.length > 0) {
      socket.send(queue.shift());
    }
  }

  function send(message) {
    var payload = JSON.stringify(message);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      queue.push(payload);
      return;
    }

    socket.send(payload);
  }

  function encodeProjectParam(value) {
    if (!value) {
      return "";
    }

    try {
      var bytes = new TextEncoder().encode(value);
      var binary = "";
      bytes.forEach(function (byte) {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary);
    } catch (_) {
      return "";
    }
  }

  function connect() {
    var protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    var url = new URL(protocol + "//" + window.location.host + bridgePath);
    if (projectPath) {
      url.searchParams.set("project", encodeProjectParam(projectPath));
    }
    socket = new WebSocket(url);
    socket.addEventListener("open", flushQueue);
    socket.addEventListener("message", function (event) {
      try {
        dispatchToView(JSON.parse(String(event.data)));
      } catch (error) {
        console.error("[codex-vs-ext-web] bridge message parse failed", error);
      }
    });
    socket.addEventListener("close", function () {
      window.setTimeout(connect, 1000);
    });
    socket.addEventListener("error", function () {
      try {
        socket.close();
      } catch (_) {}
    });
  }

  connect();

  window.acquireVsCodeApi = function () {
    return {
      postMessage: function (message) {
        if (handleThemeConfigurationRequest(message)) {
          return;
        }
        send(message);
      },
      setState: function (value) {
        state = value;
        try {
          window.sessionStorage.setItem(stateKey, JSON.stringify(value));
        } catch (_) {}
        return value;
      },
      getState: function () {
        return state;
      }
    };
  };
})();
</script>`;
}
