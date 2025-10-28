from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class PatientCreate(BaseModel):
    name: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class PatientResponse(BaseModel):
    id: int
    name: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime

class PatientAnswerResponse(BaseModel):
    patient_id: int
    question_id: int
    response_text: Optional[str] = None
    response_value: Optional[str] = None

class QuestionResponse(BaseModel):
    id: int
    question_number: int
    question_text: str
    question_type: str
    options: Optional[str] = None
    is_general: bool

class PersonalizedQuestionResponse(BaseModel):
    id: int
    patient_id: int
    question_number: int
    question_text: str
    question_type: str
    generated_reason: Optional[str] = None

class PatientSummaryResponse(BaseModel):
    id: int
    patient_id: int
    visit_reason: Optional[str] = None
    symptoms: Optional[str] = None
    pain_level: Optional[int] = None
    medical_history: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    summary_text: Optional[str] = None
    created_at: datetime

class QuestionnaireProgress(BaseModel):
    patient_id: int
    current_question: int
    total_general_questions: int
    completed_general: bool
    current_personalized_question: int
    total_personalized_questions: int
    completed_personalized: bool
    is_complete: bool
