from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json

from app.database import get_db, create_tables
from app.models import Patient, Question, PatientResponse as PatientResponseModel, PersonalizedQuestion, PatientSummary, BodyPartSymptom
from app.schemas import (
    PatientCreate, PatientResponse, PatientAnswerResponse, QuestionResponse, 
    PersonalizedQuestionResponse, PatientSummaryResponse, QuestionnaireProgress
)
from app.question_generator import PersonalizedQuestionGenerator

app = FastAPI(title="Hospital Chatbot", version="1.0.0")

# Create tables on startup
create_tables()

# Templates and static files
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize question generator
question_generator = PersonalizedQuestionGenerator()

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/questionnaire/{patient_id}", response_class=HTMLResponse)
async def questionnaire(request: Request, patient_id: int, db: Session = Depends(get_db)):
    return templates.TemplateResponse("questionnaire.html", {"request": request, "patient_id": patient_id})

@app.get("/doctor-view/{patient_id}", response_class=HTMLResponse)
async def doctor_view(request: Request, patient_id: int, db: Session = Depends(get_db)):
    return templates.TemplateResponse("doctor_view.html", {"request": request, "patient_id": patient_id})

@app.get("/patient-summary/{patient_id}", response_class=HTMLResponse)
async def patient_summary(request: Request, patient_id: int, db: Session = Depends(get_db)):
    return templates.TemplateResponse("patient_summary.html", {"request": request, "patient_id": patient_id})

# API Endpoints
@app.post("/api/patients/", response_model=PatientResponse)
async def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    db_patient = Patient(**patient.dict())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@app.get("/api/questions/", response_model=List[QuestionResponse])
async def get_questions(db: Session = Depends(get_db)):
    questions = db.query(Question).order_by(Question.question_number).all()
    return questions

@app.post("/api/responses/")
async def save_response(response: PatientAnswerResponse, db: Session = Depends(get_db)):
    db_response = PatientResponseModel(**response.dict())
    db.add(db_response)
    db.commit()
    return {"message": "Response saved successfully"}

@app.post("/api/body-part-symptoms/")
async def save_body_part_symptom(symptom_data: Dict[str, Any], db: Session = Depends(get_db)):
    symptom = BodyPartSymptom(**symptom_data)
    db.add(symptom)
    db.commit()
    return {"message": "Body part symptom saved successfully"}

@app.get("/api/questionnaire-progress/{patient_id}", response_model=QuestionnaireProgress)
async def get_questionnaire_progress(patient_id: int, db: Session = Depends(get_db)):
    # Get general question responses
    general_responses = db.query(PatientResponseModel).join(
        Question, PatientResponseModel.question_id == Question.id
    ).filter(
        PatientResponseModel.patient_id == patient_id,
        Question.is_general == True
    ).count()
    
    # Get personalized question responses
    personalized_responses = db.query(PatientResponseModel).join(
        PersonalizedQuestion, PatientResponseModel.question_id == PersonalizedQuestion.id
    ).filter(PatientResponseModel.patient_id == patient_id).count()
    
    total_general = db.query(Question).filter(Question.is_general == True).count()
    total_personalized = db.query(PersonalizedQuestion).filter(
        PersonalizedQuestion.patient_id == patient_id
    ).count()
    
    return QuestionnaireProgress(
        patient_id=patient_id,
        current_question=min(general_responses + 1, total_general),
        total_general_questions=total_general,
        completed_general=general_responses >= total_general,
        current_personalized_question=min(personalized_responses + 1, total_personalized),
        total_personalized_questions=total_personalized,
        completed_personalized=personalized_responses >= total_personalized if total_personalized > 0 else True,
        is_complete=general_responses >= total_general and (personalized_responses >= total_personalized if total_personalized > 0 else True)
    )

