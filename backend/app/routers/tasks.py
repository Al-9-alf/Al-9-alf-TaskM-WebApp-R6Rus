from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
from app import models, schemas
from app.database import get_db
from app.dependencies import require_manager_or_admin, get_current_active_user, require_admin

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

def create_notification(db: Session, user_id: int, message: str, notification_type: str):
    notification = models.Notification(
        user_id=user_id,
        message=message,
        notification_type=notification_type
    )
    db.add(notification)
    db.commit()

def get_user_group_name(db: Session, user_id: int) -> Optional[str]:
    if user_id is None:
        return None
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user and user.group_id:
        group = db.query(models.Group).filter(models.Group.id == user.group_id).first()
        if group:
            return group.name
    return None

def build_user_response_from_task(db: Session, task, field_type='assignee'):
    if field_type == 'assignee':
        user_id = task.assigned_to
        user_obj = task.assignee
        saved_name = task.assigned_to_name
    else: 
        user_id = task.created_by
        user_obj = task.creator
        saved_name = task.created_by_name
    
    if user_obj:
        group_name = get_user_group_name(db, user_obj.id)
        return schemas.UserResponse(
            id=user_obj.id,
            email=user_obj.email,
            full_name=user_obj.full_name,
            role=user_obj.role,
            created_at=user_obj.created_at,
            group_id=user_obj.group_id,
            group_name=group_name
        )
    elif saved_name:
        return schemas.UserResponse(
            id=user_id or 0,
            email="deleted@example.com",
            full_name=f"{saved_name} (удалён)",
            role=models.UserRole.EMPLOYEE,
            created_at=task.created_at,
            group_id=None,
            group_name=None
        )
    return None

def can_manage_task(db: Session, task: models.Task, current_user: models.User) -> bool:
    if current_user.role == models.UserRole.ADMIN:
        return True
    elif current_user.role == models.UserRole.MANAGER:
        if not current_user.group_id:
            return False
        assignee = db.query(models.User).filter(models.User.id == task.assigned_to).first()
        if assignee and assignee.group_id == current_user.group_id:
            return True
        if task.created_by == current_user.id:
            return True
        return False
    else:  
        return task.assigned_to == current_user.id

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
    query = db.query(models.Task).filter(models.Task.status != models.TaskStatus.ARCHIVED)
    
    if status:
        query = query.filter(models.Task.status == status)
    if priority:
        query = query.filter(models.Task.priority == priority)
    if assigned_to and current_user.role == models.UserRole.ADMIN:
        query = query.filter(models.Task.assigned_to == assigned_to)
    if search:
        query = query.filter(
            or_(
                models.Task.title.ilike(f"%{search}%"),
                models.Task.description.ilike(f"%{search}%")
            )
        )
    
    tasks = query.offset(offset).limit(limit).all()
    
    result = []
    for task in tasks:
        for comment in task.comments:
            if comment.author:
                comment.author_name = comment.author.full_name
                comment.author_role = comment.author.role.value
            else:
                comment.author_name = f"Пользователь #{comment.author_id} (удалён)"
                comment.author_role = "deleted"
        
        assignee_group_name = get_user_group_name(db, task.assigned_to) if task.assigned_to else None
        if not assignee_group_name and task.assigned_to_name:
            assignee_group_name = None
        
        task_response = schemas.TaskResponse(
            id=task.id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            deadline=task.deadline,
            assigned_to=task.assigned_to,
            status=task.status,
            created_at=task.created_at,
            updated_at=task.updated_at,
            created_by=task.created_by,
            delegated_from=task.delegated_from,
            delegation_reason=task.delegation_reason,
            assignee=build_user_response_from_task(db, task, 'assignee'),
            creator=build_user_response_from_task(db, task, 'creator'),
            comments=[
                schemas.CommentResponse(
                    id=comment.id,
                    content=comment.content,
                    created_at=comment.created_at,
                    author_id=comment.author_id,
                    author_name=getattr(comment, 'author_name', comment.author.full_name if comment.author else f"Пользователь #{comment.author_id}"),
                    author_role=getattr(comment, 'author_role', comment.author.role.value if comment.author else 'deleted')
                ) for comment in task.comments
            ],
            assignee_group_name=assignee_group_name
        )
        result.append(task_response)
    
    return result

