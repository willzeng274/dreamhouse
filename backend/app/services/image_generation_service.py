import httpx


class ImageGenerationService:
    def __init__(self, nano_banana_api_key: str):
        self.api_key = nano_banana_api_key
        self.base_url = "https://api.nanobanana.com"

    async def generate_from_sketch(self, sketch_data: str) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/generate",
                json={"sketch": sketch_data},
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            return response.json()["image_url"]

    async def edit_region(self, image_url: str, mask_data: str, prompt: str) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/edit",
                json={"image_url": image_url, "mask": mask_data, "prompt": prompt},
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            return response.json()["image_url"]

    async def revise_image(self, image_url: str, prompt: str) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/revise",
                json={"image_url": image_url, "prompt": prompt},
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            return response.json()["image_url"]
