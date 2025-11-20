from sqlmodel import SQLModel, Field
from typing import Optional
import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    address: str = Field(index=True, unique=True)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    display_name: Optional[str] = None

