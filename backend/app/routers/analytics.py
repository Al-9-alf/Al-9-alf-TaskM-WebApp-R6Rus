from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timezone
from typing import List, Optional
from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_active_user, require_admin, require_manager_or_admin

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

def calculate_completion_rate(user_id: int, db: Session) -> float:
    try:
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
            if task.updated_at and task.deadline:
                if task.updated_at <= task.deadline:
                    on_time += 1
            elif task.updated_at:
                on_time += 1
        
        if len(completed_tasks) == 0:
            return 0.0
            
        return (on_time / len(completed_tasks)) * 100
    except Exception as e:
        print(f"Error calculating completion rate: {e}")
        return 0.0

def get_team_users(db: Session, current_user: models.User):
    if current_user.role == models.UserRole.ADMIN:
        return db.query(models.User).filter(models.User.role != models.UserRole.ADMIN).all()
    elif current_user.role == models.UserRole.MANAGER:
        if not current_user.group_id:
            return []
        return db.query(models.User).filter(
            models.User.group_id == current_user.group_id,
            models.User.role != models.UserRole.ADMIN
        ).all()
    else:
        return []

def get_user_group_ids(db: Session, current_user: models.User):
    if current_user.role == models.UserRole.ADMIN:
        groups = db.query(models.Group).all()
        return [g.id for g in groups]
    elif current_user.role == models.UserRole.MANAGER:
        if current_user.group_id:
            return [current_user.group_id]
        return []
    else:
        return []

@router.get("/my/overview", response_model=schemas.MyAnalyticsOverview)
def get_my_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    try:
        tasks = db.query(models.Task).filter(models.Task.assigned_to == current_user.id).all()
        tasks_by_status = {}
        for status in models.TaskStatus:
            tasks_by_status[status.value] = len([t for t in tasks if t.status == status])
        
        active_tasks = tasks_by_status.get("new", 0) + tasks_by_status.get("in_progress", 0) + tasks_by_status.get("in_review", 0)
        now = datetime.now(timezone.utc)
        overdue_tasks = 0
        for t in tasks:
            if t.status != models.TaskStatus.COMPLETED and t.status != models.TaskStatus.ARCHIVED:
                if t.deadline:
                    deadline = t.deadline
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=timezone.utc)
                    if deadline < now:
                        overdue_tasks += 1
        
        completion_rate = calculate_completion_rate(current_user.id, db)
        completed_tasks = [t for t in tasks if t.status == models.TaskStatus.COMPLETED and t.updated_at]
        if completed_tasks:
            total_hours = 0
            for t in completed_tasks:
                if t.created_at:
                    total_hours += (t.updated_at - t.created_at).total_seconds() / 3600
            avg_completion_time = total_hours / len(completed_tasks) if len(completed_tasks) > 0 else None
        else:
            avg_completion_time = None
        
        return schemas.MyAnalyticsOverview(
            completion_rate=round(completion_rate, 2),
            overdue_tasks=overdue_tasks,
            active_tasks=active_tasks,
            tasks_by_status=tasks_by_status,
            avg_completion_time=round(avg_completion_time, 2) if avg_completion_time else None
        )
    except Exception as e:
        print(f"Error in get_my_analytics: {e}")
        return schemas.MyAnalyticsOverview(
            completion_rate=0.0,
            overdue_tasks=0,
            active_tasks=0,
            tasks_by_status={status.value: 0 for status in models.TaskStatus},
            avg_completion_time=None
        )

