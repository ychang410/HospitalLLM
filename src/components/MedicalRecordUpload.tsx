import { useState } from 'react';
import { analyzeMedicalRecord } from '../services/gpt-analyze';
import { MedicalRecordAnalysis } from '../services/gpt-common';
import { determineBodyPartForSymptom } from '../services/gpt-body-part';
import { BodyPart } from '../components/HumanModel/HumanModel3D';

interface MedicalRecordUploadProps {
  onUploadComplete: (file: File | null, recordId: string | null, analysis?: MedicalRecordAnalysis) => void;
}

export default function MedicalRecordUpload({ onUploadComplete }: MedicalRecordUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCalculatingBodyParts, setIsCalculatingBodyParts] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [medicalRecordId, setMedicalRecordId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MedicalRecordAnalysis | null>(null);
  const [editableAnalysis, setEditableAnalysis] = useState<MedicalRecordAnalysis | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // BodyPart 선택 옵션 (한국어 라벨 포함)
  const bodyPartLabels: Record<BodyPart, string> = {
    head: '머리',
    neck: '목',
    shoulder: '어깨',
    arm: '팔',
    elbow: '팔꿈치',
    wrist: '손목',
    hand: '손',
    chest: '가슴',
    abdomen: '배/복부',
    back: '등',
    lower_back: '허리',
    hip: '엉덩이/골반',
    leg: '다리',
    thigh: '허벅지',
    knee: '무릎',
    ankle: '발목',
    foot: '발',
  };

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

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    
    // 로컬에서만 처리 - 임시 ID 생성
    const recordId = `record-${Date.now()}`;
    setMedicalRecordId(recordId);
    
    // 업로드 시뮬레이션
    setTimeout(async () => {
      setIsUploading(false);
      setIsAnalyzing(true);
      
      try {
        // GPT를 사용한 진료 기록 분석
        const analysis = await analyzeMedicalRecord(selectedFile);
        console.log('진료 기록 분석 결과:', analysis);
        
        setIsAnalyzing(false);
        setIsCalculatingBodyParts(true);
        
        // 각 증상에 대해 bodyPart 계산
        const updatedSymptoms = await Promise.all(
          analysis.symptoms.map(async (symptom) => {
            try {
              const bodyPart = await determineBodyPartForSymptom(
                symptom.name,
                analysis.mainDiagnosis
              );
              return { ...symptom, bodyPart };
            } catch (error) {
              console.error(`증상 "${symptom.name}"의 bodyPart 계산 실패:`, error);
              return symptom; // 오류 발생 시 원본 유지
            }
          })
        );

        // otherSymptoms에 대해서도 bodyPart 계산
        const updatedOtherSymptoms = await Promise.all(
          analysis.otherSymptoms.map(async (otherSymptom) => {
            try {
              const bodyPart = await determineBodyPartForSymptom(
                otherSymptom.name,
                analysis.mainDiagnosis
              );
              return { ...otherSymptom, bodyPart };
            } catch (error) {
              console.error(`기타 증상 "${otherSymptom.name}"의 bodyPart 계산 실패:`, error);
              return otherSymptom; // 오류 발생 시 원본 유지
            }
          })
        );

        // bodyPart가 계산된 분석 결과 저장
        const finalAnalysis = {
          ...analysis,
          symptoms: updatedSymptoms,
          otherSymptoms: updatedOtherSymptoms,
        };
        
        setAnalysisResult(finalAnalysis);
        setEditableAnalysis(JSON.parse(JSON.stringify(finalAnalysis))); // 깊은 복사
        console.log('bodyPart 계산 완료:', finalAnalysis);
        
        setIsCalculatingBodyParts(false);
        setAnalysisComplete(true);
      } catch (error: any) {
        console.error('진료 기록 분석 오류:', error);
        alert(`분석 중 오류가 발생했습니다: ${error.message}`);
        setIsAnalyzing(false);
        setIsCalculatingBodyParts(false);
        setIsUploading(false);
      }
    }, 500);
  };

  const handleStudyStart = () => {
    // 편집된 결과가 있으면 그것을 사용, 없으면 원본 사용
    const finalAnalysis = editableAnalysis || analysisResult;
    onUploadComplete(selectedFile, medicalRecordId, finalAnalysis || undefined);
  };

  const handleSaveChanges = async () => {
    if (!editableAnalysis) return;
    
    // 편집된 otherSymptoms의 바디 파트를 다시 계산
    setIsCalculatingBodyParts(true);
    
    try {
      const updatedOtherSymptoms = await Promise.all(
        editableAnalysis.otherSymptoms.map(async (otherSymptom) => {
          // 증상명이 비어있으면 스킵
          if (!otherSymptom.name || otherSymptom.name.trim() === '') {
            return otherSymptom;
          }
          
          try {
            const bodyPart = await determineBodyPartForSymptom(
              otherSymptom.name,
              editableAnalysis.mainDiagnosis
            );
            return { ...otherSymptom, bodyPart };
          } catch (error) {
            console.error(`기타 증상 "${otherSymptom.name}"의 bodyPart 계산 실패:`, error);
            return otherSymptom; // 오류 발생 시 원본 유지
          }
        })
      );

      // 바디 파트가 계산된 분석 결과로 업데이트
      const updatedAnalysis = {
        ...editableAnalysis,
        otherSymptoms: updatedOtherSymptoms,
      };
      
      setEditableAnalysis(updatedAnalysis);
      setAnalysisResult(updatedAnalysis); // 원본도 업데이트
      
      // 분석 결과를 로컬 파일로 저장
      const analysisJson = JSON.stringify(updatedAnalysis, null, 2);
      const blob = new Blob([analysisJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `medical_record_analysis_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setIsCalculatingBodyParts(false);
      setIsEditing(false);
    } catch (error) {
      console.error('바디 파트 계산 오류:', error);
      setIsCalculatingBodyParts(false);
      alert('바디 파트 계산 중 오류가 발생했습니다.');
    }
  };

  const handleCancelEdit = () => {
    // 원본으로 되돌리기
    if (analysisResult) {
      setEditableAnalysis(JSON.parse(JSON.stringify(analysisResult)));
    }
    setIsEditing(false);
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
          {analysisComplete && editableAnalysis ? (
            <div className="w-full h-full overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-black">분석 결과 확인 및 수정</h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    편집
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveChanges}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      저장
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>

              {/* 주요 진단명 */}
              <div className="mb-6">
                <label className="block text-xl font-semibold mb-2">주요 진단명</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editableAnalysis.mainDiagnosis}
                    onChange={(e) => setEditableAnalysis({
                      ...editableAnalysis,
                      mainDiagnosis: e.target.value
                    })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xl bg-white"
                  />
                ) : (
                  <div className="px-2 py-1.5 bg-white rounded-lg text-xl border border-gray-200">{editableAnalysis.mainDiagnosis}</div>
                )}
              </div>

              {/* 주요 증상들 */}
              <div className="mb-6">
                <label className="block text-xl font-semibold mb-2">주요 증상</label>
                <div className="space-y-3">
                  {editableAnalysis.symptoms.map((symptom, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4 mb-2">
                        <div>
                          <label className="block text-base font-medium mb-1">증상명</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={symptom.name}
                              onChange={(e) => {
                                const updated = { ...editableAnalysis };
                                updated.symptoms[index].name = e.target.value;
                                setEditableAnalysis(updated);
                              }}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-base bg-white"
                            />
                          ) : (
                            <div className="px-2 py-1.5 bg-white rounded-lg text-base border border-gray-200">{symptom.name}</div>
                          )}
                        </div>
                        <div>
                          <label className="block text-base font-medium mb-1">신체 부위</label>
                          {isEditing ? (
                            <select
                              value={symptom.bodyPart || ''}
                              onChange={(e) => {
                                const updated = { ...editableAnalysis };
                                updated.symptoms[index].bodyPart = e.target.value as BodyPart;
                                setEditableAnalysis(updated);
                              }}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-base bg-white"
                            >
                              <option value="">선택 안 함</option>
                              {(Object.keys(bodyPartLabels) as BodyPart[]).map((bp) => (
                                <option key={bp} value={bp}>{bodyPartLabels[bp]}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="px-2 py-1.5 bg-white rounded-lg text-base border border-gray-200">
                              {symptom.bodyPart ? bodyPartLabels[symptom.bodyPart] : '미설정'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={symptom.mentioned}
                            onChange={(e) => {
                              const updated = { ...editableAnalysis };
                              updated.symptoms[index].mentioned = e.target.checked;
                              setEditableAnalysis(updated);
                            }}
                            disabled={!isEditing}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">진료 기록에서 언급됨</span>
                        </label>
                        {symptom.mentioned && (
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={symptom.present}
                              onChange={(e) => {
                                const updated = { ...editableAnalysis };
                                updated.symptoms[index].present = e.target.checked;
                                setEditableAnalysis(updated);
                              }}
                              disabled={!isEditing}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">증상 있음</span>
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 기타 증상들 */}
              <div className="mb-6">
                <label className="block text-xl font-semibold mb-2">기타 증상</label>
                <div className="space-y-2">
                  {editableAnalysis.otherSymptoms.map((symptom, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={symptom.name}
                            onChange={(e) => {
                              const updated = { ...editableAnalysis };
                              updated.otherSymptoms[index].name = e.target.value;
                              setEditableAnalysis(updated);
                            }}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-base bg-white"
                          />
                          <button
                            onClick={() => {
                              const updated = { ...editableAnalysis };
                              updated.otherSymptoms.splice(index, 1);
                              setEditableAnalysis(updated);
                            }}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-base"
                          >
                            삭제
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 px-2 py-1.5 bg-white rounded-lg text-base border border-gray-200">{symptom.name}</div>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <button
                      onClick={() => {
                        const updated = { ...editableAnalysis };
                        updated.otherSymptoms.push({ name: '', mentioned: true });
                        setEditableAnalysis(updated);
                      }}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                    >
                      + 추가
                    </button>
                  )}
                </div>
              </div>

              {/* 검사 목록 */}
              <div className="mb-6">
                <label className="block text-xl font-semibold mb-2">검사</label>
                <div className="space-y-2">
                  {editableAnalysis.examinations.map((exam, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={exam.name}
                            onChange={(e) => {
                              const updated = { ...editableAnalysis };
                              updated.examinations[index].name = e.target.value;
                              setEditableAnalysis(updated);
                            }}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-base bg-white"
                          />
                          <button
                            onClick={() => {
                              const updated = { ...editableAnalysis };
                              updated.examinations.splice(index, 1);
                              setEditableAnalysis(updated);
                            }}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-base"
                          >
                            삭제
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 px-2 py-1.5 bg-white rounded-lg text-base border border-gray-200">{exam.name}</div>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <button
                      onClick={() => {
                        const updated = { ...editableAnalysis };
                        updated.examinations.push({ name: '' });
                        setEditableAnalysis(updated);
                      }}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-base"
                    >
                      + 추가
                    </button>
                  )}
                </div>
              </div>

              {/* 약물 목록 */}
              <div className="mb-6">
                <label className="block text-xl font-semibold mb-2">약물</label>
                <div className="space-y-2">
                  {editableAnalysis.medications.map((med, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={med.name}
                            onChange={(e) => {
                              const updated = { ...editableAnalysis };
                              updated.medications[index].name = e.target.value;
                              setEditableAnalysis(updated);
                            }}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-base bg-white"
                          />
                          <button
                            onClick={() => {
                              const updated = { ...editableAnalysis };
                              updated.medications.splice(index, 1);
                              setEditableAnalysis(updated);
                            }}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-base"
                          >
                            삭제
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 px-2 py-1.5 bg-white rounded-lg text-base border border-gray-200">{med.name}</div>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <button
                      onClick={() => {
                        const updated = { ...editableAnalysis };
                        updated.medications.push({ name: '' });
                        setEditableAnalysis(updated);
                      }}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-base"
                    >
                      + 추가
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : isCalculatingBodyParts ? (
            <>
              <div className="text-black text-3xl font-normal font-inter mb-4">
                신체 부위를 분석 중입니다...
              </div>
              <div className="text-black text-xl font-normal font-inter text-gray-600">
                잠시만 기다려주세요.
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
          disabled={isEditing}
          className={`absolute left-[1050px] top-[752px] w-40 h-14 transition-colors flex items-center justify-center ${
            isEditing
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-white hover:bg-gray-50 cursor-pointer'
          }`}
        >
          <span className={`text-2xl font-normal font-inter ${
            isEditing ? 'text-gray-400' : 'text-black'
          }`}>
            Study Start →
          </span>
        </button>
      ) : (
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || isAnalyzing || isCalculatingBodyParts}
          className={`absolute left-[1127px] top-[752px] w-28 h-14 transition-colors cursor-pointer flex items-center justify-center ${
            selectedFile && !isUploading && !isAnalyzing && !isCalculatingBodyParts
              ? 'bg-white hover:bg-gray-50'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <span className={`text-2xl font-normal font-inter ${
            selectedFile && !isUploading && !isAnalyzing && !isCalculatingBodyParts ? 'text-black' : 'text-gray-400'
          }`}>
            {isUploading ? '업로드 중...' : isAnalyzing ? '분석 중...' : isCalculatingBodyParts ? '계산 중...' : '업로드'}
          </span>
        </button>
      )}
    </div>
  );
}