@app.post("/api/generate-personalized-questions/{patient_id}")
async def generate_personalized_questions(patient_id: int, db: Session = Depends(get_db)):
    # Get all general question responses for this patient
    responses = db.query(PatientResponseModel, Question).join(
        Question, PatientResponseModel.question_id == Question.id
    ).filter(
        PatientResponseModel.patient_id == patient_id,
        Question.is_general == True
    ).all()
    
    if not responses:
        raise HTTPException(status_code=400, detail="No general responses found")
    
    # Prepare response data for AI
    response_data = []
    for response_model, question in responses:
        response_data.append({
            "question_number": question.question_number,
            "question_text": question.question_text,
            "response_text": response_model.response_text,
            "response_value": response_model.response_value
        })
    
    # Check if personalized questions already exist for this patient
    existing_personalized = db.query(PersonalizedQuestion).filter(
        PersonalizedQuestion.patient_id == patient_id
    ).count()
    
    if existing_personalized > 0:
        return {"message": "Personalized questions already exist", "count": existing_personalized}
    
    # Generate personalized questions
    personalized_questions = question_generator.generate_personalized_questions(response_data)
    
    # Save personalized questions to database with offset ID to avoid conflicts
    for i, question_data in enumerate(personalized_questions, 1):
        db_question = PersonalizedQuestion(
            patient_id=patient_id,
            question_number=i,
            question_text=question_data["question_text"],
            question_type=question_data["question_type"],
            generated_reason=question_data.get("generated_reason", "")
        )
        db.add(db_question)
        db.flush()  # Get the ID
        # Use high ID range for personalized questions to avoid conflicts
        # This will be handled when saving responses
    
    db.commit()
    return {"message": "Personalized questions generated successfully", "count": len(personalized_questions)}

@app.get("/api/personalized-questions/{patient_id}", response_model=List[PersonalizedQuestionResponse])
async def get_personalized_questions(patient_id: int, db: Session = Depends(get_db)):
    questions = db.query(PersonalizedQuestion).filter(
        PersonalizedQuestion.patient_id == patient_id
    ).order_by(PersonalizedQuestion.question_number).all()
    return questions

@app.get("/api/general-responses/{patient_id}")
async def get_general_responses(patient_id: int, db: Session = Depends(get_db)):
    """Get all general question responses for a patient"""
    responses = db.query(PatientResponseModel, Question).join(
        Question, PatientResponseModel.question_id == Question.id
    ).filter(
        PatientResponseModel.patient_id == patient_id,
        Question.is_general == True
    ).all()
    
    result = []
    for response_model, question in responses:
        result.append({
            "question_text": question.question_text,
            "response_text": response_model.response_text,
            "response_value": response_model.response_value,
            "is_personalized": False
        })
    
    return result

@app.get("/api/personalized-responses/{patient_id}")
async def get_personalized_responses(patient_id: int, db: Session = Depends(get_db)):
    """Get all personalized question responses for a patient"""
    # Get personalized questions for this patient
    personalized_questions = db.query(PersonalizedQuestion).filter(
        PersonalizedQuestion.patient_id == patient_id
    ).all()
    
    result = []
    for question in personalized_questions:
        # Find response with offset ID
        response_model = db.query(PatientResponseModel).filter(
            PatientResponseModel.patient_id == patient_id,
            PatientResponseModel.question_id == 10000 + question.id
        ).first()
        
        if response_model:
            result.append({
                "question_text": question.question_text,
                "response_text": response_model.response_text,
                "response_value": response_model.response_value,
                "is_personalized": True,
                "generated_reason": question.generated_reason
            })
    
    return result

