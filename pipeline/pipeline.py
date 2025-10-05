import os
import cv2
import numpy as np
from collections import deque
from PIL import Image
import requests
import base64
from io import BytesIO
from typing import List, Tuple, Dict
from dataclasses import dataclass
import json
import logging
from datetime import datetime
from dotenv import load_dotenv
from google import genai
from google.genai import types


# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('pipeline.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

rectangle_pixel_dist_lenience = 5
color_similarity_threshold = 50

@dataclass
class FurnitureObject:
    """Represents a detected furniture object with its properties."""
    x: int
    y: int
    width: int
    height: int
    furniture_type: str
    color: Tuple[int, int, int]

class FurnitureDetectionPipeline:
    """Pipeline for detecting and categorizing furniture in floor plans."""
    
    def __init__(self, google_api_key: str):
        self.google_api_key = google_api_key
        self.furniture_types = [
            "chair", "table", "sofa", "bed", "desk"
        ]
        # Initialize the Google GenAI client for both rectangle generation and categorization
        self.genai_client = genai.Client(api_key=google_api_key)
    
    def add_rectangles_to_furniture(self, image_with_furniture: np.ndarray) -> np.ndarray:
        """
        Step 1: Add red rectangles over furniture using nano banana.
        """
        print("Step 1: Adding red rectangles to furniture...")
        print(f"Input image shape: {image_with_furniture.shape}")
        
        try:
            # Convert to pure black and white before sending to Gemini
            print("Converting image to pure black and white...")
            if len(image_with_furniture.shape) == 3:
                # Convert to grayscale first
                gray = cv2.cvtColor(image_with_furniture, cv2.COLOR_BGR2GRAY)
                # Apply threshold to get pure black and white
                _, bw_image = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
                print("Applied binary threshold for pure black/white")
            else:
                # Already grayscale, apply threshold
                _, bw_image = cv2.threshold(image_with_furniture, 127, 255, cv2.THRESH_BINARY)
                print("Applied binary threshold to grayscale image")
            
            # Convert to PIL Image
            pil_image = Image.fromarray(bw_image)
            print("Converted to PIL Image")
            
            # Convert to bytes for API
            img_buffer = BytesIO()
            pil_image.save(img_buffer, format='PNG')
            img_data = img_buffer.getvalue()
            print(f"Image encoded to PNG, size: {len(img_data)} bytes")
            
            # Create the prompt for adding red rectangles (same as test.py)
            prompt = """
For each piece of furniture in this image, generate a filled box of non-black and
non-white color overlaping the entire furniture object. 

Each piece of furniture should have a different color. Ensure the boxes overlapping 
all furniture objects do not touch or overlap each other across multiple furniture 
pieces. 

Fill the entire box with the same color, do not preserve the furniture image/outline 
itself, I should only see a bunch of colorful boxes in a floor plan.

Be careful to separate the different furniture pieces that are close together.
E.g. For a table with chairs tucked in, make sure the table and each chair all have
distinctly different colors.

DRAW OVER THE OUTLINE OF THE FURNITURE OBJECTS. IN ORDER TO SEGMENT THERE CANNOT BE 
BORDERS OF DIFFERENT COLOR WITHIN THE SAME FURNITURE OBJECT.

Do not add any colors to floors or carpets. Only the furniture itself should have the
colors.

For a bed, the pillows and blankets should all be colored under the same mask.
Same with couches and the cushions on them.
"""
            print("Sending request to nano banana API...")
            
            # Generate image with red rectangles using Gemini
            response = self.genai_client.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=[prompt, pil_image],
            )
            print("Received response from nano banana API")
            print(f"Response type: {type(response)}")
            print(f"Response candidates: {len(response.candidates) if hasattr(response, 'candidates') else 'No candidates'}")
            
            # Extract generated image from response
            for part in response.candidates[0].content.parts:
                if part.text is not None:
                    print(part.text)
                elif part.inline_data is not None:
                    generated_image = Image.open(BytesIO(part.inline_data.data))
                    # Convert back to numpy array
                    generated_array = np.array(generated_image)
                    if len(generated_array.shape) == 3:
                        generated_array = cv2.cvtColor(generated_array, cv2.COLOR_RGB2BGR)
                    print(f"Successfully added red rectangles to furniture. Output shape: {generated_array.shape}")
                    
                    # Save the masked image as generated_image.png in the pipeline directory
                    cv2.imwrite("./pipeline/generated_image.png", generated_array)
                    print(f"Saved masked image to: ./pipeline/generated_image.png")
                    
                    return generated_array
            
            # If no image generated, return original
            print("No rectangle image generated, returning original")
            return image_with_furniture.copy()
            
        except Exception as e:
            print(f"Error adding red rectangles: {e}")
            return image_with_furniture.copy()
    
    def detect_rectangles_bfs(self, image: np.ndarray) -> List[Tuple[int, int, int, int, Tuple[int, int, int]]]:
        """
        Step 2: Use BFS algorithm to detect colored rectangles (non-grayscale) and extract coordinates.
        Returns list of (x, y, width, height, color) for each detected rectangle.
        """
        print("Step 2: Detecting colored rectangles using BFS...")
        print(f"Input image shape: {image.shape}")
        
        # Convert to RGB for color analysis
        if len(image.shape) == 3:
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        else:
            rgb_image = image
        print("Converted image to RGB color space")
        
        height, width = rgb_image.shape[:2]
        print(f"Starting color detection scan on {height}x{width} image")
        
        # Find all non-grayscale colors
        visited = np.zeros((height, width), dtype=bool)
        rectangles = []
                
        for y in range(height):
            for x in range(width):
                if visited[y, x]:
                    continue
                    
                # Get the color at this pixel
                if len(rgb_image.shape) == 3:
                    r, g, b = rgb_image[y, x]
                    # Convert to regular Python integers to avoid uint8 overflow
                    r, g, b = int(r), int(g), int(b)
                else:
                    r = g = b = int(rgb_image[y, x])
                
                # Check if this is a grayscale color (white/black gradient)
                # Calculate how similar R, G, B values are to each other
                # rgb_variance = (abs(r - g) + abs(g - b) + abs(r - b)) / 3
                # rgb_variance = max(abs(r-g), max(abs(g-b), abs(r-b)))
                rgb_variance = max([abs(r-g), abs(g-b), abs(r-b)])
                
                # Consider it grayscale if RGB values are very similar (within 15 units on average)
                is_grayscale = rgb_variance < 75
                
                # Also check if it's very close to pure black or white (within 20 units)
                is_near_black = r < 20 and g < 20 and b < 20
                is_near_white = r > 235 and g > 235 and b > 235
                
                if is_grayscale or is_near_black or is_near_white:
                    continue  # Skip grayscale, near-black, and near-white pixels
                
                # Print colored pixel with ANSI color codes
                color_code = f"\033[38;2;{r};{g};{b}m"
                reset_code = "\033[0m"
                print(f"Found colored pixel at ({x}, {y}) with RGB({r}, {g}, {b}) {color_code}●{reset_code}")
                print(f"rgb_variance: {rgb_variance}")
                print(abs(r-b))
                print(abs(r-g))
                print(abs(b-g))
                
                # BFS to find all connected pixels of this specific color
                queue = deque([(x, y)])
                visited[y, x] = True
                
                # Track bounds of this connected component
                min_x, max_x = x, x
                min_y, max_y = y, y
                target_color = (r, g, b)
                
                
                while queue:
                    curr_x, curr_y = queue.popleft()
                    
                    # Update bounds
                    min_x = min(min_x, curr_x)
                    max_x = max(max_x, curr_x)
                    min_y = min(min_y, curr_y)
                    max_y = max(max_y, curr_y)
                    
                    # Check all pixels within 5-pixel radius
                    for dx in range(-rectangle_pixel_dist_lenience, rectangle_pixel_dist_lenience+1):
                        for dy in range(-rectangle_pixel_dist_lenience, rectangle_pixel_dist_lenience+1):
                            if dx == 0 and dy == 0:
                                continue
                            
                            nx, ny = curr_x + dx, curr_y + dy
                            
                            if (0 <= nx < width and 0 <= ny < height and not visited[ny, nx]):
                                # Get neighbor color
                                if len(rgb_image.shape) == 3:
                                    nr, ng, nb = rgb_image[ny, nx]
                                    # Convert to regular Python integers to avoid uint8 overflow
                                    nr, ng, nb = int(nr), int(ng), int(nb)
                                else:
                                    nr = ng = nb = int(rgb_image[ny, nx])
                                
                                # Check if neighbor has similar color (within tolerance)
                                color_diff = abs(nr - target_color[0]) + abs(ng - target_color[1]) + abs(nb - target_color[2])
                                if color_diff < color_similarity_threshold:  # Color similarity threshold
                                    visited[ny, nx] = True
                                    # print(f"Found similar color pixel at ({nx}, {ny}) with RGB({nr}, {ng}, {nb}) {color_code}●{reset_code}")
                                    queue.append((nx, ny))
                
                # Only consider components with reasonable size
                if (max_x - min_x) > 10 and (max_y - min_y) > 10:
                    width_rect = max_x - min_x
                    height_rect = max_y - min_y
                    rectangles.append((min_x, min_y, width_rect, height_rect, target_color))
                    # Print colored rectangle with ANSI color codes
                    color_code = f"\033[38;2;{target_color[0]};{target_color[1]};{target_color[2]}m"
                    reset_code = "\033[0m"
                    print(f"Found colored rectangle: ({min_x}, {min_y}) size {width_rect}x{height_rect} color RGB{target_color} {color_code}■{reset_code}")
        
        print(f"Detected {len(rectangles)} colored rectangles")
        
        # Output intermediate state with coordinates, dimensions, and colors
        print("\n" + "=" * 60)
        print("INTERMEDIATE STATE - DETECTED RECTANGLES")
        print("=" * 60)
        for i, (x, y, w, h, color) in enumerate(rectangles, 1):
            color_code = f"\033[38;2;{color[0]};{color[1]};{color[2]}m"
            reset_code = "\033[0m"
            print(f"Rectangle {i}:")
            print(f"  Coordinates: ({x}, {y})")
            print(f"  Dimensions: {w} x {h}")
            print(f"  Color: RGB{color} {color_code}■{reset_code}")
            print(f"  Area: {w * h} pixels")
            print()
        
        return rectangles
    
    def draw_rectangles_on_image(self, original_image: np.ndarray, rectangles: List[Tuple[int, int, int, int, Tuple[int, int, int]]]) -> np.ndarray:
        """
        Draw filled rectangles with their detected colors onto the original image.
        """
        print("Drawing detected rectangles onto original image...")
        
        # Create a copy of the original image
        image_with_rectangles = original_image.copy()
        
        for i, (x, y, width, height, color) in enumerate(rectangles):
            # Convert RGB color to BGR for OpenCV
            bgr_color = (int(color[2]), int(color[1]), int(color[0]))  # BGR format
            
            # Draw filled rectangle
            cv2.rectangle(image_with_rectangles, (x, y), (x + width, y + height), bgr_color, -1)
            
            print(f"Drew rectangle {i+1}: ({x}, {y}) size {width}x{height} color RGB{color}")
        
        # Save the image with rectangles
        output_path = "./pipeline/rectangles_overlay.png"
        cv2.imwrite(output_path, image_with_rectangles)
        print(f"Saved image with rectangles to: {output_path}")
        
        return image_with_rectangles
    
    def categorize_furniture_with_gemini(self, cropped_image: np.ndarray) -> str:
        return ""
        """
        Step 3: Use Gemini to categorize furniture in the cropped image.
        """
        print("Step 3: Categorizing furniture with Gemini...")
        print(f"Cropped image shape: {cropped_image.shape}")
        
        try:
            # Convert image to base64
            _, buffer = cv2.imencode('.jpg', cropped_image)
            image_base64 = base64.b64encode(buffer).decode('utf-8')
            print(f"Image encoded to base64, size: {len(image_base64)} characters")
            
            # Create prompt for furniture categorization
            prompt = f"""Look at this furniture image and categorize it as one of these types: {', '.join(self.furniture_types)}. 
            
Consider the following guidelines:
- CHAIR: Small seating with backrest, typically for one person
- TABLE: Flat surface for placing items, usually with legs
- SOFA: Large seating for multiple people, often with cushions
- BED: Sleeping furniture, typically rectangular with mattress
- DESK: Work surface, often with drawers or storage

Return only the furniture type name, nothing else."""
            
            # Use Gemini for categorization
            print("Sending request to Gemini...")
            response = self.genai_client.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=[prompt, cropped_image],
            )
            print("Received response from Gemini")
            
            # Extract and clean the response
            furniture_type = ""
            for part in response.candidates[0].content.parts:
                if part.text is not None:
                    furniture_type = part.text.strip().lower()
                    break
            print(f"Raw Gemini response: '{furniture_type}'")
            
            # Validate against known types
            for known_type in self.furniture_types:
                if known_type in furniture_type:
                    print(f"Matched furniture type: {known_type}")
                    return known_type
            
            print(f"No match found, using default: {self.furniture_types[0]}")
            return self.furniture_types[0]  # Default to first type
                
        except Exception as e:
            print(f"Error calling Gemini: {e}")
            return self.furniture_types[0]
    
    def process_floor_plan(self, floor_plan_image: np.ndarray) -> List[FurnitureObject]:
        """
        Main pipeline function that processes a floor plan image with existing furniture
        and returns detected furniture objects with their coordinates, dimensions, and types.
        """
        print("=" * 60)
        print("STARTING FURNITURE DETECTION PIPELINE")
        print("=" * 60)
        print(f"Input image shape: {floor_plan_image.shape}")
        
        # Step 1: Add red rectangles to existing furniture
        print("\n" + "-" * 40)
        image_with_rectangles = self.add_rectangles_to_furniture(floor_plan_image)
        
        # Step 2: Detect red rectangles using BFS
        print("\n" + "-" * 40)
        rectangles = self.detect_rectangles_bfs(image_with_rectangles)
        
        # Step 3: Display all detected rectangles with their properties
        print("\n" + "-" * 40)
        print("Step 3: Displaying all detected rectangles...")
        
        print("\n" + "=" * 60)
        print("ALL DETECTED RECTANGLES")
        print("=" * 60)
        
        for i, (x, y, width, height, color) in enumerate(rectangles, 1):
            color_code = f"\033[38;2;{color[0]};{color[1]};{color[2]}m"
            reset_code = "\033[0m"
            area = width * height
            
            print(f"Rectangle {i}:")
            print(f"  Coordinates: ({x}, {y})")
            print(f"  Dimensions: {width} x {height}")
            print(f"  Color: RGB{color} {color_code}■{reset_code}")
            print(f"  Area: {area} pixels")
            print()
        
        print("=" * 60)
        print("RECTANGLE DETECTION COMPLETED")
        print("=" * 60)
        print(f"Total rectangles detected: {len(rectangles)}")
        
        # Step 4: Draw rectangles onto the original image
        print("\n" + "-" * 40)
        print("Step 4: Drawing rectangles onto original image...")
        image_with_drawn_rectangles = self.draw_rectangles_on_image(floor_plan_image, rectangles)
        
        return rectangles

