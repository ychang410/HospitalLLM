import { useEffect } from 'react';
import { PatientInfo } from '../App';

interface AnalysisPageProps {
  patientInfo: PatientInfo;
  onComplete?: () => void;
}

export default function AnalysisPage({ patientInfo, onComplete }: AnalysisPageProps) {
  useEffect(() => {
    // 분석 완료 후 자동으로 종료 (3초 후)
    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-8">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          {patientInfo.name}님의 답변을 분석중입니다...
        </h2>
        <p className="text-gray-600 text-lg">
          잠시만 기다려주세요.
        </p>
      </div>
    </div>
  );
}

