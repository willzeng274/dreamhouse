from fastapi import APIRouter, HTTPException
from app.schemas.objects import ObjectTypeResponse, ObjectModelsResponse, ObjectDetailResponse, ObjectModel
from app.storage.memory_store import OBJECT_MODELS

router = APIRouter(prefix="/objects", tags=["objects"])


@router.get("/types", response_model=ObjectTypeResponse)
async def get_object_types():
    return ObjectTypeResponse(types=list(OBJECT_MODELS.keys()))


@router.get("/models/{object_type}", response_model=ObjectModelsResponse)
async def get_object_models(object_type: str):
    if object_type not in OBJECT_MODELS:
        raise HTTPException(status_code=404, detail="Object type not found")

    models = [ObjectModel(**model) for model in OBJECT_MODELS[object_type]]
    return ObjectModelsResponse(object_type=object_type, models=models)


@router.get("/{object_type}/{model_id}", response_model=ObjectDetailResponse)
async def get_object_detail(object_type: str, model_id: str):
    if object_type not in OBJECT_MODELS:
        raise HTTPException(status_code=404, detail="Object type not found")

    models = OBJECT_MODELS[object_type]
    model = next((m for m in models if m["model_id"] == model_id), None)

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    return ObjectDetailResponse(object_type=object_type, model=ObjectModel(**model))
