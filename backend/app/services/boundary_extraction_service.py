import cv2
import numpy as np
import supervision as sv
from inference_sdk import InferenceHTTPClient
import json
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class BoundaryExtractionService:
    """Service for extracting and classifying boundary elements (walls, doors, windows) from floorplan images."""

    def __init__(self, model_id: str = "cubicasa5k-2-qpmsa/6"):
        """
        Initialize the boundary extraction service.
        
        Args:
            model_id: Roboflow model ID to use for inference
        """
        self.roboflow_api_key = os.environ.get("ROBOFLOW_API_KEY")
        
        self.client = InferenceHTTPClient(
            api_url="https://serverless.roboflow.com",
            api_key=self.roboflow_api_key
        )
        self.model_id = model_id

    async def extract_boundaries(self, floorplan_bytes: bytes, debug: bool = False) -> List[Dict[str, Any]]:
        """
        Extract and classify boundary elements (walls, doors, windows) from a floorplan image.
        
        Args:
            floorplan_bytes: Image data as bytes
            debug: If True, save debug outputs (JSON and annotated overlay) to boundary_debug/
            
        Returns:
            List of boundary detections in the format:
            {
                "id": string,
                "class": string (e.g., "wall", "door", "window"),
                "position": {"x": float, "y": float},  # normalized center coordinates
                "dimensions": {"width": float, "height": float},  # normalized
                "confidence": float,
                "bbox_normalized": {"x1": float, "y1": float, "x2": float, "y2": float},
                "bbox_pixels": {"x1": int, "y1": int, "x2": int, "y2": int}
            }
        """
        print("START BOUNDARY DETECTION")
        # Convert bytes to numpy array
        nparr = np.frombuffer(floorplan_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            print("EARLY RETURN BOUNDARY DETECTION")
            raise ValueError("Could not decode image from bytes")
        
        img_height, img_width = image.shape[:2]
        
        # Run inference - pass numpy array instead of bytes
        result = self.client.infer(image, model_id=self.model_id)
        
        # Parse predictions into structured format
        detections_list = []
        
        if 'predictions' in result:
            for idx, pred in enumerate(result['predictions']):
                # Get raw coordinates and dimensions
                raw_x = pred.get('x', 0)
                raw_y = pred.get('y', 0)
                raw_width = pred.get('width', 0)
                raw_height = pred.get('height', 0)
                
                # Calculate bounding box in pixels
                x1_px = int(raw_x - raw_width / 2)
                y1_px = int(raw_y - raw_height / 2)
                x2_px = int(raw_x + raw_width / 2)
                y2_px = int(raw_y + raw_height / 2)
                
                # Normalize coordinates and dimensions
                normalized_x = raw_x / img_width
                normalized_y = raw_y / img_height
                normalized_width = raw_width / img_width
                normalized_height = raw_height / img_height
                
                # Calculate normalized bounding box
                x1_norm = x1_px / img_width
                y1_norm = y1_px / img_height
                x2_norm = x2_px / img_width
                y2_norm = y2_px / img_height
                
                detection = {
                    "id": f"boundary_{idx}",
                    "class": pred.get('class', 'unknown'),
                    "position": {
                        "x": float(normalized_x),
                        "y": float(normalized_y)
                    },
                    "dimensions": {
                        "width": float(normalized_width),
                        "height": float(normalized_height)
                    },
                    "confidence": float(pred.get('confidence', 0)),
                    "bbox_normalized": {
                        "x1": float(x1_norm),
                        "y1": float(y1_norm),
                        "x2": float(x2_norm),
                        "y2": float(y2_norm)
                    },
                    "bbox_pixels": {
                        "x1": x1_px,
                        "y1": y1_px,
                        "x2": x2_px,
                        "y2": y2_px
                    }
                }
                detections_list.append(detection)
        
        # Save debug outputs if requested
        if debug:
            debug_dir = "./backend/boundary_debug"
            os.makedirs(debug_dir, exist_ok=True)
            
            # Save JSON detections
            json_path = os.path.join(debug_dir, "wall_detections.json")
            with open(json_path, "w") as f:
                json.dump(detections_list, f, indent=2)
            print(f"💾 Saved wall detections to {json_path}")
            
            # Create and save annotated overlay
            detections_sv = sv.Detections.from_inference(result)
            
            # Create annotators
            mask_annotator = sv.MaskAnnotator()
            box_annotator = sv.BoxAnnotator(thickness=2)
            label_annotator = sv.LabelAnnotator()
            
            # Annotate image
            annotated_image = image.copy()
            annotated_image = mask_annotator.annotate(annotated_image, detections_sv)
            annotated_image = box_annotator.annotate(annotated_image, detections_sv)
            annotated_image = label_annotator.annotate(annotated_image, detections_sv)
            
            # Save overlay
            overlay_path = os.path.join(debug_dir, "segmented_overlay.png")
            cv2.imwrite(overlay_path, annotated_image)
            print(f"✅ Saved annotated overlay to {overlay_path}")
                
        print("END BOUNDARY DETECTION")
        
        return detections_list


# Legacy function for backward compatibility
def detect_walls(image_path, model_id="cubicasa5k-2-qpmsa/6"):
    """
    Legacy function - Analyze a floor plan image and return detection information as JSON.
    
    Args:
        image_path (str): Path to the floor plan image
        model_id (str): Roboflow model ID to use for inference
        
    Returns:
        list: JSON list of detections
    """
    client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=os.getenv("ROBOFLOW_API_KEY")
    )
    
    # Get image dimensions for normalization
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not load image from {image_path}")
        return []
    
    img_height, img_width = image.shape[:2]
    
    # Run inference
    result = client.infer(image_path, model_id=model_id)
    
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
    # Create output directory if it doesn't exist
    output_dir = "./backend/boundary_debug"
    os.makedirs(output_dir, exist_ok=True)
    
    image_path = "./backend/boundary_debug/floor-plan-5.png"
    detections = detect_walls(image_path)
    
    # Print JSON output
    print("=" * 80)
    print("WALL DETECTION JSON OUTPUT:")
    print("=" * 80)
    print(json.dumps(detections, indent=2))
    print("\n")
    
    # Save to file
    output_file = "./backend/boundary_debug/wall_detections.json"
    with open(output_file, "w") as f:
        json.dump(detections, f, indent=2)
    print(f"💾 Saved wall detections to {output_file}")
    
    # Get the raw result for visualization
    client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=os.getenv("ROBOFLOW_API_KEY")
    )
    result = client.infer(image_path, model_id="cubicasa5k-2-qpmsa/6")
    
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
    out_path = "./backend/boundary_debug/segmented_overlay.png"
    cv2.imwrite(out_path, image)
    print("\n" + "=" * 80)
    print(f"✅ Saved annotated overlay to {out_path}")
    print("=" * 80)