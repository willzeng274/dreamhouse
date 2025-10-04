from pydantic import BaseModel
from typing import Optional, Any


class ProjectCreate(BaseModel):
    pass


class ProjectResponse(BaseModel):
    project_id: str
    sketch_data: Optional[Any] = None
    image_url: Optional[str] = None
    floorplan_data: Optional[Any] = None
    scene_data: Optional[Any] = None
