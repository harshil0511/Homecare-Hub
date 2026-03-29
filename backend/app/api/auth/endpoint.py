from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.internal import deps
from app.core import security
from app.core.security import validate_password
from app.core.config import settings
from app.internal.models import User, Society
from app.internal.schemas import UserCreate, UserLogin, UserResponse, Token, ForgotPassword

router = APIRouter(tags=["Authentication API"])


@router.post("/signup", response_model=UserResponse)
def signup(user_in: UserCreate, db: Session = Depends(deps.get_db)):
    # 1. Check if email already exists
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # 2. Server-side password validation
    validate_password(user_in.password)

    # 3. SuperAdmin guard: force ADMIN role for the designated superadmin email
    role = user_in.role
    if user_in.email == settings.SUPERADMIN_EMAIL:
        role = "ADMIN"

    # 4. Secretary must provide a valid society_id
    society_id = None
    if role == "SECRETARY":
        if user_in.society_id is None:
            raise HTTPException(status_code=400, detail="Secretary must select a society.")
        society = db.query(Society).filter(Society.id == user_in.society_id).first()
        if not society:
            raise HTTPException(status_code=404, detail="Selected society not found.")
        society_id = user_in.society_id

    # 5. Create and save the user
    db_user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=security.get_password_hash(user_in.password),
        role=role,
        society_id=society_id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(deps.get_db)):
    # 1. Find user by email
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email address not found. Please check your email or sign up."
        )

    # 2. Verify password
    if not security.verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong password. Please try again."
        )

    # 3. Check account active
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact support.")

    # 4. Create JWT with role embedded (so frontend knows role without extra /me call)
    access_token = security.create_access_token(data={
        "sub": user.user_uuid,
        "role": user.role,
        "email": user.email
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_uuid": user.user_uuid,
        "username": user.username
    }


@router.post("/forgot-password")
def forgot_password(data: ForgotPassword, db: Session = Depends(deps.get_db)):
    """
    Open endpoint (no auth required) — allows any registered user,
    including SuperAdmin, to reset their password by providing their email.
    """
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")

    validate_password(data.new_password)

    user.hashed_password = security.get_password_hash(data.new_password)
    db.add(user)
    db.commit()
    return {"message": "Password updated successfully. Please sign in with your new password."}
