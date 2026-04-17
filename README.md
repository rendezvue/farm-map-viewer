# Picture Maps

`odom x`와 레일 간격만으로 농장 사진을 슬리피맵 타일 피라미드로 재구성하는 로컬 웹서버입니다.

핵심 방식:

- 입력: `/home/nas/rdv_md3/uv_camera_db/ubuntu/20260416_235959/` 같은 세션 폴더
- 좌표: `EXIF UserComment`의 `odom_x=...` + `rail_index * 3m`
- 배치: 같은 위치의 4카메라 이미지를 2x2 콘택트시트 한 셀로 구성
- 렌더링: 전체 셀 그리드를 `z/x/y` PNG 타일 피라미드로 생성
- 프론트: 외부 지도 라이브러리 없이 휠 줌/드래그 팬이 되는 타일 뷰어

## 구조

```text
picture-maps/
├── picture_maps/
│   ├── builder.py
│   ├── cli.py
│   ├── config.py
│   ├── dataset.py
│   └── server.py
├── web/
│   ├── app.js
│   ├── index.html
│   └── styles.css
└── build/
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
- `cells/*.jpg`: 위치별 2x2 콘택트시트
- `tiles/<z>/<x>/<y>.png`: 슬리피맵 타일

## 비고

- 현재 `odom y`는 없으므로 `rail_001`, `rail_002`, ... 순서를 사용해 `3m` 간격의 가상 횡축을 만듭니다.
- 실제 지도 좌표와 완전히 같은 정사영상은 아니고, 농장 운영용 탐색/검수에 맞춘 커스텀 로컬 타일 맵입니다.
