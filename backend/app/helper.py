import httpx
import base64


ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
}


async def fetch_image_from_url(url: str) -> tuple[bytes, str]:
    """Fetch an image from a URL or decode from data URI and return it as bytes along with mime type."""
    if url.startswith("data:"):
        parts = url.split(",", 1)
        header = parts[0]
        data = parts[1]

        mime_type = header.split(":")[1].split(";")[0]
        if mime_type not in ALLOWED_IMAGE_TYPES:
            mime_type = "image/png"

        image_bytes = base64.b64decode(data)
        return image_bytes, mime_type

    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        response.raise_for_status()

        mime_type = response.headers.get("content-type", "image/jpeg").split(";")[0].strip()

        if mime_type not in ALLOWED_IMAGE_TYPES:
            mime_type = "image/jpeg"

        return response.content, mime_type
