from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
from app import models, schemas
from app.database import get_db
from app.dependencies import require_manager_or_admin, get_current_active_user

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

def create_notification(db: Session, user_id: int, message: str, notification_type: str):
    notification = models.Notification(
        user_id=user_id,
        message=message,
        notification_type=notification_type
    )
    db.add(notification)
    db.commit()

@router.get("/", response_model=List[schemas.TaskResponse])
def get_tasks(
    status: Optional[schemas.TaskStatus] = None,
    priority: Optional[schemas.TaskPriority] = None,
    assigned_to: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.Task)
    
    if status:
        query = query.filter(models.Task.status == status)
    if priority:
        query = query.filter(models.Task.priority == priority)
    if assigned_to:
        query = query.filter(models.Task.assigned_to == assigned_to)
    if search:
        query = query.filter(
            or_(
                models.Task.title.ilike(f"%{search}%"),
                models.Task.description.ilike(f"%{search}%")
            )
        )
    
    tasks = query.offset(offset).limit(limit).all()
    
    # Добавляем имена авторов в комментарии
    for task in tasks:
        for comment in task.comments:
            if comment.author:
                comment.author_name = comment.author.full_name
                comment.author_role = comment.author.role.value
    
    return tasks

@router.get("/{task_id}", response_model=schemas.TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Добавляем имена авторов в комментарии
    for comment in task.comments:
        if comment.author:
            comment.author_name = comment.author.full_name
            comment.author_role = comment.author.role.value
    
    return task

@router.post("/", response_model=schemas.TaskResponse)
def create_task(
    task_data: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    try:
        assignee = db.query(models.User).filter(models.User.id == task_data.assigned_to).first()
        if not assignee or assignee.role == models.UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="Invalid assignee")
        
        if current_user.role == models.UserRole.MANAGER and assignee.role != models.UserRole.EMPLOYEE:
            raise HTTPException(status_code=400, detail="Manager can only assign tasks to employees")
        
        new_task = models.Task(
            title=task_data.title,
            description=task_data.description,
            priority=task_data.priority,
            deadline=task_data.deadline,
            assigned_to=task_data.assigned_to,
            created_by=current_user.id
        )
        db.add(new_task)
        db.commit()
        db.refresh(new_task)
        
        create_notification(
            db, task_data.assigned_to,
            f"Вам назначена задача: {task_data.title}",
            "task_assigned"
        )
        
        return new_task
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error creating task: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating task: {str(e)}")

@router.put("/{task_id}", response_model=schemas.TaskResponse)
def update_task(
    task_id: int,
    task_data: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for field, value in task_data.dict(exclude_unset=True).items():
        setattr(task, field, value)
    
    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/status", response_model=schemas.TaskResponse)
def update_task_status(
    task_id: int,
    status: schemas.TaskStatus,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.assigned_to != current_user.id and current_user.role not in [models.UserRole.MANAGER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Cannot update status of tasks assigned to others")
    
    task.status = status
    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/delegate", response_model=schemas.TaskResponse)
def delegate_task(
    task_id: int,
    delegation: schemas.TaskDelegation,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    new_assignee = db.query(models.User).filter(models.User.id == delegation.new_assignee_id).first()
    
    if not new_assignee or new_assignee.role == models.UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Invalid new assignee")
    
    if current_user.role == models.UserRole.MANAGER and new_assignee.role != models.UserRole.EMPLOYEE:
        raise HTTPException(status_code=400, detail="Manager can only delegate tasks to employees")
    
    old_assignee = db.query(models.User).filter(models.User.id == task.assigned_to).first()
    
    task.assigned_to = delegation.new_assignee_id
    task.delegated_from = task.assigned_to
    task.delegation_reason = delegation.reason
    
    db.commit()
    db.refresh(task)
    
    create_notification(
        db, task.assigned_to,
        f"Задача '{task.title}' переделегирована {new_assignee.full_name}. Причина: {delegation.reason}",
        "task_redelegated"
    )
    
    create_notification(
        db, delegation.new_assignee_id,
        f"Вам переделегирована задача '{task.title}' от {old_assignee.full_name}. Причина: {delegation.reason}",
        "task_redelegated"
    )
    
    return task

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}

@router.post("/{task_id}/comments", response_model=schemas.CommentResponse)
def add_comment(
    task_id: int,
    comment_data: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    comment = models.Comment(
        content=comment_data.content,
        task_id=task_id,
        author_id=current_user.id
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    return schemas.CommentResponse(
        id=comment.id,
        content=comment.content,
        created_at=comment.created_at,
        author_id=current_user.id,
        author_name=current_user.full_name,
        author_role=current_user.role.value
    )