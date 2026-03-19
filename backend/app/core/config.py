from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Data Analyzer API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"
    
    # MongoDB
    MONGODB_URI: str = os.getenv("MONGODB_URI")
    DATABASE_NAME: str = "data-analyzer"
    
    # Security
    JWT_SECRET: str = "5f8e2a9c1b4d3e7g6h9i2j5k8l1m4n7o2p3q5r8" # Matching Node.js default
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Google Gemini
    GOOGLE_API_KEY: str | None = None

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings():
    return Settings()