@router.get("/archived", response_model=List[schemas.TaskResponse])
def get_archived_tasks(
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.Task).filter(models.Task.status == models.TaskStatus.ARCHIVED)
    
    if search:
        query = query.filter(
            or_(
                models.Task.title.ilike(f"%{search}%"),
                models.Task.description.ilike(f"%{search}%")
            )
        )
    
    tasks = query.order_by(models.Task.updated_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for task in tasks:
        for comment in task.comments:
            if comment.author:
                comment.author_name = comment.author.full_name
                comment.author_role = comment.author.role.value
            else:
                comment.author_name = f"Пользователь #{comment.author_id} (удалён)"
                comment.author_role = "deleted"
        
        assignee_group_name = get_user_group_name(db, task.assigned_to) if task.assigned_to else None
        
        task_response = schemas.TaskResponse(
            id=task.id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            deadline=task.deadline,
            assigned_to=task.assigned_to,
            status=task.status,
            created_at=task.created_at,
            updated_at=task.updated_at,
            created_by=task.created_by,
            delegated_from=task.delegated_from,
            delegation_reason=task.delegation_reason,
            assignee=build_user_response_from_task(db, task, 'assignee'),
            creator=build_user_response_from_task(db, task, 'creator'),
            comments=[
                schemas.CommentResponse(
                    id=comment.id,
                    content=comment.content,
                    created_at=comment.created_at,
                    author_id=comment.author_id,
                    author_name=comment.author.full_name if comment.author else f"Пользователь #{comment.author_id} (удалён)",
                    author_role=comment.author.role.value if comment.author else 'deleted'
                ) for comment in task.comments
            ],
            assignee_group_name=assignee_group_name
        )
        result.append(task_response)
    
    return result

@router.post("/{task_id}/restore", response_model=schemas.TaskResponse)
def restore_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status != models.TaskStatus.ARCHIVED:
        raise HTTPException(status_code=400, detail="Task is not archived")
    
    if not can_manage_task(db, task, current_user):
        raise HTTPException(status_code=403, detail="Нет прав на восстановление этой задачи")
    
    original_status = getattr(task, 'original_status', None)
    if original_status and original_status != models.TaskStatus.ARCHIVED:
        task.status = original_status
    else:
        task.status = models.TaskStatus.NEW
    
    db.commit()
    db.refresh(task)
    
    if task.assigned_to:
        status_text = {
            models.TaskStatus.NEW: "Новая",
            models.TaskStatus.IN_PROGRESS: "В работе",
            models.TaskStatus.IN_REVIEW: "На проверке",
            models.TaskStatus.COMPLETED: "Завершённая"
        }.get(task.status, "Новая")
        
        create_notification(
            db, task.assigned_to,
            f"Задача \"{task.title}\" восстановлена из архива в статус \"{status_text}\"",
            "task_restored"
        )
    
    assignee_group_name = get_user_group_name(db, task.assigned_to) if task.assigned_to else None
    return schemas.TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        deadline=task.deadline,
        assigned_to=task.assigned_to,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at,
        created_by=task.created_by,
        delegated_from=task.delegated_from,
        delegation_reason=task.delegation_reason,
        assignee=build_user_response_from_task(db, task, 'assignee'),
        creator=build_user_response_from_task(db, task, 'creator'),
        comments=[],
        assignee_group_name=assignee_group_name
    )

@router.get("/{task_id}", response_model=schemas.TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for comment in task.comments:
        if comment.author:
            comment.author_name = comment.author.full_name
            comment.author_role = comment.author.role.value
        else:
            comment.author_name = f"Пользователь #{comment.author_id} (удалён)"
            comment.author_role = "deleted"
    
    assignee_group_name = get_user_group_name(db, task.assigned_to) if task.assigned_to else None
    if not assignee_group_name and task.assigned_to_name:
        assignee_group_name = None
    
    task_response = schemas.TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        deadline=task.deadline,
        assigned_to=task.assigned_to,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at,
        created_by=task.created_by,
        delegated_from=task.delegated_from,
        delegation_reason=task.delegation_reason,
        assignee=build_user_response_from_task(db, task, 'assignee'),
        creator=build_user_response_from_task(db, task, 'creator'),
        comments=[
            schemas.CommentResponse(
                id=comment.id,
                content=comment.content,
                created_at=comment.created_at,
                author_id=comment.author_id,
                author_name=comment.author.full_name if comment.author else f"Пользователь #{comment.author_id} (удалён)",
                author_role=comment.author.role.value if comment.author else 'deleted'
            ) for comment in task.comments
        ],
        assignee_group_name=assignee_group_name
    )
    return task_response

