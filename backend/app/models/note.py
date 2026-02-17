from pydantic import BaseModel, Field, BeforeValidator
from typing import Optional, Annotated
from datetime import datetime

PyObjectId = Annotated[str, BeforeValidator(str)]

class NoteBase(BaseModel):
    content: str

class NoteCreate(NoteBase):
    pass

class NoteInDB(NoteBase):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    userId: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
