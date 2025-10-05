from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import ai, image, floorplan, scene
from app.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)
app.include_router(image.router)
app.include_router(floorplan.router)
app.include_router(scene.router)


@app.get("/")
async def root():
    return {"message": "Welcome to AI Microservices API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
