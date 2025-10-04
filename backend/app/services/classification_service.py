from openai import AsyncOpenAI
import base64
from typing import Dict, Any, List
from app.storage.memory_store import OBJECT_MODELS


class ClassificationService:
    def __init__(self, openai_api_key: str):
        self.client = AsyncOpenAI(api_key=openai_api_key)

    async def classify_object(self, image_bytes: bytes) -> Dict[str, str]:
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')

        object_types = list(OBJECT_MODELS.keys())
        type_list = ", ".join(object_types)

        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Classify this furniture object as one of: {type_list}. Respond with only the type name."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ]
        )

        object_type = response.choices[0].message.content.strip().lower()

        if object_type in OBJECT_MODELS:
            models = OBJECT_MODELS[object_type]
            model_id = models[0]["model_id"]
        else:
            object_type = "table"
            model_id = "001"

        return {"type": object_type, "model_id": model_id}

    async def classify_multiple(self, entities: List[Dict[str, Any]], image_crops: List[bytes]) -> List[Dict[str, Any]]:
        results = []
        for entity, crop in zip(entities, image_crops):
            classification = await self.classify_object(crop)
            results.append({
                **entity,
                "type": classification["type"],
                "model_id": classification["model_id"]
            })
        return results
