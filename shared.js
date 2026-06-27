(function () {
  const DEFAULT_BUCKET_COLORS = ["#3151b7", "#2a84d2", "#27a9c2", "#2fa75f", "#d9c73d", "#ee8b2c", "#d84d3f"];
  const DEFAULT_BUCKET_COUNT = 7;
  const DEFAULT_RANK_ROW_COLORS = { odd: "#d8f0e3", even: "#f7fcf9" };
  const DEFAULT_NUMBER_FORMAT_SETTINGS = { numberFormat: "decimal", decimalPlaces: 2, significantDigits: 3, totalDigits: 5 };
  const RANK_DATA_COLUMN_COUNT = 8;
  const RANK_BASE_COLUMN_COUNT = 3;
  const RANK_DATA_COLUMNS = Array.from({ length: RANK_DATA_COLUMN_COUNT }, (_, index) => ({
    key: `data${index + 1}`,
    label: `数据${index + 1}`
  }));
  const RANK_COLUMNS = [
    { key: "totalRank", label: "总排名" },
    { key: "provinceRank", label: "省内" },
    { key: "cityName", label: "城市" },
    ...RANK_DATA_COLUMNS
  ];
  const KEYS = {
    legacyColors: "china-prefecture-map-colors-v1",
    schemeCatalog: "china-prefecture-map-schemes-v1",
    activeScheme: "china-prefecture-map-active-scheme-v1",
    schemeDataPrefix: "china-prefecture-map-scheme-colors-v1:",
    playbackPrefix: "china-prefecture-map-playback-data-v1:",
    rankSettingsPrefix: "china-prefecture-map-rank-settings-v1:",
    excelRuleSettingsPrefix: "china-prefecture-map-excel-rule-settings-v1:",
    customInfoPrefix: "china-prefecture-map-custom-info-v1:",
    ignoreSchemes: "china-prefecture-map-ignore-schemes-v1",
    ignoreLegacyNonPrefecture: "china-prefecture-map-ignore-non-prefecture-v1",
    cityIndex: "china-prefecture-map-city-index-v1",
    rankRowColors: "china-prefecture-map-rank-row-colors-v1"
  };

  function asAdcode(value) {
    return String(value || "").padStart(6, "0");
  }

  function isHexColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  function boundedInteger(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(number)));
  }

  function safeJson(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function makeId(prefix) {
    if (window.crypto?.randomUUID) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cleanColorMap(value) {
    const colors = {};
    if (!value || typeof value !== "object") return colors;
    Object.entries(value).forEach(([adcode, color]) => {
      const code = asAdcode(adcode);
      if (/^\d{6}$/.test(code) && isHexColor(color)) {
        colors[code] = String(color).toLowerCase();
      }
    });
    return colors;
  }

  function readColors(schemeId) {
    return cleanColorMap(safeJson(localStorage.getItem(`${KEYS.schemeDataPrefix}${schemeId}`), {}));
  }

  function writeColors(schemeId, colors) {
    localStorage.setItem(`${KEYS.schemeDataPrefix}${schemeId}`, JSON.stringify(cleanColorMap(colors)));
  }

  function defaultSchemeState() {
    const defaultId = "default";
    const defaultScheme = {
      id: defaultId,
      name: "默认方案",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    localStorage.setItem(KEYS.schemeCatalog, JSON.stringify([defaultScheme]));
    localStorage.setItem(KEYS.activeScheme, defaultId);
    writeColors(defaultId, safeJson(localStorage.getItem(KEYS.legacyColors), {}));
    return { catalog: [defaultScheme], activeId: defaultId };
  }

  function readSchemeState() {
    const catalog = safeJson(localStorage.getItem(KEYS.schemeCatalog), [])
      .filter((scheme) => scheme && scheme.id && scheme.name)
      .map((scheme) => ({
        id: String(scheme.id),
        name: String(scheme.name || "未命名方案"),
        createdAt: Number(scheme.createdAt) || Date.now(),
        updatedAt: Number(scheme.updatedAt) || Date.now()
      }));
    if (!catalog.length) return defaultSchemeState();
    const storedActiveId = localStorage.getItem(KEYS.activeScheme);
    const activeId = catalog.some((scheme) => scheme.id === storedActiveId) ? storedActiveId : catalog[0].id;
    localStorage.setItem(KEYS.schemeCatalog, JSON.stringify(catalog));
    localStorage.setItem(KEYS.activeScheme, activeId);
    return { catalog, activeId };
  }

  function writeSchemeState(catalog, activeId) {
    const cleanCatalog = catalog
      .filter((scheme) => scheme && scheme.id && scheme.name)
      .map((scheme) => ({
        id: String(scheme.id),
        name: String(scheme.name).trim() || "未命名方案",
        createdAt: Number(scheme.createdAt) || Date.now(),
        updatedAt: Number(scheme.updatedAt) || Date.now()
      }));
    const nextActive = cleanCatalog.some((scheme) => scheme.id === activeId) ? activeId : cleanCatalog[0]?.id;
    localStorage.setItem(KEYS.schemeCatalog, JSON.stringify(cleanCatalog));
    if (nextActive) localStorage.setItem(KEYS.activeScheme, nextActive);
    return { catalog: cleanCatalog, activeId: nextActive };
  }

  function activeSchemeId() {
    return readSchemeState().activeId;
  }

  function touchScheme(schemeId) {
    const state = readSchemeState();
    const scheme = state.catalog.find((item) => item.id === schemeId);
    if (scheme) {
      scheme.updatedAt = Date.now();
      writeSchemeState(state.catalog, state.activeId);
    }
  }

  function rankSettingsKey(schemeId) {
    return `${KEYS.rankSettingsPrefix}${schemeId}`;
  }

  function defaultRankSettings() {
    return {
      visibleRows: 10,
      columnCount: 4,
      columnTitles: RANK_COLUMNS.map((column) => column.label),
      columnWidths: [80, 110, 130, ...Array.from({ length: RANK_DATA_COLUMN_COUNT }, () => 90)],
      numberFormat: "decimal",
      decimalPlaces: 2,
      significantDigits: 3,
      totalDigits: 5,
      dataFormats: Array.from({ length: RANK_DATA_COLUMN_COUNT }, () => ({ ...DEFAULT_NUMBER_FORMAT_SETTINGS }))
    };
  }

  function sanitizeNumberFormatSettings(settings = {}, fallback = DEFAULT_NUMBER_FORMAT_SETTINGS) {
    const formats = new Set(["text", "decimal", "significant", "totalDigits"]);
    return {
      numberFormat: formats.has(settings.numberFormat) ? settings.numberFormat : fallback.numberFormat,
      decimalPlaces: boundedInteger(settings.decimalPlaces, 0, 6, fallback.decimalPlaces),
      significantDigits: boundedInteger(settings.significantDigits, 1, 10, fallback.significantDigits),
      totalDigits: boundedInteger(settings.totalDigits, 1, 15, fallback.totalDigits)
    };
  }

  function sanitizeRankSettings(settings = {}, fallback = defaultRankSettings()) {
    const source = settings && typeof settings === "object" ? settings : {};
    const columnCount = boundedInteger(source.columnCount, 1, RANK_COLUMNS.length, fallback.columnCount);
    return {
      visibleRows: boundedInteger(source.visibleRows, 1, 100, fallback.visibleRows),
      columnCount,
      columnTitles: Array.from({ length: RANK_COLUMNS.length }, (_, index) => {
        const title = String(source.columnTitles?.[index] ?? fallback.columnTitles?.[index] ?? RANK_COLUMNS[index].label).trim();
        return title || RANK_COLUMNS[index].label;
      }),
      columnWidths: Array.from({ length: RANK_COLUMNS.length }, (_, index) => boundedInteger(source.columnWidths?.[index], 44, 220, fallback.columnWidths?.[index] || 90)),
      numberFormat: sanitizeNumberFormatSettings(source, fallback).numberFormat,
      decimalPlaces: sanitizeNumberFormatSettings(source, fallback).decimalPlaces,
      significantDigits: sanitizeNumberFormatSettings(source, fallback).significantDigits,
      totalDigits: sanitizeNumberFormatSettings(source, fallback).totalDigits,
      dataFormats: Array.from({ length: RANK_DATA_COLUMN_COUNT }, (_, index) => sanitizeNumberFormatSettings(source.dataFormats?.[index], fallback.dataFormats?.[index] || DEFAULT_NUMBER_FORMAT_SETTINGS))
    };
  }

  function readRankSettings(schemeId = activeSchemeId()) {
    return sanitizeRankSettings(safeJson(localStorage.getItem(rankSettingsKey(schemeId)), {}));
  }

  function writeRankSettings(schemeId, settings) {
    localStorage.setItem(rankSettingsKey(schemeId), JSON.stringify(sanitizeRankSettings(settings)));
    touchScheme(schemeId);
  }

  function excelRuleSettingsKey(schemeId) {
    return `${KEYS.excelRuleSettingsPrefix}${schemeId}`;
  }

  function defaultExcelRuleSettings() {
    return {
      mode: "auto",
      valueColumn: "",
      fillDataIndex: 0,
      rulesText: "",
      gradientHighColor: "#e76f51",
      gradientLowColor: "#2a9d8f",
      gradientProcess: "linear",
      gradientIntensity: 100,
      numericFillType: "buckets",
      bucketCount: DEFAULT_BUCKET_COUNT,
      bucketBoundaries: "",
      bucketColors: [...DEFAULT_BUCKET_COLORS],
      bucketLegendLabels: [],
      bucketLegendDefaultLabels: [],
      bucketLegendBarWidth: 500,
      bucketLegendBarHeight: 22,
      bucketLegendLabelFontSize: 13
    };
  }

  function normalizeBucketColors(colors, count) {
    const source = Array.isArray(colors) ? colors : [];
    return Array.from({ length: count }, (_, index) => {
      const color = source[index] || DEFAULT_BUCKET_COLORS[index % DEFAULT_BUCKET_COLORS.length];
      return isHexColor(color) ? String(color).toLowerCase() : DEFAULT_BUCKET_COLORS[index % DEFAULT_BUCKET_COLORS.length];
    });
  }

  function sanitizeExcelRuleSettings(settings = {}, fallback = defaultExcelRuleSettings()) {
    const source = settings && typeof settings === "object" ? settings : {};
    const modes = new Set(["auto", "numeric", "rules", "color", "single"]);
    const processModes = new Set(["linear", "smooth", "stepped", "high", "low"]);
    const legacyNumericMode = source.mode === "gradient" || source.mode === "buckets" ? source.mode : "";
    const bucketCount = boundedInteger(source.bucketCount, 2, 12, fallback.bucketCount || DEFAULT_BUCKET_COUNT);
    return {
      mode: legacyNumericMode ? "numeric" : (modes.has(source.mode) ? source.mode : fallback.mode),
      valueColumn: String(source.valueColumn ?? fallback.valueColumn ?? ""),
      fillDataIndex: boundedInteger(source.fillDataIndex, 0, RANK_DATA_COLUMN_COUNT - 1, fallback.fillDataIndex ?? 0),
      rulesText: String(source.rulesText ?? fallback.rulesText ?? ""),
      gradientHighColor: isHexColor(source.gradientHighColor) ? String(source.gradientHighColor).toLowerCase() : fallback.gradientHighColor,
      gradientLowColor: isHexColor(source.gradientLowColor) ? String(source.gradientLowColor).toLowerCase() : fallback.gradientLowColor,
      gradientProcess: processModes.has(source.gradientProcess) ? source.gradientProcess : fallback.gradientProcess,
      gradientIntensity: boundedInteger(source.gradientIntensity, 20, 100, fallback.gradientIntensity),
      numericFillType: legacyNumericMode === "gradient" || source.numericFillType === "gradient" ? "gradient" : "buckets",
      bucketCount,
      bucketBoundaries: String(source.bucketBoundaries ?? fallback.bucketBoundaries ?? ""),
      bucketColors: normalizeBucketColors(source.bucketColors || fallback.bucketColors, bucketCount),
      bucketLegendLabels: Array.isArray(source.bucketLegendLabels) ? source.bucketLegendLabels.map((label) => String(label ?? "")) : [],
      bucketLegendDefaultLabels: Array.isArray(source.bucketLegendDefaultLabels) ? source.bucketLegendDefaultLabels.map((label) => String(label ?? "")) : [],
      bucketLegendBarWidth: boundedInteger(source.bucketLegendBarWidth ?? source.legendBarWidth, 180, 1200, fallback.bucketLegendBarWidth ?? 500),
      bucketLegendBarHeight: boundedInteger(source.bucketLegendBarHeight ?? source.legendBarHeight, 8, 80, fallback.bucketLegendBarHeight ?? 22),
      bucketLegendLabelFontSize: boundedInteger(source.bucketLegendLabelFontSize ?? source.legendLabelFontSize, 8, 48, fallback.bucketLegendLabelFontSize ?? 13)
    };
  }

  function readExcelRuleSettings(schemeId = activeSchemeId()) {
    return sanitizeExcelRuleSettings(safeJson(localStorage.getItem(excelRuleSettingsKey(schemeId)), {}));
  }

  function writeExcelRuleSettings(schemeId, settings) {
    localStorage.setItem(excelRuleSettingsKey(schemeId), JSON.stringify(sanitizeExcelRuleSettings(settings)));
    touchScheme(schemeId);
  }

  function defaultIgnoreSchemes(legacyNonPrefectureActive = false) {
    const now = Date.now();
    return [
      { id: "preset-non-prefecture", name: "忽略县级", preset: "nonPrefecture", adcodes: [], active: Boolean(legacyNonPrefectureActive), createdAt: now, updatedAt: now },
      { id: "preset-region-league", name: "忽略自治州/地区/盟", preset: "regionLeague", adcodes: [], active: false, createdAt: now, updatedAt: now }
    ];
  }

  function cleanIgnoreScheme(value, index = 0) {
    if (!value || typeof value !== "object") return null;
    const id = String(value.id || makeId("ignore")).trim().slice(0, 80);
    const preset = ["nonPrefecture", "regionLeague"].includes(value.preset) ? value.preset : "";
    const adcodes = Array.from(new Set((Array.isArray(value.adcodes) ? value.adcodes : [])
      .map((code) => String(code || "").trim())
      .filter((code) => /^\d{1,6}$/.test(code))
      .map(asAdcode)
      .filter((code) => /^\d{6}$/.test(code) && code !== "000000")));
    return {
      id,
      name: String(value.name || `忽略方案 ${index + 1}`).trim().slice(0, 40) || `忽略方案 ${index + 1}`,
      preset,
      adcodes,
      active: Boolean(value.active),
      createdAt: Number(value.createdAt) || Date.now(),
      updatedAt: Number(value.updatedAt) || Date.now()
    };
  }

  function readIgnoreSchemes() {
    const raw = localStorage.getItem(KEYS.ignoreSchemes);
    if (raw === null) {
      return defaultIgnoreSchemes(localStorage.getItem(KEYS.ignoreLegacyNonPrefecture) === "true");
    }
    const seen = new Set();
    const schemes = safeJson(raw, []).map(cleanIgnoreScheme).filter((scheme) => {
      if (!scheme || seen.has(scheme.id)) return false;
      seen.add(scheme.id);
      return true;
    });
    return schemes;
  }

  function writeIgnoreSchemes(schemes) {
    const clean = schemes.map(cleanIgnoreScheme).filter(Boolean);
    localStorage.setItem(KEYS.ignoreSchemes, JSON.stringify(clean));
    localStorage.setItem(KEYS.ignoreLegacyNonPrefecture, String(clean.some((scheme) => scheme.active && scheme.preset === "nonPrefecture")));
  }

  function readCityIndex() {
    const rows = safeJson(localStorage.getItem(KEYS.cityIndex), []);
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => row && /^\d{6}$/.test(String(row.adcode || ""))).map((row) => ({
      adcode: String(row.adcode),
      name: String(row.name || row.adcode),
      provinceName: String(row.provinceName || "-"),
      layerType: String(row.layerType || "市界")
    }));
  }

  function readRankRowColors() {
    const source = safeJson(localStorage.getItem(KEYS.rankRowColors), {});
    return {
      odd: isHexColor(source.odd) ? String(source.odd).toLowerCase() : DEFAULT_RANK_ROW_COLORS.odd,
      even: isHexColor(source.even) ? String(source.even).toLowerCase() : DEFAULT_RANK_ROW_COLORS.even
    };
  }

  function writeRankRowColors(colors) {
    localStorage.setItem(KEYS.rankRowColors, JSON.stringify({
      odd: isHexColor(colors.odd) ? String(colors.odd).toLowerCase() : DEFAULT_RANK_ROW_COLORS.odd,
      even: isHexColor(colors.even) ? String(colors.even).toLowerCase() : DEFAULT_RANK_ROW_COLORS.even
    }));
  }

  function formatTime(value) {
    if (!value) return "未更新";
    try {
      return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "未更新";
    }
  }

  function removeSchemeData(schemeId) {
    localStorage.removeItem(`${KEYS.schemeDataPrefix}${schemeId}`);
    localStorage.removeItem(`${KEYS.rankSettingsPrefix}${schemeId}`);
    localStorage.removeItem(`${KEYS.excelRuleSettingsPrefix}${schemeId}`);
    localStorage.removeItem(`${KEYS.playbackPrefix}${schemeId}`);
    localStorage.removeItem(`${KEYS.customInfoPrefix}${schemeId}`);
  }

  window.MapStore = {
    KEYS,
    RANK_DATA_COLUMN_COUNT,
    RANK_BASE_COLUMN_COUNT,
    RANK_DATA_COLUMNS,
    RANK_COLUMNS,
    DEFAULT_BUCKET_COLORS,
    DEFAULT_RANK_ROW_COLORS,
    makeId,
    asAdcode,
    isHexColor,
    boundedInteger,
    formatTime,
    readSchemeState,
    writeSchemeState,
    activeSchemeId,
    readColors,
    writeColors,
    removeSchemeData,
    defaultRankSettings,
    readRankSettings,
    writeRankSettings,
    defaultExcelRuleSettings,
    readExcelRuleSettings,
    writeExcelRuleSettings,
    sanitizeExcelRuleSettings,
    readIgnoreSchemes,
    writeIgnoreSchemes,
    readCityIndex,
    readRankRowColors,
    writeRankRowColors
  };
})();
