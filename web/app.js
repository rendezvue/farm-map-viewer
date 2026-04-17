const CAMERA_ORDER = ["front_left", "front_right", "rear", "side"];
const CAMERA_LABELS = {
  front_left: "Front Left",
  front_right: "Front Right",
  rear: "Rear",
  side: "Side",
};

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

class TileMap {
  constructor({ container, tilePane, overlayCanvas, manifest, frames, onSelect, onViewChange }) {
    this.container = container;
    this.tilePane = tilePane;
    this.overlayCanvas = overlayCanvas;
    this.ctx = overlayCanvas.getContext("2d");
    this.manifest = manifest;
    this.frames = frames;
    this.onSelect = onSelect;
    this.onViewChange = onViewChange;
    this.visibleTiles = new Map();
    this.selectedFrameId = null;
    this.currentZoom = clamp(manifest.max_zoom - 3, manifest.min_zoom, manifest.max_zoom);
    this.centerX = manifest.image_width / 2;
    this.centerY = manifest.image_height / 2;
    this.pointerAnchor = null;
    this.drag = null;
    this.renderQueued = false;
    this.resizeObserver = new ResizeObserver(() => this.queueRender());
    this.resizeObserver.observe(this.container);
    this.bind();
    this.fitToBounds(false);
  }

  destroy() {
    this.resizeObserver.disconnect();
  }

  bind() {
    this.container.addEventListener("wheel", (event) => {
      event.preventDefault();
      const anchor = this.getAnchorFromEvent(event, { preferStored: true });
      const delta = event.deltaY > 0 ? -0.22 : 0.22;
      this.zoomBy(delta, anchor);
    }, { passive: false });

    this.container.addEventListener("pointerdown", (event) => {
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
    });

    this.container.addEventListener("pointerenter", (event) => {
      this.updatePointerAnchor(event);
    });

    this.container.addEventListener("pointermove", (event) => {
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
    });

    const endPointer = (event) => {
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
    };

    this.container.addEventListener("pointerup", endPointer);
    this.container.addEventListener("pointercancel", endPointer);
    this.container.addEventListener("pointerleave", () => {
      if (!this.drag) this.pointerAnchor = null;
    });
    this.container.addEventListener("dblclick", (event) => {
      const anchor = this.getAnchorFromEvent(event, { preferStored: true });
      this.zoomBy(0.7, anchor);
    });
  }

  get viewportWidth() {
    return this.container.clientWidth;
  }

  get viewportHeight() {
    return this.container.clientHeight;
  }

  get baseScale() {
    return 2 ** (this.currentZoom - this.manifest.max_zoom);
  }

  fitToBounds(render = true) {
    const scaleX = this.viewportWidth / this.manifest.image_width;
    const scaleY = this.viewportHeight / this.manifest.image_height;
    const fitScale = Math.min(scaleX, scaleY) * 0.94;
    this.currentZoom = clamp(
      this.manifest.max_zoom + Math.log2(fitScale),
      this.manifest.min_zoom,
      this.manifest.max_zoom,
    );
    this.centerX = this.manifest.image_width / 2;
    this.centerY = this.manifest.image_height / 2;
    if (render) this.queueRender();
    else this.render();
  }

  focusFrame(frame) {
    const rect = frame.rect_px;
    this.centerX = rect.center_x;
    this.centerY = rect.center_y;
    this.selectedFrameId = frame.id;
    this.currentZoom = clamp(Math.max(this.currentZoom, this.manifest.max_zoom - 1.2), this.manifest.min_zoom, this.manifest.max_zoom);
    this.queueRender();
  }

  updatePointerAnchor(event) {
    const rect = this.container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return this.pointerAnchor;
    this.pointerAnchor = {
      x: clamp(x, 0, rect.width),
      y: clamp(y, 0, rect.height),
    };
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
    this.currentZoom = clamp(this.currentZoom + delta, this.manifest.min_zoom, this.manifest.max_zoom);
    const scale = this.baseScale;
    this.centerX = before.x - (anchor.x - this.viewportWidth / 2) / scale;
    this.centerY = before.y - (anchor.y - this.viewportHeight / 2) / scale;
    this.queueRender();
  }

