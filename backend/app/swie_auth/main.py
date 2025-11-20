
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .session_middleware import SessionMiddleware
from .auth_routes import router as auth_router
from .user_routes import router as user_router

app = FastAPI(title="Eco DMS SIWE Auth")

app.add_middleware(SessionMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(user_router)

@app.get("/")
def root():
    return {"status": "ok"}