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

// ─── Insights store ───────────────────────────────────────────────────────────

let currentInsights = null;
let showRiskOverlay = true;

// ─── Layer store ──────────────────────────────────────────────────────────────

let currentLayers = null;          // full layers.json payload
let activeLayerId = null;          // which layer is rendered on map
let showLayerOverlay = false;      // overlay on/off
let hoveredSegmentId = null;
let selectedSegmentId = null;

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
  constructor({ container, tilePane, detailPane, annotationPane, overlayCanvas, manifest, frames, onSelect, onViewChange, maxZoom }) {
    this.container = container;
    this.tilePane = tilePane;
    this.detailPane = detailPane;
    this.annotationPane = annotationPane;
    this.overlayCanvas = overlayCanvas;
    this.ctx = overlayCanvas.getContext("2d");
    this.manifest = manifest;
    this.frames = frames;
    this.onSelect = onSelect;
    this.onViewChange = onViewChange;
    this.visibleTiles = new Map();
    this.visibleDetails = new Map();
    this.visibleAnnotations = new Map();
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
    this.visibleTiles.clear();
    this.visibleDetails.clear();
    this.visibleAnnotations.clear();
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
            this.selectedFrameId = picked.id;
            this.onSelect(picked);
            this.queueRender();
          }
        }
      },
      pointerleave: () => {
        if (!this.drag) this.pointerAnchor = null;
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
    this.drawOverlay();
    this.onViewChange({
      zoom: this.currentZoom,
      screenPxPerMeter: this.scaleY * this.manifest.layout.px_per_meter_y,
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

    // ── Rail separators + risk highlight ──────────────────────────────────────
    for (const rail of rails) {
      const ri = this._getRailInsight(rail.name);
      const x = this.manifest.layout.margin_x + rail.rail_y_m * this.manifest.layout.px_per_meter_x + this.manifest.layout.cell_width / 2;
      const screen = this.worldToScreen(x, this.centerY);
      if (screen.x < -80 || screen.x > width + 80) continue;

      if (showRiskOverlay && ri) {
        const priority = ri.priority_score || 0;
        if (priority >= 40) {
          ctx.fillStyle = `rgba(220, 60, 40, ${Math.min(0.18, priority / 300)})`;
          const railScreenLeft = this.worldToScreen(
            this.manifest.layout.margin_x + rail.rail_y_m * this.manifest.layout.px_per_meter_x,
            0,
          ).x;
          const railScreenRight = this.worldToScreen(
            this.manifest.layout.margin_x + rail.rail_y_m * this.manifest.layout.px_per_meter_x + this.manifest.layout.cell_width,
            0,
          ).x;
          ctx.fillRect(railScreenLeft, 0, railScreenRight - railScreenLeft, height);
        } else if (priority >= 20) {
          ctx.fillStyle = `rgba(220, 140, 40, ${Math.min(0.12, priority / 300)})`;
          const railScreenLeft = this.worldToScreen(
            this.manifest.layout.margin_x + rail.rail_y_m * this.manifest.layout.px_per_meter_x,
            0,
          ).x;
          const railScreenRight = this.worldToScreen(
            this.manifest.layout.margin_x + rail.rail_y_m * this.manifest.layout.px_per_meter_x + this.manifest.layout.cell_width,
            0,
          ).x;
          ctx.fillRect(railScreenLeft, 0, railScreenRight - railScreenLeft, height);
        }
      }

      ctx.strokeStyle = "rgba(20, 63, 49, 0.18)";
      ctx.fillStyle = "rgba(20, 63, 49, 0.8)";
      ctx.lineWidth = 1;
      ctx.font = '12px "IBM Plex Sans KR", sans-serif';
      ctx.beginPath();
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x, height);
      ctx.stroke();
      if (scale > 0.1) {
        ctx.fillText(rail.name.replace("rail_", "R"), screen.x - 12, 18);
      }
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
    const screenPxPerMeter = this.scaleY * this.manifest.layout.px_per_meter_y;
    const tickStep = chooseTickStep(screenPxPerMeter);
    const firstMeter = Math.floor(this.manifest.world.odom_x_min / tickStep) * tickStep;
    const lastMeter = this.manifest.world.odom_x_max + tickStep;
    ctx.strokeStyle = "rgba(185, 105, 53, 0.18)";
    ctx.fillStyle = "rgba(185, 105, 53, 0.9)";
    ctx.font = '12px "IBM Plex Sans KR", sans-serif';
    for (let meter = firstMeter; meter <= lastMeter; meter += tickStep) {
      const worldY = this.manifest.layout.margin_y + (meter - this.manifest.world.odom_x_min) * this.manifest.layout.px_per_meter_y;
      const screen = this.worldToScreen(this.centerX, worldY);
      if (screen.y < -40 || screen.y > height + 40) continue;
      ctx.beginPath();
      ctx.moveTo(0, screen.y);
      ctx.lineTo(width, screen.y);
      ctx.stroke();
      ctx.fillText(`${meter.toFixed(1)}m`, 10, screen.y - 6);
    }

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

      // World-space left/right of this rail's cell column
      const railLeft = layout.margin_x + rail.rail_y_m * layout.px_per_meter_x;
      const railRight = railLeft + layout.cell_width;

      // World-space top/bottom for this segment
      const segTop = layout.margin_y + (item.start_m - world.odom_x_min) * layout.px_per_meter_y;
      const segBottom = layout.margin_y + (item.end_m - world.odom_x_min) * layout.px_per_meter_y;

      const tl = this.worldToScreen(railLeft, segTop);
      const br = this.worldToScreen(railRight, segBottom);

      if (br.x < 0 || tl.x > width || br.y < 0 || tl.y > height) continue;

      const sw = br.x - tl.x;
      const sh = br.y - tl.y;
      if (sw < 1 || sh < 1) continue;

      // Low confidence → draw with hatch pattern feel (lower opacity)
      const opacityMod = item.confidence < 0.6 ? 0.55 : 1.0;

      ctx.save();
      ctx.globalAlpha = opacityMod;

      // Fill
      ctx.fillStyle = colorFn(item.value);
      ctx.fillRect(tl.x, tl.y, sw, sh);

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
      const railLeft = layout.margin_x + rail.rail_y_m * layout.px_per_meter_x;
      const railRight = railLeft + layout.cell_width;
      const segTop = layout.margin_y + (item.start_m - world.odom_x_min) * layout.px_per_meter_y;
      const segBottom = layout.margin_y + (item.end_m - world.odom_x_min) * layout.px_per_meter_y;
      if (worldX >= railLeft && worldX <= railRight && worldY >= segTop && worldY <= segBottom) {
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

// ─── Ops summary rendering ───────────────────────────────────────────────────

function renderOpsSummary(insights) {
  const panel = document.getElementById("opsPanel");
  const badge = document.getElementById("opsBadge");

  if (!insights || !insights.available) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  const s = insights.session;
  badge.textContent = s.source || "heuristic";
  badge.className = `source-badge ${s.source === "heuristic" ? "source-heuristic" : "source-external"}`;

  function setStat(id, value, cls) {
    const el = document.getElementById(id);
    const valEl = el.querySelector(".ops-stat-value");
    valEl.textContent = value;
    el.className = `ops-stat ${cls || ""}`;
  }

  setStat("statHealth", `${s.health_score}`, s.health_score >= 85 ? "stat-good" : s.health_score >= 60 ? "stat-warn" : "stat-bad");
  setStat("statAlerts", s.alert_count, s.alert_count === 0 ? "stat-good" : s.alert_count <= 3 ? "stat-warn" : "stat-bad");
  setStat("statPriorityRails", s.priority_rail_count, s.priority_rail_count === 0 ? "stat-good" : "stat-warn");
  setStat("statGaps", s.gap_count, s.gap_count === 0 ? "stat-good" : "stat-warn");

  const deltaRow = document.getElementById("deltaRow");
  const delta = s.delta;
  if (delta && delta.compared_session) {
    deltaRow.hidden = false;
    const dH = delta.health_score;
    const deltaHealth = document.getElementById("deltaHealth");
    deltaHealth.textContent = dH >= 0 ? `+${dH}점` : `${dH}점`;
    deltaHealth.className = `delta-value ${dH >= 0 ? "delta-pos" : "delta-neg"}`;
    document.getElementById("deltaCompared").textContent = delta.compared_session;
  } else {
    deltaRow.hidden = true;
  }
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
}

// ─── Report rendering ─────────────────────────────────────────────────────────

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
  if (!item) {
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

// ─── Quick summary (ops panel integration) ───────────────────────────────────

function renderLayerQuickSummary(layers) {
  if (!layers) return;

  const apLayer = layers.layers?.find((l) => l.id === "action_priority");
  const dpLayer = layers.layers?.find((l) => l.id === "disease_pest_risk");
  const drLayer = layers.layers?.find((l) => l.id === "data_reliability");

  const highActionCount = apLayer?.items.filter((i) => i.severity === "high").length ?? 0;
  const highDiseaseCount = dpLayer?.items.filter((i) => i.severity === "high").length ?? 0;
  const dataGapCount = drLayer?.items.filter((i) => i.severity !== "low").length ?? 0;
  const priorityRails = new Set(
    (apLayer?.items || []).filter((i) => i.severity !== "low").map((i) => i.rail_name)
  ).size;

  // Update existing ops stats if panel is hidden (no insights), else add layer summary
  const opsPanel = document.getElementById("opsPanel");
  let layerOpsPanel = document.getElementById("layerOpsPanel");

  if (!layerOpsPanel) {
    layerOpsPanel = document.createElement("section");
    layerOpsPanel.className = "panel panel-ops panel-layer-ops";
    layerOpsPanel.id = "layerOpsPanel";
    layerOpsPanel.innerHTML = `
      <div class="panel-head">
        <h2>빠른 현황 요약</h2>
        <span class="demo-badge">DEMO</span>
      </div>
      <div class="ops-grid" id="layerOpsGrid"></div>
    `;
    opsPanel.parentElement.insertBefore(layerOpsPanel, opsPanel.nextSibling);
  }

  layerOpsPanel.hidden = false;
  const grid = document.getElementById("layerOpsGrid");
  grid.innerHTML = "";

  const stats = [
    { id: "statHighAction", value: highActionCount, label: "즉시조치", cls: highActionCount > 0 ? "stat-bad" : "stat-good" },
    { id: "statPriorityRailsL", value: priorityRails, label: "우선 Rail", cls: priorityRails > 0 ? "stat-warn" : "stat-good" },
    { id: "statHighDisease", value: highDiseaseCount, label: "병충해↑", cls: highDiseaseCount > 0 ? "stat-bad" : "stat-good" },
    { id: "statDataGap", value: dataGapCount, label: "데이터이상", cls: dataGapCount > 0 ? "stat-warn" : "stat-good" },
  ];

  for (const s of stats) {
    const stat = document.createElement("div");
    stat.className = `ops-stat ${s.cls}`;
    stat.id = s.id;
    const val = createElement("span", "ops-stat-value", String(s.value));
    const lbl = createElement("span", "ops-stat-label", s.label);
    stat.append(val, lbl);
    grid.appendChild(stat);
  }
}

// ─── Session loading ──────────────────────────────────────────────────────────

let currentMap = null;
let currentSessionLoadToken = 0;
let currentInsightsData = null;
let currentLayersData = null;

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
  currentLayers = layers;
  currentLayersData = layers;
  // Reset layer state for new session
  activeLayerId = null;
  showLayerOverlay = false;
  selectedSegmentId = null;
  hoveredSegmentId = null;

  document.getElementById("datasetSummary").textContent =
    `${deviceName} · ${sessionName} · rail ${manifest.summary.rail_count}개 · frame ${manifest.summary.frame_count.toLocaleString()}개`;

  if (currentMap) {
    currentMap.destroy();
    currentMap = null;
  }

  document.getElementById("tilePane").innerHTML = "";
  document.getElementById("detailPane").innerHTML = "";
  document.getElementById("annotationPane").innerHTML = "";
  document.getElementById("selectionPill").textContent = "none";
  document.getElementById("selectionMeta").innerHTML = "<p>지도를 클릭하면 해당 위치의 4카메라 프레임을 볼 수 있습니다.</p>";
  document.getElementById("selectionInsights").hidden = true;
  document.getElementById("contactSheet").hidden = true;
  document.getElementById("cameraGrid").innerHTML = "";

  const zoomValue = document.getElementById("zoomValue");
  const scaleValue = document.getElementById("scaleValue");
  const map = new TileMap({
    container: document.getElementById("mapViewport"),
    tilePane: document.getElementById("tilePane"),
    detailPane: document.getElementById("detailPane"),
    annotationPane: document.getElementById("annotationPane"),
    overlayCanvas: document.getElementById("overlayCanvas"),
    manifest,
    frames,
    maxZoom: computeViewerMaxZoom(manifest, frames),
    onSelect: (frame) => renderSelection(frame, currentInsightsData),
    onViewChange: ({ zoom, screenPxPerMeter }) => {
      zoomValue.textContent = formatZoom(zoom);
      scaleValue.textContent = screenPxPerMeter > 0 ? `${(1 / screenPxPerMeter).toFixed(3)} m/px` : "-";
    },
  });
  currentMap = map;

  renderOpsSummary(insights);
  renderAlertPanel(insights, map);
  renderRailList(manifest, frames, map, insights);
  renderLayersPanel(layers);
  renderLayerQuickSummary(layers);
  // Hide segment detail panel on new session
  document.getElementById("segmentDetail").hidden = true;
  document.getElementById("segmentTooltip").hidden = true;

  if (frames[0]) {
    map.selectedFrameId = frames[0].id;
    map.queueRender();
    renderSelection(frames[0], insights);
  }

  return map;
}

// ─── Device/Session selectors ─────────────────────────────────────────────────

function renderDeviceTabs(devicesData, onSelect) {
  const tabsEl = document.getElementById("deviceTabs");
  tabsEl.innerHTML = "";
  for (const device of devicesData) {
    const btn = createElement("button", "device-tab", device.name);
    btn.dataset.device = device.name;
    btn.addEventListener("click", () => onSelect(device.name));
    tabsEl.appendChild(btn);
  }
}

function renderSessionList(sessions, activeDevice, onSelect) {
  const listEl = document.getElementById("sessionList");
  listEl.innerHTML = "";
  for (const session of sessions) {
    const btn = createElement("button", "session-chip");
    btn.dataset.session = session.name;
    const name = createElement("strong", "", session.name);
    const meta = createElement("span", "", `rail ${session.rail_count} · ${session.frame_count.toLocaleString()} frames`);
    btn.append(name, meta);
    btn.addEventListener("click", () => onSelect(activeDevice, session.name, btn));
    listEl.appendChild(btn);
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  const summary = document.getElementById("datasetSummary");

  let devicesData;
  try {
    const payload = await fetchJson("/api/devices");
    devicesData = payload.devices;
  } catch (err) {
    summary.textContent = `초기화 실패: ${err instanceof Error ? err.message : String(err)}`;
    return;
  }

  if (!devicesData || devicesData.length === 0) {
    summary.textContent = "사용 가능한 세션이 없습니다.";
    return;
  }

  let activeDevice = devicesData[0].name;
  let activeSessionBtn = null;

  function selectDevice(deviceName) {
    activeDevice = deviceName;
    for (const tab of document.querySelectorAll(".device-tab")) {
      tab.classList.toggle("is-active", tab.dataset.device === deviceName);
    }
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

  document.getElementById("fitButton").addEventListener("click", () => currentMap?.fitToBounds());
  document.getElementById("zoomInButton").addEventListener("click", () => {
    currentMap?.zoomBy(0.5, { x: currentMap.viewportWidth / 2, y: currentMap.viewportHeight / 2 });
  });
  document.getElementById("zoomOutButton").addEventListener("click", () => {
    currentMap?.zoomBy(-0.5, { x: currentMap.viewportWidth / 2, y: currentMap.viewportHeight / 2 });
  });
  document.getElementById("reloadButton").addEventListener("click", () => window.location.reload());

  document.getElementById("toggleOverlayButton").addEventListener("click", () => {
    showRiskOverlay = !showRiskOverlay;
    const btn = document.getElementById("toggleOverlayButton");
    btn.classList.toggle("is-active", showRiskOverlay);
    currentMap?.queueRender();
  });
  // Default: overlay on
  document.getElementById("toggleOverlayButton").classList.add("is-active");

  document.getElementById("toggleLayersButton").addEventListener("click", () => {
    if (!currentLayersData) return;
    if (!showLayerOverlay) {
      // Turn on first available layer
      if (!activeLayerId && currentLayersData.layers?.length) {
        activeLayerId = currentLayersData.layers[0].id;
      }
      showLayerOverlay = true;
    } else {
      showLayerOverlay = false;
    }
    updateLayerRowStates();
    const layer = getActiveLayer();
    renderLayerLegend(layer);
    renderLayerSummary(layer);
    currentMap?.queueRender();
  });

  document.getElementById("reportButton").addEventListener("click", () => {
    openReport(currentInsightsData);
  });
  document.getElementById("reportClose").addEventListener("click", closeReport);
  document.getElementById("reportBackdrop").addEventListener("click", closeReport);
  document.getElementById("printButton").addEventListener("click", () => window.print());
}

bootstrap().catch((error) => {
  document.getElementById("datasetSummary").textContent =
    `초기화 실패: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
});
