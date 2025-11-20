
from fastapi import APIRouter, Depends, HTTPException
from .deps import get_current_user
from .schemas import UserResponse
from .models import User
from sqlmodel import SQLModel, create_engine, Session, select

router = APIRouter(prefix="/api", tags=["user"])
engine = create_engine("sqlite:///./siwe.db")

@router.get("/me", response_model=UserResponse)
def me(session = Depends(get_current_user)):
    address = session["address"]
    with Session(engine) as db:
        statement = select(User).where(User.address == address)
        user = db.exec(statement).first()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse(address=user.address, display_name=user.display_name)