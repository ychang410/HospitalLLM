# 병원 사전 문진 LLM 챗봇

병원 사전 문진을 위한 LLM 기반 챗봇 시스템

## 기술 스택

- React 18
- TypeScript
- Vite
- Tailwind CSS

## 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

### 3. 빌드
```bash
npm run build
```

## 프로젝트 구조

```
HospitalLLM/
├── src/
│   ├── components/
│   │   ├── PatientInfoForm.tsx    # 환자 정보 입력 폼
│   │   └── ChatInterface.tsx      # 채팅 인터페이스
│   ├── App.tsx                    # 메인 앱 컴포넌트
│   ├── main.tsx                   # 진입점
│   └── index.css                  # 전역 스타일
├── package.json
└── tailwind.config.js
```

