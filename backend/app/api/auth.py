from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.encoders import jsonable_encoder
from app.models.user import UserCreate, UserResponse, UserInDB
from app.db.mongo import get_database
from app.core.security import get_password_hash, verify_password, create_access_token
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import timedelta

router = APIRouter()

@router.post("/signup", response_model=dict)
async def create_user(user: UserCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Hash password
    hashed_password = get_password_hash(user.password)
    
    # Create user dict
    user_in_db = UserInDB(
        email=user.email,
        hashed_password=hashed_password
    )
    
    new_user = await db.users.insert_one(user_in_db.dict(by_alias=True, exclude={"id"}))
    created_user = await db.users.find_one({"_id": new_user.inserted_id})
    
    # Generate Token
    access_token_expires = timedelta(days=7)
    access_token = create_access_token(
        subject=str(created_user["_id"]), expires_delta=access_token_expires
    )

    return {
        "status": "success",
        "token": access_token,
        "user": UserResponse(**created_user).dict(by_alias=True)
    }

@router.post("/login", response_model=dict)
async def login(user_credentials: UserCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    # Note: re-using UserCreate schema just for email/password fields, though technically we don't create user here.
    # Ideally use a separate Login schema or OAuth2PasswordRequestForm
    
    user = await db.users.find_one({"email": user_credentials.email})
    if not user:
         raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(user_credentials.password, user["hashed_password"]):
         raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token_expires = timedelta(days=7)
    access_token = create_access_token(
        subject=str(user["_id"]), expires_delta=access_token_expires
    )
    
    return {
        "status": "success",
        "token": access_token,
        "user": UserResponse(**user).dict(by_alias=True)
    }
