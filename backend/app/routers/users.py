from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas, auth
from app.database import get_db
from app.dependencies import require_admin, get_current_active_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/", response_model=list[schemas.UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    users = db.query(models.User).filter(models.User.role != models.UserRole.ADMIN).all()
    return users

@router.get("/list", response_model=List[schemas.UserResponse])
def get_users_list(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get list of users for delegation. Manager sees only employees, Admin sees all."""
    if current_user.role == models.UserRole.MANAGER:
        # Manager видит только employee
        users = db.query(models.User).filter(models.User.role == models.UserRole.EMPLOYEE).all()
    elif current_user.role == models.UserRole.ADMIN:
        # Admin видит всех кроме себя
        users = db.query(models.User).filter(models.User.role != models.UserRole.ADMIN).all()
    else:
        # Employee видит всех (но делегировать не может)
        users = db.query(models.User).all()
    return users

@router.post("/", response_model=schemas.UserResponse)
def create_user(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if user_data.role == models.UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Cannot create admin users")
    
    new_user = models.User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=auth.get_password_hash(user_data.password),
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/{user_id}/role", response_model=schemas.UserResponse)
def update_user_role(
    user_id: int,
    role_data: schemas.UserUpdateRole,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if role_data.role == models.UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Cannot assign admin role")
    
    user.role = role_data.role
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}