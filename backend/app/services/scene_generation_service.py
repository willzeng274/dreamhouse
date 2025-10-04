from typing import List, Dict, Any
from app.schemas.scene import SceneObject, Position3D, Dimensions3D


class SceneGenerationService:
    def convert_2d_to_3d(self, floorplan_objects: List[Dict[str, Any]]) -> List[SceneObject]:
        scene_objects = []

        for obj in floorplan_objects:
            scene_obj = SceneObject(
                object_id=obj["object_id"],
                type=obj["type"],
                model_id=obj["model_id"],
                position=Position3D(
                    x=obj["position"]["x"],
                    y=0.0,
                    z=obj["position"]["y"]
                ),
                dimensions=Dimensions3D(
                    x=obj["dimensions"]["x"],
                    y=50.0,
                    z=obj["dimensions"]["y"]
                )
            )
            scene_objects.append(scene_obj)

        return scene_objects

    def export_for_unity(self, scene_objects: List[SceneObject]) -> Dict[str, Any]:
        unity_data = {
            "objects": [
                {
                    "id": obj.object_id,
                    "type": obj.type,
                    "modelId": obj.model_id,
                    "position": {"x": obj.position.x, "y": obj.position.y, "z": obj.position.z},
                    "scale": {"x": obj.dimensions.x / 100, "y": obj.dimensions.y / 100, "z": obj.dimensions.z / 100}
                }
                for obj in scene_objects
            ]
        }
        return unity_data
