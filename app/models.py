from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    date_of_birth = Column(String(20))
    gender = Column(String(20))
    phone = Column(String(20))
    email = Column(String(100))
    created_at = Column(DateTime, default=func.now())
    
class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    question_number = Column(Integer, unique=True, nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), default="text")  # text, scale, checkbox, select
    options = Column(Text)  # JSON string for multiple choice options
    is_general = Column(Boolean, default=True)
    
class PatientResponse(Base):
    __tablename__ = "patient_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, nullable=False)
    question_id = Column(Integer, nullable=False)
    response_text = Column(Text)
    response_value = Column(String(500))  # For scale ratings, etc.
    created_at = Column(DateTime, default=func.now())
    
class PersonalizedQuestion(Base):
    __tablename__ = "personalized_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, nullable=False)
    question_number = Column(Integer, nullable=False)  # 1-5 for personalized questions
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), default="text")
    generated_reason = Column(Text)  # Why this question was generated
    created_at = Column(DateTime, default=func.now())
    
class BodyPartSymptom(Base):
    __tablename__ = "body_part_symptoms"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, nullable=False)
    body_part = Column(String(100), nullable=False)  # e.g., "head", "chest", "left_arm"
    pain_level = Column(Integer)  # 1-10
    duration = Column(String(200))  # How long
    description = Column(Text)  # Additional details
    created_at = Column(DateTime, default=func.now())

class PatientSummary(Base):
    __tablename__ = "patient_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, nullable=False)
    visit_reason = Column(Text)
    symptoms = Column(Text)
    pain_level = Column(Integer)
    medical_history = Column(Text)
    current_medications = Column(Text)
    allergies = Column(Text)
    summary_text = Column(Text)
    created_at = Column(DateTime, default=func.now())
