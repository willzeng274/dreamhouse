from pydantic import BaseModel
from typing import Optional


class SketchCompleteRequest(BaseModel):
    project_id: str
    sketch_data: str
    prompt: Optional[str] = None


class SketchReviseRequest(BaseModel):
    project_id: str
    sketch_data: str
    prompt: str


class SketchResponse(BaseModel):
    project_id: str
    sketch_data: str
