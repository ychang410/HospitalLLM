import openai
import json
import os
from typing import List, Dict, Any
from app.models import PatientResponse, Question

class PersonalizedQuestionGenerator:
    def __init__(self):
        api_key = self._load_api_key()
        if api_key:
            try:
                self.client = openai.OpenAI(api_key=api_key)
                self.has_api_key = True
                print("OpenAI client initialized successfully")
            except Exception as e:
                print(f"Error initializing OpenAI client: {e}")
                self.client = None
                self.has_api_key = False
        else:
            self.client = None
            self.has_api_key = False
            print("No API key found, using fallback questions")
    
    def _load_api_key(self):
        """Load API key from file"""
        try:
            # Try to read from api_key.txt file
            api_key_file = os.path.join(os.path.dirname(__file__), '..', 'api_key.txt')
            with open(api_key_file, 'r') as f:
                api_key = f.read().strip()
                if api_key and not api_key.startswith("ghp_"):
                    return api_key
        except FileNotFoundError:
            print("api_key.txt file not found")
        except Exception as e:
            print(f"Error reading API key file: {e}")
        
        # Fallback to environment variable
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key and not api_key.startswith("ghp_"):
            return api_key
        
        return None
    
    def generate_personalized_questions(self, patient_responses: List[Dict]) -> List[Dict]:
        """
        Generate 2 personalized questions based on patient responses
        """
        # Prepare context from patient responses
        context = self._prepare_context(patient_responses)
        
        prompt = f"""
        Based on the following patient questionnaire responses, generate exactly 2 personalized follow-up questions that would help the doctor better understand the patient's condition.
        
        Patient Responses Context:
        {context}
        
        Guidelines:
        1. Focus on the most important symptoms or medical history mentioned
        2. Ask clarifying questions about severity, timing, triggers, or associated symptoms
        3. Questions should be specific and actionable for medical diagnosis
        4. Use Korean language for questions
        5. Each question should be different and cover different aspects
        
        Return as JSON array with this format:
        [
            {{
                "question_text": "질문 내용",
                "question_type": "text|scale|checkbox",
                "generated_reason": "이 질문을 생성한 이유"
            }}
        ]
        """
        
        if not self.has_api_key:
            print("OpenAI API key not available, using fallback questions")
            return self._get_fallback_questions()
            
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7
            )
            
            questions_data = json.loads(response.choices[0].message.content)
            return questions_data[:2]  # Ensure exactly 2 questions
            
        except Exception as e:
            print(f"Error generating personalized questions: {e}")
            return self._get_fallback_questions()
    
    def _prepare_context(self, patient_responses: List[Dict]) -> str:
        """Prepare context string from patient responses"""
        context_parts = []
        
        for response in patient_responses:
            question_num = response.get('question_number', '')
            question_text = response.get('question_text', '')
            answer = response.get('response_text', response.get('response_value', ''))
            
            context_parts.append(f"Q{question_num}: {question_text}\nA: {answer}")
        
        return "\n\n".join(context_parts)
    
    def _get_fallback_questions(self) -> List[Dict]:
        """Fallback questions if AI generation fails"""
        return [
            {
                "question_text": "현재 증상이 일상생활에 어떤 영향을 미치고 있나요?",
                "question_type": "text",
                "generated_reason": "일상생활 영향도 파악"
            },
            {
                "question_text": "증상이 나타나는 특정 시간이나 상황이 있나요?",
                "question_type": "text",
                "generated_reason": "증상 패턴 파악"
            }
        ]
