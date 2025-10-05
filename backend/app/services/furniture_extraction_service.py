from typing import List, Dict, Any
from app.services.segmentation_service import SegmentationService


class FurnitureExtractionService:
    """Service for extracting and classifying furniture objects from floorplan images."""

    def __init__(self):
        self.segmentation_service = SegmentationService(model_path="FastSAM-s.pt")

    async def extract_objects(self, floorplan_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Extract and classify furniture objects from a floorplan image.

        Returns objects in the format expected by the frontend:
        {
            "id": string,
            "type": string (furniture_id),
            "name": string (furniture_name),
            "position": {"x": float, "y": float},
            "dimensions": {"width": float, "height": float},
            "bbox_normalized": {...},
            "confidence": string,
            ...
        }
        """
        # Get classified objects from segmentation service
        classified_objects = (
            await self.segmentation_service.extract_and_classify_furniture(
                floorplan_bytes, conf=0.4, iou=0.9
            )
        )

        # Transform to frontend format
        frontend_objects = []
        for obj in classified_objects:
            classification = obj.get("classification", {})
            bbox_norm = obj.get("bbox_normalized", {})
            dims_norm = obj.get("dimensions_normalized", {})

            # Calculate center position from bbox
            center_x = (bbox_norm.get("x1", 0) + bbox_norm.get("x2", 0)) / 2
            center_y = (bbox_norm.get("y1", 0) + bbox_norm.get("y2", 0)) / 2

            frontend_obj = {
                "id": f"obj_{obj.get('id', 0)}",
                "type": classification.get("furniture_id", "other"),
                "name": classification.get("furniture_name", "Unknown"),
                "position": {
                    "x": float(center_x),
                    "y": float(center_y),
                },
                "dimensions": {
                    "width": float(dims_norm.get("width", 0)),
                    "height": float(dims_norm.get("height", 0)),
                },
                "bbox_normalized": bbox_norm,
                "bbox_pixels": obj.get("bbox_pixels", {}),
                "confidence": classification.get("confidence", "unknown"),
                "reasoning": classification.get("reasoning", ""),
                "aspect_ratio": classification.get(
                    "aspect_ratio", {"value": 1.0, "typical": "any", "description": ""}
                ),
            }
            frontend_objects.append(frontend_obj)

        return frontend_objects
