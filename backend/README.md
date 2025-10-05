# Backend API

FastAPI backend for interior design AI application with floorplan generation, furniture detection, and image generation.

## Features

-   **Floorplan Generation**: Convert sketches to detailed floorplans using AI
-   **Furniture Detection & Classification**: Automatically detect and classify furniture objects in floorplans using FastSAM and OpenAI Vision
-   **Floorplan Revision**: Refine floorplans with natural language instructions
-   **Photorealistic Rendering**: Generate photorealistic images from floorplans
-   **Scene Export**: Export scenes for Unity integration

## Setup

### 1. Install Dependencies

```bash
# Using pip
pip install -e .

# Or using uv (faster)
uv pip install -e .
```

### 2. Download FastSAM Model

The furniture detection feature requires the FastSAM model file. Download it and place it in the backend root directory:

```bash
# Download FastSAM-s.pt (small model, ~23MB)
wget https://github.com/CASIA-IVA-Lab/FastSAM/releases/download/v0.1/FastSAM-s.pt

# Or download FastSAM-x.pt (larger model, better accuracy, ~138MB)
# wget https://github.com/CASIA-IVA-Lab/FastSAM/releases/download/v0.1/FastSAM-x.pt
```

Place the model file in the backend root directory:

```
backend/
├── FastSAM-s.pt  <-- Place here
├── app/
├── main.py
└── pyproject.toml
```

### 3. Environment Variables

Create a `.env` file in the backend directory:

```env
# Required: OpenAI API key for furniture classification and image generation
OPENAI_API_KEY=sk-...

# Optional: Other API keys
GOOGLE_API_KEY=...
```

### 4. Run the Server

```bash
# Development mode with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### Floorplan Endpoints

-   `POST /floorplan/generate` - Generate floorplan from sketch

    -   Input: `sketch` (image file)
    -   Output: PNG image

-   `POST /floorplan/extract` - Extract and classify furniture objects from floorplan

    -   Input: `floorplan` (image file)
    -   Output: JSON array of detected furniture objects with positions, dimensions, and classifications

-   `POST /floorplan/revise` - Revise floorplan with instructions
    -   Input: `annotated_floorplan` (image file), `instruction` (text)
    -   Output: PNG image

### Image Endpoints

-   `POST /image/generate` - Generate photorealistic image from floorplan
    -   Input: `floorplan` (image file)
    -   Output: PNG image

### Scene Endpoints

-   `POST /scene/export` - Export scene to Unity format
    -   Input: JSON array of furniture objects
    -   Output: JSON Unity scene data

## Furniture Detection & Classification

The `/floorplan/extract` endpoint uses a two-stage pipeline:

1. **Segmentation (FastSAM)**: Segments objects from the floorplan image
2. **Classification (GPT-4o-mini Vision)**: Classifies each segmented object into furniture types

Supported furniture types:

-   Architectural: doors, windows, walls
-   Bedroom: beds, dressers
-   Seating: chairs, sofas
-   Tables: dining tables, desks
-   Bathroom: toilets, sinks, bathtubs, showers
-   Kitchen: counters, refrigerators, ovens, dishwashers
-   Storage: cabinets, closets
-   Other: stairs, unknown objects

Each detected object includes:

-   Position (normalized coordinates)
-   Dimensions (normalized size)
-   Bounding box (pixel and normalized)
-   Classification (type, name, confidence)
-   Reasoning (why it was classified that way)

## Development

### Project Structure

```
backend/
├── app/
│   ├── routers/          # API route handlers
│   │   ├── floorplan.py  # Floorplan endpoints
│   │   ├── image.py      # Image generation endpoints
│   │   └── scene.py      # Scene export endpoints
│   ├── services/         # Business logic
│   │   ├── segmentation_service.py      # Furniture detection & classification
│   │   ├── minglun_service.py           # Object extraction coordinator
│   │   ├── image_generation_service.py  # Image generation
│   │   └── scene_generation_service.py  # Scene export
│   ├── schemas/          # Pydantic models
│   └── config.py         # Configuration
├── test/                 # Tests
├── FastSAM-s.pt         # FastSAM model (download separately)
├── main.py              # FastAPI app entry point
└── pyproject.toml       # Dependencies
```

### Running Tests

```bash
pytest
```

## Troubleshooting

### Model Not Found Error

If you see an error about `FastSAM-s.pt` not found:

1. Make sure you've downloaded the model (see Setup section)
2. Place it in the backend root directory (same level as `main.py`)
3. Check the file name is exactly `FastSAM-s.pt`

### OpenAI API Key Error

If furniture classification isn't working:

1. Make sure `OPENAI_API_KEY` is set in `.env`
2. Verify your API key is valid and has credits
3. The classification will fallback to "Other/Unknown" if the API key is missing

### Memory Issues

If you run out of memory during segmentation:

-   Use FastSAM-s.pt (small model) instead of FastSAM-x.pt
-   Reduce the image size before processing
-   Adjust the `conf` and `iou` thresholds to detect fewer objects

## License

See LICENSE file in the project root.
