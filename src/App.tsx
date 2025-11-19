import { useState } from 'react'
import PatientInfoForm from './components/PatientInfoForm'
import ChatInterface from './components/ChatInterface'

export interface PatientInfo {
  name: string;
  gender: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  phone: string;
}

function App() {
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [showChat, setShowChat] = useState(false);

  const handlePatientInfoSubmit = (info: PatientInfo) => {
    setPatientInfo(info);
    setShowChat(true);
  };

  if (!showChat) {
    return <PatientInfoForm onSubmit={handlePatientInfoSubmit} />;
  }

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-50">
      <ChatInterface patientInfo={patientInfo!} />
    </div>
  );
}

export default App

