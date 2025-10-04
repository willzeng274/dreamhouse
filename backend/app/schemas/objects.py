from pydantic import BaseModel
from typing import List


class ObjectModel(BaseModel):
    model_id: str
    name: str
    image_url: str


class ObjectTypeResponse(BaseModel):
    types: List[str]


class ObjectModelsResponse(BaseModel):
    object_type: str
    models: List[ObjectModel]


class ObjectDetailResponse(BaseModel):
    object_type: str
    model: ObjectModel