  panBy(dx, dy) {
    const scale = this.baseScale;
    this.centerX -= dx / scale;
    this.centerY -= dy / scale;
    this.clampCenter();
    this.queueRender();
  }

  clampCenter() {
    const scale = this.baseScale;
    const halfW = this.viewportWidth / (2 * scale);
    const halfH = this.viewportHeight / (2 * scale);
    if (this.manifest.image_width > halfW * 2) {
      this.centerX = clamp(this.centerX, halfW, this.manifest.image_width - halfW);
    }
    if (this.manifest.image_height > halfH * 2) {
      this.centerY = clamp(this.centerY, halfH, this.manifest.image_height - halfH);
    }
  }

  queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  worldToScreen(x, y) {
    const scale = this.baseScale;
    return {
      x: (x - this.centerX) * scale + this.viewportWidth / 2,
      y: (y - this.centerY) * scale + this.viewportHeight / 2,
    };
  }

  screenToWorld(x, y) {
    const scale = this.baseScale;
    return {
      x: (x - this.viewportWidth / 2) / scale + this.centerX,
      y: (y - this.viewportHeight / 2) / scale + this.centerY,
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
        if (centerDist < bestInsideDistance) {
          bestInsideDistance = centerDist;
          bestInside = frame;
        }
      } else if (dist < threshold && dist < bestNearDistance) {
        bestNearDistance = dist;
        bestNear = frame;
      }
    }
    return bestInside || bestNear;
  }

  render() {
    const tileZoom = clamp(Math.round(this.currentZoom), this.manifest.min_zoom, this.manifest.max_zoom);
    const tileScale = 2 ** (this.currentZoom - tileZoom);
    const tileWorldSize = this.manifest.tile_size * 2 ** (this.manifest.max_zoom - tileZoom);
    const zoomDims = this.manifest.zoom_dimensions[String(tileZoom)];
    const leftWorld = this.centerX - this.viewportWidth / (2 * this.baseScale);
    const topWorld = this.centerY - this.viewportHeight / (2 * this.baseScale);
    const rightWorld = this.centerX + this.viewportWidth / (2 * this.baseScale);
    const bottomWorld = this.centerY + this.viewportHeight / (2 * this.baseScale);
    const tx0 = clamp(Math.floor(leftWorld / tileWorldSize), 0, zoomDims.tiles_x - 1);
    const ty0 = clamp(Math.floor(topWorld / tileWorldSize), 0, zoomDims.tiles_y - 1);
    const tx1 = clamp(Math.floor(rightWorld / tileWorldSize), 0, zoomDims.tiles_x - 1);
    const ty1 = clamp(Math.floor(bottomWorld / tileWorldSize), 0, zoomDims.tiles_y - 1);
    const wanted = new Set();

    for (let ty = ty0; ty <= ty1; ty += 1) {
      for (let tx = tx0; tx <= tx1; tx += 1) {
        const key = `${tileZoom}/${tx}/${ty}`;
        wanted.add(key);
        let tile = this.visibleTiles.get(key);
        if (!tile) {
          tile = document.createElement("img");
          tile.className = "map-tile";
          tile.alt = "";
          tile.draggable = false;
          tile.src = this.manifest.tile_url_template
            .replace("{z}", String(tileZoom))
            .replace("{x}", String(tx))
            .replace("{y}", String(ty));
          this.visibleTiles.set(key, tile);
          this.tilePane.appendChild(tile);
        }
        const worldLeft = tx * tileWorldSize;
        const worldTop = ty * tileWorldSize;
        const screen = this.worldToScreen(worldLeft, worldTop);
        tile.style.transform = `translate(${screen.x}px, ${screen.y}px) scale(${tileScale})`;
      }
    }

    for (const [key, tile] of this.visibleTiles.entries()) {
      if (wanted.has(key)) continue;
      tile.remove();
      this.visibleTiles.delete(key);
    }

    this.drawOverlay();
    this.onViewChange({
      zoom: this.currentZoom,
      screenPxPerMeter: this.baseScale * this.manifest.layout.px_per_meter_y,
    });
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
    ctx.strokeStyle = "rgba(20, 63, 49, 0.18)";
    ctx.fillStyle = "rgba(20, 63, 49, 0.8)";
    ctx.lineWidth = 1;
    ctx.font = '12px "IBM Plex Sans KR", sans-serif';

    for (const rail of rails) {
      const x = this.manifest.layout.margin_x + rail.rail_y_m * this.manifest.layout.px_per_meter_x + this.manifest.layout.cell_width / 2;
      const screen = this.worldToScreen(x, this.centerY);
      if (screen.x < -80 || screen.x > width + 80) continue;
      ctx.beginPath();
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x, height);
      ctx.stroke();
      if (scale > 0.1) {
        ctx.fillText(rail.name.replace("rail_", "R"), screen.x - 12, 18);
      }
    }

    const screenPxPerMeter = scale * this.manifest.layout.px_per_meter_y;
    const tickStep = chooseTickStep(screenPxPerMeter);
    const firstMeter = Math.floor(this.manifest.world.odom_x_min / tickStep) * tickStep;
    const lastMeter = this.manifest.world.odom_x_max + tickStep;
    ctx.strokeStyle = "rgba(185, 105, 53, 0.18)";
    ctx.fillStyle = "rgba(185, 105, 53, 0.9)";
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

    if (this.selectedFrameId != null) {
      const frame = this.frames.find((item) => item.id === this.selectedFrameId);
      if (frame) {
        const rect = frame.rect_px;
        const topLeft = this.worldToScreen(rect.left, rect.top);
        const screenW = rect.width * scale;
        const screenH = rect.height * scale;
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

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${path}`);
  }
  return response.json();
}

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

function renderSelection(frame) {
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

function renderRailList(manifest, frames, map) {
  const railList = document.getElementById("railList");
  railList.innerHTML = "";
  for (const rail of manifest.rails) {
    const button = createElement("button", "rail-chip");
    button.dataset.railName = rail.name;
    const title = createElement("strong", "", rail.name);
    const meta = createElement("span", "", `${rail.frame_count} frames`);
    button.append(title, meta);
    button.addEventListener("click", () => {
      const frame = frames.find((item) => item.rail_name === rail.name);
      if (!frame) return;
      map.focusFrame(frame);
      renderSelection(frame);
    });
    railList.appendChild(button);
  }
}

async function bootstrap() {
  const manifest = await fetchJson("/api/manifest");
  const framePayload = await fetchJson("/api/frames");
  const frames = framePayload.items;

  document.getElementById("datasetSummary").textContent =
    `${manifest.dataset_name} · rail ${manifest.summary.rail_count}개 · frame ${manifest.summary.frame_count.toLocaleString()}개`;

  const zoomValue = document.getElementById("zoomValue");
  const scaleValue = document.getElementById("scaleValue");
  const map = new TileMap({
    container: document.getElementById("mapViewport"),
    tilePane: document.getElementById("tilePane"),
    overlayCanvas: document.getElementById("overlayCanvas"),
    manifest,
    frames,
    onSelect: (frame) => renderSelection(frame),
    onViewChange: ({ zoom, screenPxPerMeter }) => {
      zoomValue.textContent = formatZoom(zoom);
      scaleValue.textContent = screenPxPerMeter > 0 ? `${(1 / screenPxPerMeter).toFixed(3)} m/px` : "-";
    },
  });

  renderRailList(manifest, frames, map);

  document.getElementById("fitButton").addEventListener("click", () => map.fitToBounds());
  document.getElementById("zoomInButton").addEventListener("click", () => {
    map.zoomBy(0.5, { x: map.viewportWidth / 2, y: map.viewportHeight / 2 });
  });
  document.getElementById("zoomOutButton").addEventListener("click", () => {
    map.zoomBy(-0.5, { x: map.viewportWidth / 2, y: map.viewportHeight / 2 });
  });
  document.getElementById("reloadButton").addEventListener("click", () => window.location.reload());

  if (frames[0]) {
    map.selectedFrameId = frames[0].id;
    map.queueRender();
    renderSelection(frames[0]);
  }
}

bootstrap().catch((error) => {
  const summary = document.getElementById("datasetSummary");
  summary.textContent = `초기화 실패: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
});
