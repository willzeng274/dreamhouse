"""
Furniture Segmentation and Classification Service

Adapts the seg-class.py logic for use in the FastAPI backend.
Segments furniture objects from floorplan images and classifies them.
"""

import os
import base64
import io
import json
from typing import List, Dict, Any, Tuple
import cv2
import numpy as np
from openai import OpenAI
from ultralytics import FastSAM
from PIL import Image
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


# Furniture types - classified by shape/aspect ratio, NOT size
# NOTE: Size doesn't matter! A small bedside table is still a table, just smaller.
FURNITURE_TYPES = [
    # Architectural elements
    {
        "id": "door",
        "name": "Door",
        "aspect_ratio": "wide (2.5:1)",
        "description": "Thin rectangular, usually along walls",
    },
    {
        "id": "window",
        "name": "Window",
        "aspect_ratio": "wide (4:1)",
        "description": "Very thin rectangular along walls",
    },
    {
        "id": "wall",
        "name": "Wall",
        "aspect_ratio": "very wide (15:1)",
        "description": "Long thin lines",
    },
    # Bedroom furniture
    {
        "id": "bed",
        "name": "Bed",
        "aspect_ratio": "rectangular (3:4)",
        "description": "Medium rectangle, usually against wall",
    },
    {
        "id": "dresser",
        "name": "Dresser",
        "aspect_ratio": "wide (2.5:1)",
        "description": "Wide shallow rectangle against wall",
    },
    # Seating
    {
        "id": "chair",
        "name": "Chair",
        "aspect_ratio": "square (1:1)",
        "description": "Small square or circular, any size",
    },
    {
        "id": "couch",
        "name": "Couch/Sofa",
        "aspect_ratio": "wide (2:1)",
        "description": "Long rectangle, usually against wall",
    },
    # Tables - SIZE DOESN'T MATTER! Bedside table is still a table, just smaller
    {
        "id": "table",
        "name": "Table",
        "aspect_ratio": "square to rectangular (1:1 to 3:2)",
        "description": "Square or slightly rectangular, can be any size (dining table, coffee table, side table, bedside table, etc.)",
    },
    {
        "id": "desk",
        "name": "Desk",
        "aspect_ratio": "rectangular (2:1)",
        "description": "Rectangular, often against wall",
    },
    # Bathroom fixtures
    {
        "id": "toilet",
        "name": "Toilet",
        "aspect_ratio": "tall (1:1.5)",
        "description": "Small, slightly taller than wide",
    },
    {
        "id": "sink",
        "name": "Sink",
        "aspect_ratio": "square (1:1)",
        "description": "Small square, usually wall-mounted",
    },
    {
        "id": "bathtub",
        "name": "Bathtub",
        "aspect_ratio": "rectangular (2:1)",
        "description": "Long rectangle",
    },
    {
        "id": "shower",
        "name": "Shower",
        "aspect_ratio": "square (1:1)",
        "description": "Square enclosure",
    },
    # Kitchen appliances
    {
        "id": "kitchen_counter",
        "name": "Kitchen Counter",
        "aspect_ratio": "very wide (4:1)",
        "description": "Long thin rectangle along wall",
    },
    {
        "id": "refrigerator",
        "name": "Refrigerator",
        "aspect_ratio": "square to tall (1:1.3)",
        "description": "Slightly taller than wide",
    },
    {
        "id": "oven",
        "name": "Oven/Stove",
        "aspect_ratio": "square (1:1)",
        "description": "Square appliance",
    },
    {
        "id": "dishwasher",
        "name": "Dishwasher",
        "aspect_ratio": "square (1:1)",
        "description": "Square, built into counter",
    },
    # Storage
    {
        "id": "cabinet",
        "name": "Cabinet",
        "aspect_ratio": "rectangular (2:1)",
        "description": "Rectangular storage",
    },
    {
        "id": "closet",
        "name": "Closet",
        "aspect_ratio": "rectangular (1.5:1)",
        "description": "Rectangular enclosed space",
    },
    # Other
    {
        "id": "stairs",
        "name": "Stairs",
        "aspect_ratio": "tall (1:2.5)",
        "description": "Vertical rectangle with steps",
    },
    {
        "id": "other",
        "name": "Other/Unknown",
        "aspect_ratio": "any",
        "description": "Unknown object",
    },
]


