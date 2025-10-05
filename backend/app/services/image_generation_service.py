from app.services.ai_service import AIService


class ImageGenerationService:
    def __init__(self):
        self.ai_service = AIService()

    async def generate_floorplan(self, sketch_bytes: bytes, mime_type: str) -> bytes:
        prompt = "Generate a top-down architectural floorplan from this sketch"
        result_bytes = await self.ai_service.generate_image(prompt, [(sketch_bytes, mime_type)])
        return result_bytes.read()

    async def revise_floorplan(self, floorplan_bytes: bytes, mime_type: str, instruction: str) -> bytes:
        prompt = f"Revise this floorplan: {instruction}"
        result_bytes = await self.ai_service.generate_image(prompt, [(floorplan_bytes, mime_type)])
        return result_bytes.read()

    async def generate_photorealistic(self, floorplan_bytes: bytes, mime_type: str) -> bytes:
        prompt = "Generate a photorealistic top-down interior image from this floorplan"
        result_bytes = await self.ai_service.generate_image(prompt, [(floorplan_bytes, mime_type)])
        return result_bytes.read()
