import { useEffect, useMemo, useState } from "react";
import { ConversationLog } from "./ChatInterface";
import conversationLogData from "../conversationLogs/conversation_log_김영자_2025-11-25.json";
import {
  generateSummary,
  StructuredSummary,
  SymptomStatusItem,
  SymptomTrend,
} from "../services/gpt-summary";
import HumanModel3D, { BodyPart } from "./HumanModel/HumanModel3D";

const bodyPartLabels: Record<BodyPart, string> = {
  head: "머리",
  neck: "목",
  shoulder: "어깨",
  arm: "팔",
  elbow: "팔꿈치",
  wrist: "손목",
  hand: "손",
  chest: "가슴",
  abdomen: "복부",
  back: "등",
  lower_back: "허리",
  hip: "엉덩이·골반",
  leg: "다리",
  thigh: "허벅지",
  knee: "무릎",
  ankle: "발목",
  foot: "발",
};

interface SummaryPageProps {
  onComplete?: () => void;
}

export default function SummaryPage({ onComplete }: SummaryPageProps) {
  const [summary, setSummary] = useState<StructuredSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSymptom, setEditingSymptom] = useState<{
    section: SymptomTrend | "new";
    index: number;
  } | null>(null);
  const [symptomDraft, setSymptomDraft] = useState<SymptomStatusItem>({
    symptom: "",
    details: "",
    bodyPart: undefined,
  });
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    const loadAndGenerateSummary = async () => {
      try {
        const conversationLog = conversationLogData as ConversationLog;
        const generatedSummary = await generateSummary(conversationLog);
        setSummary(generatedSummary);
      } catch (err: any) {
        console.error("요약 생성 오류:", err);
        setError(err.message || "요약 생성 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    loadAndGenerateSummary();
  }, []);

  const highlightedParts = useMemo(() => {
    if (!summary) return [];
    const combinedItems = [
      ...summary.symptomStatus.worse,
      ...summary.symptomStatus.same,
      ...summary.symptomStatus.better,
      ...summary.newSymptoms,
    ];
    const parts = combinedItems
      .map((item) => item.bodyPart)
      .filter((part): part is BodyPart => Boolean(part));
    return Array.from(new Set(parts));
  }, [summary]);

  const handleComplete = () => {
    onComplete?.();
  };

  const openSymptomEditor = (section: SymptomTrend | "new", index: number) => {
    if (!summary) return;
    const items =
      section === "new" ? summary.newSymptoms : summary.symptomStatus[section];
    const target = items[index];
    if (!target) return;
    setEditingSymptom({ section, index });
    setSymptomDraft({
      symptom: target.symptom,
      details: target.details,
      bodyPart: target.bodyPart ?? undefined,
    });
  };

  const closeSymptomEditor = () => {
    setEditingSymptom(null);
  };

  const saveSymptomEdit = () => {
    if (!editingSymptom) return;
    const sanitized: SymptomStatusItem = {
      symptom: symptomDraft.symptom.trim(),
      details: symptomDraft.details.trim(),
      bodyPart: symptomDraft.bodyPart ?? undefined,
    };

    setSummary((prev) => {
      if (!prev) return prev;

      if (editingSymptom.section === "new") {
        const updatedNewSymptoms = prev.newSymptoms.map((item, idx) =>
          idx === editingSymptom.index ? sanitized : item
        );
        return {
          ...prev,
          newSymptoms: updatedNewSymptoms,
        };
      }

      const trend = editingSymptom.section as SymptomTrend;
      const updatedTrendItems = prev.symptomStatus[trend].map((item, idx) =>
        idx === editingSymptom.index ? sanitized : item
      );

      return {
        ...prev,
        symptomStatus: {
          ...prev.symptomStatus,
          [trend]: updatedTrendItems,
        },
      };
    });

    setEditingSymptom(null);
  };

  const deleteSymptomItem = (section: SymptomTrend | "new", index: number) => {
    setSummary((prev) => {
      if (!prev) return prev;

      if (section === "new") {
        return {
          ...prev,
          newSymptoms: prev.newSymptoms.filter((_, idx) => idx !== index),
        };
      }

      const trend = section as SymptomTrend;
      return {
        ...prev,
        symptomStatus: {
          ...prev.symptomStatus,
          [trend]: prev.symptomStatus[trend].filter((_, idx) => idx !== index),
        },
      };
    });

    if (
      editingSymptom &&
      editingSymptom.section === section &&
      editingSymptom.index === index
    ) {
      setEditingSymptom(null);
    }
  };

  const handleBodyPartSelect = (value: string) => {
    setSymptomDraft((prev) => ({
      ...prev,
      bodyPart: value ? (value as BodyPart) : undefined,
    }));
  };

  const startNoteEdit = (index: number) => {
    if (!summary) return;
    setEditingNoteIndex(index);
    setNoteDraft(summary.notesForDoctor[index] ?? "");
  };

  const cancelNoteEdit = () => {
    setEditingNoteIndex(null);
    setNoteDraft("");
  };

  const saveNoteEdit = () => {
    if (editingNoteIndex === null) return;

    setSummary((prev) => {
      if (!prev) return prev;
      const updatedNotes = prev.notesForDoctor.map((note, idx) =>
        idx === editingNoteIndex ? noteDraft.trim() : note
      );
      return {
        ...prev,
        notesForDoctor: updatedNotes,
      };
    });

    setEditingNoteIndex(null);
    setNoteDraft("");
  };

  const deleteNote = (index: number) => {
    setSummary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notesForDoctor: prev.notesForDoctor.filter((_, idx) => idx !== index),
      };
    });

    if (editingNoteIndex === index) {
      setEditingNoteIndex(null);
      setNoteDraft("");
    }
  };

  const renderSymptomColumn = (
    title: string,
    items:
      | StructuredSummary["symptomStatus"]["worse"]
      | StructuredSummary["newSymptoms"],
    accent: string,
    emptyText = "해당 내용이 없습니다.",
    sectionKey: SymptomTrend | "new"
  ) => (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className={`text-xl font-semibold mb-3 ${accent}`}>{title}</h3>
      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li
              key={`${item.symptom}-${index}`}
              className="bg-gray-50 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-gray-900">{item.symptom}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const isEditing =
                        editingSymptom?.section === sectionKey &&
                        editingSymptom.index === index;
                      if (isEditing) {
                        closeSymptomEditor();
                      } else {
                        openSymptomEditor(sectionKey, index);
                      }
                    }}
                    className="text-sm px-3 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    {editingSymptom?.section === sectionKey &&
                    editingSymptom.index === index
                      ? "취소"
                      : "수정"}
                  </button>
                  <button
                    onClick={() => deleteSymptomItem(sectionKey, index)}
                    className="text-sm px-3 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
              {editingSymptom?.section === sectionKey &&
              editingSymptom.index === index ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
                    value={symptomDraft.symptom}
                    onChange={(e) =>
                      setSymptomDraft((prev) => ({
                        ...prev,
                        symptom: e.target.value,
                      }))
                    }
                    placeholder="증상 이름"
                  />
                  <textarea
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
                    rows={3}
                    value={symptomDraft.details}
                    onChange={(e) =>
                      setSymptomDraft((prev) => ({
                        ...prev,
                        details: e.target.value,
                      }))
                    }
                    placeholder="상세 설명"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={saveSymptomEdit}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-semibold"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 text-base leading-relaxed">
                    {item.details}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400 text-base">{emptyText}</p>
      )}
    </div>
  );

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

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto flex gap-8">
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              신체 부위 표시
            </h2>
          </div>

          <div className="flex-1 min-h-[420px]">
            <div className="w-[240px] h-[420px]">
              <HumanModel3D highlightedParts={highlightedParts} />
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
                summary.symptomStatus.worse,
                "text-red-600",
                "해당 내용이 없습니다.",
                "worse"
              )}
              {renderSymptomColumn(
                "증상의 변화가 없어요.",
                summary.symptomStatus.same,
                "text-yellow-600",
                "해당 내용이 없습니다.",
                "same"
              )}
              {renderSymptomColumn(
                "증상이 나아졌어요.",
                summary.symptomStatus.better,
                "text-green-600",
                "해당 내용이 없습니다.",
                "better"
              )}
              {renderSymptomColumn(
                "새로운 증상이 생겼어요.",
                summary.newSymptoms,
                "text-blue-600",
                "새롭게 보고된 증상이 없습니다.",
                "new"
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  진료 중 전달사항
                </h3>
                <p className="text-gray-500 text-sm">
                  환자가 진료실에서 꼭 전달하거나 상기해야 할 메모입니다.
                </p>
              </div>
              {summary.notesForDoctor.length > 0 ? (
                <ul className="space-y-4 text-gray-800">
                  {summary.notesForDoctor.map((note, index) => {
                    const isEditing = editingNoteIndex === index;
                    return (
                      <li
                        key={`note-${index}`}
                        className="border border-gray-100 rounded-lg p-4"
                      >
                        <div className="flex flex-col gap-2">
                          {isEditing ? (
                            <div className="mt-3 space-y-3">
                              <textarea
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                rows={3}
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="전달하고 싶은 내용을 입력하세요."
                              />
                              <div className="flex justify-end">
                                <button
                                  onClick={saveNoteEdit}
                                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-semibold"
                                >
                                  저장
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 text-gray-700 leading-relaxed">
                              {note}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                isEditing
                                  ? cancelNoteEdit()
                                  : startNoteEdit(index)
                              }
                              className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              {isEditing ? "취소" : "수정"}
                            </button>
                            <button
                              onClick={() => deleteNote(index)}
                              className="text-sm px-3 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
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
