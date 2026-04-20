# Farm Operations Dashboard

농장 사진 세션을 타일 맵으로 재구성하고, 그 위에 운영 의사결정용 `Action Center`, 추이 차트, KPI, 관리자 리포트를 얹는 정적 대시보드입니다.

핵심 목표는 연구용 시각화가 아니라 다음 질문에 즉시 답하는 운영 화면입니다.

- 오늘 어디를 먼저 점검해야 하는가
- 어떤 rail / segment가 악화되고 있는가
- 관리자에게 무엇을 공유해야 하는가
- 지난 세션 대비 좋아졌는가 나빠졌는가

현재 레포는 실센서/실AI 결과가 없어도 deterministic demo 데이터로 위 흐름이 동작하도록 구성되어 있습니다. 모든 데모 데이터는 UI와 API에 `demo`로 명시됩니다.

## 구조

```text
farm-map-viewer/
├── picture_maps/
│   ├── builder.py         # 타일 빌드 + insights/layers/dashboard 산출
│   ├── cli.py             # build / serve 진입점
│   ├── config.py          # BuildConfig, 산출물 경로 정의
│   ├── dashboard.py       # NEW: tasks / trends / report / KPI demo generator
│   ├── dataset.py         # 세션 폴더 스캔, rail/frame 좌표 추출
│   ├── insights.py        # heuristic 인사이트 생성
│   ├── layers.py          # 맵 오버레이 레이어 생성
│   ├── server.py          # HTTP 서버 + API + runtime fallback
│   └── watcher.py         # 새 세션 감시 / 재빌드
├── web/
│   ├── index.html         # 정적 대시보드 레이아웃
│   ├── app.js             # vanilla JS 렌더링 / 상태 연결 / map interaction
│   └── styles.css         # 제품형 운영 대시보드 스타일 + print CSS
└── build/
    └── <dataset_key>/
        ├── manifest.json
        ├── frames.json
        ├── insights.json
        ├── layers.json
        ├── dashboard.json  # NEW: kpis/tasks/trends/report
        ├── server_index.json
        ├── cells/*.jpg
        └── tiles/<z>/<x>/<y>.jpg
```

## 동작 계층

### 1. Base map

- `dataset.py`가 세션 디렉터리를 스캔합니다.
- `builder.py`가 4카메라 이미지를 2x2 contact sheet 셀로 만든 뒤 타일 피라미드를 생성합니다.
- `web/app.js`의 `TileMap`이 정적 타일과 디테일 이미지를 탐색합니다.

### 2. Heuristic insights

- `insights.py`가 카메라 누락, 데이터 공백, rail health/coverage, 세션 delta를 계산합니다.
- 이 결과는 selection 패널, alert 패널, 기존 ops summary에 사용됩니다.

### 3. Demo overlay layers

- `layers.py`가 rail / segment 기반의 deterministic overlay 레이어를 생성합니다.
- 현재 제공 레이어:
  - `action_priority`
  - `disease_pest_risk`
  - `growth_status`
  - `data_reliability`
  - `harvest_readiness`

### 4. Operations dashboard

- `dashboard.py`가 `insights + layers + manifest + frames + build history`를 조합해서 아래를 생성합니다.
  - Action Center 작업 목록
  - rail / segment 추이 그래프용 시계열
  - 운영 KPI 카드
  - 관리자용 리포트 구조
- 동일 모듈은 빌드 산출물이 없는 예전 세션에도 서버에서 runtime fallback으로 동작합니다.

## 데모 데이터 원칙

`dashboard.py`와 `layers.py`는 같은 세션을 다시 열어도 같은 결과가 나오도록 seed 기반으로 생성합니다.

- seed 기준:
  - `session_name`
  - `dataset_key`
  - `rail_name`
  - `segment_id`
- segment 분포:
  - 실제 rail/frame/odom 좌표를 사용
  - hot zone을 만들어 특정 rail 구간에 위험이 군집되도록 생성
- 작업 우선순위:
  - `high / medium / low`가 모두 나오도록 quota 기반으로 선택
- 작업 상태:
  - `todo / in_progress / done`이 deterministic cycle로 분포
- 추이 그래프:
  - 같은 device의 build 폴더 내 최근 세션명을 우선 사용
  - 이전 세션이 부족하면 synthetic history로 보강
- source 표기:
  - API와 UI 모두 `demo` 또는 `DEMO` 배지를 표시

## 새 API

기존 API:

- `GET /api/devices`
- `GET /api/devices/:device/sessions/:session/manifest`
- `GET /api/devices/:device/sessions/:session/frames`
- `GET /api/devices/:device/sessions/:session/insights`
- `GET /api/devices/:device/sessions/:session/layers`

추가 API:

- `GET /api/devices/:device/sessions/:session/tasks`
- `GET /api/devices/:device/sessions/:session/trends`
- `GET /api/devices/:device/sessions/:session/report`

### `/tasks`

Action Center가 사용하는 작업 목록입니다.

