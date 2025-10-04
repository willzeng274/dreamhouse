from google import genai
from google.genai import types
from app.config import get_settings
from io import BytesIO


class AIService:
    def __init__(self):
        settings = get_settings()
        self.client = genai.Client(api_key=settings.gemini_api_key).aio

    async def generate_text(self, prompt: str, images: list[tuple[bytes, str]] | None = None) -> str:
        """Generate text based on a prompt, optionally with multiple images.

        Args:
            prompt: The text prompt
            images: List of tuples (image_bytes, mime_type)
        """
        contents = []

        if images:
            for img_bytes, mime_type in images:
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))

        contents.append(prompt)

        response = await self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
        )
        return response.text

    async def generate_image(self, prompt: str, images: list[tuple[bytes, str]] | None = None) -> bytes:
        """Generate an image based on a prompt, optionally conditioned on multiple images.

        Args:
            prompt: The text prompt
            images: List of tuples (image_bytes, mime_type)
        """
        contents = []

        if images:
            for img_bytes, mime_type in images:
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))

        contents.append(prompt)

        response = await self.client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=contents,
        )

        image_parts = [
            part.inline_data.data
            for part in response.candidates[0].content.parts
            if part.inline_data
        ]

        if image_parts:
            return BytesIO(image_parts[0])
        else:
            # no image generated
            return b""

    async def chat(self, messages: list[dict]) -> dict:
        """Chat with the AI model. Supports text and multiple images per message.

        Each message can have:
            - content: text content
            - images: list of tuples (image_bytes, mime_type)
        """
        contents = []
        for msg in messages:
            parts = []
            if "images" in msg and msg["images"]:
                for img_bytes, mime_type in msg["images"]:
                    parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
            if "content" in msg and msg["content"]:
                parts.append(types.Part(text=msg["content"]))
            contents.append(types.Content(role=msg["role"], parts=parts))

        response = await self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
        )

        return {"role": "model", "content": response.text}


ai_service = AIService()
