import cv2
import numpy as np
from typing import List, Dict, Any


class FloorplanExtractionService:
    async def extract_entities(self, floorplan_image_bytes: bytes) -> List[Dict[str, Any]]:
        nparr = np.frombuffer(floorplan_image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        entities = []
        for idx, contour in enumerate(contours):
            x, y, w, h = cv2.boundingRect(contour)
            if w > 10 and h > 10:
                entities.append({
                    "entity_id": f"entity_{idx}",
                    "position": {"x": float(x + w // 2), "y": float(y + h // 2)},
                    "dimensions": {"x": float(w), "y": float(h)},
                    "bbox": {"x": x, "y": y, "w": w, "h": h}
                })

        return entities

    async def crop_entity_image(self, floorplan_image_bytes: bytes, bbox: Dict[str, int]) -> bytes:
        nparr = np.frombuffer(floorplan_image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
        cropped = img[y:y+h, x:x+w]

        _, encoded = cv2.imencode('.png', cropped)
        return encoded.tobytes()
