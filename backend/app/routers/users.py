from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas, auth
from app.database import get_db
from app.dependencies import require_admin, get_current_active_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/", response_model=List[schemas.UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    users = db.query(models.User).filter(models.User.role != models.UserRole.ADMIN).all()
    result = []
    for user in users:
        group_name = None
        if user.group_id:
            group = db.query(models.Group).filter(models.Group.id == user.group_id).first()
            if group:
                group_name = group.name
        result.append(schemas.UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            created_at=user.created_at,
            group_id=user.group_id,
            group_name=group_name
        ))
    return result

@router.get("/list", response_model=List[schemas.UserResponse])
def get_users_list(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.User).filter(models.User.role != models.UserRole.ADMIN)
    
    if current_user.role == models.UserRole.MANAGER:
        query = query.filter(
            models.User.group_id == current_user.group_id,
            models.User.role == models.UserRole.EMPLOYEE
        )
    elif current_user.role == models.UserRole.EMPLOYEE:
        if current_user.group_id:
            query = query.filter(models.User.group_id == current_user.group_id)
    
    users = query.all()
    result = []
    for user in users:
        group_name = None
        if user.group_id:
            group = db.query(models.Group).filter(models.Group.id == user.group_id).first()
            if group:
                group_name = group.name
        result.append(schemas.UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            created_at=user.created_at,
            group_id=user.group_id,
            group_name=group_name
        ))
    return result

@router.post("/", response_model=schemas.UserResponse)
def create_user(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = models.User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=auth.get_password_hash(user_data.password),
        role=models.UserRole.EMPLOYEE
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return schemas.UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        created_at=new_user.created_at,
        group_id=None,
        group_name=None
    )

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    try:
        if current_user.id == user_id:
            raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")
        
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        if user.role == models.UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="Нельзя удалить администратора")
        
        active_tasks = db.query(models.Task).filter(
            models.Task.assigned_to == user_id,
            models.Task.status.notin_([models.TaskStatus.COMPLETED, models.TaskStatus.ARCHIVED])
        ).all()
        
        if active_tasks:
            task_titles = [f"'{task.title}'" for task in active_tasks[:5]]
            task_list = ", ".join(task_titles)
            if len(active_tasks) > 5:
                task_list += f" и еще {len(active_tasks) - 5}"
            
            task_word = "задача" if len(active_tasks) == 1 else "задачи" if len(active_tasks) <= 4 else "задач"
            raise HTTPException(
                status_code=400, 
                detail=f"Невозможно удалить пользователя с активными {task_word}. "
                       f"У пользователя {len(active_tasks)} активная(ых) {task_word}: {task_list}. "
                       f"Пожалуйста, переназначьте или завершите эти задачи перед удалением пользователя."
            )
        
        user_full_name = user.full_name
        
        led_groups = db.query(models.Group).filter(models.Group.leader_id == user_id).all()
        for group in led_groups:
            group.leader_id = None
        
        if user.group_id:
            user.group_id = None
        
        created_tasks = db.query(models.Task).filter(
            models.Task.created_by == user_id,
            models.Task.status.notin_([models.TaskStatus.COMPLETED, models.TaskStatus.ARCHIVED])
        ).all()
        for task in created_tasks:
            if not task.created_by_name:
                task.created_by_name = user_full_name
            task.created_by = current_user.id
        
        completed_tasks_as_assignee = db.query(models.Task).filter(
            models.Task.assigned_to == user_id,
            models.Task.status.in_([models.TaskStatus.COMPLETED, models.TaskStatus.ARCHIVED])
        ).all()
        
        for task in completed_tasks_as_assignee:
            if not task.assigned_to_name:
                task.assigned_to_name = user_full_name
        
        completed_tasks_as_creator = db.query(models.Task).filter(
            models.Task.created_by == user_id,
            models.Task.status.in_([models.TaskStatus.COMPLETED, models.TaskStatus.ARCHIVED])
        ).all()
        
        for task in completed_tasks_as_creator:
            if not task.created_by_name:
                task.created_by_name = user_full_name
        
        db.query(models.Notification).filter(models.Notification.user_id == user_id).delete()
        db.query(models.AuditLog).filter(models.AuditLog.user_id == user_id).delete()
        db.delete(user)
        db.commit()
        
        return {"message": f"Пользователь '{user_full_name}' успешно удален. Данные задач сохранены."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении пользователя: {str(e)}")