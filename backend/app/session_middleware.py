from starlette.middleware.base import BaseHTTPMiddleware
from itsdangerous import TimestampSigner, BadSignature
from fastapi import Request
from .config import settings
from .siwe_store import session_store

signer = TimestampSigner(settings.SECRET_KEY)

class SessionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        cookie_name = settings.SESSION_COOKIE_NAME
        raw = request.cookies.get(cookie_name)
        session_data = None
        if raw:
            try:
                sid = signer.unsign(raw, max_age=session_store.ttl).decode()
                session_data = session_store.get_session(sid)
                if session_data:
                    request.state.session = session_data
                    request.state.session_id = sid
            except BadSignature:
                pass
        response = await call_next(request)
        return response

def set_session_cookie(response, sid: str):
    signed = signer.sign(sid).decode()
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=signed,
        httponly=True,
        secure=False,
        samesite="Lax",
        max_age=session_store.ttl,
        path="/"
    )

def clear_session_cookie(response):
    response.delete_cookie(settings.SESSION_COOKIE_NAME, path="/")