```json
{
  "available": true,
  "source": "demo",
  "summary": {
    "total": 16,
    "todo": 8,
    "in_progress": 3,
    "done": 5,
    "high": 6,
    "medium": 6,
    "low": 4,
    "unresolved": 11
  },
  "items": [
    {
      "id": "task:disease_check:rail_026_00320_00360",
      "title": "병충해 의심 구간 현장 확인",
      "priority": "high",
      "rail_name": "rail_026",
      "start_m": 32.0,
      "end_m": 36.0,
      "segment_id": "rail_026_00320_00360",
      "focus_frame_id": 1287,
      "reason": "...",
      "recommended_action": "...",
      "due_label": "오늘",
      "source": "demo",
      "status": "todo",
      "type": "disease_check"
    }
  ]
}
```

### `/trends`

rail 또는 segment 선택 시 차트가 갱신되도록 필요한 시계열을 제공합니다.

```json
{
  "available": true,
  "history": [
    { "session": "20260416_181034", "label": "04/16", "is_current": false }
  ],
  "default_selection": {
    "rail_name": "rail_026",
    "segment_id": "rail_026_00320_00360"
  },
  "rails": {
    "rail_026": {
      "headline": "병충해 위험 재상승 구간",
      "metrics": {
        "health_score": {
          "direction": "up_good",
          "current_value": 54,
          "delta": -6,
          "summary": "최근 3회 연속 악화",
          "points": [{ "label": "04/16", "value": 54, "is_current": true }]
        }
      }
    }
  }
}
```

### `/report`

웹 하단 리포트 섹션과 모달/인쇄 화면이 사용하는 구조입니다.

```json
{
  "available": true,
  "source": "demo",
  "kpis": [
    {
      "id": "inspection_needed",
      "label": "오늘 점검 필요 구간",
      "value": 14,
      "detail": "고위험 6개 포함",
      "tone": "bad",
      "action": "filter:inspection_needed"
    }
  ],
  "report": {
    "headline": "이번 주 우선 조치 rail과 악화 구간을 한눈에 볼 수 있는 운영 리포트",
    "session_overview": { "summary": "..." },
    "weekly_summary": { "summary": "...", "cards": [] },
    "risk_sections": [],
    "task_status": { "todo": 8, "in_progress": 3, "done": 5, "completion_rate": 31 },
    "rail_status": [],
    "delta": { "summary": "..." },
    "recommended_actions": []
  }
}
```

## 프론트 렌더링 흐름

`web/app.js`는 세션 로드 시 다음 순서로 데이터를 가져옵니다.

1. `manifest`
2. `frames`
3. `insights`, `layers`, `tasks`, `trends`, `report`

이후 아래 UI가 API 기반으로 연결됩니다.

- `Action Center`
  - 작업 카드 클릭 시 맵 포커스
  - 상태 토글은 브라우저 `localStorage`에 세션 단위로 저장
- `KPI strip`
  - 카드 클릭 시 작업 필터 또는 리포트 섹션으로 이동
- `Trend board`
  - rail 클릭 / segment 클릭 / task 클릭에 반응
- `Report surface`
  - 화면 하단 상시 표시
  - `리포트 보기` 버튼으로 모달 상세 보기
  - `인쇄 / PDF 저장` 버튼 지원

## 실행

### 빌드

```bash
cd /root/farm-map-viewer
python3 -m picture_maps.cli build --dataset /path/to/device/session
```

### 서버

```bash
cd /root/farm-map-viewer
python3 -m picture_maps.cli serve --dataset /path/to/device/session --host 0.0.0.0 --port 8090
```

여러 디바이스/세션을 NAS 루트 기준으로 스캔하려면:

```bash
python3 -m picture_maps.cli serve --db-root /path/to/db-root --host 0.0.0.0 --port 8090
```

## 실제 데이터로 교체하려면

데모 로직을 모두 걷어낼 필요는 없고, 아래 레이어만 실제 JSON으로 바꾸면 됩니다.

### overlay를 실제 예측 결과로 교체

- 파일: `picture_maps/layers.py`
- 교체 대상:
  - `_build_layer_items`
  - `generate_demo_layers_runtime`

현재는 segment별 score/severity를 deterministic demo로 만듭니다. 실제 병해/생육/품질 모델 결과가 있으면 같은 shape의 `items`를 반환하면 됩니다.

### 운영 작업/추이/리포트를 실제 운영 데이터로 교체

- 파일: `picture_maps/dashboard.py`
- 교체 대상:
  - `_build_tasks`
  - `_build_trends`
  - `_build_kpis`
  - `_build_report`

현재는 `layers + insights`를 기반으로 deterministic demo를 합성합니다. 실제 작업 시스템, 센서 시계열, 병해 판정, 관리자 메모가 있으면 같은 JSON 구조를 채워서 API는 그대로 유지할 수 있습니다.

### 프론트는 그대로 재사용

- 파일: `web/app.js`
- 조건:
  - `/tasks`, `/trends`, `/report` 응답 구조만 유지

렌더러는 이미 API 기반으로 동작하므로, 백엔드 JSON만 교체하면 화면은 그대로 동작합니다.

## 검증 메모

이번 구조에서는 다음을 최소 검증 대상으로 봅니다.

- `python -m compileall picture_maps`
- 서버 기동
- `/layers`, `/tasks`, `/trends`, `/report` 응답 확인
- 정적 HTML 응답 확인

브라우저 JS 문법 검사는 일반적으로 `node --check web/app.js`로 할 수 있지만, 현재 환경에 `node`가 없으면 해당 단계는 생략될 수 있습니다.