@app.post("/api/generate-patient-summary/{patient_id}")
async def generate_ai_summary(patient_id: int, db: Session = Depends(get_db)):
    """Generate AI summary for patient responses"""
    # Get all responses
    general_responses = await get_general_responses(patient_id, db)
    personalized_responses = await get_personalized_responses(patient_id, db)
    all_responses = general_responses + personalized_responses
    
    # Create summary using AI
    if question_generator.has_api_key:
        try:
            prompt = f"""
            다음은 환자가 작성한 질문지 답변들입니다. 이 답변들을 바탕으로 환자의 상태를 이해하기 쉽게 요약해주세요.
            
            답변 내용:
            {json.dumps(all_responses, ensure_ascii=False, indent=2)}
            
            요약 요구사항:
            1. 환자의 주요 증상과 상태를 명확히 정리
            2. 의료진이 이해하기 쉽게 구조화
            3. 한국어로 작성
            4. 전문적이면서도 이해하기 쉬운 언어 사용
            5. 3-4개 문단으로 구성
            
            요약:
            """
            
            response = question_generator.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7
            )
            
            summary = response.choices[0].message.content
            
        except Exception as e:
            print(f"Error generating AI summary: {e}")
            summary = generate_fallback_summary(all_responses)
    else:
        summary = generate_fallback_summary(all_responses)
    
    return {"summary": summary}

def generate_fallback_summary(responses):
    """Generate a simple fallback summary"""
    if not responses:
        return "답변 정보가 없습니다."
    
    visit_reason = ""
    symptoms = ""
    pain_level = ""
    
    for response in responses:
        if "방문" in response["question_text"]:
            visit_reason = response.get("response_text", "")
        elif "증상" in response["question_text"]:
            symptoms = response.get("response_text", "")
        elif "불편함" in response["question_text"]:
            pain_level = response.get("response_value", "")
    
    summary = f"""
환자는 '{visit_reason}'라는 이유로 내원했습니다.

주요 증상으로는 '{symptoms}'를 호소하고 있으며, 
통증 정도는 {pain_level}/10으로 평가했습니다.

추가로 제공된 정보를 바탕으로 의료진과 상담하시기 바랍니다.
    """.strip()
    
    return summary

@app.get("/api/patient-summary/{patient_id}", response_model=PatientSummaryResponse)
async def get_patient_summary(patient_id: int, db: Session = Depends(get_db)):
    summary = db.query(PatientSummary).filter(
        PatientSummary.patient_id == patient_id
    ).first()
    
    if not summary:
        # Generate summary if it doesn't exist
        summary = await generate_patient_summary(patient_id, db)
    
    return summary

async def generate_patient_summary(patient_id: int, db: Session) -> PatientSummary:
    # Get all responses for this patient
    all_responses = db.query(PatientResponseModel, Question).join(
        Question, PatientResponseModel.question_id == Question.id
    ).filter(PatientResponseModel.patient_id == patient_id).all()
    
    personalized_responses = db.query(PatientResponseModel, PersonalizedQuestion).join(
        PersonalizedQuestion, PatientResponseModel.question_id == PersonalizedQuestion.id
    ).filter(PatientResponseModel.patient_id == patient_id).all()
    
    # Create summary
    summary_data = {}
    for response_model, question in all_responses + personalized_responses:
        if hasattr(question, 'question_number'):
            if question.question_number == 1:
                summary_data['visit_reason'] = response_model.response_text
            elif question.question_number == 2:
                summary_data['symptoms'] = response_model.response_text
            elif question.question_number == 3:
                summary_data['pain_level'] = int(response_model.response_value) if response_model.response_value else None
            elif question.question_number == 8:
                summary_data['current_medications'] = response_model.response_text
            elif question.question_number == 10:
                summary_data['allergies'] = response_model.response_text
    
    # Create summary text
    summary_text = f"""
방문 사유: {summary_data.get('visit_reason', 'N/A')}
증상: {summary_data.get('symptoms', 'N/A')}
통증 정도: {summary_data.get('pain_level', 'N/A')}/10
현재 복용 약물: {summary_data.get('current_medications', 'N/A')}
알레르기: {summary_data.get('allergies', 'N/A')}
"""
    
    summary = PatientSummary(
        patient_id=patient_id,
        visit_reason=summary_data.get('visit_reason'),
        symptoms=summary_data.get('symptoms'),
        pain_level=summary_data.get('pain_level'),
        current_medications=summary_data.get('current_medications'),
        allergies=summary_data.get('allergies'),
        summary_text=summary_text.strip()
    )
    
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