@router.get("/team/overview", response_model=List[schemas.TeamMemberAnalytics])
def get_team_overview(
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    try:
        team_users = get_team_users(db, current_user)
        now = datetime.now(timezone.utc)
        
        result = []
        for user in team_users:
            try:
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
                        models.Task.status.notin_([models.TaskStatus.COMPLETED, models.TaskStatus.ARCHIVED])
                    )
                ).all()
                
                for t in user_tasks:
                    if t.deadline:
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
                    total_hours = 0
                    for t in completed_tasks:
                        if t.created_at:
                            total_hours += (t.updated_at - t.created_at).total_seconds() / 3600
                    avg_completion_time = total_hours / len(completed_tasks) if len(completed_tasks) > 0 else None
                else:
                    avg_completion_time = None
                
                result.append(schemas.TeamMemberAnalytics(
                    user_id=user.id,
                    full_name=user.full_name,
                    completion_rate=round(completion_rate, 2),
                    overdue_tasks=overdue_tasks,
                    active_tasks=active_tasks,
                    avg_completion_time=round(avg_completion_time, 2) if avg_completion_time else None
                ))
            except Exception as e:
                print(f"Error processing user {user.id}: {e}")
                result.append(schemas.TeamMemberAnalytics(
                    user_id=user.id,
                    full_name=user.full_name,
                    completion_rate=0.0,
                    overdue_tasks=0,
                    active_tasks=0,
                    avg_completion_time=None
                ))
        
        return result
    except Exception as e:
        print(f"Error in get_team_overview: {e}")
        return []

@router.get("/team/summary", response_model=schemas.TeamSummary)
def get_team_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    try:
        team_users = get_team_users(db, current_user)
        now = datetime.now(timezone.utc)
        if not team_users:
            return schemas.TeamSummary(
                avg_completion_rate=0,
                total_overdue_tasks=0,
                total_active_tasks=0
            )
        
        total_completion_rate = 0
        total_overdue = 0
        total_active = 0
        
        for user in team_users:
            try:
                total_completion_rate += calculate_completion_rate(user.id, db)
                user_tasks = db.query(models.Task).filter(
                    and_(
                        models.Task.assigned_to == user.id,
                        models.Task.status.notin_([models.TaskStatus.COMPLETED, models.TaskStatus.ARCHIVED])
                    )
                ).all()
                
                for t in user_tasks:
                    if t.deadline:
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
            except Exception as e:
                print(f"Error processing user {user.id} in summary: {e}")
        
        avg_completion = total_completion_rate / len(team_users) if team_users else 0
        return schemas.TeamSummary(
            avg_completion_rate=round(avg_completion, 2),
            total_overdue_tasks=total_overdue,
            total_active_tasks=total_active
        )
    except Exception as e:
        print(f"Error in get_team_summary: {e}")
        return schemas.TeamSummary(
            avg_completion_rate=0,
            total_overdue_tasks=0,
            total_active_tasks=0
        )

@router.get("/team/ranking", response_model=List[schemas.RankingItem])
def get_team_ranking(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    try:
        team_users = get_team_users(db, current_user)
        ranking = []
        for user in team_users:
            try:
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
                    completion_rate=round(completion_rate, 2),
                    completed_tasks=completed_tasks
                ))
            except Exception as e:
                print(f"Error processing user {user.id} in ranking: {e}")
        
        ranking.sort(key=lambda x: x.completion_rate, reverse=True)
        return ranking
    except Exception as e:
        print(f"Error in get_team_ranking: {e}")
        return []

