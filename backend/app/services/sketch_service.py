from app.services.ai_service import AIService


class SketchService:
    def __init__(self, ai_service: AIService):
        self.ai_service = ai_service

    async def complete_sketch(self, sketch_data: str, prompt: str | None = None) -> str:
        base_prompt = "Complete this architectural sketch with additional details."
        if prompt:
            base_prompt = f"{base_prompt} User request: {prompt}"

        response = await self.ai_service.generate_text(base_prompt)
        return sketch_data

    async def revise_sketch(self, sketch_data: str, prompt: str) -> str:
        revision_prompt = f"Revise this architectural sketch based on: {prompt}"
        response = await self.ai_service.generate_text(revision_prompt)
        return sketch_data
