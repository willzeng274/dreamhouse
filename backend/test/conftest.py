import pytest_asyncio
from app.services.ai_service import AIService


@pytest_asyncio.fixture(scope="function")
async def ai_service():
    service = AIService()
    yield service
    await service.client.aclose()
