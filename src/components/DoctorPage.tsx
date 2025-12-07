import { useMemo } from "react";
import {
  StructuredSummary,
  SymptomStatusItem,
  SymptomTrend,
} from "../services/gpt-summary";
import { ConversationLog } from "./ChatInterface";
import { MedicalRecordAnalysis } from "../services/gpt-common";
import HumanModel3D, {
  BodyPart,
  SymptomStatus,
} from "./HumanModel/HumanModel3D";

interface DoctorPageProps {
  summary: StructuredSummary;
  conversationLog: ConversationLog;
  onComplete?: () => void;
  onBack?: () => void;
}

export default function DoctorPage({
  summary,
  conversationLog,
  onComplete,
  onBack,
}: DoctorPageProps) {
  const medicalRecordAnalysis = conversationLog.medicalRecordAnalysis;

  if (!medicalRecordAnalysis) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-600">
          진료 기록 분석 데이터를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  const highlightedParts = useMemo(() => {
    if (!summary) return [];
    const combinedItems = [
      ...summary.mainDiagnosisSymptoms,
      ...summary.knownSymptoms,
      ...summary.newSymptoms,
    ];
    const parts = combinedItems
      .map((item) => item.bodyPart)
      .filter((part): part is BodyPart => Boolean(part));
    return Array.from(new Set(parts));
  }, [summary]);

  // progress 값에 따라 증상을 분류
  const symptomStatusItems = useMemo(() => {
    const worse: SymptomStatusItem[] = [];
    const same: SymptomStatusItem[] = [];
    const better: SymptomStatusItem[] = [];
    const newSymptoms: SymptomStatusItem[] = [];
    const noSymptom: SymptomStatusItem[] = [];

    [
      ...summary.mainDiagnosisSymptoms,
      ...summary.knownSymptoms,
      ...summary.newSymptoms,
    ].forEach((item) => {
      if (item.progress === "worse") {
        worse.push(item);
      } else if (item.progress === "same") {
        same.push(item);
      } else if (item.progress === "better") {
        better.push(item);
      } else if (item.progress === "new") {
        newSymptoms.push(item);
      } else if (item.progress === "no symptom") {
        noSymptom.push(item);
      }
    });

    return { worse, same, better, newSymptoms, noSymptom };
  }, [summary]);

  // 각 bodyPart의 상태를 매핑 (우선순위: worse > same > better > new)
  const partStatusMap = useMemo(() => {
    if (!summary) return new Map<BodyPart, SymptomStatus>();
    const map = new Map<BodyPart, SymptomStatus>();

    // worse 상태 추가
    symptomStatusItems.worse.forEach((item) => {
      if (item.bodyPart) {
        map.set(item.bodyPart, "worse");
      }
    });

    // same 상태 추가
    symptomStatusItems.same.forEach((item) => {
      if (item.bodyPart && !map.has(item.bodyPart)) {
        map.set(item.bodyPart, "same");
      }
    });

    // better 상태 추가
    symptomStatusItems.better.forEach((item) => {
      if (item.bodyPart && !map.has(item.bodyPart)) {
        map.set(item.bodyPart, "better");
      }
    });

    // new 상태 추가
    summary.newSymptoms.forEach((item) => {
      if (item.bodyPart && !map.has(item.bodyPart)) {
        map.set(item.bodyPart, "new");
      }
    });

    return map;
  }, [summary, symptomStatusItems]);

  // 주요 진단 관련 증상들의 경과를 요약 데이터에서 찾기
  const mainDiagnosisSymptoms = useMemo(() => {
    if (!medicalRecordAnalysis.symptoms) return [];

    return medicalRecordAnalysis.symptoms.map((symptom) => symptom.name);
  }, [summary, medicalRecordAnalysis]);

  // 다른 증상들의 경과를 요약 데이터에서 찾기
  const otherSymptoms = useMemo(() => {
    if (!medicalRecordAnalysis.otherSymptoms) return [];

    return medicalRecordAnalysis.otherSymptoms
      .filter((symptom) => symptom.mentioned)
      .map((symptom) => {
        // 요약 데이터에서 해당 증상 찾기
        const matchedItem =
          summary.knownSymptoms.find((item) => item.symptom === symptom.name) ||
          summary.newSymptoms.find((item) => item.symptom === symptom.name);

        return {
          name: symptom.name,
          bodyPart: symptom.bodyPart,
          status: (matchedItem?.progress || "not_found") as
            | SymptomTrend
            | "not_found",
          details: matchedItem?.details || "",
        };
      });
  }, [summary, medicalRecordAnalysis]);

  const getStatusLabel = (status: SymptomTrend | "not_found") => {
    switch (status) {
      case "worse":
        return "악화";
      case "same":
        return "변화 없음";
      case "better":
        return "개선";
      case "new":
        return "신규";
      case "no symptom":
        return "증상 없음";
      case "not_found":
        return "언급 없음";
      default:
        return "";
    }
  };

  const getStatusColor = (status: SymptomTrend | "not_found") => {
    switch (status) {
      case "worse":
        return "text-red-600 bg-red-50 border-red-200";
      case "same":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "better":
        return "text-green-600 bg-green-50 border-green-200";
      case "new":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "no symptom":
        return "text-gray-600 bg-gray-50 border-gray-200";
      case "not_found":
        return "text-gray-400 bg-gray-50 border-gray-200";
      default:
        return "";
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto flex gap-8">
        {/* 주요 진단 관련 증상 */}
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col gap-10 w-[400px] overflow-hidden self-start sticky top-6">
          <h2 className="text-2xl font-semibold text-gray-800">
            신체 부위 표시
          </h2>
          <div className="w-[240px] aspect-[240/420]">
            <HumanModel3D
              highlightedParts={highlightedParts}
              partStatusMap={partStatusMap}
            />
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-sm text-gray-700">악화증상</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-gray-700">증상 변화 없음</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-700">나아졌음</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-700">
                새로운 증상이 생겼음
              </span>
            </div>
          </div>
        </div>
        <div className="w-full">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              {medicalRecordAnalysis.mainDiagnosis} 관련 증상 경과
            </h2>
            {mainDiagnosisSymptoms.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {summary.mainDiagnosisSymptoms.map((symptom, index) => (
                  <div
                    key={`main-${index}`}
                    className={`border rounded-lg p-4 ${getStatusColor(
                      symptom.progress ?? "not_found"
                    )}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">
                        {symptom.symptom}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          symptom.progress === "worse"
                            ? "bg-red-100 text-red-700"
                            : symptom.progress === "same"
                            ? "bg-yellow-100 text-yellow-700"
                            : symptom.progress === "better"
                            ? "bg-green-100 text-green-700"
                            : symptom.progress === "new"
                            ? "bg-blue-100 text-blue-700"
                            : symptom.progress === "no symptom"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {getStatusLabel(symptom.progress ?? "not_found")}
                      </span>
                    </div>
                    {symptom.details && (
                      <p className="text-gray-700 mt-2 leading-relaxed">
                        {symptom.details ?? ""}
                      </p>
                    )}
                    {symptom.progress === "no symptom" && (
                      <p className="text-gray-600 text-sm mt-2">
                        현재 해당 증상이 없다고 보고되었습니다.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">주요 진단 관련 증상이 없습니다.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 다른 증상 경과 */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                다른 증상 경과
              </h2>
              {otherSymptoms.length > 0 ? (
                <div className="space-y-4">
                  {otherSymptoms.map((symptom, index) => (
                    <div
                      key={`other-${index}`}
                      className={`border rounded-lg p-4 ${getStatusColor(
                        symptom.status
                      )}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">
                          {symptom.name}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            symptom.status === "worse"
                              ? "bg-red-100 text-red-700"
                              : symptom.status === "same"
                              ? "bg-yellow-100 text-yellow-700"
                              : symptom.status === "better"
                              ? "bg-green-100 text-green-700"
                              : symptom.status === "new"
                              ? "bg-blue-100 text-blue-700"
                              : symptom.status === "no symptom"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {getStatusLabel(symptom.status)}
                        </span>
                      </div>
                      {symptom.details && (
                        <p className="text-gray-700 mt-2 leading-relaxed">
                          {symptom.details}
                        </p>
                      )}
                      {symptom.status === "not_found" && (
                        <p className="text-gray-500 text-sm mt-2">
                          이번 문진에서 언급되지 않았습니다.
                        </p>
                      )}
                      {symptom.status === "no symptom" && (
                        <p className="text-gray-600 text-sm mt-2">
                          현재 해당 증상이 없다고 보고되었습니다.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">다른 증상이 없습니다.</p>
              )}
            </div>

            {/* 새로운 증상 */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                그 외 새로운 증상
              </h2>
              {summary.newSymptoms.length > 0 ? (
                <div className="space-y-4">
                  {summary.newSymptoms.map((symptom, index) => (
                    <div
                      key={`new-${index}`}
                      className="border border-blue-200 rounded-lg p-4 bg-blue-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg text-blue-900">
                          {symptom.symptom}
                        </h3>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                          신규
                        </span>
                      </div>
                      {symptom.details && (
                        <p className="text-gray-700 mt-2 leading-relaxed">
                          {symptom.details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">그 외 새로운 증상이 없습니다.</p>
              )}
            </div>
          </div>

          {/* 완료 버튼 */}
          <div className="flex justify-end gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold"
              >
                돌아가기
              </button>
            )}
            <button
              onClick={onComplete}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            >
              완료
            </button>
          </div>
        </div>

        {/* 진료 중 전달사항 */}
        {/* {summary.notesForDoctor.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              진료 중 전달사항
            </h2>
            <ul className="space-y-3">
              {summary.notesForDoctor.map((note, index) => (
                <li
                  key={`note-${index}`}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <p className="text-gray-700 leading-relaxed">{note}</p>
                </li>
              ))}
            </ul>
          </div>
        )} */}
      </div>
    </div>
  );
}
