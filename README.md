# 병원 챗봇 - iPad 최적화 질문지 시스템

iPad에서 사용하기 위한 병원 환자 질문지 시스템입니다. 15개의 일반 질문과 환자 답변 기반 5개의 개인화 질문을 통해 의료진이 필요한 정보를 효율적으로 수집할 수 있습니다.

## 주요 기능

### 1. 환자 등록 및 질문지
- 환자 기본 정보 입력
- 15개 일반 의료 질문 (방문 이유, 증상, 통증 정도, 의료 기록 등)
- 환자 답변 기반 AI 생성 개인화 질문 5개

### 2. iPad 최적화 UI
- 터치 친화적인 블록 기반 인터페이스
- 큰 버튼과 텍스트로 사용성 향상
- 슬라이더를 통한 통증 정도 평가 (1-10점)
- 진행률 표시 및 자동 저장

### 3. 의료진용 요약 뷰
- 환자 정보 종합 요약
- 상세 응답 내용 확인
- 진료 메모 작성 기능
- 인쇄 지원

## 기술 스택

- **Backend**: FastAPI (Python)
- **Database**: SQLite (개발용)
- **Frontend**: HTML5, CSS3, JavaScript, Bootstrap 5
- **AI**: OpenAI GPT-3.5-turbo (개인화 질문 생성)
- **Deployment**: Uvicorn ASGI server

## 설치 및 실행

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 추가하세요:
```
OPENAI_API_KEY=your_openai_api_key_here
SECRET_KEY=your_secret_key_here
DATABASE_URL=sqlite:///./hospital_chatbot.db
```

### 3. 데이터베이스 초기화
```bash
python init_questions.py
```

### 4. 애플리케이션 실행
```bash
python main.py
```

애플리케이션이 `http://localhost:8000`에서 실행됩니다.

## 사용법

### 환자용 (iPad)
1. 환자 등록 페이지에서 기본 정보 입력
2. 15개 일반 질문에 순차적으로 답변
3. AI가 생성한 5개 개인화 질문에 답변
4. 완료 후 요약 확인

### 의료진용
1. `/doctor-view/{patient_id}` 페이지에서 환자 정보 요약 확인
2. 주요 정보와 상세 응답 내용 검토
3. 진료 메모 작성 및 다음 단계 계획

## API 엔드포인트

- `GET /` - 환자 등록 페이지
- `GET /questionnaire/{patient_id}` - 질문지 페이지
- `GET /doctor-view/{patient_id}` - 의료진 요약 페이지
- `POST /api/patients/` - 환자 등록
- `GET /api/questions/` - 질문 목록 조회
- `POST /api/responses/` - 답변 저장
- `POST /api/generate-personalized-questions/{patient_id}` - 개인화 질문 생성
- `GET /api/patient-summary/{patient_id}` - 환자 요약 정보

## 데이터베이스 스키마

### 주요 테이블
- `patients` - 환자 기본 정보
- `questions` - 일반 질문 목록
- `patient_responses` - 환자 응답
- `personalized_questions` - AI 생성 개인화 질문
- `patient_summaries` - 환자 요약 정보

## 보안 및 개인정보 보호

- 모든 통신은 HTTPS 사용 권장
- 환자 데이터는 로컬 데이터베이스에 저장
- 의료진만 환자 정보에 접근 가능
- 데이터 암호화 및 백업 정책 적용 필요

## 확장 가능성

- 다국어 지원
- 음성 입력 기능
- EHR 시스템 연동
- 모바일 앱 개발
- 실시간 알림 시스템
