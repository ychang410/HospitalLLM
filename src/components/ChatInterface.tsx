import { useState, useEffect, useRef, useMemo } from 'react';
import { PatientInfo } from '../App';
import ChatHeader from './Chat/ChatHeader';
import MessageBubble from './Chat/MessageBubble';
import ChatInput from './Chat/ChatInput';
import HumanModel3D from './HumanModel/HumanModel3D';
import scripts from '../data/scripts.json';
import { MedicalRecordAnalysis } from '../services/gpt';

interface ChatInterfaceProps {
  patientInfo: PatientInfo;
  medicalRecord: File | null;
  patientId: string;
  medicalRecordId: string;
  medicalRecordAnalysis: MedicalRecordAnalysis | null;
}

export type Category = 'main_diagnosis' | 'new_pain' | 'side_effects' | 'additional_questions';

export type MainDiagnosisSubSection = 'diagnosis_a' | 'diagnosis_b' | 'diagnosis_c' | 'examination';

export type NewPainSubSection = 'other_pain' | 'new_pain';
export type SideEffectSubSection = 'medication';
export type AdditionalSubSection = 'additional_question';

export const categoryOrder: Category[] = ['main_diagnosis', 'new_pain', 'side_effects', 'additional_questions'];

export const newPainSubSections: { key: NewPainSubSection; label: string }[] = [
  { key: 'other_pain', label: '그 외 통증' },
  { key: 'new_pain', label: '새로운 통증' },
];

export const sideEffectSubSections: { key: SideEffectSubSection; label: string }[] = [
  { key: 'medication', label: '복용 약' },
];

export const additionalSubSections: { key: AdditionalSubSection; label: string }[] = [
  { key: 'additional_question', label: '추가 질문' },
];

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const categoryLabels: Record<Category, string> = {
  'main_diagnosis': '주요 진단 내용',
  'new_pain': '그외/새로운 통증',
  'side_effects': '부작용',
  'additional_questions': '기타',
};

