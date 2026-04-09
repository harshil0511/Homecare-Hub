from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.common import deps
from app.core import security
from app.core.security import validate_password
from app.auth.domain.model import User
from app.api.auth.schemas import UserResponse, ChangePassword

router = APIRouter(tags=["User Profile API"])

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(deps.get_current_user)):
    return current_user

@router.patch("/me", response_model=UserResponse)
def update_profile(
    username: str = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if username:
        current_user.username = username
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/me/change-password")
def change_password(
    data: ChangePassword,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if not security.verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    validate_password(data.new_password)
    current_user.hashed_password = security.get_password_hash(data.new_password)
    db.add(current_user)
    db.commit()
    return {"message": "Password changed successfully."}
