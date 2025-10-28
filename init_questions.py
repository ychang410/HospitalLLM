from app.database import SessionLocal, engine
from app.models import Question, Base
import json

def init_questions():
    """Initialize the 5 general questions in the database"""
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Question data
    questions_data = [
        {
            "question_number": 1,
            "question_text": "오늘 병원에 오신 이유는 무엇인가요?",
            "question_type": "text",
            "is_general": True
        },
        {
            "question_number": 2,
            "question_text": "어느 신체 부위에 증상이 있으신가요? (아래 신체 이미지에서 선택해주세요)",
            "question_type": "body_map",
            "is_general": True
        },
        {
            "question_number": 3,
            "question_text": "현재 복용하고 있는 약물이 있나요?",
            "question_type": "text",
            "is_general": True
        }
    ]
    
    db = SessionLocal()
    
    try:
        # Clear existing questions
        db.query(Question).delete()
        
        # Insert new questions
        for q_data in questions_data:
            question = Question(**q_data)
            db.add(question)
        
        db.commit()
        print("Successfully initialized 3 general questions!")
        
    except Exception as e:
        print(f"Error initializing questions: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_questions()