export default function ChatInterface({ patientInfo, medicalRecord, patientId, medicalRecordId, medicalRecordAnalysis }: ChatInterfaceProps) {
  const [currentCategory, setCurrentCategory] = useState<Category>('main_diagnosis'); // 초기에는 주요 진단 내용 선택
  const [maxReachedIndex, setMaxReachedIndex] = useState<number>(0); // 초기에는 주요 진단 내용까지 도달
  const [currentMainDiagnosisSubSection, setCurrentMainDiagnosisSubSection] = useState<MainDiagnosisSubSection | null>(null);
  const [completedMainDiagnosisSubSections, setCompletedMainDiagnosisSubSections] = useState<Set<MainDiagnosisSubSection>>(new Set());
  const [maxReachedMainDiagnosisSubSectionIndex, setMaxReachedMainDiagnosisSubSectionIndex] = useState<number>(-1);
  const [currentNewPainSubSection, setCurrentNewPainSubSection] = useState<NewPainSubSection | null>(null);
  const [completedNewPainSubSections, setCompletedNewPainSubSections] = useState<Set<NewPainSubSection>>(new Set());
  const [maxReachedNewPainSubSectionIndex, setMaxReachedNewPainSubSectionIndex] = useState<number>(-1);
  const [currentSideEffectSubSection, setCurrentSideEffectSubSection] = useState<SideEffectSubSection | null>(null);
  const [completedSideEffectSubSections, setCompletedSideEffectSubSections] = useState<Set<SideEffectSubSection>>(new Set());
  const [maxReachedSideEffectSubSectionIndex, setMaxReachedSideEffectSubSectionIndex] = useState<number>(-1);
  const [currentAdditionalSubSection, setCurrentAdditionalSubSection] = useState<AdditionalSubSection | null>(null);
  const [completedAdditionalSubSections, setCompletedAdditionalSubSections] = useState<Set<AdditionalSubSection>>(new Set());
  const [maxReachedAdditionalSubSectionIndex, setMaxReachedAdditionalSubSectionIndex] = useState<number>(-1);

  const patientDisplayName = patientInfo?.name ? `${patientInfo.name}님` : '환자님';
  const patientName = patientInfo?.name || '환자';

  // 분석 결과를 기반으로 주요 진단 내용 서브섹션 라벨 동적 생성
  const mainDiagnosisSubSections = useMemo(() => {
    const sections: { key: MainDiagnosisSubSection; label: string }[] = [];
    
    if (medicalRecordAnalysis?.symptoms && medicalRecordAnalysis.symptoms.length >= 3) {
      sections.push(
        { key: 'diagnosis_a', label: medicalRecordAnalysis.symptoms[0].name },
        { key: 'diagnosis_b', label: medicalRecordAnalysis.symptoms[1].name },
        { key: 'diagnosis_c', label: medicalRecordAnalysis.symptoms[2].name }
      );
    } else {
      // 분석 결과가 없으면 기본값 사용
      sections.push(
        { key: 'diagnosis_a', label: '증상 A' },
        { key: 'diagnosis_b', label: '증상 B' },
        { key: 'diagnosis_c', label: '증상 C' }
      );
    }
    
    sections.push({ key: 'examination', label: '검사' });
    return sections;
  }, [medicalRecordAnalysis]);
  // 서브섹션별로 메시지를 저장 (key: "category_subsection" 또는 "greeting")
  const [messagesBySection, setMessagesBySection] = useState<Map<string, Message[]>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loadedSubSections, setLoadedSubSections] = useState<Set<string>>(new Set());
  const mainDiagnosisIntroShownRef = useRef(false);

  const handleCategoryChange = (category: Category) => {
    const categoryIndex = categoryOrder.indexOf(category);
    
    // 주요 진단 내용 섹션인 경우
    if (category === 'main_diagnosis') {
      setCurrentCategory(category);
      setCurrentNewPainSubSection(null);
      setCurrentMainDiagnosisSubSection(null); // 서브 섹션은 아직 선택 안 됨
      setMaxReachedMainDiagnosisSubSectionIndex(-1); // 서브 섹션 인덱스 초기화
      // 주요 진단 내용 클릭 시 서브섹션 팝업 즉시 표시를 위해 maxReachedIndex 업데이트
      if (categoryIndex > maxReachedIndex) {
        setMaxReachedIndex(categoryIndex);
      }
      return;
    }
    
    // 그외/새로운 통증 섹션인 경우
    if (category === 'new_pain') {
      // 주요 진단 내용의 모든 서브 섹션이 완료되어야 함
      if (currentCategory === 'main_diagnosis' && completedMainDiagnosisSubSections.size < mainDiagnosisSubSections.length) {
        return;
      }
      setCurrentCategory(category);
      setCurrentMainDiagnosisSubSection(null);
      setCurrentNewPainSubSection(null); // 서브 섹션은 아직 선택 안 됨
      setMaxReachedNewPainSubSectionIndex(-1); // 서브 섹션 인덱스 초기화
      // 그외/새로운 통증 클릭 시 maxReachedIndex는 변경하지 않음 (서브섹션 완료 시에만 업데이트)
      return;
    }
    
    // 주요 진단 내용이 아닌 다른 탭으로 이동하려면, 주요 진단 내용의 모든 서브 섹션이 완료되어야 함
    if (currentCategory === 'main_diagnosis' && categoryIndex > 0) {
      if (completedMainDiagnosisSubSections.size < mainDiagnosisSubSections.length) {
        // 모든 서브 섹션이 완료되지 않았으면 이동 불가
        return;
      }
    }
    
    // 그외/새로운 통증으로 이동하려면, 주요 진단 내용의 모든 서브 섹션이 완료되어야 함
    if (categoryIndex === 1 && categoryIndex > maxReachedIndex) {
      if (completedMainDiagnosisSubSections.size < mainDiagnosisSubSections.length) {
        return;
      }
    }
    
    // 그외/새로운 통증이 아닌 다른 탭으로 이동하려면, 그외/새로운 통증의 모든 서브 섹션이 완료되어야 함
    if (currentCategory === 'new_pain' && categoryIndex > 1) {
      if (completedNewPainSubSections.size < newPainSubSections.length) {
        return;
      }
    }
    
    // 부작용으로 이동하려면, 그외/새로운 통증의 모든 서브 섹션이 완료되어야 함
    if (categoryIndex === 2 && completedNewPainSubSections.size < newPainSubSections.length) {
      return;
    }
    
    // 기타로 이동하려면, 부작용의 모든 서브 섹션이 완료되어야 함
    if (categoryIndex === 3 && completedSideEffectSubSections.size < sideEffectSubSections.length) {
      return;
    }
    
    // 부작용 섹션 클릭 시
    if (category === 'side_effects') {
      if (completedNewPainSubSections.size < newPainSubSections.length) {
        return;
      }
      setCurrentCategory(category);
      setCurrentMainDiagnosisSubSection(null);
      setCurrentNewPainSubSection(null);
      setCurrentSideEffectSubSection(null);
      setCurrentAdditionalSubSection(null);
      setMaxReachedSideEffectSubSectionIndex(-1);
      if (categoryIndex > maxReachedIndex) {
        setMaxReachedIndex(categoryIndex);
      }
      return;
    }
    
    // 기타 섹션 클릭 시
    if (category === 'additional_questions') {
      if (completedSideEffectSubSections.size < sideEffectSubSections.length) {
        return;
      }
      setCurrentCategory(category);
      setCurrentMainDiagnosisSubSection(null);
      setCurrentNewPainSubSection(null);
      setCurrentSideEffectSubSection(null);
      setCurrentAdditionalSubSection(null);
      setMaxReachedAdditionalSubSectionIndex(-1);
      if (categoryIndex > maxReachedIndex) {
        setMaxReachedIndex(categoryIndex);
      }
      return;
    }
  };

  const handleMainDiagnosisSubSectionChange = (subSection: MainDiagnosisSubSection) => {
    const subSectionIndex = mainDiagnosisSubSections.findIndex(s => s.key === subSection);
    if (subSectionIndex === -1) return;

    const nextAllowedIndex = maxReachedMainDiagnosisSubSectionIndex + 1;
    if (subSectionIndex > nextAllowedIndex) {
      return;
    }

    setCurrentMainDiagnosisSubSection(subSection);

    if (subSectionIndex === nextAllowedIndex) {
      setMaxReachedMainDiagnosisSubSectionIndex(subSectionIndex);
      setCompletedMainDiagnosisSubSections(prev => {
        const updated = new Set(prev);
        updated.add(subSection);
        if (updated.size === mainDiagnosisSubSections.length) {
          setMaxReachedIndex(prevIndex => Math.max(prevIndex, 1)); // 그외/새로운 통증 섹션 인덱스
        }
        return updated;
      });
    }
  };

  const handleNewPainSubSectionChange = (subSection: NewPainSubSection) => {
    const subSectionIndex = newPainSubSections.findIndex(s => s.key === subSection);
    if (subSectionIndex === -1) return;

    const nextAllowedIndex = maxReachedNewPainSubSectionIndex + 1;
    if (subSectionIndex > nextAllowedIndex) {
      return;
    }

    setCurrentNewPainSubSection(subSection);

    if (subSectionIndex === nextAllowedIndex) {
      setMaxReachedNewPainSubSectionIndex(subSectionIndex);
      setCompletedNewPainSubSections(prev => {
        const updated = new Set(prev);
        updated.add(subSection);
        if (updated.size === newPainSubSections.length) {
          setMaxReachedIndex(prevIndex => Math.max(prevIndex, 2)); // 부작용 섹션 인덱스
        }
        return updated;
      });
    }
  };

  const handleSideEffectSubSectionChange = (subSection: SideEffectSubSection) => {
    const subSectionIndex = sideEffectSubSections.findIndex(s => s.key === subSection);
    if (subSectionIndex === -1) return;

    const nextAllowedIndex = maxReachedSideEffectSubSectionIndex + 1;
    if (subSectionIndex > nextAllowedIndex) {
      return;
    }

    setCurrentSideEffectSubSection(subSection);

    if (subSectionIndex === nextAllowedIndex) {
      setMaxReachedSideEffectSubSectionIndex(subSectionIndex);
      setCompletedSideEffectSubSections(prev => {
        const updated = new Set(prev);
        updated.add(subSection);
        if (updated.size === sideEffectSubSections.length) {
          setMaxReachedIndex(prevIndex => Math.max(prevIndex, 3)); // 기타 섹션 인덱스
        }
        return updated;
      });
    }
  };

  const handleAdditionalSubSectionChange = (subSection: AdditionalSubSection) => {
    const subSectionIndex = additionalSubSections.findIndex(s => s.key === subSection);
    if (subSectionIndex === -1) return;

    const nextAllowedIndex = maxReachedAdditionalSubSectionIndex + 1;
    if (subSectionIndex > nextAllowedIndex) {
      return;
    }

    setCurrentAdditionalSubSection(subSection);

    if (subSectionIndex === nextAllowedIndex) {
      setMaxReachedAdditionalSubSectionIndex(subSectionIndex);
      setCompletedAdditionalSubSections(prev => {
        const updated = new Set(prev);
        updated.add(subSection);
        return updated;
      });
    }
  };

  // 현재 활성화된 서브섹션의 메시지만 가져오기
  const getCurrentMessages = (): Message[] => {
    // 서브섹션이 활성화된 경우
    if (currentCategory === 'main_diagnosis' && currentMainDiagnosisSubSection) {
      const sectionKey = `main_diagnosis_${currentMainDiagnosisSubSection}`;
      return messagesBySection.get(sectionKey) || [];
    }
    if (currentCategory === 'new_pain' && currentNewPainSubSection) {
      const sectionKey = `new_pain_${currentNewPainSubSection}`;
      return messagesBySection.get(sectionKey) || [];
    }
    if (currentCategory === 'side_effects' && currentSideEffectSubSection) {
      const sectionKey = `side_effects_${currentSideEffectSubSection}`;
      return messagesBySection.get(sectionKey) || [];
    }
    if (currentCategory === 'additional_questions' && currentAdditionalSubSection) {
      const sectionKey = `additional_questions_${currentAdditionalSubSection}`;
      return messagesBySection.get(sectionKey) || [];
    }
    
    // 서브섹션이 없고 주요 진단 내용 섹션인 경우 인트로 메시지 표시
    if (currentCategory === 'main_diagnosis' && !currentMainDiagnosisSubSection) {
      return messagesBySection.get('main_diagnosis_intro') || [];
    }
    
    return [];
  };

  const currentMessages = getCurrentMessages();

  // 주요 진단 내용 섹션 선택 시 인트로 메시지 표시
  useEffect(() => {
    if (currentCategory === 'main_diagnosis' && !currentMainDiagnosisSubSection && !mainDiagnosisIntroShownRef.current) {
      const introMessages: Message[] = [
        {
          id: `main_diagnosis_intro_0_${Date.now()}`,
          role: 'assistant',
          content: `${patientName}님의 기본 정보들을 토대로, 이제 본격적으로 주요 진단 내용에 대해서 이야기해볼게요.`,
          timestamp: new Date(),
        },
        {
          id: `main_diagnosis_intro_1_${Date.now()}`,
          role: 'assistant',
          content: `${patientName}님의 지난 진료 결과, '수두증'이 의심 된다고 진단을 받으셨습니다.`,
          timestamp: new Date(),
        },
        {
          id: `main_diagnosis_intro_2_${Date.now()}`,
          role: 'assistant',
          content: `'수두증'의 주요 증상과 관련해 몇 가지 질문을 드릴게요.`,
          timestamp: new Date(),
        },
      ];
      setMessagesBySection(prev => {
        const newMap = new Map(prev);
        newMap.set('main_diagnosis_intro', introMessages);
        return newMap;
      });
      mainDiagnosisIntroShownRef.current = true;
    }
  }, [currentCategory, currentMainDiagnosisSubSection, patientName]);

  // 서브섹션이 활성화될 때 대본 로드
  useEffect(() => {
    const loadScript = (category: Category, subSectionKey: string) => {
      const sectionKey = `${category}_${subSectionKey}`;
      if (loadedSubSections.has(sectionKey)) {
        return; // 이미 로드된 대본은 다시 로드하지 않음
      }

      const categoryScripts = (scripts as any)[category];
      if (!categoryScripts) return;

      const script = categoryScripts[subSectionKey];
      if (!script || !Array.isArray(script)) return;

      // 대본을 메시지로 변환하여 해당 서브섹션에 저장
      const scriptMessages: Message[] = script.map((turn: any, index: number) => ({
        id: `${sectionKey}_${index}_${Date.now()}`,
        role: turn.role as 'user' | 'assistant',
        content: turn.content,
        timestamp: new Date(),
      }));

      setMessagesBySection(prev => {
        const newMap = new Map(prev);
        newMap.set(sectionKey, scriptMessages);
        return newMap;
      });
      setLoadedSubSections(prev => new Set([...prev, sectionKey]));
    };

    // 주요 진단 내용 서브섹션
    if (currentCategory === 'main_diagnosis' && currentMainDiagnosisSubSection) {
      loadScript('main_diagnosis', currentMainDiagnosisSubSection);
    }

    // 그외/새로운 통증 서브섹션
    if (currentCategory === 'new_pain' && currentNewPainSubSection) {
      loadScript('new_pain', currentNewPainSubSection);
    }

    // 부작용 서브섹션
    if (currentCategory === 'side_effects' && currentSideEffectSubSection) {
      loadScript('side_effects', currentSideEffectSubSection);
    }

    // 기타 서브섹션
    if (currentCategory === 'additional_questions' && currentAdditionalSubSection) {
      loadScript('additional_questions', currentAdditionalSubSection);
    }
  }, [
    currentCategory,
    currentMainDiagnosisSubSection,
    currentNewPainSubSection,
    currentSideEffectSubSection,
    currentAdditionalSubSection,
    loadedSubSections,
  ]);

  const handleSendMessage = (content: string) => {
    // 현재 활성화된 서브섹션 키 찾기
    let sectionKey: string | null = null;
    
    if (currentCategory === 'main_diagnosis' && currentMainDiagnosisSubSection) {
      sectionKey = `main_diagnosis_${currentMainDiagnosisSubSection}`;
    } else if (currentCategory === 'new_pain' && currentNewPainSubSection) {
      sectionKey = `new_pain_${currentNewPainSubSection}`;
    } else if (currentCategory === 'side_effects' && currentSideEffectSubSection) {
      sectionKey = `side_effects_${currentSideEffectSubSection}`;
    } else if (currentCategory === 'additional_questions' && currentAdditionalSubSection) {
      sectionKey = `additional_questions_${currentAdditionalSubSection}`;
    }
    
    if (!sectionKey) return; // 활성화된 서브섹션이 없으면 메시지 추가 안 함
    
    // 사용자 메시지를 해당 서브섹션에 추가
    const userMessage: Message = {
      id: `${sectionKey}_user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    setMessagesBySection(prev => {
      const newMap = new Map(prev);
      const existingMessages = newMap.get(sectionKey!) || [];
      newMap.set(sectionKey!, [...existingMessages, userMessage]);
      return newMap;
    });

    // TODO: GPT API 호출하여 응답 받기
    // src/services/gpt.ts의 callGPTAPI 함수를 사용하여 GPT 응답을 받을 수 있습니다.
    
  };

  // 메시지가 추가될 때마다 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  return (
    <div className="w-[1366px] h-[1024px] relative bg-white overflow-hidden">
      {/* 상단 탭 버튼들 */}
      <ChatHeader 
        currentCategory={currentCategory} 
        onCategoryChange={handleCategoryChange}
        maxReachedIndex={maxReachedIndex}
        isMainDiagnosisComplete={completedMainDiagnosisSubSections.size === mainDiagnosisSubSections.length}
        isNewPainComplete={completedNewPainSubSections.size === newPainSubSections.length}
        isSideEffectsComplete={completedSideEffectSubSections.size === sideEffectSubSections.length}
      />
      
      {/* 그외/새로운 통증 섹션일 때 서브 섹션 탭 표시 - 메인 탭 바로 아래에 수평으로 팝업 */}
      {currentCategory === 'new_pain' && (
        <div className="absolute left-[380px] top-[111px] animate-fade-in-slide">
          {/* 서브 섹션 카드 - 일반 직사각형 둥근 모서리, 수평 배치 */}
          <div className="bg-white rounded-xl shadow-lg border border-zinc-300 px-4 py-3">
            {/* 서브 섹션 버튼들 - 가로로 배치 */}
            <div className="flex gap-3">
              {newPainSubSections.map((subSection, index) => {
                const isActive = currentNewPainSubSection === subSection.key;
                const isCompleted = completedNewPainSubSections.has(subSection.key);
                // 첫 번째 서브 섹션은 항상 클릭 가능, 나머지는 순서대로
                const isReachable = index === 0 || index <= maxReachedNewPainSubSectionIndex + 1;
                const isDisabled = !isReachable;
                
                return (
                  <button
                    key={subSection.key}
                    onClick={() => {
                      if (isReachable) {
                        handleNewPainSubSectionChange(subSection.key);
                      }
                    }}
                    disabled={isDisabled}
                    className={`px-5 py-3 rounded-lg text-lg font-semibold font-inter transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-orange-200 text-black shadow-sm'
                        : isCompleted
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : isDisabled
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300'
                    }`}
                    style={isDisabled ? { cursor: 'not-allowed' } : { cursor: 'pointer' }}
                  >
                    {subSection.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 부작용 섹션일 때 서브 섹션 탭 */}
      {currentCategory === 'side_effects' && (
        <div className="absolute left-[700px] top-[111px] animate-fade-in-slide">
          <div className="bg-white rounded-xl shadow-lg border border-zinc-300 px-4 py-3">
            <div className="flex gap-3">
              {sideEffectSubSections.map((subSection, index) => {
                const isActive = currentSideEffectSubSection === subSection.key;
                const isCompleted = completedSideEffectSubSections.has(subSection.key);
                const isReachable = maxReachedSideEffectSubSectionIndex === -1
                  ? index === 0
                  : index <= maxReachedSideEffectSubSectionIndex + 1;
                const isDisabled = !isReachable;

                return (
                  <button
                    key={subSection.key}
                    onClick={() => {
                      if (isReachable) {
                        handleSideEffectSubSectionChange(subSection.key);
                      }
                    }}
                    disabled={isDisabled}
                    className={`px-5 py-3 rounded-lg text-lg font-semibold font-inter transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-orange-200 text-black shadow-sm'
                        : isCompleted
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : isDisabled
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300'
                    }`}
                    style={isDisabled ? { cursor: 'not-allowed' } : { cursor: 'pointer' }}
                  >
                    {subSection.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 기타 섹션일 때 서브 섹션 탭 */}
      {currentCategory === 'additional_questions' && (
        <div className="absolute left-[1019px] top-[111px] animate-fade-in-slide">
          <div className="bg-white rounded-xl shadow-lg border border-zinc-300 px-4 py-3">
            <div className="flex gap-3">
              {additionalSubSections.map((subSection, index) => {
                const isActive = currentAdditionalSubSection === subSection.key;
                const isCompleted = completedAdditionalSubSections.has(subSection.key);
                const isReachable = maxReachedAdditionalSubSectionIndex === -1
                  ? index === 0
                  : index <= maxReachedAdditionalSubSectionIndex + 1;
                const isDisabled = !isReachable;

                return (
                  <button
                    key={subSection.key}
                    onClick={() => {
                      if (isReachable) {
                        handleAdditionalSubSectionChange(subSection.key);
                      }
                    }}
                    disabled={isDisabled}
                    className={`px-5 py-3 rounded-lg text-lg font-semibold font-inter transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-orange-200 text-black shadow-sm'
                        : isCompleted
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : isDisabled
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300'
                    }`}
                    style={isDisabled ? { cursor: 'not-allowed' } : { cursor: 'pointer' }}
                  >
                    {subSection.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 주요 진단 내용 섹션일 때 서브 섹션 탭 표시 - 메인 탭 바로 아래에 수평으로 팝업 */}
      {currentCategory === 'main_diagnosis' && (
        <div className="absolute left-[60px] top-[111px] animate-fade-in-slide">
          {/* 서브 섹션 카드 - 일반 직사각형 둥근 모서리, 수평 배치 */}
          <div className="bg-white rounded-xl shadow-lg border border-zinc-300 px-4 py-3">
            {/* 서브 섹션 버튼들 - 가로로 배치 */}
            <div className="flex gap-3">
              {mainDiagnosisSubSections.map((subSection, index) => {
                const isActive = currentMainDiagnosisSubSection === subSection.key;
                const isCompleted = completedMainDiagnosisSubSections.has(subSection.key);
                // 첫 번째 서브 섹션만 클릭 가능, 나머지는 순서대로
                const isReachable = maxReachedMainDiagnosisSubSectionIndex === -1 
                  ? index === 0  // 처음에는 첫 번째만
                  : index <= maxReachedMainDiagnosisSubSectionIndex + 1;  // 이후에는 순차적으로
                const isDisabled = !isReachable;
                
                return (
                  <button
                    key={subSection.key}
                    onClick={() => {
                      if (isReachable) {
                        handleMainDiagnosisSubSectionChange(subSection.key);
                      }
                    }}
                    disabled={isDisabled}
                    className={`px-5 py-3 rounded-lg text-lg font-semibold font-inter transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-orange-200 text-black shadow-sm'
                        : isCompleted
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : isDisabled
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300'
                    }`}
                    style={isDisabled ? { cursor: 'not-allowed' } : { cursor: 'pointer' }}
                  >
                    {subSection.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 채팅 영역 컨테이너 - 수평선 아래부터 입력 필드까지 */}
      <div 
        className="absolute left-[60px] bg-gray-100 rounded-xl shadow-lg"
        style={{
          top: '211px', // 위로 이동
          width: '836px',
          height: '770px', // 높이 증가
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255, 255, 255, 0.3)' // 매우 연한 border
        }}
      >
        {/* 메시지 영역 - LLM이 생성한 메시지들을 표시 */}
        <div 
          className="flex-1 overflow-y-auto" 
          style={{ 
            minHeight: 0,
            padding: '48px 40px 36px 40px' // 상단 패딩 증가로 첫 채팅박스 위치 아래로
          }}
        >
          <div className="space-y-5">
            {currentMessages.length === 0 ? (
              /* 메시지가 없을 때 작업 중 표시 */
              <div 
                className="inline-flex flex-col justify-start items-start gap-6 bg-white rounded-tl-[20px] rounded-tr-[20px] rounded-br-[20px]"
                style={{ padding: '16px 32px' }}
              >
                <div className="self-stretch justify-start text-black text-[26px] font-normal font-inter">
                  {currentCategory === null
                    ? `${patientDisplayName}, 메인 섹션을 선택해주세요.`
                    : currentCategory === 'main_diagnosis' && currentMainDiagnosisSubSection
                    ? `${categoryLabels[currentCategory]} - ${mainDiagnosisSubSections.find(s => s.key === currentMainDiagnosisSubSection)?.label}(를) 작업중입니다 ...`
                    : currentCategory === 'main_diagnosis'
                    ? `${categoryLabels[currentCategory]}을(를) 작업중입니다 ...`
                    : currentCategory === 'new_pain' && currentNewPainSubSection
                    ? `${categoryLabels[currentCategory]} - ${newPainSubSections.find(s => s.key === currentNewPainSubSection)?.label}을(를) 작업중입니다 ...`
                    : currentCategory === 'new_pain'
                    ? `${categoryLabels[currentCategory]}을(를) 작업중입니다 ...`
                    : currentCategory === 'side_effects' && currentSideEffectSubSection
                    ? `${categoryLabels[currentCategory]} - ${sideEffectSubSections.find(s => s.key === currentSideEffectSubSection)?.label}을(를) 작업중입니다 ...`
                    : currentCategory === 'side_effects'
                    ? `${categoryLabels[currentCategory]}을(를) 작업중입니다 ...`
                    : currentCategory === 'additional_questions' && currentAdditionalSubSection
                    ? `${categoryLabels[currentCategory]} - ${additionalSubSections.find(s => s.key === currentAdditionalSubSection)?.label}을(를) 작업중입니다 ...`
                    : currentCategory === 'additional_questions'
                    ? `${categoryLabels[currentCategory]}을(를) 작업중입니다 ...`
                    : `${categoryLabels[currentCategory]}을(를) 작업중입니다 ...`
                  }
                </div>
              </div>
            ) : (
              currentMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {/* 하단 입력 필드 */}
        <div className="p-5 border-t border-gray-300">
          <ChatInput onSendMessage={handleSendMessage} />
        </div>
      </div>

      {/* 이미지 영역 컨테이너 - 수평선 아래 + 수직선 오른쪽 */}
      {/* 추가 질문 섹션: left-[1083px], w-56(224px) → 오른쪽 끝: 1307px */}
      <div 
        className="absolute bg-white rounded-xl shadow-lg p-4"
        style={{
          top: '211px', // 위로 이동
          left: '936px', // 채팅 영역 끝(896px) + gap(40px) = 936px
          width: '371px', // 오른쪽 끝을 1307px에 맞춤 (1307 - 936 = 371)
          height: '770px', // 채팅 영역과 동일한 높이
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(229, 231, 235, 0.3)' // 매우 연한 border
        }}
      >
        <HumanModel3D />
      </div>
    </div>
  );
}
