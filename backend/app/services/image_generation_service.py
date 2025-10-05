from app.services.ai_service import AIService
from prompts import (
    FLOORPLAN_GENERATION_PROMPT,
    get_floorplan_revision_prompt,
    PHOTOREALISTIC_GENERATION_PROMPT
)


class ImageGenerationService:
    def __init__(self):
        self.ai_service = AIService()

    async def generate_floorplan(self, sketch_bytes: bytes, mime_type: str) -> bytes:
        result_bytes = await self.ai_service.generate_image(FLOORPLAN_GENERATION_PROMPT, [(sketch_bytes, mime_type)])
        return result_bytes.read()

    async def revise_floorplan(self, floorplan_bytes: bytes, mime_type: str, instruction: str) -> bytes:
        prompt = get_floorplan_revision_prompt(instruction)
        result_bytes = await self.ai_service.generate_image(prompt, [(floorplan_bytes, mime_type)])
        return result_bytes.read()

    async def generate_photorealistic(self, floorplan_bytes: bytes, mime_type: str) -> bytes:
        result_bytes = await self.ai_service.generate_image(PHOTOREALISTIC_GENERATION_PROMPT, [(floorplan_bytes, mime_type)])
        return result_bytes.read()
