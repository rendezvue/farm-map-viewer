# Farm Operations Dashboard (Picture Maps)

`odom x`와 레일 간격으로 농장 사진을 슬리피맵 타일로 재구성하고, 헤리스틱 분석 기반의 **운영 의사결정 대시보드**를 제공합니다.

핵심 방식:

- 입력: `/home/nas/rdv_md3/uv_camera_db/ubuntu/20260416_235959/` 같은 세션 폴더
- 좌표: `EXIF UserComment`의 `odom_x=...` + `rail_index * 3m`
- 배치: 같은 위치의 4카메라 이미지를 2x2 콘택트시트 한 셀로 구성
- 렌더링: 전체 셀 그리드를 `z/x/y` PNG 타일 피라미드로 생성
- 인사이트: 카메라 누락·데이터 공백·rail 점수를 헤리스틱으로 계산, 직전 세션 대비 delta 표시
- 프론트: 타일 뷰어 + 운영 요약·알림 패널·위험도 오버레이·관리자 리포트

## 구조

```text
farm-map-viewer/
├── picture_maps/
│   ├── builder.py      # 타일 빌드, 빌드 후 insights/layers 자동 생성
│   ├── cli.py
│   ├── config.py       # BuildConfig
│   ├── dataset.py
│   ├── insights.py     # 헤리스틱 인사이트 엔진
│   ├── layers.py       # 5종 분석 레이어 (demo deterministic generator)
│   ├── tasks.py        # Action Center - 오늘 할 일 task generator
│   ├── trends.py       # Rail별 가상 세션 추이 generator
│   ├── server.py       # HTTP 서버 + 모든 API 핸들링
│   └── watcher.py
├── web/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── WORKLOG.md          # 작업 로그 / 작업 주체 이력
└── build/
    └── <dataset_key>/
        ├── manifest.json
        ├── frames.json
        ├── server_index.json
        ├── insights.json     ← 헤리스틱 분석 결과 (있으면 사용)
        ├── layers.json       ← 레이어 데이터 (없으면 런타임 생성)
        ├── cells/*.jpg
        └── tiles/<z>/<x>/<y>.jpg
```

## 실행

빌드:

```bash
cd /home/rdv/picture-maps
python3 -m picture_maps.cli build
```

서버 실행:

```bash
cd /home/rdv/picture-maps
python3 -m picture_maps.cli serve --host 0.0.0.0 --port 8090
```

필요하면 다시 빌드하면서 실행:

```bash
python3 -m picture_maps.cli serve --rebuild
```

다른 세션을 쓸 때:

```bash
python3 -m picture_maps.cli serve \
  --dataset /home/nas/rdv_md3/uv_camera_db/ubuntu/20260416_235959
```

## 출력물

`build/<dataset_key>/` 아래에 다음이 생성됩니다.

- `manifest.json`: 지도 메타데이터
- `frames.json`: 프론트에서 쓰는 프레임 정보
- `server_index.json`: 원본 이미지 경로 인덱스
- `insights.json`: 헤리스틱 분석 결과 (session/rail/frame/alerts/report)
- `cells/*.jpg`: 위치별 2x2 콘택트시트
- `tiles/<z>/<x>/<y>.jpg`: 슬리피맵 타일

## API 엔드포인트 목록

| Endpoint | 설명 |
|---|---|
| `GET /api/devices` | 디바이스/세션 목록 |
| `GET /api/devices/:d/sessions/:s/manifest` | 세션 메타데이터 |
| `GET /api/devices/:d/sessions/:s/frames` | 프레임 리스트 |
| `GET /api/devices/:d/sessions/:s/insights` | 헤리스틱 인사이트 |
| `GET /api/devices/:d/sessions/:s/layers` | 5종 분석 레이어 |
| `GET /api/devices/:d/sessions/:s/tasks` | **NEW** 오늘 할 일 작업 목록 |
| `GET /api/devices/:d/sessions/:s/trends` | **NEW** Rail별 세션 추이 데이터 |
| `GET /api/devices/:d/sessions/:s/pest-detections` | **NEW** 실제 병충해 프레임 마커 데이터 |
| `GET /api/devices/:d/sessions/:s/report` | 운영 리포트 요약 |

### tasks.json 구조

```json
{
  "source": "demo",
  "session": "...",
  "tasks": [
    {
      "id": "task_disease_pest_risk_high_...",
      "title": "병충해 의심 구간 현장 확인",
      "priority": "high",
      "task_type": "disease_check",
      "rail_name": "rail_005",
      "start_m": 12.0,
      "end_m": 20.0,
      "reason": "흰가루병 또는 진딧물 의심 패턴 감지",
      "recommended_action": "즉시 방제 약제 살포 검토 및 격리 조치",
      "due_label": "12시간 내",
      "source": "demo",
      "status": "todo",
      "layer_id": "disease_pest_risk",
      "frame_ids": [...],
      "value": 87,
      "confidence": 0.82
    }
  ],
  "summary": {
    "total": 20, "high_open": 11, "medium_open": 6,
    "todo": 14, "in_progress": 3, "done": 3
  }
}
```

### trends.json 구조

```json
{
  "source": "demo",
  "session": "...",
  "session_labels": ["S-5", "S-4", "S-3", "S-2", "S-1", "현재"],
  "rails": {
    "rail_001": {
      "sessions": [...],
      "trends": {
        "health_score": [54.7, 50.1, 53.2, 54.0, 51.3, 48.6],
        "disease_pest_risk": [...],
        "growth_status": [...],
        "data_reliability": [...]
      },
      "summaries": {
        "health_score": "최근 3회 연속 악화 주의",
        "disease_pest_risk": "직전 대비 +8 악화",
        ...
      },
      "current": { "health_score": 48.6, ... }
    }
  }
}
```

