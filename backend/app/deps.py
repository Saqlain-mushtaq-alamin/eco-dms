
from fastapi import Depends, HTTPException, Request, status

def get_current_user(request: Request):
    session = getattr(request.state, "session", None)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return session