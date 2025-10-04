from pydantic import BaseModel
from typing import Optional


class ImageGenerateRequest(BaseModel):
    project_id: str
    sketch_data: str


class ImageEditRequest(BaseModel):
    project_id: str
    image_url: str
    mask_data: str
    prompt: str


class ImageReviseRequest(BaseModel):
    project_id: str
    image_url: str
    prompt: str


class ImageResponse(BaseModel):
    project_id: str
    image_url: str
