from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import os

# Get API key from environment variable
# api_key = os.getenv("GEMINI_API_KEY")

api_key = os.getenv("GEMINI_API_KEY")

print("api_key:", api_key)

if not api_key:
    print("Error: GEMINI_API_KEY environment variable is not set!")
    print("Please set your API key using one of these methods:")
    print("1. Set environment variable: set GEMINI_API_KEY=your_api_key_here")
    print("2. Or create a .env file with: GEMINI_API_KEY=your_api_key_here")
    exit(1)

client = genai.Client(api_key=api_key)
    
prompt = """
For each piece of furniture in this image, generate a filled box of non-black and
non-white color overlaping the entire furniture object. Each piece of furniture
should have a different color. Ensure the boxes overlapping all furniture objects
do not touch or overlap each other across multiple furniture pieces. Fill the
entire box with the same color, do not preserve the furniture image/outline 
itself, I should only see a bunch of colorful boxes in a floor plan.
"""

image = Image.open("floor-plan-2.png")

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[prompt, image],
)

for part in response.candidates[0].content.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = Image.open(BytesIO(part.inline_data.data))
        image.save("generated_image.png")