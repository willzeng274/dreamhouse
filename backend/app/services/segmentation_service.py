"""
Furniture Segmentation and Classification Service

Adapts the seg-class.py logic for use in the FastAPI backend.
Segments furniture objects from floorplan images and classifies them.
"""

import os
import base64
import io
import json
import asyncio
from typing import List, Dict, Any, Tuple
import cv2
import numpy as np
from google import genai
from google.genai import types as gemini_types
from anthropic import AsyncAnthropic
from ultralytics import FastSAM
from PIL import Image
from dotenv import load_dotenv
from app.config import get_settings
from prompts import REALISTIC_FLOORPLAN_FOR_CLASSIFICATION_PROMPT

# Load environment variables from .env file
load_dotenv()


FURNITURE_TYPES = [
    "door",
    "window",
    "wall",
    "bed",
    "chair",
    "table",
    "couch",
    "toilet",
    "sink",
    "bathtub",
    "shower",
    "kitchen counter",
    "refrigerator",
    "oven",
    "dishwasher",
    "stairs",
    "closet",
    "cabinet",
    "desk",
    "dresser",
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

        # Use Gemini for realistic rendering
        settings = get_settings()
        self.gemini_api_key = settings.gemini_api_key
        self.gemini_client = (
            genai.Client(api_key=self.gemini_api_key).aio
            if self.gemini_api_key
            else None
        )

        # Use Claude Sonnet 4.5 for classification (excellent vision & agent capabilities)
        self.anthropic_api_key = settings.anthropic_api_key
        self.anthropic_client = (
            AsyncAnthropic(api_key=self.anthropic_api_key)
            if self.anthropic_api_key
            else None
        )
        self.classification_model = "claude-sonnet-4-5-20250929"  # Best vision model

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
        padding_percent: float = 0.20,  # 20% padding on each side
    ) -> np.ndarray:
        """Extract and mask out a single object from the original image with generous padding."""
        img_height, img_width = original_image.shape[:2]

        # Calculate padding based on object size (10-20% on each side)
        width = bbox_pixels["x2"] - bbox_pixels["x1"]
        height = bbox_pixels["y2"] - bbox_pixels["y1"]
        padding_x = int(width * padding_percent)
        padding_y = int(height * padding_percent)

        # Get bounding box with percentage-based padding
        x1 = max(0, bbox_pixels["x1"] - padding_x)
        y1 = max(0, bbox_pixels["y1"] - padding_y)
        x2 = min(img_width, bbox_pixels["x2"] + padding_x)
        y2 = min(img_height, bbox_pixels["y2"] + padding_y)

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

    async def _generate_realistic_floorplan(
        self, floorplan_image: np.ndarray
    ) -> np.ndarray:
        """
        Generate a realistic top-down rendered version of the floorplan.
        Uses Gemini image generation to make furniture easier to identify.
        """
        if not self.gemini_client:
            print("Warning: Cannot generate realistic version without Gemini API key")
            return floorplan_image  # Return original if no API key

        try:
            print("  Generating realistic rendered version of floorplan...")

            # Encode floorplan to bytes
            _, buffer = cv2.imencode(".jpg", floorplan_image)
            floorplan_bytes = buffer.tobytes()

            # Build content for Gemini
            parts = [
                gemini_types.Part.from_bytes(
                    data=floorplan_bytes, mime_type="image/jpeg"
                ),
                gemini_types.Part(text=REALISTIC_FLOORPLAN_FOR_CLASSIFICATION_PROMPT),
            ]

            # Generate realistic version
            response = await self.gemini_client.models.generate_content(
                model="gemini-2.5-flash-image",  # Image generation model
                contents=parts,
            )

            # Extract generated image
            image_parts = [
                part.inline_data.data
                for part in response.candidates[0].content.parts
                if part.inline_data
            ]

            if image_parts:
                # Convert bytes to numpy array
                nparr = np.frombuffer(image_parts[0], np.uint8)
                realistic_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if realistic_image is not None:
                    print("  ✓ Successfully generated realistic version")
                    return realistic_image
                else:
                    print("  ✗ Failed to decode generated image, using original")
                    return floorplan_image
            else:
                print("  ✗ No image generated, using original")
                return floorplan_image

        except Exception as e:
            print(f"  ✗ Error generating realistic version: {e}")
            import traceback

            traceback.print_exc()
            return floorplan_image  # Fallback to original

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

    async def _classify_single_object_with_claude(
        self,
        full_image: np.ndarray,
        highlighted_image: np.ndarray,
        masked_crop: np.ndarray,
        obj_info: Dict,
        object_number: int,
    ) -> Dict:
        """Classify a single object with Claude Sonnet 4.5 vision API."""

        # Create furniture list
        furniture_list = "\n".join([f"- {f}" for f in FURNITURE_TYPES])

        # Calculate aspect ratio for this object
        width = obj_info["dimensions_normalized"]["width"]
        height = obj_info["dimensions_normalized"]["height"]
        aspect_ratio = width / height if height > 0 else 1.0

        # Create focused prompt for single object
        prompt = f"""You are a furniture evaluation agent. Your objective is to categorize furniture highlighted within a top-down, 2D floor plan.

You will be provided the following data:
- A top-down, 2D image of the entire floorplan, with all furniture, fixtures, architecture, rooms, etc.
- A top-down, photorealistic image of the rendered interior, corresponding exactly to the floorplan.
- A duplicate of the top-down photorealistic image with a specific piece of furniture highlighted.
- A zoomed in image of the piece of furniture in isolated.

Your objective is to classify and categorize the piece of furniture based on the data provided to you (images, list of available furniture).

Available furniture/fixture types (YOU MUST PICK THE furniture_type FROM THIS LIST):
{furniture_list}

Return ONLY a JSON object in this exact format:
{{
    "furniture_type": "<type from available types>",
    "confidence": "high|medium|low",
    "reasoning": "<detailed explanation: What do you SEE (texture/color)? Aspect ratio? Position? Room context?>",
    "rotation": <rotation angle in degrees (0-360), where 0 is north/top of image, 90 is east/right, 180 is south/bottom, 270 is west/left>
}}

Pick correctly!"""

        try:
            # Build content for Claude
            content = [{"type": "text", "text": prompt}]

            # Image 1: FULL realistic floor plan (clean) for overall context
            full_base64 = self._encode_image_to_base64(full_image)
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": full_base64,
                    },
                }
            )

            # Image 2: FULL realistic floor plan with highlighted object (spatial context)
            highlighted_base64 = self._encode_image_to_base64(highlighted_image)
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": highlighted_base64,
                    },
                }
            )

            # Image 3: CLOSE-UP masked crop (detailed view of object with generous padding)
            crop_base64 = self._encode_image_to_base64(masked_crop)
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": crop_base64,
                    },
                }
            )

            # Call Claude Sonnet 4.5 API (async)
            response = await self.anthropic_client.messages.create(
                model=self.classification_model,
                max_tokens=500,
                temperature=0.1,
                messages=[{"role": "user", "content": content}],
            )

            # Parse the response
            response_text = response.content[0].text.strip()

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
                "furniture_type": "other",
                "confidence": "error",
                "reasoning": f"Classification failed: {str(e)}",
            }

    async def _classify_objects_individually(
        self,
        full_image: np.ndarray,
        object_images_and_info: List[Tuple[np.ndarray, Dict]],
        highlighted_images: List[np.ndarray],
    ) -> List[Dict]:
        """Classify all objects in parallel for speed."""
        if not self.anthropic_api_key or not self.anthropic_client:
            print("Warning: ANTHROPIC_API_KEY not set, skipping classification")
            return [
                {
                    "object_number": i + 1,
                    "furniture_type": "other",
                    "confidence": "unknown",
                    "reasoning": "No API key",
                }
                for i in range(len(object_images_and_info))
            ]

        # Create classification tasks for all objects
        print(
            f"  Creating {len(object_images_and_info)} parallel classification tasks..."
        )

        tasks = []
        for i, ((masked_crop, obj_info), highlighted_img) in enumerate(
            zip(object_images_and_info, highlighted_images)
        ):
            task = self._classify_single_object_with_claude(
                full_image=full_image,
                highlighted_image=highlighted_img,
                masked_crop=masked_crop,
                obj_info=obj_info,
                object_number=i + 1,
            )
            tasks.append(task)

        # Run all classifications in parallel
        print(f"  Running {len(tasks)} classifications in parallel...")
        classifications = await asyncio.gather(*tasks)

        # Show all results
        print(f"\n  Classification results:")
        for classification in classifications:
            obj_num = classification.get("object_number", "?")
            print(
                f"    Object {obj_num}: {classification.get('furniture_name', 'Unknown')} "
                f"(confidence: {classification.get('confidence', 'unknown')})"
            )

        return classifications

    async def _match_object_to_model_variation(
        self,
        cropped_object: np.ndarray,
        furniture_type: str,
        floorplan_items_dir: str = "floorplan_items",
    ) -> int:
        """
        Match a cropped object image to the best model variation using Claude 4.5 Sonnet.

        Args:
            cropped_object: The cropped/masked object image
            furniture_type: The type of furniture (e.g., "door", "bed")
            floorplan_items_dir: Path to the floorplan_items directory

        Returns:
            Index of the best matching variation (0-based)
        """
        if not self.anthropic_api_key or not self.anthropic_client:
            print(
                f"  Warning: No API key, defaulting to variation 0 for {furniture_type}"
            )
            return 0

        # Build path to furniture type folder
        furniture_dir = os.path.join(floorplan_items_dir, furniture_type)

        if not os.path.exists(furniture_dir):
            print(f"  Warning: Furniture directory not found: {furniture_dir}")
            return 0

        # Find all variation folders
        variation_folders = sorted(
            [
                d
                for d in os.listdir(furniture_dir)
                if d.startswith("variation_")
                and os.path.isdir(os.path.join(furniture_dir, d))
            ]
        )

        if not variation_folders:
            print(f"  Warning: No variations found for {furniture_type}")
            return 0

        print(f"  Found {len(variation_folders)} variations for {furniture_type}")

        # Load product images from each variation
        variation_images = []
        valid_variations = []

        for var_folder in variation_folders:
            product_image_path = os.path.join(
                furniture_dir, var_folder, "product_image.png"
            )
            if os.path.exists(product_image_path):
                img = cv2.imread(product_image_path)
                if img is not None:
                    variation_images.append(img)
                    valid_variations.append(var_folder)

        if not variation_images:
            print(f"  Warning: No valid product images found for {furniture_type}")
            return 0

        print(f"  Loaded {len(variation_images)} product images")

        # Build prompt for Claude
        prompt = f"""You are a furniture matching expert. Your task is to identify which product variation most closely resembles the cropped furniture item from a floorplan.

You will be given:
1. A cropped image of a {furniture_type} from a top-down floorplan view
2. {len(variation_images)} product images showing different variations of {furniture_type}

Carefully examine the cropped object and compare it with each product variation. Consider:
- Overall shape and proportions
- Visual style and design elements
- Color and material appearance
- Any distinctive features

Return ONLY a JSON object in this exact format:
{{
    "best_match_index": <0-based index of the best matching variation>,
    "confidence": "high|medium|low",
    "reasoning": "<brief explanation of why this variation matches best>"
}}

The variations are numbered from 0 to {len(variation_images) - 1}."""

        try:
            # Build content for Claude
            content = [{"type": "text", "text": prompt}]

            # Add the cropped object image
            cropped_base64 = self._encode_image_to_base64(cropped_object)
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": cropped_base64,
                    },
                }
            )

            # Add all variation product images
            for i, var_img in enumerate(variation_images):
                var_base64 = self._encode_image_to_base64(var_img)
                content.append(
                    {
                        "type": "text",
                        "text": f"Variation {i}:",
                    }
                )
                content.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": var_base64,
                        },
                    }
                )

            # Call Claude Sonnet 4.5
            response = await self.anthropic_client.messages.create(
                model=self.classification_model,
                max_tokens=300,
                temperature=0.1,
                messages=[{"role": "user", "content": content}],
            )

            # Parse response
            response_text = response.content[0].text.strip()

            # Extract JSON
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()

            result = json.loads(response_text)
            best_match = result.get("best_match_index", 0)
            confidence = result.get("confidence", "unknown")
            reasoning = result.get("reasoning", "")

            print(f"    Best match: variation {best_match} (confidence: {confidence})")
            print(f"    Reasoning: {reasoning}")

            # Ensure index is valid
            if 0 <= best_match < len(variation_images):
                return best_match
            else:
                print(f"  Warning: Invalid index {best_match}, defaulting to 0")
                return 0

        except Exception as e:
            print(f"  Error matching {furniture_type} to model: {e}")
            import traceback

            traceback.print_exc()
            return 0

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

        # Check API keys
        if self.gemini_api_key:
            print(f"✓ Gemini API key found (for realistic rendering)")
        else:
            print("✗ WARNING: GEMINI_API_KEY not set - will use original schematic")

        if self.anthropic_api_key:
            print(
                f"✓ Anthropic API key found (for classification with Claude Sonnet 4.5)"
            )
        else:
            print(
                "✗ WARNING: ANTHROPIC_API_KEY not set - classification will be skipped!"
            )

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

        # Generate realistic rendered version for better classification
        print("\nGenerating realistic rendered version for classification...")
        realistic_image = await self._generate_realistic_floorplan(image)

        # Create highlighted images and masked crops from realistic version
        print("Extracting objects from realistic version...")
        object_images_and_info = []
        highlighted_images = []

        for i, obj in enumerate(detected_objects):
            if i < len(masks_bool):
                mask_bool = masks_bool[i]

                # Extract masked crop from REALISTIC version with generous 20% padding
                realistic_crop = self._extract_object_image(
                    realistic_image, mask_bool, obj["bbox_pixels"], padding_percent=0.20
                )

                # Create highlighted image from REALISTIC version
                highlighted_realistic = self._create_highlighted_image(
                    realistic_image, obj["bbox_pixels"]
                )

                object_images_and_info.append((realistic_crop, obj))
                highlighted_images.append(highlighted_realistic)

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

            # Save the original schematic floorplan
            original_path = f"{debug_dir}/00a_original_schematic.jpg"
            cv2.imwrite(original_path, image)
            print(f"  Saved original schematic: {original_path}")

            # Save the realistic rendered version
            realistic_path = f"{debug_dir}/00b_realistic_rendered.jpg"
            cv2.imwrite(realistic_path, realistic_image)
            print(f"  Saved realistic rendered: {realistic_path}")

            # Save each highlighted image and masked crop (from realistic version)
            for i, (highlighted_img, (masked_crop, _)) in enumerate(
                zip(highlighted_images, object_images_and_info)
            ):
                obj = detected_objects[i]

                # Save highlighted full realistic image
                highlighted_path = (
                    f"{debug_dir}/{i+1:02d}a_object_{i+1}_highlighted.jpg"
                )
                cv2.imwrite(highlighted_path, highlighted_img)
                print(f"  Saved highlighted object #{i+1}: {highlighted_path}")

                # Save masked crop from realistic version
                crop_path = f"{debug_dir}/{i+1:02d}b_object_{i+1}_crop.jpg"
                cv2.imwrite(crop_path, masked_crop)
                print(f"  Saved realistic crop #{i+1}: {crop_path}")

            print(f"\n✓ Saved {2 + len(highlighted_images) * 2} debug images\n")

        # Classify each object individually with realistic rendered images
        print(
            f"\nClassifying {len(object_images_and_info)} objects individually using realistic renders..."
        )
        classifications = await self._classify_objects_individually(
            realistic_image,  # Pass realistic rendered version (clean, no highlights)
            object_images_and_info,
            highlighted_images,  # Pass realistic images with individual object highlights
        )

        # Match each object to its best model variation
        print(
            f"\nMatching {len(object_images_and_info)} objects to model variations..."
        )

        # Combine segmentation info with classifications
        classified_objects = []

        for i, ((obj_image, obj), classification) in enumerate(
            zip(object_images_and_info, classifications)
        ):
            # Get furniture type from classification
            furniture_type = classification.get("furniture_type", "other")

            # Calculate this object's actual aspect ratio
            width = obj["dimensions_normalized"]["width"]
            height = obj["dimensions_normalized"]["height"]
            obj_aspect_ratio = width / height if height > 0 else 1.0

            # Match object to best model variation
            print(f"  Matching object #{i+1} ({furniture_type})...")
            model_index = await self._match_object_to_model_variation(
                obj_image,  # The cropped realistic object image
                furniture_type,
            )

            # Calculate center position from bbox
            center_x = (obj["bbox_normalized"]["x1"] + obj["bbox_normalized"]["x2"]) / 2
            center_y = (obj["bbox_normalized"]["y1"] + obj["bbox_normalized"]["y2"]) / 2

            # Combine segmentation info with classification in the desired format
            classified_obj = {
                "name": furniture_type,
                "model": model_index,  # Store the matched model variation index
                "position": {
                    "x": center_x,
                    "y": center_y,
                },
                "dimensions": {
                    "width": width,
                    "height": height,
                },
                "rotation": classification.get("rotation", 0),
                # Keep these for internal use
                "bbox_normalized": obj["bbox_normalized"],
                "bbox_pixels": obj["bbox_pixels"],
            }
            classified_objects.append(classified_obj)

        print(
            f"\nSuccessfully classified {len(classified_objects)} objects and matched models"
        )

        # Print final summary JSON in clean format for debugging
        print(f"\n{'='*70}")
        print("FINAL CLASSIFICATION RESULTS")
        print(f"{'='*70}")

        # Create clean output format (only essential fields)
        clean_output = []
        for obj in classified_objects:
            clean_obj = {
                "name": obj["name"],
                "model": obj["model"],
                "position": obj["position"],
                "dimensions": obj["dimensions"],
                "rotation": obj["rotation"],
            }
            clean_output.append(clean_obj)

        print(json.dumps(clean_output, indent=2))
        print(f"{'='*70}\n")

        return classified_objects