class SegmentationService:
    def __init__(self, model_path: str = "FastSAM-s.pt"):
        """
        Initialize the segmentation service.

        Args:
            model_path: Path to the FastSAM model file
        """
        self.model_path = model_path
        self.model = None
        self.openai_api_key = os.environ.get("OPENAI_API_KEY")
        self.openai_model = "gpt-4o"  # Latest and most capable model

    def _load_model(self):
        """Lazy load the FastSAM model."""
        if self.model is None:
            self.model = FastSAM(self.model_path)

    def _calculate_mask_overlap(self, mask1: np.ndarray, mask2: np.ndarray) -> float:
        """Calculate the overlap percentage between two masks."""
        intersection = np.logical_and(mask1, mask2)
        intersection_area = np.sum(intersection)

        area1 = np.sum(mask1)
        area2 = np.sum(mask2)

        smaller_area = min(area1, area2)
        overlap = intersection_area / smaller_area if smaller_area > 0 else 0.0

        return overlap

    def _filter_masks(
        self,
        masks,
        img_shape,
        max_size_ratio: float = 0.5,
        overlap_threshold: float = 0.5,
    ) -> List[int]:
        """
        Filter masks based on size and overlap criteria (from segment_image.py).

        Returns:
            List of indices of masks to keep
        """
        img_height, img_width = img_shape[:2]
        num_masks = len(masks)

        if num_masks == 0:
            return []

        # Store mask data
        mask_data = []

        for i, mask in enumerate(masks):
            # Convert to numpy
            if hasattr(mask, "cpu"):
                mask_np = mask.cpu().numpy().astype(np.float32)
            else:
                mask_np = mask.astype(np.float32)

            # Resize to image dimensions
            if mask_np.shape != (img_height, img_width):
                mask_np = cv2.resize(mask_np, (img_width, img_height))

            mask_bool = mask_np > 0.5

            # Get bounding box
            coords = np.argwhere(mask_bool)
            if len(coords) == 0:
                continue

            y1, x1 = coords.min(axis=0)
            y2, x2 = coords.max(axis=0)
            width = x2 - x1 + 1
            height = y2 - y1 + 1
            area = np.sum(mask_bool)

            # Check size ratio
            width_ratio = width / img_width
            height_ratio = height / img_height

            if width_ratio > max_size_ratio or height_ratio > max_size_ratio:
                print(
                    f"  Filtering mask {i}: too large "
                    f"(width: {width_ratio:.1%}, height: {height_ratio:.1%})"
                )
                continue

            mask_data.append(
                {
                    "index": i,
                    "mask": mask_bool,
                    "area": area,
                }
            )

        # Sort by area (largest first)
        mask_data.sort(key=lambda x: x["area"], reverse=True)

        # Filter overlapping masks
        to_keep = []
        to_remove = set()

        for i in range(len(mask_data)):
            if i in to_remove:
                continue

            to_keep.append(mask_data[i]["index"])
            mask_i = mask_data[i]["mask"]

            # Check overlap with remaining masks
            for j in range(i + 1, len(mask_data)):
                if j in to_remove:
                    continue

                mask_j = mask_data[j]["mask"]

                # Calculate overlap
                overlap = self._calculate_mask_overlap(mask_i, mask_j)

                # If overlap exceeds threshold, remove smaller mask (j)
                if overlap > overlap_threshold:
                    to_remove.add(j)
                    print(
                        f"  Filtering mask {mask_data[j]['index']}: "
                        f"overlaps with mask {mask_data[i]['index']} by {overlap:.1%}"
                    )

        return sorted(to_keep)

    def _segment_image(
        self,
        image: np.ndarray,
        conf: float = 0.4,
        iou: float = 0.9,
        enable_filtering: bool = True,
        max_size_ratio: float = 0.5,
        overlap_threshold: float = 0.5,
    ) -> Tuple[Any, List[Dict]]:
        """
        Segment objects from an image using FastSAM with filtering.

        Args:
            image: Input image as numpy array
            conf: Confidence threshold
            iou: IOU threshold
            enable_filtering: Enable mask filtering
            max_size_ratio: Maximum size ratio for masks
            overlap_threshold: Overlap threshold for filtering

        Returns:
            Tuple of (results, detected_objects)
        """
        self._load_model()

        img_height, img_width = image.shape[:2]

        # Run FastSAM
        results = self.model(
            image,
            device="cpu",
            retina_masks=True,
            imgsz=1024,
            conf=conf,
            iou=iou,
        )

        detected_objects = []

        for result in results:
            if hasattr(result, "masks") and result.masks is not None:
                masks = result.masks.data
                boxes = result.boxes.xyxy if hasattr(result, "boxes") else None

                num_masks_before = len(masks)
                print(
                    f"  Number of segments detected (before filtering): {num_masks_before}"
                )

                # Apply filtering if enabled
                if enable_filtering and num_masks_before > 0:
                    print(f"  Applying filters:")
                    print(f"    - Max size ratio: {max_size_ratio:.0%}")
                    print(f"    - Overlap threshold: {overlap_threshold:.0%}")

                    keep_indices = self._filter_masks(
                        masks,
                        image.shape,
                        max_size_ratio=max_size_ratio,
                        overlap_threshold=overlap_threshold,
                    )

                    print(f"  Number of segments after filtering: {len(keep_indices)}")
                else:
                    keep_indices = list(range(num_masks_before))

                for idx, i in enumerate(keep_indices):
                    mask = masks[i]

                    # Convert mask to numpy
                    if hasattr(mask, "cpu"):
                        mask_np = mask.cpu().numpy().astype(np.float32)
                    else:
                        mask_np = mask.astype(np.float32)

                    # Resize mask to match image
                    mask_resized = cv2.resize(mask_np, (img_width, img_height))
                    mask_bool = mask_resized > 0.5

                    # Get bounding box
                    if boxes is not None and i < len(boxes):
                        box = (
                            boxes[i].cpu().numpy()
                            if hasattr(boxes[i], "cpu")
                            else boxes[i]
                        )
                        x1, y1, x2, y2 = box
                    else:
                        # Calculate from mask
                        coords = np.argwhere(mask_bool)
                        if len(coords) == 0:
                            continue
                        y1, x1 = coords.min(axis=0)
                        y2, x2 = coords.max(axis=0)

                    # Calculate dimensions
                    width_pixels = float(x2 - x1)
                    height_pixels = float(y2 - y1)
                    area_pixels = float(np.sum(mask_bool))

                    # Normalize
                    width_norm = width_pixels / img_width
                    height_norm = height_pixels / img_height
                    area_norm = area_pixels / (img_width * img_height)

                    obj = {
                        "id": len(detected_objects) + 1,
                        "bbox_pixels": {
                            "x1": int(x1),
                            "y1": int(y1),
                            "x2": int(x2),
                            "y2": int(y2),
                        },
                        "bbox_normalized": {
                            "x1": float(x1 / img_width),
                            "y1": float(y1 / img_height),
                            "x2": float(x2 / img_width),
                            "y2": float(y2 / img_height),
                        },
                        "dimensions_pixels": {
                            "width": width_pixels,
                            "height": height_pixels,
                        },
                        "dimensions_normalized": {
                            "width": width_norm,
                            "height": height_norm,
                        },
                        "area_pixels": area_pixels,
                        "area_normalized": area_norm,
                        "mask_index": i,  # Original index before filtering
                        "filtered_index": idx,  # Index in filtered list
                    }

                    detected_objects.append(obj)

        return results, detected_objects

    def _encode_image_to_base64(self, image: np.ndarray) -> str:
        """Encode a numpy image array to base64 string."""
        _, buffer = cv2.imencode(".jpg", image)
        return base64.b64encode(buffer).decode("utf-8")

    def _extract_object_image(
        self,
        original_image: np.ndarray,
        mask_bool: np.ndarray,
        bbox_pixels: Dict,
        padding: int = 5,
    ) -> np.ndarray:
        """Extract and mask out a single object from the original image."""
        img_height, img_width = original_image.shape[:2]

        # Get bounding box with padding
        x1 = max(0, bbox_pixels["x1"] - padding)
        y1 = max(0, bbox_pixels["y1"] - padding)
        x2 = min(img_width, bbox_pixels["x2"] + padding)
        y2 = min(img_height, bbox_pixels["y2"] + padding)

        # Crop the region
        cropped_img = original_image[y1:y2, x1:x2].copy()
        cropped_mask = mask_bool[y1:y2, x1:x2]

        # Apply mask - set non-object pixels to white background
        white_background = np.ones_like(cropped_img) * 255
        result = np.where(cropped_mask[:, :, np.newaxis], cropped_img, white_background)

        return result.astype(np.uint8)

    def _create_highlighted_image(
        self,
        original_image: np.ndarray,
        bbox_pixels: Dict,
    ) -> np.ndarray:
        """
        Create a copy of the full image with a transparent colored box highlighting the object.
        This gives maximum context while clearly indicating which object to classify.
        """
        # Create a copy of the full image
        highlighted_img = original_image.copy()
        img_height, img_width = original_image.shape[:2]

        # Create an overlay for the transparent box
        overlay = highlighted_img.copy()

        x1 = bbox_pixels["x1"]
        y1 = bbox_pixels["y1"]
        x2 = bbox_pixels["x2"]
        y2 = bbox_pixels["y2"]

        # Add 10% padding on each side so highlight doesn't cover object border
        width = x2 - x1
        height = y2 - y1
        padding_x = int(width * 0.10)
        padding_y = int(height * 0.10)

        # Expand bounding box with padding (ensure within image bounds)
        x1_padded = max(0, x1 - padding_x)
        y1_padded = max(0, y1 - padding_y)
        x2_padded = min(img_width, x2 + padding_x)
        y2_padded = min(img_height, y2 + padding_y)

        # Draw a semi-transparent colored rectangle (orange/red)
        cv2.rectangle(
            overlay, (x1_padded, y1_padded), (x2_padded, y2_padded), (0, 100, 255), -1
        )  # Filled rectangle in orange

        # Blend the overlay with the original image (30% opacity)
        alpha = 0.3
        cv2.addWeighted(overlay, alpha, highlighted_img, 1 - alpha, 0, highlighted_img)

        # Draw a solid border around the padded object (brighter red)
        cv2.rectangle(
            highlighted_img,
            (x1_padded, y1_padded),
            (x2_padded, y2_padded),
            (0, 0, 255),
            3,
        )  # Thick red border

        return highlighted_img

    def _reconstruct_masks(
        self, image: np.ndarray, detected_objects: List[Dict], results: Any
    ) -> List[np.ndarray]:
        """Reconstruct mask booleans from the segmentation results."""
        img_height, img_width = image.shape[:2]
        masks_bool = []

        for result in results:
            if hasattr(result, "masks") and result.masks is not None:
                masks = result.masks.data
                for mask in masks:
                    if hasattr(mask, "cpu"):
                        mask_np = mask.cpu().numpy().astype(np.float32)
                    else:
                        mask_np = mask.astype(np.float32)

                    mask_resized = cv2.resize(mask_np, (img_width, img_height))
                    mask_bool = mask_resized > 0.5
                    masks_bool.append(mask_bool)

        return masks_bool

    def _classify_single_object_with_openai(
        self,
        client: OpenAI,
        full_image: np.ndarray,
        highlighted_image: np.ndarray,
        obj_info: Dict,
        object_number: int,
    ) -> Dict:
        """Classify a single object with OpenAI vision API for better accuracy."""

        # Create furniture list description (focus on aspect ratio, NOT size)
        furniture_list = "\n".join(
            [
                f"- {f['id']}: {f['name']} - Aspect ratio: {f['aspect_ratio']} - {f['description']}"
                for f in FURNITURE_TYPES
            ]
        )

        # Calculate aspect ratio for this object
        width = obj_info["dimensions_normalized"]["width"]
        height = obj_info["dimensions_normalized"]["height"]
        aspect_ratio = width / height if height > 0 else 1.0

        # Object description (focus on shape, not size!)
        obj_desc = (
            f"Aspect ratio: {aspect_ratio:.2f}:1 "
            f"({'wider than tall' if aspect_ratio > 1.2 else 'taller than wide' if aspect_ratio < 0.8 else 'roughly square'})"
        )

        # Create focused prompt for single object
        prompt = f"""You are an interior designer analyzing ONE object in an ARCHITECTURAL FLOOR PLAN viewed from TOP-DOWN (bird's eye view).

IMPORTANT CONTEXT:
- This is a TOP-DOWN/OVERHEAD view of a floor plan
- All objects are seen from directly above
- Image 1: ENTIRE floor plan (clean - for overall context)
- Image 2: SAME floor plan with ONE OBJECT highlighted with SEMI-TRANSPARENT ORANGE BOX and RED BORDER
- Focus on classifying ONLY the highlighted object

OBJECT TO CLASSIFY:
{obj_desc}

AVAILABLE FURNITURE/FIXTURE TYPES (classified by ASPECT RATIO and SHAPE, not absolute size):
{furniture_list}

CRITICAL CLASSIFICATION RULES:
1. SIZE DOESN'T MATTER! Focus on ASPECT RATIO (width:height ratio) and SHAPE only
   - Example: A small bedside table is still a "table" - size doesn't change its category
   - Example: A small 2-person dining table is still a "table" - same as a large 10-person table
   - Example: A single chair and an armchair are both "chair" - size varies but aspect ratio is similar

2. TOP-DOWN VIEW SHAPES:
   - Beds: Rectangular (3:4 aspect ratio), usually against wall
   - Tables: Square to rectangular (1:1 to 3:2), ANY SIZE (coffee table, dining table, side table, bedside table all = "table")
   - Chairs: Square/circular (1:1), ANY SIZE
   - Sofas: Wide rectangle (2:1), against wall
   - Desks: Rectangular (2:1), often against wall

3. USE FULL CONTEXT for room type identification:
   - Where is it positioned relative to walls, doors, windows?
   - What room is this in? (bedroom, kitchen, bathroom, living room)
   - What other furniture is nearby? (bed+dresser+small table = bedroom furniture)

4. RELATIONSHIPS HELP IDENTIFY ROOM TYPE (but not object size):
   - bed+dresser+small table (bedside) = bedroom
   - table+chairs = dining area or kitchen
   - sink+toilet+bathtub = bathroom
   - counter+refrigerator+oven = kitchen

5. IGNORE ABSOLUTE SIZE - Use only:
   - Aspect ratio (shape proportions)
   - Position in room (wall-aligned, centered, cornered)
   - Surrounding context (what room type, what's nearby)
   - Top-down shape appearance

Classify the highlighted object based ONLY on:
- Its ASPECT RATIO and SHAPE from top-down view (NOT absolute size!)
- Its position in the room (wall-aligned, centered, cornered)
- Surrounding objects and room type
- Typical furniture arrangements and relationships

Return ONLY a JSON object in this exact format:
{{
  "furniture_id": "<id from available types>",
  "furniture_name": "<name from available types>",
  "confidence": "high|medium|low",
  "reasoning": "<detailed explanation focusing on aspect ratio, position, and context - NOT size>"
}}
"""

        try:
            # Build content array with text prompt and images
            content = [{"type": "text", "text": prompt}]

            # First, add the FULL floor plan image for overall context
            full_image_base64 = self._encode_image_to_base64(full_image)
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{full_image_base64}",
                        "detail": "low",
                    },
                }
            )

            # Add the highlighted image showing THIS specific object
            highlighted_base64 = self._encode_image_to_base64(highlighted_image)
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{highlighted_base64}",
                        "detail": "high",  # Use high detail to see the highlight clearly
                    },
                }
            )

            # Call OpenAI API with focused tokens for single object
            response = client.chat.completions.create(
                model=self.openai_model,
                messages=[{"role": "user", "content": content}],
                max_tokens=500,  # Less tokens needed for single object
                temperature=0.1,  # Very low temperature for consistent classification
            )

            # Parse the response
            response_text = response.choices[0].message.content.strip()

            # Extract JSON from response
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()

            classification = json.loads(response_text)

            # Add object number
            classification["object_number"] = object_number

            return classification

        except Exception as e:
            print(f"Error classifying object #{object_number}: {e}")
            import traceback

            traceback.print_exc()

            # Return error classification
            return {
                "object_number": object_number,
                "furniture_id": "other",
                "furniture_name": "Other/Unknown",
                "confidence": "error",
                "reasoning": f"Classification failed: {str(e)}",
            }

    def _classify_objects_individually(
        self,
        full_image: np.ndarray,
        object_images_and_info: List[Tuple[np.ndarray, Dict]],
        highlighted_images: List[np.ndarray],
    ) -> List[Dict]:
        """Classify each object individually for better accuracy."""
        if not self.openai_api_key:
            print("Warning: OPENAI_API_KEY not set, skipping classification")
            return [
                {
                    "object_number": i + 1,
                    "furniture_id": "other",
                    "furniture_name": "Other/Unknown",
                    "confidence": "unknown",
                    "reasoning": "No API key",
                }
                for i in range(len(object_images_and_info))
            ]

        # Initialize OpenAI client
        client = OpenAI(api_key=self.openai_api_key)

        classifications = []

        # Classify each object individually
        for i, ((obj_image, obj_info), highlighted_img) in enumerate(
            zip(object_images_and_info, highlighted_images)
        ):
            print(f"  Classifying object {i+1}/{len(object_images_and_info)}...")

            classification = self._classify_single_object_with_openai(
                client=client,
                full_image=full_image,
                highlighted_image=highlighted_img,
                obj_info=obj_info,
                object_number=i + 1,
            )

            classifications.append(classification)

            # Show result immediately
            print(
                f"    → {classification.get('furniture_name', 'Unknown')} "
                f"(confidence: {classification.get('confidence', 'unknown')})"
            )

        return classifications

    async def extract_and_classify_furniture(
        self,
        image_bytes: bytes,
        conf: float = 0.4,
        iou: float = 0.9,
        enable_filtering: bool = True,
        max_size_ratio: float = 0.5,
        overlap_threshold: float = 0.5,
        save_debug_images: bool = True,
        debug_output_dir: str = "classification_debug",
    ) -> List[Dict[str, Any]]:
        """
        Main function to extract and classify furniture from a floorplan image.

        Args:
            image_bytes: Floorplan image as bytes
            conf: Confidence threshold for segmentation
            iou: IOU threshold for segmentation
            enable_filtering: Enable mask filtering
            max_size_ratio: Maximum size ratio for masks
            overlap_threshold: Overlap threshold for filtering

        Returns:
            List of classified furniture objects
        """
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Could not decode image")

        # Check OpenAI API key
        if self.openai_api_key:
            print(f"✓ OpenAI API key found (length: {len(self.openai_api_key)})")
        else:
            print("✗ WARNING: OPENAI_API_KEY not set - classification will be skipped!")

        # Segment the image with filtering
        print(f"Segmenting image...")
        results, detected_objects = self._segment_image(
            image,
            conf=conf,
            iou=iou,
            enable_filtering=enable_filtering,
            max_size_ratio=max_size_ratio,
            overlap_threshold=overlap_threshold,
        )

        if not detected_objects:
            print("No objects detected in the image")
            return []

        print(f"Found {len(detected_objects)} objects")

        # Reconstruct masks
        print("Reconstructing masks...")
        masks_bool = self._reconstruct_masks(image, detected_objects, results)

        # Create highlighted images - one for each object showing full floorplan
        print("Creating highlighted images for classification...")
        object_images_and_info = []
        highlighted_images = []

        for i, obj in enumerate(detected_objects):
            if i < len(masks_bool):
                mask_bool = masks_bool[i]

                # Keep the masked object extraction for backward compatibility/reference
                object_image = self._extract_object_image(
                    image, mask_bool, obj["bbox_pixels"], padding=10
                )

                # Create full image with THIS object highlighted (NEW approach)
                highlighted_image = self._create_highlighted_image(
                    image, obj["bbox_pixels"]
                )

                object_images_and_info.append((object_image, obj))
                highlighted_images.append(highlighted_image)

        if not object_images_and_info:
            print("No objects to classify")
            return []

        # Save debug images if enabled
        if save_debug_images:
            import os
            from datetime import datetime

            # Create debug directory with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            debug_dir = f"{debug_output_dir}/{timestamp}"
            os.makedirs(debug_dir, exist_ok=True)

            print(f"\nSaving debug images to: {debug_dir}/")

            # Save the clean full floorplan
            clean_path = f"{debug_dir}/00_full_floorplan_clean.jpg"
            cv2.imwrite(clean_path, image)
            print(f"  Saved clean floorplan: {clean_path}")

            # Save each highlighted image
            for i, highlighted_img in enumerate(highlighted_images):
                obj = detected_objects[i]
                highlighted_path = f"{debug_dir}/{i+1:02d}_object_{i+1}_highlighted.jpg"
                cv2.imwrite(highlighted_path, highlighted_img)
                print(f"  Saved highlighted object #{i+1}: {highlighted_path}")

            print(f"\n✓ Saved {len(highlighted_images) + 1} debug images\n")

        # Classify each object individually with full image context and highlights
        print(
            f"\nClassifying {len(object_images_and_info)} objects individually for better accuracy..."
        )
        classifications = self._classify_objects_individually(
            image,  # Pass full floorplan image (clean, no highlights)
            object_images_and_info,
            highlighted_images,  # Pass full images with individual object highlights
        )

        # Combine segmentation info with classifications
        classified_objects = []

        for i, ((obj_image, obj), classification) in enumerate(
            zip(object_images_and_info, classifications)
        ):
            # Find the aspect ratio for the classified furniture
            furniture_id = classification.get("furniture_id", "other")
            furniture_aspect_ratio = "any"
            furniture_description = ""
            for furniture in FURNITURE_TYPES:
                if furniture["id"] == furniture_id:
                    furniture_aspect_ratio = furniture["aspect_ratio"]
                    furniture_description = furniture["description"]
                    break

            # Calculate this object's aspect ratio
            width = obj["dimensions_normalized"]["width"]
            height = obj["dimensions_normalized"]["height"]
            obj_aspect_ratio = width / height if height > 0 else 1.0

            # Combine segmentation info with classification
            classified_obj = {
                **obj,  # All original segmentation data
                "classification": {
                    "furniture_id": furniture_id,
                    "furniture_name": classification.get(
                        "furniture_name", "Other/Unknown"
                    ),
                    "confidence": classification.get("confidence", "unknown"),
                    "reasoning": classification.get("reasoning", ""),
                    "aspect_ratio": {
                        "value": float(obj_aspect_ratio),
                        "typical": furniture_aspect_ratio,
                        "description": furniture_description,
                    },
                },
            }
            classified_objects.append(classified_obj)

        print(f"Successfully classified {len(classified_objects)} objects")
        return classified_objects
