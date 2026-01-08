# ML Models Directory

## 📦 Place Your Trained Models Here

This directory should contain your trained ML models for eco verification.

## Required Models

### 1. YOLOv8 Object Detection Model

**Filename:** `yolov8_eco.pt`

**Training Classes (16 total):**

✅ **Eco-Positive Objects:**
1. `public_transport` - Buses, trains, metro
2. `bicycle` - Bicycles, bike lanes
3. `electric_scooter` - E-scooters, electric vehicles
4. `tree` - Trees, plants, greenery
5. `cloth_bag` - Reusable bags, eco bags
6. `recycle_bin` - Recycling bins, waste sorting
7. `waste_segregation` - Separated waste containers
8. `biogas_ready` - Biogas facilities
9. `solar_panel_clean` - Clean solar panels
10. `wind_turbine` - Wind turbines, wind energy
11. `garden_tools` - Gardening equipment

❌ **Eco-Negative Objects:**
12. `plastic_waste` - Plastic bottles, plastic bags
13. `solar_panel_dusty` - Dirty/unmaintained solar panels
14. `smoking` - Cigarettes, smoking
15. `water_bottle` - Single-use plastic bottles

⚪ **Neutral Objects:**
16. `human` - People (for context)

### How to Get the Model

**Option 1: Use Your Trained Model**
```bash
# Copy your trained YOLOv8 model
cp path/to/your/yolov8_eco.pt backend/ml/models/yolov8_eco.pt
```

**Option 2: Train from Scratch**

```python
from ultralytics import YOLO

# 1. Prepare dataset in YOLO format
# dataset/
#   ├── images/
#   │   ├── train/
#   │   └── val/
#   └── labels/
#       ├── train/
#       └── val/

# 2. Create data.yaml
"""
train: path/to/dataset/images/train
val: path/to/dataset/images/val

nc: 16  # number of classes
names: ['public_transport', 'bicycle', 'electric_scooter', 'tree', 
        'cloth_bag', 'recycle_bin', 'waste_segregation', 'plastic_waste',
        'biogas_ready', 'solar_panel_clean', 'solar_panel_dusty', 
        'wind_turbine', 'water_bottle', 'garden_tools', 'human', 'smoking']
"""

# 3. Train model
model = YOLO('yolov8s.pt')  # Start from pretrained
results = model.train(
    data='data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    name='yolov8_eco'
)

# 4. Copy trained model
# runs/detect/yolov8_eco/weights/best.pt → ml/models/yolov8_eco.pt
```

**Option 3: Fine-tune Existing Model**

```python
from ultralytics import YOLO

# Load pretrained COCO model
model = YOLO('yolov8s.pt')

# Fine-tune on eco dataset (transfer learning)
results = model.train(
    data='eco_data.yaml',
    epochs=50,  # Fewer epochs needed for fine-tuning
    imgsz=640,
    freeze=10  # Freeze first 10 layers
)
```

## Model Size Recommendations

| Model | Size | Speed | Accuracy | Recommended For |
|-------|------|-------|----------|-----------------|
| YOLOv8n | ~6MB | Very Fast | Good | Mobile, Edge devices |
| YOLOv8s | ~22MB | Fast | Better | **Recommended** |
| YOLOv8m | ~52MB | Medium | Good | High accuracy needed |
| YOLOv8l | ~87MB | Slow | Best | Production, GPU servers |

**We recommend YOLOv8s** for the best balance of speed and accuracy.

## Verifying Your Model

Test your model before deploying:

```python
from ultralytics import YOLO

# Load model
model = YOLO('ml/models/yolov8_eco.pt')

# Test on sample image
results = model('test_images/solar_panels.jpg')

# Check detections
for r in results:
    print(f"Detected classes: {r.boxes.cls}")
    print(f"Class names: {[r.names[int(c)] for c in r.boxes.cls]}")
    print(f"Confidences: {r.boxes.conf}")
```

Expected output for eco-friendly image:
```
Detected classes: [9, 3]
Class names: ['solar_panel_clean', 'tree']
Confidences: [0.92, 0.87]
```

## Model Performance Metrics

Your trained model should achieve:
- **mAP@50:** > 0.70 (Good)
- **mAP@50-95:** > 0.50 (Acceptable)
- **Precision:** > 0.75
- **Recall:** > 0.70

## Dataset Recommendations

### Minimum Dataset Size
- **Training images:** 1,000-2,000 images
- **Validation images:** 200-400 images
- **Images per class:** 50-100 images minimum

### Data Sources
1. **Public Datasets:**
   - COCO (filter relevant classes)
   - OpenImages (eco-related subset)
   - ImageNet (nature, outdoor, transport)

2. **Custom Collection:**
   - Scrape eco-related images from web
   - Use stock photo websites
   - Collect user-generated content

3. **Data Augmentation:**
   - Rotation, flip, crop
   - Color jittering
   - Brightness/contrast
   - Mosaic augmentation (YOLOv8 built-in)

## File Structure

```
ml/models/
├── README.md                    # This file
├── yolov8_eco.pt               # Your trained YOLOv8 model (REQUIRED)
├── yolov8_eco_metadata.json    # Optional: Model metadata
└── .gitkeep                    # Keep directory in git
```

## Model Metadata (Optional)

Create `yolov8_eco_metadata.json`:

```json
{
  "model_name": "YOLOv8s Eco Detector",
  "version": "1.0.0",
  "trained_date": "2026-01-09",
  "dataset_size": 1500,
  "classes": 16,
  "mAP@50": 0.82,
  "mAP@50-95": 0.65,
  "notes": "Trained on custom eco dataset with COCO pretrained weights"
}
```

## Security Note

⚠️ **Do NOT commit your trained models to Git!**

Models are large and should be stored separately:
- Use Git LFS for version control
- Store on cloud storage (S3, GCS)
- Download models during deployment

Add to `.gitignore`:
```
ml/models/*.pt
ml/models/*.onnx
ml/models/*.weights
```

## Model Updates

When updating your model:

1. **Version your models:**
   ```
   yolov8_eco_v1.0.pt
   yolov8_eco_v1.1.pt
   yolov8_eco_v2.0.pt
   ```

2. **Test thoroughly** before replacing production model

3. **Keep backups** of previous versions

4. **Update metadata** with performance metrics

5. **Restart services** after updating:
   ```bash
   docker-compose -f docker-compose.ml.yml restart ml-api ml-worker
   ```

## Troubleshooting

### Model Not Found

**Error:** `FileNotFoundError: ml/models/yolov8_eco.pt not found`

**Solution:**
```bash
# Check file exists
ls -lh backend/ml/models/

# Should see: yolov8_eco.pt

# If missing, copy your model:
cp your_model.pt backend/ml/models/yolov8_eco.pt
```

### Wrong Model Format

**Error:** `AssertionError: Model is not a YOLOv8 model`

**Solution:**
- Ensure model was trained with ultralytics (not YOLOv5 or other)
- Re-export model in correct format
- Use YOLOv8 `model.export()` if needed

### Model Too Large

**Error:** `MemoryError` or slow loading

**Solution:**
- Use smaller model (YOLOv8n or YOLOv8s)
- Enable model quantization
- Use ONNX format for faster inference

## Next Steps

1. ✅ Place your trained model in this directory
2. ✅ Test model with `examples.py`
3. ✅ Start ML verification service
4. ✅ Monitor model performance
5. ✅ Iterate and improve

---

**Need help training your model?** Check the [YOLOv8 Documentation](https://docs.ultralytics.com/)
