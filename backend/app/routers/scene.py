from fastapi import APIRouter, HTTPException, Depends
from app.schemas.scene import SceneGenerateRequest, SceneResponse, SceneExportRequest, SceneExportResponse
from app.services.scene_generation_service import SceneGenerationService
from app.storage import memory_store

router = APIRouter(prefix="/scene", tags=["scene"])


def get_scene_service():
    return SceneGenerationService()


@router.post("/generate", response_model=SceneResponse)
async def generate_scene(
    request: SceneGenerateRequest,
    service: SceneGenerationService = Depends(get_scene_service)
):
    project = memory_store.get_project(request.project_id)
    if not project or not project.get("floorplan_data"):
        raise HTTPException(status_code=404, detail="Floorplan not found")

    floorplan_objects = project["floorplan_data"]["objects"]
    scene_objects = service.convert_2d_to_3d(floorplan_objects)

    scene_data = {
        "objects": [obj.model_dump() for obj in scene_objects]
    }
    memory_store.update_project(request.project_id, {"scene_data": scene_data})

    return SceneResponse(project_id=request.project_id, objects=scene_objects)


@router.get("/{project_id}", response_model=SceneResponse)
async def get_scene(project_id: str):
    project = memory_store.get_project(project_id)
    if not project or not project.get("scene_data"):
        raise HTTPException(status_code=404, detail="Scene not found")

    from app.schemas.scene import SceneObject
    objects = project["scene_data"]["objects"]

    return SceneResponse(
        project_id=project_id,
        objects=[SceneObject(**obj) for obj in objects]
    )


@router.post("/export", response_model=SceneExportResponse)
async def export_scene(
    request: SceneExportRequest,
    service: SceneGenerationService = Depends(get_scene_service)
):
    project = memory_store.get_project(request.project_id)
    if not project or not project.get("scene_data"):
        raise HTTPException(status_code=404, detail="Scene not found")

    from app.schemas.scene import SceneObject
    objects = [SceneObject(**obj) for obj in project["scene_data"]["objects"]]

    export_data = service.export_for_unity(objects)

    return SceneExportResponse(project_id=request.project_id, export_data=export_data)
