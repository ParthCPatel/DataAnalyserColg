from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.db.mongo import db

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS Config
origins = ["*"] # Adjust in production

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup/Shutdown events
@app.on_event("startup")
async def startup_event():
    db.connect_to_database()

@app.on_event("shutdown")
async def shutdown_event():
    db.close_database_connection()

@app.get("/")
def root():
    return {"message": "Welcome to Data Analyzer API"}

from app.api import auth, upload, sandbox, analyze, history, dashboard, notes, data

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(sandbox.router, prefix="/api", tags=["sandbox"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(history.router, prefix="/api", tags=["history"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(notes.router, prefix="/api", tags=["notes"])
app.include_router(data.router, prefix="/api", tags=["data"])
