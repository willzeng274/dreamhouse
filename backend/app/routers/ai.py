from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import Optional, List
import json
from app.services.ai_service import ai_service
from app.helper import fetch_image_from_url, ALLOWED_IMAGE_TYPES

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/llm")
async def llm(
    prompt: Optional[str] = Form(None),
    messages: Optional[str] = Form(None),
    image_urls: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None),
):
    """
    Flexible LLM endpoint for text generation.
    Supports: single prompt, chat messages, and optional multiple images (URLs or uploads).
    - image_urls: JSON array of URLs e.g. ["url1", "url2"]
    - images: Multiple file uploads
    """
    try:
        if not prompt and not messages:
            raise HTTPException(status_code=400, detail="Either 'prompt' or 'messages' must be provided")

        if prompt and messages:
            raise HTTPException(status_code=400, detail="Provide either 'prompt' or 'messages', not both")

        image_list = []

        if images:
            for img in images:
                img_bytes = await img.read()
                mime_type = img.content_type or "image/jpeg"

                if mime_type not in ALLOWED_IMAGE_TYPES:
                    mime_type = "image/jpeg"

                image_list.append((img_bytes, mime_type))

        if image_urls:
            urls = json.loads(image_urls)
            for url in urls:
                img_bytes, mime_type = await fetch_image_from_url(url)
                image_list.append((img_bytes, mime_type))

        if messages:
            messages_list = json.loads(messages)

            if image_list:
                messages_list[-1]["images"] = image_list
            response = await ai_service.chat(messages_list)
            return {"text": response["content"]}
        else:
            text = await ai_service.generate_text(prompt, images=image_list if image_list else None)
            return {"text": text}

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for messages or image_urls")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-image")
async def generate_image(
    prompt: str = Form(...),
    image_urls: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None),
):
    """
    Generate or edit an image based on a prompt.
    Supports multiple input images for conditioning/editing.
    - prompt: Text description (required)
    - image_urls: JSON array of URLs e.g. ["url1", "url2"]
    - images: Multiple file uploads
    """
    try:
        image_list = []

        if images:
            for img in images:
                img_bytes = await img.read()
                mime_type = img.content_type or "image/jpeg"

                if mime_type not in ALLOWED_IMAGE_TYPES:
                    mime_type = "image/jpeg"

                image_list.append((img_bytes, mime_type))

        if image_urls:
            urls = json.loads(image_urls)
            for url in urls:
                img_bytes, mime_type = await fetch_image_from_url(url)
                image_list.append((img_bytes, mime_type))

        result = await ai_service.generate_image(prompt, images=image_list if image_list else None)

        return StreamingResponse(result, media_type="image/png")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for image_urls")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
