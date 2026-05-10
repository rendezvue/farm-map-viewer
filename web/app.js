const CAMERA_ORDER = ["front_left", "front_right", "rear", "side"];
const CAMERA_LABELS = {
  front_left: "Front Left",
  front_right: "Front Right",
  rear: "Rear",
  side: "Side",
};
const CAMERA_LABEL_CORNERS = {
  front_left: "is-top-left",
  front_right: "is-top-right",
  rear: "is-bottom-left",
  side: "is-bottom-right",
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatMeters(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)} m`;
}

function formatZoom(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "-";
}

function formatCameraPoint(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "-";
  return `X ${Math.round(x)} / Y ${Math.round(y)}`;
}

function formatCount(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat(currentLanguage === "kr" ? "ko-KR" : "en-US").format(Math.round(value));
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(24, 49, 38, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function chooseTickStep(screenPxPerMeter) {
  const candidates = [0.5, 1, 2, 5, 10, 20];
  for (const candidate of candidates) {
    if (screenPxPerMeter * candidate >= 72) return candidate;
  }
  return 50;
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

const LANGUAGE_STORAGE_KEY = "farmMapViewerLanguage";
const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = new Set(["en", "kr"]);
const UI_TEXT = {
  en: {
    "document.title": "FARMILY crop map",
    "language.toggleAria": "Switch language",
    "topbar.issueDetails": "Issue details",
    "topbar.breadcrumb": "Greenhouses / Greenhouse 1 / Issue overview / Issue details",
    "topbar.userAria": "User",
    "nav.crop": "Crop",
    "nav.analysis": "Analysis",
    "nav.report": "Report",
    "nav.settings": "Settings",
    "common.aiAnalysis": "AI analysis",
    "common.countSuffix": "",
    "common.deltaRate": "Change",
    "sidebar.aiDetections": "AI detections",
    "sidebar.patrolRecords": "Patrol records",
    "sidebar.bookmarks": "Marked sections",
    "status.loading": "Loading...",
    "status.initFailed": "Initialization failed: {message}",
    "status.noSessions": "No available sessions.",
    "status.sessionLoading": "{deviceName}/{sessionName} loading...",
    "status.loadFailed": "Load failed: {message}",
    "session.selectorAria": "Session selection",
    "session.host": "Host",
    "session.captureDate": "Capture date",
    "session.noCaptureDates": "No capture dates",
    "session.rail": "rail",
    "session.frame": "frame",
    "report.create": "Create report",
    "selection.empty": "No selected location",
    "map.layerSelectorAria": "Map layer selection",
    "map.tacticalMap": "TACTICAL MAP",
    "map.detections": "Detections",
    "map.controlsAria": "Map controls",
    "map.zoomIn": "Zoom in",
    "map.zoomOut": "Zoom out",
    "map.fit": "Fit map",
    "map.verticalScrollAria": "Vertical map pan",
    "map.horizontalScrollAria": "Horizontal map pan",
    "map.panUp": "Pan up",
    "map.panDown": "Pan down",
    "map.panLeft": "Pan left",
    "map.panRight": "Pan right",
    "mapLayer.disease_pest_risk": "Pest Risk",
    "mapLayer.growth_status": "Growth Status",
    "case.confidence": "Confidence",
    "case.improving": "Improving",
    "case.firstIssue": "First issue reported",
    "case.lastIssue": "Last issue reported",
    "case.location": "Location",
    "case.locationValue": "Greenhouse 1, Area 1, Row 8, 56",
    "comments.title": "Comments",
    "comments.placeholder": "Add a comment.",
    "comments.submit": "Submit",
    "comments.sampleMike": "The severity of the pest seems to improve.",
    "comments.sampleFrancis": "This issue has been confirmed by me but it's not treated yet.",
    "comments.you": "You",
    "comments.justNow": "Just now",
    "hud.zoom": "Zoom",
    "hud.cameraXY": "Camera XY",
    "hud.scale": "Scale",
    "crop.flower": "Flower",
    "crop.unripe": "Unripe",
    "crop.midripe": "Mid-ripe",
    "crop.ripe": "Ripe",
    "crop.pest": "Pest",
    "crop.maturity": "Maturity",
    "crop.totalDetections": "Total detections",
    "crop.pestSignals": "Pest signals",
    "crop.sessionDetections": "Session detections ({session})",
    "crop.last30Title": "Last 30 days · total {count}",
    "crop.shareAria": "Crop detection share",
    "crop.valueTitle": "{label} {count} · change {delta}",
    "crop.value": "{count}",
    "crop.delta": "Change {delta}",
    "crop.noRecentData": "No data for the last 30 days.",
    "crop.legendDelta": "{label} change {delta}",
    "crop.legendTotalDelta": "Total crop change {delta}",
    "crop.trendAria": "Crop stage and pest detection trend for the last 30 days",
    "camera.front_left": "Front Left",
    "camera.front_right": "Front Right",
    "camera.rear": "Rear",
    "camera.side": "Side",
  },
  kr: {
    "document.title": "FARMILY 작물 맵",
    "language.toggleAria": "언어 전환",
    "topbar.issueDetails": "이슈 상세",
    "topbar.breadcrumb": "온실 / 1번 온실 / 이슈 현황 / 이슈 상세",
    "topbar.userAria": "사용자",
    "nav.crop": "작물",
    "nav.analysis": "분석",
    "nav.report": "리포트",
    "nav.settings": "설정",
    "common.aiAnalysis": "AI 분석",
    "common.countSuffix": "개",
    "common.deltaRate": "증감률",
    "sidebar.aiDetections": "AI 검출 현황",
    "sidebar.patrolRecords": "순찰 기록",
    "sidebar.bookmarks": "표시한 구간",
    "status.loading": "로딩 중...",
    "status.initFailed": "초기화 실패: {message}",
    "status.noSessions": "사용 가능한 세션이 없습니다.",
    "status.sessionLoading": "{deviceName}/{sessionName} 로딩 중...",
    "status.loadFailed": "로드 실패: {message}",
    "session.selectorAria": "세션 선택",
    "session.host": "호스트",
    "session.captureDate": "촬영날짜",
    "session.noCaptureDates": "촬영날짜 없음",
    "session.rail": "레일",
    "session.frame": "프레임",
    "report.create": "리포트 생성",
    "selection.empty": "선택한 위치가 없습니다",
    "map.layerSelectorAria": "지도 레이어 선택",
    "map.tacticalMap": "전술 미니맵",
    "map.detections": "검출 결과",
    "map.controlsAria": "지도 컨트롤",
    "map.zoomIn": "확대",
    "map.zoomOut": "축소",
    "map.fit": "전체 보기",
    "map.verticalScrollAria": "지도 세로 이동",
    "map.horizontalScrollAria": "지도 좌우 이동",
    "map.panUp": "위로 이동",
    "map.panDown": "아래로 이동",
    "map.panLeft": "왼쪽 이동",
    "map.panRight": "오른쪽 이동",
    "mapLayer.disease_pest_risk": "병충해 위험",
    "mapLayer.growth_status": "생육 상태",
    "case.confidence": "신뢰도",
    "case.improving": "개선 중",
    "case.firstIssue": "최초 이슈 보고",
    "case.lastIssue": "최근 이슈 보고",
    "case.location": "위치",
    "case.locationValue": "1번 온실, A구역, 8열, 56",
    "comments.title": "댓글",
    "comments.placeholder": "댓글을 입력하세요.",
    "comments.submit": "등록",
    "comments.sampleMike": "병충해 심각도가 점차 개선되는 것 같습니다.",
    "comments.sampleFrancis": "제가 확인한 이슈지만 아직 처리되지는 않았습니다.",
    "comments.you": "나",
    "comments.justNow": "방금",
    "hud.zoom": "배율",
    "hud.cameraXY": "카메라 XY",
    "hud.scale": "스케일",
    "crop.flower": "꽃",
    "crop.unripe": "안익음",
    "crop.midripe": "덜익음",
    "crop.ripe": "익음",
    "crop.pest": "병충해",
    "crop.maturity": "성숙도",
    "crop.totalDetections": "전체 검출량",
    "crop.pestSignals": "병충해 신호",
    "crop.sessionDetections": "세션 검출량 ({session})",
    "crop.last30Title": "최근 30일 통합 추이 · 총 {count}개",
    "crop.shareAria": "작물 검출 비율",
    "crop.valueTitle": "{label} {count}개 · 증감률 {delta}",
    "crop.value": "{count}개",
    "crop.delta": "증감률 {delta}",
    "crop.noRecentData": "최근 30일 데이터가 없습니다.",
    "crop.legendDelta": "{label} 증감률 {delta}",
    "crop.legendTotalDelta": "전체 작물 증감률 {delta}",
    "crop.trendAria": "최근 30일간 작물 생육 단계 및 병충해 검출 추이",
    "camera.front_left": "전방 좌측",
    "camera.front_right": "전방 우측",
    "camera.rear": "후방",
    "camera.side": "측면",
  },
};

let currentLanguage = (() => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.has(saved) ? saved : DEFAULT_LANGUAGE;
  } catch (_) {
    return DEFAULT_LANGUAGE;
  }
})();

function t(key, values = {}) {
  const fallback = UI_TEXT.en[key] || key;
  const template = UI_TEXT[currentLanguage]?.[key] || fallback;
  return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}

function applyLanguage({ rerender = true } = {}) {
  document.documentElement.lang = currentLanguage === "kr" ? "ko" : "en";
  document.title = t("document.title");
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  }
  for (const el of document.querySelectorAll("[data-i18n-aria]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  }
  const toggle = document.getElementById("languageToggle");
  if (toggle) {
    toggle.dataset.language = currentLanguage;
    toggle.setAttribute("aria-label", t("language.toggleAria"));
    for (const code of toggle.querySelectorAll("[data-lang-code]")) {
      code.classList.toggle("is-active", code.dataset.langCode === currentLanguage);
    }
  }
  for (const label of document.querySelectorAll(".frame-camera-label[data-camera-name]")) {
    label.textContent = getCameraLabel(label.dataset.cameraName) || label.dataset.cameraName;
  }
  for (const chip of document.querySelectorAll(".session-chip[data-rail-count][data-frame-count]")) {
    const meta = chip.querySelector(".session-chip-meta");
    if (!meta) continue;
    const frameCount = Number(chip.dataset.frameCount) || 0;
    meta.textContent = `${t("session.rail")} ${chip.dataset.railCount} · ${t("session.frame")} ${frameCount.toLocaleString(currentLanguage === "kr" ? "ko-KR" : "en-US")}`;
  }
  for (const select of document.querySelectorAll("[data-session-date-select]")) {
    if (select.disabled && select.options.length === 1 && !select.options[0].value) {
      select.options[0].textContent = t("session.noCaptureDates");
    }
  }
  updateDatasetSummaryLanguage();
  if (!rerender) return;
  renderCropPanel(currentCropSummary);
  if (currentLayersData) renderMapLayerControls(currentLayersData);
  currentMap?.queueRender();
}

function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.has(lang) || lang === currentLanguage) return;
  currentLanguage = lang;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (_) {}
  applyLanguage();
}

function initLanguageToggle() {
  const toggle = document.getElementById("languageToggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    setLanguage(currentLanguage === "en" ? "kr" : "en");
  });
  applyLanguage({ rerender: false });
}

function getCameraLabel(cameraName) {
  return UI_TEXT[currentLanguage]?.[`camera.${cameraName}`] || UI_TEXT.en[`camera.${cameraName}`] || CAMERA_LABELS[cameraName] || cameraName;
}

function updateDatasetSummaryLanguage() {
  const summary = document.getElementById("datasetSummary");
  if (!summary) return;
  if (summary.dataset.summaryState === "loaded") {
    const frameCount = Number(summary.dataset.frameCount) || 0;
    summary.textContent = `${summary.dataset.deviceName || "-"} · ${summary.dataset.sessionName || "-"} · ${t("session.rail")} ${summary.dataset.railCount || "-"} · ${t("session.frame")} ${frameCount.toLocaleString(currentLanguage === "kr" ? "ko-KR" : "en-US")}`;
  } else if (summary.dataset.summaryState === "loading") {
    summary.textContent = t("status.sessionLoading", {
      deviceName: summary.dataset.deviceName || "-",
      sessionName: summary.dataset.sessionName || "-",
    });
  } else if (summary.dataset.summaryState === "empty") {
    summary.textContent = t("status.noSessions");
  } else if (["Loading...", "로딩 중..."].includes(summary.textContent.trim())) {
    summary.textContent = t("status.loading");
  }
}

function formatCaptureDateLabel(sessionName) {
  const match = /^(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})?$/.exec(sessionName || "");
  if (!match) return sessionName || "-";
  const [, year, month, day, hour, minute, second = "00"] = match;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getLatestSession(sessions = []) {
  return [...sessions].sort((a, b) => b.name.localeCompare(a.name))[0] || null;
}

function syncHostSelectors(deviceName) {
  for (const select of document.querySelectorAll("[data-session-host-select]")) {
    if (Array.from(select.options).some((option) => option.value === deviceName)) {
      select.value = deviceName;
    }
  }
}

function syncCaptureDateSelectors(sessionName) {
  for (const select of document.querySelectorAll("[data-session-date-select]")) {
    if (Array.from(select.options).some((option) => option.value === sessionName)) {
      select.value = sessionName;
    }
  }
}

function setActiveRail(railName) {
  for (const chip of document.querySelectorAll(".rail-chip")) {
    chip.classList.toggle("is-active", chip.dataset.railName === railName);
  }
}

function scoreColor(score) {
  if (score >= 85) return "score-good";
  if (score >= 60) return "score-warn";
  return "score-bad";
}

function deltaText(delta) {
  if (delta == null || delta === 0) return null;
  return delta > 0 ? `+${delta}` : String(delta);
}

const CROP_PANEL_SERIES = [
  {
    id: "flower",
    label: "꽃",
    color: "#d96f9c",
  },
  {
    id: "unripe",
    label: "안익음",
    color: "#67a95c",
  },
  {
    id: "midripe",
    label: "덜익음",
    color: "#efb44a",
  },
  {
    id: "ripe",
    label: "익음",
    color: "#d96844",
  },
  {
    id: "pest",
    label: "병충해",
    color: "#8f5f3f",
  },
];
const CROP_MAP_CHART_SERIES = CROP_PANEL_SERIES.filter((series) => series.id !== "pest");

function toCropCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function toCropPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 10) / 10;
}

function formatCropDelta(value) {
  const numeric = toCropPercent(value);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(1)}%`;
}

function cropDeltaClass(value) {
  const numeric = toCropPercent(value);
  if (numeric > 0) return "is-up";
  if (numeric < 0) return "is-down";
  return "is-flat";
}

function buildCropPanelPlaceholder(sessionName = "-") {
  return {
    available: false,
    session: sessionName,
    counts: {
      flower: 0,
      unripe: 0,
      midripe: 0,
      ripe: 0,
      pest: 0,
      total: 0,
    },
    trend_30d: {
      points: [],
      delta_pct: {
        flower: 0,
        unripe: 0,
        midripe: 0,
        ripe: 0,
        pest: 0,
        total: 0,
      },
    },
  };
}

function getCropPanelState(summary = currentCropSummary) {
  const fallback = {
    available: false,
    session: summary?.session || "-",
    counts: {
      flower: 0,
      unripe: 0,
      midripe: 0,
      ripe: 0,
      pest: 0,
      total: 0,
    },
    points: [],
    deltaPct: {
      flower: 0,
      unripe: 0,
      midripe: 0,
      ripe: 0,
      pest: 0,
      total: 0,
    },
  };
  if (!summary || typeof summary !== "object") return fallback;

  const counts = summary.counts || {};
  const trend = summary.trend_30d || {};
  const points = Array.isArray(trend.points) ? trend.points : [];
  const deltaPct = trend.delta_pct || {};
  const normalizedCounts = {
    flower: toCropCount(counts.flower),
    unripe: toCropCount(counts.unripe),
    midripe: toCropCount(counts.midripe),
    ripe: toCropCount(counts.ripe),
    pest: toCropCount(counts.pest),
  };
  normalizedCounts.total =
    toCropCount(counts.total) ||
    normalizedCounts.flower + normalizedCounts.unripe + normalizedCounts.midripe + normalizedCounts.ripe;

  return {
    available: Boolean(summary.available),
    session: summary.session || "-",
    counts: normalizedCounts,
    points,
    deltaPct: {
      flower: toCropPercent(deltaPct.flower),
      unripe: toCropPercent(deltaPct.unripe),
      midripe: toCropPercent(deltaPct.midripe),
      ripe: toCropPercent(deltaPct.ripe),
      pest: toCropPercent(deltaPct.pest),
      total: toCropPercent(deltaPct.total),
    },
  };
}

function buildCropSeriesData(cropState) {
  return CROP_PANEL_SERIES.map((series) => ({
    ...series,
    label: t(`crop.${series.id}`),
    value: cropState.counts[series.id] ?? 0,
    deltaPct: cropState.deltaPct[series.id] ?? 0,
    points: cropState.points.map((point) => toCropCount(point[series.id])),
  }));
}

function computeCropMaturityScore(cropState) {
  const counts = cropState?.counts || {};
  const flower = toCropCount(counts.flower);
  const unripe = toCropCount(counts.unripe);
  const midripe = toCropCount(counts.midripe);
  const ripe = toCropCount(counts.ripe);
  const total = flower + unripe + midripe + ripe;
  if (!total) return null;
  return ((flower * 0.25 + unripe * 0.45 + midripe * 0.75 + ripe) / total) * 100;
}

function getRailCropRows(summary = currentCropSummary) {
  const rows = summary?.rail_crop?.available && Array.isArray(summary.rail_crop.rails)
    ? summary.rail_crop.rails
    : [];
  return rows
    .map((row) => ({
      rail_name: row.rail_name || "",
      rail_number: Number(row.rail_number) || 0,
      rail_column: Number(row.rail_column) || 0,
      rail_y_m: Number(row.rail_y_m) || 0,
      frame_count: toCropCount(row.frame_count),
      counts: {
        flower: toCropCount(row.counts?.flower),
        unripe: toCropCount(row.counts?.unripe),
        midripe: toCropCount(row.counts?.midripe),
        ripe: toCropCount(row.counts?.ripe),
      },
    }))
    .filter((row) => row.rail_name)
    .sort((a, b) => a.rail_column - b.rail_column);
}

function buildCropTrendSvg(seriesData, xLabels) {
  const width = 320;
  const padding = { top: 16, right: 70, bottom: 24, left: 56 };
  const bandGap = 10;
  const bandHeight = 34;
  const height = padding.top + padding.bottom + bandHeight * seriesData.length + bandGap * Math.max(0, seriesData.length - 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const pointCount = seriesData[0]?.points.length || 0;
  const maxIndex = Math.max(1, pointCount - 1);
  const guideIndices = [...new Set([
    0,
    Math.floor(maxIndex * 0.25),
    Math.floor(maxIndex * 0.5),
    Math.floor(maxIndex * 0.75),
    maxIndex,
  ])];
  const xForIndex = (index) => {
    if (pointCount <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / maxIndex) * chartWidth;
  };
  const dateLabels = guideIndices.map((index) => ({
    index,
    label: xLabels[index] || "",
  }));

  const defs = seriesData.map((series) => `
    <linearGradient id="cropFill-${series.id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${hexToRgba(series.color, 0.28)}"/>
      <stop offset="100%" stop-color="${hexToRgba(series.color, 0.02)}"/>
    </linearGradient>
  `).join("");

  const guides = guideIndices.map((index) => {
    const x = xForIndex(index).toFixed(1);
    return `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="3 5"/>`;
  }).join("");

  const bands = seriesData.map((series, seriesIndex) => {
    const bandTop = padding.top + seriesIndex * (bandHeight + bandGap);
    const bandBottom = bandTop + bandHeight;
    const minValue = Math.min(...series.points);
    const maxValue = Math.max(...series.points);
    const span = Math.max(maxValue - minValue, Math.max(1, maxValue) * 0.16);
    const domainMin = Math.max(0, minValue - span * 0.28);
    const domainMax = maxValue + span * 0.22;
    const yForValue = (value) => {
      const normalized = (value - domainMin) / Math.max(1, domainMax - domainMin);
      return bandBottom - normalized * (bandHeight - 12) - 6;
    };
    const linePoints = series.points.map((value, index) => `${xForIndex(index).toFixed(1)},${yForValue(value).toFixed(1)}`);
    const lastIndex = Math.max(0, series.points.length - 1);
    const areaPoints = [
      `${xForIndex(0).toFixed(1)},${bandBottom.toFixed(1)}`,
      ...linePoints,
      `${xForIndex(lastIndex).toFixed(1)},${bandBottom.toFixed(1)}`,
    ].join(" ");
    const lastValue = series.points[lastIndex];
    const lastX = xForIndex(lastIndex);
    const lastY = yForValue(lastValue);
    const valueLabel = formatCount(lastValue);
    const pillWidth = Math.max(42, valueLabel.length * 7 + 12);
    const pillX = width - padding.right + 8;
    const pillY = Math.max(bandTop + 3, Math.min(bandBottom - 21, lastY - 10));

    return `
      <rect x="${padding.left}" y="${bandTop.toFixed(1)}" width="${chartWidth}" height="${bandHeight.toFixed(1)}" rx="12" fill="${hexToRgba(series.color, 0.05)}"/>
      <text x="10" y="${(bandTop + bandHeight / 2 + 4).toFixed(1)}" font-size="11" font-weight="700" fill="rgba(221,234,223,0.65)">${series.label}</text>
      <polyline points="${areaPoints}" fill="url(#cropFill-${series.id})" stroke="none"/>
      <polyline points="${linePoints.join(" ")}" fill="none" stroke="${series.color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4.4" fill="${series.color}" stroke="rgba(255,255,255,0.95)" stroke-width="2"/>
      <rect x="${pillX}" y="${pillY.toFixed(1)}" width="${pillWidth}" height="20" rx="10" fill="${hexToRgba(series.color, 0.12)}"/>
      <text x="${(pillX + pillWidth / 2).toFixed(1)}" y="${(pillY + 13.4).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${series.color}">${valueLabel}</text>
    `;
  }).join("");

  const axis = dateLabels.map(({ index, label }) => `
    <text x="${xForIndex(index).toFixed(1)}" y="${height - 6}" text-anchor="middle" font-size="9.5" fill="rgba(125,152,137,0.7)">${label}</text>
  `).join("");

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${t("crop.trendAria")}">
      <defs>${defs}</defs>
      <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="rgba(23,31,28,0.9)" stroke="rgba(39,48,41,0.8)"/>
      ${guides}
      ${bands}
      ${axis}
    </svg>
  `;
}

function renderCropPanel(summary = currentCropSummary) {
  const panel = document.getElementById("cropPanel");
  const stats = document.getElementById("cropStats");
  const chart = document.getElementById("cropChart");
  const legend = document.getElementById("cropChartLegend");
  const overview = document.getElementById("cropOverview");
  const sessionLabel = document.getElementById("cropSessionLabel");
  if (!panel || !stats || !chart || !legend || !sessionLabel) return;

  const cropState = getCropPanelState(summary);
  const seriesData = buildCropSeriesData(cropState);
  const totalCount = cropState.counts.total;
  const pestCount = cropState.counts.pest;
  const title = document.querySelector("#cropPanel .crop-chart-title");
  if (title) title.textContent = t("crop.last30Title", { count: formatCount(totalCount) });
  sessionLabel.textContent = t("crop.sessionDetections", { session: cropState.session });

  panel.hidden = false;
  if (overview) {
    const shareTotal = Math.max(1, seriesData.reduce((sum, series) => sum + series.value, 0));
    overview.innerHTML = `
      <div class="crop-total-card">
        <span class="crop-overview-label">${t("crop.totalDetections")}</span>
        <strong class="crop-overview-value">${formatCount(totalCount)}</strong>
      </div>
      <div class="crop-risk-card">
        <span class="crop-overview-label">${t("crop.pestSignals")}</span>
        <strong class="crop-overview-value">${formatCount(pestCount)}</strong>
      </div>
      <div class="crop-share-bar" aria-label="${t("crop.shareAria")}">
        ${seriesData.map((series) => `
          <span class="crop-share-segment" title="${t("crop.value", { count: `${series.label} ${formatCount(series.value)}` })}" style="width:${Math.max(2, (series.value / shareTotal) * 100).toFixed(2)}%;background:${series.color}"></span>
        `).join("")}
      </div>
    `;
  }
  renderMapCropLegend(seriesData);
  stats.innerHTML = "";
  for (const series of seriesData) {
    const card = document.createElement("div");
    card.className = "crop-stat-card";
    card.title = t("crop.valueTitle", {
      label: series.label,
      count: formatCount(series.value),
      delta: formatCropDelta(series.deltaPct),
    });
    card.style.borderColor = hexToRgba(series.color, 0.22);
    card.style.background = `${hexToRgba(series.color, 0.07)}`;
    card.innerHTML = `
      <div class="crop-stat-line">
        <div class="crop-stat-main">
          <span class="crop-dot" style="background:${series.color}"></span>
          <span class="crop-stat-label">${series.label}</span>
        </div>
        <div class="crop-stat-metrics">
          <strong class="crop-stat-value">${t("crop.value", { count: formatCount(series.value) })}</strong>
          <span class="crop-stat-delta ${cropDeltaClass(series.deltaPct)}">${t("crop.delta", { delta: formatCropDelta(series.deltaPct) })}</span>
        </div>
      </div>
    `;
    stats.appendChild(card);
  }

  const xLabels = cropState.points.map((point) => {
    if (!point?.date) return "";
    const date = new Date(`${point.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return point.date;
    return date.toLocaleDateString(currentLanguage === "kr" ? "ko-KR" : "en-US", { month: "numeric", day: "numeric" });
  });
  if (cropState.points.length > 0) {
    chart.innerHTML = buildCropTrendSvg(seriesData, xLabels);
  } else {
    chart.innerHTML = `<div class="crop-chart-empty">${t("crop.noRecentData")}</div>`;
  }
  legend.innerHTML = `${seriesData.map((series) => `
    <span class="crop-legend-item">
      <span class="crop-legend-dot" style="background:${series.color}"></span>
      ${t("crop.legendDelta", { label: series.label, delta: formatCropDelta(series.deltaPct) })}
    </span>
  `).join("")}
    <span class="crop-legend-item is-total">
      <span class="crop-legend-dot is-total"></span>
      ${t("crop.legendTotalDelta", { delta: formatCropDelta(cropState.deltaPct.total) })}
    </span>`;
}

function renderMapCropLegend(seriesData = buildCropSeriesData(getCropPanelState())) {
  const legend = document.getElementById("mapCropLegend");
  if (!legend) return;
  const cropState = getCropPanelState();
  const maturityScore = computeCropMaturityScore(cropState);
  const mapResourceLabelKeys = ["flower", "unripe", "midripe", "ripe", "pest"];
  const resources = [
    ...seriesData.map((series, index) => ({
      label: t(`crop.${mapResourceLabelKeys[index]}`) || series.label,
      value: formatCount(series.value),
      icon: ["flower", "unripe", "midripe", "ripe", "pest"][index] || "crop",
      color: series.color,
    })),
    { label: t("crop.maturity"), value: maturityScore == null ? "-" : maturityScore.toFixed(1), icon: "maturity", color: "#45d46a" },
  ];
  legend.innerHTML = resources.map((item) => `
    <div class="map-resource-item" title="${item.label}" aria-label="${item.label} ${item.value}" style="--resource-color:${item.color}">
      <span class="map-resource-icon map-resource-icon-${item.icon}"></span>
      <span class="map-resource-label">${item.label}</span>
      <strong>${item.value}</strong>
    </div>
  `).join("");
}

