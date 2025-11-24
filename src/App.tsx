import { useState } from 'react'
import MedicalRecordUpload from './components/MedicalRecordUpload'
import PatientInfoForm from './components/PatientInfoForm'
import ChatInterface from './components/ChatInterface'
import AnalysisPage from './components/AnalysisPage'
import { MedicalRecordAnalysis } from './services/gpt-common'
import { ConversationLog } from './components/ChatInterface'

export interface PatientInfo {
  name: string;
  gender: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  phone: string;
}

function App() {
  const [medicalRecord, setMedicalRecord] = useState<File | null>(null);
  const [medicalRecordId, setMedicalRecordId] = useState<string | null>(null);
  const [medicalRecordAnalysis, setMedicalRecordAnalysis] = useState<MedicalRecordAnalysis | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleUploadComplete = (file: File | null, recordId: string | null, analysis?: MedicalRecordAnalysis) => {
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
      const initialLog: ConversationLog = {
        patientInfo: info,
        medicalRecordId: medicalRecordId,
        sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        startTime: new Date().toISOString(),
        conversations: {},
        medicalRecordAnalysis: medicalRecordAnalysis || undefined,
      };
      
      // 로컬 스토리지에 초기 로그 저장
      const storageKey = `conversation_log_${newPatientId}_${medicalRecordId}`;
      localStorage.setItem(storageKey, JSON.stringify(initialLog));
    }
    
    setShowChat(true);
  };

  const handleConversationComplete = () => {
    setShowChat(false);
    setShowAnalysis(true);
  };

  const handleAnalysisComplete = () => {
    // 분석 완료 후 초기화 (새로운 문진 시작 가능)
    setShowAnalysis(false);
    setShowChat(false);
    setMedicalRecord(null);
    setMedicalRecordId(null);
    setMedicalRecordAnalysis(null);
    setPatientInfo(null);
    setPatientId(null);
  };

  // 1단계: 진료 기록 업로드 및 분석
  if (!medicalRecordId) {
    return <MedicalRecordUpload onUploadComplete={handleUploadComplete} />;
  }

  // 2단계: 환자 정보 입력
  if (!showChat) {
    return <PatientInfoForm onSubmit={handlePatientInfoSubmit} />;
  }

  // 3단계: 챗봇 인터페이스
  if (showChat) {
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

  // 4단계: 분석 중 페이지
  if (showAnalysis && patientInfo) {
    return <AnalysisPage patientInfo={patientInfo} onComplete={handleAnalysisComplete} />;
  }

  return null;
}

export default App

