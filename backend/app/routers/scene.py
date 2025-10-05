from fastapi import APIRouter, Body
from app.services.scene_generation_service import SceneGenerationService
from typing import List, Dict, Any

router = APIRouter(prefix="/scene", tags=["scene"])


@router.post("/export")
async def export_for_unity(objects: List[Dict[str, Any]] = Body(...)):
    service = SceneGenerationService()
    unity_data = service.convert_to_unity(objects)

    return {"unity_scene": unity_data}