function initCasePanel() {
  const guardedOverlays = document.querySelectorAll(".map-minimap-layer, .map-bottom-dock, .map-control-stack, .hud, .map-topline");
  for (const panel of guardedOverlays) {
    for (const eventName of ["pointerdown", "pointermove", "pointerup", "pointercancel", "dblclick", "wheel"]) {
      panel.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    }
  }

  const input = document.getElementById("caseCommentInput");
  const submit = document.getElementById("caseCommentSubmit");
  const list = document.getElementById("caseCommentList");
  if (!input || !submit || !list) return;

  const addComment = () => {
    const text = input.value.trim();
    if (!text) return;
    const item = createElement("div", "case-comment");
    const author = createElement("div", "case-comment-author");
    const avatar = createElement("span", "case-avatar case-avatar-user", "YU");
    const name = createElement("strong", "", t("comments.you"));
    const body = createElement("p", "", text);
    const stamp = createElement("time", "", t("comments.justNow"));
    author.append(avatar, name);
    item.append(author, body, stamp);
    list.prepend(item);
    input.value = "";
  };

  submit.addEventListener("click", addComment);
  input.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      addComment();
    }
  });
}

// ─── Device / session store ──────────────────────────────────────────────────

let allDevicesData = null;        // full /api/devices payload, set in bootstrap
let activeDeviceName = null;      // currently selected device

// ─── Insights store ───────────────────────────────────────────────────────────

let currentCropSummary = null;
let currentInsights = null;
let currentPestDetections = null;
let currentGrowthDetections = null;
let showRiskOverlay = true;

// ─── Task store ───────────────────────────────────────────────────────────────

let currentTasks = null;       // tasks API payload
let taskFilter = "active";     // "active" | "all" | "done"
let taskStatusOverrides = {};  // id → "todo"|"in_progress"|"done" (client-side toggles)

// ─── Trend store ──────────────────────────────────────────────────────────────

let currentTrends = null;      // trends API payload
let activeTrendRail = null;    // which rail's trends are shown
let selActiveTab = "info";     // "info" | "trend"

// ─── Layer store ──────────────────────────────────────────────────────────────

let currentLayers = null;          // full layers.json payload
let activeLayerId = null;          // which layer is rendered on map
let showLayerOverlay = false;      // overlay on/off
let activeMiniMapLayerIds = new Set();
let currentGrowthDetectionModels = [];
let activeGrowthDetectionModelId = "yolo11s";
let hoveredSegmentId = null;
let selectedSegmentId = null;
let selectedPestDetectionId = null;

const COLOR_SCHEMES = {
  yellow_red: (v) => {
    const t = v / 100;
    if (t < 0.4) return `rgba(250,200,30,${0.12 + t * 0.5})`;
    if (t < 0.7) return `rgba(230,120,20,${0.18 + t * 0.45})`;
    return `rgba(210,40,30,${0.22 + t * 0.5})`;
  },
  green_red: (v) => {
    const t = v / 100;
    if (t < 0.4) return `rgba(40,170,80,${0.12 + t * 0.4})`;
    if (t < 0.7) return `rgba(220,160,20,${0.18 + t * 0.45})`;
    return `rgba(210,40,30,${0.22 + t * 0.5})`;
  },
  growth: (v) => {
    const t = v / 100;
    if (t < 0.4) return `rgba(30,160,70,${0.12 + t * 0.4})`;
    if (t < 0.7) return `rgba(180,110,20,${0.18 + t * 0.45})`;
    return `rgba(200,50,30,${0.22 + t * 0.5})`;
  },
  blue_warn: (v) => {
    const t = v / 100;
    if (t < 0.4) return `rgba(60,130,200,${0.1 + t * 0.35})`;
    if (t < 0.7) return `rgba(180,100,20,${0.18 + t * 0.4})`;
    return `rgba(200,40,40,${0.22 + t * 0.5})`;
  },
  harvest: (v) => {
    const t = v / 100;
    if (t < 0.4) return `rgba(160,80,200,${0.08 + t * 0.3})`;
    if (t < 0.7) return `rgba(200,140,20,${0.14 + t * 0.4})`;
    return `rgba(220,60,20,${0.2 + t * 0.5})`;
  },
  crop_stage: (v) => {
    const stage = getHarvestStageInfo(v);
    return hexToRgba(stage.color, stage.fillAlpha);
  },
};

const LAYER_LEGEND_STEPS = [
  { label: "낮음", value: 20 },
  { label: "중간", value: 55 },
  { label: "높음", value: 85 },
];
const INITIAL_MAP_VIEW = {
  railName: "rail_001",
  odomX: 1,
  zoom: 7.24,
  centerX: 759,
  centerY: 475,
};
const MAP_LAYER_CONTROL_ORDER = ["disease_pest_risk", "growth_status"];

function getActiveLayer() {
  if (!currentLayers || !activeLayerId) return null;
  return currentLayers.layers.find((l) => l.id === activeLayerId) || null;
}

function getMapLayerControlLayers(layers) {
  const layerList = layers?.layers || [];
  const layerById = new Map(layerList.map((layer) => [layer.id, layer]));
  return MAP_LAYER_CONTROL_ORDER
    .map((id) => layerById.get(id))
    .filter(Boolean);
}

function getActiveMiniMapLayers() {
  if (!currentLayers?.layers?.length || !activeMiniMapLayerIds.size) return [];
  const layerById = new Map(currentLayers.layers.map((layer) => [layer.id, layer]));
  return MAP_LAYER_CONTROL_ORDER
    .filter((id) => activeMiniMapLayerIds.has(id))
    .map((id) => layerById.get(id))
    .filter(Boolean);
}

function setMiniMapLayerVisible(layerId, visible) {
  if (visible) activeMiniMapLayerIds.add(layerId);
  else activeMiniMapLayerIds.delete(layerId);
  updateMapLayerControlStates();
  currentMap?.queueRender();
}

async function loadGrowthDetectionsForModel(modelId) {
  const summary = document.getElementById("datasetSummary");
  const deviceName = summary?.dataset.deviceName;
  const sessionName = summary?.dataset.sessionName;
  if (!deviceName || !sessionName || !modelId) return;
  activeGrowthDetectionModelId = modelId;
  updateGrowthModelControlStates({ loading: true });
  try {
    const payload = await fetchJson(
      `/api/devices/${deviceName}/sessions/${sessionName}/growth-detections?model=${encodeURIComponent(modelId)}`,
    );
    currentGrowthDetections = normalizeGrowthDetections(payload, sessionName);
    if (currentMap) currentMap.setGrowthDetections(payload);
  } finally {
    updateGrowthModelControlStates({ loading: false });
  }
}

function isPestRiskPhotoOverlayEnabled() {
  return activeMiniMapLayerIds.has("disease_pest_risk");
}

function isGrowthStatusPhotoOverlayEnabled() {
  return activeMiniMapLayerIds.has("growth_status");
}

function normalizeRailKey(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^(?:rail[_-]?|r)(\d+)$/);
  if (!match) return text;
  return `rail_${match[1].padStart(3, "0")}`;
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function findInitialMapFrame(frames, target = INITIAL_MAP_VIEW) {
  const targetRail = normalizeRailKey(target.railName);
  const railFrames = frames.filter((frame) => normalizeRailKey(frame.rail_name) === targetRail);
  const candidates = railFrames.length ? railFrames : frames;
  return candidates.reduce((best, frame) => {
    const odomX = Number(frame.odom_x);
    const distance = Number.isFinite(odomX) ? Math.abs(odomX - target.odomX) : Number.POSITIVE_INFINITY;
    if (!best || distance < best.distance) return { frame, distance };
    return best;
  }, null)?.frame || null;
}

function getLayerColorFn(layer) {
  return COLOR_SCHEMES[layer.color_scheme] || COLOR_SCHEMES.yellow_red;
}

function segmentSeverityColor(sev) {
  if (sev === "high") return "var(--bad)";
  if (sev === "medium") return "var(--warn)";
  return "var(--good)";
}

function normalizePestSeverity(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "high") return "high";
  if (text === "low") return "low";
  return "medium";
}

function toConfidenceRatio(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clamp(numeric, 0, 1);
}

const EMPTY_DETECTIONS = Object.freeze([]);

function buildDetectionFrameIndex(detections) {
  const byFrame = new Map();
  for (const detection of detections || []) {
    const key = String(detection.frame_id);
    const bucket = byFrame.get(key);
    if (bucket) bucket.push(detection);
    else byFrame.set(key, [detection]);
  }
  return byFrame;
}

function getFrameDetections(payload, frameId) {
  return payload?.detectionsByFrame?.get(String(frameId)) || EMPTY_DETECTIONS;
}

function normalizePestDetections(payload, sessionName = "-") {
  const detections = Array.isArray(payload?.detections) ? payload.detections : [];
  const normalized = detections
    .map((item, index) => {
      const frameId = Number(item?.frame_id);
      if (!Number.isFinite(frameId)) return null;
      const bbox = Array.isArray(item?.bbox) && item.bbox.length >= 4
        ? item.bbox.slice(0, 4).map((coord) => Number(coord))
        : null;
      return {
        id: item?.id || `pest_${Math.round(frameId)}_${index + 1}`,
        frame_id: Math.round(frameId),
        rail_name: item?.rail_name || "",
        odom_x: Number.isFinite(Number(item?.odom_x)) ? Number(item.odom_x) : null,
        severity: normalizePestSeverity(item?.severity),
        label: item?.label || "병충해",
        confidence: toConfidenceRatio(item?.confidence),
        camera: item?.camera || null,
        bbox: bbox && bbox.every((coord) => Number.isFinite(coord)) ? bbox : null,
        note: item?.note || null,
        source: item?.source || payload?.source || null,
      };
    })
    .filter(Boolean);
  return {
    available: Boolean(payload?.available),
    session: payload?.session || sessionName,
    source: payload?.source || null,
    detections: normalized,
    detectionsByFrame: buildDetectionFrameIndex(normalized),
  };
}

const GROWTH_DETECTION_STAGES = {
  raw: {
    id: "raw",
    labelEn: "Raw",
    labelKr: "미숙",
    severity: "low",
  },
  midi: {
    id: "midi",
    labelEn: "Mid-ripe",
    labelKr: "중숙",
    severity: "medium",
  },
  ripe: {
    id: "ripe",
    labelEn: "Ripe",
    labelKr: "완숙",
    severity: "high",
  },
};

function normalizeGrowthStage(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "midi" || text === "mid-ripe" || text === "midripe" || text.includes("mid")) return "midi";
  if (text === "raw" || text === "unripe" || text.includes("unripe")) return "raw";
  if (text === "ripe" || text.includes("ripe")) return "ripe";
  return "raw";
}

function getGrowthDetectionStageInfo(value) {
  return GROWTH_DETECTION_STAGES[normalizeGrowthStage(value)] || GROWTH_DETECTION_STAGES.raw;
}

function formatGrowthDetectionLabel(value) {
  const info = getGrowthDetectionStageInfo(value);
  return currentLanguage === "kr" ? info.labelKr : info.labelEn;
}

function normalizeGrowthDetections(payload, sessionName = "-") {
  const detections = Array.isArray(payload?.detections) ? payload.detections : [];
  const normalized = detections
    .map((item, index) => {
      const frameId = Number(item?.frame_id);
      if (!Number.isFinite(frameId)) return null;
      const bbox = Array.isArray(item?.bbox) && item.bbox.length >= 4
        ? item.bbox.slice(0, 4).map((coord) => Number(coord))
        : null;
      const label = item?.label || "raw";
      const stage = getGrowthDetectionStageInfo(label);
      return {
        id: item?.id || `growth_${Math.round(frameId)}_${index + 1}`,
        frame_id: Math.round(frameId),
        rail_name: item?.rail_name || "",
        odom_x: Number.isFinite(Number(item?.odom_x)) ? Number(item.odom_x) : null,
        label,
        stage: stage.id,
        severity: stage.severity,
        class_id: Number.isFinite(Number(item?.class_id)) ? Number(item.class_id) : null,
        confidence: toConfidenceRatio(item?.confidence),
        camera: item?.camera || null,
        bbox: bbox && bbox.every((coord) => Number.isFinite(coord)) ? bbox : null,
        source: item?.source || payload?.source || null,
      };
    })
    .filter(Boolean);
  return {
    available: Boolean(payload?.available),
    session: payload?.session || sessionName,
    source: payload?.source || null,
    model: payload?.model || null,
    detections: normalized,
    detectionsByFrame: buildDetectionFrameIndex(normalized),
  };
}

function normalizeGrowthDetectionModels(payload) {
  const models = Array.isArray(payload?.models) ? payload.models : [];
  return models
    .map((model) => ({
      id: String(model?.id || "").trim(),
      label: String(model?.label || model?.id || "").trim(),
      available: Boolean(model?.available),
      dataPath: model?.data_path || null,
    }))
    .filter((model) => model.id);
}

function chooseGrowthDetectionModel(models, preferred = activeGrowthDetectionModelId) {
  if (models.some((model) => model.id === preferred && model.available)) return preferred;
  if (models.some((model) => model.id === "yolo11s" && model.available)) return "yolo11s";
  return models.find((model) => model.available)?.id || models[0]?.id || "yolo11s";
}

function getHarvestStageInfo(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return {
      id: "flower",
      label: "꽃",
      color: "#d96f9c",
      fillAlpha: 0.28,
      legendAlpha: 0.34,
      strokeAlpha: 0.42,
    };
  }
  if (numeric >= 75) {
    return {
      id: "ripe",
      label: "익음",
      color: "#d96844",
      fillAlpha: 0.26,
      legendAlpha: 0.32,
      strokeAlpha: 0.4,
    };
  }
  if (numeric >= 50) {
    return {
      id: "midripe",
      label: "덜익음",
      color: "#efb44a",
      fillAlpha: 0.24,
      legendAlpha: 0.3,
      strokeAlpha: 0.36,
    };
  }
  if (numeric >= 25) {
    return {
      id: "unripe",
      label: "안익음",
      color: "#67a95c",
      fillAlpha: 0.22,
      legendAlpha: 0.28,
      strokeAlpha: 0.34,
    };
  }
  return {
    id: "flower",
    label: "꽃",
    color: "#d96f9c",
    fillAlpha: 0.28,
    legendAlpha: 0.34,
    strokeAlpha: 0.42,
  };
}

function isSegmentHoverDisabled(layer = getActiveLayer()) {
  return Boolean(layer?.id === "disease_pest_risk_v2_harvest");
}

function normalizeLayersPayload(layers) {
  if (!layers || !Array.isArray(layers.layers)) return layers;
  const nextLayers = [...layers.layers];
  const diseaseIndex = nextLayers.findIndex((layer) => layer.id === "disease_pest_risk");
  const harvestLayer = nextLayers.find((layer) => layer.id === "harvest_readiness");

  if (!nextLayers.some((layer) => layer.id === "disease_pest_risk_v2")) {
    const v2Layer = {
      id: "disease_pest_risk_v2",
      label: "병충해 위험 V2",
      description: "실제 병충해 프레임 마커 보기",
      unit: "marker",
      range: [0, 1],
      color_scheme: "green_red",
      source: "marker",
      items: [],
    };
    if (diseaseIndex >= 0) {
      nextLayers.splice(diseaseIndex + 1, 0, v2Layer);
    } else {
      nextLayers.push(v2Layer);
    }
  }

  if (!nextLayers.some((layer) => layer.id === "disease_pest_risk_v2_harvest")) {
    const v2Index = nextLayers.findIndex((layer) => layer.id === "disease_pest_risk_v2");
    const comboLayer = {
      id: "disease_pest_risk_v2_harvest",
      label: "병충해 위험 V2 + 수확준비도",
      description: "병충해 마커와 수확준비도 단계를 함께 보기",
      unit: "stage",
      range: [0, 100],
      color_scheme: "crop_stage",
      source: "marker+harvest",
      items: Array.isArray(harvestLayer?.items)
        ? harvestLayer.items.map((item) => ({ ...item }))
        : [],
    };
    if (v2Index >= 0) {
      nextLayers.splice(v2Index + 1, 0, comboLayer);
    } else {
      nextLayers.push(comboLayer);
    }
  }

  return {
    ...layers,
    layers: nextLayers,
  };
}

function getPestDetectionStats() {
  const detections = currentPestDetections?.detections || [];
  const high = detections.filter((item) => item.severity === "high").length;
  const medium = detections.filter((item) => item.severity === "medium").length;
  const low = detections.filter((item) => item.severity === "low").length;
  return {
    total: detections.length,
    high,
    medium,
    low,
    railsAffected: new Set(detections.map((item) => item.rail_name).filter(Boolean)).size,
  };
}

function getHarvestStageStats(items = []) {
  const stageCounts = {
    flower: 0,
    unripe: 0,
    midripe: 0,
    ripe: 0,
  };
  for (const item of items) {
    const stage = getHarvestStageInfo(item?.value).id;
    if (stageCounts[stage] != null) stageCounts[stage] += 1;
  }
  return stageCounts;
}

function chooseDefaultLayerId(layers) {
  const layerList = layers?.layers || [];
  if (!layerList.length) return null;
  const preferred = layerList.find((layer) => layer.id === "disease_pest_risk_v2_harvest")
    || layerList.find((layer) => layer.id === "disease_pest_risk_v2");
  return preferred?.id || layerList[0]?.id || null;
}

function findLayerItemForFrame(layerId, frame) {
  if (!frame || !currentLayers?.layers?.length) return null;
  const layer = currentLayers.layers.find((item) => item.id === layerId);
  if (!layer || !Array.isArray(layer.items)) return null;
  const frameId = Number(frame.id);
  const odomX = Number(frame.odom_x);
  return layer.items.find((item) => {
    if (Array.isArray(item.frame_ids) && Number.isFinite(frameId) && item.frame_ids.includes(frameId)) {
      return true;
    }
    if (item.rail_name !== frame.rail_name || !Number.isFinite(odomX)) return false;
    const start = Number(item.start_m);
    const end = Number(item.end_m);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return odomX >= Math.min(start, end) && odomX <= Math.max(start, end);
  }) || null;
}

function pickMiniMapRiskFrameIds(item) {
  const frameIds = Array.isArray(item?.frame_ids) ? item.frame_ids : [];
  if (!frameIds.length) return [];
  const value = Number(item.value) || 0;
  const seed = stableHash(`${item.id || ""}:${item.rail_name || ""}:${item.start_m || ""}:${item.end_m || ""}`);
  const markerCount = item.severity === "high" || value >= 70
    ? (seed % 4 === 0 ? 1 : 2)
    : value >= 45
      ? (seed % 5 === 0 ? 0 : 1)
      : 0;
  if (markerCount <= 0) return [];
  const pickAt = (ratio) => frameIds[clamp(Math.round((frameIds.length - 1) * ratio), 0, frameIds.length - 1)];
  if (markerCount === 1 || frameIds.length === 1) {
    return [pickAt(0.18 + ((seed % 61) / 100))];
  }
  return [
    pickAt(0.12 + ((seed % 37) / 100)),
    pickAt(0.58 + (((seed >> 3) % 34) / 100)),
  ].filter((id, index, list) => list.indexOf(id) === index);
}

function miniMapRiskColor(severity, value = 0) {
  const numeric = Number(value) || 0;
  if (severity === "high" || numeric >= 70) return "rgba(255, 91, 69, 0.86)";
  if (severity === "medium" || numeric >= 45) return "rgba(242, 162, 58, 0.78)";
  return "rgba(69, 212, 106, 0.58)";
}

const DISEASE_LABELS = [
  { id: "powdery-mildew", label: "Powdery mildew", aliases: ["흰가루병", "powdery mildew"] },
  { id: "gray-mold", label: "Gray mold / Botrytis fruit rot", aliases: ["잿빛곰팡이병", "gray mold", "botrytis fruit rot"] },
  { id: "spider-mite", label: "Two-spotted spider mite", aliases: ["점박이응애", "two-spotted spider mite", "spider mite"] },
  { id: "thrips", label: "Thrips", aliases: ["총채벌레", "thrips"] },
  { id: "anthracnose", label: "Anthracnose", aliases: ["탄저병", "anthracnose"] },
];

function getDiseaseInfo(seed, fallback = "") {
  const text = String(fallback || "").trim().toLowerCase();
  const matched = DISEASE_LABELS.find((item) =>
    item.aliases.some((alias) => text === alias || text.includes(alias))
  );
  if (matched) return matched;
  return DISEASE_LABELS[Math.abs(seed) % DISEASE_LABELS.length];
}

function seededUnit(seed, salt) {
  return (stableHash(`${seed}:${salt}`) % 10000) / 10000;
}

function seededRange(seed, salt, min, max) {
  return min + seededUnit(seed, salt) * (max - min);
}

function seededInt(seed, salt, min, max) {
  return Math.floor(seededRange(seed, salt, min, max + 1));
}

const DETECTION_BOX_LAYOUTS = [
  [
    { x: 13, y: 16 }, { x: 42, y: 22 }, { x: 64, y: 54 }, { x: 21, y: 66 },
  ],
  [
    { x: 55, y: 14 }, { x: 18, y: 35 }, { x: 67, y: 42 }, { x: 34, y: 64 },
  ],
  [
    { x: 22, y: 18 }, { x: 52, y: 38 }, { x: 12, y: 58 }, { x: 70, y: 62 },
  ],
  [
    { x: 63, y: 20 }, { x: 31, y: 28 }, { x: 47, y: 60 }, { x: 15, y: 48 },
  ],
  [
    { x: 16, y: 24 }, { x: 58, y: 18 }, { x: 38, y: 48 }, { x: 71, y: 57 },
  ],
];

function normalizeDetectionBox(box) {
  const w = clamp(Number(box.w) || 22, 11, 48);
  const h = clamp(Number(box.h) || 20, 12, 42);
  return {
    ...box,
    w,
    h,
    x: clamp(Number(box.x) || 0, 2, 98 - w),
    y: clamp(Number(box.y) || 0, 3, 97 - h),
  };
}

function detectionBoxesOverlap(a, b, gap = 3) {
  return !(
    a.x + a.w + gap <= b.x
    || b.x + b.w + gap <= a.x
    || a.y + a.h + gap <= b.y
    || b.y + b.h + gap <= a.y
  );
}

function placeDetectionBox(candidate, placed, seed) {
  const first = normalizeDetectionBox(candidate);
  if (!placed.some((box) => detectionBoxesOverlap(first, box))) return first;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const attemptSeed = stableHash(`${seed}:${attempt}`);
    const shifted = normalizeDetectionBox({
      ...candidate,
      x: 4 + ((attemptSeed >> 4) % Math.max(1, Math.round(92 - candidate.w))),
      y: 6 + ((attemptSeed >> 9) % Math.max(1, Math.round(88 - candidate.h))),
    });
    if (!placed.some((box) => detectionBoxesOverlap(shifted, box))) return shifted;
  }

  const fallbackY = placed.reduce((cursor, box) => Math.max(cursor, box.y + box.h + 4), 6);
  return normalizeDetectionBox({ ...candidate, y: fallbackY });
}

function layoutDetectionBoxes(boxes, seed) {
  const placed = [];
  for (const box of boxes.filter(Boolean)) {
    placed.push(placeDetectionBox(box, placed, `${seed}:${placed.length}`));
  }
  return placed;
}

function makeSyntheticDetectionBoxes(frame, cameraName, riskItem, selected) {
  if (!riskItem) return [];
  const value = Number(riskItem.value) || 0;
  if (value < 45 && !selected) return [];
  const seed = stableHash(`${frame.id}:${cameraName}:${riskItem.id || ""}`);
  if (!selected && seededUnit(seed, "visible") > (value >= 70 ? 0.42 : 0.24)) return [];
  const count = selected
    ? (value >= 70 ? seededInt(seed, "selected-high-count", 2, 4) : seededInt(seed, "selected-count", 1, 3))
    : (value >= 70 && seededUnit(seed, "extra") > 0.58 ? 2 : 1);
  const layout = DETECTION_BOX_LAYOUTS[seed % DETECTION_BOX_LAYOUTS.length];
  const dominantDisease = getDiseaseInfo(seed, riskItem.label);
  const boxes = [];
  for (let index = 0; index < count; index += 1) {
    const localSeed = stableHash(`${seed}:${index}`);
    const disease = index === 0 || seededUnit(localSeed, "same-class") > 0.28
      ? dominantDisease
      : getDiseaseInfo(localSeed);
    const wide = disease.id === "gray-mold"
      || disease.id === "anthracnose"
      || (disease.id === "thrips" && seededUnit(localSeed, "wide-thrips") > 0.42);
    const compact = disease.id === "spider-mite"
      || (disease.id === "powdery-mildew" && seededUnit(localSeed, "powdery-small") > 0.48);
    const elongated = seededUnit(localSeed, "elongated") > 0.78;
    const w = elongated
      ? seededRange(localSeed, "w-long", 32, 47)
      : compact
        ? seededRange(localSeed, "w-compact", 12, 23)
        : wide
          ? seededRange(localSeed, "w-wide", 25, 42)
          : seededRange(localSeed, "w-mid", 18, 32);
    const h = elongated
      ? seededRange(localSeed, "h-long", 14, 23)
      : compact
        ? seededRange(localSeed, "h-compact", 13, 24)
        : wide
          ? seededRange(localSeed, "h-wide", 17, 34)
          : seededRange(localSeed, "h-mid", 17, 31);
    const anchor = layout[index % layout.length];
    const spill = Math.floor(index / layout.length);
    const x = anchor.x
      + seededRange(localSeed, "x-jitter", -8, 8)
      + spill * seededRange(localSeed, "x-spill", -5, 5);
    const y = anchor.y
      + seededRange(localSeed, "y-jitter", -7, 9)
      + spill * seededRange(localSeed, "y-spill", -4, 6);
    boxes.push({
      x,
      y,
      w,
      h,
      label: disease.label,
      diseaseId: disease.id,
      severity: riskItem.severity,
    });
  }
  return layoutDetectionBoxes(boxes, `${frame.id}:${cameraName}:${riskItem.id || ""}`);
}

function getFrameCropCounts(frame) {
  const railRow = getRailCropRows(currentCropSummary).find((row) => row.rail_name === frame?.rail_name);
  if (railRow) return { ...railRow.counts };
  const cropState = getCropPanelState(currentCropSummary);
  return {
    flower: cropState.counts.flower,
    unripe: cropState.counts.unripe,
    midripe: cropState.counts.midripe,
    ripe: cropState.counts.ripe,
  };
}

function buildStageMixFromScore(score) {
  const numeric = Number.isFinite(Number(score)) ? clamp(Number(score), 0, 100) : 45;
  const centers = [
    { id: "flower", center: 12 },
    { id: "unripe", center: 38 },
    { id: "midripe", center: 64 },
    { id: "ripe", center: 90 },
  ];
  const raw = centers.map((stage) => ({
    id: stage.id,
    value: Math.max(0.02, 1 - Math.abs(numeric - stage.center) / 34),
  }));
  const total = raw.reduce((sum, item) => sum + item.value, 0) || 1;
  return Object.fromEntries(raw.map((item) => [item.id, (item.value / total) * 100]));
}

function getFrameMaturityValue(frame, cropCounts = null) {
  const harvestItem = findLayerItemForFrame("harvest_readiness", frame)
    || findLayerItemForFrame("disease_pest_risk_v2_harvest", frame);
  const layerValue = Number(harvestItem?.value);
  if (Number.isFinite(layerValue)) return clamp(layerValue, 0, 100);

  const counts = cropCounts || getFrameCropCounts(frame);
  const score = computeCropMaturityScore({ counts });
  if (score != null) return clamp(score, 0, 100);
  return 0;
}

function getFramePestRiskValue(frame) {
  const frameId = Number(frame?.id);
  const detections = (currentPestDetections?.detections || [])
    .filter((item) => Number(item.frame_id) === frameId);
  if (detections.length) {
    const severityScore = { high: 92, medium: 62, low: 28 };
    return Math.max(...detections.map((item) => severityScore[item.severity] || 50));
  }

  const pestItem = findLayerItemForFrame("disease_pest_risk", frame)
    || findLayerItemForFrame("action_priority", frame);
  const value = Number(pestItem?.value);
  return Number.isFinite(value) ? clamp(value, 0, 100) : 0;
}

