from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"

class TaskStatus(str, Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"
    ARCHIVED = "archived"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class GroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

class GroupCreate(GroupBase):
    leader_id: Optional[int] = None

class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    leader_id: Optional[int] = None

class GroupResponse(GroupBase):
    id: int
    leader_id: Optional[int] = None
    leader_name: Optional[str] = None
    created_at: datetime
    member_count: int = 0
    
    class Config:
        from_attributes = True

class GroupMember(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: UserRole

class AddMemberToGroup(BaseModel):
    user_id: int

class RemoveMemberFromGroup(BaseModel):
    user_id: int

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.EMPLOYEE

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserUpdateRole(BaseModel):
    role: UserRole

class UserResponse(UserBase):
    id: int
    created_at: datetime
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    deadline: Optional[datetime] = None
    assigned_to: int
    @validator('deadline')
    def validate_deadline(cls, v):
        if v is not None:
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if v < now:
                raise ValueError('Deadline cannot be in the past')
        return v

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    deadline: Optional[datetime] = None
    assigned_to: Optional[int] = None

class TaskDelegation(BaseModel):
    new_assignee_id: int
    reason: str = Field(..., min_length=1)

class CommentResponse(BaseModel):
    id: int
    content: str
    created_at: datetime
    author_id: int
    author_name: str = ""
    author_role: str = ""
    
    class Config:
        from_attributes = True

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    priority: TaskPriority
    deadline: Optional[datetime] = None
    assigned_to: Optional[int] = None
    status: TaskStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    delegated_from: Optional[int] = None
    delegation_reason: Optional[str] = None
    assignee: Optional[UserResponse] = None
    creator: Optional[UserResponse] = None
    comments: List[CommentResponse] = []
    assignee_group_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)

class NotificationResponse(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime
    notification_type: str
    
    class Config:
        from_attributes = True

class MyAnalyticsOverview(BaseModel):
    completion_rate: float
    overdue_tasks: int
    active_tasks: int
    tasks_by_status: dict
    avg_completion_time: Optional[float]

class TeamMemberAnalytics(BaseModel):
    user_id: int
    full_name: str
    completion_rate: float
    overdue_tasks: int
    active_tasks: int
    avg_completion_time: Optional[float]

class TeamSummary(BaseModel):
    avg_completion_rate: float
    total_overdue_tasks: int
    total_active_tasks: int

class RankingItem(BaseModel):
    user_id: int
    full_name: str
    completion_rate: float
    completed_tasks: int

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str