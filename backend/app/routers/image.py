from fastapi import APIRouter, HTTPException, Depends
from app.schemas.image import ImageGenerateRequest, ImageEditRequest, ImageReviseRequest, ImageResponse
from app.services.image_generation_service import ImageGenerationService
from app.storage import memory_store
from app.config import settings

router = APIRouter(prefix="/image", tags=["image"])


def get_image_service():
    return ImageGenerationService(settings.nano_banana_api_key)


@router.post("/generate", response_model=ImageResponse)
async def generate_image(
    request: ImageGenerateRequest,
    service: ImageGenerationService = Depends(get_image_service)
):
    project = memory_store.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    image_url = await service.generate_from_sketch(request.sketch_data)
    memory_store.update_project(request.project_id, {"image_url": image_url})

    return ImageResponse(project_id=request.project_id, image_url=image_url)


@router.post("/edit-region", response_model=ImageResponse)
async def edit_image_region(
    request: ImageEditRequest,
    service: ImageGenerationService = Depends(get_image_service)
):
    project = memory_store.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    image_url = await service.edit_region(request.image_url, request.mask_data, request.prompt)
    memory_store.update_project(request.project_id, {"image_url": image_url})

    return ImageResponse(project_id=request.project_id, image_url=image_url)


@router.post("/revise", response_model=ImageResponse)
async def revise_image(
    request: ImageReviseRequest,
    service: ImageGenerationService = Depends(get_image_service)
):
    project = memory_store.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    image_url = await service.revise_image(request.image_url, request.prompt)
    memory_store.update_project(request.project_id, {"image_url": image_url})

    return ImageResponse(project_id=request.project_id, image_url=image_url)


@router.get("/{project_id}", response_model=ImageResponse)
async def get_image(project_id: str):
    project = memory_store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("image_url"):
        raise HTTPException(status_code=404, detail="Image not generated yet")

    return ImageResponse(project_id=project_id, image_url=project["image_url"])
