from fastapi import APIRouter, UploadFile, File
from fastapi.responses import Response
from app.services.image_generation_service import ImageGenerationService

router = APIRouter(prefix="/image", tags=["image"])


@router.post("/generate")
async def generate_photorealistic(floorplan: UploadFile = File(...)):
    floorplan_bytes = await floorplan.read()
    mime_type = floorplan.content_type or "image/png"

    service = ImageGenerationService()
    photorealistic_bytes = await service.generate_photorealistic(floorplan_bytes, mime_type)

    return Response(content=photorealistic_bytes, media_type="image/png")
