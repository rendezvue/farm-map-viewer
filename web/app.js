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

const COUNT_FORMATTER = new Intl.NumberFormat("ko-KR");

function formatCount(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return COUNT_FORMATTER.format(Math.round(value));
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

function mergeRailCropRows(rows) {
  const counts = { flower: 0, unripe: 0, midripe: 0, ripe: 0 };
  let frameCount = 0;
  for (const row of rows) {
    frameCount += row.frame_count || 0;
    for (const series of CROP_MAP_CHART_SERIES) {
      counts[series.id] += row.counts?.[series.id] || 0;
    }
  }
  return {
    rows,
    counts,
    frame_count: frameCount,
    total: CROP_MAP_CHART_SERIES.reduce((sum, series) => sum + counts[series.id], 0),
  };
}

function railShortLabel(railName) {
  return String(railName || "").replace("rail_", "R");
}

function chooseRailCropChartGroupSize(rowScreenHeight) {
  if (rowScreenHeight >= 24) return 1;
  if (rowScreenHeight >= 10) return 5;
  const required = Math.ceil(34 / Math.max(1, rowScreenHeight));
  return Math.min(25, Math.max(5, Math.ceil(required / 5) * 5));
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
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="최근 30일간 작물 생육 단계 및 병충해 검출 추이">
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
  if (title) title.textContent = `최근 30일 통합 추이 · 총 ${formatCount(totalCount)}개`;
  sessionLabel.textContent = `세션 검출량 (${cropState.session})`;

  panel.hidden = false;
  if (overview) {
    const shareTotal = Math.max(1, seriesData.reduce((sum, series) => sum + series.value, 0));
    overview.innerHTML = `
      <div class="crop-total-card">
        <span class="crop-overview-label">Total detections</span>
        <strong class="crop-overview-value">${formatCount(totalCount)}</strong>
      </div>
      <div class="crop-risk-card">
        <span class="crop-overview-label">Pest signals</span>
        <strong class="crop-overview-value">${formatCount(pestCount)}</strong>
      </div>
      <div class="crop-share-bar" aria-label="작물 검출 비율">
        ${seriesData.map((series) => `
          <span class="crop-share-segment" title="${series.label} ${formatCount(series.value)}개" style="width:${Math.max(2, (series.value / shareTotal) * 100).toFixed(2)}%;background:${series.color}"></span>
        `).join("")}
      </div>
    `;
  }
  renderMapCropLegend(seriesData);
  stats.innerHTML = "";
  for (const series of seriesData) {
    const card = document.createElement("div");
    card.className = "crop-stat-card";
    card.title = `${series.label} ${formatCount(series.value)}개 · 증감률 ${formatCropDelta(series.deltaPct)}`;
    card.style.borderColor = hexToRgba(series.color, 0.22);
    card.style.background = `${hexToRgba(series.color, 0.07)}`;
    card.innerHTML = `
      <div class="crop-stat-line">
        <div class="crop-stat-main">
          <span class="crop-dot" style="background:${series.color}"></span>
          <span class="crop-stat-label">${series.label}</span>
        </div>
        <div class="crop-stat-metrics">
          <strong class="crop-stat-value">${formatCount(series.value)}개</strong>
          <span class="crop-stat-delta ${cropDeltaClass(series.deltaPct)}">증감률 ${formatCropDelta(series.deltaPct)}</span>
        </div>
      </div>
    `;
    stats.appendChild(card);
  }

  const xLabels = cropState.points.map((point) => {
    if (!point?.date) return "";
    const date = new Date(`${point.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return point.date;
    return date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
  });
  if (cropState.points.length > 0) {
    chart.innerHTML = buildCropTrendSvg(seriesData, xLabels);
  } else {
    chart.innerHTML = `<div class="crop-chart-empty">최근 30일 데이터가 없습니다.</div>`;
  }
  legend.innerHTML = `${seriesData.map((series) => `
    <span class="crop-legend-item">
      <span class="crop-legend-dot" style="background:${series.color}"></span>
      ${series.label} 증감률 ${formatCropDelta(series.deltaPct)}
    </span>
  `).join("")}
    <span class="crop-legend-item is-total">
      <span class="crop-legend-dot is-total"></span>
      전체 작물 증감률 ${formatCropDelta(cropState.deltaPct.total)}
    </span>`;
}

function renderMapCropLegend(seriesData = buildCropSeriesData(getCropPanelState())) {
  const legend = document.getElementById("mapCropLegend");
  if (!legend) return;
  const cropState = getCropPanelState();
  const maturityScore = computeCropMaturityScore(cropState);
  legend.innerHTML = `
    <div class="map-crop-metrics">
      ${seriesData.map((series) => `
        <div class="map-crop-metric" style="--metric-color:${series.color}">
          <span class="map-crop-metric-label">
            <span class="map-crop-metric-dot"></span>
            ${series.label}
          </span>
          <strong>${formatCount(series.value)}</strong>
        </div>
      `).join("")}
    </div>
    <div class="map-maturity-card">
      <span>성숙도</span>
      <strong>${maturityScore == null ? "-" : maturityScore.toFixed(1)}</strong>
    </div>
  `;
}

// ─── Device / session store ──────────────────────────────────────────────────

let allDevicesData = null;        // full /api/devices payload, set in bootstrap
let activeDeviceName = null;      // currently selected device

// ─── Insights store ───────────────────────────────────────────────────────────

let currentCropSummary = null;
let currentInsights = null;
let currentPestDetections = null;
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

function getActiveLayer() {
  if (!currentLayers || !activeLayerId) return null;
  return currentLayers.layers.find((l) => l.id === activeLayerId) || null;
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

function normalizePestDetections(payload, sessionName = "-") {
  const detections = Array.isArray(payload?.detections) ? payload.detections : [];
  return {
    available: Boolean(payload?.available),
    session: payload?.session || sessionName,
    source: payload?.source || null,
    detections: detections
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
      .filter(Boolean),
  };
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

function formatPestMarkerTitle(detection) {
  const bits = [detection.label || "병충해"];
  if (detection.rail_name && detection.odom_x != null) {
    bits.push(`${detection.rail_name} ${detection.odom_x.toFixed(1)}m`);
  }
  if (detection.camera && CAMERA_LABELS[detection.camera]) {
    bits.push(CAMERA_LABELS[detection.camera]);
  }
  if (detection.confidence != null) {
    bits.push(`신뢰도 ${Math.round(detection.confidence * 100)}%`);
  }
  return bits.join(" · ");
}

// ─── TileMap ─────────────────────────────────────────────────────────────────

function computeDetailSheetSize(frame) {
  let maxWidth = 0;
  let maxHeight = 0;
  for (const cameraName of CAMERA_ORDER) {
    const camera = frame.cameras[cameraName];
    if (!camera) continue;
    maxWidth = Math.max(maxWidth, camera.width || 0);
    maxHeight = Math.max(maxHeight, camera.height || 0);
  }
  if (!maxWidth || !maxHeight) return null;
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
  return manifest.max_zoom + Math.log2(detailScale);
}

class TileMap {
  constructor({ container, tilePane, detailPane, annotationPane, markerPane, overlayCanvas, manifest, frames, pestDetections, onSelect, onViewChange, maxZoom }) {
    this.container = container;
    this.tilePane = tilePane;
    this.detailPane = detailPane;
    this.annotationPane = annotationPane;
    this.markerPane = markerPane;
    this.overlayCanvas = overlayCanvas;
    this.ctx = overlayCanvas.getContext("2d");
    this.manifest = manifest;
    this.frames = frames;
    this.framesById = new Map(frames.map((frame) => [String(frame.id), frame]));
    this.railTrackWorldBounds = this.computeRailTrackWorldBounds();
    this.pestDetections = normalizePestDetections(pestDetections, manifest.session_name);
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
    this.detailFadeStartZoom = Math.min(this.maxZoom, manifest.max_zoom + 0.35);
    this.detailFadeSpan = 0.6;
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
    this.renderFrame = 0;
    this.destroyed = false;
    this.handlers = null;
    this.resizeObserver = new ResizeObserver(() => this.queueRender());
    this.resizeObserver.observe(this.container);
    this.bind();
    this.fitToBounds(false);
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    if (this.prefetchTimer) clearTimeout(this.prefetchTimer);
    if (this.renderFrame) {
      cancelAnimationFrame(this.renderFrame);
      this.renderFrame = 0;
    }
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
    this.handlers = {
      wheel: (event) => {
        event.preventDefault();
        const anchor = this.getAnchorFromEvent(event, { preferStored: true });
        const delta = event.deltaY > 0 ? -0.22 : 0.22;
        this.zoomBy(delta, anchor);
      },
      pointerdown: (event) => {
        this.updatePointerAnchor(event);
        this.container.setPointerCapture(event.pointerId);
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
        this.updatePointerAnchor(event);
        if (this.drag && this.drag.id === event.pointerId) {
          const dx = event.clientX - this.drag.lastX;
          const dy = event.clientY - this.drag.lastY;
          this.drag.lastX = event.clientX;
          this.drag.lastY = event.clientY;
          if (Math.abs(event.clientX - this.drag.startX) > 3 || Math.abs(event.clientY - this.drag.startY) > 3) {
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
        if (!this.drag || this.drag.id !== event.pointerId) return;
        const wasClick = !this.drag.moved;
        this.drag = null;
        this.container.classList.remove("is-dragging");
        if (wasClick) {
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

  createDetailFrame(frame) {
    const wrapper = document.createElement("div");
    wrapper.className = "detail-frame";
    wrapper.dataset.frameId = String(frame.id);
    const grid = document.createElement("div");
    grid.className = "detail-grid";
    for (const cameraName of CAMERA_ORDER) {
      const cell = document.createElement("div");
      cell.className = "detail-cell-wrap";
      const camera = frame.cameras[cameraName];
      if (camera) {
        const image = document.createElement("img");
        image.className = "detail-cell";
        image.alt = `${frame.label} ${cameraName}`;
        image.draggable = false;
        image.decoding = "async";
        image.loading = "lazy";
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

  createFrameAnnotation(frame) {
    const wrapper = document.createElement("div");
    wrapper.className = "frame-annotation";
    wrapper.dataset.frameId = String(frame.id);
    const railLabel = document.createElement("div");
    railLabel.className = "frame-annotation-label";
    railLabel.textContent = frame.rail_name;
    wrapper.appendChild(railLabel);
    for (const cameraName of CAMERA_ORDER) {
      const label = document.createElement("div");
      label.className = `frame-camera-label ${CAMERA_LABEL_CORNERS[cameraName] || "is-top-left"}`;
      label.textContent = CAMERA_LABELS[cameraName] || cameraName;
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
    label.textContent = detection.label || "병충해";

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
    for (const frame of this.frames) {
      const rect = frame.rect_px;
      if (rect.right < bounds.left - padding || rect.left > bounds.right + padding) continue;
      if (rect.bottom < bounds.top - padding || rect.top > bounds.bottom + padding) continue;
      wanted.add(frame.id);
      let detail = this.visibleDetails.get(frame.id);
      if (!detail) {
        detail = this.createDetailFrame(frame);
        this.visibleDetails.set(frame.id, detail);
      }
      const topLeft = this.worldToScreen(rect.left, rect.top);
      const bottomRight = this.worldToScreen(rect.right, rect.bottom);
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
    this.onViewChange({
      zoom: this.currentZoom,
      screenPxPerMeter: this.scaleX * this.manifest.layout.px_per_meter_x,
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
    const dpr = window.devicePixelRatio || 1;
    const width = this.viewportWidth;
    const height = this.viewportHeight;
    this.overlayCanvas.width = Math.max(1, Math.floor(width * dpr));
    this.overlayCanvas.height = Math.max(1, Math.floor(height * dpr));
    this.overlayCanvas.style.width = `${width}px`;
    this.overlayCanvas.style.height = `${height}px`;
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
    this.drawRailCropCharts(ctx, width, height);

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

  drawRailCropCharts(ctx, width, height) {
    const rows = getRailCropRows();
    if (!rows.length || !this.manifest?.rails?.length) return;

    const layout = this.manifest.layout;
    const railMap = {};
    for (const rail of this.manifest.rails) railMap[rail.name] = rail;

    const rowScreenHeight = Math.abs(layout.cell_height * this.scaleY);
    const groupSize = chooseRailCropChartGroupSize(rowScreenHeight);
    const chartWidth = clamp(width * 0.18, 150, 220);
    const labelWidth = groupSize === 1 ? 34 : 68;
    const valueWidth = 42;
    const barWidth = Math.max(48, chartWidth - labelWidth - valueWidth - 16);
    const baseX = clamp(54, 48, Math.max(48, width - chartWidth - 18));
    const x = Math.min(baseX, width - chartWidth - 12);

    ctx.save();
    ctx.font = '700 10px "DM Mono", "Noto Sans KR", sans-serif';
    ctx.textBaseline = "middle";

    for (let index = 0; index < rows.length; index += groupSize) {
      const groupRows = rows.slice(index, index + groupSize);
      const firstRail = railMap[groupRows[0]?.rail_name];
      const lastRail = railMap[groupRows[groupRows.length - 1]?.rail_name];
      if (!firstRail || !lastRail) continue;

      const topWorld = layout.margin_y + firstRail.rail_y_m * layout.px_per_meter_y;
      const bottomWorld = layout.margin_y + lastRail.rail_y_m * layout.px_per_meter_y + layout.cell_height;
      const top = this.worldToScreen(this.centerX, topWorld).y;
      const bottom = this.worldToScreen(this.centerX, bottomWorld).y;
      const groupScreenHeight = Math.abs(bottom - top);
      const yCenter = (top + bottom) / 2;
      if (yCenter < -40 || yCenter > height + 40) continue;

      const merged = mergeRailCropRows(groupRows);
      if (merged.total <= 0) continue;

      const chartHeight = groupSize === 1
        ? clamp(rowScreenHeight * 0.52, 15, 24)
        : clamp(groupScreenHeight * 0.36, 18, 28);
      const y = clamp(yCenter - chartHeight / 2, 28, height - chartHeight - 12);
      const radius = 5;

      const label = groupSize === 1 || groupRows.length === 1
        ? railShortLabel(groupRows[0].rail_name)
        : `${railShortLabel(groupRows[0].rail_name)}-${railShortLabel(groupRows[groupRows.length - 1].rail_name)}`;

      ctx.fillStyle = "rgba(8, 13, 10, 0.72)";
      ctx.strokeStyle = "rgba(236, 244, 237, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, chartWidth, chartHeight, radius);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(236, 244, 237, 0.78)";
      ctx.textAlign = "left";
      ctx.fillText(label, x + 8, y + chartHeight / 2);

      const barX = x + labelWidth;
      const barY = y + Math.max(4, chartHeight * 0.28);
      const barH = Math.max(6, chartHeight - Math.max(8, chartHeight * 0.55));
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barH, 3);
      ctx.fill();

      let cursorX = barX;
      for (const series of CROP_MAP_CHART_SERIES) {
        const value = merged.counts[series.id] || 0;
        if (value <= 0) continue;
        const segmentWidth = Math.max(1, (value / merged.total) * barWidth);
        ctx.fillStyle = series.color;
        ctx.globalAlpha = 0.82;
        ctx.fillRect(cursorX, barY, Math.min(segmentWidth, barX + barWidth - cursorX), barH);
        ctx.globalAlpha = 1;
        cursorX += segmentWidth;
        if (cursorX >= barX + barWidth) break;
      }

      ctx.fillStyle = "rgba(154, 173, 159, 0.84)";
      ctx.textAlign = "right";
      ctx.fillText(formatCount(merged.total), x + chartWidth - 8, y + chartHeight / 2);
    }

    ctx.restore();
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

function renderSelection(frame, insights) {
  const pill = document.getElementById("selectionPill");
  const selectionMeta = document.getElementById("selectionMeta");
  const contactSheet = document.getElementById("contactSheet");
  const cameraGrid = document.getElementById("cameraGrid");
  if (!pill || !selectionMeta || !contactSheet || !cameraGrid) return;

  // Show the selection panel
  const selPanel = document.getElementById("selectionPanel");
  if (selPanel) selPanel.hidden = false;
  setRightPanelMode("selection");

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
    const title = createElement("h3", "", CAMERA_LABELS[cameraName] || cameraName);
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
      if (activeLayerId === layer.id && showLayerOverlay) {
        // Turn off
        showLayerOverlay = false;
        activeLayerId = null;
      } else {
        activeLayerId = layer.id;
        showLayerOverlay = true;
      }
      hoveredSegmentId = null;
      showSegmentTooltip(null);
      updateLayerRowStates();
      renderLayerLegend(layer);
      renderLayerSummary(layer);
      currentMap?.queueRender();
    });

    list.appendChild(row);
  }

  updateLayerRowStates();
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
    activeLayerId = task.layer_id;
    showLayerOverlay = true;
    updateLayerRowStates();
    const layer = getActiveLayer();
    renderLayerLegend(layer);
    renderLayerSummary(layer);
    map.queueRender();
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
  activeLayerId = chooseDefaultLayerId(layers);
  showLayerOverlay = Boolean(activeLayerId);
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

  document.getElementById("datasetSummary").textContent =
    `${deviceName} · ${sessionName} · rail ${manifest.summary.rail_count}개 · frame ${manifest.summary.frame_count.toLocaleString()}개`;
  const mapSessionChip = document.getElementById("mapSessionChip");
  if (mapSessionChip) {
    mapSessionChip.textContent = `생육 분석 · ${sessionName}`;
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
  const map = new TileMap({
    container: document.getElementById("mapViewport"),
    tilePane: document.getElementById("tilePane"),
    detailPane: document.getElementById("detailPane"),
    annotationPane: document.getElementById("annotationPane"),
    markerPane: document.getElementById("markerPane"),
    overlayCanvas: document.getElementById("overlayCanvas"),
    manifest,
    frames,
    pestDetections: currentPestDetections,
    maxZoom: computeViewerMaxZoom(manifest, frames),
    onSelect: (frame) => renderSelection(frame, currentInsightsData),
    onViewChange: ({ zoom, screenPxPerMeter }) => {
      zoomValue.textContent = formatZoom(zoom);
      scaleValue.textContent = screenPxPerMeter > 0 ? `${(1 / screenPxPerMeter).toFixed(3)} m/px` : "-";
    },
  });
  currentMap = map;

  renderAlertPanel(insights, map);
  renderLayersPanel(layers);
  renderLayerLegend(getActiveLayer());
  renderLayerSummary(getActiveLayer());
  renderTaskPanel(tasks, map);
  // Reset selection tabs
  selActiveTab = "info";
  switchSelTab("info");
  const trendTabBtn = document.getElementById("trendTabBtn");
  if (trendTabBtn) trendTabBtn.disabled = true;

  if (frames[0]) {
    map.selectedFrameId = frames[0].id;
    map.queueRender();
    renderSelection(frames[0], insights);
    setRightPanelMode("tasks");
  }

  return map;
}

// ─── Device/Session selectors ─────────────────────────────────────────────────

function renderDeviceTabs(devicesData, onSelect) {
  const tabsEl = document.getElementById("deviceTabs");
  tabsEl.innerHTML = "";

  const select = document.createElement("select");
  select.className = "device-select";
  for (const device of devicesData) {
    const opt = document.createElement("option");
    opt.value = device.name;
    opt.textContent = device.name;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => onSelect(select.value));
  tabsEl.appendChild(select);
}

function renderSessionList(sessions, activeDevice, onSelect) {
  const listEl = document.getElementById("sessionList");
  listEl.innerHTML = "";

  // 최신 세션이 상단에 오도록 내림차순 정렬
  const sorted = [...sessions].sort((a, b) => b.name.localeCompare(a.name));

  for (const session of sorted) {
    const btn = createElement("button", "session-chip");
    btn.dataset.session = session.name;
    const name = createElement("strong", "", session.name);
    const meta = createElement("span", "", `rail ${session.rail_count} · ${session.frame_count.toLocaleString()}`);
    btn.append(name, meta);
    btn.addEventListener("click", () => onSelect(activeDevice, session.name, btn));
    listEl.appendChild(btn);
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  const summary = document.getElementById("datasetSummary");
  renderCropPanel();
  initInspectorTabs();
  initMapControls();

  let devicesData;
  try {
    const payload = await fetchJson("/api/devices");
    devicesData = payload.devices;
    allDevicesData = devicesData;
  } catch (err) {
    summary.textContent = `초기화 실패: ${err instanceof Error ? err.message : String(err)}`;
    return;
  }

  if (!devicesData || devicesData.length === 0) {
    summary.textContent = "사용 가능한 세션이 없습니다.";
    return;
  }

  let activeDevice = devicesData[0].name;
  activeDeviceName = activeDevice;
  let activeSessionBtn = null;

  function selectDevice(deviceName) {
    activeDevice = deviceName;
    activeDeviceName = deviceName;
    // 콤보박스 값 동기화
    const sel = document.querySelector(".device-select");
    if (sel && sel.value !== deviceName) sel.value = deviceName;
    const device = devicesData.find((d) => d.name === deviceName);
    renderSessionList(device.sessions, deviceName, selectSession);
    if (activeSessionBtn) activeSessionBtn.classList.remove("is-active");
    activeSessionBtn = null;
  }

  async function selectSession(deviceName, sessionName, btn) {
    const loadToken = ++currentSessionLoadToken;
    if (activeSessionBtn) activeSessionBtn.classList.remove("is-active");
    activeSessionBtn = btn;
    btn.classList.add("is-active");
    currentCropSummary = buildCropPanelPlaceholder(sessionName);
    currentPestDetections = normalizePestDetections(null, sessionName);
    selectedPestDetectionId = null;
    renderCropPanel(currentCropSummary);
    summary.textContent = `${deviceName}/${sessionName} 로딩 중...`;
    try {
      await loadSession(deviceName, sessionName, loadToken);
    } catch (err) {
      if (loadToken !== currentSessionLoadToken) return;
      summary.textContent = `로드 실패: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  renderDeviceTabs(devicesData, selectDevice);
  selectDevice(activeDevice);

  const firstDevice = devicesData[0];
  if (firstDevice.sessions.length > 0 && currentSessionLoadToken === 0) {
    const firstSession = firstDevice.sessions[firstDevice.sessions.length - 1];
    const firstBtn = document.querySelector(`.session-chip[data-session="${firstSession.name}"]`);
    if (firstBtn) await selectSession(firstDevice.name, firstSession.name, firstBtn);
  }

  const fitButton = document.getElementById("fitButton");
  if (fitButton) fitButton.addEventListener("click", () => currentMap?.fitToBounds());

  // toggleLayersButton은 HTML에서 제거됨 (우측 패널로 이동) — 없으면 skip
  const toggleLayersBtn = document.getElementById("toggleLayersButton");
  if (toggleLayersBtn) {
    toggleLayersBtn.addEventListener("click", () => {
      if (!currentLayersData) return;
      if (!showLayerOverlay) {
        if (!activeLayerId && currentLayersData.layers?.length) {
          activeLayerId = currentLayersData.layers[0].id;
        }
        showLayerOverlay = true;
      } else {
        showLayerOverlay = false;
      }
      hoveredSegmentId = null;
      showSegmentTooltip(null);
      updateLayerRowStates();
      const layer = getActiveLayer();
      renderLayerLegend(layer);
      renderLayerSummary(layer);
      currentMap?.queueRender();
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
    `초기화 실패: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
});
