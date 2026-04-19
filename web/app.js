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
        if (!this.drag || this.drag.id !== event.pointerId) return;
        const dx = event.clientX - this.drag.lastX;
        const dy = event.clientY - this.drag.lastY;
        this.drag.lastX = event.clientX;
        this.drag.lastY = event.clientY;
        if (Math.abs(event.clientX - this.drag.startX) > 3 || Math.abs(event.clientY - this.drag.startY) > 3) {
          this.drag.moved = true;
        }
        this.panBy(dx, dy);
      },
      endPointer: (event) => {
        if (!this.drag || this.drag.id !== event.pointerId) return;
        const wasClick = !this.drag.moved;
        this.drag = null;
        this.container.classList.remove("is-dragging");
        if (wasClick) {
          const rect = this.container.getBoundingClientRect();
          const world = this.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
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

// ─── Session loading ──────────────────────────────────────────────────────────

let currentMap = null;
let currentSessionLoadToken = 0;
let currentInsightsData = null;

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
