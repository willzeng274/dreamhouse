AI archviz tool to help anyone go from rough sketch to full 3D interior scene, with furniture, walls, custom layout, etc.

# Sequence

**High-Level: **Sketch -> Photorealistic Image -> Floor Plan -> 3D Interior
**Granular: **Sketch (AI assistant available) -> AI Photorealistic Top-Down Image (editable + AI assistant) -> Floor Plan (editable + pick classified furtniture models + AI assistant) -> 3D Interior (Unity experience, moveable objects, exploration)

# Stages

## 1. Sketch:

- Freeform sketch on an infinite canvas
- AI assistant that can complete sketch/add details
- AI revisions

## 2. AI Photorealistic Image Gen

- Send sketch to nano banana for image gen
- AI assistant for image changes
- Draw over any part of the image, send text input to change it

## 3. Floorplan Generation

INTERMEDIARY FIRST STEPS:

Entity Extraction and Classification:
1. Send photorealistic image to nano banana to create AI floorplan
2. Send AI floorplan to nano banana with instruct to add black boxes over all items/furniture
3. Use simplified AI floorplan to extract object coordinates (Vec2) and dimensions (Vec2), along with wall shape and structure (TBD)
4. Use each object coordinate to crop mask from OG AI floorplan
5. Send cropped image (object) to GPT-4o to classify - classify based on repisitory of AVAILABLE OBJECTS
6. Classify object type first (from text list - table, chair, bed, etc.)
7. Classify model next (from images - 001, 002, 003, etc.)
Output:
```js
{
      "objects": [
           {
                  "type": "object type",
                  "model": n,
                  "position": {x, y},
                 "dimensions": {x, y},
            },
            ...
      ]
}```

Floorplan Generation:
1. Place 2D versions of each extracted entity type in appropriate position with appropriate dimensions
2. Construct floorplan (walls, items, etc.)

- Click on any object to change its model (from sidebar)
- Drag any object to move
- AI assistant to generate new objects (placed by hand)
- Generates and shows object names (bed, table, etc.), room names (AI generated), exact dimensions of everything, etc.

## 4. 3D Interior Visualization

- 3D versions of each object is placed in scene with appropriate horizontal coordinates and dimensions
- Rendered and shown in Unity scene