> **실제 데이터 연동 시**: `tasks.py`의 `generate_tasks()`, `trends.py`의 `generate_trends()`를 교체하거나, layers.json 대신 실 분석 결과 JSON을 같은 포맷으로 제공하면 됩니다.

## pest_detections.json 구조

세션 폴더 또는 `build/<dataset_key>/` 아래에 `pest_detections.json`이 있으면, 프론트에서 **병충해 위험 레이어 활성화 시 실제 프레임 위치 마커**를 표시합니다. 개발/데모 확인용으로는 `demo_data/pest_detections/<device>/<session>.json`도 fallback으로 읽습니다.

```json
{
  "source": "pest-detector-v1",
  "detections": [
    {
      "id": "pest_0001",
      "frame_id": 1234,
      "rail_name": "rail_005",
      "odom_x": 12.4,
      "severity": "high",
      "label": "진딧물",
      "confidence": 0.91,
      "camera": "front_left",
      "bbox": [120, 84, 188, 146],
      "note": "잎 뒷면 군집 의심"
    }
  ]
}
```

- `frame_id`: 가장 중요한 필드입니다. 마커는 이 프레임을 기준으로 지도에 표시됩니다.
- `camera`: 있으면 2x2 콘택트시트 내 해당 카메라 사분면 쪽으로 마커를 이동합니다.
- `bbox`: 있으면 해당 카메라 이미지 내부 중심점 기준으로 더 정확한 마커 위치를 계산합니다.
- `severity`: `high`, `medium`, `low`
- 파일이 없으면 API는 `available: false`를 반환하고 마커는 표시되지 않습니다.

## insights.json 구조

```json
{
  "session": {
    "device": "ubuntu",
    "session": "20260416_182344",
    "source": "heuristic",
    "health_score": 98,
    "coverage_score": 89,
    "alert_count": 1,
    "priority_rail_count": 0,
    "gap_count": 0,
    "missing_camera_frame_count": 1,
    "delta": {
      "compared_session": "20260416_181915",
      "health_score": -2,
      "coverage_score": -11,
      "alert_count": 1
    }
  },
  "rails": {
    "rail_001": {
      "health_score": 98, "coverage_score": 89,
      "priority_score": 0, "issue_count": 1,
      "flags": ["missing_camera"],
      "recommendation": "카메라 누락 1개 프레임 점검 필요",
      "delta": { "health_score": -2, "compared_session": "..." }
    }
  },
  "frames": {
    "3": {
      "score": 78, "flags": ["missing_camera"],
      "alert_ids": ["alert_0001"],
      "recommendation": "카메라 누락 프레임 점검 필요: front_right"
    }
  },
  "alerts": [
    {
      "id": "alert_0001", "severity": "warning",
      "category": "missing_camera",
      "title": "카메라 누락",
      "message": "rail_001 @ -0.5m: front_right 카메라 이미지 없음",
      "rail_name": "rail_001", "frame_id": 3,
      "source": "heuristic"
    }
  ],
  "report": { "session_overview": "...", "key_findings": [...], "recommended_actions": [...] }
}
```

`source` 필드는 `"heuristic"`, `"external"`, `"heuristic+external"` 중 하나입니다.
점수는 모두 0~100 범위입니다.

## 외부 AI 결과 연동 (override)

세션 폴더에 `insights_override.json`을 두면 빌드 시 헤리스틱 결과와 merge됩니다.

```json
{
  "source": "disease_model_v1",
  "alerts": [
    {
      "id": "ext_001", "severity": "error",
      "category": "disease_suspicion",
      "title": "병해 의심",
      "message": "rail_003 @ 12.0m: 흰가루병 의심 (신뢰도 0.82)",
      "rail_name": "rail_003", "frame_id": 142
    }
  ],
  "frames": {
    "142": { "score": 30, "flags": ["disease_suspicion"], "recommendation": "즉시 현장 확인 필요" }
  },
  "rails": {
    "rail_003": { "health_score": 40, "priority_score": 80, "flags": ["disease_suspicion"] }
  },
  "session": { "health_score": 65 }
}
```

**Merge 규칙:**
- `alerts`: 외부 alerts가 기존 목록에 추가됩니다
- `frames`: score는 heuristic과 external 중 낮은 값 채택, flags는 합집합
- `rails`: score 필드는 외부 값으로 덮어씁니다 (신뢰 우선)
- `session`: health_score/coverage_score만 덮어씁니다
- 외부 override 없이도 앱은 완전히 동작합니다

## 새 API 엔드포인트

| 경로 | 설명 |
|------|------|
| `GET /api/devices/:device/sessions/:session/insights` | session/rail/frame/alerts 전체 |
| `GET /api/devices/:device/sessions/:session/report` | 관리자용 report 요약 |

응답에 `"available": false`이면 insights.json이 없는 세션입니다 (앱은 정상 동작).

## 비고

- `odom y`가 없으므로 `rail_001`, `rail_002`, ... 순서로 `3m` 간격의 가상 횡축을 만듭니다.
- 실제 지도 좌표와 완전히 같은 정사영상이 아니고, 농장 운영용 탐색/검수에 맞춘 커스텀 로컬 타일 맵입니다.
- 외부 ML 모델 결과는 `insights_override.json`으로 주입하면 기존 헤리스틱 결과와 blend됩니다.
