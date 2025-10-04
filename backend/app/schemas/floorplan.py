from pydantic import BaseModel
from typing import List, Optional
from app.schemas.common import Position2D, Dimensions2D, ObjectType


class FloorplanObject(BaseModel):
    object_id: str
    type: ObjectType
    model_id: str
    position: Position2D
    dimensions: Dimensions2D


class FloorplanGenerateRequest(BaseModel):
    project_id: str
    image_url: str


class FloorplanExtractRequest(BaseModel):
    project_id: str
    floorplan_url: str


class FloorplanClassifyRequest(BaseModel):
    project_id: str
    entities: List[dict]


class FloorplanConstructRequest(BaseModel):
    project_id: str
    objects: List[FloorplanObject]


class FloorplanMoveObjectRequest(BaseModel):
    object_id: str
    position: Position2D


class FloorplanChangeModelRequest(BaseModel):
    object_id: str
    model_id: str


class FloorplanGenerateObjectRequest(BaseModel):
    project_id: str
    prompt: str


class FloorplanResponse(BaseModel):
    project_id: str
    objects: List[FloorplanObject]
    floorplan_url: Optional[str] = None


class FloorplanStepResponse(BaseModel):
    project_id: str
    step: str
    data: dict
