from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from app.models.user import UserCreate, UserResponse, UserInDB
from app.db.mongo import get_database
from app.core.security import get_password_hash, verify_password, create_access_token
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import timedelta, datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
import secrets
import re
from app.utils.email_utils import send_otp_email

router = APIRouter()

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v): raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v): raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v): raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v): raise ValueError("Password must contain at least one special character")
        return v

@router.post("/signup", response_model=dict)
async def create_user(user: UserCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    # Set is_verified to True immediately to skip email verification
    user_in_db = UserInDB(email=user.email, hashed_password=hashed_password, is_verified=True)
    
    new_user = await db.users.insert_one(user_in_db.dict(by_alias=True, exclude={"id"}))
    created_user = await db.users.find_one({"_id": new_user.inserted_id})
    
    # Issue token immediately
    access_token = create_access_token(
        subject=str(created_user["_id"]), expires_delta=timedelta(days=7)
    )
    
    return {
        "status": "success",
        "token": access_token,
        "user": UserResponse(**created_user).dict(by_alias=True)
    }

@router.post("/verify-email", response_model=dict)
async def verify_email(req: VerifyOTPRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    otp_record = await db.otps.find_one({"email": req.email, "type": "verification"})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found or expired")
    
    if otp_record["expires_at"] < datetime.utcnow():
        await db.otps.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(status_code=400, detail="OTP expired")
        
    if otp_record["otp"] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    await db.users.update_one({"email": req.email}, {"$set": {"is_verified": True}})
    await db.otps.delete_many({"email": req.email, "type": "verification"})

    # Check user and issue token
    user = await db.users.find_one({"email": req.email})
    access_token = create_access_token(
        subject=str(user["_id"]), expires_delta=timedelta(days=7)
    )
    
    return {
        "status": "success",
        "token": access_token,
        "user": UserResponse(**user).dict(by_alias=True)
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

@router.post("/forgot-password", response_model=dict)
async def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: AsyncIOMotorDatabase = Depends(get_database)):
    user = await db.users.find_one({"email": req.email})
    if not user:
        # Don't reveal if user exists or not
        return {"status": "success", "message": "If an account exists, an OTP will be sent."}
        
    otp_code = "".join(str(secrets.randbelow(10)) for _ in range(6))
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    await db.otps.delete_many({"email": req.email, "type": "reset"})
    await db.otps.insert_one({
        "email": req.email,
        "otp": otp_code,
        "type": "reset",
        "expires_at": expires_at
    })
    
    background_tasks.add_task(send_otp_email, req.email, otp_code, True)
    
    return {"status": "success", "message": "OTP sent."}


@router.post("/reset-password", response_model=dict)
async def reset_password(req: ResetPasswordRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    otp_record = await db.otps.find_one({"email": req.email, "type": "reset"})
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    if otp_record["expires_at"] < datetime.utcnow():
        await db.otps.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(status_code=400, detail="OTP expired")
        
    if otp_record["otp"] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    hashed_password = get_password_hash(req.new_password)
    await db.users.update_one({"email": req.email}, {"$set": {"hashed_password": hashed_password}})
    await db.otps.delete_many({"email": req.email, "type": "reset"})
    
    return {"status": "success", "message": "Password updated successfully"}
