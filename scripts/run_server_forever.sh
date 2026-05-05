#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/logs}"
LOG_FILE="${LOG_FILE:-$LOG_DIR/farm-map-viewer-server.log}"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8090}"
DB_ROOT="${DB_ROOT:-/mnt/nas_rdv_md3/uv_camera_db}"
BUILD_ROOT="${BUILD_ROOT:-$ROOT_DIR/build}"
SCAN_INTERVAL="${SCAN_INTERVAL:-99999}"
RAIL_SPACING="${RAIL_SPACING:-3.0}"
CELL_WIDTH="${CELL_WIDTH:-320}"
CELL_HEIGHT="${CELL_HEIGHT:-180}"
GAP_Y="${GAP_Y:-264}"
RAIL_TRACK_MARGIN_Y="${RAIL_TRACK_MARGIN_Y:-90}"
RAIL_TRACK_MIN_TILE_HEIGHT="${RAIL_TRACK_MIN_TILE_HEIGHT:-20}"
RAIL_TRACK_MAX_HEIGHT="${RAIL_TRACK_MAX_HEIGHT:-84}"
RESTART_DELAY="${RESTART_DELAY:-3}"

mkdir -p "$LOG_DIR"

child_pid=""

shutdown() {
  if [[ -n "$child_pid" ]]; then
    kill "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
  fi
  exit 0
}

trap shutdown INT TERM

while true; do
  {
    printf '\n[%s] starting farm-map-viewer server on %s:%s\n' "$(date '+%F %T')" "$HOST" "$PORT"
    printf '[%s] db_root=%s build_root=%s scan_interval=%s\n' "$(date '+%F %T')" "$DB_ROOT" "$BUILD_ROOT" "$SCAN_INTERVAL"
  } >>"$LOG_FILE"

  (
    cd "$ROOT_DIR"
    exec python3 -m picture_maps.cli serve \
      --host "$HOST" \
      --port "$PORT" \
      --db-root "$DB_ROOT" \
      --build-root "$BUILD_ROOT" \
      --scan-interval "$SCAN_INTERVAL" \
      --rail-spacing "$RAIL_SPACING" \
      --cell-width "$CELL_WIDTH" \
      --cell-height "$CELL_HEIGHT" \
      --gap-y "$GAP_Y" \
      --rail-track-margin-y "$RAIL_TRACK_MARGIN_Y" \
      --rail-track-min-tile-height "$RAIL_TRACK_MIN_TILE_HEIGHT" \
      --rail-track-max-height "$RAIL_TRACK_MAX_HEIGHT"
  ) >>"$LOG_FILE" 2>&1 &

  child_pid="$!"
  set +e
  wait "$child_pid"
  status="$?"
  set -e
  child_pid=""

  printf '[%s] server exited with status %s, restarting in %ss\n' "$(date '+%F %T')" "$status" "$RESTART_DELAY" >>"$LOG_FILE"
  sleep "$RESTART_DELAY"
done
