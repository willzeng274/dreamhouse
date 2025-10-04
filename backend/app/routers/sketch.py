from fastapi import APIRouter, HTTPException, Depends
from app.schemas.sketch import SketchCompleteRequest, SketchReviseRequest, SketchResponse
from app.services.sketch_service import SketchService
from app.services.ai_service import AIService
from app.storage import memory_store
from app.config import settings

router = APIRouter(prefix="/sketch", tags=["sketch"])


def get_sketch_service():
    ai_service = AIService(settings.gemini_api_key)
    return SketchService(ai_service)


@router.post("/complete", response_model=SketchResponse)
async def complete_sketch(
    request: SketchCompleteRequest,
    service: SketchService = Depends(get_sketch_service)
):
    project = memory_store.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    completed_sketch = await service.complete_sketch(request.sketch_data, request.prompt)
    memory_store.update_project(request.project_id, {"sketch_data": completed_sketch})

    return SketchResponse(project_id=request.project_id, sketch_data=completed_sketch)


@router.post("/revise", response_model=SketchResponse)
async def revise_sketch(
    request: SketchReviseRequest,
    service: SketchService = Depends(get_sketch_service)
):
    project = memory_store.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    revised_sketch = await service.revise_sketch(request.sketch_data, request.prompt)
    memory_store.update_project(request.project_id, {"sketch_data": revised_sketch})

    return SketchResponse(project_id=request.project_id, sketch_data=revised_sketch)