@router.get("/team/user/{user_id}/overview", response_model=schemas.MyAnalyticsOverview)
def get_user_analytics(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin)
):
    try:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user or user.role == models.UserRole.ADMIN:
            raise HTTPException(status_code=404, detail="User not found")
        
        if current_user.role == models.UserRole.MANAGER:
            if not current_user.group_id:
                raise HTTPException(status_code=403, detail="Access denied")
            if user.group_id != current_user.group_id:
                raise HTTPException(status_code=403, detail="Access denied - you can only view your team members")
        
        tasks = db.query(models.Task).filter(models.Task.assigned_to == user_id).all()
        now = datetime.now(timezone.utc)
        tasks_by_status = {}
        for status in models.TaskStatus:
            tasks_by_status[status.value] = len([t for t in tasks if t.status == status])
        
        active_tasks = tasks_by_status.get("new", 0) + tasks_by_status.get("in_progress", 0) + tasks_by_status.get("in_review", 0)
        overdue_tasks = 0
        for t in tasks:
            if t.status != models.TaskStatus.COMPLETED and t.status != models.TaskStatus.ARCHIVED:
                if t.deadline:
                    deadline = t.deadline
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=timezone.utc)
                    if deadline < now:
                        overdue_tasks += 1
        
        completion_rate = calculate_completion_rate(user_id, db)
        completed_tasks = [t for t in tasks if t.status == models.TaskStatus.COMPLETED and t.updated_at]
        if completed_tasks:
            total_hours = 0
            for t in completed_tasks:
                if t.created_at:
                    total_hours += (t.updated_at - t.created_at).total_seconds() / 3600
            avg_completion_time = total_hours / len(completed_tasks) if len(completed_tasks) > 0 else None
        else:
            avg_completion_time = None
        
        return schemas.MyAnalyticsOverview(
            completion_rate=round(completion_rate, 2),
            overdue_tasks=overdue_tasks,
            active_tasks=active_tasks,
            tasks_by_status=tasks_by_status,
            avg_completion_time=round(avg_completion_time, 2) if avg_completion_time else None
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_user_analytics: {e}")
        return schemas.MyAnalyticsOverview(
            completion_rate=0.0,
            overdue_tasks=0,
            active_tasks=0,
            tasks_by_status={status.value: 0 for status in models.TaskStatus},
            avg_completion_time=None
        )

@router.get("/groups", response_model=List[dict])
def get_groups_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    try:
        groups = db.query(models.Group).all()
        result = []
        
        for group in groups:
            members = db.query(models.User).filter(
                models.User.group_id == group.id,
                models.User.role != models.UserRole.ADMIN
            ).all()
            
            if not members:
                result.append({
                    "group_id": group.id,
                    "group_name": group.name,
                    "member_count": 0,
                    "avg_completion_rate": 0,
                    "total_overdue_tasks": 0,
                    "total_active_tasks": 0,
                    "members": []
                })
                continue
            
            total_completion = 0
            total_overdue = 0
            total_active = 0
            members_data = []
            now = datetime.now(timezone.utc)
            for member in members:
                completion_rate = calculate_completion_rate(member.id, db)
                total_completion += completion_rate
                member_tasks = db.query(models.Task).filter(
                    and_(
                        models.Task.assigned_to == member.id,
                        models.Task.status.notin_([models.TaskStatus.COMPLETED, models.TaskStatus.ARCHIVED])
                    )
                ).all()
                
                overdue = 0
                for t in member_tasks:
                    if t.deadline:
                        deadline = t.deadline
                        if deadline.tzinfo is None:
                            deadline = deadline.replace(tzinfo=timezone.utc)
                        if deadline < now:
                            overdue += 1
                total_overdue += overdue
                
                active = db.query(models.Task).filter(
                    and_(
                        models.Task.assigned_to == member.id,
                        models.Task.status.in_([models.TaskStatus.NEW, models.TaskStatus.IN_PROGRESS, models.TaskStatus.IN_REVIEW])
                    )
                ).count()
                total_active += active
                
                members_data.append({
                    "user_id": member.id,
                    "full_name": member.full_name,
                    "completion_rate": round(completion_rate, 2),
                    "overdue_tasks": overdue,
                    "active_tasks": active
                })
            
            avg_completion = total_completion / len(members) if members else 0
            
            result.append({
                "group_id": group.id,
                "group_name": group.name,
                "member_count": len(members),
                "avg_completion_rate": round(avg_completion, 2),
                "total_overdue_tasks": total_overdue,
                "total_active_tasks": total_active,
                "members": members_data
            })
        
        return result
    except Exception as e:
        print(f"Error in get_groups_analytics: {e}")
        return []