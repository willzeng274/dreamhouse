from pydantic import BaseModel
from enum import Enum


class Position2D(BaseModel):
    x: float
    y: float


class Dimensions2D(BaseModel):
    x: float
    y: float


class ObjectType(str, Enum):
    TABLE = "table"
    CHAIR = "chair"
    BED = "bed"
    SOFA = "sofa"
    DESK = "desk"
    CABINET = "cabinet"
    SHELF = "shelf"
