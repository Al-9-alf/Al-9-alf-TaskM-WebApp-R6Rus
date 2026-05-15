from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas
from app.database import get_db
from app.dependencies import require_admin, get_current_active_user

router = APIRouter(prefix="/api/groups", tags=["groups"])

def create_notification(db: Session, user_id: int, message: str, notification_type: str):
    notification = models.Notification(
        user_id=user_id,
        message=message,
        notification_type=notification_type
    )
    db.add(notification)
    db.commit()

@router.get("/", response_model=List[schemas.GroupResponse])
def get_groups(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    if current_user.role == models.UserRole.ADMIN:
        groups = db.query(models.Group).all()
    else:
        if current_user.group_id:
            groups = db.query(models.Group).filter(models.Group.id == current_user.group_id).all()
        else:
            groups = []
    
    result = []
    for group in groups:
        member_count = db.query(models.User).filter(models.User.group_id == group.id).count()
        leader_name = None
        if group.leader_id:
            leader = db.query(models.User).filter(models.User.id == group.leader_id).first()
            if leader:
                leader_name = leader.full_name
        result.append(schemas.GroupResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            leader_id=group.leader_id,
            leader_name=leader_name,
            created_at=group.created_at,
            member_count=member_count
        ))
    return result

@router.get("/my", response_model=schemas.GroupResponse)
def get_my_group(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    if not current_user.group_id:
        raise HTTPException(status_code=404, detail="Вы не состоите в группе")
    
    group = db.query(models.Group).filter(models.Group.id == current_user.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    member_count = db.query(models.User).filter(models.User.group_id == group.id).count()
    leader_name = None
    if group.leader_id:
        leader = db.query(models.User).filter(models.User.id == group.leader_id).first()
        if leader:
            leader_name = leader.full_name
    
    return schemas.GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        leader_id=group.leader_id,
        leader_name=leader_name,
        created_at=group.created_at,
        member_count=member_count
    )

@router.post("/", response_model=schemas.GroupResponse)
def create_group(
    group_data: schemas.GroupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    existing = db.query(models.Group).filter(models.Group.name == group_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Группа с таким названием уже существует")
    
    if not group_data.leader_id:
        raise HTTPException(status_code=400, detail="Необходимо выбрать руководителя группы")
    
    leader = db.query(models.User).filter(models.User.id == group_data.leader_id).first()
    if not leader:
        raise HTTPException(status_code=400, detail="Руководитель не найден")
    if leader.role == models.UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Администратор не может быть руководителем группы")
    if leader.group_id is not None:
        raise HTTPException(status_code=400, detail="Пользователь уже состоит в другой группе")
    
    new_group = models.Group(
        name=group_data.name,
        description=group_data.description,
        leader_id=group_data.leader_id
    )
    db.add(new_group)
    db.flush()
    leader.group_id = new_group.id
    old_role = leader.role
    leader.role = models.UserRole.MANAGER
    db.commit()
    db.refresh(new_group)
    
    create_notification(
        db, leader.id,
        f"Вы назначены руководителем группы \"{new_group.name}\"",
        "group_leader_assigned"
    )
    
    member_count = db.query(models.User).filter(models.User.group_id == new_group.id).count()
    leader_name = leader.full_name
    return schemas.GroupResponse(
        id=new_group.id,
        name=new_group.name,
        description=new_group.description,
        leader_id=new_group.leader_id,
        leader_name=leader_name,
        created_at=new_group.created_at,
        member_count=member_count
    )

@router.put("/{group_id}", response_model=schemas.GroupResponse)
def update_group(
    group_id: int,
    group_data: schemas.GroupUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    old_leader_id = group.leader_id
    
    if group_data.name:
        existing = db.query(models.Group).filter(
            models.Group.name == group_data.name,
            models.Group.id != group_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Группа с таким названием уже существует")
        group.name = group_data.name
    
    if group_data.description is not None:
        group.description = group_data.description
    
    if group_data.leader_id is not None and group_data.leader_id != group.leader_id:
        if not group_data.leader_id:
            raise HTTPException(status_code=400, detail="Необходимо выбрать руководителя группы")
        
        new_leader = db.query(models.User).filter(models.User.id == group_data.leader_id).first()
        if not new_leader:
            raise HTTPException(status_code=400, detail="Пользователь не найден")
        if new_leader.role == models.UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="Администратор не может быть руководителем группы")
        
        if new_leader.group_id is not None and new_leader.group_id != group_id:
            raise HTTPException(status_code=400, detail="Пользователь уже состоит в другой группе")
        
        if new_leader.group_id is None:
            new_leader.group_id = group_id
        
        new_leader.role = models.UserRole.MANAGER
        
        create_notification(
            db, new_leader.id,
            f"Вы назначены руководителем группы \"{group.name}\"",
            "group_leader_assigned"
        )
        
        if old_leader_id:
            old_leader = db.query(models.User).filter(models.User.id == old_leader_id).first()
            if old_leader:
                other_group = db.query(models.Group).filter(
                    models.Group.leader_id == old_leader_id,
                    models.Group.id != group_id
                ).first()
                if not other_group:
                    old_leader.role = models.UserRole.EMPLOYEE
                    create_notification(
                        db, old_leader.id,
                        f"Вы сняты с должности руководителя группы \"{group.name}\"",
                        "group_leader_removed"
                    )
        
        group.leader_id = group_data.leader_id
    
    db.commit()
    db.refresh(group)
    
    member_count = db.query(models.User).filter(models.User.group_id == group.id).count()
    leader_name = None
    if group.leader_id:
        leader = db.query(models.User).filter(models.User.id == group.leader_id).first()
        if leader:
            leader_name = leader.full_name
    
    return schemas.GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        leader_id=group.leader_id,
        leader_name=leader_name,
        created_at=group.created_at,
        member_count=member_count
    )

@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    group_name = group.name
    old_leader_id = group.leader_id
    members = db.query(models.User).filter(models.User.group_id == group_id).all()
    
    for member in members:
        member.group_id = None
        if member.id == old_leader_id:
            other_group = db.query(models.Group).filter(
                models.Group.leader_id == member.id,
                models.Group.id != group_id
            ).first()
            if not other_group:
                member.role = models.UserRole.EMPLOYEE
                create_notification(
                    db, member.id,
                    f"Группа \"{group_name}\" удалена. Вы сняты с должности руководителя.",
                    "group_deleted_leader_removed"
                )
        elif member.role == models.UserRole.MANAGER:
            other_group = db.query(models.Group).filter(
                models.Group.leader_id == member.id,
                models.Group.id != group_id
            ).first()
            if not other_group:
                member.role = models.UserRole.EMPLOYEE
        
        if member.id != old_leader_id:
            create_notification(
                db, member.id,
                f"Группа \"{group_name}\" удалена. Вы были исключены из группы.",
                "group_deleted_member_removed"
            )
    
    if old_leader_id:
        old_leader = db.query(models.User).filter(models.User.id == old_leader_id).first()
        if old_leader:
            other_group = db.query(models.Group).filter(
                models.Group.leader_id == old_leader_id,
                models.Group.id != group_id
            ).first()
            if not other_group:
                old_leader.role = models.UserRole.EMPLOYEE
    
    db.delete(group)
    db.commit()
    return {"message": "Группа успешно удалена"}

@router.get("/{group_id}/members", response_model=List[schemas.GroupMember])
def get_group_members(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    if current_user.role != models.UserRole.ADMIN:
        if current_user.group_id != group_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этой группе")
    
    members = db.query(models.User).filter(models.User.group_id == group_id).all()
    return [
        schemas.GroupMember(
            user_id=member.id,
            full_name=member.full_name,
            email=member.email,
            role=member.role
        )
        for member in members
    ]

@router.post("/{group_id}/members")
def add_member_to_group(
    group_id: int,
    member_data: schemas.AddMemberToGroup,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    user = db.query(models.User).filter(models.User.id == member_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if user.role == models.UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Нельзя добавить администратора в группу")
    
    old_group_id = user.group_id
    
    if user.group_id and user.group_id != group_id:
        old_group = db.query(models.Group).filter(models.Group.id == old_group_id).first()
        old_group_name = old_group.name if old_group else "неизвестной группе"
        
        create_notification(
            db, user.id,
            f"Вы перемещены из группы \"{old_group_name}\" в группу \"{group.name}\"",
            "group_changed"
        )
    elif user.group_id == group_id:
        raise HTTPException(status_code=400, detail="Пользователь уже состоит в этой группе")
    else:
        create_notification(
            db, user.id,
            f"Вы добавлены в группу \"{group.name}\"",
            "group_added"
        )
    
    user.group_id = group_id
    db.commit()
    return {"message": f"Пользователь {user.full_name} добавлен в группу {group.name}"}

@router.delete("/{group_id}/members")
def remove_member_from_group(
    group_id: int,
    member_data: schemas.RemoveMemberFromGroup,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    user = db.query(models.User).filter(models.User.id == member_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if user.group_id != group_id:
        raise HTTPException(status_code=400, detail="Пользователь не состоит в этой группе")
    
    if user.id == group.leader_id:
        raise HTTPException(
            status_code=400, 
            detail="Нельзя удалить руководителя из группы. Сначала назначьте нового руководителя."
        )
    else:
        user.group_id = None
        create_notification(
            db, user.id,
            f"Вы удалены из группы \"{group.name}\"",
            "group_removed"
        )
    
    db.commit()
    return {"message": f"Пользователь {user.full_name} удален из группы {group.name}"}