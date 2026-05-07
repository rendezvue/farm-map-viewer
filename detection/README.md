# Detection Workspace

This folder contains the object-detection workflow for the farm map viewer.
It is wired for the Roboflow Universe dataset:

- Workspace: `project-mtjqr`
- Project: `tomato-czcyh`
- Version: `2`
- Default format: `yolov8`

The inference output is compatible with the map server's
`growth_detections.json` loader. Put the generated JSON in a session directory
and the map can draw detection boxes when `Growth Status` is enabled.

## 1. Download the Roboflow Dataset

Roboflow downloads require an API key.

```bash
export ROBOFLOW_API_KEY="your_key"
python3 detection/download_dataset.py
```

The default output is:

```text
detection/datasets/tomato-czcyh-v2/
```

## 2. Train a YOLO Model

```bash
python3 detection/train_yolo.py \
  --data detection/datasets/tomato-czcyh-v2/data.local.yaml \
  --model /root/works/strawberry_detection/yolo11s.pt \
  --epochs 80 \
  --imgsz 640 \
  --device 0
```

Training output is written under:

```text
detection/runs/train/
```

## 3. Run Detection on a Farm Map Session

```bash
python3 detection/infer.py \
  --model detection/runs/train/tomato_czcyh_v2_yolo11s/weights/best.pt \
  --source /mnt/nas_rdv_md3/uv_camera_db/tomato_tokuiten_host/20260507_130000 \
  --conf 0.08 \
  --class-conf raw=0.08,midi=0.12,ripe=0.22 \
  --imgsz 960 \
  --batch 1 \
  --chunk-size 30 \
  --annotate-dir detection/runs/tomato_session/annotated
```

For a farm-map session source, the default output is:

```text
/mnt/nas_rdv_md3/uv_camera_db/tomato_tokuiten_host/20260507_130000/growth_detections.json
```

Refresh the map page after writing that file.

## Fast Smoke Test

Use `--limit` to run just a few images.

```bash
python3 detection/infer.py \
  --model path/to/best.pt \
  --source /mnt/nas_rdv_md3/uv_camera_db/tomato_tokuiten_host/20260507_130000 \
  --limit 8 \
  --annotate-dir detection/runs/smoke/annotated
```
