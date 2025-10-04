from pydantic import BaseModel
from typing import List
from app.schemas.common import ObjectType


class Position3D(BaseModel):
    x: float
    y: float
    z: float


class Dimensions3D(BaseModel):
    x: float
    y: float
    z: float


class SceneObject(BaseModel):
    object_id: str
    type: ObjectType
    model_id: str
    position: Position3D
    dimensions: Dimensions3D


class SceneGenerateRequest(BaseModel):
    project_id: str


class SceneResponse(BaseModel):
    project_id: str
    objects: List[SceneObject]


class SceneExportRequest(BaseModel):
    project_id: str
    format: str = "unity"


class SceneExportResponse(BaseModel):
    project_id: str
    export_data: dict
