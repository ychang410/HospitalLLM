import { useEffect, useMemo, useState } from "react";
import { ConversationLog } from "./ChatInterface";
import {
  generateSummary,
  StructuredSummary,
  SymptomStatusItem,
} from "../services/gpt-summary";
import HumanModel3D, {
  BodyPart,
  SymptomStatus,
} from "./HumanModel/HumanModel3D";
import DoctorPage from "./DoctorPage";

interface SummaryPageProps {
  conversationLog?: ConversationLog; // conversation log를 props로 받음
  birthYear?: string; // 기존 로직 유지를 위해 optional로 변경
  birthMonth?: string;
  birthDay?: string;
  medicalRecordId?: string;
  onComplete?: () => void;
}

type SymptomCategory =
  | "mainDiagnosisSymptoms"
  | "knownSymptoms"
  | "newSymptoms";

interface SymptomItemWithCategory extends SymptomStatusItem {
  category: SymptomCategory;
  originalIndex: number;
}

type EditingState =
  | {
      type: "symptom";
      category: SymptomCategory;
      index: number;
      symptom: string;
      details: string;
    }
  | {
      type: "note";
      index: number;
      text: string;
    }
  | null;

export default function SummaryPage({
  conversationLog: propConversationLog,
  birthYear,
  birthMonth,
  birthDay,
  medicalRecordId,
  onComplete,
}: SummaryPageProps) {
  const [summary, setSummary] = useState<StructuredSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDoctorPage, setShowDoctorPage] = useState(false);
  const [editingState, setEditingState] = useState<EditingState>(null);
  const [conversationLog, setConversationLog] = useState<ConversationLog | null>(null);
  const [showFileInput, setShowFileInput] = useState(false);

  // 파일 선택 핸들러
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const conversationLogData: ConversationLog = JSON.parse(text);
      setConversationLog(conversationLogData);
      
      const generatedSummary = await generateSummary(conversationLogData);
      setSummary(generatedSummary);
      setIsLoading(false);
      setShowFileInput(false);
    } catch (err: any) {
      console.error("파일 읽기 오류:", err);
      setError("파일을 읽는 중 오류가 발생했습니다. 올바른 JSON 파일인지 확인해주세요.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadAndGenerateSummary = async () => {
      // props로 받은 conversation log가 있으면 그것을 사용
      if (propConversationLog) {
        try {
          setConversationLog(propConversationLog);
          const generatedSummary = await generateSummary(propConversationLog);
          setSummary(generatedSummary);
          setIsLoading(false);
        } catch (err: any) {
          console.error("요약 생성 오류:", err);
          setError(err.message || "요약 생성 중 오류가 발생했습니다.");
          setIsLoading(false);
        }
        return;
      }

      // props로 받은 conversation log가 없으면 기존 로직 사용
      try {
        if (!birthYear || !birthMonth || !birthDay || !medicalRecordId) {
          setError("대화 로그가 없습니다.");
          setIsLoading(false);
          return;
        }

        // 먼저 로컬 스토리지에서 시도
        const birthDate = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;
        const storageKey = `conversation_log_${birthDate}_${medicalRecordId}`;
        const storedLog = localStorage.getItem(storageKey);
        
        if (storedLog) {
          const conversationLogData: ConversationLog = JSON.parse(storedLog);
          setConversationLog(conversationLogData);
          
          const generatedSummary = await generateSummary(conversationLogData);
          setSummary(generatedSummary);
          setIsLoading(false);
        } else {
          // 로컬 스토리지에 없으면 파일 선택 다이얼로그 표시
          setShowFileInput(true);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("요약 생성 오류:", err);
        setError(err.message || "요약 생성 중 오류가 발생했습니다.");
        setIsLoading(false);
      }
    };

    loadAndGenerateSummary();
  }, [propConversationLog, birthYear, birthMonth, birthDay, medicalRecordId]);

  // progress 값에 따라 증상을 분류 (카테고리 정보 포함)
  const getSymptomStatusItems = useMemo(() => {
    if (!summary) {
      return {
        worse: [] as SymptomItemWithCategory[],
        same: [] as SymptomItemWithCategory[],
        better: [] as SymptomItemWithCategory[],
        newSymptoms: [] as SymptomItemWithCategory[],
        noSymptom: [] as SymptomItemWithCategory[],
      };
    }

    const worse: SymptomItemWithCategory[] = [];
    const same: SymptomItemWithCategory[] = [];
    const better: SymptomItemWithCategory[] = [];
    const newSymptoms: SymptomItemWithCategory[] = [];
    const noSymptom: SymptomItemWithCategory[] = [];

    // mainDiagnosisSymptoms 처리
    summary.mainDiagnosisSymptoms.forEach((item, index) => {
      const itemWithCategory: SymptomItemWithCategory = {
        ...item,
        category: "mainDiagnosisSymptoms",
        originalIndex: index,
      };
      if (item.progress === "worse") {
        worse.push(itemWithCategory);
      } else if (item.progress === "same") {
        same.push(itemWithCategory);
      } else if (item.progress === "better") {
        better.push(itemWithCategory);
      } else if (item.progress === "new") {
        newSymptoms.push(itemWithCategory);
      } else if (item.progress === "no symptom") {
        noSymptom.push(itemWithCategory);
      }
    });

    // knownSymptoms 처리
    summary.knownSymptoms.forEach((item, index) => {
      const itemWithCategory: SymptomItemWithCategory = {
        ...item,
        category: "knownSymptoms",
        originalIndex: index,
      };
      if (item.progress === "worse") {
        worse.push(itemWithCategory);
      } else if (item.progress === "same") {
        same.push(itemWithCategory);
      } else if (item.progress === "better") {
        better.push(itemWithCategory);
      } else if (item.progress === "new") {
        newSymptoms.push(itemWithCategory);
      } else if (item.progress === "no symptom") {
        noSymptom.push(itemWithCategory);
      }
    });

    // newSymptoms 처리
    summary.newSymptoms.forEach((item, index) => {
      const itemWithCategory: SymptomItemWithCategory = {
        ...item,
        category: "newSymptoms",
        originalIndex: index,
      };
      if (item.progress === "worse") {
        worse.push(itemWithCategory);
      } else if (item.progress === "same") {
        same.push(itemWithCategory);
      } else if (item.progress === "better") {
        better.push(itemWithCategory);
      } else if (item.progress === "new") {
        newSymptoms.push(itemWithCategory);
      } else if (item.progress === "no symptom") {
        noSymptom.push(itemWithCategory);
      }
    });

    return { worse, same, better, newSymptoms, noSymptom };
  }, [summary]);

  const highlightedParts = useMemo(() => {
    if (!summary) return [];
    const combinedItems = [
      ...getSymptomStatusItems.worse,
      ...getSymptomStatusItems.same,
      ...getSymptomStatusItems.better,
      ...getSymptomStatusItems.newSymptoms,
    ];
    const parts = combinedItems
      .map((item) => item.bodyPart)
      .filter((part): part is BodyPart => Boolean(part));
    return Array.from(new Set(parts));
  }, [summary, getSymptomStatusItems]);

  // 각 bodyPart의 상태를 매핑 (우선순위: worse > same > better > new)
  const partStatusMap = useMemo(() => {
    if (!summary) return new Map<BodyPart, SymptomStatus>();
    const map = new Map<BodyPart, SymptomStatus>();

    // worse 상태 추가
    getSymptomStatusItems.worse.forEach((item) => {
      if (item.bodyPart) {
        map.set(item.bodyPart, "worse");
      }
    });

    // same 상태 추가
    getSymptomStatusItems.same.forEach((item) => {
      if (item.bodyPart && !map.has(item.bodyPart)) {
        map.set(item.bodyPart, "same");
      }
    });

    // better 상태 추가
    getSymptomStatusItems.better.forEach((item) => {
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
  }, [summary, getSymptomStatusItems]);

  const handleComplete = () => {
    // 의사용 페이지로 이동
    setShowDoctorPage(true);
  };

  const handleDoctorPageBack = () => {
    // 환자 요약 페이지로 돌아가기
    setShowDoctorPage(false);
  };

  const handleDoctorPageComplete = () => {
    onComplete?.();
  };

  // 증상 항목 삭제
  const handleDeleteSymptom = (item: SymptomItemWithCategory) => {
    if (!summary) return;

    setSummary((prev) => {
      if (!prev) return prev;
      const newSummary = { ...prev };
      // originalIndex를 사용하여 삭제
      newSummary[item.category] = newSummary[item.category].filter(
        (_, index) => index !== item.originalIndex
      );
      return newSummary;
    });
  };

  // 증상 항목 수정 시작
  const handleEditSymptom = (item: SymptomItemWithCategory) => {
    setEditingState({
      type: "symptom",
      category: item.category,
      index: item.originalIndex,
      symptom: item.symptom,
      details: item.details,
    });
  };

  // 증상 항목 수정 저장
  const handleSaveSymptomEdit = () => {
    if (!summary || !editingState || editingState.type !== "symptom") return;

    setSummary((prev) => {
      if (!prev) return prev;
      const newSummary = { ...prev };
      const category = editingState.category;
      const updatedItems = [...newSummary[category]];
      updatedItems[editingState.index] = {
        ...updatedItems[editingState.index],
        symptom: editingState.symptom,
        details: editingState.details,
      };
      newSummary[category] = updatedItems;
      return newSummary;
    });

    setEditingState(null);
  };

  // 증상 항목 수정 취소
  const handleCancelEdit = () => {
    setEditingState(null);
  };

  // Note 삭제
  const handleDeleteNote = (index: number) => {
    if (!summary) return;
    setSummary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notesForDoctor: prev.notesForDoctor.filter((_, i) => i !== index),
      };
    });
  };

  // Note 수정 시작
  const handleEditNote = (index: number, text: string) => {
    setEditingState({
      type: "note",
      index,
      text,
    });
  };

  // Note 수정 저장
  const handleSaveNoteEdit = () => {
    if (!summary || !editingState || editingState.type !== "note") return;

    setSummary((prev) => {
      if (!prev) return prev;
      const updatedNotes = [...prev.notesForDoctor];
      updatedNotes[editingState.index] = editingState.text;
      return {
        ...prev,
        notesForDoctor: updatedNotes,
      };
    });

    setEditingState(null);
  };

  const renderSymptomColumn = (
    title: string,
    items: SymptomItemWithCategory[],
    accent: string,
    emptyText = "해당 내용이 없습니다."
  ) => {
    const isEditing = (item: SymptomItemWithCategory) => {
      if (editingState?.type !== "symptom") return false;
      return (
        item.category === editingState.category &&
        item.originalIndex === editingState.index
      );
    };

    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className={`text-xl font-semibold mb-3 ${accent}`}>{title}</h3>
        {items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((item, index) => {
              const editing = isEditing(item);

              return (
                <li
                  key={`${item.symptom}-${index}`}
                  className="bg-gray-50 rounded-lg p-4 space-y-3"
                >
                  {editing && editingState?.type === "symptom" ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          증상명
                        </label>
                        <input
                          type="text"
                          value={editingState.symptom}
                          onChange={(e) =>
                            setEditingState({
                              ...editingState,
                              symptom: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          상세 설명
                        </label>
                        <textarea
                          value={editingState.details}
                          onChange={(e) =>
                            setEditingState({
                              ...editingState,
                              details: e.target.value,
                            })
                          }
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleCancelEdit}
                          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleSaveSymptomEdit}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {item.symptom}
                          </p>
                          <p className="text-gray-600 text-base leading-relaxed mt-1">
                            {item.details}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSymptom(item)}
                            className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteSymptom(item)}
                            className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-400 text-base">{emptyText}</p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-8">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            문진 내용을 요약중입니다...
          </h2>
          <p className="text-gray-600 text-lg">잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }

  if (showFileInput) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-2xl mx-auto px-4">
          <div className="mb-8">
            <div className="text-blue-500 text-6xl mb-4">📁</div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            대화 로그 파일 선택
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            patient_data 폴더에서 conversation log JSON 파일을 선택해주세요.
          </p>
          <label className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer">
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            파일 선택
          </label>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-2xl mx-auto px-4">
          <div className="mb-8">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            오류가 발생했습니다
          </h2>
          <p className="text-gray-600 text-lg mb-8">{error}</p>
          <button
            onClick={handleComplete}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-600">
          요약 데이터를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  // 의사용 페이지 표시
  if (showDoctorPage && summary && conversationLog) {
    return (
      <DoctorPage
        summary={summary}
        conversationLog={conversationLog}
        onComplete={handleDoctorPageComplete}
        onBack={handleDoctorPageBack}
      />
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto flex gap-8">
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
        <div className="bg-white rounded-xl shadow-lg p-8 w-full">
          {/* <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {conversationLogData.patientInfo?.name || "환자"}님의 문진 요약
            </h1>
            <p className="text-gray-600">
              {conversationLogData.startTime
                ? new Date(conversationLogData.startTime).toLocaleDateString(
                    "ko-KR",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )
                : new Date().toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
            </p>
          </div> */}

          <div className="space-y-6 w-full">
            <div className="flex flex-col gap-4">
              {renderSymptomColumn(
                "증상이 악화되었어요.",
                getSymptomStatusItems.worse,
                "text-red-600",
                "해당 내용이 없습니다."
              )}
              {renderSymptomColumn(
                "증상의 변화가 없어요.",
                getSymptomStatusItems.same,
                "text-yellow-600",
                "해당 내용이 없습니다."
              )}
              {renderSymptomColumn(
                "증상이 나아졌어요.",
                getSymptomStatusItems.better,
                "text-green-600",
                "해당 내용이 없습니다."
              )}
              {renderSymptomColumn(
                "새로운 증상이 생겼어요.",
                getSymptomStatusItems.newSymptoms,
                "text-blue-600",
                "새롭게 보고된 증상이 없습니다."
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  진료 중 전달사항
                </h3>
              </div>
              {summary.notesForDoctor.length > 0 ? (
                <ul className="space-y-4 text-gray-800">
                  {summary.notesForDoctor.map((note, index) => {
                    const isEditing =
                      editingState?.type === "note" &&
                      editingState.index === index;

                    return (
                      <li
                        key={`note-${index}`}
                        className="border border-gray-100 rounded-lg p-4"
                      >
                        {isEditing && editingState.type === "note" ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingState.text}
                              onChange={(e) =>
                                setEditingState({
                                  ...editingState,
                                  text: e.target.value,
                                })
                              }
                              rows={4}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={handleCancelEdit}
                                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                              >
                                취소
                              </button>
                              <button
                                onClick={handleSaveNoteEdit}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                              >
                                저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-gray-700 leading-relaxed flex-1">
                              {note}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditNote(index, note)}
                                className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDeleteNote(index)}
                                className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-gray-400 text-sm">
                  현재 전달할 항목이 없습니다.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-8">
            <button
              onClick={handleComplete}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            >
              완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
