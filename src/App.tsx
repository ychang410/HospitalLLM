import { useState } from "react";
import MedicalRecordUpload from "./components/MedicalRecordUpload";
import PatientInfoForm from "./components/PatientInfoForm";
import ChatInterface from "./components/ChatInterface";
import AnalysisPage from "./components/AnalysisPage";
import SummaryPage from "./components/SummaryPage";
import { MedicalRecordAnalysis } from "./services/gpt-common";
import { ConversationLog } from "./components/ChatInterface";
import { USE_BIRTHDATE_VERSION } from "./config/patient-info";


export interface PatientInfo {
  name: string;
  gender: string;
  age: string; // 만 나이 (USE_BIRTHDATE_VERSION이 false일 때 사용)
  birthYear?: string; // 생년월일 (USE_BIRTHDATE_VERSION이 true일 때 사용)
  birthMonth?: string;
  birthDay?: string;
}

function App() {
  const [medicalRecord, setMedicalRecord] = useState<File | null>(null);
  const [medicalRecordId, setMedicalRecordId] = useState<string | null>(null);
  const [medicalRecordAnalysis, setMedicalRecordAnalysis] =
    useState<MedicalRecordAnalysis | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [conversationLog, setConversationLog] = useState<ConversationLog | null>(null);

  const handleUploadComplete = (
    file: File | null,
    recordId: string | null,
    analysis?: MedicalRecordAnalysis
  ) => {
    setMedicalRecord(file);
    setMedicalRecordId(recordId);
    if (analysis) {
      setMedicalRecordAnalysis(analysis);
    }
  };

  const handlePatientInfoSubmit = (info: PatientInfo) => {
    // 로컬 상태로만 관리
    const newPatientId = `patient-${Date.now()}`;
    setPatientInfo(info);
    setPatientId(newPatientId);

    // 환자 정보 입력 시 대화 로그 JSON 파일 초기화
    if (medicalRecordId) {
      // 이름을 제외한 환자 정보
      const { name, ...patientInfoWithoutName } = info;
      const initialLog: ConversationLog = {
        patientInfo: patientInfoWithoutName,
        medicalRecordId: medicalRecordId,
        sessionId: `session-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        startTime: new Date().toISOString(),
        conversations: {},
        medicalRecordAnalysis: medicalRecordAnalysis || undefined,
      };

      // 로컬 스토리지에 초기 로그 저장
      let storageKey: string;
      if (USE_BIRTHDATE_VERSION && info.birthYear && info.birthMonth && info.birthDay) {
        const birthDate = `${info.birthYear}-${info.birthMonth.padStart(2, '0')}-${info.birthDay.padStart(2, '0')}`;
        storageKey = `conversation_log_${birthDate}_${medicalRecordId}`;
      } else {
        storageKey = `conversation_log_age${info.age}_${medicalRecordId}`;
      }
      localStorage.setItem(storageKey, JSON.stringify(initialLog));
    }

    setShowChat(true);
  };

  const handleConversationComplete = (log: ConversationLog) => {
    setConversationLog(log);
    setShowChat(false);
    setShowAnalysis(true); // Analysis 페이지를 먼저 표시
  };

  const handleAnalysisComplete = () => {
    // 분석 완료 후 Summary 페이지로 이동
    setShowAnalysis(false);
    setShowSummary(true);
  };

  const handleSummaryComplete = () => {
    // 요약 완료 후 초기화 (새로운 문진 시작 가능)
    setShowSummary(false);
    setShowChat(false);
    setMedicalRecord(null);
    setMedicalRecordId(null);
    setMedicalRecordAnalysis(null);
    setPatientInfo(null);
    setPatientId(null);
    setConversationLog(null);
  };

  // 개발 중: Summary 페이지만 표시
  // return <SummaryPage onComplete={handleSummaryComplete} />;

  // 1단계: 진료 기록 업로드 및 분석
  if (!medicalRecordId) {
    return <MedicalRecordUpload onUploadComplete={handleUploadComplete} />;
  }

  // 5단계: 요약 페이지 (conversation log가 있을 때만) - 가장 높은 우선순위
  if (showSummary && conversationLog) {
    return (
      <SummaryPage
        conversationLog={conversationLog}
        onComplete={handleSummaryComplete}
      />
    );
  }

  // 4단계: 분석 중 페이지 (챗봇 완료 후)
  if (showAnalysis && patientInfo) {
    return (
      <AnalysisPage
        patientInfo={patientInfo}
        onComplete={handleAnalysisComplete}
      />
    );
  }

  // 3단계: 챗봇 인터페이스
  if (showChat && !showSummary) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <ChatInterface
          patientInfo={patientInfo!}
          medicalRecord={medicalRecord}
          patientId={patientId!}
          medicalRecordId={medicalRecordId!}
          medicalRecordAnalysis={medicalRecordAnalysis}
          onConversationComplete={handleConversationComplete}
        />
      </div>
    );
  }

  // 2단계: 환자 정보 입력 (showChat이 false이고 다른 페이지가 표시되지 않을 때만)
  return <PatientInfoForm onSubmit={handlePatientInfoSubmit} />;

  return null;
}

export default App;
