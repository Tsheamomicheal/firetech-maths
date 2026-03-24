from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    problems = relationship("MathProblem", back_populates="owner")

class MathProblem(Base):
    __tablename__ = "problems"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    image_path = Column(String)
    solution = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    share_token = Column(String, unique=True, index=True)

    owner = relationship("User", back_populates="problems")