function buildDetectionBarData(frame) {
  if (!frame) return [];
  const counts = getFrameCropCounts(frame);
  const total = CROP_MAP_CHART_SERIES.reduce((sum, series) => sum + (counts[series.id] || 0), 0);
  const maturity = getFrameMaturityValue(frame, counts);
  const stageValues = total > 0
    ? Object.fromEntries(CROP_MAP_CHART_SERIES.map((series) => [series.id, ((counts[series.id] || 0) / total) * 100]))
    : buildStageMixFromScore(maturity);
  const pestRisk = getFramePestRiskValue(frame);

  return [
    ...CROP_MAP_CHART_SERIES.map((series) => ({
      id: series.id,
      label: series.label,
      value: clamp(stageValues[series.id] || 0, 0, 100),
      color: series.color,
      unit: "%",
    })),
    {
      id: "pest",
      label: "병충해",
      value: pestRisk,
      color: "#ff5b45",
      unit: "",
    },
    {
      id: "maturity",
      label: "성숙도",
      value: maturity,
      color: "#45d46a",
      unit: "",
    },
  ];
}

function renderDetectionBars(frame) {
  const scope = document.getElementById("rtsDetectionScope");
  const chart = document.getElementById("rtsDetectionChart");
  if (!scope || !chart) return;
  if (!frame) {
    scope.textContent = "-";
    chart.innerHTML = `<div class="rts-detection-empty">No target selected</div>`;
    return;
  }

  const bars = buildDetectionBarData(frame);
  scope.textContent = `${frame.rail_name || "-"} · ${formatMeters(frame.odom_x)}`;
  chart.innerHTML = bars.map((bar) => {
    const value = clamp(Number(bar.value) || 0, 0, 100);
    return `
      <div class="rts-detection-bar" style="--bar-color:${bar.color};--bar-value:${value.toFixed(2)}%">
        <div class="rts-detection-track">
          <span class="rts-detection-fill"></span>
        </div>
        <strong>${Math.round(value)}${bar.unit}</strong>
        <span>${bar.label}</span>
      </div>
    `;
  }).join("");
}

function setActiveMapLayer(layerId, { forceOff = false } = {}) {
  const layer = currentLayers?.layers?.find((item) => item.id === layerId) || null;
  if (!layer || forceOff) {
    activeLayerId = null;
    showLayerOverlay = false;
    selectedSegmentId = null;
    hoveredSegmentId = null;
    selectedPestDetectionId = null;
    showSegmentTooltip(null);
    updateLayerRowStates();
    renderLayerLegend(null);
    renderLayerSummary(null);
    currentMap?.queueRender();
    return;
  }

  activeLayerId = layer.id;
  showLayerOverlay = true;
  selectedSegmentId = null;
  hoveredSegmentId = null;
  selectedPestDetectionId = null;
  showSegmentTooltip(null);
  updateLayerRowStates();
  renderLayerLegend(layer);
  renderLayerSummary(layer);
  currentMap?.queueRender();
}

function formatPestMarkerTitle(detection) {
  const disease = getDiseaseInfo(stableHash(detection.id || `${detection.frame_id}`), detection.label);
  const bits = [disease.label];
  if (detection.rail_name && detection.odom_x != null) {
    bits.push(`${detection.rail_name} ${detection.odom_x.toFixed(1)}m`);
  }
  if (detection.camera && CAMERA_LABELS[detection.camera]) {
    bits.push(getCameraLabel(detection.camera));
  }
  if (detection.confidence != null) {
    bits.push(`신뢰도 ${Math.round(detection.confidence * 100)}%`);
  }
  return bits.join(" · ");
}

// ─── TileMap ─────────────────────────────────────────────────────────────────

function getFrameCameraNames(frame) {
  return CAMERA_ORDER.filter((cameraName) => frame.cameras?.[cameraName]);
}

function isSingleCameraFrame(frame) {
  return getFrameCameraNames(frame).length === 1;
}

function isSingleCameraSession(frames) {
  return frames.length > 0 && frames.every((frame) => isSingleCameraFrame(frame));
}

function computeDetailSheetSize(frame) {
  let maxWidth = 0;
  let maxHeight = 0;
  const cameraNames = getFrameCameraNames(frame);
  for (const cameraName of cameraNames) {
    const camera = frame.cameras[cameraName];
    if (!camera) continue;
    maxWidth = Math.max(maxWidth, camera.width || 0);
    maxHeight = Math.max(maxHeight, camera.height || 0);
  }
  if (!maxWidth || !maxHeight) return null;
  if (cameraNames.length === 1) return { width: maxWidth, height: maxHeight };
  return { width: maxWidth * 2, height: maxHeight * 2 };
}

function computeViewerMaxZoom(manifest, frames) {
  let detailScale = 1;
  for (const frame of frames) {
    const size = computeDetailSheetSize(frame);
    if (!size) continue;
    detailScale = Math.max(
      detailScale,
      size.width / frame.rect_px.width,
      size.height / frame.rect_px.height,
    );
  }
  const sourceResolutionZoom = manifest.max_zoom + Math.log2(Math.max(1, detailScale));
  if (isSingleCameraSession(frames)) {
    return Math.max(manifest.max_zoom + 1.5, sourceResolutionZoom);
  }
  return sourceResolutionZoom;
}

function getCameraImageCandidates(frame, camera) {
  const candidates = [];
  if (isSingleCameraFrame(frame) && frame.contact_sheet_url && frame.rect_px?.width) {
    candidates.push({
      width: frame.rect_px.width,
      url: frame.contact_sheet_url,
    });
  }
  for (const lod of camera.lods || []) {
    if (lod?.url && lod?.width) {
      candidates.push({
        width: Number(lod.width),
        url: lod.url,
      });
    }
  }
  if (camera.url && camera.width) {
    candidates.push({
      width: Number(camera.width),
      url: camera.url,
    });
  }
  const deduped = new Map();
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.width) || candidate.width <= 0 || !candidate.url) continue;
    deduped.set(candidate.url, candidate);
  }
  return [...deduped.values()].sort((a, b) => a.width - b.width);
}

function buildCameraSrcSet(frame, camera) {
  const candidates = getCameraImageCandidates(frame, camera);
  return candidates.map((candidate) => `${candidate.url} ${Math.round(candidate.width)}w`).join(", ");
}

class TileMap {
  constructor({
    container,
    tilePane,
    detailPane,
    annotationPane,
    markerPane,
    overlayCanvas,
    miniMapCanvas,
    verticalScrollBar,
    verticalScrollTrack,
    verticalScrollThumb,
    scrollUpButton,
    scrollDownButton,
    horizontalScrollBar,
    horizontalScrollTrack,
    horizontalScrollThumb,
    scrollLeftButton,
    scrollRightButton,
    manifest,
    frames,
    pestDetections,
    growthDetections,
    onSelect,
    onViewChange,
    maxZoom,
  }) {
    this.container = container;
    this.tilePane = tilePane;
    this.detailPane = detailPane;
    this.annotationPane = annotationPane;
    this.markerPane = markerPane;
    this.overlayCanvas = overlayCanvas;
    this.ctx = overlayCanvas.getContext("2d");
    this.miniMapCanvas = miniMapCanvas;
    this.miniMapCtx = miniMapCanvas ? miniMapCanvas.getContext("2d") : null;
    this.verticalScrollBar = verticalScrollBar;
    this.verticalScrollTrack = verticalScrollTrack;
    this.verticalScrollThumb = verticalScrollThumb;
    this.scrollUpButton = scrollUpButton;
    this.scrollDownButton = scrollDownButton;
    this.horizontalScrollBar = horizontalScrollBar;
    this.horizontalScrollTrack = horizontalScrollTrack;
    this.horizontalScrollThumb = horizontalScrollThumb;
    this.scrollLeftButton = scrollLeftButton;
    this.scrollRightButton = scrollRightButton;
    this.manifest = manifest;
    this.frames = frames;
    this.singleCameraSession = isSingleCameraSession(frames);
    this.framesById = new Map(frames.map((frame) => [String(frame.id), frame]));
    this.railTrackWorldBounds = this.computeRailTrackWorldBounds();
    this.pestDetections = normalizePestDetections(pestDetections, manifest.session_name);
    this.growthDetections = normalizeGrowthDetections(growthDetections, manifest.session_name);
    this.detectionOverlayRevision = 1;
    this.onSelect = onSelect;
    this.onViewChange = onViewChange;
    this.visibleTiles = new Map();
    this.visibleDetails = new Map();
    this.visibleAnnotations = new Map();
    this.visiblePestMarkers = new Map();
    this.prefetchedUrls = new Set();
    this.prefetchTimer = null;
    this.selectedFrameId = null;
    this.minZoom = manifest.min_zoom;
    this.maxZoom = Math.max(maxZoom || manifest.max_zoom, manifest.max_zoom);
    this.detailFadeStartZoom = this.singleCameraSession
      ? Math.max(this.minZoom, manifest.max_zoom - 0.45)
      : Math.min(this.maxZoom, manifest.max_zoom + 0.35);
    this.detailFadeSpan = this.singleCameraSession ? 0.25 : 0.6;
    this.currentZoom = clamp(manifest.max_zoom - 3, this.minZoom, this.maxZoom);
    this.tileZoom = this.minZoom;
    this.zoomDims = null;
    this.zoomImageWidth = manifest.image_width;
    this.zoomImageHeight = manifest.image_height;
    this.integerScaleX = 1;
    this.integerScaleY = 1;
    this.scaleX = 1;
    this.scaleY = 1;
    this.tileScale = 1;
    this.tileWorldWidth = manifest.tile_size;
    this.tileWorldHeight = manifest.tile_size;
    this.centerX = manifest.image_width / 2;
    this.centerY = manifest.image_height / 2;
    this.pointerAnchor = null;
    this.drag = null;
    this.activePointers = new Map();
    this.pinch = null;
    this.lastTap = null;
    this.renderFrame = 0;
    this.destroyed = false;
    this.handlers = null;
    this.miniMapHandlers = null;
    this.miniMapDrag = null;
    this.verticalScrollHandlers = null;
    this.verticalScrollDrag = null;
    this.horizontalScrollHandlers = null;
    this.horizontalScrollDrag = null;
    this.resizeObserver = new ResizeObserver(() => this.queueRender());
    this.resizeObserver.observe(this.container);
    this.bind();
    this.bindMiniMap();
    this.bindVerticalScroll();
    this.bindHorizontalScroll();
    this.fitToBounds(false);
  }

  setGrowthDetections(payload) {
    this.growthDetections = normalizeGrowthDetections(payload, this.manifest.session_name);
    currentGrowthDetections = this.growthDetections;
    this.detectionOverlayRevision += 1;
    this.queueRender();
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    if (this.prefetchTimer) clearTimeout(this.prefetchTimer);
    if (this.renderFrame) {
      cancelAnimationFrame(this.renderFrame);
      this.renderFrame = 0;
    }
    this.activePointers.clear();
    this.pinch = null;
    this.lastTap = null;
    if (this.handlers) {
      this.container.removeEventListener("wheel", this.handlers.wheel);
      this.container.removeEventListener("pointerdown", this.handlers.pointerdown);
      this.container.removeEventListener("pointerenter", this.handlers.pointerenter);
      this.container.removeEventListener("pointermove", this.handlers.pointermove);
      this.container.removeEventListener("pointerup", this.handlers.endPointer);
      this.container.removeEventListener("pointercancel", this.handlers.endPointer);
      this.container.removeEventListener("pointerleave", this.handlers.pointerleave);
      this.container.removeEventListener("dblclick", this.handlers.dblclick);
      this.handlers = null;
    }
    if (this.miniMapCanvas && this.miniMapHandlers) {
      this.miniMapCanvas.removeEventListener("pointerdown", this.miniMapHandlers.pointerdown);
      this.miniMapCanvas.removeEventListener("pointermove", this.miniMapHandlers.pointermove);
      this.miniMapCanvas.removeEventListener("pointerup", this.miniMapHandlers.endPointer);
      this.miniMapCanvas.removeEventListener("pointercancel", this.miniMapHandlers.endPointer);
      this.miniMapCanvas.removeEventListener("lostpointercapture", this.miniMapHandlers.endPointer);
      document.removeEventListener("pointermove", this.miniMapHandlers.pointermove);
      document.removeEventListener("pointerup", this.miniMapHandlers.endPointer);
      document.removeEventListener("pointercancel", this.miniMapHandlers.endPointer);
      this.miniMapHandlers = null;
    }
    if (this.verticalScrollBar && this.verticalScrollHandlers) {
      this.verticalScrollBar.removeEventListener("pointerdown", this.verticalScrollHandlers.stopMapPointer);
      this.verticalScrollBar.removeEventListener("wheel", this.verticalScrollHandlers.wheel);
      this.verticalScrollTrack?.removeEventListener("pointerdown", this.verticalScrollHandlers.trackPointerDown);
      this.verticalScrollThumb?.removeEventListener("pointerdown", this.verticalScrollHandlers.thumbPointerDown);
      this.scrollUpButton?.removeEventListener("click", this.verticalScrollHandlers.scrollUp);
      this.scrollDownButton?.removeEventListener("click", this.verticalScrollHandlers.scrollDown);
      document.removeEventListener("pointermove", this.verticalScrollHandlers.pointerMove);
      document.removeEventListener("pointerup", this.verticalScrollHandlers.endPointer);
      document.removeEventListener("pointercancel", this.verticalScrollHandlers.endPointer);
      this.verticalScrollHandlers = null;
    }
    if (this.horizontalScrollBar && this.horizontalScrollHandlers) {
      this.horizontalScrollBar.removeEventListener("pointerdown", this.horizontalScrollHandlers.stopMapPointer);
      this.horizontalScrollBar.removeEventListener("wheel", this.horizontalScrollHandlers.wheel);
      this.horizontalScrollTrack?.removeEventListener("pointerdown", this.horizontalScrollHandlers.trackPointerDown);
      this.horizontalScrollThumb?.removeEventListener("pointerdown", this.horizontalScrollHandlers.thumbPointerDown);
      this.scrollLeftButton?.removeEventListener("click", this.horizontalScrollHandlers.scrollLeft);
      this.scrollRightButton?.removeEventListener("click", this.horizontalScrollHandlers.scrollRight);
      document.removeEventListener("pointermove", this.horizontalScrollHandlers.pointerMove);
      document.removeEventListener("pointerup", this.horizontalScrollHandlers.endPointer);
      document.removeEventListener("pointercancel", this.horizontalScrollHandlers.endPointer);
      this.horizontalScrollHandlers = null;
    }
    for (const tile of this.visibleTiles.values()) tile.remove();
    for (const detail of this.visibleDetails.values()) detail.remove();
    for (const ann of this.visibleAnnotations.values()) ann.remove();
    for (const marker of this.visiblePestMarkers.values()) marker.remove();
    this.visibleTiles.clear();
    this.visibleDetails.clear();
    this.visibleAnnotations.clear();
    this.visiblePestMarkers.clear();
  }

  bind() {
    const isTouchLikePointer = (event) => event.pointerType && event.pointerType !== "mouse";
    const rememberPointer = (event) => {
      if (!isTouchLikePointer(event)) return;
      this.activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };
    const forgetPointer = (event) => {
      if (!isTouchLikePointer(event)) return;
      this.activePointers.delete(event.pointerId);
    };
    const getPinchMetrics = () => {
      const points = Array.from(this.activePointers.values());
      if (points.length < 2) return null;
      const [first, second] = points;
      const dx = second.clientX - first.clientX;
      const dy = second.clientY - first.clientY;
      const distance = Math.hypot(dx, dy);
      if (!Number.isFinite(distance) || distance < 8) return null;
      const rect = this.container.getBoundingClientRect();
      return {
        distance,
        anchor: {
          x: clamp((first.clientX + second.clientX) / 2 - rect.left, 0, rect.width),
          y: clamp((first.clientY + second.clientY) / 2 - rect.top, 0, rect.height),
        },
      };
    };
    const beginPinch = () => {
      const metrics = getPinchMetrics();
      if (!metrics) return false;
      this.pinch = metrics;
      this.drag = null;
      this.container.classList.add("is-dragging");
      return true;
    };
    const updatePinch = () => {
      const metrics = getPinchMetrics();
      if (!metrics) return;
      if (!this.pinch) {
        this.pinch = metrics;
        return;
      }
      const dx = metrics.anchor.x - this.pinch.anchor.x;
      const dy = metrics.anchor.y - this.pinch.anchor.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        this.panBy(dx, dy);
      }
      const zoomDelta = Math.log2(metrics.distance / this.pinch.distance);
      if (Number.isFinite(zoomDelta) && Math.abs(zoomDelta) > 0.005) {
        this.zoomBy(zoomDelta, metrics.anchor);
      }
      this.pinch = metrics;
    };
    const handleDoubleTapZoom = (event) => {
      const now = event.timeStamp || performance.now();
      const tap = {
        time: now,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      const lastTap = this.lastTap;
      this.lastTap = tap;
      if (!lastTap) return false;
      const elapsed = now - lastTap.time;
      const distance = Math.hypot(event.clientX - lastTap.clientX, event.clientY - lastTap.clientY);
      if (elapsed > 320 || distance > 30) return false;
      this.lastTap = null;
      const anchor = this.getAnchorFromEvent(event);
      const zoomOutTarget = clamp(this.manifest.max_zoom - 0.8, this.minZoom, this.maxZoom);
      const zoomInTarget = clamp(this.currentZoom + 1, this.minZoom, this.maxZoom);
      const targetZoom = this.currentZoom >= this.maxZoom - 0.15 ? zoomOutTarget : zoomInTarget;
      this.zoomBy(targetZoom - this.currentZoom, anchor);
      return true;
    };

    this.handlers = {
      wheel: (event) => {
        event.preventDefault();
        const anchor = this.getAnchorFromEvent(event, { preferStored: true });
        const delta = event.deltaY > 0 ? -0.22 : 0.22;
        this.zoomBy(delta, anchor);
      },
      pointerdown: (event) => {
        if (isTouchLikePointer(event)) {
          event.preventDefault();
          rememberPointer(event);
        }
        this.updatePointerAnchor(event);
        this.container.setPointerCapture(event.pointerId);
        if (this.activePointers.size >= 2) {
          beginPinch();
          return;
        }
        this.drag = {
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          lastX: event.clientX,
          lastY: event.clientY,
          moved: false,
        };
        this.container.classList.add("is-dragging");
      },
      pointerenter: (event) => {
        this.updatePointerAnchor(event);
      },
      pointermove: (event) => {
        if (isTouchLikePointer(event)) {
          event.preventDefault();
          rememberPointer(event);
          if (this.pinch || this.activePointers.size >= 2) {
            if (!this.pinch) beginPinch();
            updatePinch();
            return;
          }
        }
        this.updatePointerAnchor(event);
        if (this.drag && this.drag.id === event.pointerId) {
          const dx = event.clientX - this.drag.lastX;
          const dy = event.clientY - this.drag.lastY;
          this.drag.lastX = event.clientX;
          this.drag.lastY = event.clientY;
          const moveThreshold = isTouchLikePointer(event) ? 10 : 3;
          if (
            Math.abs(event.clientX - this.drag.startX) > moveThreshold ||
            Math.abs(event.clientY - this.drag.startY) > moveThreshold
          ) {
            this.drag.moved = true;
          }
          this.panBy(dx, dy);
        } else if (showLayerOverlay) {
          if (isSegmentHoverDisabled()) {
            if (hoveredSegmentId) {
              hoveredSegmentId = null;
              showSegmentTooltip(null);
              this.queueRender();
            }
            return;
          }
          const rect = this.container.getBoundingClientRect();
          const world = this.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
          const seg = this.pickSegment(world.x, world.y);
          const newId = seg ? seg.id : null;
          if (newId !== hoveredSegmentId) {
            hoveredSegmentId = newId;
            showSegmentTooltip(seg, event.clientX - rect.left, event.clientY - rect.top);
            this.queueRender();
          }
        }
      },
      endPointer: (event) => {
        const isTouchLike = isTouchLikePointer(event);
        if (isTouchLike) {
          event.preventDefault();
          forgetPointer(event);
        }
        if (this.pinch) {
          if (this.activePointers.size >= 2) {
            beginPinch();
          } else {
            this.pinch = null;
            this.container.classList.remove("is-dragging");
          }
          return;
        }
        if (!this.drag || this.drag.id !== event.pointerId) return;
        const wasClick = !this.drag.moved;
        this.drag = null;
        this.container.classList.remove("is-dragging");
        if (wasClick && event.type !== "pointercancel") {
          if (isTouchLike && handleDoubleTapZoom(event)) return;
          const rect = this.container.getBoundingClientRect();
          const world = this.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
          // If layer overlay is active, check segment first
          if (showLayerOverlay) {
            const seg = this.pickSegment(world.x, world.y);
            if (seg) {
              selectedSegmentId = seg.id;
              renderSegmentDetail(seg);
              this.queueRender();
              return;
            }
          }
          const picked = this.pickFrame(world.x, world.y);
          if (picked) {
            selectedPestDetectionId = null;
            this.selectedFrameId = picked.id;
            this.onSelect(picked);
            this.queueRender();
          }
        }
      },
      pointerleave: () => {
        if (!this.drag) this.pointerAnchor = null;
        if (hoveredSegmentId) {
          hoveredSegmentId = null;
          showSegmentTooltip(null);
          this.queueRender();
        }
      },
      dblclick: (event) => {
        const anchor = this.getAnchorFromEvent(event, { preferStored: true });
        this.zoomBy(0.7, anchor);
      },
    };

    this.container.addEventListener("wheel", this.handlers.wheel, { passive: false });
    this.container.addEventListener("pointerdown", this.handlers.pointerdown);
    this.container.addEventListener("pointerenter", this.handlers.pointerenter);
    this.container.addEventListener("pointermove", this.handlers.pointermove);
    this.container.addEventListener("pointerup", this.handlers.endPointer);
    this.container.addEventListener("pointercancel", this.handlers.endPointer);
    this.container.addEventListener("pointerleave", this.handlers.pointerleave);
    this.container.addEventListener("dblclick", this.handlers.dblclick);
  }

