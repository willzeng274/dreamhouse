import cv2
import supervision as sv
from inference_sdk import InferenceHTTPClient
import json
import os

CLIENT = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key="ygwwfj59UOwbEcx6bwp8"
    # api_key=os.getenv("ROBOFLOW_API_KEY")
)

def detect_walls(image_path, model_id="cubicasa5k-2-qpmsa/6"):
    """
    Analyze a floor plan image and return detection information as JSON.
    
    Args:
        image_path (str): Path to the floor plan image
        model_id (str): Roboflow model ID to use for inference
        
    Returns:
        list: JSON list of detections, each containing:
            - class: The detected class name (e.g., "wall", "door", "window")
            - center_x: X coordinate of the center (normalized 0-1)
            - center_y: Y coordinate of the center (normalized 0-1)
            - width: Width of the detection (normalized 0-1)
            - height: Height of the detection (normalized 0-1)
            - confidence: Confidence score (0-1)
    """
    # Get image dimensions for normalization
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not load image from {image_path}")
        return []
    
    img_height, img_width = image.shape[:2]
    print(f"Image dimensions: {img_width}x{img_height}")
    
    # Run inference
    result = CLIENT.infer(image_path, model_id=model_id)
    
    # Parse predictions into structured format with normalized coordinates
    detections_list = []
    
    if 'predictions' in result:
        for pred in result['predictions']:
            # Get raw coordinates and dimensions
            raw_x = pred.get('x', 0)
            raw_y = pred.get('y', 0)
            raw_width = pred.get('width', 0)
            raw_height = pred.get('height', 0)
            
            # Normalize coordinates and dimensions
            normalized_x = raw_x / img_width
            normalized_y = raw_y / img_height
            normalized_width = raw_width / img_width
            normalized_height = raw_height / img_height
            
            detection = {
                "class": pred.get('class', 'unknown'),
                "center_x": normalized_x,
                "center_y": normalized_y,
                "width": normalized_width,
                "height": normalized_height,
                "confidence": pred.get('confidence', 0)
            }
            detections_list.append(detection)
    
    return detections_list

if __name__ == "__main__":
    image_path = "./pipeline/floor-plan-5.png"
    detections = detect_walls(image_path)
    
    # Print JSON output
    print("=" * 80)
    print("WALL DETECTION JSON OUTPUT:")
    print("=" * 80)
    print(json.dumps(detections, indent=2))
    print("\n")
    
    # Save to file
    output_file = "./pipeline/wall_detections.json"
    with open(output_file, "w") as f:
        json.dump(detections, f, indent=2)
    print(f"💾 Saved wall detections to {output_file}")
    
    # Get the raw result for visualization
    result = CLIENT.infer(image_path, model_id="cubicasa5k-2-qpmsa/6")
    
    # Load image (BGR)
    image = cv2.imread(image_path)
    
    # Convert Roboflow response -> sv.Detections (handles boxes + masks)
    detections_sv = sv.Detections.from_inference(result)
    
    # Print detailed information about detections
    print("\n" + "=" * 80)
    print("DETECTION SUMMARY:")
    print("=" * 80)
    print(f"Total detections: {len(detections_sv)}")
    print(f"Image dimensions: {image.shape[1]}x{image.shape[0]} (width x height)")
    print("\n")
    
    # Print information about each detection
    print("=" * 80)
    print("DETAILED DETECTION INFORMATION:")
    print("=" * 80)
    
    if 'predictions' in result:
        predictions = result['predictions']
        
        # Group by class
        class_counts = {}
        for pred in predictions:
            class_name = pred.get('class', 'unknown')
            class_counts[class_name] = class_counts.get(class_name, 0) + 1
        
        print(f"\nDetected classes and counts:")
        for class_name, count in sorted(class_counts.items()):
            print(f"  - {class_name}: {count}")
        
        print("\n" + "-" * 80)
        print("Individual detections:")
        print("-" * 80)
        
        for i, pred in enumerate(predictions):
            print(f"\nDetection #{i+1}:")
            print(f"  Class: {pred.get('class', 'N/A')}")
            print(f"  Confidence: {pred.get('confidence', 0):.2%}")
            
            if 'x' in pred and 'y' in pred:
                print(f"  Center: ({pred['x']:.1f}, {pred['y']:.1f})")
            
            if 'width' in pred and 'height' in pred:
                print(f"  Size: {pred['width']:.1f} x {pred['height']:.1f}")
                print(f"  Area: {pred['width'] * pred['height']:.1f} sq pixels")
            
            # Print any additional fields
            extra_fields = {k: v for k, v in pred.items() 
                           if k not in ['class', 'confidence', 'x', 'y', 'width', 'height', 
                                       'class_id', 'detection_id', 'points']}
            if extra_fields:
                print(f"  Additional info: {extra_fields}")
    
    # Overlay masks (or use BoxAnnotator for just boxes)
    mask_annotator = sv.MaskAnnotator()
    boxed = sv.BoxAnnotator(thickness=2)
    label_annotator = sv.LabelAnnotator()
    
    image = mask_annotator.annotate(image, detections_sv)
    image = boxed.annotate(image, detections_sv)
    image = label_annotator.annotate(image, detections_sv)
    
    # Save overlay as PNG
    out_path = "./pipeline/segmented_overlay.png"
    cv2.imwrite(out_path, image)
    print("\n" + "=" * 80)
    print(f"✅ Saved annotated overlay to {out_path}")
    print("=" * 80)