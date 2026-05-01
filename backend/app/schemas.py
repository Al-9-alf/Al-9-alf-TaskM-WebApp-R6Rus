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

# User schemas
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
    
    class Config:
        from_attributes = True

# Task schemas
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    deadline: datetime
    assigned_to: int

    @validator('deadline')
    def validate_deadline(cls, v):
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
    deadline: datetime
    assigned_to: int
    status: TaskStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: int
    delegated_from: Optional[int] = None
    delegation_reason: Optional[str] = None
    assignee: UserResponse
    creator: UserResponse
    comments: List[CommentResponse] = []
    
    class Config:
        from_attributes = True

# Comment schemas
class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)

# Notification schemas
class NotificationResponse(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime
    notification_type: str
    
    class Config:
        from_attributes = True

# Analytics schemas
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

# Auth schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str