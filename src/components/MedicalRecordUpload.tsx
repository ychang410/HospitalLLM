import { useState } from 'react';

interface MedicalRecordUploadProps {
  onUploadComplete: (file: File | null, recordId: string | null) => void;
}

export default function MedicalRecordUpload({ onUploadComplete }: MedicalRecordUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [medicalRecordId, setMedicalRecordId] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    setIsUploading(true);
    
    // 로컬에서만 처리 - 임시 ID 생성
    const recordId = `record-${Date.now()}`;
    setMedicalRecordId(recordId);
    
    // 업로드 시뮬레이션
    setTimeout(() => {
      setIsUploading(false);
      setIsAnalyzing(true);
      
      // LLM 분석 시뮬레이션 (2초 대기)
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisComplete(true);
      }, 2000);
    }, 500);
  };

  const handleStudyStart = () => {
    onUploadComplete(selectedFile, medicalRecordId);
  };

  return (
    <div className="w-[1366px] h-[1024px] relative bg-white overflow-hidden mx-auto">
      {/* 안내 문구 */}
      <div className="absolute left-[201px] top-[171px] w-[964px] text-center text-black text-3xl font-normal font-inter">
        환자의 진료 기록 데이터를 업로드해주세요.
      </div>

      {/* 업로드 영역 */}
      <div className="w-[1223px] h-[617px] left-[71px] top-[237px] absolute bg-white rounded-2xl border border-custom-gray">
        <div
          className={`w-full h-full flex flex-col items-center justify-center gap-6 p-8 transition-colors ${
            dragActive ? 'bg-blue-50' : 'bg-custom-light-gray'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {analysisComplete ? (
            <>
              <div className="text-black text-3xl font-normal font-inter mb-4">
                분석이 완료되었습니다.
              </div>
              <div className="text-black text-xl font-normal font-inter text-gray-600 mb-4">
                진료 기록 분석이 완료되었습니다. 이제 연구를 시작할 수 있습니다.
              </div>
            </>
          ) : isAnalyzing ? (
            <>
              <div className="text-black text-3xl font-normal font-inter mb-4">
                진료 기록을 분석 중입니다...
              </div>
              <div className="text-black text-xl font-normal font-inter text-gray-600">
                잠시만 기다려주세요.
              </div>
            </>
          ) : selectedFile ? (
            <>
              <div className="text-black text-2xl font-normal font-inter">
                선택된 파일: {selectedFile.name}
              </div>
              <div className="text-black text-xl font-normal font-inter text-gray-600">
                파일 크기: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setAnalysisComplete(false);
                  setMedicalRecordId(null);
                }}
                className="px-6 py-3 bg-gray-200 text-black text-xl font-normal font-inter rounded-lg hover:bg-gray-300 transition-colors"
              >
                파일 변경
              </button>
            </>
          ) : (
            <>
              <div className="text-black text-3xl font-normal font-inter mb-4">
                파일을 드래그하거나 클릭하여 선택하세요
              </div>
              <div className="text-black text-xl font-normal font-inter text-gray-600 mb-4">
                지원 형식: 동영상 (mp4, avi, mov), 텍스트 (txt, pdf, docx)
              </div>
              <label className="px-8 py-4 bg-white border-2 border-dashed border-gray-400 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <span className="text-black text-xl font-normal font-inter">파일 선택</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleChange}
                  accept=".mp4,.avi,.mov,.txt,.pdf,.docx"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* 버튼 */}
      {analysisComplete ? (
        <button
          onClick={handleStudyStart}
          className="absolute left-[1050px] top-[752px] w-40 h-14 bg-white hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center"
        >
          <span className="text-black text-2xl font-normal font-inter">
            Study Start →
          </span>
        </button>
      ) : (
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || isAnalyzing}
          className={`absolute left-[1127px] top-[752px] w-28 h-14 transition-colors cursor-pointer flex items-center justify-center ${
            selectedFile && !isUploading && !isAnalyzing
              ? 'bg-white hover:bg-gray-50'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <span className={`text-2xl font-normal font-inter ${
            selectedFile && !isUploading && !isAnalyzing ? 'text-black' : 'text-gray-400'
          }`}>
            {isUploading ? '업로드 중...' : isAnalyzing ? '분석 중...' : '업로드'}
          </span>
        </button>
      )}
    </div>
  );
}

