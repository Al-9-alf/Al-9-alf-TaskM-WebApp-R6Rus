from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timezone
from typing import List, Optional
from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_active_user, require_manager_or_admin

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

def calculate_completion_rate(user_id: int, db: Session) -> float:
    completed_tasks = db.query(models.Task).filter(
        and_(
            models.Task.assigned_to == user_id,
            models.Task.status == models.TaskStatus.COMPLETED
        )
    ).all()
    
    if not completed_tasks:
        return 0.0
    
    on_time = 0
    for task in completed_tasks:
        if task.updated_at and task.updated_at <= task.deadline:
            on_time += 1
    
    return (on_time / len(completed_tasks)) * 100

@router.get("/my/overview", response_model=schemas.MyAnalyticsOverview)
def get_my_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    tasks = db.query(models.Task).filter(models.Task.assigned_to == current_user.id).all()
    
    tasks_by_status = {}
    for status in models.TaskStatus:
        tasks_by_status[status.value] = len([t for t in tasks if t.status == status])
    
    active_tasks = tasks_by_status["new"] + tasks_by_status["in_progress"] + tasks_by_status["in_review"]
    
    now = datetime.now(timezone.utc)
    overdue_tasks = 0
    for t in tasks:
        if t.status != models.TaskStatus.COMPLETED:
            deadline = t.deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if deadline < now:
                overdue_tasks += 1
    
    completion_rate = calculate_completion_rate(current_user.id, db)
    
    completed_tasks = [t for t in tasks if t.status == models.TaskStatus.COMPLETED and t.updated_at]
    if completed_tasks:
        total_hours = sum((t.updated_at - t.created_at).total_seconds() / 3600 for t in completed_tasks)
        avg_completion_time = total_hours / len(completed_tasks)
    else:
        avg_completion_time = None
    
    return schemas.MyAnalyticsOverview(
        completion_rate=completion_rate,
        overdue_tasks=overdue_tasks,
        active_tasks=active_tasks,
        tasks_by_status=tasks_by_status,
        avg_completion_time=avg_completion_time
    )

@router.get("/team/overview", response_model=List[schemas.TeamMemberAnalytics])
def get_team_overview(
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    users = db.query(models.User).filter(models.User.role != models.UserRole.ADMIN).all()
    now = datetime.now(timezone.utc)
    
    result = []
    for user in users:
        completion_rate = calculate_completion_rate(user.id, db)
        
        active_tasks = db.query(models.Task).filter(
            and_(
                models.Task.assigned_to == user.id,
                models.Task.status.in_([models.TaskStatus.NEW, models.TaskStatus.IN_PROGRESS, models.TaskStatus.IN_REVIEW])
            )
        ).count()
        
        overdue_tasks = 0
        user_tasks = db.query(models.Task).filter(
            and_(
                models.Task.assigned_to == user.id,
                models.Task.status != models.TaskStatus.COMPLETED
            )
        ).all()
        for t in user_tasks:
            deadline = t.deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if deadline < now:
                overdue_tasks += 1
        
        completed_tasks = db.query(models.Task).filter(
            and_(
                models.Task.assigned_to == user.id,
                models.Task.status == models.TaskStatus.COMPLETED,
                models.Task.updated_at.isnot(None)
            )
        ).all()
        
        if completed_tasks:
            total_hours = sum((t.updated_at - t.created_at).total_seconds() / 3600 for t in completed_tasks)
            avg_completion_time = total_hours / len(completed_tasks)
        else:
            avg_completion_time = None
        
        result.append(schemas.TeamMemberAnalytics(
            user_id=user.id,
            full_name=user.full_name,
            completion_rate=completion_rate,
            overdue_tasks=overdue_tasks,
            active_tasks=active_tasks,
            avg_completion_time=avg_completion_time
        ))
    
    return result

@router.get("/team/summary", response_model=schemas.TeamSummary)
def get_team_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    users = db.query(models.User).filter(models.User.role != models.UserRole.ADMIN).all()
    now = datetime.now(timezone.utc)
    
    total_completion_rate = 0
    total_overdue = 0
    total_active = 0
    
    for user in users:
        total_completion_rate += calculate_completion_rate(user.id, db)
        
        user_tasks = db.query(models.Task).filter(
            and_(
                models.Task.assigned_to == user.id,
                models.Task.status != models.TaskStatus.COMPLETED
            )
        ).all()
        for t in user_tasks:
            deadline = t.deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if deadline < now:
                total_overdue += 1
        
        active = db.query(models.Task).filter(
            and_(
                models.Task.assigned_to == user.id,
                models.Task.status.in_([models.TaskStatus.NEW, models.TaskStatus.IN_PROGRESS, models.TaskStatus.IN_REVIEW])
            )
        ).count()
        total_active += active
    
    avg_completion = total_completion_rate / len(users) if users else 0
    
    return schemas.TeamSummary(
        avg_completion_rate=avg_completion,
        total_overdue_tasks=total_overdue,
        total_active_tasks=total_active
    )

@router.get("/team/ranking", response_model=List[schemas.RankingItem])
def get_team_ranking(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    users = db.query(models.User).filter(models.User.role != models.UserRole.ADMIN).all()
    
    ranking = []
    for user in users:
        completion_rate = calculate_completion_rate(user.id, db)
        completed_tasks = db.query(models.Task).filter(
            and_(
                models.Task.assigned_to == user.id,
                models.Task.status == models.TaskStatus.COMPLETED
            )
        ).count()
        
        ranking.append(schemas.RankingItem(
            user_id=user.id,
            full_name=user.full_name,
            completion_rate=completion_rate,
            completed_tasks=completed_tasks
        ))
    
    ranking.sort(key=lambda x: x.completion_rate, reverse=True)
    return ranking

@router.get("/team/user/{user_id}/overview", response_model=schemas.MyAnalyticsOverview)
def get_user_analytics(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user.role == models.UserRole.ADMIN:
        raise HTTPException(status_code=404, detail="User not found")
    
    tasks = db.query(models.Task).filter(models.Task.assigned_to == user_id).all()
    now = datetime.now(timezone.utc)
    
    tasks_by_status = {}
    for status in models.TaskStatus:
        tasks_by_status[status.value] = len([t for t in tasks if t.status == status])
    
    active_tasks = tasks_by_status["new"] + tasks_by_status["in_progress"] + tasks_by_status["in_review"]
    
    overdue_tasks = 0
    for t in tasks:
        if t.status != models.TaskStatus.COMPLETED:
            deadline = t.deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if deadline < now:
                overdue_tasks += 1
    
    completion_rate = calculate_completion_rate(user_id, db)
    
    completed_tasks = [t for t in tasks if t.status == models.TaskStatus.COMPLETED and t.updated_at]
    if completed_tasks:
        total_hours = sum((t.updated_at - t.created_at).total_seconds() / 3600 for t in completed_tasks)
        avg_completion_time = total_hours / len(completed_tasks)
    else:
        avg_completion_time = None
    
    return schemas.MyAnalyticsOverview(
        completion_rate=completion_rate,
        overdue_tasks=overdue_tasks,
        active_tasks=active_tasks,
        tasks_by_status=tasks_by_status,
        avg_completion_time=avg_completion_time
    )