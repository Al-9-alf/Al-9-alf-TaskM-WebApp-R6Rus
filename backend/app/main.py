from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, init_db
from app.routers import auth, users, tasks, analytics, notifications, groups
from app import models
from app.auth import get_password_hash
import logging

init_db()

app = FastAPI(title="API Менеджера задач", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(analytics.router)
app.include_router(notifications.router)
app.include_router(groups.router)

def sync_user_roles(db):
    from app.database import SessionLocal
    
    managers = db.query(models.User).filter(models.User.role == models.UserRole.MANAGER).all()
    
    for manager in managers:
        is_leader = db.query(models.Group).filter(models.Group.leader_id == manager.id).first()
        
        if not is_leader:
            print(f"⚠️ Исправление роли пользователя {manager.email}: MANAGER -> EMPLOYEE (не руководит группой)")
            manager.role = models.UserRole.EMPLOYEE
    db.commit()

@app.on_event("startup")
def startup_event():
    from app.database import SessionLocal
    db = SessionLocal()
    
    try:
        sync_user_roles(db)
        admin = db.query(models.User).filter(models.User.role == models.UserRole.ADMIN).first()
        if not admin:
            admin_user = models.User(
                email="admin@example.com",
                full_name="System Administrator",
                hashed_password=get_password_hash("admin123"),
                role=models.UserRole.ADMIN
            )
            db.add(admin_user)
            db.commit()
            print("✅ Admin user created: admin@example.com / admin123")
        else:
            print("✅ Admin user already exists")
        
        users_count = db.query(models.User).count()
        admins_count = db.query(models.User).filter(models.User.role == models.UserRole.ADMIN).count()
        managers_count = db.query(models.User).filter(models.User.role == models.UserRole.MANAGER).count()
        employees_count = db.query(models.User).filter(models.User.role == models.UserRole.EMPLOYEE).count()
        groups_count = db.query(models.Group).count()
        
        print(f"📊 Статистика: {users_count} пользователей (Админов: {admins_count}, Руководителей: {managers_count}, Сотрудников: {employees_count}), Групп: {groups_count}")
        
    except Exception as e:
        print(f"⚠️ Error during startup: {e}")
        db.rollback()
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "Task Manager API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )