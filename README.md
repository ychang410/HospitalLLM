# 병원 챗봇 - iPad 최적화 질문지 시스템

iPad에서 사용하기 위한 병원 환자 질문지 시스템입니다. 15개의 일반 질문과 환자 답변 기반 5개의 개인화 질문을 통해 의료진이 필요한 정보를 효율적으로 수집할 수 있습니다.

## 주요 기능

### 1. 환자 등록 및 질문지
- 환자 기본 정보 입력
- 일반 의료 질문 (방문 이유, 증상, 통증 정도, 의료 기록 등)
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
