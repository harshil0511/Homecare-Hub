from typing import Generator, List
from fastapi import Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core import security
from .models import User
from .schemas import TokenData


def get_db() -> Generator:
    """Provide a database session for each request, then close it."""
    from app.core.database import SessionLocal
    if SessionLocal is None:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable. Please ensure the database server is running.",
        )
    db = SessionLocal()
    try:
        yield db
    except OperationalError:
        raise HTTPException(
            status_code=503,
            detail="Database connection lost. Please try again in a moment.",
        )
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(security.oauth2_scheme)
) -> User:
    """
    Decode JWT, extract user_uuid from 'sub' claim,
    then fetch the full user object from the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_uuid: str = payload.get("sub")
        if user_uuid is None:
            raise credentials_exception
        token_data = TokenData(user_uuid=user_uuid, role=payload.get("role"))
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.user_uuid == token_data.user_uuid).first()
    if user is None:
        raise credentials_exception
    return user


class RoleChecker:
    """
    FastAPI dependency to restrict a route to specific roles.
    Usage: dependencies=[Depends(RoleChecker(["ADMIN"]))]
    """
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_user)):
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {self.allowed_roles}"
            )
        return user
