from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, users, tasks, analytics, notifications
from app import models
from app.auth import get_password_hash

Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Менеджера задач", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(analytics.router)
app.include_router(notifications.router)

@app.on_event("startup")
def create_admin_user():
    from app.database import SessionLocal
    db = SessionLocal()
    
    try:
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
            print("Admin user created: admin@example.com / admin123")
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "Task Manager API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}