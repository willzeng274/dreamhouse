from typing import List, Dict, Any


class SceneGenerationService:
    def convert_to_unity(self, objects: List[Dict[str, Any]]) -> Dict[str, Any]:
        unity_objects = []

        for obj in objects:
            position = obj.get("position", {})
            dimensions = obj.get("dimensions", {})

            unity_obj = {
                "id": obj.get("id", obj.get("object_id", "")),
                "type": obj.get("type", ""),
                "modelId": obj.get("model_id", obj.get("modelId", "")),
                "position": {
                    "x": position.get("x", 0),
                    "y": 0,
                    "z": position.get("y", 0)
                },
                "scale": {
                    "x": dimensions.get("x", 1) / 100,
                    "y": dimensions.get("y", 1) / 100,
                    "z": 1.0
                }
            }
            unity_objects.append(unity_obj)

        return {"objects": unity_objects}
