from typing import Dict, Optional, Any

PROJECTS: Dict[str, Dict[str, Any]] = {}

OBJECT_MODELS: Dict[str, list[Dict[str, Any]]] = {
    "table": [
        {"model_id": "001", "name": "Round Table", "image_url": ""},
        {"model_id": "002", "name": "Square Table", "image_url": ""},
    ],
    "chair": [
        {"model_id": "001", "name": "Office Chair", "image_url": ""},
        {"model_id": "002", "name": "Dining Chair", "image_url": ""},
    ],
    "bed": [
        {"model_id": "001", "name": "Queen Bed", "image_url": ""},
        {"model_id": "002", "name": "King Bed", "image_url": ""},
    ],
    "sofa": [
        {"model_id": "001", "name": "L-Shaped Sofa", "image_url": ""},
        {"model_id": "002", "name": "3-Seater Sofa", "image_url": ""},
    ],
    "desk": [
        {"model_id": "001", "name": "Office Desk", "image_url": ""},
        {"model_id": "002", "name": "Standing Desk", "image_url": ""},
    ],
    "cabinet": [
        {"model_id": "001", "name": "Storage Cabinet", "image_url": ""},
        {"model_id": "002", "name": "Display Cabinet", "image_url": ""},
    ],
    "shelf": [
        {"model_id": "001", "name": "Bookshelf", "image_url": ""},
        {"model_id": "002", "name": "Wall Shelf", "image_url": ""},
    ],
}


def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    return PROJECTS.get(project_id)


def create_project(project_id: str) -> Dict[str, Any]:
    project = {
        "project_id": project_id,
        "sketch_data": None,
        "image_url": None,
        "floorplan_data": None,
        "scene_data": None,
    }
    PROJECTS[project_id] = project
    return project


def update_project(project_id: str, data: Dict[str, Any]) -> None:
    if project_id in PROJECTS:
        PROJECTS[project_id].update(data)
