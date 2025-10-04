# API Architecture Documentation (MVP)

## Context Analysis

**AI Architecture Visualization Tool Overview:**
- Sketch → Photorealistic Image → Floor Plan → 3D Interior
- MVP: In-memory storage, no database, no authentication

### 1. Executive Summary

**Product Overview & 4-Stage Pipeline:**
- Architecture diagram (text/ASCII)
- Technology stack
- External APIs (Nano Banana, GPT-4o, Unity)
- MVP constraints (in-memory, no auth)

### 2. Pipeline Data Flow

- Stage-by-stage data transformations
- In-memory state management
- Session/project storage structure

### 3. Endpoint Specifications (25+ endpoints)

#### Stage 1 - Sketch (3 endpoints)
- `POST /sketch/create`
- `POST /sketch/complete` (AI completion)
- `POST /sketch/revise` (AI revisions)

#### Stage 2 - Photorealistic Image (4 endpoints)
- `POST /image/generate` (sketch → image via Nano Banana)
- `POST /image/edit-region` (draw over + text prompt)
- `POST /image/revise` (AI changes)
- `GET /image/{project_id}`

#### Stage 3 - Floorplan (9 endpoints)
- `POST /floorplan/generate-base` (image → AI floorplan)
- `POST /floorplan/add-markers` (add black boxes)
- `POST /floorplan/extract-entities` (coordinates + dimensions)
- `POST /floorplan/classify-objects` (GPT-4o classification)
- `POST /floorplan/construct` (final floorplan with 2D objects)
- `PATCH /floorplan/{project_id}/move-object`
- `PATCH /floorplan/{project_id}/change-model`
- `POST /floorplan/generate-object` (AI assistant)
- `GET /floorplan/{project_id}`

#### Stage 4 - 3D Scene (3 endpoints)
- `POST /scene/generate` (floorplan → 3D coordinates)
- `GET /scene/{project_id}`
- `POST /scene/export` (Unity format)

#### Object Repository (3 endpoints)
- `GET /objects/types` (list all furniture types)
- `GET /objects/models/{type}` (models with images)
- `GET /objects/{type}/{model}` (specific model details)

#### Project Management (3 endpoints)
- `POST /projects` (create new)
- `GET /projects/{project_id}`
- `GET /projects/{project_id}/status`

**For each endpoint:** Method, path, inputs (Pydantic models), outputs, detailed functionality, error codes, curl examples

### 4. Data Models & Schemas

**Complete Pydantic models:**
- `SketchRequest`/`SketchResponse`
- `ImageGenerationRequest`/`ImageGenerationResponse`
- `FloorplanEntity`, `ObjectClassification`
- `Position2D`, `Dimensions2D`
- `FloorplanObject`, `SceneObject3D`
- `ObjectType` enum, `ModelID` enum
- `ProjectState`

### 5. Service Layer Architecture

**New services needed:**
- `SketchService` (AI completion/revision)
- `ImageGenerationService` (Nano Banana integration)
- `FloorplanExtractionService` (entity detection)
- `ObjectClassificationService` (GPT-4o integration)
- `FloorplanConstructionService` (2D layout)
- `SceneGenerationService` (2D → 3D conversion)
- `StorageService` (in-memory dict management)
- `ObjectRepositoryService` (furniture catalog)

**Service Extension Strategy:**
- How they extend existing `AIService`

### 6. In-Memory Storage Structure

- `PROJECTS: Dict[str, ProjectState]`
- `OBJECT_REPOSITORY: Dict[ObjectType, List[Model]]`
- Session management strategy

### 7. File Structure

**New files needed:**

```
app/
├── routers/
│   ├── sketch.py
│   ├── image.py
│   ├── floorplan.py
│   ├── scene.py
│   ├── objects.py
│   └── projects.py
├── services/
│   ├── sketch_service.py
│   ├── image_generation_service.py
│   ├── floorplan_extraction_service.py
│   ├── classification_service.py
│   ├── scene_generation_service.py
│   └── storage_service.py
├── schemas/
│   ├── sketch.py
│   ├── image.py
│   ├── floorplan.py
│   ├── scene.py
│   ├── objects.py
│   └── common.py
└── storage/
    └── memory_store.py
```

### 8. External API Integration Details

- Nano Banana API (endpoints, payloads)
- OpenAI GPT-4o Vision (classification prompts)
- Image processing (cropping, masking)
- Unity WebGL data format

### 9. Object Detection & Classification Pipeline

**Detailed algorithm for intermediary steps:**
- Black box placement logic
- Coordinate extraction from simplified floorplan
- Image cropping/masking
- Classification prompt engineering
- Fallback strategies

### 10. Code Reuse from Existing Codebase

- Extend `AIService` for GPT-4o
- Reuse `fetch_image_from_url`, `ALLOWED_IMAGE_TYPES`
- Expand config for new API keys
- Image handling patterns

### 11. Implementation Phases

- **Phase 1:** Project management + Sketch endpoints
- **Phase 2:** Image generation + editing
- **Phase 3:** Floorplan extraction pipeline (complex)
- **Phase 4:** 3D scene generation
