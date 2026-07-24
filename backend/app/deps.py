
from fastapi import Depends, HTTPException, Request, status

def get_current_user(request: Request):
    session = getattr(request.state, "session", None)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return session

def get_db():
    """No-op stub — this project uses Redis/IPFS, not a SQL database."""
    return None