from typing import List, Dict, Any
from app.services.segmentation_service import SegmentationService


class MingLunService:
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
            "rotation": float (degrees),
            "model": int (model variation index),
            "bbox_normalized": {...},
            "bbox_pixels": {...},
            ...
        }
        """
        # Get classified objects from segmentation service
        classified_objects = (
            await self.segmentation_service.extract_and_classify_furniture(
                floorplan_bytes, conf=0.4, iou=0.9
            )
        )

        # The classified_objects already have the correct format from segmentation_service
        # Just need to add id field, type field, and ensure correct types
        frontend_objects = []
        for i, obj in enumerate(classified_objects):
            frontend_obj = {
                "id": f"obj_{i}",
                "type": obj.get("name", "other"),
                "name": obj.get("name", "other"),
                "model": obj.get("model", 0),
                "position": {
                    "x": float(obj["position"]["x"]),
                    "y": float(obj["position"]["y"]),
                },
                "dimensions": {
                    "width": float(obj["dimensions"]["width"]),
                    "height": float(obj["dimensions"]["height"]),
                },
                "rotation": int(obj.get("rotation", 0)),
                "bbox_normalized": obj.get("bbox_normalized", {}),
                "bbox_pixels": obj.get("bbox_pixels", {}),
            }
            frontend_objects.append(frontend_obj)

        return frontend_objects
