import { useState } from 'react'
import MedicalRecordUpload from './components/MedicalRecordUpload'
import PatientInfoForm from './components/PatientInfoForm'
import ChatInterface from './components/ChatInterface'
import { MedicalRecordAnalysis } from './services/gpt'

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

  const handleUploadComplete = (file: File | null, recordId: string | null, analysis?: MedicalRecordAnalysis) => {
    setMedicalRecord(file);
    setMedicalRecordId(recordId);
    if (analysis) {
      setMedicalRecordAnalysis(analysis);
    }
  };

  const handlePatientInfoSubmit = (info: PatientInfo) => {
    // 로컬 상태로만 관리
    setPatientInfo(info);
    setPatientId(`patient-${Date.now()}`); // 임시 ID 생성
    setShowChat(true);
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
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-50">
      <ChatInterface 
        patientInfo={patientInfo!} 
        medicalRecord={medicalRecord}
        patientId={patientId!}
        medicalRecordId={medicalRecordId!}
        medicalRecordAnalysis={medicalRecordAnalysis}
      />
    </div>
  );
}

export default App

