from fastapi import APIRouter, HTTPException
from app.schemas.project import ProjectCreate, ProjectResponse
from app.storage import memory_store
import uuid

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse)
async def create_project(request: ProjectCreate):
    project_id = str(uuid.uuid4())
    project = memory_store.create_project(project_id)
    return ProjectResponse(**project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    project = memory_store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(**project)
