from pydantic import BaseModel, Field, BeforeValidator
from typing import Optional, Annotated, Any
from datetime import datetime
from typing import List, Dict

# Helper to handle ObjectId in Pydantic
PyObjectId = Annotated[str, BeforeValidator(str)]

class UploadLog(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    filename: str
    originalName: str
    path: str
    userId: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class QueryLog(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    question: str
    title: Optional[str] = None
    generatedSQL: str
    resultSummary: str
    uploadId: Optional[str] = None
    userId: Optional[str] = None
    result: Optional[Any] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
