# Classification Debug Images

## Overview

The furniture classification system now saves debug images showing exactly what is sent to the OpenAI Vision API for classification. This helps you understand how objects are being highlighted and why certain classifications are made.

## Location

Debug images are saved in:

```
backend/classification_debug/YYYYMMDD_HHMMSS/
```

Each classification run creates a new timestamped folder.

## File Structure

### Clean Floorplan

**File:** `00_full_floorplan_clean.jpg`

This is the original floorplan image without any highlights. It's sent as the first image to provide overall context to the LLM.

### Highlighted Object Images

**Files:** `01_object_1_highlighted.jpg`, `02_object_2_highlighted.jpg`, etc.

Each file shows the **FULL floorplan** with ONE object highlighted:

-   **Semi-transparent orange fill** (30% opacity) over the object
-   **Thick red border** (3px) around the object
-   **All other furniture visible** for spatial context

## Example Structure

```
backend/classification_debug/
├── 20250105_143022/          ← First classification run
│   ├── 00_full_floorplan_clean.jpg
│   ├── 01_object_1_highlighted.jpg
│   ├── 02_object_2_highlighted.jpg
│   ├── 03_object_3_highlighted.jpg
│   └── ...
├── 20250105_143156/          ← Second classification run
│   ├── 00_full_floorplan_clean.jpg
│   ├── 01_object_1_highlighted.jpg
│   └── ...
└── 20250105_144523/          ← Third classification run
    └── ...
```

## What You Should See

### Clean Floorplan (Image 00)

A normal floor plan view with all furniture visible, no highlights or annotations.

### Highlighted Images (Images 01-N)

Each shows the same full floorplan but with one specific object marked:

```
┌────────────────────────────────────┐
│        Full Floorplan              │
│                                    │
│  ╔══════╗    [wall]                │ ← Orange transparent
│  ║ BED  ║                           │   box + red border
│  ╚══════╝                           │   highlights THIS object
│                                     │
│    [table]  [chair] [chair]        │ ← All other furniture
│                 [dresser]           │   still visible
│                                     │
└────────────────────────────────────┘
```

## Using Debug Images

### 1. Verify Segmentation

Check if objects are correctly identified and bounded. The red boxes should align with actual furniture.

### 2. Check Highlight Visibility

Ensure the orange highlight is visible but not overwhelming. The object should be clearly marked.

### 3. Understand Context

See what surrounding furniture and room layout the LLM can see when classifying each object.

### 4. Debug Misclassifications

If an object is misclassified, look at its highlighted image:

-   Is the highlight in the right place?
-   Does the surrounding context mislead the classification?
-   Is the object shape ambiguous from top-down view?

### 5. Verify Full Context

Confirm that walls, doors, windows, and neighboring furniture are all visible in each image.

## Console Output

When debug images are saved, you'll see in the backend console:

```
Creating highlighted images for classification...

Saving debug images to: classification_debug/20250105_143022/
  Saved clean floorplan: classification_debug/20250105_143022/00_full_floorplan_clean.jpg
  Saved highlighted object #1: classification_debug/20250105_143022/01_object_1_highlighted.jpg
  Saved highlighted object #2: classification_debug/20250105_143022/02_object_2_highlighted.jpg
  Saved highlighted object #3: classification_debug/20250105_143022/03_object_3_highlighted.jpg
  ...

✓ Saved 9 debug images

Classifying 8 objects with full floorplan context...
  Object 1: Bed (confidence: high)
  Object 2: Dining Table (confidence: high)
  ...
```

## Correlating with Classifications

Match the image numbers with the classification output:

```
01_object_1_highlighted.jpg  →  Object 1: Bed (confidence: high)
02_object_2_highlighted.jpg  →  Object 2: Dining Table (confidence: high)
03_object_3_highlighted.jpg  →  Object 3: Chair (confidence: medium)
```

If Object #3 is misclassified, open `03_object_3_highlighted.jpg` to see what the LLM saw.

## Disabling Debug Images

To disable saving debug images (saves disk space):

```python
# In minglun_service.py or wherever you call the service

classified_objects = await self.segmentation_service.extract_and_classify_furniture(
    floorplan_bytes,
    conf=0.4,
    iou=0.9,
    save_debug_images=False,  # Disable debug images
)
```

## Customizing Output Directory

To change where images are saved:

```python
classified_objects = await self.segmentation_service.extract_and_classify_furniture(
    floorplan_bytes,
    conf=0.4,
    iou=0.9,
    save_debug_images=True,
    debug_output_dir="my_custom_debug_folder",  # Custom location
)
```

## Highlight Customization

To change the highlight appearance, edit `segmentation_service.py`:

```python
def _create_highlighted_image(self, ...):
    # Change highlight color (BGR format)
    cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 100, 255), -1)  # Orange
    # Try: (0, 255, 255) for yellow, (255, 0, 255) for magenta

    # Change transparency
    alpha = 0.3  # 30% - current
    # Try: 0.2 for more subtle, 0.5 for more visible

    # Change border color and thickness
    cv2.rectangle(highlighted_img, (x1, y1), (x2, y2), (0, 0, 255), 3)  # Red, 3px
    # Try: 5 for thicker, (255, 0, 0) for blue
```

## Disk Space

Each debug folder typically uses:

-   Clean image: ~500KB
-   Each highlighted image: ~500KB
-   Total for 10 objects: ~5.5MB per classification run

To clean up old debug images:

```bash
# Delete folders older than 7 days
cd backend/classification_debug
find . -type d -mtime +7 -exec rm -rf {} +

# Or just delete all
rm -rf classification_debug/*
```

## Troubleshooting

### Images Not Saving?

1. Check write permissions on the backend directory
2. Verify `save_debug_images=True` is set
3. Check console for error messages

### Can't Find Images?

1. Look in `backend/classification_debug/`
2. Check for timestamped folders
3. Verify the backend is running from the correct directory

### Images Look Wrong?

1. Verify `cv2` (opencv-python) is installed
2. Check if highlights are visible (try increasing alpha)
3. Ensure bounding boxes are correct (check segmentation)

## Best Practices

1. **Review Regularly**: Check debug images for your first few classifications
2. **Compare Results**: Match highlighted images with classification outputs
3. **Clean Up**: Delete old debug folders periodically
4. **Report Issues**: If you find misclassifications, check the debug images first
5. **Share Examples**: Debug images are great for showing what the system sees

## Summary

✓ **Automatic saving**: Enabled by default  
✓ **Timestamped folders**: Easy to track classification runs  
✓ **Full context**: Shows exactly what the LLM sees  
✓ **Easy debugging**: Correlate images with classification results  
✓ **Configurable**: Can disable or customize as needed

Debug images make it easy to understand and improve the furniture classification system!
