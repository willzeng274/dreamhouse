import pytest
from pathlib import Path
from app.helper import fetch_image_from_url
import time


@pytest.mark.asyncio
async def test_generate_text(ai_service):
    result = await ai_service.generate_text("Write a haiku about the night sky")
    print("\nGenerated text:", result)
    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_generate_image(tmp_path, ai_service):
    start_time = time.time()
    result = await ai_service.generate_image("A futuristic city skyline at night")
    elapsed_time = time.time() - start_time

    image_file = tmp_path / "test_image.png"
    with open(image_file, "wb") as f:
        if hasattr(result, 'read'):
            f.write(result.read())
        else:
            f.write(result)

    print(f"\nImage saved at: {image_file}")
    print(f"Generation took: {elapsed_time:.2f} seconds")
    assert image_file.exists()
    assert image_file.stat().st_size > 0


@pytest.mark.asyncio
async def test_chat(ai_service):
    messages = [
        {"role": "user", "content": "Hello, who are you?"},
        {"role": "user", "content": "Can you describe a sunset in one sentence?"},
    ]
    result = await ai_service.chat(messages)
    print("\nChat response:", result["content"])
    assert len(result["content"]) > 0


@pytest.mark.asyncio
async def test_identify_image_with_generate_text(ai_service):
    """Test identifying content in an image using generate_text"""
    image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/481px-Cat03.jpg"
    image_bytes, mime_type = await fetch_image_from_url(image_url)

    result = await ai_service.generate_text(
        "What do you see in this image? Describe it briefly.",
        images=[(image_bytes, mime_type)]
    )
    print("\nImage identification result:", result)
    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_identify_image_with_chat(ai_service):
    """Test identifying content in an image using chat"""
    image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/481px-Cat03.jpg"
    image_bytes, mime_type = await fetch_image_from_url(image_url)

    messages = [
        {
            "role": "user",
            "content": "What object is the main subject of this image? Just name it in 2-3 words.",
            "images": [(image_bytes, mime_type)]
        }
    ]
    result = await ai_service.chat(messages)
    print("\nChat image identification:", result["content"])
    assert len(result["content"]) > 0


@pytest.mark.asyncio
async def test_edit_image(tmp_path, ai_service):
    """Test editing an existing image"""
    image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/481px-Cat03.jpg"
    image_bytes, mime_type = await fetch_image_from_url(image_url)

    start_time = time.time()
    result = await ai_service.generate_image(
        "Make the cat wearing sunglasses",
        images=[(image_bytes, mime_type)]
    )
    elapsed_time = time.time() - start_time

    edited_image_file = tmp_path / "edited_image.png"
    with open(edited_image_file, "wb") as f:
        if hasattr(result, 'read'):
            f.write(result.read())
        else:
            f.write(result)

    print(f"\nEdited image saved at: {edited_image_file}")
    print(f"Image editing took: {elapsed_time:.2f} seconds")
    assert edited_image_file.exists()
    assert edited_image_file.stat().st_size > 0


@pytest.mark.asyncio
async def test_multiple_images_generate_text(ai_service):
    """Test identifying content in multiple images using generate_text"""
    image_url1 = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/481px-Cat03.jpg"
    image_url2 = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/400px-Cat_November_2010-1a.jpg"

    image_bytes1, mime_type1 = await fetch_image_from_url(image_url1)
    image_bytes2, mime_type2 = await fetch_image_from_url(image_url2)

    result = await ai_service.generate_text(
        "Compare these two images. What are the main differences?",
        images=[(image_bytes1, mime_type1), (image_bytes2, mime_type2)]
    )
    print("\nMulti-image comparison result:", result)
    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_combine_two_cats(tmp_path, ai_service):
    """Test combining two cat images into one"""
    image_url1 = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/481px-Cat03.jpg"
    image_url2 = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/400px-Cat_November_2010-1a.jpg"

    image_bytes1, mime_type1 = await fetch_image_from_url(image_url1)
    image_bytes2, mime_type2 = await fetch_image_from_url(image_url2)

    start_time = time.time()
    result = await ai_service.generate_image(
        "Combine both cats into a single image sitting side by side, with natural lighting and matching shadows",
        images=[(image_bytes1, mime_type1), (image_bytes2, mime_type2)]
    )
    elapsed_time = time.time() - start_time

    combined_image_file = tmp_path / "combined_cats.png"
    with open(combined_image_file, "wb") as f:
        if hasattr(result, 'read'):
            f.write(result.read())
        else:
            f.write(result)

    print(f"\nCombined image saved at: {combined_image_file}")
    print(f"Image combination took: {elapsed_time:.2f} seconds")
    assert combined_image_file.exists()
    assert combined_image_file.stat().st_size > 0