@router.post("/", response_model=schemas.TaskResponse)
def create_task(
    task_data: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    try:
        assignee = db.query(models.User).filter(models.User.id == task_data.assigned_to).first()
        if not assignee or assignee.role == models.UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="Некорректный исполнитель")
        
        if current_user.role == models.UserRole.MANAGER:
            if not current_user.group_id:
                raise HTTPException(status_code=400, detail="Вы не состоите в группе")
            if assignee.group_id != current_user.group_id:
                raise HTTPException(status_code=400, detail="Менеджер может назначать задачи только членам своей группы")
        
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
        
        assignee_group_name = get_user_group_name(db, task_data.assigned_to)
        deadline_msg = f"Срок: {task_data.deadline.strftime('%d.%m.%Y %H:%M')}" if task_data.deadline else "Без срока"
        create_notification(
            db, task_data.assigned_to,
            f"Вам назначена задача: {task_data.title} (Группа: {assignee_group_name or 'Не указана'}, {deadline_msg})",
            "task_assigned"
        )
        
        creator_group_name = get_user_group_name(db, current_user.id)
        return schemas.TaskResponse(
            id=new_task.id,
            title=new_task.title,
            description=new_task.description,
            priority=new_task.priority,
            deadline=new_task.deadline,
            assigned_to=new_task.assigned_to,
            status=new_task.status,
            created_at=new_task.created_at,
            updated_at=new_task.updated_at,
            created_by=new_task.created_by,
            delegated_from=new_task.delegated_from,
            delegation_reason=new_task.delegation_reason,
            assignee=schemas.UserResponse(
                id=assignee.id,
                email=assignee.email,
                full_name=assignee.full_name,
                role=assignee.role,
                created_at=assignee.created_at,
                group_id=assignee.group_id,
                group_name=assignee_group_name
            ),
            creator=schemas.UserResponse(
                id=current_user.id,
                email=current_user.email,
                full_name=current_user.full_name,
                role=current_user.role,
                created_at=current_user.created_at,
                group_id=current_user.group_id,
                group_name=creator_group_name
            ),
            comments=[],
            assignee_group_name=assignee_group_name
        )
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
    
    if not can_manage_task(db, task, current_user):
        raise HTTPException(status_code=403, detail="Нет прав на редактирование этой задачи")
    
    if task_data.status == models.TaskStatus.ARCHIVED and task.status != models.TaskStatus.ARCHIVED:
        task.original_status = task.status
    
    for field, value in task_data.dict(exclude_unset=True).items():
        setattr(task, field, value)
    
    db.commit()
    db.refresh(task)
    
    assignee_group_name = get_user_group_name(db, task.assigned_to) if task.assigned_to else None
    return schemas.TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        deadline=task.deadline,
        assigned_to=task.assigned_to,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at,
        created_by=task.created_by,
        delegated_from=task.delegated_from,
        delegation_reason=task.delegation_reason,
        assignee=build_user_response_from_task(db, task, 'assignee'),
        creator=build_user_response_from_task(db, task, 'creator'),
        comments=[],
        assignee_group_name=assignee_group_name
    )

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
    
    old_status = task.status
    
    if current_user.role == models.UserRole.ADMIN:
        pass
    elif current_user.role == models.UserRole.MANAGER:
        if not current_user.group_id:
            raise HTTPException(status_code=403, detail="Нет прав для изменения статуса")
        assignee = db.query(models.User).filter(models.User.id == task.assigned_to).first()
        if not assignee or assignee.group_id != current_user.group_id:
            raise HTTPException(status_code=403, detail="Менеджер может изменять статус только задач своей группы")
    elif task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для изменения статуса")
    
    task.status = status
    db.commit()
    db.refresh(task)
    
    if status == models.TaskStatus.COMPLETED and task.assigned_to:
        create_notification(
            db, task.assigned_to,
            f"Задача \"{task.title}\" отмечена как завершённая!",
            "task_completed"
        )
    
    if status == models.TaskStatus.IN_PROGRESS and old_status == models.TaskStatus.IN_REVIEW and task.assigned_to:
        create_notification(
            db, task.assigned_to,
            f"Задача \"{task.title}\" отправлена на доработку. Требуются исправления.",
            "task_rework"
        )
    
    assignee_group_name = get_user_group_name(db, task.assigned_to) if task.assigned_to else None
    return schemas.TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        deadline=task.deadline,
        assigned_to=task.assigned_to,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at,
        created_by=task.created_by,
        delegated_from=task.delegated_from,
        delegation_reason=task.delegation_reason,
        assignee=build_user_response_from_task(db, task, 'assignee'),
        creator=build_user_response_from_task(db, task, 'creator'),
        comments=[],
        assignee_group_name=assignee_group_name
    )

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
    
    if current_user.role == models.UserRole.ADMIN:
        pass
    elif current_user.role == models.UserRole.MANAGER:
        if not current_user.group_id:
            raise HTTPException(status_code=400, detail="Вы не состоите в группе")
        assignee = db.query(models.User).filter(models.User.id == task.assigned_to).first()
        if not assignee or assignee.group_id != current_user.group_id:
            raise HTTPException(status_code=403, detail="Менеджер может делегировать только задачи своей группы")
    
    new_assignee = db.query(models.User).filter(models.User.id == delegation.new_assignee_id).first()
    if not new_assignee or new_assignee.role == models.UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Некорректный новый исполнитель")
    
    if current_user.role == models.UserRole.MANAGER:
        if new_assignee.group_id != current_user.group_id:
            raise HTTPException(status_code=400, detail="Менеджер может делегировать задачи только членам своей группы")
    
    old_assignee = db.query(models.User).filter(models.User.id == task.assigned_to).first()
    old_assignee_name = old_assignee.full_name if old_assignee else (task.assigned_to_name or "Неизвестный пользователь")
    
    if not task.assigned_to_name and old_assignee:
        task.assigned_to_name = old_assignee.full_name
    
    old_assignee_id = task.assigned_to
    task.delegated_from = task.assigned_to
    task.assigned_to = delegation.new_assignee_id
    task.delegation_reason = delegation.reason
    
    db.commit()
    db.refresh(task)
    
    assignee_group_name = get_user_group_name(db, task.assigned_to)
    
    create_notification(
        db, delegation.new_assignee_id,
        f"Вам переделегирована задача \"{task.title}\" от {old_assignee_name}. Причина: {delegation.reason}",
        "task_delegated_to"
    )
    
    if old_assignee:
        create_notification(
            db, old_assignee.id,
            f"Задача \"{task.title}\" передана другому исполнителю ({new_assignee.full_name}). Причина: {delegation.reason}",
            "task_delegated_from"
        )
    
    return schemas.TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        deadline=task.deadline,
        assigned_to=task.assigned_to,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at,
        created_by=task.created_by,
        delegated_from=task.delegated_from,
        delegation_reason=task.delegation_reason,
        assignee=build_user_response_from_task(db, task, 'assignee'),
        creator=build_user_response_from_task(db, task, 'creator'),
        comments=[],
        assignee_group_name=assignee_group_name
    )

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
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
    
    if task.assigned_to and task.assigned_to != current_user.id:
        create_notification(
            db, task.assigned_to,
            f"Новый комментарий от {current_user.full_name} к задаче \"{task.title}\": {comment_data.content[:100]}...",
            "task_comment"
        )
    
    if task.created_by and task.created_by != current_user.id and task.created_by != task.assigned_to:
        create_notification(
            db, task.created_by,
            f"Новый комментарий от {current_user.full_name} к задаче \"{task.title}\"",
            "task_comment"
        )
    
    return schemas.CommentResponse(
        id=comment.id,
        content=comment.content,
        created_at=comment.created_at,
        author_id=current_user.id,
        author_name=current_user.full_name,
        author_role=current_user.role.value
    )