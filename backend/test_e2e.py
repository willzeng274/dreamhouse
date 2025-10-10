import httpx
import asyncio
import os


BASE_URL = "http://localhost:8001"
OUTPUT_DIR = "e2e_output_images"


def save_image(image_bytes: bytes, filename: str):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    print(f"  💾 Saved: {filepath}")


async def create_dummy_sketch() -> bytes:
    import io
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (512, 512), color="white")
    draw = ImageDraw.Draw(img)

    draw.rectangle([50, 50, 450, 450], outline="black", width=3)
    draw.rectangle([100, 100, 200, 200], outline="blue", width=2)
    draw.rectangle([250, 100, 350, 200], outline="blue", width=2)
    draw.rectangle([100, 250, 300, 400], outline="blue", width=2)

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


async def test_workflow():
    async with httpx.AsyncClient(timeout=120.0) as client:

        print("=" * 60)
        print("AI ARCHVIZ E2E TEST - SIMPLIFIED WORKFLOW")
        print("=" * 60)

        print("\n1. Generating floorplan from sketch (Gemini)...")
        sketch_bytes = await create_dummy_sketch()
        files = {"sketch": ("sketch.png", sketch_bytes, "image/png")}

        response = await client.post(f"{BASE_URL}/floorplan/generate", files=files)
        floorplan_bytes = response.content
        print(f"   ✓ Floorplan generated ({len(floorplan_bytes)} bytes)")
        save_image(floorplan_bytes, "01_floorplan.png")

        print("\n2. Extracting objects from floorplan (MingLun Pipeline)...")
        files = {"floorplan": ("floorplan.png", floorplan_bytes, "image/png")}

        response = await client.post(f"{BASE_URL}/floorplan/extract", files=files)
        extract_result = response.json()
        objects = extract_result["objects"]
        print(f"   ✓ Extracted {len(objects)} objects")
        for i, obj in enumerate(objects[:3], 1):
            print(
                f"     Object {i}: {obj.get('type', 'unknown')} at ({obj.get('position', {}).get('x', 0)}, {obj.get('position', {}).get('y', 0)})"
            )

        print("\n3a. Revising floorplan with instruction (Gemini)...")
        instruction = "add more windows and adjust wall thickness"
        files = {"annotated_floorplan": ("floorplan.png", floorplan_bytes, "image/png")}
        data = {"instruction": instruction}

        response = await client.post(
            f"{BASE_URL}/floorplan/revise", files=files, data=data
        )
        revised_floorplan_bytes = response.content
        print(f"   ✓ Floorplan revised with instruction: '{instruction}'")
        save_image(revised_floorplan_bytes, "02_revised_floorplan.png")

        print("\n3b. Generating photorealistic image from floorplan (Gemini)...")
        files = {"floorplan": ("floorplan.png", revised_floorplan_bytes, "image/png")}

        response = await client.post(f"{BASE_URL}/image/generate", files=files)
        photorealistic_bytes = response.content
        print(
            f"   ✓ Photorealistic image generated ({len(photorealistic_bytes)} bytes)"
        )
        save_image(photorealistic_bytes, "03_photorealistic.png")

        print("\n4. Exporting to Unity format...")
        response = await client.post(f"{BASE_URL}/scene/export", json=objects)
        unity_result = response.json()
        unity_scene = unity_result["unity_scene"]
        print(f"   ✓ Exported {len(unity_scene['objects'])} objects to Unity format")
        print(
            f"     Sample Unity object: {unity_scene['objects'][0] if unity_scene['objects'] else 'None'}"
        )

        print("\n" + "=" * 60)
        print("✅ ALL E2E TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print(f"Generated 3 images in {OUTPUT_DIR}/")


if __name__ == "__main__":
    asyncio.run(test_workflow())
