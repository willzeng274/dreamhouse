from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from app.services.image_generation_service import ImageGenerationService
from app.services.minglun_service import MingLunService
from app.services.boundary_extraction_service import BoundaryExtractionService
import json
import os

router = APIRouter(prefix="/floorplan", tags=["floorplan"])


def convert_to_old_format_and_save():
    """
    Helper function to read data.json, convert boundaries to old format,
    and save to arihan.json
    """
    # Read the saved data.json
    with open("./data.json", "r") as f:
        data = json.load(f)
    
    # Keep objects in original format, convert boundaries to old format
    converted_boundaries = []
    
    # Process boundaries - convert to old format
    for boundary in data.get("boundaries", []):
        converted_boundary = {
            "class": boundary.get("class", "unknown"),
            "center_x": boundary.get("position", {}).get("x", 0),
            "center_y": boundary.get("position", {}).get("y", 0),
            "width": boundary.get("dimensions", {}).get("width", 0),
            "height": boundary.get("dimensions", {}).get("height", 0),
            "confidence": boundary.get("confidence", 0)
        }
        converted_boundaries.append(converted_boundary)
    
    converted_data = {
        "objects": data.get("objects", []),
        "boundaries": converted_boundaries
    }
    
    # Save to arihan.json
    with open("./arihan.json", "w") as f:
        json.dump(converted_data, f, indent=2)
    print(f"💾 Saved converted data to ./arihan.json")
    
    return converted_data


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

    boundary_service = BoundaryExtractionService()
    boundaries_data = await boundary_service.extract_boundaries(floorplan_bytes, debug=True)

    response_data = {
        "objects": objects_data, 
        "boundaries": boundaries_data,
    }

    return response_data

@router.post("/update-floor-plan")
async def update_floor_plan(data: dict):
    """
    Receives objects and boundaries data from frontend, adds outdated flag,
    and saves to data.json
    """
    # Add outdated flag to the data
    data["outdated"] = False
    
    # Save to data.json
    with open("./data.json", "w") as f:
        json.dump(data, f, indent=2)
    print(f"💾 Saved updated floor plan data to ./data.json with outdated=False")
    
    # Convert and save to arihan.json using helper function
    convert_to_old_format_and_save()
    
    return {"status": "success", "message": "Floor plan data updated successfully"}

@router.get("/unity-extract")
async def unity_extract():
    # Check if data.json exists
    if not os.path.exists("./data.json"):
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "No extraction data available. Please run /extract first."}
        )
    
    # Read data.json
    with open("./data.json", "r") as f:
        data = json.load(f)
    
    # Check if data is outdated
    if data.get("outdated", False):
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "Extraction data is outdated. Please run /extract again."}
        )
    
    # Mark data as outdated
    data["outdated"] = True
    with open("./data.json", "w") as f:
        json.dump(data, f, indent=2)
    print(f"⚠️  Marked data.json as outdated")
    
    # Convert and return data (but don't save to arihan.json from this call)
    converted_boundaries = []
    for boundary in data.get("boundaries", []):
        converted_boundary = {
            "class": boundary.get("class", "unknown"),
            "center_x": boundary.get("position", {}).get("x", 0),
            "center_y": boundary.get("position", {}).get("y", 0),
            "width": boundary.get("dimensions", {}).get("width", 0),
            "height": boundary.get("dimensions", {}).get("height", 0),
            "confidence": boundary.get("confidence", 0)
        }
        converted_boundaries.append(converted_boundary)
    
    return {
        "objects": data.get("objects", []),
        "boundaries": converted_boundaries
    }

@router.post("/revise")
async def revise_floorplan(
    annotated_floorplan: UploadFile = File(...), instruction: str = Form(...)
):
    floorplan_bytes = await annotated_floorplan.read()
    mime_type = annotated_floorplan.content_type or "image/png"

    service = ImageGenerationService()
    revised_floorplan_bytes = await service.revise_floorplan(
        floorplan_bytes, mime_type, instruction
    )

    return Response(content=revised_floorplan_bytes, media_type="image/png")
