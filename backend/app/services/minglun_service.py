from typing import List, Dict, Any


class MingLunService:
    def __init__(self):
        self.api_url = "https://minglun-pipeline.example.com/extract"

    async def extract_objects(self, floorplan_bytes: bytes) -> List[Dict[str, Any]]:
        return [
            {
                "id": "obj_1",
                "type": "bed",
                "model_id": "001",
                "position": {"x": 150.0, "y": 300.0},
                "dimensions": {"x": 100.0, "y": 150.0}
            },
            {
                "id": "obj_2",
                "type": "desk",
                "model_id": "001",
                "position": {"x": 300.0, "y": 150.0},
                "dimensions": {"x": 80.0, "y": 60.0}
            },
            {
                "id": "obj_3",
                "type": "chair",
                "model_id": "002",
                "position": {"x": 300.0, "y": 120.0},
                "dimensions": {"x": 40.0, "y": 40.0}
            }
        ]
