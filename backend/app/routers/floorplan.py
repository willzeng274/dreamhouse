from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import Response
from app.services.image_generation_service import ImageGenerationService
from app.services.minglun_service import MingLunService

router = APIRouter(prefix="/floorplan", tags=["floorplan"])


@router.post("/generate")
async def generate_floorplan(sketch: UploadFile = File(...)):
    sketch_bytes = await sketch.read()
    mime_type = sketch.content_type or "image/png"

    service = ImageGenerationService()
    floorplan_bytes = await service.generate_floorplan(sketch_bytes, mime_type)

    return Response(content=floorplan_bytes, media_type="image/png")


@router.post("/extract")
async def extract_objects(floorplan: UploadFile = File(...)):
    floorplan_bytes = await floorplan.read()

    service = MingLunService()
    objects_data = await service.extract_objects(floorplan_bytes)

    return {"objects": objects_data}


@router.post("/revise")
async def revise_floorplan(
    annotated_floorplan: UploadFile = File(...),
    instruction: str = Form(...)
):
    floorplan_bytes = await annotated_floorplan.read()
    mime_type = annotated_floorplan.content_type or "image/png"

    service = ImageGenerationService()
    revised_floorplan_bytes = await service.revise_floorplan(floorplan_bytes, mime_type, instruction)

    return Response(content=revised_floorplan_bytes, media_type="image/png")
