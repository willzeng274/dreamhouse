from fastapi import FastAPI
from app.routers import ai, projects, sketch, image, floorplan, scene, objects
from app.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.include_router(ai.router)
app.include_router(projects.router)
app.include_router(sketch.router)
app.include_router(image.router)
app.include_router(floorplan.router)
app.include_router(scene.router)
app.include_router(objects.router)


@app.get("/")
async def root():
    return {"message": "Welcome to AI Microservices API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