def main():
    """Example usage of the furniture detection pipeline."""
    print("FURNITURE DETECTION PIPELINE")
    print("=" * 50)
    
    # Load environment variables
    print("Loading environment variables...")
    google_api_key = os.getenv('GEMINI_API_KEY')
    
    if not google_api_key:
        print("✗ Error: GEMINI_API_KEY environment variable not set")
        return
    
    print("✓ Google API key loaded successfully")
    
    # Initialize pipeline
    print("Initializing pipeline...")
    pipeline = FurnitureDetectionPipeline(google_api_key)
    print("✓ Pipeline initialized")
    
    # Load the floor plan image
    floor_plan_path = "./pipeline/floor-plan-4.png"
    print(f"Loading floor plan image: {floor_plan_path}")
    
    try:
        # Load the PNG image using OpenCV
        floor_plan_image = cv2.imread(floor_plan_path)
        
        if floor_plan_image is None:
            print(f"✗ Error: Could not load image from {floor_plan_path}")
            return
        
        print(f"✓ Successfully loaded floor plan image: {floor_plan_path}")
        print(f"Image dimensions: {floor_plan_image.shape}")
        
        # Process the floor plan
        print("\nStarting pipeline processing...")
        rectangles = pipeline.process_floor_plan(floor_plan_image)
        
        # Final summary
        print("\n" + "=" * 50)
        print("PIPELINE EXECUTION COMPLETE")
        print("=" * 50)
        print(f"Total rectangles detected: {len(rectangles)}")
        
        if rectangles:
            print("\nSUMMARY OF DETECTED RECTANGLES:")
            print("-" * 30)
            for i, (x, y, width, height, color) in enumerate(rectangles, 1):
                color_code = f"\033[38;2;{color[0]};{color[1]};{color[2]}m"
                reset_code = "\033[0m"
                print(f"{i}. Rectangle")
                print(f"   Position: ({x}, {y})")
                print(f"   Dimensions: {width} x {height}")
                print(f"   Color: RGB{color} {color_code}■{reset_code}")
                print(f"   Area: {width * height} pixels")
                print()
        else:
            print("No rectangles were detected in the image.")
            
    except Exception as e:
        print(f"❌ Error processing floor plan: {e}")
        return

if __name__ == "__main__":
    main()