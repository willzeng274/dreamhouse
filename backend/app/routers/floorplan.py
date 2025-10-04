from fastapi import APIRouter, HTTPException, Depends
from app.schemas.floorplan import (
    FloorplanGenerateRequest, FloorplanExtractRequest, FloorplanClassifyRequest,
    FloorplanConstructRequest, FloorplanMoveObjectRequest, FloorplanChangeModelRequest,
    FloorplanGenerateObjectRequest, FloorplanResponse, FloorplanStepResponse
)
from app.services.image_generation_service import ImageGenerationService
from app.services.floorplan_extraction_service import FloorplanExtractionService
from app.services.classification_service import ClassificationService
from app.storage import memory_store
from app.config import settings
from app.helper import fetch_image_from_url
import uuid

router = APIRouter(prefix="/floorplan", tags=["floorplan"])


def get_image_service():
    return ImageGenerationService(settings.nano_banana_api_key)


def get_extraction_service():
    return FloorplanExtractionService()


def get_classification_service():
    return ClassificationService(settings.openai_api_key)


@router.post("/generate-base", response_model=FloorplanStepResponse)
async def generate_base_floorplan(
    request: FloorplanGenerateRequest,
    service: ImageGenerationService = Depends(get_image_service)
):
    project = memory_store.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    floorplan_url = await service.generate_from_sketch(request.image_url)

    return FloorplanStepResponse(
        project_id=request.project_id,
        step="base_generated",
        data={"floorplan_url": floorplan_url}
    )


@router.post("/add-markers", response_model=FloorplanStepResponse)
async def add_markers(
    request: FloorplanGenerateRequest,
    service: ImageGenerationService = Depends(get_image_service)
):
    project = memory_store.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    marked_url = await service.revise_image(
        request.image_url,
        "Add black boxes over all furniture items"
    )

    return FloorplanStepResponse(
        project_id=request.project_id,
        step="markers_added",
        data={"marked_floorplan_url": marked_url}
    )


@router.post("/extract-entities", response_model=FloorplanStepResponse)
async def extract_entities(
    request: FloorplanExtractRequest,
    service: FloorplanExtractionService = Depends(get_extraction_service)
):
    project = memory_store.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    image_bytes, _ = await fetch_image_from_url(request.floorplan_url)
    entities = await service.extract_entities(image_bytes)

    return FloorplanStepResponse(
        project_id=request.project_id,
        step="entities_extracted",
        data={"entities": entities}
    )


@router.post("/classify-objects", response_model=FloorplanStepResponse)
async def classify_objects(
    request: FloorplanClassifyRequest,
    extraction_service: FloorplanExtractionService = Depends(get_extraction_service),
    classification_service: ClassificationService = Depends(get_classification_service)
):
    project = memory_store.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    floorplan_url = project.get("floorplan_data", {}).get("base_floorplan_url")
    if not floorplan_url:
        raise HTTPException(status_code=400, detail="Floorplan not generated")

    image_bytes, _ = await fetch_image_from_url(floorplan_url)

    crops = []
    for entity in request.entities:
        crop = await extraction_service.crop_entity_image(image_bytes, entity["bbox"])
        crops.append(crop)

    classified = await classification_service.classify_multiple(request.entities, crops)

    return FloorplanStepResponse(
        project_id=request.project_id,
        step="objects_classified",
        data={"classified_objects": classified}
    )


@router.post("/construct", response_model=FloorplanResponse)
async def construct_floorplan(request: FloorplanConstructRequest):
    project = memory_store.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    floorplan_data = {
        "objects": [obj.model_dump() for obj in request.objects],
        "constructed": True
    }
    memory_store.update_project(request.project_id, {"floorplan_data": floorplan_data})

    return FloorplanResponse(
        project_id=request.project_id,
        objects=request.objects
    )


@router.patch("/{project_id}/move-object", response_model=FloorplanResponse)
async def move_object(project_id: str, request: FloorplanMoveObjectRequest):
    project = memory_store.get_project(project_id)
    if not project or not project.get("floorplan_data"):
        raise HTTPException(status_code=404, detail="Floorplan not found")

    objects = project["floorplan_data"]["objects"]
    for obj in objects:
        if obj["object_id"] == request.object_id:
            obj["position"] = request.position.model_dump()
            break

    memory_store.update_project(project_id, {"floorplan_data": project["floorplan_data"]})

    from app.schemas.floorplan import FloorplanObject
    return FloorplanResponse(
        project_id=project_id,
        objects=[FloorplanObject(**obj) for obj in objects]
    )


@router.patch("/{project_id}/change-model", response_model=FloorplanResponse)
async def change_model(project_id: str, request: FloorplanChangeModelRequest):
    project = memory_store.get_project(project_id)
    if not project or not project.get("floorplan_data"):
        raise HTTPException(status_code=404, detail="Floorplan not found")

    objects = project["floorplan_data"]["objects"]
    for obj in objects:
        if obj["object_id"] == request.object_id:
            obj["model_id"] = request.model_id
            break

    memory_store.update_project(project_id, {"floorplan_data": project["floorplan_data"]})

    from app.schemas.floorplan import FloorplanObject
    return FloorplanResponse(
        project_id=project_id,
        objects=[FloorplanObject(**obj) for obj in objects]
    )


@router.post("/generate-object", response_model=FloorplanResponse)
async def generate_object(request: FloorplanGenerateObjectRequest):
    project = memory_store.get_project(request.project_id)
    if not project or not project.get("floorplan_data"):
        raise HTTPException(status_code=404, detail="Floorplan not found")

    from app.schemas.floorplan import FloorplanObject
    from app.schemas.common import Position2D, Dimensions2D

    new_object = FloorplanObject(
        object_id=str(uuid.uuid4()),
        type="table",
        model_id="001",
        position=Position2D(x=0, y=0),
        dimensions=Dimensions2D(x=50, y=50)
    )

    objects = project["floorplan_data"]["objects"]
    objects.append(new_object.model_dump())
    memory_store.update_project(request.project_id, {"floorplan_data": project["floorplan_data"]})

    return FloorplanResponse(
        project_id=request.project_id,
        objects=[FloorplanObject(**obj) for obj in objects]
    )


@router.get("/{project_id}", response_model=FloorplanResponse)
async def get_floorplan(project_id: str):
    project = memory_store.get_project(project_id)
    if not project or not project.get("floorplan_data"):
        raise HTTPException(status_code=404, detail="Floorplan not found")

    from app.schemas.floorplan import FloorplanObject
    objects = project["floorplan_data"]["objects"]

    return FloorplanResponse(
        project_id=project_id,
        objects=[FloorplanObject(**obj) for obj in objects]
    )
