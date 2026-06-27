(function () {
  const GLOBAL_DISABLED_KEY = "map-ai-global-disabled-v1";
  const PROJECT_SETTINGS_PREFIX = "map-ai-settings-v1:";
  const PROJECT_HISTORY_PREFIX = "map-ai-history-v1:";
  const DEFAULT_MODEL = "deepseek-v4-flash";
  const AVAILABLE_MODELS = [
    { value: "deepseek-v4-flash", label: "deepseek-v4-flash" },
    { value: "deepseek-v4-pro", label: "deepseek-v4-pro" }
  ];
  const MAX_HISTORY_MESSAGES = 20;

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function projectId() {
    const params = new URLSearchParams(location.search);
    const queryProject = params.get("project");
    if (queryProject) return queryProject;
    const province = params.get("province");
    if (location.pathname.includes("province_county_map")) return `province-county:${province || "330000"}:default`;
    return localStorage.getItem("china-prefecture-map-active-scheme-v1") || "national:default";
  }

  function pageType() {
    return location.pathname.includes("province_county_map") ? "省份县级地图" : "全国地级市地图";
  }

  function projectName(id) {
    const projects = readJson("map-projects-v1", []);
    const matched = Array.isArray(projects) ? projects.find((item) => item?.id === id) : null;
    if (matched?.name) return matched.name;
    const title = $("#pageTitle")?.textContent?.trim();
    if (title) return title;
    const scheme = $("#activeSchemeName")?.textContent?.replace(/^当前方案：/, "").trim();
    return scheme || pageType();
  }

  function settingsKey() {
    return `${PROJECT_SETTINGS_PREFIX}${projectId()}`;
  }

  function historyKey() {
    return `${PROJECT_HISTORY_PREFIX}${projectId()}`;
  }

  function readSettings() {
    const raw = readJson(settingsKey(), {});
    return {
      enabled: Boolean(raw.enabled),
      apiKey: String(raw.apiKey || ""),
      model: AVAILABLE_MODELS.some((item) => item.value === raw.model) ? raw.model : DEFAULT_MODEL
    };
  }

  function saveSettings(settings) {
    writeJson(settingsKey(), settings);
  }

  function globalDisabled() {
    return localStorage.getItem(GLOBAL_DISABLED_KEY) === "1";
  }

  function ensureStyle() {
    if ($("#mapAiPanelStyle")) return;
    const style = document.createElement("style");
    style.id = "mapAiPanelStyle";
    style.textContent = `
      .ai-assistant-panel {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 1600;
        width: min(430px, calc(100vw - 32px));
        max-height: min(680px, calc(100vh - 48px));
        display: grid;
        grid-template-rows: auto auto minmax(150px, 1fr) auto;
        gap: 10px;
        padding: 14px;
        border: 1px solid rgba(30, 67, 72, 0.18);
        border-radius: 9px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 18px 46px rgba(32, 50, 58, 0.20);
        color: #1f2a31;
      }
      .ai-assistant-panel.hidden { display: none; }
      .ai-assistant-head {
        cursor: move;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-right: 32px;
      }
      .ai-assistant-title { font-size: 17px; font-weight: 900; }
      .ai-assistant-status { color: #60737a; font-size: 12px; line-height: 1.45; }
      .ai-assistant-status.warn { color: #aa4b33; font-weight: 800; }
      .ai-assistant-config {
        display: grid;
        grid-template-columns: 1fr 160px;
        gap: 8px;
      }
      .ai-assistant-config label,
      .ai-assistant-input label {
        display: grid;
        gap: 5px;
        color: #52636c;
        font-size: 12px;
        font-weight: 800;
      }
      .ai-assistant-config input,
      .ai-assistant-config select,
      .ai-assistant-input textarea {
        width: 100%;
        border: 1px solid #cbd8dc;
        border-radius: 7px;
        background: #fff;
        color: #25333a;
        font: inherit;
      }
      .ai-assistant-config input,
      .ai-assistant-config select { height: 36px; padding: 0 9px; }
      .ai-assistant-actions {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ai-assistant-actions button,
      .ai-assistant-input button {
        height: 34px;
        border: 1px solid #cbd8dc;
        border-radius: 7px;
        background: #fff;
        color: #25333a;
        cursor: pointer;
        font: inherit;
        font-weight: 800;
        padding: 0 12px;
      }
      .ai-assistant-actions .primary,
      .ai-assistant-input .primary {
        border-color: #2f7f83;
        background: #2f7f83;
        color: #fff;
      }
      .ai-assistant-actions .danger { border-color: #c58f80; color: #b1472f; }
      .ai-assistant-messages {
        overflow: auto;
        display: grid;
        align-content: start;
        gap: 8px;
        min-height: 150px;
        border: 1px solid #d8e4e8;
        border-radius: 8px;
        background: #f8fbfb;
        padding: 10px;
      }
      .ai-message {
        max-width: 92%;
        white-space: pre-wrap;
        line-height: 1.48;
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 13px;
      }
      .ai-message.user { justify-self: end; background: #2f7f83; color: #fff; }
      .ai-message.assistant { justify-self: start; background: #e8f1f1; color: #24343a; }
      .ai-message.system { justify-self: center; max-width: 100%; background: transparent; color: #6a7b82; padding: 2px; }
      .ai-assistant-input { display: grid; gap: 8px; }
      .ai-assistant-input textarea { min-height: 76px; resize: vertical; padding: 9px; }
      .ai-assistant-input .row { display: flex; justify-content: flex-end; gap: 8px; }
      @media (max-width: 720px) {
        .ai-assistant-panel { left: 12px; right: 12px; bottom: 12px; width: auto; }
        .ai-assistant-config { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function clampPanel(panel) {
    const rect = panel.getBoundingClientRect();
    const minVisible = 80;
    let left = rect.left;
    let top = rect.top;
    left = Math.min(window.innerWidth - minVisible, Math.max(-rect.width + minVisible, left));
    top = Math.min(window.innerHeight - minVisible, Math.max(0, top));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function makeDraggable(panel, handle) {
    let state = null;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button, input, select, textarea")) return;
      const rect = panel.getBoundingClientRect();
      state = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      handle.setPointerCapture(event.pointerId);
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!state) return;
      panel.style.left = `${event.clientX - state.dx}px`;
      panel.style.top = `${event.clientY - state.dy}px`;
      clampPanel(panel);
    });
    handle.addEventListener("pointerup", () => { state = null; });
    window.addEventListener("resize", () => clampPanel(panel));
  }

  function pageActionContext() {
    const bridge = window.mapProjectAiBridge;
    if (!bridge || typeof bridge.getContext !== "function") return null;
    try {
      return bridge.getContext();
    } catch (error) {
      return null;
    }
  }

  function actionInstruction(context) {
    const actions = Array.isArray(context?.actions) ? context.actions : [];
    if (!context || (!actions.includes("updateFillRule") && !actions.includes("equalCountBuckets") && !actions.includes("updatePlaybackAnimation"))) {
      return "This page does not support direct AI setting changes. Answer normal questions directly in Chinese.";
    }
    return [
      "This page supports safe actions. They change only the current project's whitelisted map settings.",
      "When, and only when, the user clearly asks you to modify/apply color fill rules, buckets, gradients, colors, boundaries, equal-count segments, rule text, or playback animation settings, return strict JSON only. Do not wrap it in Markdown.",
      "JSON shape: {\"reply\":\"short Chinese message for the user\",\"actions\":[{\"type\":\"updateFillRule\",\"settings\":{...}}]}. For animation, use {\"type\":\"updatePlaybackAnimation\",\"settings\":{...}}.",
      "Supported action types:",
      "- updateFillRule: directly updates fill-rule settings.",
      "- equalCountBuckets: lets the page compute bucket boundaries from the current rankData so each bucket has a similar number of regions. Shape: {\"type\":\"equalCountBuckets\",\"settings\":{\"bucketCount\":7,\"fillDataIndex\":0}}.",
      "- topCountThenEqualBuckets: keeps the highest N regions in the top color bucket and splits the remaining regions into the other buckets by similar counts. Shape: {\"type\":\"topCountThenEqualBuckets\",\"settings\":{\"topCount\":10,\"bucketCount\":8,\"legendDecimalPlaces\":1}}.",
      "- updatePlaybackAnimation: updates only playback animation settings. Shape: {\"type\":\"updatePlaybackAnimation\",\"settings\":{\"mode\":\"outline\",\"duration\":650,\"scale\":1.18,\"direction\":\"center\",\"easing\":\"ease-out\",\"color\":\"#e07b51\",\"fillOpacity\":0.28,\"outlineWidth\":3}}.",
      "Allowed fill settings keys: mode, numericFillType, numericMode, fillDataIndex, excelDataColumn, bucketCount, bucketBoundaries, boundaries, bucketColors, gradientLowColor, gradientHighColor, gradientProcess, gradientIntensity, rulesText, bucketLegendLabels, legendLabels, legendDecimalPlaces, topCount, legendBarWidth, legendBarHeight, legendLabelFontSize, bucketLegendBarWidth, bucketLegendBarHeight, bucketLegendLabelFontSize. Allowed animation keys: mode, animationMode, playbackAnimationMode, duration, animationDuration, playbackAnimationDuration, scale, animationScale, playbackAnimationScale, direction, animationDirection, playbackAnimationDirection, easing, animationEasing, playbackAnimationEasing, color, highlightColor, animationColor, playbackAnimationColor, fillOpacity, animationFillOpacity, playbackAnimationFillOpacity, outlineWidth, animationOutlineWidth, playbackAnimationOutlineWidth.",
      "Colors must be #RRGGBB. bucketCount is 2-12. fillDataIndex is 0-7. excelDataColumn is 1-8. legendBarWidth is 180-1200 px, legendBarHeight is 8-80 px, legendLabelFontSize is 8-48 px; these only change display size, not fill boundaries. Animation mode is none/outline/pop/fly/fly-left/fly-right/fly-top/fly-bottom/flash/halo/draw/drop; duration is 80-6000 ms; scale is 1-3; fillOpacity is 0-0.8; outlineWidth is 1-12.",
      "Example bucket settings: {\"numericFillType\":\"buckets\",\"bucketCount\":7,\"bucketBoundaries\":\"0 10 20 30 40 50 60 70\",\"bucketColors\":[\"#3f58b8\",\"#4d86cc\",\"#59aabd\",\"#58a565\",\"#d7c94d\",\"#e2933c\",\"#c95347\"]}.",
      "Example gradient settings: {\"numericFillType\":\"gradient\",\"gradientLowColor\":\"#5aa39a\",\"gradientHighColor\":\"#df7657\",\"gradientIntensity\":80}.",
      "The current page context includes rankData rows and active numeric values. Do not ask the user to provide city/value lists if rankData.count is greater than 0.",
      "If the user asks for roughly equal numbers of cities/regions per color segment and rankData.count is greater than 0, do not ask for data and do not merely explain. Return JSON with actions:[{type:'equalCountBuckets',settings:{bucketCount: fillRule.bucketCount || 7}}].",
      "If the user asks for the highest/top N cities/regions to occupy one color bucket and the rest to be split evenly, use topCountThenEqualBuckets instead of updateFillRule.",
      "If the user is only asking for explanation/advice, answer in natural Chinese and do not return JSON.",
      "Current page context: " + JSON.stringify(context)
    ].join("\n");
  }

  function extractActionPayload(content) {
    const raw = String(content || "").trim();
    if (!raw) return null;
    const fence = String.fromCharCode(96, 96, 96);
    const candidates = [];
    const jsonFence = raw.match(new RegExp(fence + "json\\s*([\\s\\S]*?)" + fence, "i"));
    const anyFence = raw.match(new RegExp(fence + "\\s*([\\s\\S]*?)" + fence, "i"));
    if (jsonFence) candidates.push(jsonFence[1]);
    if (anyFence) candidates.push(anyFence[1]);
    candidates.push(raw);
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first >= 0 && last > first) candidates.push(raw.slice(first, last + 1));
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(String(candidate || "").trim());
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.actions)) {
          return parsed;
        }
      } catch (error) {
        // Keep trying other shapes.
      }
    }
    return null;
  }

  function applyActionPayload(payload) {
    const actions = Array.isArray(payload?.actions) ? payload.actions : [];
    if (!actions.length) return "";
    const bridge = window.mapProjectAiBridge;
    if (!bridge || typeof bridge.applyActions !== "function") {
      return "\u5f53\u524d\u9875\u9762\u4e0d\u80fd\u5e94\u7528 AI \u8bbe\u7f6e\u52a8\u4f5c\u3002";
    }
    try {
      const result = bridge.applyActions(actions);
      return result?.message || "\u8bbe\u7f6e\u5df2\u5e94\u7528\u3002";
    } catch (error) {
      return "\u5e94\u7528\u8bbe\u7f6e\u5931\u8d25\uff1a" + (error?.message || error);
    }
  }

  function buildPanel() {
    ensureStyle();
    const controls = $(".topbar .controls") || $("#topbar .controls");
    if (!controls || $("#aiAssistantButton")) return;

    const button = document.createElement("button");
    button.id = "aiAssistantButton";
    button.type = "button";
    button.className = "button panel-toggle";
    button.textContent = "AI";
    button.title = "打开 DeepSeek 临时对话窗口";
    const before = $("#toolbarClose");
    controls.insertBefore(button, before && before.parentElement === controls ? before : null);

    const panel = document.createElement("section");
    panel.id = "aiAssistantPanel";
    panel.className = "ai-assistant-panel hidden";
    panel.innerHTML = `
      <button id="aiPanelHide" class="panel-close floating-close" type="button" aria-label="隐藏AI窗口">×</button>
      <div class="ai-assistant-head" id="aiPanelHead">
        <div>
          <div class="ai-assistant-title">AI 临时助手</div>
          <div id="aiStatus" class="ai-assistant-status"></div>
        </div>
      </div>
      <div class="ai-assistant-config">
        <label>DeepSeek API Key<input id="aiApiKey" type="password" autocomplete="off" placeholder="sk-..."></label>
        <label>模型<select id="aiModel"></select></label>
        <div class="ai-assistant-actions">
          <button id="aiSave" class="primary" type="button">启用并保存</button>
          <button id="aiDisable" class="danger" type="button">关闭API</button>
          <button id="aiClear" type="button">清空对话</button>
        </div>
      </div>
      <div id="aiMessages" class="ai-assistant-messages" aria-live="polite"></div>
      <div class="ai-assistant-input">
        <label>临时问题<textarea id="aiPrompt" placeholder="例如：帮我判断这个分段设置是否合理，或给我一个修改建议"></textarea></label>
        <div class="row"><button id="aiSend" class="primary" type="button">发送</button></div>
      </div>
    `;
    document.body.appendChild(panel);

    const id = projectId();
    const modelSelect = $("#aiModel", panel);
    AVAILABLE_MODELS.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      modelSelect.appendChild(option);
    });

    const apiKeyInput = $("#aiApiKey", panel);
    const status = $("#aiStatus", panel);
    const messagesBox = $("#aiMessages", panel);
    const promptInput = $("#aiPrompt", panel);
    const sendButton = $("#aiSend", panel);
    const saveButton = $("#aiSave", panel);
    const disableButton = $("#aiDisable", panel);
    const clearButton = $("#aiClear", panel);
    const hideButton = $("#aiPanelHide", panel);

    let settings = readSettings();
    let history = readJson(historyKey(), []);
    if (!Array.isArray(history)) history = [];
    apiKeyInput.value = settings.apiKey;
    modelSelect.value = settings.model;

    function persistHistory() {
      writeJson(historyKey(), history.slice(-MAX_HISTORY_MESSAGES));
    }

    function appendMessage(role, content, persist = true) {
      const message = { role, content: String(content || "") };
      if (persist && role !== "system") {
        history.push(message);
        history = history.slice(-MAX_HISTORY_MESSAGES);
        persistHistory();
      }
      renderMessages();
    }

    function renderMessages() {
      messagesBox.innerHTML = "";
      if (!history.length) {
        const empty = document.createElement("div");
        empty.className = "ai-message system";
        empty.textContent = "输入 API Key 并启用后，可以向 DeepSeek 提问。";
        messagesBox.appendChild(empty);
      }
      history.forEach((message) => {
        const item = document.createElement("div");
        item.className = `ai-message ${message.role === "user" ? "user" : "assistant"}`;
        item.textContent = message.content;
        messagesBox.appendChild(item);
      });
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function syncStatus() {
      const disabledAll = globalDisabled();
      button.classList.toggle("active", !panel.classList.contains("hidden"));
      button.classList.toggle("danger", disabledAll || !settings.enabled);
      if (disabledAll) {
        status.className = "ai-assistant-status warn";
        status.textContent = "主界面已禁用所有项目 API，本项目不能调用 DeepSeek。";
        return;
      }
      status.className = "ai-assistant-status";
      status.textContent = settings.enabled
        ? `${projectName(id)} · 已启用 · ${settings.model}`
        : `${projectName(id)} · 本项目 API 已关闭`;
    }

    async function send() {
      if (globalDisabled()) {
        alert("主界面已经禁用所有项目 API，请先回主界面解除禁用。");
        syncStatus();
        return;
      }
      settings = readSettings();
      if (!settings.enabled || !settings.apiKey) {
        alert("该项目 API 已关闭。请先输入 DeepSeek API Key，并点击“启用并保存”。");
        return;
      }
      const prompt = promptInput.value.trim();
      if (!prompt) {
        promptInput.focus();
        return;
      }
      if (!window.deepseekBridge?.chat) {
        alert("当前不是 Electron 应用环境，无法调用 DeepSeek API。请在封装应用中使用。 ");
        return;
      }
      promptInput.value = "";
      appendMessage("user", prompt);
      sendButton.disabled = true;
      sendButton.textContent = "发送中";
      try {
        const currentActionContext = pageActionContext();
        const system = [
          "你是本地地图填色项目里的临时助手。",
          "请用中文简洁回答。",
          "你可以帮助用户判断、设计或调整本项目的临时设置。",
          "如果你返回了受支持的 JSON 动作，页面会在校验后真正应用设置；否则你只是普通对话。",
          `当前项目：${projectName(id)}`,
          `地图类型：${pageType()}`,
          actionInstruction(currentActionContext)
        ].join("\n");
        const content = await window.deepseekBridge.chat({
          apiKey: settings.apiKey,
          model: settings.model,
          messages: [
            { role: "system", content: system },
            ...history.slice(-MAX_HISTORY_MESSAGES).map((item) => ({ role: item.role, content: item.content }))
          ]
        });
        const actionPayload = extractActionPayload(content);
        if (actionPayload) {
          const appliedMessage = applyActionPayload(actionPayload);
          appendMessage("assistant", appliedMessage || "页面没有返回可确认的执行结果。");
        } else {
          appendMessage("assistant", content);
        }
      } catch (error) {
        appendMessage("assistant", `调用失败：${error?.message || error}`, false);
      } finally {
        sendButton.disabled = false;
        sendButton.textContent = "发送";
      }
    }

    saveButton.addEventListener("click", () => {
      if (globalDisabled()) {
        alert("主界面已经禁用所有项目 API，当前项目不能启用。 ");
        syncStatus();
        return;
      }
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        apiKeyInput.focus();
        return;
      }
      settings = { enabled: true, apiKey, model: modelSelect.value || DEFAULT_MODEL };
      saveSettings(settings);
      syncStatus();
    });

    disableButton.addEventListener("click", () => {
      settings = { enabled: false, apiKey: "", model: modelSelect.value || DEFAULT_MODEL };
      saveSettings(settings);
      apiKeyInput.value = "";
      syncStatus();
    });

    modelSelect.addEventListener("change", () => {
      settings = { ...readSettings(), model: modelSelect.value || DEFAULT_MODEL };
      saveSettings(settings);
      syncStatus();
    });

    clearButton.addEventListener("click", () => {
      history = [];
      persistHistory();
      renderMessages();
    });

    sendButton.addEventListener("click", send);
    promptInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) send();
    });
    button.addEventListener("click", () => {
      panel.classList.toggle("hidden");
      syncStatus();
      if (!panel.classList.contains("hidden")) setTimeout(() => clampPanel(panel), 0);
    });
    hideButton.addEventListener("click", () => {
      panel.classList.add("hidden");
      syncStatus();
    });
    window.addEventListener("storage", syncStatus);
    makeDraggable(panel, $("#aiPanelHead", panel));
    renderMessages();
    syncStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildPanel);
  } else {
    buildPanel();
  }
})();



