from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse
import os
import uuid
import shutil
from typing import List

from . import models, auth, database, pdf_service, openai_service

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Math Solver API")

# Ensure uploads directory exists
os.makedirs("app/uploads", exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")

@app.post("/signup")
def signup(username: str, password: str, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = auth.get_password_hash(password)
    new_user = models.User(username=username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}

@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return {"id": current_user.id, "username": current_user.username}

@app.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    file_extension = os.path.splitext(file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join("app/uploads", unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if file_extension == ".pdf":
        # Convert PDF to images for selection
        pages = pdf_service.convert_pdf_to_images(file_path, "app/uploads")
        return {
            "type": "pdf",
            "file_id": unique_filename,
            "pages": pages # These are relative paths to app/uploads/pdf_id/page_n.png
        }
    else:
        # It's an image
        return {
            "type": "image",
            "file_id": unique_filename,
            "file_path": unique_filename # relative to app/uploads
        }

@app.post("/solve")
def solve_problem(
    file_path: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    full_path = os.path.join("app/uploads", file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        solution_md = openai_service.solve_math_problem(full_path)

        # Save to database
        share_token = str(uuid.uuid4())
        new_problem = models.MathProblem(
            user_id=current_user.id,
            image_path=file_path,
            solution=solution_md,
            share_token=share_token
        )
        db.add(new_problem)
        db.commit()
        db.refresh(new_problem)

        return {
            "id": new_problem.id,
            "solution": solution_md,
            "share_token": share_token
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/solution/view/{share_token}")
def view_solution(
    share_token: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    problem = db.query(models.MathProblem).filter(models.MathProblem.share_token == share_token).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Solution not found")

    return {
        "solution": problem.solution,
        "image_url": f"/uploads/{problem.image_path}",
        "created_at": problem.created_at
    }

@app.get("/history")
def get_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    problems = db.query(models.MathProblem).filter(models.MathProblem.user_id == current_user.id).order_by(models.MathProblem.created_at.desc()).all()
    return problems

@app.get("/")
def root():
    return FileResponse("app/static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