  bindMiniMap() {
    if (!this.miniMapCanvas) return;
    const moveToPointer = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = this.miniMapCanvas.getBoundingClientRect();
      const mapped = this.miniMapScreenToWorld(
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
      );
      if (!mapped) return false;
      this.centerX = mapped.x;
      this.centerY = mapped.y;
      this.queueRender();
      return true;
    };
    this.miniMapHandlers = {
      pointerdown: (event) => {
        if (event.button != null && event.button !== 0) return;
        this.miniMapDrag = {
          id: event.pointerId,
        };
        this.miniMapCanvas.setPointerCapture?.(event.pointerId);
        this.miniMapCanvas.classList.add("is-dragging");
        moveToPointer(event);
      },
      pointermove: (event) => {
        if (!this.miniMapDrag) return;
        moveToPointer(event);
      },
      endPointer: (event) => {
        if (!this.miniMapDrag) return;
        event.stopPropagation();
        this.miniMapCanvas.releasePointerCapture?.(event.pointerId);
        this.miniMapCanvas.classList.remove("is-dragging");
        this.miniMapDrag = null;
      },
    };
    this.miniMapCanvas.addEventListener("pointerdown", this.miniMapHandlers.pointerdown);
    this.miniMapCanvas.addEventListener("pointermove", this.miniMapHandlers.pointermove);
    this.miniMapCanvas.addEventListener("pointerup", this.miniMapHandlers.endPointer);
    this.miniMapCanvas.addEventListener("pointercancel", this.miniMapHandlers.endPointer);
    this.miniMapCanvas.addEventListener("lostpointercapture", this.miniMapHandlers.endPointer);
    document.addEventListener("pointermove", this.miniMapHandlers.pointermove);
    document.addEventListener("pointerup", this.miniMapHandlers.endPointer);
    document.addEventListener("pointercancel", this.miniMapHandlers.endPointer);
  }

  bindVerticalScroll() {
    if (!this.verticalScrollBar || !this.verticalScrollTrack || !this.verticalScrollThumb) return;

    const scrollByViewport = (direction) => {
      const metrics = this.getVerticalScrollMetrics();
      if (!metrics.scrollable) return;
      const step = metrics.viewWorldHeight * 0.32;
      this.centerY = clamp(this.centerY + direction * step, metrics.minCenterY, metrics.maxCenterY);
      this.queueRender();
    };

    const setFromPointer = (event, offsetY = null) => {
      event.preventDefault();
      event.stopPropagation();
      const metrics = this.getVerticalScrollMetrics();
      if (!metrics.scrollable) return;
      const rect = this.verticalScrollTrack.getBoundingClientRect();
      const grabOffset = offsetY == null ? metrics.thumbHeight / 2 : offsetY;
      const thumbTop = event.clientY - rect.top - grabOffset;
      const ratio = metrics.travel > 0 ? thumbTop / metrics.travel : 0;
      this.centerY = metrics.minCenterY + clamp(ratio, 0, 1) * metrics.range;
      this.queueRender();
    };

    this.verticalScrollHandlers = {
      stopMapPointer: (event) => {
        event.stopPropagation();
      },
      wheel: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const metrics = this.getVerticalScrollMetrics();
        if (!metrics.scrollable) return;
        this.centerY = clamp(
          this.centerY + event.deltaY / this.scaleY,
          metrics.minCenterY,
          metrics.maxCenterY,
        );
        this.queueRender();
      },
      trackPointerDown: (event) => {
        if (event.button != null && event.button !== 0) return;
        this.verticalScrollDrag = { id: event.pointerId, offsetY: null };
        this.verticalScrollBar.classList.add("is-dragging");
        this.verticalScrollTrack.setPointerCapture?.(event.pointerId);
        setFromPointer(event);
      },
      thumbPointerDown: (event) => {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const thumbRect = this.verticalScrollThumb.getBoundingClientRect();
        this.verticalScrollDrag = {
          id: event.pointerId,
          offsetY: event.clientY - thumbRect.top,
        };
        this.verticalScrollBar.classList.add("is-dragging");
        this.verticalScrollThumb.setPointerCapture?.(event.pointerId);
      },
      pointerMove: (event) => {
        if (!this.verticalScrollDrag) return;
        setFromPointer(event, this.verticalScrollDrag.offsetY);
      },
      endPointer: (event) => {
        if (!this.verticalScrollDrag) return;
        try { this.verticalScrollTrack.releasePointerCapture?.(event.pointerId); } catch (_) {}
        try { this.verticalScrollThumb.releasePointerCapture?.(event.pointerId); } catch (_) {}
        this.verticalScrollBar.classList.remove("is-dragging");
        this.verticalScrollDrag = null;
      },
      scrollUp: (event) => {
        event.preventDefault();
        event.stopPropagation();
        scrollByViewport(-1);
      },
      scrollDown: (event) => {
        event.preventDefault();
        event.stopPropagation();
        scrollByViewport(1);
      },
    };

    this.verticalScrollBar.addEventListener("pointerdown", this.verticalScrollHandlers.stopMapPointer);
    this.verticalScrollBar.addEventListener("wheel", this.verticalScrollHandlers.wheel, { passive: false });
    this.verticalScrollTrack.addEventListener("pointerdown", this.verticalScrollHandlers.trackPointerDown);
    this.verticalScrollThumb.addEventListener("pointerdown", this.verticalScrollHandlers.thumbPointerDown);
    this.scrollUpButton?.addEventListener("click", this.verticalScrollHandlers.scrollUp);
    this.scrollDownButton?.addEventListener("click", this.verticalScrollHandlers.scrollDown);
    document.addEventListener("pointermove", this.verticalScrollHandlers.pointerMove);
    document.addEventListener("pointerup", this.verticalScrollHandlers.endPointer);
    document.addEventListener("pointercancel", this.verticalScrollHandlers.endPointer);
  }

  bindHorizontalScroll() {
    if (!this.horizontalScrollBar || !this.horizontalScrollTrack || !this.horizontalScrollThumb) return;

    const scrollByViewport = (direction) => {
      const metrics = this.getHorizontalScrollMetrics();
      if (!metrics.scrollable) return;
      const step = metrics.viewWorldWidth * 0.32;
      this.centerX = clamp(this.centerX + direction * step, metrics.minCenterX, metrics.maxCenterX);
      this.queueRender();
    };

    const setFromPointer = (event, offsetX = null) => {
      event.preventDefault();
      event.stopPropagation();
      const metrics = this.getHorizontalScrollMetrics();
      if (!metrics.scrollable) return;
      const rect = this.horizontalScrollTrack.getBoundingClientRect();
      const grabOffset = offsetX == null ? metrics.thumbWidth / 2 : offsetX;
      const thumbLeft = event.clientX - rect.left - grabOffset;
      const ratio = metrics.travel > 0 ? thumbLeft / metrics.travel : 0;
      this.centerX = metrics.minCenterX + clamp(ratio, 0, 1) * metrics.range;
      this.queueRender();
    };

    this.horizontalScrollHandlers = {
      stopMapPointer: (event) => {
        event.stopPropagation();
      },
      wheel: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const metrics = this.getHorizontalScrollMetrics();
        if (!metrics.scrollable) return;
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        this.centerX = clamp(
          this.centerX + delta / this.scaleX,
          metrics.minCenterX,
          metrics.maxCenterX,
        );
        this.queueRender();
      },
      trackPointerDown: (event) => {
        if (event.button != null && event.button !== 0) return;
        this.horizontalScrollDrag = { id: event.pointerId, offsetX: null };
        this.horizontalScrollBar.classList.add("is-dragging");
        this.horizontalScrollTrack.setPointerCapture?.(event.pointerId);
        setFromPointer(event);
      },
      thumbPointerDown: (event) => {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const thumbRect = this.horizontalScrollThumb.getBoundingClientRect();
        this.horizontalScrollDrag = {
          id: event.pointerId,
          offsetX: event.clientX - thumbRect.left,
        };
        this.horizontalScrollBar.classList.add("is-dragging");
        this.horizontalScrollThumb.setPointerCapture?.(event.pointerId);
      },
      pointerMove: (event) => {
        if (!this.horizontalScrollDrag) return;
        setFromPointer(event, this.horizontalScrollDrag.offsetX);
      },
      endPointer: (event) => {
        if (!this.horizontalScrollDrag) return;
        try { this.horizontalScrollTrack.releasePointerCapture?.(event.pointerId); } catch (_) {}
        try { this.horizontalScrollThumb.releasePointerCapture?.(event.pointerId); } catch (_) {}
        this.horizontalScrollBar.classList.remove("is-dragging");
        this.horizontalScrollDrag = null;
      },
      scrollLeft: (event) => {
        event.preventDefault();
        event.stopPropagation();
        scrollByViewport(-1);
      },
      scrollRight: (event) => {
        event.preventDefault();
        event.stopPropagation();
        scrollByViewport(1);
      },
    };

    this.horizontalScrollBar.addEventListener("pointerdown", this.horizontalScrollHandlers.stopMapPointer);
    this.horizontalScrollBar.addEventListener("wheel", this.horizontalScrollHandlers.wheel, { passive: false });
    this.horizontalScrollTrack.addEventListener("pointerdown", this.horizontalScrollHandlers.trackPointerDown);
    this.horizontalScrollThumb.addEventListener("pointerdown", this.horizontalScrollHandlers.thumbPointerDown);
    this.scrollLeftButton?.addEventListener("click", this.horizontalScrollHandlers.scrollLeft);
    this.scrollRightButton?.addEventListener("click", this.horizontalScrollHandlers.scrollRight);
    document.addEventListener("pointermove", this.horizontalScrollHandlers.pointerMove);
    document.addEventListener("pointerup", this.horizontalScrollHandlers.endPointer);
    document.addEventListener("pointercancel", this.horizontalScrollHandlers.endPointer);
  }

  get viewportWidth() { return this.container.clientWidth; }
  get viewportHeight() { return this.container.clientHeight; }
  get baseScale() { return Math.min(this.scaleX, this.scaleY); }

  computeRailTrackWorldBounds() {
    const layout = this.manifest.layout || {};
    if (!this.frames.length) {
      const marginX = Number(layout.margin_x) || 0;
      return {
        left: marginX,
        right: Math.max(marginX, this.manifest.image_width - marginX),
      };
    }

    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (const frame of this.frames) {
      const rect = frame.rect_px;
      if (!rect) continue;
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    }

    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      return { left: 0, right: this.manifest.image_width };
    }

    const pad = Math.max(24, Math.round((Number(layout.gap_x) || 0) / 2));
    return {
      left: clamp(left - pad, 0, this.manifest.image_width),
      right: clamp(right + pad, 0, this.manifest.image_width),
    };
  }

  updateViewTransform() {
    const tileZoom = clamp(Math.round(this.currentZoom), this.manifest.min_zoom, this.manifest.max_zoom);
    const zoomDims = this.manifest.zoom_dimensions[String(tileZoom)] || {};
    const fallbackScale = 2 ** (tileZoom - this.manifest.max_zoom);
    const fallbackWidth = Math.max(1, Math.round(this.manifest.image_width * fallbackScale));
    const fallbackHeight = Math.max(1, Math.round(this.manifest.image_height * fallbackScale));
    const zoomImageWidth = Math.max(
      1,
      zoomDims.image_width || (zoomDims.tiles_x ? zoomDims.tiles_x * this.manifest.tile_size : fallbackWidth),
    );
    const zoomImageHeight = Math.max(
      1,
      zoomDims.image_height || (zoomDims.tiles_y ? zoomDims.tiles_y * this.manifest.tile_size : fallbackHeight),
    );
    const tileScale = 2 ** (this.currentZoom - tileZoom);

    this.tileZoom = tileZoom;
    this.zoomDims = zoomDims;
    this.zoomImageWidth = zoomImageWidth;
    this.zoomImageHeight = zoomImageHeight;
    this.integerScaleX = zoomImageWidth / this.manifest.image_width;
    this.integerScaleY = zoomImageHeight / this.manifest.image_height;
    this.scaleX = this.integerScaleX * tileScale;
    this.scaleY = this.integerScaleY * tileScale;
    this.tileScale = tileScale;
    this.tileWorldWidth = this.manifest.tile_size / this.integerScaleX;
    this.tileWorldHeight = this.manifest.tile_size / this.integerScaleY;
  }

  fitToBounds(render = true) {
    const scaleX = this.viewportWidth / this.manifest.image_width;
    const scaleY = this.viewportHeight / this.manifest.image_height;
    const fitScale = Math.min(scaleX, scaleY) * 0.94;
    this.currentZoom = clamp(
      this.manifest.max_zoom + Math.log2(fitScale),
      this.minZoom,
      this.maxZoom,
    );
    this.centerX = this.manifest.image_width / 2;
    this.centerY = this.manifest.image_height / 2;
    this.updateViewTransform();
    if (render) this.queueRender();
    else this.render();
  }

  focusFrame(frame) {
    const rect = frame.rect_px;
    this.centerX = rect.center_x;
    this.centerY = rect.center_y;
    this.selectedFrameId = frame.id;
    this.currentZoom = clamp(Math.max(this.currentZoom, this.manifest.max_zoom - 1.2), this.minZoom, this.maxZoom);
    this.updateViewTransform();
    this.queueRender();
  }

  focusFrameAtZoom(frame, zoom, { centerX = null, centerY = null } = {}) {
    const rect = frame.rect_px;
    this.centerX = Number.isFinite(centerX) ? centerX : rect.center_x;
    this.centerY = Number.isFinite(centerY) ? centerY : rect.center_y;
    this.selectedFrameId = frame.id;
    this.currentZoom = clamp(zoom, this.minZoom, this.maxZoom);
    this.updateViewTransform();
    this.clampCenter();
    this.updateViewTransform();
    this.queueRender();
  }

  focusWorldPoint(worldX, worldY, { frameId = null, zoomFloor = this.manifest.max_zoom - 1.8 } = {}) {
    this.centerX = worldX;
    this.centerY = worldY;
    if (frameId != null) this.selectedFrameId = frameId;
    this.currentZoom = clamp(Math.max(this.currentZoom, zoomFloor), this.minZoom, this.maxZoom);
    this.updateViewTransform();
    this.queueRender();
  }

  updatePointerAnchor(event) {
    const rect = this.container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return this.pointerAnchor;
    this.pointerAnchor = { x: clamp(x, 0, rect.width), y: clamp(y, 0, rect.height) };
    return this.pointerAnchor;
  }

  getAnchorFromEvent(event, { preferStored = false } = {}) {
    if (preferStored && this.pointerAnchor) return this.pointerAnchor;
    return this.updatePointerAnchor(event) || this.pointerAnchor || {
      x: this.viewportWidth / 2,
      y: this.viewportHeight / 2,
    };
  }

  zoomBy(delta, anchor) {
    const before = this.screenToWorld(anchor.x, anchor.y);
    this.currentZoom = clamp(this.currentZoom + delta, this.minZoom, this.maxZoom);
    this.updateViewTransform();
    this.centerX = before.x - (anchor.x - this.viewportWidth / 2) / this.scaleX;
    this.centerY = before.y - (anchor.y - this.viewportHeight / 2) / this.scaleY;
    this.queueRender();
  }

  panBy(dx, dy) {
    this.centerX -= dx / this.scaleX;
    this.centerY -= dy / this.scaleY;
    this.queueRender();
  }

  clampCenter() {
    const halfW = this.viewportWidth / (2 * this.scaleX);
    const halfH = this.viewportHeight / (2 * this.scaleY);
    if (this.manifest.image_width > halfW * 2) {
      this.centerX = clamp(this.centerX, halfW, this.manifest.image_width - halfW);
    }
    if (this.manifest.image_height > halfH * 2) {
      this.centerY = clamp(this.centerY, halfH, this.manifest.image_height - halfH);
    }
  }

  queueRender() {
    if (this.destroyed || this.renderFrame) return;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = 0;
      if (this.destroyed) return;
      this.render();
    });
  }

  prepareCanvas(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const cssWidth = `${width}px`;
    const cssHeight = `${height}px`;
    if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
    if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;
    return dpr;
  }

  worldToScreen(x, y) {
    return {
      x: (x - this.centerX) * this.scaleX + this.viewportWidth / 2,
      y: (y - this.centerY) * this.scaleY + this.viewportHeight / 2,
    };
  }

  screenToWorld(x, y) {
    return {
      x: (x - this.viewportWidth / 2) / this.scaleX + this.centerX,
      y: (y - this.viewportHeight / 2) / this.scaleY + this.centerY,
    };
  }

  getVerticalScrollMetrics() {
    const trackHeight = this.verticalScrollTrack
      ? this.verticalScrollTrack.getBoundingClientRect().height
      : 0;
    const imageHeight = Math.max(1, this.manifest.image_height);
    const viewWorldHeight = this.viewportHeight / Math.max(this.scaleY, 0.0001);
    const scrollable = trackHeight > 0 && viewWorldHeight < imageHeight;
    const minCenterY = scrollable ? viewWorldHeight / 2 : imageHeight / 2;
    const maxCenterY = scrollable ? imageHeight - viewWorldHeight / 2 : imageHeight / 2;
    const range = Math.max(0, maxCenterY - minCenterY);
    const visibleRatio = clamp(viewWorldHeight / imageHeight, 0.08, 1);
    const thumbHeight = trackHeight > 0 ? clamp(trackHeight * visibleRatio, 28, trackHeight) : 0;
    const travel = Math.max(0, trackHeight - thumbHeight);
    const ratio = range > 0 ? clamp((this.centerY - minCenterY) / range, 0, 1) : 0;
    return {
      scrollable,
      trackHeight,
      viewWorldHeight,
      minCenterY,
      maxCenterY,
      range,
      thumbHeight,
      travel,
      ratio,
    };
  }

  updateVerticalScrollBar() {
    if (!this.verticalScrollBar || !this.verticalScrollThumb) return;
    const metrics = this.getVerticalScrollMetrics();
    this.verticalScrollBar.classList.toggle("is-disabled", !metrics.scrollable);
    this.verticalScrollThumb.style.height = `${metrics.thumbHeight}px`;
    this.verticalScrollThumb.style.transform = `translateY(${metrics.ratio * metrics.travel}px)`;
    this.verticalScrollBar.setAttribute("aria-valuenow", String(Math.round(metrics.ratio * 100)));
  }

  getHorizontalScrollMetrics() {
    const trackWidth = this.horizontalScrollTrack
      ? this.horizontalScrollTrack.getBoundingClientRect().width
      : 0;
    const imageWidth = Math.max(1, this.manifest.image_width);
    const viewWorldWidth = this.viewportWidth / Math.max(this.scaleX, 0.0001);
    const scrollable = trackWidth > 0 && viewWorldWidth < imageWidth;
    const minCenterX = scrollable ? viewWorldWidth / 2 : imageWidth / 2;
    const maxCenterX = scrollable ? imageWidth - viewWorldWidth / 2 : imageWidth / 2;
    const range = Math.max(0, maxCenterX - minCenterX);
    const visibleRatio = clamp(viewWorldWidth / imageWidth, 0.08, 1);
    const thumbWidth = trackWidth > 0 ? clamp(trackWidth * visibleRatio, 28, trackWidth) : 0;
    const travel = Math.max(0, trackWidth - thumbWidth);
    const ratio = range > 0 ? clamp((this.centerX - minCenterX) / range, 0, 1) : 0;
    return {
      scrollable,
      trackWidth,
      viewWorldWidth,
      minCenterX,
      maxCenterX,
      range,
      thumbWidth,
      travel,
      ratio,
    };
  }

  updateHorizontalScrollBar() {
    if (!this.horizontalScrollBar || !this.horizontalScrollThumb) return;
    const metrics = this.getHorizontalScrollMetrics();
    this.horizontalScrollBar.classList.toggle("is-disabled", !metrics.scrollable);
    this.horizontalScrollThumb.style.width = `${metrics.thumbWidth}px`;
    this.horizontalScrollThumb.style.transform = `translateX(${metrics.ratio * metrics.travel}px)`;
    this.horizontalScrollBar.setAttribute("aria-valuenow", String(Math.round(metrics.ratio * 100)));
  }

  getMiniMapTransform(width, height) {
    const pad = 10;
    const innerWidth = Math.max(1, width - pad * 2);
    const innerHeight = Math.max(1, height - pad * 2);
    const scaleX = innerWidth / this.manifest.image_width;
    const scaleY = innerHeight / this.manifest.image_height;
    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) return null;
    return {
      scale: Math.min(scaleX, scaleY),
      scaleX,
      scaleY,
      ox: pad,
      oy: pad,
    };
  }

  miniMapScreenToWorld(x, y, width, height) {
    const tx = this.getMiniMapTransform(width, height);
    if (!tx) return null;
    return {
      x: clamp((x - tx.ox) / tx.scaleX, 0, this.manifest.image_width),
      y: clamp((y - tx.oy) / tx.scaleY, 0, this.manifest.image_height),
    };
  }

  getMiniMapViewportRect(width, height, bounds = this.getViewBounds()) {
    const tx = this.getMiniMapTransform(width, height);
    if (!tx) return null;
    const mapW = this.manifest.image_width * tx.scaleX;
    const mapH = this.manifest.image_height * tx.scaleY;
    const centerX = tx.ox + clamp(this.centerX, 0, this.manifest.image_width) * tx.scaleX;
    const centerY = tx.oy + clamp(this.centerY, 0, this.manifest.image_height) * tx.scaleY;
    const actualWidth = Math.max(3, (bounds.right - bounds.left) * tx.scaleX);
    const actualHeight = Math.max(3, (bounds.bottom - bounds.top) * tx.scaleY);
    const visualWidth = clamp(actualWidth, 12, Math.max(24, mapW * 0.34));
    const visualHeight = clamp(actualHeight, 10, Math.max(18, mapH * 0.34));
    const left = centerX - visualWidth / 2;
    const top = centerY - visualHeight / 2;
    const right = centerX + visualWidth / 2;
    const bottom = centerY + visualHeight / 2;
    return {
      left,
      top,
      right,
      bottom,
      width: visualWidth,
      height: visualHeight,
      centerX,
      centerY,
    };
  }

  pickFrame(worldX, worldY) {
    let bestInside = null;
    let bestInsideDistance = Number.POSITIVE_INFINITY;
    let bestNear = null;
    let bestNearDistance = Number.POSITIVE_INFINITY;
    const threshold = 120;

    for (const frame of this.frames) {
      const rect = frame.rect_px;
      const inside = worldX >= rect.left && worldX <= rect.right && worldY >= rect.top && worldY <= rect.bottom;
      const dx = worldX < rect.left ? rect.left - worldX : worldX > rect.right ? worldX - rect.right : 0;
      const dy = worldY < rect.top ? rect.top - worldY : worldY > rect.bottom ? worldY - rect.bottom : 0;
      const dist = Math.hypot(dx, dy);
      if (inside) {
        const centerDist = Math.hypot(worldX - rect.center_x, worldY - rect.center_y);
        if (centerDist < bestInsideDistance) { bestInsideDistance = centerDist; bestInside = frame; }
      } else if (dist < threshold && dist < bestNearDistance) {
        bestNearDistance = dist;
        bestNear = frame;
      }
    }
    return bestInside || bestNear;
  }

  getViewBounds() {
    return {
      left: this.centerX - this.viewportWidth / (2 * this.scaleX),
      top: this.centerY - this.viewportHeight / (2 * this.scaleY),
      right: this.centerX + this.viewportWidth / (2 * this.scaleX),
      bottom: this.centerY + this.viewportHeight / (2 * this.scaleY),
    };
  }

  createDetailFrame(frame, { fetchPriority = "auto", displayWidth = 0 } = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = "detail-frame";
    wrapper.dataset.frameId = String(frame.id);
    const grid = document.createElement("div");
    grid.className = "detail-grid";
    const cameraNames = getFrameCameraNames(frame);
    const visibleCameraNames = cameraNames.length === 1 ? cameraNames : CAMERA_ORDER;
    grid.classList.toggle("is-single-camera", cameraNames.length === 1);
    for (const cameraName of visibleCameraNames) {
      const cell = document.createElement("div");
      cell.className = "detail-cell-wrap";
      cell.dataset.cameraName = cameraName;
      const camera = frame.cameras[cameraName];
      if (camera) {
        const image = document.createElement("img");
        image.className = "detail-cell";
        image.alt = `${frame.label} ${cameraName}`;
        image.draggable = false;
        image.decoding = "async";
        image.loading = fetchPriority === "high" ? "eager" : "lazy";
        image.fetchPriority = fetchPriority;
        const srcSet = buildCameraSrcSet(frame, camera);
        if (srcSet) image.srcset = srcSet;
        if (displayWidth > 0) image.sizes = `${Math.ceil(displayWidth)}px`;
        image.src = camera.url;
        cell.appendChild(image);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "detail-cell is-missing";
        cell.appendChild(placeholder);
      }
      grid.appendChild(cell);
    }
    wrapper.appendChild(grid);
    this.detailPane.appendChild(wrapper);
    return wrapper;
  }

  updateDetailFrameImageHints(detail, fetchPriority, displayWidth) {
    for (const image of detail.querySelectorAll("img.detail-cell")) {
      image.loading = fetchPriority === "high" ? "eager" : "lazy";
      image.fetchPriority = fetchPriority;
      if (displayWidth > 0) image.sizes = `${Math.ceil(displayWidth)}px`;
    }
  }

  getPestDetectionBoxesForCamera(frame, cameraName) {
    if (!isPestRiskPhotoOverlayEnabled()) return [];
    const camera = frame.cameras?.[cameraName];
    if (!camera) return [];
    const realDetections = getFrameDetections(this.pestDetections, frame.id)
      .filter((detection) => !detection.camera || detection.camera === cameraName);

    if (realDetections.length) {
      const boxes = realDetections.flatMap((detection, index) => {
        const bbox = Array.isArray(detection.bbox) ? detection.bbox : null;
        if (bbox && camera.width && camera.height) {
          const disease = getDiseaseInfo(index, detection.label);
          const x1 = clamp((Math.min(bbox[0], bbox[2]) / camera.width) * 100, 3, 94);
          const y1 = clamp((Math.min(bbox[1], bbox[3]) / camera.height) * 100, 4, 92);
          const x2 = clamp((Math.max(bbox[0], bbox[2]) / camera.width) * 100, x1 + 14, 97);
          const y2 = clamp((Math.max(bbox[1], bbox[3]) / camera.height) * 100, y1 + 18, 96);
          return [{
            kind: "pest",
            x: x1,
            y: y1,
            w: x2 - x1,
            h: y2 - y1,
            label: disease.label,
            diseaseId: disease.id,
            severity: detection.severity,
          }];
        }
        return makeSyntheticDetectionBoxes(frame, cameraName, {
          id: detection.id,
          label: detection.label,
          value: detection.severity === "high" ? 85 : detection.severity === "medium" ? 62 : 35,
          severity: detection.severity,
        }, true).slice(0, 3).map((box) => ({ ...box, kind: "pest" }));
      }).filter(Boolean);
      return layoutDetectionBoxes(boxes, `${frame.id}:${cameraName}:real`);
    }

    const riskItem = findLayerItemForFrame("disease_pest_risk", frame);
    const selected = Number(frame.id) === Number(this.selectedFrameId);
    return makeSyntheticDetectionBoxes(frame, cameraName, riskItem, selected)
      .map((box) => ({ ...box, kind: "pest" }));
  }

  getGrowthDetectionBoxesForCamera(frame, cameraName) {
    if (!isGrowthStatusPhotoOverlayEnabled()) return [];
    const camera = frame.cameras?.[cameraName];
    if (!camera?.width || !camera?.height) return [];
    return getFrameDetections(this.growthDetections, frame.id)
      .filter((detection) => !detection.camera || detection.camera === cameraName)
      .map((detection) => {
        const bbox = Array.isArray(detection.bbox) ? detection.bbox : null;
        if (!bbox) return null;
        const x1 = clamp((Math.min(bbox[0], bbox[2]) / camera.width) * 100, 0.5, 98);
        const y1 = clamp((Math.min(bbox[1], bbox[3]) / camera.height) * 100, 0.5, 98);
        const x2 = clamp((Math.max(bbox[0], bbox[2]) / camera.width) * 100, x1 + 2, 99.5);
        const y2 = clamp((Math.max(bbox[1], bbox[3]) / camera.height) * 100, y1 + 2, 99.5);
        const stage = getGrowthDetectionStageInfo(detection.stage || detection.label);
        return {
          kind: "growth",
          x: x1,
          y: y1,
          w: x2 - x1,
          h: y2 - y1,
          label: formatGrowthDetectionLabel(detection.stage || detection.label),
          stageId: stage.id,
          severity: stage.severity,
          confidence: detection.confidence,
          compact: (x2 - x1) < 5.5 || (y2 - y1) < 4.2,
        };
      })
      .filter(Boolean);
  }

  getDetectionBoxesForCamera(frame, cameraName) {
    return [
      ...this.getPestDetectionBoxesForCamera(frame, cameraName),
      ...this.getGrowthDetectionBoxesForCamera(frame, cameraName),
    ];
  }

  isCameraCellOverlayVisible(frame, cameraName) {
    const rect = frame.rect_px;
    if (isSingleCameraFrame(frame)) {
      const topLeft = this.worldToScreen(rect.left, rect.top);
      const bottomRight = this.worldToScreen(rect.right, rect.bottom);
      const visibleLeft = clamp(topLeft.x, 0, this.viewportWidth);
      const visibleTop = clamp(topLeft.y, 0, this.viewportHeight);
      const visibleRight = clamp(bottomRight.x, 0, this.viewportWidth);
      const visibleBottom = clamp(bottomRight.y, 0, this.viewportHeight);
      return visibleRight - visibleLeft > 1 && visibleBottom - visibleTop > 1;
    }
    const quadrantOffsets = {
      front_left: { x: 0.0, y: 0.0 },
      front_right: { x: 0.5, y: 0.0 },
      rear: { x: 0.0, y: 0.5 },
      side: { x: 0.5, y: 0.5 },
    };
    const quadrant = quadrantOffsets[cameraName];
    if (!quadrant) return true;
    const topLeft = this.worldToScreen(
      rect.left + rect.width * quadrant.x,
      rect.top + rect.height * quadrant.y,
    );
    const bottomRight = this.worldToScreen(
      rect.left + rect.width * (quadrant.x + 0.5),
      rect.top + rect.height * (quadrant.y + 0.5),
    );
    const cellW = bottomRight.x - topLeft.x;
    const cellH = bottomRight.y - topLeft.y;
    if (cellW <= 0 || cellH <= 0) return false;
    const visibleLeft = clamp(topLeft.x, 0, this.viewportWidth);
    const visibleTop = clamp(topLeft.y, 0, this.viewportHeight);
    const visibleRight = clamp(bottomRight.x, 0, this.viewportWidth);
    const visibleBottom = clamp(bottomRight.y, 0, this.viewportHeight);
    const visibleW = visibleRight - visibleLeft;
    const visibleH = visibleBottom - visibleTop;
    return visibleW > 1 && visibleH > 1;
  }

  updateDetailFrameDetectionOverlays(detail, frame) {
    for (const cell of detail.querySelectorAll(".detail-cell-wrap")) {
      const cameraName = cell.dataset.cameraName;
      const isVisible = this.isCameraCellOverlayVisible(frame, cameraName);
      const overlayKey = [
        frame.id,
        cameraName || "",
        isVisible ? "visible" : "hidden",
        isPestRiskPhotoOverlayEnabled() ? "pest" : "no-pest",
        isGrowthStatusPhotoOverlayEnabled() ? activeGrowthDetectionModelId : "no-growth",
        currentLanguage,
        this.detectionOverlayRevision,
      ].join("|");
      if (cell.dataset.detectionOverlayKey === overlayKey) continue;

      cell.dataset.detectionOverlayKey = overlayKey;
      cell.querySelector(".pest-box-layer")?.remove();
      if (!isVisible) continue;
      const boxes = this.getDetectionBoxesForCamera(frame, cameraName);
      if (!boxes.length) continue;
      const layer = document.createElement("div");
      layer.className = "pest-box-layer detection-box-layer";
      for (const box of boxes) {
        const marker = document.createElement("div");
        const isGrowthBox = box.kind === "growth";
        const compactClass = isGrowthBox && box.compact ? " is-compact" : "";
        marker.className = `${isGrowthBox ? "growth-detect-box" : "pest-detect-box"} severity-${box.severity || "medium"}${compactClass}`;
        if (isGrowthBox) marker.dataset.growthStage = box.stageId || "raw";
        else marker.dataset.disease = box.diseaseId || "";
        marker.style.left = `${box.x}%`;
        marker.style.top = `${box.y}%`;
        marker.style.width = `${box.w}%`;
        marker.style.height = `${box.h}%`;
        const label = document.createElement("span");
        label.className = isGrowthBox ? "growth-detect-label" : "pest-detect-label";
        label.textContent = box.label || getDiseaseInfo(0).label;
        marker.appendChild(label);
        layer.appendChild(marker);
      }
      cell.appendChild(layer);
    }
  }

  createFrameAnnotation(frame) {
    const wrapper = document.createElement("div");
    wrapper.className = "frame-annotation";
    wrapper.dataset.frameId = String(frame.id);
    const railLabel = document.createElement("div");
    railLabel.className = "frame-annotation-label";
    railLabel.textContent = frame.rail_name;
    wrapper.appendChild(railLabel);
    const cameraNames = isSingleCameraFrame(frame) ? getFrameCameraNames(frame) : CAMERA_ORDER;
    for (const cameraName of cameraNames) {
      const label = document.createElement("div");
      label.className = `frame-camera-label ${CAMERA_LABEL_CORNERS[cameraName] || "is-top-left"}`;
      label.dataset.cameraName = cameraName;
      label.textContent = getCameraLabel(cameraName) || cameraName;
      wrapper.appendChild(label);
    }
    this.annotationPane.appendChild(wrapper);
    return wrapper;
  }

  renderAnnotations(bounds) {
    const padding = 96 / this.baseScale;
    const wanted = new Set();
    for (const frame of this.frames) {
      const rect = frame.rect_px;
      if (rect.right < bounds.left - padding || rect.left > bounds.right + padding) continue;
      if (rect.bottom < bounds.top - padding || rect.top > bounds.bottom + padding) continue;
      const topLeft = this.worldToScreen(rect.left, rect.top);
      const bottomRight = this.worldToScreen(rect.right, rect.bottom);
      const screenW = bottomRight.x - topLeft.x;
      const screenH = bottomRight.y - topLeft.y;
      const clippedLeft = clamp(topLeft.x, 0, this.viewportWidth);
      const clippedTop = clamp(topLeft.y, 0, this.viewportHeight);
      const clippedRight = clamp(bottomRight.x, 0, this.viewportWidth);
      const clippedBottom = clamp(bottomRight.y, 0, this.viewportHeight);
      const visibleW = clippedRight - clippedLeft;
      const visibleH = clippedBottom - clippedTop;
      const showRail = visibleW >= 64 && visibleH >= 34;
      const showCameras = visibleW >= 112 && visibleH >= 64;
      if (!showRail && !showCameras) continue;
      wanted.add(frame.id);
      let annotation = this.visibleAnnotations.get(frame.id);
      if (!annotation) {
        annotation = this.createFrameAnnotation(frame);
        this.visibleAnnotations.set(frame.id, annotation);
      }
      annotation.style.left = `${topLeft.x}px`;
      annotation.style.top = `${topLeft.y}px`;
      annotation.style.width = `${screenW}px`;
      annotation.style.height = `${screenH}px`;
      annotation.classList.toggle("show-rail", showRail);
      annotation.classList.toggle("show-cameras", showCameras);
      const labelSize = Math.min(screenW, screenH, visibleW, visibleH);
      annotation.style.setProperty("--annotation-pad", `${clamp(Math.round(labelSize * 0.08), 6, 14)}px`);
      annotation.style.setProperty("--rail-font-size", `${clamp(Math.round(labelSize * 0.095), 11, 16)}px`);
      annotation.style.setProperty("--camera-font-size", `${clamp(Math.round(labelSize * 0.075), 10, 14)}px`);
    }
    for (const [frameId, annotation] of this.visibleAnnotations.entries()) {
      if (wanted.has(frameId)) continue;
      annotation.remove();
      this.visibleAnnotations.delete(frameId);
    }
  }

  clearPestMarkers() {
    for (const marker of this.visiblePestMarkers.values()) marker.remove();
    this.visiblePestMarkers.clear();
  }

  isPestMarkerLayerActive() {
    return showLayerOverlay
      && ["disease_pest_risk_v2", "disease_pest_risk_v2_harvest"].includes(activeLayerId)
      && this.pestDetections.available
      && this.pestDetections.detections.length > 0;
  }

  findPestMarkerSegment(detection) {
    const layer = getActiveLayer();
    if (!layer || layer.id !== "disease_pest_risk") return null;
    if (!detection.rail_name || detection.odom_x == null) return null;
    return layer.items.find((item) =>
      item.rail_name === detection.rail_name
      && detection.odom_x >= item.start_m
      && detection.odom_x <= item.end_m
    ) || null;
  }

  getPestMarkerAnchor(frame, detection) {
    const rect = frame.rect_px;
    let anchorX = rect.center_x;
    let anchorY = rect.top + rect.height * 0.22;
    const cameraName = detection.camera;
    if (isSingleCameraFrame(frame)) {
      const camera = frame.cameras?.[cameraName] || frame.cameras?.[getFrameCameraNames(frame)[0]];
      const bbox = Array.isArray(detection.bbox) ? detection.bbox : null;
      if (bbox && camera?.width && camera?.height) {
        const bboxCenterX = clamp((bbox[0] + bbox[2]) * 0.5 / camera.width, 0, 1);
        const bboxCenterY = clamp((bbox[1] + bbox[3]) * 0.5 / camera.height, 0, 1);
        return {
          x: rect.left + rect.width * bboxCenterX,
          y: rect.top + rect.height * bboxCenterY,
        };
      }
      return { x: anchorX, y: anchorY };
    }
    if (!cameraName || !CAMERA_ORDER.includes(cameraName)) {
      return { x: anchorX, y: anchorY };
    }

    const quadrantOffsets = {
      front_left: { x: 0.0, y: 0.0 },
      front_right: { x: 0.5, y: 0.0 },
      rear: { x: 0.0, y: 0.5 },
      side: { x: 0.5, y: 0.5 },
    };
    const quadrant = quadrantOffsets[cameraName];
    let localX = quadrant.x + 0.25;
    let localY = quadrant.y + 0.25;

    const bbox = Array.isArray(detection.bbox) ? detection.bbox : null;
    const camera = frame.cameras?.[cameraName];
    if (bbox && camera?.width && camera?.height) {
      const bboxCenterX = clamp((bbox[0] + bbox[2]) * 0.5 / camera.width, 0, 1);
      const bboxCenterY = clamp((bbox[1] + bbox[3]) * 0.5 / camera.height, 0, 1);
      localX = quadrant.x + bboxCenterX * 0.5;
      localY = quadrant.y + bboxCenterY * 0.5;
    }

    anchorX = rect.left + rect.width * localX;
    anchorY = rect.top + rect.height * localY;
    return { x: anchorX, y: anchorY };
  }

  createPestMarker(detection) {
    const button = document.createElement("button");
    button.className = "pest-marker";
    button.type = "button";
    button.dataset.detectionId = detection.id;
    button.dataset.frameId = String(detection.frame_id);

    const iconWrap = document.createElement("span");
    iconWrap.className = "pest-marker-icon-wrap";
    iconWrap.setAttribute("aria-hidden", "true");

    const icon = document.createElement("img");
    icon.className = "pest-marker-icon";
    icon.src = "/assets/hospital.png";
    icon.alt = "";
    icon.decoding = "async";
    icon.loading = "lazy";
    iconWrap.appendChild(icon);

    const label = document.createElement("span");
    label.className = "pest-marker-label";
    label.textContent = getDiseaseInfo(stableHash(detection.id || `${detection.frame_id}`), detection.label).label;

    button.append(iconWrap, label);
    button.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const frame = this.framesById.get(String(detection.frame_id));
      if (!frame) return;
      selectedPestDetectionId = detection.id;
      const segment = this.findPestMarkerSegment(detection);
      selectedSegmentId = segment?.id || null;
      hoveredSegmentId = segment?.id || null;
      renderSegmentDetail(segment || null);
      const anchor = this.getPestMarkerAnchor(frame, detection);
      this.focusWorldPoint(anchor.x, anchor.y, { frameId: frame.id });
      this.onSelect(frame);
      this.queueRender();
    });

    this.markerPane?.appendChild(button);
    return button;
  }

  renderPestMarkers() {
    if (!this.markerPane) return;
    if (!this.isPestMarkerLayerActive()) {
      this.clearPestMarkers();
      return;
    }

    const wanted = new Set();
    const frameOffsets = new Map();
    const compact = this.currentZoom < this.maxZoom - 1.4;
    for (const detection of this.pestDetections.detections) {
      const frame = this.framesById.get(String(detection.frame_id));
      if (!frame) continue;

      const anchor = this.getPestMarkerAnchor(frame, detection);
      const screen = this.worldToScreen(anchor.x, anchor.y);
      if (screen.x < -48 || screen.x > this.viewportWidth + 48) continue;
      if (screen.y < -48 || screen.y > this.viewportHeight + 48) continue;

      wanted.add(detection.id);
      let marker = this.visiblePestMarkers.get(detection.id);
      if (!marker) {
        marker = this.createPestMarker(detection);
        this.visiblePestMarkers.set(detection.id, marker);
      }

      const offsetIndex = frameOffsets.get(frame.id) || 0;
      frameOffsets.set(frame.id, offsetIndex + 1);
      const offsetX = (offsetIndex % 3) * 16 - 16;
      const offsetY = Math.floor(offsetIndex / 3) * 14;
      const selectedClass = selectedPestDetectionId === detection.id ? " is-selected" : "";
      marker.className = `pest-marker severity-${detection.severity}${compact ? " is-compact" : ""}${selectedClass}`;
      marker.style.left = `${screen.x + offsetX}px`;
      marker.style.top = `${screen.y - offsetY}px`;
      marker.setAttribute("aria-label", formatPestMarkerTitle(detection));
    }

    for (const [detectionId, marker] of this.visiblePestMarkers.entries()) {
      if (wanted.has(detectionId)) continue;
      marker.remove();
      this.visiblePestMarkers.delete(detectionId);
    }
  }

  drawMiniMap(bounds = this.getViewBounds()) {
    const canvas = this.miniMapCanvas;
    const ctx = this.miniMapCtx;
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = this.prepareCanvas(canvas, width, height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const tx = this.getMiniMapTransform(width, height);
    if (!tx) return;
    const sx = (x) => tx.ox + x * tx.scaleX;
    const sy = (y) => tx.oy + y * tx.scaleY;
    const mapW = this.manifest.image_width * tx.scaleX;
    const mapH = this.manifest.image_height * tx.scaleY;
    const layout = this.manifest.layout || {};

    ctx.fillStyle = "#171717";
    ctx.fillRect(tx.ox, tx.oy, mapW, mapH);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i += 1) {
      const x = tx.ox + (mapW * i) / 8;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, tx.oy);
      ctx.lineTo(Math.round(x) + 0.5, tx.oy + mapH);
      ctx.stroke();
    }
    const gridRows = Math.max(4, Math.min(12, (this.manifest.rails || []).length));
    for (let i = 1; i < gridRows; i += 1) {
      const y = tx.oy + (mapH * i) / gridRows;
      ctx.beginPath();
      ctx.moveTo(tx.ox, Math.round(y) + 0.5);
      ctx.lineTo(tx.ox + mapW, Math.round(y) + 0.5);
      ctx.stroke();
    }

    for (const rail of this.manifest.rails || []) {
      const railY = (Number(layout.margin_y) || 0) + rail.rail_y_m * layout.px_per_meter_y + layout.cell_height / 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx(this.railTrackWorldBounds.left), sy(railY));
      ctx.lineTo(sx(this.railTrackWorldBounds.right), sy(railY));
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(69, 212, 106, 0.36)";
    for (const frame of this.frames) {
      const r = frame.rect_px;
      ctx.fillRect(
        sx(r.left),
        sy(r.top),
        Math.max(1, (r.right - r.left) * tx.scaleX),
        Math.max(1, (r.bottom - r.top) * tx.scaleY),
      );
    }

    this.drawMiniMapLayerSegments(ctx, tx);

    if (this.selectedFrameId != null) {
      const frame = this.framesById.get(String(this.selectedFrameId));
      if (frame) {
        const r = frame.rect_px;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          sx(r.left),
          sy(r.top),
          Math.max(3, (r.right - r.left) * tx.scaleX),
          Math.max(3, (r.bottom - r.top) * tx.scaleY),
        );
      }
    }

    const viewport = this.getMiniMapViewportRect(width, height, bounds);
    if (viewport) {
      ctx.fillStyle = "rgba(69, 212, 106, 0.08)";
      ctx.fillRect(viewport.left, viewport.top, viewport.width, viewport.height);
      ctx.strokeStyle = "rgba(69, 212, 106, 0.98)";
      ctx.lineWidth = 2;
      ctx.strokeRect(viewport.left, viewport.top, viewport.width, viewport.height);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
      ctx.lineWidth = 1;
      ctx.strokeRect(viewport.left + 3, viewport.top + 3, Math.max(1, viewport.width - 6), Math.max(1, viewport.height - 6));
    }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tx.ox + 0.5, tx.oy + 0.5, mapW - 1, mapH - 1);
  }

  renderDetailFrames(bounds) {
    const fade = clamp((this.currentZoom - this.detailFadeStartZoom) / this.detailFadeSpan, 0, 1);
    this.detailPane.style.opacity = fade.toFixed(3);
    if (fade <= 0) {
      for (const detail of this.visibleDetails.values()) detail.remove();
      this.visibleDetails.clear();
      return;
    }
    const padding = 96 / this.baseScale;
    const wanted = new Set();
    const candidates = [];
    for (const frame of this.frames) {
      const rect = frame.rect_px;
      if (rect.right < bounds.left - padding || rect.left > bounds.right + padding) continue;
      if (rect.bottom < bounds.top - padding || rect.top > bounds.bottom + padding) continue;
      const dx = (rect.center_x - this.centerX) * this.scaleX;
      const dy = (rect.center_y - this.centerY) * this.scaleY;
      const distance = Number(frame.id) === Number(this.selectedFrameId) ? -1 : dx * dx + dy * dy;
      candidates.push({ frame, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance);

    for (const [index, item] of candidates.entries()) {
      const frame = item.frame;
      const rect = frame.rect_px;
      const topLeft = this.worldToScreen(rect.left, rect.top);
      const bottomRight = this.worldToScreen(rect.right, rect.bottom);
      const screenW = Math.max(1, bottomRight.x - topLeft.x);
      wanted.add(frame.id);
      let detail = this.visibleDetails.get(frame.id);
      const fetchPriority = index < 6 ? "high" : "auto";
      if (!detail) {
        detail = this.createDetailFrame(frame, { fetchPriority, displayWidth: screenW });
        this.visibleDetails.set(frame.id, detail);
      } else {
        this.updateDetailFrameImageHints(detail, fetchPriority, screenW);
      }
      this.updateDetailFrameDetectionOverlays(detail, frame);
      detail.style.left = `${topLeft.x}px`;
      detail.style.top = `${topLeft.y}px`;
      detail.style.width = `${bottomRight.x - topLeft.x}px`;
      detail.style.height = `${bottomRight.y - topLeft.y}px`;
    }
    for (const [frameId, detail] of this.visibleDetails.entries()) {
      if (wanted.has(frameId)) continue;
      detail.remove();
      this.visibleDetails.delete(frameId);
    }
  }

  render() {
    this.updateViewTransform();
    const tileZoom = this.tileZoom;
    const tileScale = this.tileScale;
    const tileWorldWidth = this.tileWorldWidth;
    const tileWorldHeight = this.tileWorldHeight;
    const zoomDims = this.zoomDims;
    const bounds = this.getViewBounds();
    const dpr = window.devicePixelRatio || 1;
    const snap = (value) => Math.round(value * dpr) / dpr;
    const tx0 = clamp(Math.floor(bounds.left / tileWorldWidth), 0, zoomDims.tiles_x - 1);
    const ty0 = clamp(Math.floor(bounds.top / tileWorldHeight), 0, zoomDims.tiles_y - 1);
    const tx1 = clamp(Math.floor(bounds.right / tileWorldWidth), 0, zoomDims.tiles_x - 1);
    const ty1 = clamp(Math.floor(bounds.bottom / tileWorldHeight), 0, zoomDims.tiles_y - 1);
    const wanted = new Set();

    for (let ty = ty0; ty <= ty1; ty += 1) {
      for (let tx = tx0; tx <= tx1; tx += 1) {
        const key = `${tileZoom}/${tx}/${ty}`;
        wanted.add(key);
        let tile = this.visibleTiles.get(key);
        if (!tile) {
          tile = document.createElement("div");
          tile.className = "map-tile";
          const src = this.manifest.tile_url_template
            .replace("{z}", String(tileZoom))
            .replace("{x}", String(tx))
            .replace("{y}", String(ty));
          tile.style.backgroundImage = `url("${src}")`;
          this.visibleTiles.set(key, tile);
          this.tilePane.appendChild(tile);
        }
        const worldLeft = tx * tileWorldWidth;
        const worldTop = ty * tileWorldHeight;
        const validTileWidth = Math.min(this.manifest.tile_size, this.zoomImageWidth - tx * this.manifest.tile_size);
        const validTileHeight = Math.min(this.manifest.tile_size, this.zoomImageHeight - ty * this.manifest.tile_size);
        const imageWorldRight = worldLeft + validTileWidth / this.integerScaleX;
        const imageWorldBottom = worldTop + validTileHeight / this.integerScaleY;
        const fullWorldRight = worldLeft + tileWorldWidth;
        const fullWorldBottom = worldTop + tileWorldHeight;
        const topLeft = this.worldToScreen(worldLeft, worldTop);
        const bottomRight = this.worldToScreen(imageWorldRight, imageWorldBottom);
        const fullBottomRight = this.worldToScreen(fullWorldRight, fullWorldBottom);
        const left = snap(topLeft.x);
        const top = snap(topLeft.y);
        const right = snap(bottomRight.x);
        const bottom = snap(bottomRight.y);
        const fullRight = snap(fullBottomRight.x);
        const fullBottom = snap(fullBottomRight.y);
        tile.style.transform = "";
        tile.style.left = `${left}px`;
        tile.style.top = `${top}px`;
        tile.style.width = `${Math.max(0, right - left)}px`;
        tile.style.height = `${Math.max(0, bottom - top)}px`;
        tile.style.backgroundPosition = "0px 0px";
        tile.style.backgroundSize = `${Math.max(0, fullRight - left)}px ${Math.max(0, fullBottom - top)}px`;
      }
    }

    for (const [key, tile] of this.visibleTiles.entries()) {
      if (wanted.has(key)) continue;
      tile.remove();
      this.visibleTiles.delete(key);
    }

    this.renderDetailFrames(bounds);
    this.renderAnnotations(bounds);
    this.renderPestMarkers();
    this.drawOverlay();
    this.drawMiniMap(bounds);
    this.updateVerticalScrollBar();
    this.updateHorizontalScrollBar();
    this.onViewChange({
      zoom: this.currentZoom,
      screenPxPerMeter: this.scaleX * this.manifest.layout.px_per_meter_x,
      centerX: this.centerX,
      centerY: this.centerY,
    });

    if (this.prefetchTimer) clearTimeout(this.prefetchTimer);
    this.prefetchTimer = setTimeout(() => this.prefetchTiles(), 150);
  }

  prefetchTiles() {
    const PAD = 3;
    this.updateViewTransform();
    const tileZoom = this.tileZoom;
    const tileWorldWidth = this.tileWorldWidth;
    const tileWorldHeight = this.tileWorldHeight;
    const zoomDims = this.zoomDims;
    const bounds = this.getViewBounds();
    const tx0 = clamp(Math.floor(bounds.left / tileWorldWidth) - PAD, 0, zoomDims.tiles_x - 1);
    const ty0 = clamp(Math.floor(bounds.top / tileWorldHeight) - PAD, 0, zoomDims.tiles_y - 1);
    const tx1 = clamp(Math.floor(bounds.right / tileWorldWidth) + PAD, 0, zoomDims.tiles_x - 1);
    const ty1 = clamp(Math.floor(bounds.bottom / tileWorldHeight) + PAD, 0, zoomDims.tiles_y - 1);

    const urls = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const key = `${tileZoom}/${tx}/${ty}`;
        if (this.visibleTiles.has(key) || this.prefetchedUrls.has(key)) continue;
        this.prefetchedUrls.add(key);
        urls.push(this.manifest.tile_url_template
          .replace("{z}", String(tileZoom))
          .replace("{x}", String(tx))
          .replace("{y}", String(ty)));
      }
    }

    for (const url of urls) {
      fetch(url, { priority: "low" }).catch(() => {});
    }
  }

  // ─── Risk overlay drawing ─────────────────────────────────────────────────

  _getRailInsight(railName) {
    if (!currentInsights || !currentInsights.available) return null;
    return currentInsights.rails?.[railName] || null;
  }

  _getFrameInsight(frameId) {
    if (!currentInsights || !currentInsights.available) return null;
    return currentInsights.frames?.[String(frameId)] || null;
  }

  drawRailTrackStroke(ctx, { x0, x1, centerY, railH, width }) {
    if (x1 < -40 || x0 > width + 40 || x1 - x0 < 32 || railH < 4) return;

    const strokeWidth = clamp(Math.round(railH * 0.13), 2, 12);
    const topY = centerY - railH / 2 + strokeWidth / 2;
    const bottomY = centerY + railH / 2 - strokeWidth / 2;
    const radius = Math.max(2, (bottomY - topY) / 2);
    const turnRightX = x0 + radius;
    const lineStartX = Math.max(turnRightX - strokeWidth * 0.5, -200);
    const lineEndX = Math.min(x1, width + 200);
    const arcVisible = x0 < width + 200 && x0 + radius * 2 > -200;

    ctx.save();
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";

    const guideWidth = Math.max(1, Math.round(strokeWidth * 0.25));
    const guideY = Math.round(centerY - guideWidth / 2);
    ctx.fillStyle = "rgba(198, 208, 204, 0.42)";
    ctx.fillRect(0, guideY, width, guideWidth);

    const drawPath = (offsetX, offsetY) => {
      ctx.beginPath();
      if (arcVisible) {
        ctx.arc(x0 + radius + offsetX, centerY + offsetY, radius, Math.PI * 0.5, Math.PI * 1.5);
      }
      if (lineEndX > lineStartX) {
        ctx.moveTo(lineStartX + offsetX, topY + offsetY);
        ctx.lineTo(lineEndX + offsetX, topY + offsetY);
        ctx.moveTo(lineStartX + offsetX, bottomY + offsetY);
        ctx.lineTo(lineEndX + offsetX, bottomY + offsetY);
      }
      ctx.stroke();
    };

    const shadowOffset = Math.max(1, strokeWidth * 0.18);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.62)";
    ctx.lineWidth = strokeWidth;
    drawPath(shadowOffset, shadowOffset);

    ctx.strokeStyle = "rgba(198, 208, 204, 0.96)";
    ctx.lineWidth = strokeWidth;
    drawPath(0, 0);
    ctx.restore();
  }

  drawRailTrackConnector(ctx, { x0, tracks, width, height }) {
    if (!tracks.length) return;
    const sortedTracks = [...tracks].sort((a, b) => a.centerY - b.centerY);
    if (sortedTracks.length < 2) return;
    const visibleTracks = sortedTracks.filter((track) => track.centerY > -120 && track.centerY < height + 120);
    if (!visibleTracks.length) return;

    const avgRailH = visibleTracks.reduce((sum, track) => sum + track.railH, 0) / visibleTracks.length;
    const trackGaps = [];
    for (let index = 1; index < sortedTracks.length; index += 1) {
      const gap = Math.abs(sortedTracks[index].centerY - sortedTracks[index - 1].centerY);
      if (gap > 0.5) trackGaps.push(gap);
    }
    trackGaps.sort((a, b) => a - b);
    const trackGap = trackGaps.length ? trackGaps[Math.floor(trackGaps.length / 2)] : avgRailH * 4;
    const baseConnectorOffset = Math.max(4, Math.round(trackGap * 0.13));
    const laneGap = Math.max(2, Math.round(baseConnectorOffset * 3.2));
    const railClearance = Math.max(4, Math.round(trackGap * 0.04));
    const connectorOffset = Math.max(baseConnectorOffset, laneGap + railClearance);
    const railJoinGap = Math.max(1, Math.round(connectorOffset * 0.08));
    const solidWidth = clamp(Math.round(avgRailH * 0.055), 2, 5);
    const dashWidth = Math.max(1, solidWidth - 1);
    const snapLine = (value, widthPx) => Math.round(value) + (Math.round(widthPx) % 2 ? 0.5 : 0);
    const solidX = snapLine(x0 - connectorOffset, solidWidth);
    const dashedX = snapLine(solidX + laneGap, dashWidth);
    const branchEndX = snapLine(x0 - railJoinGap, solidWidth);
    const branchStartX = Math.min(solidX, dashedX);
    if (branchStartX > width + 80 || branchEndX < -80) return;

    const topY = snapLine(sortedTracks[0].centerY, solidWidth);
    const bottomY = snapLine(sortedTracks[sortedTracks.length - 1].centerY, solidWidth);
    const railColor = "rgba(198, 208, 204, 0.82)";
    const shadowColor = "rgba(0, 0, 0, 0.64)";

    ctx.save();
    ctx.setLineDash([]);

    const px = (value) => Math.round(value);
    const rectV = ({ x, y0, y1, widthPx, color, offsetX = 0, offsetY = 0 }) => {
      const w = Math.max(1, px(widthPx));
      const left = px(x + offsetX - w / 2);
      const top = px(Math.min(y0, y1) + offsetY);
      const h = Math.max(1, px(Math.abs(y1 - y0)));
      ctx.fillStyle = color;
      ctx.fillRect(left, top, w, h);
    };
    const rectH = ({ x0, x1, y, widthPx, color, offsetX = 0, offsetY = 0 }) => {
      const w = Math.max(1, px(widthPx));
      const left = px(Math.min(x0, x1) + offsetX);
      const top = px(y + offsetY - w / 2);
      const len = Math.max(1, px(Math.abs(x1 - x0)));
      ctx.fillStyle = color;
      ctx.fillRect(left, top, len, w);
    };
    const dashedV = ({ x, y0, y1, widthPx, color, offsetX = 0, offsetY = 0 }) => {
      const w = Math.max(1, px(widthPx));
      const dash = Math.max(4, w * 2);
      const gap = Math.max(5, w * 3);
      const start = px(Math.min(y0, y1));
      const end = px(Math.max(y0, y1));
      ctx.fillStyle = color;
      for (let y = start; y <= end; y += dash + gap) {
        const h = Math.min(dash, end - y + 1);
        ctx.fillRect(px(x + offsetX - w / 2), px(y + offsetY), w, Math.max(1, h));
      }
    };
    const dashedH = ({ x0, x1, y, widthPx, color, offsetX = 0, offsetY = 0 }) => {
      const w = Math.max(1, px(widthPx));
      const dash = Math.max(4, w * 2);
      const gap = Math.max(5, w * 3);
      const start = px(Math.min(x0, x1));
      const end = px(Math.max(x0, x1));
      ctx.fillStyle = color;
      for (let x = start; x <= end; x += dash + gap) {
        const len = Math.min(dash, end - x + 1);
        ctx.fillRect(px(x + offsetX), px(y + offsetY - w / 2), Math.max(1, len), w);
      }
    };

    const shadowOffset = Math.max(1, px(solidWidth * 0.35));
    rectV({ x: solidX, y0: topY, y1: bottomY, widthPx: solidWidth + 1, color: shadowColor, offsetX: shadowOffset, offsetY: shadowOffset });
    rectV({ x: solidX, y0: topY, y1: bottomY, widthPx: solidWidth, color: railColor });
    dashedV({ x: dashedX, y0: topY, y1: bottomY, widthPx: dashWidth + 1, color: shadowColor, offsetX: shadowOffset, offsetY: shadowOffset });
    dashedV({ x: dashedX, y0: topY, y1: bottomY, widthPx: dashWidth, color: "rgba(198, 208, 204, 0.62)" });

    for (const track of visibleTracks) {
      const centerSolidY = snapLine(track.centerY, solidWidth);
      const centerDashedY = snapLine(track.centerY, dashWidth);

      rectH({ x0: solidX, x1: branchEndX, y: centerSolidY, widthPx: solidWidth + 1, color: shadowColor, offsetX: shadowOffset, offsetY: shadowOffset });
      rectH({ x0: solidX, x1: branchEndX, y: centerSolidY, widthPx: solidWidth, color: railColor });
      dashedH({ x0: dashedX, x1: branchEndX, y: centerDashedY, widthPx: dashWidth + 1, color: shadowColor, offsetX: shadowOffset, offsetY: shadowOffset });
      dashedH({ x0: dashedX, x1: branchEndX, y: centerDashedY, widthPx: dashWidth, color: "rgba(198, 208, 204, 0.66)" });

      ctx.fillStyle = "rgba(198, 208, 204, 0.9)";
      const nodeR = clamp(Math.round(solidWidth * 1.2), 2, 4);
      ctx.beginPath();
      ctx.roundRect(solidX - nodeR, centerSolidY - nodeR, nodeR * 2, nodeR * 2, 1.5);
      ctx.fill();
    }

    ctx.restore();
  }

  drawRailTrackOverlay(ctx, width, height) {
    const layout = this.manifest.layout;
    const rails = this.manifest.rails;
    if (!layout || !Array.isArray(rails) || rails.length < 2) return;

    const orderedRails = [...rails].sort((a, b) => {
      const colA = Number(a.column) || 0;
      const colB = Number(b.column) || 0;
      if (colA !== colB) return colA - colB;
      return (Number(a.rail_y_m) || 0) - (Number(b.rail_y_m) || 0);
    });

    const leftScreen = this.worldToScreen(this.railTrackWorldBounds.left, this.centerY).x;
    const rightScreen = this.worldToScreen(this.railTrackWorldBounds.right, this.centerY).x;
    const minRailH = Number(layout.rail_track_min_tile_height) || 20;
    const maxRailWorldH = Number(layout.rail_track_max_height) || 84;
    const marginWorldH = Number(layout.rail_track_margin_y) || 30;
    const trackDraws = [];

    for (let index = 0; index < orderedRails.length - 1; index += 1) {
      const before = orderedRails[index];
      const after = orderedRails[index + 1];
      const beforeTopWorld = layout.margin_y + before.rail_y_m * layout.px_per_meter_y;
      const afterTopWorld = layout.margin_y + after.rail_y_m * layout.px_per_meter_y;
      const gapTopWorld = beforeTopWorld + layout.cell_height;
      const gapBottomWorld = afterTopWorld;
      if (gapBottomWorld <= gapTopWorld) continue;

      const screenGapTop = this.worldToScreen(this.centerX, gapTopWorld).y;
      const screenGapBottom = this.worldToScreen(this.centerX, gapBottomWorld).y;
      const top = Math.min(screenGapTop, screenGapBottom);
      const bottom = Math.max(screenGapTop, screenGapBottom);
      if (bottom < -80 || top > height + 80) continue;

      const gapH = bottom - top;
      if (gapH < 6) continue;

      const marginH = clamp(marginWorldH * this.scaleY, gapH < 30 ? 1 : 4, Math.max(1, (gapH - 4) / 2));
      const availableH = gapH - marginH * 2;
      if (availableH < 4) continue;

      const scaledMaxH = Math.max(4, maxRailWorldH * this.scaleY);
      const railH = Math.max(Math.min(availableH, minRailH), Math.min(availableH, scaledMaxH));
      trackDraws.push({
        x0: leftScreen,
        x1: rightScreen,
        centerY: (top + bottom) / 2,
        railH,
        width,
      });
    }

    this.drawRailTrackConnector(ctx, {
      x0: leftScreen,
      tracks: trackDraws,
      width,
      height,
    });
    for (const trackDraw of trackDraws) {
      this.drawRailTrackStroke(ctx, trackDraw);
    }
  }

  drawOverlay() {
    const width = this.viewportWidth;
    const height = this.viewportHeight;
    const dpr = this.prepareCanvas(this.overlayCanvas, width, height);
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const scale = this.baseScale;
    const rails = this.manifest.rails;

    this.drawRailTrackOverlay(ctx, width, height);

    // ── Rail separators + risk highlight ──────────────────────────────────────
    for (const rail of rails) {
      const ri = this._getRailInsight(rail.name);
      const y = this.manifest.layout.margin_y + rail.rail_y_m * this.manifest.layout.px_per_meter_y + this.manifest.layout.cell_height / 2;
      const screen = this.worldToScreen(this.centerX, y);
      if (screen.y < -80 || screen.y > height + 80) continue;

      if (showRiskOverlay && ri) {
        const priority = ri.priority_score || 0;
        if (priority >= 40) {
          ctx.fillStyle = `rgba(220, 60, 40, ${Math.min(0.18, priority / 300)})`;
          const railScreenTop = this.worldToScreen(
            0,
            this.manifest.layout.margin_y + rail.rail_y_m * this.manifest.layout.px_per_meter_y,
          ).y;
          const railScreenBottom = this.worldToScreen(
            0,
            this.manifest.layout.margin_y + rail.rail_y_m * this.manifest.layout.px_per_meter_y + this.manifest.layout.cell_height,
          ).y;
          ctx.fillRect(0, railScreenTop, width, railScreenBottom - railScreenTop);
        } else if (priority >= 20) {
          ctx.fillStyle = `rgba(220, 140, 40, ${Math.min(0.12, priority / 300)})`;
          const railScreenTop = this.worldToScreen(
            0,
            this.manifest.layout.margin_y + rail.rail_y_m * this.manifest.layout.px_per_meter_y,
          ).y;
          const railScreenBottom = this.worldToScreen(
            0,
            this.manifest.layout.margin_y + rail.rail_y_m * this.manifest.layout.px_per_meter_y + this.manifest.layout.cell_height,
          ).y;
          ctx.fillRect(0, railScreenTop, width, railScreenBottom - railScreenTop);
        }
      }

      ctx.strokeStyle = "rgba(20, 63, 49, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, screen.y);
      ctx.lineTo(width, screen.y);
      ctx.stroke();
      // Rail name pill — always visible regardless of zoom
      const railLabel = rail.name.replace("rail_", "R");
      ctx.font = 'bold 11px "DM Mono", "Noto Sans KR", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const rlW = ctx.measureText(railLabel).width + 12;
      const rlH = 17;
      const rlY = clamp(screen.y, rlH / 2 + 4, height - rlH / 2 - 4);
      ctx.fillStyle = "rgba(11, 15, 13, 0.88)";
      ctx.beginPath();
      ctx.roundRect(6, rlY - rlH / 2, rlW, rlH, 4);
      ctx.fill();
      ctx.fillStyle = "#45d46a";
      ctx.fillText(railLabel, 6 + rlW / 2, rlY);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // ── Frame-level alert dots ────────────────────────────────────────────────
    if (showRiskOverlay && currentInsights?.available) {
      for (const frame of this.frames) {
        const fi = this._getFrameInsight(frame.id);
        if (!fi || fi.flags.length === 0) continue;
        const rect = frame.rect_px;
        const topLeft = this.worldToScreen(rect.left, rect.top);
        const screenW = rect.width * this.scaleX;
        const screenH = rect.height * this.scaleY;
        // Only draw if visible
        if (topLeft.x + screenW < 0 || topLeft.x > width) continue;
        if (topLeft.y + screenH < 0 || topLeft.y > height) continue;

        const hasMissing = fi.flags.includes("missing_camera");
        const hasGap = fi.flags.includes("data_gap");
        const dotColor = hasMissing ? "rgba(220,60,40,0.85)" : "rgba(220,140,40,0.85)";
        const dotSize = Math.max(3, Math.min(6, screenW * 0.12));
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(topLeft.x + screenW / 2, topLeft.y + dotSize + 2, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Meter ruler ───────────────────────────────────────────────────────────
    const screenPxPerMeter = this.scaleX * this.manifest.layout.px_per_meter_x;
    const tickStep = chooseTickStep(screenPxPerMeter);
    const firstMeter = Math.floor(this.manifest.world.odom_x_min / tickStep) * tickStep;
    const lastMeter = this.manifest.world.odom_x_max + tickStep;
    ctx.strokeStyle = "rgba(39, 48, 41, 0.4)";
    ctx.lineWidth = 1;
    ctx.font = 'bold 11px "DM Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let meter = firstMeter; meter <= lastMeter; meter += tickStep) {
      const worldX = this.manifest.layout.margin_x + (meter - this.manifest.world.odom_x_min) * this.manifest.layout.px_per_meter_x;
      const screen = this.worldToScreen(worldX, this.centerY);
      if (screen.x < -40 || screen.x > width + 40) continue;
      ctx.beginPath();
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x, height);
      ctx.stroke();
      const mLabel = `${meter.toFixed(1)}m`;
      const mW = ctx.measureText(mLabel).width + 10;
      const mH = 16;
      const mX = clamp(screen.x, mW / 2 + 4, width - mW / 2 - 4);
      ctx.fillStyle = "rgba(11, 15, 13, 0.85)";
      ctx.beginPath();
      ctx.roundRect(mX - mW / 2, 6, mW, mH, 3);
      ctx.fill();
      ctx.fillStyle = "#7d9889";
      ctx.fillText(mLabel, mX, 6 + mH / 2);
    }
    ctx.textBaseline = "alphabetic";

    // ── Layer segment overlay ─────────────────────────────────────────────────
    if (showLayerOverlay) {
      this.drawLayerSegments(ctx, width, height);
    }

    // ── Selection highlight ───────────────────────────────────────────────────
    if (this.selectedFrameId != null) {
      const frame = this.frames.find((item) => item.id === this.selectedFrameId);
      if (frame) {
        const rect = frame.rect_px;
        const topLeft = this.worldToScreen(rect.left, rect.top);
        const screenW = rect.width * this.scaleX;
        const screenH = rect.height * this.scaleY;
        ctx.strokeStyle = "#ff5b2e";
        ctx.lineWidth = 3;
        ctx.strokeRect(topLeft.x, topLeft.y, screenW, screenH);
        ctx.fillStyle = "#ff5b2e";
        ctx.beginPath();
        ctx.arc(topLeft.x + screenW / 2, topLeft.y + screenH / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawLayerSegments(ctx, width, height) {
    const layer = getActiveLayer();
    if (!layer) return;
    const colorFn = getLayerColorFn(layer);
    const layout = this.manifest.layout;
    const world = this.manifest.world;
    const rails = this.manifest.rails;

    // Build a quick lookup: rail_name → rail_y_m + rail.column
    const railMap = {};
    for (const r of rails) railMap[r.name] = r;

    for (const item of layer.items) {
      const rail = railMap[item.rail_name];
      if (!rail) continue;

      // World-space top/bottom of this rail row
      const railTop = layout.margin_y + rail.rail_y_m * layout.px_per_meter_y;
      const railBottom = railTop + layout.cell_height;

      // World-space left/right for this meter segment
      const segLeft = layout.margin_x + (item.start_m - world.odom_x_min) * layout.px_per_meter_x;
      const segRight = layout.margin_x + (item.end_m - world.odom_x_min) * layout.px_per_meter_x;

      const tl = this.worldToScreen(segLeft, railTop);
      const br = this.worldToScreen(segRight, railBottom);

      if (br.x < 0 || tl.x > width || br.y < 0 || tl.y > height) continue;

      const sw = br.x - tl.x;
      const sh = br.y - tl.y;
      if (sw < 1 || sh < 1) continue;

      const stageInfo = layer.color_scheme === "crop_stage"
        ? getHarvestStageInfo(item.value)
        : null;
      const opacityMod = layer.color_scheme === "crop_stage"
        ? 1.0
        : (item.confidence < 0.6 ? 0.55 : 1.0);

      ctx.save();
      ctx.globalAlpha = opacityMod;

      // Fill
      ctx.fillStyle = colorFn(item.value);
      ctx.fillRect(tl.x, tl.y, sw, sh);

      if (stageInfo && sw >= 3 && sh >= 3) {
        ctx.strokeStyle = hexToRgba(stageInfo.color, stageInfo.strokeAlpha);
        ctx.lineWidth = Math.max(0.8, Math.min(1.2, Math.min(sw, sh) * 0.08));
        ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, Math.max(0, sw - 1), Math.max(0, sh - 1));
      }

      // Selected / hovered border
      const isSelected = selectedSegmentId === item.id;
      const isHovered = hoveredSegmentId === item.id;
      if (isSelected) {
        ctx.strokeStyle = "#ff5b2e";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(tl.x + 1, tl.y + 1, sw - 2, sh - 2);
      } else if (isHovered) {
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, sw - 1, sh - 1);
      }

      // Severity dot for high/medium segments when zoomed out
      if (item.severity !== "low" && sw >= 8 && sh >= 8) {
        const dotR = Math.min(5, Math.max(3, sw * 0.08));
        ctx.fillStyle = item.severity === "high" ? "rgba(210,40,30,0.9)" : "rgba(200,110,20,0.85)";
        ctx.beginPath();
        ctx.arc(tl.x + sw / 2, tl.y + dotR + 2, dotR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  drawMiniMapLayerSegments(ctx, tx) {
    const layers = getActiveMiniMapLayers();
    if (!layers.length) return;

    const pestRiskLayers = layers.filter((layer) => layer.id === "disease_pest_risk");
    const segmentLayers = layers.filter((layer) => layer.id !== "disease_pest_risk");
    const layout = this.manifest.layout || {};
    const world = this.manifest.world || {};
    const railMap = new Map((this.manifest.rails || []).map((rail) => [rail.name, rail]));
    const marginX = Number(layout.margin_x) || 0;
    const marginY = Number(layout.margin_y) || 0;
    const pxPerMeterX = Number(layout.px_per_meter_x) || 0;
    const pxPerMeterY = Number(layout.px_per_meter_y) || 0;
    const cellHeight = Number(layout.cell_height) || 0;
    const odomMin = Number(world.odom_x_min) || 0;
    if (!pxPerMeterX || !pxPerMeterY || !cellHeight) return;

    const sx = (x) => tx.ox + x * tx.scaleX;
    const sy = (y) => tx.oy + y * tx.scaleY;
    const laneCount = Math.max(1, segmentLayers.length);

    segmentLayers.forEach((layer, layerIndex) => {
      const colorFn = getLayerColorFn(layer);
      for (const item of layer.items || []) {
        const rail = railMap.get(item.rail_name);
        if (!rail) continue;
        const start = Number(item.start_m);
        const end = Number(item.end_m);
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

        const railTop = marginY + (Number(rail.rail_y_m) || 0) * pxPerMeterY;
        const laneTop = railTop + (cellHeight * layerIndex) / laneCount;
        const laneBottom = railTop + (cellHeight * (layerIndex + 1)) / laneCount;
        const segLeft = marginX + (Math.min(start, end) - odomMin) * pxPerMeterX;
        const segRight = marginX + (Math.max(start, end) - odomMin) * pxPerMeterX;
        const x = sx(segLeft);
        const y = sy(laneTop);
        const w = Math.max(1, (segRight - segLeft) * tx.scaleX);
        const h = Math.max(1, (laneBottom - laneTop) * tx.scaleY);

        ctx.fillStyle = colorFn(Number(item.value) || 0);
        ctx.fillRect(x, y, w, h);
      }
    });

    for (const layer of pestRiskLayers) {
      this.drawMiniMapPestRiskPhotos(ctx, tx, layer);
    }
  }

  drawMiniMapPestRiskPhotos(ctx, tx, layer) {
    const markers = new Map();
    for (const detection of this.pestDetections.detections || []) {
      const frame = this.framesById.get(String(detection.frame_id));
      if (!frame) continue;
      markers.set(String(frame.id), {
        frame,
        severity: detection.severity,
        value: detection.severity === "high" ? 85 : detection.severity === "medium" ? 60 : 30,
      });
    }

    if (!markers.size) {
      for (const item of layer.items || []) {
        for (const frameId of pickMiniMapRiskFrameIds(item)) {
          const frame = this.framesById.get(String(frameId));
          if (!frame) continue;
          markers.set(String(frame.id), {
            frame,
            severity: item.severity,
            value: Number(item.value) || 0,
          });
        }
      }
    }

    for (const marker of markers.values()) {
      const r = marker.frame.rect_px;
      const x = tx.ox + r.left * tx.scaleX;
      const y = tx.oy + r.top * tx.scaleY;
      const w = Math.max(2, (r.right - r.left) * tx.scaleX);
      const h = Math.max(2, (r.bottom - r.top) * tx.scaleY);
      ctx.fillStyle = miniMapRiskColor(marker.severity, marker.value);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.max(1, Math.round(w) - 1), Math.max(1, Math.round(h) - 1));
    }
  }

  pickSegment(worldX, worldY) {
    const layer = getActiveLayer();
    if (!layer || !showLayerOverlay) return null;
    const layout = this.manifest.layout;
    const world = this.manifest.world;
    const rails = this.manifest.rails;
    const railMap = {};
    for (const r of rails) railMap[r.name] = r;

    for (const item of layer.items) {
      const rail = railMap[item.rail_name];
      if (!rail) continue;
      const railTop = layout.margin_y + rail.rail_y_m * layout.px_per_meter_y;
      const railBottom = railTop + layout.cell_height;
      const segLeft = layout.margin_x + (item.start_m - world.odom_x_min) * layout.px_per_meter_x;
      const segRight = layout.margin_x + (item.end_m - world.odom_x_min) * layout.px_per_meter_x;
      if (worldX >= segLeft && worldX <= segRight && worldY >= railTop && worldY <= railBottom) {
        return item;
      }
    }
    return null;
  }
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
  return response.json();
}

// ─── 통합 KPI 패널 렌더링 ────────────────────────────────────────────────────

function renderKpiPanel(insights, layers, tasks) {
  const panel = document.getElementById("kpiPanel");
  const grid  = document.getElementById("kpiGrid");
  const badge = document.getElementById("kpiBadge");
  if (!panel || !grid || !badge) return;

  if (!layers && !insights?.available && !tasks) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  // ── 데이터 추출 ────────────────────────────────────────────────────────────
  const s = insights?.available ? insights.session : null;

  const apLayer = layers?.layers?.find((l) => l.id === "action_priority");
  const dpLayer = layers?.layers?.find((l) => l.id === "disease_pest_risk");
  const drLayer = layers?.layers?.find((l) => l.id === "data_reliability");

  const highActionCount  = apLayer?.items.filter((i) => i.severity === "high").length  ?? 0;
  const highDiseaseCount = dpLayer?.items.filter((i) => i.severity === "high").length  ?? 0;
  const dataIssueCount   = drLayer?.items.filter((i) => i.severity !== "low").length   ?? 0;
  const openTasks        = tasks?.tasks?.filter((t) => getTaskEffectiveStatus(t) !== "done").length ?? null;

  // Health: insights 우선, 없으면 layer 기반 추정
  const healthScore = s ? s.health_score : (layers ? (() => {
    const apAvg = apLayer?.items.length
      ? apLayer.items.reduce((a, b) => a + b.value, 0) / apLayer.items.length : 50;
    return Math.round(100 - apAvg * 0.6);
  })() : null);

  const healthCls = healthScore == null ? "" :
    healthScore >= 85 ? "stat-good" : healthScore >= 60 ? "stat-warn" : "stat-bad";

  // ── KPI 카드 정의 ──────────────────────────────────────────────────────────
  const kpiDefs = [
    {
      value:   healthScore != null ? String(healthScore) : "-",
      label:   "종합 Health",
      cls:     healthCls,
      demo:    !s,
      layerId: null,
    },
    {
      value:   String(highActionCount),
      label:   "즉시 조치 필요",
      cls:     highActionCount > 0 ? "stat-bad" : "stat-good",
      demo:    true,
      layerId: "action_priority",
    },
    {
      value:   String(highDiseaseCount),
      label:   "병충해 고위험",
      cls:     highDiseaseCount > 0 ? "stat-bad" : "stat-good",
      demo:    true,
      layerId: "disease_pest_risk",
    },
    {
      value:   openTasks != null ? String(openTasks) : "-",
      label:   "미완료 작업",
      cls:     openTasks > 0 ? "stat-warn" : (openTasks === 0 ? "stat-good" : ""),
      demo:    true,
      layerId: null,
    },
  ];

  grid.innerHTML = "";
  for (const def of kpiDefs) {
    const stat = document.createElement("div");
    stat.className = `kpi-stat ${def.cls}`;

    const val = createElement("span", "kpi-stat-value", def.value);
    const lbl = createElement("span", "kpi-stat-label", def.label);
    stat.append(val, lbl);

    if (def.demo) {
      stat.appendChild(createElement("span", "kpi-demo-dot", "DEMO"));
    }

    if (def.layerId && currentLayersData) {
      stat.style.cursor = "pointer";
      stat.title = "클릭: 해당 레이어 보기";
      stat.addEventListener("click", () => {
        activeLayerId = def.layerId;
        showLayerOverlay = true;
        updateLayerRowStates();
        renderLayerLegend(getActiveLayer());
        renderLayerSummary(getActiveLayer());
        currentMap?.queueRender();
        document.getElementById("layersPanel").hidden = false;
      });
    }
    grid.appendChild(stat);
  }

  // ── 직전 세션 대비 delta ───────────────────────────────────────────────────
  const deltaRow = document.getElementById("deltaRow");
  const delta = s?.delta;
  if (delta?.compared_session) {
    deltaRow.hidden = false;
    const dH = delta.health_score;
    document.getElementById("deltaHealth").textContent = dH >= 0 ? `+${dH}점` : `${dH}점`;
    document.getElementById("deltaHealth").className = `delta-value ${dH >= 0 ? "delta-pos" : "delta-neg"}`;
    document.getElementById("deltaCompared").textContent = delta.compared_session;
  } else {
    deltaRow.hidden = true;
  }

  // ── 소스 배지 ──────────────────────────────────────────────────────────────
  const src = s?.source || "demo";
  badge.textContent = src;
  badge.className = `source-badge ${src === "heuristic" ? "source-heuristic" : "source-external"}`;
}

// ─── Alert panel rendering ────────────────────────────────────────────────────

function renderAlertPanel(insights, map) {
  const panel = document.getElementById("alertsPanel");
  const list = document.getElementById("alertList");
  const pill = document.getElementById("alertCountPill");

  if (!insights || !insights.available || !insights.alerts?.length) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  pill.textContent = String(insights.alerts.length);
  list.innerHTML = "";

  for (const alert of insights.alerts) {
    const item = document.createElement("button");
    item.className = `alert-item alert-${alert.severity}`;
    item.type = "button";

    const icon = createElement("span", "alert-icon", alert.severity === "warning" ? "⚠" : alert.severity === "error" ? "✕" : "ℹ");
    const body = document.createElement("div");
    body.className = "alert-body";
    const title = createElement("strong", "alert-title", alert.title);
    const msg = createElement("span", "alert-msg", alert.message);
    body.append(title, msg);

    const sourceBadge = createElement("span", `source-badge source-${alert.source === "heuristic" ? "heuristic" : "external"} alert-source`, alert.source);

    item.append(icon, body, sourceBadge);

    item.addEventListener("click", () => {
      if (!map) return;
      const frames = map.frames;
      const targetFrame = frames.find((f) => f.id === alert.frame_id);
      if (targetFrame) {
        map.focusFrame(targetFrame);
        renderSelection(targetFrame, insights);
      }
    });

    list.appendChild(item);
  }
}

// ─── Rail list rendering (enhanced) ─────────────────────────────────────────

function renderRailList(manifest, frames, map, insights) {
  const railList = document.getElementById("railList");
  if (!railList) return;
  railList.innerHTML = "";

  for (const rail of manifest.rails) {
    const ri = insights?.available ? insights.rails?.[rail.name] : null;
    const button = createElement("button", "rail-chip");
    button.dataset.railName = rail.name;

    const top = document.createElement("div");
    top.className = "rail-chip-top";
    const title = createElement("strong", "", rail.name);

    if (ri) {
      const scoreBadge = createElement("span", `rail-score ${scoreColor(ri.health_score)}`, String(ri.health_score));
      top.append(title, scoreBadge);

      if (ri.priority_score >= 20) {
        button.classList.add("is-priority");
      }

      const meta = document.createElement("div");
      meta.className = "rail-chip-meta";

      const frameSpan = createElement("span", "rail-meta-item", `${rail.frame_count} frames`);
      meta.appendChild(frameSpan);

      if (ri.issue_count > 0) {
        const issueSpan = createElement("span", "rail-meta-item rail-issue", `이슈 ${ri.issue_count}개`);
        meta.appendChild(issueSpan);
      }

      if (ri.delta?.health_score != null && ri.delta.health_score !== 0) {
        const dt = ri.delta.health_score;
        const dSpan = createElement("span", `rail-meta-item delta-badge ${dt > 0 ? "delta-pos" : "delta-neg"}`, `${dt > 0 ? "+" : ""}${dt}`);
        meta.appendChild(dSpan);
      }

      button.append(top, meta);
    } else {
      const meta = createElement("span", "", `${rail.frame_count} frames`);
      top.append(title);
      button.append(top, meta);
    }

    button.addEventListener("click", () => {
      const frame = frames.find((item) => item.rail_name === rail.name);
      if (!frame) return;
      map.focusFrame(frame);
      renderSelection(frame, insights);
      setActiveRail(rail.name);
      if (currentTrends) showRailTrend(rail.name);
    });
    railList.appendChild(button);
  }
}

// ─── Selection panel rendering (enhanced) ────────────────────────────────────

function buildSelectionMeta(frame) {
  const wrapper = document.createElement("div");
  const dl = document.createElement("dl");
  const entries = [
    ["Rail", frame.rail_name],
    ["Odom X", formatMeters(frame.odom_x)],
    ["Rail Y", formatMeters(frame.rail_y_m)],
    ["Seq", frame.seq_index != null ? String(frame.seq_index) : "-"],
  ];
  for (const [key, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  }
  wrapper.appendChild(dl);
  return wrapper;
}

function renderSelectionInsights(frame, insights) {
  const container = document.getElementById("selectionInsights");
  if (!container) return;
  if (!insights || !insights.available) {
    container.hidden = true;
    return;
  }
  const fi = insights.frames?.[String(frame.id)];
  if (!fi) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = "";

  const scoreRow = document.createElement("div");
  scoreRow.className = "si-score-row";
  const scoreEl = createElement("span", `si-score ${scoreColor(fi.score)}`, `${fi.score}점`);
  const sourceEl = createElement("span", `source-badge source-${fi.source?.includes("+") ? "external" : "heuristic"}`, fi.source || "heuristic");
  scoreRow.append(scoreEl, sourceEl);
  container.appendChild(scoreRow);

  if (fi.flags.length > 0) {
    const flagsRow = document.createElement("div");
    flagsRow.className = "si-flags";
    for (const flag of fi.flags) {
      const f = createElement("span", "si-flag", FLAG_LABELS[flag] || flag);
      flagsRow.appendChild(f);
    }
    container.appendChild(flagsRow);
  }

  if (fi.recommendation) {
    const rec = createElement("p", "si-recommendation", fi.recommendation);
    container.appendChild(rec);
  }

  // Related alerts
  if (fi.alert_ids?.length && insights.alerts) {
    const relAlerts = insights.alerts.filter((a) => fi.alert_ids.includes(a.id));
    if (relAlerts.length > 0) {
      const alertsDiv = document.createElement("div");
      alertsDiv.className = "si-alerts";
      for (const alert of relAlerts) {
        const a = createElement("div", `si-alert-item alert-${alert.severity}`, alert.message);
        alertsDiv.appendChild(a);
      }
      container.appendChild(alertsDiv);
    }
  }
}

const FLAG_LABELS = {
  missing_camera: "카메라 누락",
  data_gap: "데이터 공백",
};

function renderCommandInfo(frame, insights = currentInsightsData) {
  const title = document.getElementById("rtsInfoTitle");
  const rail = document.getElementById("rtsInfoRail");
  const position = document.getElementById("rtsInfoPosition");
  const status = document.getElementById("rtsInfoStatus");
  if (!title || !rail || !position || !status) return;
  if (!frame) {
    title.textContent = "NO TARGET";
    rail.textContent = "-";
    position.textContent = "-";
    status.textContent = "Awaiting selection";
    renderDetectionBars(null);
    return;
  }

  const ri = insights?.available ? insights.rails?.[frame.rail_name] : null;
  title.textContent = frame.label || frame.id || "Selected frame";
  rail.textContent = frame.rail_name || "-";
  position.textContent = `${formatMeters(frame.odom_x)} / ${formatMeters(frame.rail_y_m)}`;
  status.textContent = ri
    ? `Health ${ri.health_score} · Priority ${ri.priority_score}`
    : "Telemetry nominal";
  renderDetectionBars(frame);
}

function renderSelection(frame, insights) {
  const pill = document.getElementById("selectionPill");
  const selectionMeta = document.getElementById("selectionMeta");
  const contactSheet = document.getElementById("contactSheet");
  const cameraGrid = document.getElementById("cameraGrid");
  if (!pill || !selectionMeta || !contactSheet || !cameraGrid) return;

  renderCommandInfo(frame, insights);

  // Keep the hidden selection panel state in sync for existing detail workflows.
  const selPanel = document.getElementById("selectionPanel");
  if (selPanel) selPanel.hidden = false;

  pill.textContent = frame.rail_name;
  selectionMeta.innerHTML = "";
  selectionMeta.appendChild(buildSelectionMeta(frame));
  contactSheet.hidden = false;
  contactSheet.src = frame.contact_sheet_url;
  contactSheet.alt = frame.label;
  cameraGrid.innerHTML = "";
  setActiveRail(frame.rail_name);
  renderSelectionInsights(frame, insights);
  for (const cameraName of CAMERA_ORDER) {
    const camera = frame.cameras[cameraName];
    if (!camera) continue;
    const card = createElement("article", "camera-card");
    const title = createElement("h3", "", getCameraLabel(cameraName));
    const image = document.createElement("img");
    image.loading = "lazy";
    image.src = camera.url;
    image.alt = `${frame.label} ${cameraName}`;
    card.append(title, image);
    cameraGrid.appendChild(card);
  }

  // Wire timelapse button to current frame
  const tlBtn = document.getElementById("timelapseBtn");
  if (tlBtn) {
    tlBtn.onclick = () => openTimelapse(frame);
  }
}

// ─── Timelapse ────────────────────────────────────────────────────────────────

let _tlTimer = null;

function sessionNameToDate(name) {
  // "20260304_170949" → Date
  const m = name.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!m) return new Date(0);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function formatSessionDate(name) {
  const d = sessionNameToDate(name);
  return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function openTimelapse(frame) {
  const modal = document.getElementById("timelapseModal");
  if (!modal) return;

  const device = allDevicesData?.find((d) => d.name === activeDeviceName);
  if (!device || !device.sessions.length) return;

  // Build slides: sorted by session date, image = contact sheet for this frame
  const slides = device.sessions
    .slice()
    .sort((a, b) => sessionNameToDate(a.name) - sessionNameToDate(b.name))
    .map((s) => ({
      sessionName: s.name,
      label: formatSessionDate(s.name),
      url: `/api/devices/${device.name}/sessions/${s.name}/contact-sheet/${frame.id}.jpg`,
    }));

  let idx = slides.length - 1; // start at most recent
  let playing = false;

  const img = document.getElementById("tlImage");
  const dateLabel = document.getElementById("tlDateLabel");
  const counter = document.getElementById("tlCounter");
  const playBtn = document.getElementById("tlPlayBtn");
  const prevBtn = document.getElementById("tlPrevBtn");
  const nextBtn = document.getElementById("tlNextBtn");
  const titleEl = document.getElementById("tlFrameTitle");

  if (titleEl) titleEl.textContent = frame.label;

  function showSlide(i) {
    idx = ((i % slides.length) + slides.length) % slides.length;
    const slide = slides[idx];
    img.src = slide.url;
    img.alt = `${frame.label} — ${slide.label}`;
    dateLabel.textContent = slide.label;
    counter.textContent = `${idx + 1} / ${slides.length}`;
  }

  function stopPlay() {
    playing = false;
    if (_tlTimer) { clearInterval(_tlTimer); _tlTimer = null; }
    if (playBtn) playBtn.textContent = "▶";
  }

  function startPlay() {
    playing = true;
    if (playBtn) playBtn.textContent = "⏸";
    _tlTimer = setInterval(() => {
      if (idx >= slides.length - 1) { stopPlay(); return; }
      showSlide(idx + 1);
    }, 1200);
  }

  if (prevBtn) prevBtn.onclick = () => { stopPlay(); showSlide(idx - 1); };
  if (nextBtn) nextBtn.onclick = () => { stopPlay(); showSlide(idx + 1); };
  if (playBtn) playBtn.onclick = () => { playing ? stopPlay() : startPlay(); };

  showSlide(idx);
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeTimelapse() {
  const modal = document.getElementById("timelapseModal");
  if (modal) modal.hidden = true;
  if (_tlTimer) { clearInterval(_tlTimer); _tlTimer = null; }
  document.body.classList.remove("modal-open");
}

// ─── Report rendering ─────────────────────────────────────────────────────────

function buildTaskReportSection(tasks) {
  if (!tasks || !tasks.tasks?.length) return "";
  const t = tasks.tasks;
  const summary = tasks.summary || {};
  const highOpen = t.filter((x) => x.priority === "high" && getTaskEffectiveStatus(x) !== "done");
  const medOpen = t.filter((x) => x.priority === "medium" && getTaskEffectiveStatus(x) !== "done");
  const done = t.filter((x) => getTaskEffectiveStatus(x) === "done");

  const taskRows = t.map((task) => {
    const eff = getTaskEffectiveStatus(task);
    const statusLabel = eff === "done" ? "완료" : eff === "in_progress" ? "진행 중" : "미착수";
    const priorityLabel = task.priority === "high" ? "긴급" : "주의";
    return `<tr class="${task.priority === "high" ? "row-priority" : ""}">
      <td><strong style="color:${task.priority === "high" ? "var(--bad)" : "var(--warn)"}">${priorityLabel}</strong></td>
      <td>${task.title}</td>
      <td>${task.rail_name}</td>
      <td>${task.start_m.toFixed(1)}–${task.end_m.toFixed(1)}m</td>
      <td>${task.due_label}</td>
      <td>${statusLabel}</td>
    </tr>`;
  }).join("");

  return `
<div class="report-section">
  <h3>작업 현황</h3>
  <div class="report-alert-summary">
    <div class="report-stat report-stat-error"><strong>${highOpen.length}</strong><span>긴급 미완료</span></div>
    <div class="report-stat report-stat-warn"><strong>${medOpen.length}</strong><span>주의 미완료</span></div>
    <div class="report-stat"><strong>${done.length}</strong><span>완료</span></div>
    <div class="report-stat"><strong>${t.length}</strong><span>전체</span></div>
  </div>
  <div class="report-table-wrap" style="margin-top:12px">
    <table class="report-table">
      <thead><tr><th>우선순위</th><th>작업</th><th>Rail</th><th>구간</th><th>기한</th><th>상태</th></tr></thead>
      <tbody>${taskRows}</tbody>
    </table>
  </div>
</div>`;
}

function buildReportHTML(insights) {
  if (!insights || !insights.available) {
    return "<p>이 세션의 인사이트 데이터가 없습니다.</p>";
  }
  const s = insights.session;
  const r = insights.report || {};
  const now = new Date().toLocaleString("ko-KR");

  const railRows = (r.rail_status || []).map((rail) => {
    const flagStr = rail.flags?.length ? rail.flags.map((f) => FLAG_LABELS[f] || f).join(", ") : "-";
    const recStr = rail.recommendation || "-";
    return `<tr class="${rail.priority_score >= 20 ? "row-priority" : ""}">
      <td>${rail.rail_name}</td>
      <td class="${scoreColor(rail.health_score)}">${rail.health_score}</td>
      <td class="${scoreColor(rail.coverage_score)}">${rail.coverage_score}</td>
      <td>${rail.issue_count}</td>
      <td>${flagStr}</td>
      <td>${recStr}</td>
    </tr>`;
  }).join("");

  const findingsHTML = (r.key_findings || []).map((f) => `<li>${f}</li>`).join("") || "<li>이상 없음</li>";
  const actionsHTML = (r.recommended_actions || []).map((a) => `<li>${a}</li>`).join("") || "<li>권장 액션 없음</li>";

  const deltaHTML = s.delta?.compared_session
    ? `<p class="report-delta">직전 세션(${s.delta.compared_session}) 대비: health ${s.delta.health_score >= 0 ? "+" : ""}${s.delta.health_score}점, alerts ${s.delta.alert_count >= 0 ? "+" : ""}${s.delta.alert_count}건</p>`
    : "";

  return `
<div class="report-section">
  <h3>세션 개요</h3>
  <p>${r.session_overview || ""}</p>
  <p class="report-meta">분석 시각: ${s.generated_at || "-"} | 출력 시각: ${now} | 분석 방식: <strong>${s.source || "heuristic"}</strong></p>
  ${deltaHTML}
</div>

<div class="report-section">
  <h3>Alert 요약</h3>
  <div class="report-alert-summary">
    <div class="report-stat"><strong>${r.alert_summary?.total ?? 0}</strong><span>전체</span></div>
    <div class="report-stat report-stat-error"><strong>${r.alert_summary?.error ?? 0}</strong><span>오류</span></div>
    <div class="report-stat report-stat-warn"><strong>${r.alert_summary?.warning ?? 0}</strong><span>경고</span></div>
    <div class="report-stat report-stat-info"><strong>${r.alert_summary?.info ?? 0}</strong><span>정보</span></div>
  </div>
</div>

<div class="report-section">
  <h3>주요 발견 사항</h3>
  <ul>${findingsHTML}</ul>
</div>

<div class="report-section">
  <h3>Rail 별 상태</h3>
  <div class="report-table-wrap">
    <table class="report-table">
      <thead>
        <tr>
          <th>Rail</th>
          <th>Health</th>
          <th>Coverage</th>
          <th>이슈</th>
          <th>플래그</th>
          <th>권장 조치</th>
        </tr>
      </thead>
      <tbody>${railRows}</tbody>
    </table>
  </div>
</div>

<div class="report-section">
  <h3>운영 권장 액션</h3>
  <ol>${actionsHTML}</ol>
</div>

${buildTaskReportSection(currentTasks)}

<div class="report-section">
  <h3>Alert 상세 목록</h3>
  ${insights.alerts?.length
    ? `<table class="report-table">
        <thead><tr><th>심각도</th><th>카테고리</th><th>메시지</th><th>Rail</th></tr></thead>
        <tbody>${insights.alerts.map((a) => `
          <tr class="alert-row-${a.severity}">
            <td>${a.severity}</td>
            <td>${a.category}</td>
            <td>${a.message}</td>
            <td>${a.rail_name || "-"}</td>
          </tr>`).join("")}
        </tbody>
      </table>`
    : "<p>Alert 없음</p>"}
</div>`;
}

function openReport(insights) {
  const modal = document.getElementById("reportModal");
  const body = document.getElementById("reportBody");
  body.innerHTML = buildReportHTML(insights);
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeReport() {
  const modal = document.getElementById("reportModal");
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

// ─── Layer panel rendering ────────────────────────────────────────────────────

function renderLayersPanel(layers) {
  const panel = document.getElementById("layersPanel");
  const list = document.getElementById("layersList");
  const legend = document.getElementById("layerLegend");

  if (!layers || !layers.layers?.length) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  list.innerHTML = "";

  for (const layer of layers.layers) {
    const row = document.createElement("button");
    row.className = "layer-row";
    row.dataset.layerId = layer.id;
    row.type = "button";

    const indicator = document.createElement("span");
    indicator.className = "layer-indicator";
    indicator.dataset.scheme = layer.color_scheme;

    const info = document.createElement("div");
    info.className = "layer-info";
    const label = createElement("strong", "layer-label", layer.label);
    const desc = createElement("span", "layer-desc", layer.description);
    info.append(label, desc);

    const toggle = document.createElement("span");
    toggle.className = "layer-toggle-dot";

    row.append(indicator, info, toggle);

    row.addEventListener("click", () => {
      setActiveMapLayer(layer.id, { forceOff: activeLayerId === layer.id && showLayerOverlay });
    });

    list.appendChild(row);
  }

  updateLayerRowStates();
}

function renderMapLayerControls(layers) {
  const selector = document.getElementById("mapLayerSelector");
  if (!selector) return;
  const controlLayers = getMapLayerControlLayers(layers);
  if (!controlLayers.length) {
    selector.hidden = true;
    selector.innerHTML = "";
    return;
  }

  selector.hidden = false;
  selector.innerHTML = `
    <div class="map-layer-options"></div>
    <div class="growth-model-options" aria-label="Growth detection model"></div>
  `;
  const options = selector.querySelector(".map-layer-options");

  for (const layer of controlLayers) {
    const label = document.createElement("label");
    label.className = "map-layer-option";
    label.dataset.layerId = layer.id;
    label.title = layer.description || layer.label;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "map-layer";
    checkbox.value = layer.id;

    const indicator = document.createElement("span");
    indicator.className = "map-layer-swatch";
    indicator.dataset.scheme = layer.color_scheme;

    const text = createElement("span", "map-layer-name", t(`mapLayer.${layer.id}`) || layer.label);

    label.append(checkbox, indicator, text);
    label.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      setMiniMapLayerVisible(layer.id, checkbox.checked);
    });
    options.appendChild(label);
  }

  renderGrowthModelControls(selector);
  updateMapLayerControlStates();
}

function renderGrowthModelControls(selector = document.getElementById("mapLayerSelector")) {
  const container = selector?.querySelector(".growth-model-options");
  if (!container) return;
  const models = currentGrowthDetectionModels.filter((model) => model.available);
  if (!models.length) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  container.hidden = false;
  container.innerHTML = "";
  for (const model of models) {
    const label = document.createElement("label");
    label.className = "growth-model-option";
    label.dataset.modelId = model.id;
    label.title = model.dataPath || model.label;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "growth-detection-model";
    checkbox.value = model.id;

    const text = createElement("span", "growth-model-name", model.label || model.id);
    label.append(checkbox, text);
    label.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      if (!checkbox.checked) {
        checkbox.checked = true;
        return;
      }
      activeMiniMapLayerIds.add("growth_status");
      updateMapLayerControlStates();
      void loadGrowthDetectionsForModel(model.id);
    });
    container.appendChild(label);
  }
  updateGrowthModelControlStates();
}

function updateLayerRowStates() {
  for (const row of document.querySelectorAll(".layer-row")) {
    const isActive = showLayerOverlay && row.dataset.layerId === activeLayerId;
    row.classList.toggle("is-active", isActive);
  }
  // Update toolbar button
  const btn = document.getElementById("toggleLayersButton");
  if (btn) btn.classList.toggle("is-active", showLayerOverlay);
}

function updateMapLayerControlStates() {
  for (const option of document.querySelectorAll(".map-layer-option")) {
    const isActive = activeMiniMapLayerIds.has(option.dataset.layerId);
    option.classList.toggle("is-active", isActive);
    const checkbox = option.querySelector("input[type='checkbox']");
    if (checkbox) checkbox.checked = isActive;
  }
  updateGrowthModelControlStates();
}

function updateGrowthModelControlStates({ loading = false } = {}) {
  for (const option of document.querySelectorAll(".growth-model-option")) {
    const isActive = option.dataset.modelId === activeGrowthDetectionModelId;
    option.classList.toggle("is-active", isActive);
    option.classList.toggle("is-loading", loading && isActive);
    const checkbox = option.querySelector("input[type='checkbox']");
    if (checkbox) checkbox.checked = isActive;
  }
}

function renderLayerLegend(layer) {
  const legend = document.getElementById("layerLegend");
  if (!layer) { legend.innerHTML = ""; return; }
  if (layer.id === "disease_pest_risk_v2") {
    const stats = getPestDetectionStats();
    legend.innerHTML = `
      <span class="legend-title">${layer.label} 범례</span>
      <div class="layer-legend-pills">
        <span class="layer-legend-pill">
          <span class="layer-legend-marker severity-high"></span>
          고위험 ${stats.high}건
        </span>
        <span class="layer-legend-pill">
          <span class="layer-legend-marker severity-medium"></span>
          주의 ${stats.medium}건
        </span>
        <span class="layer-legend-pill">
          <span class="layer-legend-marker severity-low"></span>
          낮음 ${stats.low}건
        </span>
      </div>
    `;
    return;
  }
  if (layer.id === "disease_pest_risk_v2_harvest") {
    legend.innerHTML = `
      <span class="legend-title">${layer.label} 범례</span>
      <div class="layer-legend-pills">
        ${["flower", "unripe", "midripe", "ripe"].map((stageId) => {
          const stage = getHarvestStageInfo(
            stageId === "flower" ? 0 : stageId === "unripe" ? 35 : stageId === "midripe" ? 60 : 90
          );
          return `
            <span class="layer-legend-pill">
              <span class="layer-legend-stage" style="background:${hexToRgba(stage.color, stage.legendAlpha)}"></span>
              ${stage.label}
            </span>
          `;
        }).join("")}
        <span class="layer-legend-pill">
          <img src="/assets/hospital.png" class="layer-legend-marker-icon" alt="">
          병충해 마커
        </span>
      </div>
    `;
    return;
  }
  const colorFn = COLOR_SCHEMES[layer.color_scheme] || COLOR_SCHEMES.yellow_red;

  const steps = [
    { label: "낮음", value: 15 },
    { label: "중간", value: 55 },
    { label: "높음", value: 85 },
  ];

  legend.innerHTML = "";
  const title = createElement("span", "legend-title", `${layer.label} 범례`);
  legend.appendChild(title);

  const bar = document.createElement("div");
  bar.className = "legend-bar";
  for (let i = 0; i <= 20; i++) {
    const cell = document.createElement("div");
    cell.className = "legend-cell";
    cell.style.background = colorFn(i * 5).replace(/rgba\(([^)]+),\s*[\d.]+\)/, "rgba($1, 0.85)");
    bar.appendChild(cell);
  }
  legend.appendChild(bar);

  const labels = document.createElement("div");
  labels.className = "legend-labels";
  for (const step of steps) {
    const lbl = createElement("span", "legend-lbl", step.label);
    labels.appendChild(lbl);
  }
  legend.appendChild(labels);
}

function renderLayerSummary(layer) {
  const el = document.getElementById("layerSummary");
  if (!layer) { el.hidden = true; return; }

  if (layer.id === "disease_pest_risk_v2") {
    const stats = getPestDetectionStats();
    el.hidden = false;
    el.innerHTML = "";
    for (const item of [
      { value: stats.high, label: "고위험 마커", cls: "stat-bad" },
      { value: stats.medium, label: "주의 마커", cls: "stat-warn" },
      { value: stats.total, label: "총 마커", cls: "" },
    ]) {
      const stat = document.createElement("div");
      stat.className = `layer-stat ${item.cls}`;
      const val = createElement("strong", "layer-stat-value", String(item.value));
      const lbl = createElement("span", "layer-stat-label", item.label);
      stat.append(val, lbl);
      el.appendChild(stat);
    }
    return;
  }
  if (layer.id === "disease_pest_risk_v2_harvest") {
    const stageStats = getHarvestStageStats(layer.items || []);
    const pestStats = getPestDetectionStats();
    el.hidden = false;
    el.innerHTML = "";
    for (const item of [
      { value: stageStats.ripe, label: "익음 구간", cls: "stat-bad" },
      { value: stageStats.midripe, label: "덜익음 구간", cls: "stat-warn" },
      { value: pestStats.total, label: "병충해 마커", cls: "" },
    ]) {
      const stat = document.createElement("div");
      stat.className = `layer-stat ${item.cls}`;
      const val = createElement("strong", "layer-stat-value", String(item.value));
      const lbl = createElement("span", "layer-stat-label", item.label);
      stat.append(val, lbl);
      el.appendChild(stat);
    }
    return;
  }

  const items = layer.items || [];
  const high = items.filter((i) => i.severity === "high").length;
  const medium = items.filter((i) => i.severity === "medium").length;
  const railsAffected = new Set(items.filter((i) => i.severity !== "low").map((i) => i.rail_name)).size;

  el.hidden = false;
  el.innerHTML = "";

  const stats = [
    { value: high, label: "고위험", cls: "stat-bad" },
    { value: medium, label: "주의", cls: "stat-warn" },
    { value: railsAffected, label: "영향 Rail", cls: "" },
  ];

  for (const s of stats) {
    const stat = document.createElement("div");
    stat.className = `layer-stat ${s.cls}`;
    const val = createElement("strong", "layer-stat-value", String(s.value));
    const lbl = createElement("span", "layer-stat-label", s.label);
    stat.append(val, lbl);
    el.appendChild(stat);
  }
}

// ─── Segment tooltip ──────────────────────────────────────────────────────────

function showSegmentTooltip(item, screenX, screenY) {
  const tooltip = document.getElementById("segmentTooltip");
  if (!tooltip) return;
  if (!item || isSegmentHoverDisabled()) {
    tooltip.hidden = true;
    return;
  }

  const layer = getActiveLayer();
  tooltip.hidden = false;
  tooltip.innerHTML = `
    <div class="seg-tooltip-header">
      <span class="seg-tooltip-layer">${layer?.label || ""}</span>
      <span class="seg-tooltip-demo">DEMO</span>
    </div>
    <div class="seg-tooltip-title" style="color:${segmentSeverityColor(item.severity)}">${item.title}</div>
    <div class="seg-tooltip-meta">
      <span>${item.rail_name}</span>
      <span>${item.start_m.toFixed(1)}m – ${item.end_m.toFixed(1)}m</span>
    </div>
    <div class="seg-tooltip-score">
      <strong>${item.value}</strong><span>/100</span>
      <span class="seg-tooltip-conf" title="신뢰도">conf ${Math.round(item.confidence * 100)}%</span>
    </div>
    <div class="seg-tooltip-summary">${item.summary}</div>
  `;

  const viewport = document.getElementById("mapViewport");
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  let x = screenX + 12;
  let y = screenY - 10;
  // Keep within viewport
  const tw = 220;
  const th = 130;
  if (x + tw > vw) x = screenX - tw - 8;
  if (y + th > vh) y = screenY - th - 8;
  tooltip.style.left = `${Math.max(0, x)}px`;
  tooltip.style.top = `${Math.max(0, y)}px`;
}

// ─── Segment detail panel ─────────────────────────────────────────────────────

function renderSegmentDetail(item) {
  const el = document.getElementById("segmentDetail");
  if (!el) return;
  if (!item) { el.hidden = true; return; }

  const layer = getActiveLayer();
  el.hidden = false;
  el.innerHTML = "";

  const header = document.createElement("div");
  header.className = "seg-detail-header";

  const layerLabel = createElement("span", "seg-detail-layer", layer?.label || "");
  const demoBadge = createElement("span", "demo-badge", "DEMO");
  const closeBtn = document.createElement("button");
  closeBtn.className = "seg-detail-close";
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => {
    selectedSegmentId = null;
    el.hidden = true;
    currentMap?.queueRender();
  });
  header.append(layerLabel, demoBadge, closeBtn);
  el.appendChild(header);

  const sevColor = segmentSeverityColor(item.severity);
  const titleEl = createElement("div", "seg-detail-title");
  titleEl.style.color = sevColor;
  titleEl.textContent = item.title;
  el.appendChild(titleEl);

  const scoreRow = document.createElement("div");
  scoreRow.className = "seg-detail-score-row";
  const scoreEl = createElement("strong", "seg-detail-score", String(item.value));
  scoreEl.style.color = sevColor;
  const confEl = createElement("span", "seg-detail-conf", `신뢰도 ${Math.round(item.confidence * 100)}%`);
  const sevEl = createElement("span", `seg-detail-sev sev-${item.severity}`, item.severity.toUpperCase());
  scoreRow.append(scoreEl, confEl, sevEl);
  el.appendChild(scoreRow);

  const metaEl = createElement("div", "seg-detail-meta", `${item.rail_name} · ${item.start_m.toFixed(1)}–${item.end_m.toFixed(1)}m · ${item.frame_ids?.length || 0}프레임`);
  el.appendChild(metaEl);

  if (item.summary) {
    const summaryEl = createElement("p", "seg-detail-summary", item.summary);
    el.appendChild(summaryEl);
  }

  if (item.recommended_action) {
    const actionBox = document.createElement("div");
    actionBox.className = "seg-detail-action";
    const icon = createElement("span", "seg-action-icon", "→");
    const text = createElement("span", "", item.recommended_action);
    actionBox.append(icon, text);
    el.appendChild(actionBox);
  }

  if (item.reasons?.length > 0) {
    const reasonsEl = document.createElement("div");
    reasonsEl.className = "seg-detail-reasons";
    for (const r of item.reasons) {
      const tag = createElement("span", "seg-reason-tag", REASON_LABELS[r] || r);
      reasonsEl.appendChild(tag);
    }
    el.appendChild(reasonsEl);
  }

  const sourceEl = createElement("div", "seg-detail-source", `데이터 출처: ${item.source || "demo"}`);
  el.appendChild(sourceEl);
}

const REASON_LABELS = {
  growth_stagnation: "생육 정체",
  powdery_mildew_risk: "흰가루병 위험",
  camera_missing: "카메라 누락",
  growth_slowdown: "생육 둔화",
  minor_anomaly: "경미한 이상",
  aphid_pattern: "진딧물 패턴",
  leaf_discoloration: "잎 변색",
  minor_leaf_spots: "경미한 반점",
  early_mildew: "초기 곰팡이",
  consecutive_low_growth: "연속 저성장",
  environmental_stress: "환경 스트레스",
  frame_gap: "프레임 공백",
  odom_anomaly: "위치 이상",
  single_camera_missing: "카메라 1개 누락",
  irregular_interval: "불규칙 간격",
  brix_above_threshold: "당도 기준 초과",
  color_index_ripe: "색도 성숙",
  size_target_met: "크기 기준 충족",
  approaching_threshold: "기준 접근 중",
  partial_ripening: "부분 숙성",
  below_avg_height: "평균 이하 생장",
};

// ─── Sel tab switching ────────────────────────────────────────────────────────

function switchSelTab(tab) {
  selActiveTab = tab;
  for (const btn of document.querySelectorAll(".sel-tab")) {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  }
  const infoContent = document.getElementById("selInfoContent");
  const trendContent = document.getElementById("selTrendContent");
  if (!infoContent || !trendContent) return;
  infoContent.hidden = tab !== "info";
  trendContent.hidden = tab !== "trend";
}

// ─── Trend chart (SVG) ───────────────────────────────────────────────────────

const TREND_META = {
  health_score:      { label: "종합 Health", higherIsBad: false, unit: "점" },
  disease_pest_risk: { label: "병충해 위험",  higherIsBad: true,  unit: "점" },
  growth_status:     { label: "생육 상태",    higherIsBad: false, unit: "점" },
  data_reliability:  { label: "데이터 신뢰도", higherIsBad: false, unit: "점" },
};

function buildTrendSVG(sessions, values, higherIsBad) {
  const W = 268, H = 78;
  const pad = { top: 8, right: 10, bottom: 20, left: 28 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;
  const n = values.length;
  if (n < 2) return "";

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 10;

  const px = (i) => pad.left + (i / (n - 1)) * iW;
  const py = (v) => pad.top + iH - ((v - minV) / range) * iH;

  const delta = values[n - 1] - values[n - 2];
  const worsening = higherIsBad ? delta > 1.5 : delta < -1.5;
  const improving = higherIsBad ? delta < -1.5 : delta > 1.5;
  const lineCol = worsening ? "#c02828" : improving ? "#1a7a4a" : "#a06010";

  const pathD = values.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${px(n - 1).toFixed(1)} ${(pad.top + iH).toFixed(1)} L${px(0).toFixed(1)} ${(pad.top + iH).toFixed(1)} Z`;

  const dots = values.map((v, i) => {
    const r = i === n - 1 ? 4 : 2.5;
    return `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="${r}" fill="${lineCol}" stroke="white" stroke-width="1.5"/>`;
  }).join("");

  const firstLabel = sessions[0] || "";
  const lastLabel = sessions[n - 1] || "현재";

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${pad.left - 3}" y="${pad.top + 5}" text-anchor="end" font-size="8.5" fill="rgba(125,152,137,0.65)">${Math.round(maxV)}</text>
  <text x="${pad.left - 3}" y="${pad.top + iH + 4}" text-anchor="end" font-size="8.5" fill="rgba(125,152,137,0.65)">${Math.round(minV)}</text>
  <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left + iW}" y2="${pad.top}" stroke="rgba(39,48,41,0.5)" stroke-width="1"/>
  <line x1="${pad.left}" y1="${pad.top + iH}" x2="${pad.left + iW}" y2="${pad.top + iH}" stroke="rgba(39,48,41,0.7)" stroke-width="1"/>
  <path d="${areaD}" fill="${lineCol}" opacity="0.08"/>
  <path d="${pathD}" fill="none" stroke="${lineCol}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}
  <text x="${px(0).toFixed(1)}" y="${H - 3}" text-anchor="middle" font-size="8" fill="rgba(125,152,137,0.55)">${firstLabel}</text>
  <text x="${px(n - 1).toFixed(1)}" y="${H - 3}" text-anchor="middle" font-size="8" fill="rgba(125,152,137,0.55)">${lastLabel}</text>
</svg>`;
}

function renderTrendCharts(railName, trendsData) {
  const railData = trendsData?.rails?.[railName];
  const header = document.getElementById("trendRailHeader");
  const container = document.getElementById("trendCharts");
  if (!header || !container) return;
  if (!railData) {
    header.innerHTML = "";
    container.innerHTML = "<p style='color:var(--muted);font-size:12px;'>추이 데이터 없음</p>";
    return;
  }

  const cur = railData.current;
  const healthClass = cur.health_score >= 75 ? "score-good" : cur.health_score >= 50 ? "score-warn" : "score-bad";
  header.innerHTML = `
    <div class="trend-rail-name">${railName}</div>
    <div class="trend-cur-stats">
      <span class="trend-cur-stat ${healthClass}">
        <strong>${Math.round(cur.health_score)}</strong><span>Health</span>
      </span>
      <span class="trend-cur-stat ${cur.disease_pest_risk >= 70 ? "score-bad" : cur.disease_pest_risk >= 40 ? "score-warn" : "score-good"}">
        <strong>${Math.round(cur.disease_pest_risk)}</strong><span>병충해</span>
      </span>
      <span class="trend-cur-stat ${cur.growth_status >= 60 ? "score-good" : cur.growth_status >= 35 ? "score-warn" : "score-bad"}">
        <strong>${Math.round(cur.growth_status)}</strong><span>생육</span>
      </span>
      <span class="trend-cur-stat ${cur.data_reliability >= 60 ? "score-good" : cur.data_reliability >= 35 ? "score-warn" : "score-bad"}">
        <strong>${Math.round(cur.data_reliability)}</strong><span>신뢰도</span>
      </span>
    </div>
    <div class="trend-demo-note"><span class="demo-badge">DEMO</span> 가상 세션 기반 추이 (실데이터 아님)</div>
  `;

  container.innerHTML = "";

  const metrics = ["health_score", "disease_pest_risk", "growth_status", "data_reliability"];
  for (const metric of metrics) {
    const meta = TREND_META[metric];
    const values = railData.trends[metric];
    const summary = railData.summaries[metric];
    const sessions = railData.sessions;
    if (!values || values.length < 2) continue;

    const last = values[values.length - 1];
    const prev = values[values.length - 2];
    const delta = last - prev;
    const worsening = meta.higherIsBad ? delta > 1.5 : delta < -1.5;
    const improving = meta.higherIsBad ? delta < -1.5 : delta > 1.5;
    const summaryClass = worsening ? "trend-bad" : improving ? "trend-good" : "trend-stable";

    const card = document.createElement("div");
    card.className = "trend-chart-card";
    card.innerHTML = `
      <div class="trend-chart-label">${meta.label}</div>
      <div class="trend-chart-svg">${buildTrendSVG(sessions, values, meta.higherIsBad)}</div>
      ${summary ? `<div class="trend-chart-summary ${summaryClass}">${summary}</div>` : ""}
    `;
    container.appendChild(card);
  }
}

function showRailTrend(railName) {
  if (!currentTrends) return;
  activeTrendRail = railName;
  const trendTabBtn = document.getElementById("trendTabBtn");
  if (trendTabBtn) trendTabBtn.disabled = false;
  renderTrendCharts(railName, currentTrends);
  switchSelTab("trend");
}

// ─── Task panel rendering ─────────────────────────────────────────────────────

const TASK_PRIORITY_ICONS = { high: "!", medium: "~", low: "·" };
const TASK_PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const TASK_TYPE_LABELS = {
  disease_check: "병충해",
  growth_check: "생육",
  reshot: "재촬영",
  camera_check: "카메라",
  harvest: "수확",
  priority_check: "우선점검",
};

function getTaskEffectiveStatus(task) {
  return taskStatusOverrides[task.id] ?? task.status;
}

function formatFieldArea(task) {
  if (!task) return "-";
  const railNumber = String(task.rail_name || "").match(/\d+/)?.[0];
  const bedName = railNumber ? `${Number(railNumber)}번 베드` : (task.rail_name || "선택 구역");
  const start = Number.isFinite(Number(task.start_m)) ? Number(task.start_m).toFixed(1) : "-";
  const end = Number.isFinite(Number(task.end_m)) ? Number(task.end_m).toFixed(1) : "-";
  return `${bedName} · ${start}-${end}m`;
}

function sortTasksByUrgency(tasks) {
  return [...tasks].sort((a, b) => {
    const pri = (TASK_PRIORITY_RANK[a.priority] ?? 9) - (TASK_PRIORITY_RANK[b.priority] ?? 9);
    if (pri !== 0) return pri;
    return String(a.due_label || "").localeCompare(String(b.due_label || ""));
  });
}

function renderTaskMission(tasksData, map) {
  const mission = document.getElementById("taskMission");
  if (!mission) return;
  const tasks = tasksData?.tasks || [];
  const open = tasks.filter((t) => getTaskEffectiveStatus(t) !== "done");
  const high = open.filter((t) => t.priority === "high");
  const harvest = open.filter((t) => t.task_type === "harvest");
  const reshot = open.filter((t) => t.task_type === "reshot" || t.task_type === "camera_check");
  const first = sortTasksByUrgency(open)[0];

  if (!open.length) {
    mission.innerHTML = `
      <div class="mission-empty">
        <strong>오늘 남은 조치가 없습니다</strong>
        <span>새 세션이 들어오면 우선순위를 다시 계산합니다.</span>
      </div>
    `;
    return;
  }

  mission.innerHTML = `
    <div class="mission-hero">
      <span class="mission-kicker">먼저 확인할 곳</span>
      <strong>${formatFieldArea(first)}</strong>
      <span>${first.title}</span>
      <button class="mission-focus-btn" type="button">지도에서 보기</button>
    </div>
    <div class="mission-stats">
      <div class="mission-stat is-hot"><strong>${high.length}</strong><span>긴급</span></div>
      <div class="mission-stat is-harvest"><strong>${harvest.length}</strong><span>수확</span></div>
      <div class="mission-stat"><strong>${reshot.length}</strong><span>재확인</span></div>
    </div>
  `;
  mission.querySelector(".mission-focus-btn")?.addEventListener("click", () => focusTaskOnMap(first, map));
}

function renderTaskPanel(tasksData, map) {
  const panel = document.getElementById("tasksPanel");
  const list = document.getElementById("taskList");
  const pill = document.getElementById("taskCountPill");
  if (!tasksData || !tasksData.tasks?.length) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  const openCount = tasksData.tasks.filter((t) => getTaskEffectiveStatus(t) !== "done").length;
  pill.textContent = String(openCount);
  renderTaskMission(tasksData, map);

  _renderTaskList(tasksData.tasks, list, map);

  for (const btn of document.querySelectorAll(".task-filter-btn")) {
    btn.onclick = () => {
      taskFilter = btn.dataset.filter;
      for (const b of document.querySelectorAll(".task-filter-btn")) {
        b.classList.toggle("is-active", b.dataset.filter === taskFilter);
      }
      _renderTaskList(tasksData.tasks, list, map);
    };
  }
}

function _renderTaskList(tasks, listEl, map) {
  listEl.innerHTML = "";
  const filtered = sortTasksByUrgency(tasks.filter((t) => {
    const eff = getTaskEffectiveStatus(t);
    if (taskFilter === "active") return eff !== "done";
    if (taskFilter === "done") return eff === "done";
    return true;
  }));

  if (filtered.length === 0) {
    const empty = createElement("div", "task-empty");
    empty.textContent = taskFilter === "done" ? "완료된 작업이 없습니다." : "대기 중인 작업이 없습니다.";
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach((task, index) => {
    const eff = getTaskEffectiveStatus(task);
    const item = document.createElement("div");
    item.className = `task-item task-${task.priority} task-status-${eff}${index === 0 && eff !== "done" ? " is-next" : ""}`;
    item.addEventListener("click", () => focusTaskOnMap(task, map));

    const header = document.createElement("div");
    header.className = "task-item-header";

    const icon = createElement("span", `task-priority-icon task-icon-${task.priority}`, TASK_PRIORITY_ICONS[task.priority] || "·");
    const typeTag = createElement("span", "task-type-tag", TASK_TYPE_LABELS[task.task_type] || task.task_type);

    const titleBtn = document.createElement("button");
    titleBtn.className = "task-title-btn";
    titleBtn.type = "button";
    titleBtn.textContent = task.title;
    titleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      focusTaskOnMap(task, map);
    });

    const doneToggle = document.createElement("button");
    doneToggle.className = `task-done-toggle ${eff === "done" ? "is-done" : ""}`;
    doneToggle.type = "button";
    doneToggle.title = eff === "done" ? "완료 취소" : "완료 처리";
    doneToggle.textContent = eff === "done" ? "✓" : "○";
    doneToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = getTaskEffectiveStatus(task);
      taskStatusOverrides[task.id] = cur === "done" ? "todo" : "done";
      renderTaskPanel({ tasks, summary: {} }, map);
      // Refresh pill count
      const openCount = tasks.filter((t) => getTaskEffectiveStatus(t) !== "done").length;
      const pill = document.getElementById("taskCountPill");
      if (pill) pill.textContent = String(openCount);
    });

    header.append(icon, typeTag, titleBtn, doneToggle);
    item.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "task-item-meta";
    meta.innerHTML = `<span class="task-rail">${formatFieldArea(task)}</span>
      <span class="task-range">${task.start_m.toFixed(1)}–${task.end_m.toFixed(1)}m</span>
      <span class="task-due task-due-${task.priority}">${task.due_label}</span>`;
    item.appendChild(meta);

    const reason = createElement("div", "task-item-reason", task.reason);
    item.appendChild(reason);

    if (eff !== "done") {
      const action = document.createElement("div");
      action.className = "task-item-action";
      action.innerHTML = `<span class="task-action-arrow">→</span> ${task.recommended_action}`;
      item.appendChild(action);
    }

    listEl.appendChild(item);
  });
}

function focusTaskOnMap(task, map) {
  if (!map) return;
  // Focus map on the task's rail + frame range
  const frame = map.frames.find((f) =>
    f.rail_name === task.rail_name &&
    f.odom_x >= task.start_m &&
    f.odom_x <= task.end_m
  ) || map.frames.find((f) => f.rail_name === task.rail_name);
  if (frame) {
    map.focusFrame(frame);
    renderSelection(frame, currentInsightsData);
    setRightPanelMode("tasks");
  }
  // Activate relevant layer on map
  if (task.layer_id && currentLayersData) {
    setActiveMapLayer(task.layer_id);
  }
}


// ─── Session loading ──────────────────────────────────────────────────────────

let currentMap = null;
let currentSessionLoadToken = 0;
let currentInsightsData = null;
let currentLayersData = null;

function setRightPanelMode(mode) {
  const panel = document.getElementById("rightPanel");
  if (!panel) return;
  panel.dataset.activePanel = mode;
  for (const tab of document.querySelectorAll(".inspector-tab")) {
    tab.classList.toggle("is-active", tab.dataset.panel === mode);
  }
}

function initInspectorTabs() {
  for (const tab of document.querySelectorAll(".inspector-tab")) {
    tab.addEventListener("click", () => setRightPanelMode(tab.dataset.panel || "layers"));
  }
}

function initMapControls() {
  const centerAnchor = () => ({
    x: currentMap?.viewportWidth ? currentMap.viewportWidth / 2 : 0,
    y: currentMap?.viewportHeight ? currentMap.viewportHeight / 2 : 0,
  });
  const stack = document.querySelector(".map-control-stack");
  if (stack) {
    for (const eventName of ["pointerdown", "pointerup", "pointermove", "dblclick", "wheel"]) {
      stack.addEventListener(eventName, (event) => event.stopPropagation(), { passive: eventName !== "wheel" });
    }
  }
  const layerSelector = document.getElementById("mapLayerSelector");
  if (layerSelector) {
    for (const eventName of ["pointerdown", "pointerup", "pointermove", "click", "dblclick", "wheel"]) {
      layerSelector.addEventListener(eventName, (event) => {
        event.stopPropagation();
        if (eventName === "wheel") event.preventDefault();
      }, { passive: eventName !== "wheel" });
    }
  }
  document.getElementById("mapZoomIn")?.addEventListener("click", () => currentMap?.zoomBy(0.45, centerAnchor()));
  document.getElementById("mapZoomOut")?.addEventListener("click", () => currentMap?.zoomBy(-0.45, centerAnchor()));
  document.getElementById("mapFit")?.addEventListener("click", () => currentMap?.fitToBounds());
}

async function loadSession(deviceName, sessionName, loadToken = currentSessionLoadToken) {
  const manifest = await fetchJson(`/api/devices/${deviceName}/sessions/${sessionName}/manifest`);
  if (loadToken !== currentSessionLoadToken) return null;
  const framePayload = await fetchJson(manifest.frames_url);
  if (loadToken !== currentSessionLoadToken) return null;
  const frames = framePayload.items;

  // Load insights (non-blocking: failure → null)
  let insights = null;
  try {
    insights = await fetchJson(`/api/devices/${deviceName}/sessions/${sessionName}/insights`);
  } catch (_) {
    insights = null;
  }
  if (loadToken !== currentSessionLoadToken) return null;
  currentInsights = insights;
  currentInsightsData = insights;

  // Load layers (non-blocking)
  let layers = null;
  try {
    layers = await fetchJson(`/api/devices/${deviceName}/sessions/${sessionName}/layers`);
  } catch (_) {
    layers = null;
  }
  if (loadToken !== currentSessionLoadToken) return null;
  layers = normalizeLayersPayload(layers);
  currentLayers = layers;
  currentLayersData = layers;
  // Reset layer state for new session
  activeLayerId = null;
  showLayerOverlay = false;
  activeMiniMapLayerIds = new Set(["disease_pest_risk", "growth_status"]);
  selectedSegmentId = null;
  hoveredSegmentId = null;
  selectedPestDetectionId = null;

  // Load tasks
  let tasks = null;
  try {
    tasks = await fetchJson(`/api/devices/${deviceName}/sessions/${sessionName}/tasks`);
  } catch (_) { tasks = null; }
  if (loadToken !== currentSessionLoadToken) return null;
  currentTasks = tasks;
  taskStatusOverrides = {};

  // Load trends
  let trends = null;
  try {
    trends = await fetchJson(`/api/devices/${deviceName}/sessions/${sessionName}/trends`);
  } catch (_) { trends = null; }
  if (loadToken !== currentSessionLoadToken) return null;
  currentTrends = trends;
  activeTrendRail = null;

  // Load crop summary
  let cropSummary = null;
  try {
    cropSummary = await fetchJson(`/api/devices/${deviceName}/sessions/${sessionName}/crop-summary`);
  } catch (_) {
    cropSummary = null;
  }
  if (loadToken !== currentSessionLoadToken) return null;
  currentCropSummary = cropSummary || buildCropPanelPlaceholder(sessionName);

  let pestDetections = null;
  try {
    pestDetections = await fetchJson(`/api/devices/${deviceName}/sessions/${sessionName}/pest-detections`);
  } catch (_) {
    pestDetections = null;
  }
  if (loadToken !== currentSessionLoadToken) return null;
  currentPestDetections = normalizePestDetections(pestDetections, sessionName);

  let growthModelPayload = null;
  try {
    growthModelPayload = await fetchJson(`/api/devices/${deviceName}/sessions/${sessionName}/growth-detection-models`);
  } catch (_) {
    growthModelPayload = null;
  }
  if (loadToken !== currentSessionLoadToken) return null;
  currentGrowthDetectionModels = normalizeGrowthDetectionModels(growthModelPayload);
  activeGrowthDetectionModelId = chooseGrowthDetectionModel(
    currentGrowthDetectionModels,
    growthModelPayload?.default_model || activeGrowthDetectionModelId,
  );

  let growthDetections = null;
  try {
    growthDetections = await fetchJson(
      `/api/devices/${deviceName}/sessions/${sessionName}/growth-detections?model=${encodeURIComponent(activeGrowthDetectionModelId)}`,
    );
  } catch (_) {
    growthDetections = null;
  }
  if (loadToken !== currentSessionLoadToken) return null;
  currentGrowthDetections = normalizeGrowthDetections(growthDetections, sessionName);

  const datasetSummary = document.getElementById("datasetSummary");
  datasetSummary.dataset.summaryState = "loaded";
  datasetSummary.dataset.deviceName = deviceName;
  datasetSummary.dataset.sessionName = sessionName;
  datasetSummary.dataset.railCount = String(manifest.summary.rail_count);
  datasetSummary.dataset.frameCount = String(manifest.summary.frame_count);
  updateDatasetSummaryLanguage();
  const mapSessionChip = document.getElementById("mapSessionChip");
  if (mapSessionChip) {
    mapSessionChip.textContent = `${t("common.aiAnalysis")} · ${sessionName}`;
  }
  renderCropPanel(currentCropSummary);

  if (currentMap) {
    currentMap.destroy();
    currentMap = null;
  }

  document.getElementById("tilePane").innerHTML = "";
  document.getElementById("detailPane").innerHTML = "";
  document.getElementById("annotationPane").innerHTML = "";
  document.getElementById("markerPane").innerHTML = "";
  renderSegmentDetail(null);
  showSegmentTooltip(null);

  const zoomValue = document.getElementById("zoomValue");
  const scaleValue = document.getElementById("scaleValue");
  const cameraPointValue = document.getElementById("cameraPointValue");
  const map = new TileMap({
    container: document.getElementById("mapViewport"),
    tilePane: document.getElementById("tilePane"),
    detailPane: document.getElementById("detailPane"),
    annotationPane: document.getElementById("annotationPane"),
    markerPane: document.getElementById("markerPane"),
    overlayCanvas: document.getElementById("overlayCanvas"),
    miniMapCanvas: document.getElementById("rtsMiniMapCanvas"),
    verticalScrollBar: document.getElementById("mapVerticalScrollbar"),
    verticalScrollTrack: document.getElementById("mapScrollTrack"),
    verticalScrollThumb: document.getElementById("mapScrollThumb"),
    scrollUpButton: document.getElementById("mapScrollUp"),
    scrollDownButton: document.getElementById("mapScrollDown"),
    horizontalScrollBar: document.getElementById("mapHorizontalScrollbar"),
    horizontalScrollTrack: document.getElementById("mapHorizontalScrollTrack"),
    horizontalScrollThumb: document.getElementById("mapHorizontalScrollThumb"),
    scrollLeftButton: document.getElementById("mapScrollLeft"),
    scrollRightButton: document.getElementById("mapScrollRight"),
    manifest,
    frames,
    pestDetections: currentPestDetections,
    growthDetections: currentGrowthDetections,
    maxZoom: Math.max(computeViewerMaxZoom(manifest, frames), INITIAL_MAP_VIEW.zoom),
    onSelect: (frame) => renderSelection(frame, currentInsightsData),
    onViewChange: ({ zoom, screenPxPerMeter, centerX, centerY }) => {
      zoomValue.textContent = formatZoom(zoom);
      if (cameraPointValue) cameraPointValue.textContent = formatCameraPoint(centerX, centerY);
      scaleValue.textContent = screenPxPerMeter > 0 ? `${(1 / screenPxPerMeter).toFixed(3)} m/px` : "-";
    },
  });
  currentMap = map;

  renderAlertPanel(insights, map);
  renderLayersPanel(layers);
  renderMapLayerControls(layers);
  renderLayerLegend(getActiveLayer());
  renderLayerSummary(getActiveLayer());
  renderTaskPanel(tasks, map);
  // Reset selection tabs
  selActiveTab = "info";
  switchSelTab("info");
  const trendTabBtn = document.getElementById("trendTabBtn");
  if (trendTabBtn) trendTabBtn.disabled = true;

  const initialFrame = findInitialMapFrame(frames);
  if (initialFrame) {
    map.focusFrameAtZoom(initialFrame, INITIAL_MAP_VIEW.zoom, {
      centerX: INITIAL_MAP_VIEW.centerX,
      centerY: INITIAL_MAP_VIEW.centerY,
    });
    renderSelection(initialFrame, insights);
    setRightPanelMode("tasks");
  }

  return map;
}

// ─── Device/Session selectors ─────────────────────────────────────────────────

function renderDeviceTabs(devicesData, onSelect) {
  const tabsEl = document.getElementById("deviceTabs");
  if (tabsEl) tabsEl.innerHTML = "";

  const selects = [];
  if (tabsEl) {
    const legacySelect = document.createElement("select");
    legacySelect.className = "device-select";
    legacySelect.dataset.sessionHostSelect = "";
    tabsEl.appendChild(legacySelect);
    selects.push(legacySelect);
  }
  const visibleSelect = document.getElementById("hostSelect");
  if (visibleSelect) selects.push(visibleSelect);

  for (const select of selects) {
    select.innerHTML = "";
    select.disabled = devicesData.length === 0;
    for (const device of devicesData) {
      const opt = document.createElement("option");
      opt.value = device.name;
      opt.textContent = device.name;
      select.appendChild(opt);
    }
    select.onchange = () => onSelect(select.value, { autoLoad: true });
  }
}

function renderSessionList(sessions, activeDevice, onSelect) {
  const listEl = document.getElementById("sessionList");

  // 최신 세션이 상단에 오도록 내림차순 정렬
  const sorted = [...sessions].sort((a, b) => b.name.localeCompare(a.name));

  for (const select of document.querySelectorAll("[data-session-date-select]")) {
    select.innerHTML = "";
    select.disabled = sorted.length === 0;
    if (sorted.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = t("session.noCaptureDates");
      select.appendChild(opt);
    } else {
      for (const session of sorted) {
        const opt = document.createElement("option");
        opt.value = session.name;
        opt.textContent = formatCaptureDateLabel(session.name);
        opt.title = `${activeDevice}/${session.name}`;
        select.appendChild(opt);
      }
    }
    select.onchange = () => {
      if (select.value) onSelect(activeDevice, select.value);
    };
  }

  if (!listEl) return;
  listEl.innerHTML = "";

  for (const session of sorted) {
    const btn = createElement("button", "session-chip");
    btn.type = "button";
    btn.dataset.session = session.name;
    btn.dataset.railCount = String(session.rail_count);
    btn.dataset.frameCount = String(session.frame_count);
    btn.title = `${activeDevice}/${session.name}`;
    const name = createElement("strong", "", formatCaptureDateLabel(session.name));
    const meta = createElement(
      "span",
      "session-chip-meta",
      `${t("session.rail")} ${session.rail_count} · ${t("session.frame")} ${session.frame_count.toLocaleString(currentLanguage === "kr" ? "ko-KR" : "en-US")}`,
    );
    btn.append(name, meta);
    btn.addEventListener("click", () => onSelect(activeDevice, session.name, btn));
    listEl.appendChild(btn);
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  const summary = document.getElementById("datasetSummary");
  initLanguageToggle();
  renderCropPanel();
  initCasePanel();
  initInspectorTabs();
  initMapControls();

  let devicesData;
  try {
    const payload = await fetchJson("/api/devices");
    devicesData = payload.devices;
    allDevicesData = devicesData;
  } catch (err) {
    summary.textContent = t("status.initFailed", { message: err instanceof Error ? err.message : String(err) });
    return;
  }

  if (!devicesData || devicesData.length === 0) {
    summary.dataset.summaryState = "empty";
    summary.textContent = t("status.noSessions");
    return;
  }

  let activeDevice = devicesData[0].name;
  activeDeviceName = activeDevice;
  let activeSessionBtn = null;

  function selectDevice(deviceName, { autoLoad = false } = {}) {
    activeDevice = deviceName;
    activeDeviceName = deviceName;
    syncHostSelectors(deviceName);
    const device = devicesData.find((d) => d.name === deviceName);
    if (!device) return;
    renderSessionList(device.sessions, deviceName, selectSession);
    if (activeSessionBtn) activeSessionBtn.classList.remove("is-active");
    activeSessionBtn = null;
    const latestSession = getLatestSession(device.sessions);
    if (latestSession) syncCaptureDateSelectors(latestSession.name);
    if (autoLoad && latestSession) {
      void selectSession(deviceName, latestSession.name);
    }
  }

  async function selectSession(deviceName, sessionName, btn = null) {
    const loadToken = ++currentSessionLoadToken;
    if (activeSessionBtn) activeSessionBtn.classList.remove("is-active");
    activeSessionBtn = btn || Array.from(document.querySelectorAll(".session-chip"))
      .find((chip) => chip.dataset.session === sessionName) || null;
    if (activeSessionBtn) activeSessionBtn.classList.add("is-active");
    syncHostSelectors(deviceName);
    syncCaptureDateSelectors(sessionName);
    currentCropSummary = buildCropPanelPlaceholder(sessionName);
    currentPestDetections = normalizePestDetections(null, sessionName);
    currentGrowthDetections = normalizeGrowthDetections(null, sessionName);
    currentGrowthDetectionModels = [];
    activeGrowthDetectionModelId = "yolo11s";
    selectedPestDetectionId = null;
    renderCropPanel(currentCropSummary);
    summary.dataset.summaryState = "loading";
    summary.dataset.deviceName = deviceName;
    summary.dataset.sessionName = sessionName;
    summary.textContent = t("status.sessionLoading", { deviceName, sessionName });
    try {
      await loadSession(deviceName, sessionName, loadToken);
    } catch (err) {
      if (loadToken !== currentSessionLoadToken) return;
      summary.textContent = t("status.loadFailed", { message: err instanceof Error ? err.message : String(err) });
    }
  }

  renderDeviceTabs(devicesData, selectDevice);
  selectDevice(activeDevice);

  const firstDevice = devicesData[0];
  if (firstDevice.sessions.length > 0 && currentSessionLoadToken === 0) {
    const firstSession = getLatestSession(firstDevice.sessions);
    if (firstSession) await selectSession(firstDevice.name, firstSession.name);
  }

  const fitButton = document.getElementById("fitButton");
  if (fitButton) fitButton.addEventListener("click", () => currentMap?.fitToBounds());

  // toggleLayersButton은 HTML에서 제거됨 (우측 패널로 이동) — 없으면 skip
  const toggleLayersBtn = document.getElementById("toggleLayersButton");
  if (toggleLayersBtn) {
    toggleLayersBtn.addEventListener("click", () => {
      if (!currentLayersData) return;
      if (!showLayerOverlay) {
        setActiveMapLayer(activeLayerId || currentLayersData.layers?.[0]?.id);
      } else {
        setActiveMapLayer(activeLayerId, { forceOff: true });
      }
    });
  }

  document.getElementById("reportButton").addEventListener("click", () => {
    openReport(currentInsightsData);
  });
  document.getElementById("reportClose").addEventListener("click", closeReport);
  document.getElementById("reportBackdrop").addEventListener("click", closeReport);
  document.getElementById("printButton").addEventListener("click", () => window.print());

  // Crop panel collapsible
  const cropHead = document.getElementById("cropPanelHead");
  const cropBody = document.getElementById("cropPanelBody");
  const cropBtn  = document.getElementById("cropCollapseBtn");
  if (cropHead && cropBody) {
    cropHead.addEventListener("click", () => {
      const open = !cropBody.hidden;
      cropBody.hidden = open;
      if (cropBtn) { cropBtn.textContent = open ? "▸" : "▾"; cropBtn.setAttribute("aria-expanded", String(!open)); }
    });
  }

  // Timelapse modal close
  document.getElementById("tlCloseBtn")?.addEventListener("click", closeTimelapse);
  document.getElementById("timelapseModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeTimelapse();
  });

  // Selection tabs
  for (const btn of document.querySelectorAll(".sel-tab")) {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      switchSelTab(btn.dataset.tab);
    });
  }
}

bootstrap().catch((error) => {
  document.getElementById("datasetSummary").textContent =
    t("status.initFailed", { message: error instanceof Error ? error.message : String(error) });
  console.error(error);
});
