import { useState, useEffect, useRef, useMemo } from 'react';
import { PatientInfo } from '../App';
import ChatHeader from './Chat/ChatHeader';
import MessageBubble from './Chat/MessageBubble';
import ChatInput from './Chat/ChatInput';
import HumanModel3D from './HumanModel/HumanModel3D';
import scripts from '../data/scripts.json';
import { MedicalRecordAnalysis } from '../services/gpt-common';
import { USE_BIRTHDATE_VERSION } from '../config/patient-info';
import { chatAboutSymptom, chatAboutExamination, SymptomChatResponse, getMainDiagnosisIntroMessages, getSymptomIntroMessage, getSymptomInitialQuestion, getExaminationMessages, getMainDiagnosisCompletionMessage } from '../services/gpt-chat-main-diagnosis';
import { generateNewPainQuestion, getOtherNewPainIntroMessages, getOtherPainEmptyMessage, getOtherPainFirstQuestion, getNewPainHardcodedMessage, getNewPainCompletionMessage, chatAboutNewPain, NewPainChatResponse } from '../services/gpt-chat-new-pain';
import { generateSideEffectQuestion, chatAboutSideEffects, SideEffectChatResponse, getSideEffectsIntroMessage, getMedicationHardcodedMessage, getMedicationEmptyMessage, getSideEffectCompletionMessage } from '../services/gpt-chat-side-effects';
import { generateAdditionalQuestion, chatAboutAdditional, AdditionalChatResponse, getAdditionalIntroMessage, getAdditionalHardcodedMessage, getAdditionalCompletionMessage } from '../services/gpt-chat-additional';
import { determineBodyPartForSymptom, extractSymptomsFromMessage } from '../services/gpt-body-part';
import { BodyPart } from './HumanModel/HumanModel3D';

interface ChatInterfaceProps {
  patientInfo: PatientInfo;
  medicalRecord: File | null;
  patientId: string;
  medicalRecordId: string;
  medicalRecordAnalysis: MedicalRecordAnalysis | null;
  onConversationComplete?: (conversationLog: ConversationLog) => void; // 대화 완료 시 콜백 (conversation log 전달)
}

export type Category = 'main_diagnosis' | 'other_new_pain' | 'side_effects' | 'additional_questions';

export type MainDiagnosisSubSection = 'diagnosis_a' | 'diagnosis_b' | 'diagnosis_c' | 'examination';

export type NewPainSubSection = 'other_pain' | 'new_pain';
export type SideEffectSubSection = 'medication';
export type AdditionalSubSection = 'additional_question';

export const categoryOrder: Category[] = ['main_diagnosis', 'other_new_pain', 'side_effects', 'additional_questions'];

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

// 대화 로그 인터페이스
export interface ConversationLog {
  patientInfo: Omit<PatientInfo, 'name'>; // 이름 제외
  medicalRecordId: string;
  sessionId: string;
  startTime: string;
  endTime?: string;
  conversations: {
    [sectionKey: string]: {
      section: string;
      subSection?: string;
      messages: Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        timestamp: string; // ISO string
      }>;
    };
  };
  medicalRecordAnalysis?: MedicalRecordAnalysis;
}

const categoryLabels: Record<Category, string> = {
  'main_diagnosis': '주요 진단 내용',
  'other_new_pain': '그외/새로운 통증',
  'side_effects': '부작용',
  'additional_questions': '기타',
};

export default function ChatInterface({ patientInfo, medicalRecord, patientId, medicalRecordId, medicalRecordAnalysis, onConversationComplete }: ChatInterfaceProps) {
  // 테스트 모드: 순서 제한 비활성화 (true일 때 모든 섹션/서브섹션을 자유롭게 클릭 가능)
  const TEST_MODE = false; // 운영 모드: 순서 제한 활성화 // true일 때 모든 섹션/서브섹션을 자유롭게 클릭 가능
  
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
  const newPainIntroShownRef = useRef(false);
  const newPainQuestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // GPT 질문 생성 setTimeout 추적
  const [isGeneratingIntro, setIsGeneratingIntro] = useState(false);
  const [isProcessingGPT, setIsProcessingGPT] = useState(false);
  const [completedSymptomSubSections, setCompletedSymptomSubSections] = useState<Set<string>>(new Set()); // 완료된 증상 서브섹션 추적
  const [highlightedBodyParts, setHighlightedBodyParts] = useState<BodyPart[]>([]); // 하이라이트된 신체 부위
  const sessionStartTimeRef = useRef<string>(new Date().toISOString());
  const sessionIdRef = useRef<string>(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // 로컬 스토리지 키 생성
  const getStorageKey = () => {
    if (USE_BIRTHDATE_VERSION && patientInfo.birthYear && patientInfo.birthMonth && patientInfo.birthDay) {
      const birthDate = `${patientInfo.birthYear}-${patientInfo.birthMonth.padStart(2, '0')}-${patientInfo.birthDay.padStart(2, '0')}`;
      return `conversation_log_${birthDate}_${medicalRecordId}`;
    }
    return `conversation_log_age${patientInfo.age}_${medicalRecordId}`;
  };

  // 메시지 내용에서 환자 이름 제거하는 함수
  const removePatientNameFromContent = (content: string): string => {
    if (!patientInfo?.name) return content;
    
    const name = patientInfo.name;
    const nameWithHonorific = `${name}님`;
    
    // 환자 이름을 "환자"로 대체
    let cleanedContent = content.replace(new RegExp(nameWithHonorific, 'g'), '환자님');
    cleanedContent = cleanedContent.replace(new RegExp(name, 'g'), '환자');
    
    return cleanedContent;
  };

  // 대화 로그를 로컬 스토리지에 저장
  const saveConversationToLocalStorage = () => {
    try {
      // 이름을 제외한 환자 정보
      const { name, ...patientInfoWithoutName } = patientInfo;
      const conversationLog: ConversationLog = {
        patientInfo: patientInfoWithoutName,
        medicalRecordId,
        sessionId: sessionIdRef.current,
        startTime: sessionStartTimeRef.current,
        conversations: {},
        medicalRecordAnalysis: medicalRecordAnalysis || undefined,
      };

      // messagesBySection을 conversations 객체로 변환
      messagesBySection.forEach((messages, sectionKey) => {
        const [category, ...subSectionParts] = sectionKey.split('_');
        const subSection = subSectionParts.length > 0 ? subSectionParts.join('_') : undefined;
        
        conversationLog.conversations[sectionKey] = {
          section: categoryLabels[category as Category] || category,
          subSection,
          messages: messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: removePatientNameFromContent(msg.content), // 환자 이름 제거
            timestamp: msg.timestamp.toISOString(),
          })),
        };
      });

      localStorage.setItem(getStorageKey(), JSON.stringify(conversationLog));
    } catch (error) {
      console.error('로컬 스토리지 저장 오류:', error);
    }
  };

  // 로컬 스토리지에서 대화 로그 복구
  const loadConversationFromLocalStorage = (): boolean => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (!stored) return false;

      const conversationLog: ConversationLog = JSON.parse(stored);
      
      // messagesBySection 복구
      const restoredMessages = new Map<string, Message[]>();
      
      Object.entries(conversationLog.conversations).forEach(([sectionKey, data]) => {
        restoredMessages.set(sectionKey, data.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        })));
      });

      setMessagesBySection(restoredMessages);
      return true;
    } catch (error) {
      console.error('로컬 스토리지 복구 오류:', error);
      return false;
    }
  };

  // 대화 로그를 생성하는 함수
  const createConversationLog = (): ConversationLog => {
    // 이름을 제외한 환자 정보
    const { name, ...patientInfoWithoutName } = patientInfo;
    const conversationLog: ConversationLog = {
      patientInfo: patientInfoWithoutName,
      medicalRecordId,
      sessionId: sessionIdRef.current,
      startTime: sessionStartTimeRef.current,
      endTime: new Date().toISOString(),
      conversations: {},
      medicalRecordAnalysis: medicalRecordAnalysis || undefined,
    };

    // messagesBySection을 conversations 객체로 변환
    messagesBySection.forEach((messages, sectionKey) => {
      const [category, ...subSectionParts] = sectionKey.split('_');
      const subSection = subSectionParts.length > 0 ? subSectionParts.join('_') : undefined;
      
      conversationLog.conversations[sectionKey] = {
        section: categoryLabels[category as Category] || category,
        subSection,
        messages: messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: removePatientNameFromContent(msg.content), // 환자 이름 제거
          timestamp: msg.timestamp.toISOString(),
        })),
      };
    });

    return conversationLog;
  };

  // 대화 로그를 JSON 파일로 자동 다운로드
  const downloadConversationLog = () => {
    try {
      const conversationLog = createConversationLog();

      const json = JSON.stringify(conversationLog, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // conversationLogs 폴더에 저장되도록 파일명 지정
      let filename: string;
      if (USE_BIRTHDATE_VERSION && patientInfo.birthYear && patientInfo.birthMonth && patientInfo.birthDay) {
        const birthDate = `${patientInfo.birthYear}-${patientInfo.birthMonth.padStart(2, '0')}-${patientInfo.birthDay.padStart(2, '0')}`;
        filename = `conversationLogs/conversation_log_${birthDate}_${new Date().toISOString().split('T')[0]}.json`;
      } else {
        filename = `conversationLogs/conversation_log_age${patientInfo.age}_${new Date().toISOString().split('T')[0]}.json`;
      }
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('대화 로그 다운로드 오류:', error);
    }
  };


  const handleCategoryChange = (category: Category) => {
    const categoryIndex = categoryOrder.indexOf(category);
    
    // 주요 진단 내용 섹션인 경우
    if (category === 'main_diagnosis') {
      setCurrentCategory(category);
      setCurrentNewPainSubSection(null);
      setCurrentMainDiagnosisSubSection(null); // 서브 섹션은 아직 선택 안 됨
      
      // 이미 활성화된 서브섹션이 있으면 maxReachedMainDiagnosisSubSectionIndex를 유지
      // 없으면 -1로 초기화 (첫 번째 서브섹션을 활성화할 수 있도록)
      let maxActivatedIndex = -1;
      for (let i = 0; i < mainDiagnosisSubSections.length; i++) {
        const subSectionKey = mainDiagnosisSubSections[i].key;
        const sectionKey = `main_diagnosis_${subSectionKey}`;
        const existingMessages = messagesBySection.get(sectionKey);
        if (existingMessages && existingMessages.length > 0) {
          maxActivatedIndex = i;
        }
      }
      setMaxReachedMainDiagnosisSubSectionIndex(maxActivatedIndex);
      
      // 주요 진단 내용 클릭 시 서브섹션 팝업 즉시 표시를 위해 maxReachedIndex 업데이트
      if (categoryIndex > maxReachedIndex) {
        setMaxReachedIndex(categoryIndex);
      }
      
      // 첫 번째 서브섹션은 useEffect에서 인트로 메시지 표시 후 자동으로 시작됨
      // handleCategoryChange에서는 시작하지 않음
      
      return;
    }
    
  // 그외/새로운 통증 섹션인 경우
  if (category === 'other_new_pain') {
      // 주요 진단 내용의 모든 서브 섹션이 완료되어야 함 (테스트 모드에서는 비활성화)
      if (!TEST_MODE && currentCategory === 'main_diagnosis' && completedMainDiagnosisSubSections.size < mainDiagnosisSubSections.length) {
        return;
      }
      setCurrentCategory(category);
      setCurrentMainDiagnosisSubSection(null);
      setCurrentNewPainSubSection(null); // 서브 섹션은 아직 선택 안 됨
      
      // 이미 활성화된 서브섹션이 있으면 maxReachedNewPainSubSectionIndex를 유지
      let maxActivatedIndex = -1;
      for (let i = 0; i < newPainSubSections.length; i++) {
      const subSectionKey = newPainSubSections[i].key;
      const sectionKey = `other_new_pain_${subSectionKey}`;
        const existingMessages = messagesBySection.get(sectionKey);
        if (existingMessages && existingMessages.length > 0) {
          maxActivatedIndex = i;
        }
      }
      setMaxReachedNewPainSubSectionIndex(maxActivatedIndex);
      
      // 첫 번째 서브섹션은 useEffect에서 인트로 메시지 표시 후 자동으로 시작됨
      // handleCategoryChange에서는 시작하지 않음
      
      // 그외/새로운 통증 클릭 시 maxReachedIndex는 변경하지 않음 (서브섹션 완료 시에만 업데이트)
      return;
    }
    
    // 주요 진단 내용이 아닌 다른 탭으로 이동하려면, 주요 진단 내용의 모든 서브 섹션이 완료되어야 함 (테스트 모드에서는 비활성화)
    if (!TEST_MODE && currentCategory === 'main_diagnosis' && categoryIndex > 0) {
      if (completedMainDiagnosisSubSections.size < mainDiagnosisSubSections.length) {
        // 모든 서브 섹션이 완료되지 않았으면 이동 불가
        return;
      }
    }
    
    // 그외/새로운 통증으로 이동하려면, 주요 진단 내용의 모든 서브 섹션이 완료되어야 함 (테스트 모드에서는 비활성화)
    if (!TEST_MODE && categoryIndex === 1 && categoryIndex > maxReachedIndex) {
      if (completedMainDiagnosisSubSections.size < mainDiagnosisSubSections.length) {
        return;
      }
    }
    
    // 그외/새로운 통증이 아닌 다른 탭으로 이동하려면, 그외/새로운 통증의 모든 서브 섹션이 완료되어야 함 (테스트 모드에서는 비활성화)
    if (!TEST_MODE && currentCategory === 'other_new_pain' && categoryIndex > 1) {
      if (completedNewPainSubSections.size < newPainSubSections.length) {
        return;
      }
    }
    
    // 부작용으로 이동하려면, 그외/새로운 통증의 모든 서브 섹션이 완료되어야 함 (테스트 모드에서는 비활성화)
    if (!TEST_MODE && categoryIndex === 2 && completedNewPainSubSections.size < newPainSubSections.length) {
      return;
    }
    
    // 기타로 이동하려면, 부작용의 모든 서브 섹션이 완료되어야 함 (테스트 모드에서는 비활성화)
    if (!TEST_MODE && categoryIndex === 3 && completedSideEffectSubSections.size < sideEffectSubSections.length) {
      return;
    }
    
    // 부작용 섹션 클릭 시
    if (category === 'side_effects') {
      // 그외/새로운 통증의 모든 서브 섹션이 완료되어야 함 (테스트 모드에서는 비활성화)
      if (!TEST_MODE && completedNewPainSubSections.size < newPainSubSections.length) {
        return;
      }
      
      // 같은 카테고리를 다시 클릭한 경우에도 서브섹션을 null로 설정하여 intro 메시지 표시
      const isSameCategory = currentCategory === category;
      
      setCurrentCategory(category);
      setCurrentMainDiagnosisSubSection(null);
      setCurrentNewPainSubSection(null);
      setCurrentSideEffectSubSection(null); // 항상 null로 설정하여 intro 메시지 표시
      setCurrentAdditionalSubSection(null);
      
      // 이미 활성화된 서브섹션이 있으면 maxReachedSideEffectSubSectionIndex를 유지
      let maxActivatedIndex = -1;
      for (let i = 0; i < sideEffectSubSections.length; i++) {
        const subSectionKey = sideEffectSubSections[i].key;
        const sectionKey = `side_effects_${subSectionKey}`;
        const existingMessages = messagesBySection.get(sectionKey);
        if (existingMessages && existingMessages.length > 0) {
          maxActivatedIndex = i;
        }
      }
      setMaxReachedSideEffectSubSectionIndex(maxActivatedIndex);
      
      // 부작용 섹션 intro 메시지 추가 (같은 카테고리를 다시 클릭한 경우에도 표시)
      const introKey = 'side_effects_intro';
      const existingIntroMessages = messagesBySection.get(introKey);
      if (!existingIntroMessages || existingIntroMessages.length === 0 || isSameCategory) {
        const introMessage: Message = {
          id: `side_effects_intro_${Date.now()}`,
          role: 'assistant',
          content: getSideEffectsIntroMessage(patientInfo.name),
          timestamp: new Date(),
        };
        // 즉시 메시지 추가 (동기적으로)
        const updated = new Map(messagesBySection);
        updated.set(introKey, [introMessage]);
        setMessagesBySection(updated);
      }
      
      // 첫 번째 서브섹션은 사용자가 직접 클릭해야 함 (자동 시작하지 않음)
      
      if (categoryIndex > maxReachedIndex) {
        setMaxReachedIndex(categoryIndex);
      }
      return;
    }
    
    // 기타 섹션 클릭 시
    if (category === 'additional_questions') {
      // 부작용의 모든 서브 섹션이 완료되어야 함 (테스트 모드에서는 비활성화)
      if (!TEST_MODE && completedSideEffectSubSections.size < sideEffectSubSections.length) {
        return;
      }
      setCurrentCategory(category);
      setCurrentMainDiagnosisSubSection(null);
      setCurrentNewPainSubSection(null);
      setCurrentSideEffectSubSection(null);
      setCurrentAdditionalSubSection(null);
      
      // 이미 활성화된 서브섹션이 있으면 maxReachedAdditionalSubSectionIndex를 유지
      let maxActivatedIndex = -1;
      for (let i = 0; i < additionalSubSections.length; i++) {
        const subSectionKey = additionalSubSections[i].key;
        const sectionKey = `additional_questions_${subSectionKey}`;
        const existingMessages = messagesBySection.get(sectionKey);
        if (existingMessages && existingMessages.length > 0) {
          maxActivatedIndex = i;
        }
      }
      setMaxReachedAdditionalSubSectionIndex(maxActivatedIndex);
      
      // 기타 섹션 intro 메시지 추가 (이미 있으면 추가하지 않음)
      const introKey = 'additional_questions_intro';
      const existingIntroMessages = messagesBySection.get(introKey);
      if (!existingIntroMessages || existingIntroMessages.length === 0) {
        const introMessage: Message = {
          id: `additional_questions_intro_${Date.now()}`,
          role: 'assistant',
          content: getAdditionalIntroMessage(patientInfo.name),
          timestamp: new Date(),
        };
        // 즉시 메시지 추가 (동기적으로)
        const updated = new Map(messagesBySection);
        updated.set(introKey, [introMessage]);
        setMessagesBySection(updated);
      }
      
      // 첫 번째 서브섹션은 사용자가 직접 클릭해야 함 (자동 시작하지 않음)
      
      if (categoryIndex > maxReachedIndex) {
        setMaxReachedIndex(categoryIndex);
      }
      return;
    }
  };

  const handleMainDiagnosisSubSectionChange = async (subSection: MainDiagnosisSubSection) => {
    const subSectionIndex = mainDiagnosisSubSections.findIndex(s => s.key === subSection);
    if (subSectionIndex === -1) return;

    setCurrentMainDiagnosisSubSection(subSection);
    const sectionKey = `main_diagnosis_${subSection}`;
    
    // 이미 메시지가 있는 서브섹션은 한번 활성화된 것이므로 순서 제한 없이 클릭 가능
    const existingMessages = messagesBySection.get(sectionKey);
    const isActivated = existingMessages && existingMessages.length > 0;
    
    // 한번 활성화되지 않은 서브섹션만 순서 제한 적용 (테스트 모드에서는 비활성화)
    if (!TEST_MODE && !isActivated) {
      const nextAllowedIndex = maxReachedMainDiagnosisSubSectionIndex + 1;
      if (subSectionIndex > nextAllowedIndex) {
        return;
      }
    }

    // diagnosis_a, b, c인 경우 bodyPart 하이라이트 설정 (메시지가 있어도 항상 설정)
    if (subSection === 'diagnosis_a' || subSection === 'diagnosis_b' || subSection === 'diagnosis_c') {
      // 증상 정보 가져오기
      const symptomIndex = subSection === 'diagnosis_a' ? 0 : subSection === 'diagnosis_b' ? 1 : 2;
      const symptom = medicalRecordAnalysis?.symptoms[symptomIndex];
      
      // 이미 계산된 bodyPart 사용 (MedicalRecordUpload에서 분석 완료 후 계산됨)
      if (symptom?.bodyPart) {
        setHighlightedBodyParts([symptom.bodyPart]);
      } else {
        // bodyPart가 아직 계산되지 않은 경우 하이라이트 제거
        setHighlightedBodyParts([]);
      }
    } else if (subSection === 'examination') {
      // examination인 경우 하이라이트 제거
      setHighlightedBodyParts([]);
    }

    // 이미 메시지가 있는 경우 (이미 질문이 시작된 경우) 첫 질문을 생성하지 않음
    if (!isActivated) {
      // diagnosis_a, b, c인 경우에만 GPT 첫 질문 생성
      if (subSection === 'diagnosis_a' || subSection === 'diagnosis_b' || subSection === 'diagnosis_c') {
        setIsProcessingGPT(true);
        
        // 증상 정보 가져오기 (위에서 이미 가져왔지만 다시 가져옴)
        const symptomIndex = subSection === 'diagnosis_a' ? 0 : subSection === 'diagnosis_b' ? 1 : 2;
        const symptom = medicalRecordAnalysis?.symptoms[symptomIndex];
        const symptomName = symptom?.name || mainDiagnosisSubSections.find(s => s.key === subSection)?.label || '증상';
        const mentioned = symptom?.mentioned ?? false;
        const present = symptom?.present ?? false;

        // 첫 번째 하드코딩된 메시지: 증상 소개
        const introMessage = getSymptomIntroMessage(subSectionIndex, symptomName);

        // 두 번째 하드코딩된 메시지: 증상 관련 질문
        const initialMessage = getSymptomInitialQuestion(mentioned, present, symptomName);

        // 하드코딩된 메시지들을 먼저 표시 (소개 메시지 + 질문 메시지)
        const introAssistantMessage: Message = {
          id: `${sectionKey}_assistant_intro_${Date.now()}`,
          role: 'assistant',
          content: introMessage,
          timestamp: new Date(),
        };

        const initialAssistantMessage: Message = {
          id: `${sectionKey}_assistant_initial_${Date.now()}`,
          role: 'assistant',
          content: initialMessage,
          timestamp: new Date(),
        };

        setMessagesBySection(prev => {
          const newMap = new Map(prev);
          newMap.set(sectionKey, [introAssistantMessage, initialAssistantMessage]);
          return newMap;
        });

        // GPT 응답은 생성하지 않음 - 사용자가 먼저 답변할 수 있게 함
        setIsProcessingGPT(false);
      } else if (subSection === 'examination') {
        // 검사 서브섹션 처리
        // 검사 정보 가져오기
        const examinations = medicalRecordAnalysis?.examinations || [];
        if (examinations.length > 0) {
          // 첫 번째 검사 사용
          const examinationName = examinations[0].name;
          
          // 메시지를 하나씩 순차적으로 추가
          const examinationMessages = getExaminationMessages(examinationName);
          
          examinationMessages.forEach((content, index) => {
            setTimeout(() => {
              setMessagesBySection(prev => {
                const newMap = new Map(prev);
                const existingMessages = newMap.get(sectionKey) || [];
                
                // 이미 같은 내용의 메시지가 있는지 확인 (중복 방지)
                const isDuplicate = existingMessages.some(msg => 
                  msg.role === 'assistant' && msg.content === content
                );
                
                if (!isDuplicate) {
                  const newMessage: Message = {
                    id: `${sectionKey}_assistant_examination_${index}_${Date.now()}`,
                    role: 'assistant',
                    content,
                    timestamp: new Date(),
                  };
                  newMap.set(sectionKey, [...existingMessages, newMessage]);
                }
                
                return newMap;
              });
            }, index * 800); // 각 메시지 간 800ms 간격
          });
        }
      }
    }

    // 한번 활성화되지 않은 서브섹션일 때만 maxReachedMainDiagnosisSubSectionIndex 업데이트
    if (!isActivated) {
      const nextAllowedIndex = maxReachedMainDiagnosisSubSectionIndex + 1;
      if (subSectionIndex === nextAllowedIndex) {
        setMaxReachedMainDiagnosisSubSectionIndex(subSectionIndex);
      }
    }
  };

  // 증상 문진 완료 처리 및 다음 서브섹션으로 자동 이동
  const handleSymptomComplete = async (subSection: MainDiagnosisSubSection, subSectionIndex: number) => {
    setCompletedSymptomSubSections(prev => {
      const updated = new Set(prev);
      updated.add(`main_diagnosis_${subSection}`);
      return updated;
    });

    // 완료 상태 업데이트 후 다음 서브섹션 체크
    setCompletedMainDiagnosisSubSections(prev => {
      const updated = new Set(prev);
      updated.add(subSection);
      
      // 다음 서브섹션 찾기
      const nextSubSectionIndex = subSectionIndex + 1;
      
      // 다음 서브섹션이 있으면 자동으로 넘어감
      if (nextSubSectionIndex < mainDiagnosisSubSections.length) {
        const nextSubSection = mainDiagnosisSubSections[nextSubSectionIndex];
        
        // 다음 서브섹션이 diagnosis_a, b, c, examination 중 하나인 경우 자동 이동
        if (nextSubSection.key === 'diagnosis_a' || nextSubSection.key === 'diagnosis_b' || nextSubSection.key === 'diagnosis_c' || nextSubSection.key === 'examination') {
          // 잠시 대기 후 다음 서브섹션으로 이동 (자연스러운 전환을 위해)
          setTimeout(() => {
            handleMainDiagnosisSubSectionChange(nextSubSection.key);
            setMaxReachedMainDiagnosisSubSectionIndex(nextSubSectionIndex);
          }, 2500); // 2.5초 후 다음 서브섹션으로 이동
        }
      } else {
        // 모든 서브섹션이 완료됨
        if (updated.size === mainDiagnosisSubSections.length) {
          setMaxReachedIndex(prevIndex => Math.max(prevIndex, 1)); // 그외/새로운 통증 섹션 인덱스
          
          // 다음 카테고리로 자동 전환 (2.5초 후)
          const currentCategoryIndex = categoryOrder.indexOf('main_diagnosis');
          if (currentCategoryIndex < categoryOrder.length - 1) {
            const nextCategory = categoryOrder[currentCategoryIndex + 1];
            setTimeout(() => {
              handleCategoryChange(nextCategory);
              // 첫 번째 서브섹션은 사용자가 직접 클릭해야 함 (자동 시작하지 않음)
            }, 2500);
          }
        }
      }
      
      return updated;
    });
  };

  const handleNewPainSubSectionChange = async (subSection: NewPainSubSection) => {
    const subSectionIndex = newPainSubSections.findIndex(s => s.key === subSection);
    if (subSectionIndex === -1) return;

    // 이미 메시지가 있는 서브섹션은 한번 활성화된 것이므로 순서 제한 없이 클릭 가능
    const sectionKey = `other_new_pain_${subSection}`;
    const existingMessages = messagesBySection.get(sectionKey);
    const isActivated = existingMessages && existingMessages.length > 0;
    
    // 한번 활성화되지 않은 서브섹션만 순서 제한 적용 (테스트 모드에서는 비활성화)
    if (!TEST_MODE && !isActivated) {
      const nextAllowedIndex = maxReachedNewPainSubSectionIndex + 1;
      if (subSectionIndex > nextAllowedIndex) {
        return;
      }
    }

    setCurrentNewPainSubSection(subSection);

    // "그 외 통증" 서브섹션 처리
    if (subSection === 'other_pain') {
      // bodyPart 하이라이트 설정
      const otherSymptoms = medicalRecordAnalysis?.otherSymptoms || [];
      if (otherSymptoms.length > 0) {
        const firstOtherSymptom = otherSymptoms[0];
        // 이미 계산된 bodyPart 사용 (MedicalRecordUpload에서 분석 완료 후 계산됨)
        if (firstOtherSymptom.bodyPart) {
          setHighlightedBodyParts([firstOtherSymptom.bodyPart]);
        } else {
          setHighlightedBodyParts([]);
        }
      } else {
        setHighlightedBodyParts([]);
      }
      
      if (!isActivated) {
        setIsProcessingGPT(true);
        
        if (otherSymptoms.length === 0) {
          // otherSymptoms가 비어있으면 하드코딩 메시지 표시
          const emptyMessage: Message = {
            id: `${sectionKey}_empty_${Date.now()}`,
            role: 'assistant',
            content: getOtherPainEmptyMessage(),
            timestamp: new Date(),
          };
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            newMap.set(sectionKey, [emptyMessage]);
            return newMap;
          });
          
          setIsProcessingGPT(false);
          
          // 자동으로 완료 처리하고 다음 서브섹션으로 이동
          setTimeout(() => {
            setCompletedNewPainSubSections(prev => {
              const updated = new Set(prev);
              updated.add(subSection);
              return updated;
            });
            setMaxReachedNewPainSubSectionIndex(subSectionIndex);
            
            // 다음 서브섹션으로 자동 이동
            if (subSectionIndex + 1 < newPainSubSections.length) {
              const nextSubSection = newPainSubSections[subSectionIndex + 1];
              setTimeout(() => {
                handleNewPainSubSectionChange(nextSubSection.key);
              }, 2000);
            } else {
              // 모든 서브섹션이 완료되었는지 확인 (handleSendMessage에서 실제 완료 처리됨)
              // 여기서는 자동 전환하지 않음
              setMaxReachedIndex(prevIndex => Math.max(prevIndex, 2)); // 부작용 섹션 인덱스
            }
          }, 2000);
        } else {
          // otherSymptoms가 있으면 첫 번째 증상에 대해 질문 시작
          const firstOtherSymptom = otherSymptoms[0];
          const symptomName = firstOtherSymptom.name;
          
          // 하드코딩된 초기 메시지
          const introMessage = getOtherPainFirstQuestion(symptomName);
          
          const introAssistantMessage: Message = {
            id: `${sectionKey}_assistant_intro_${Date.now()}`,
            role: 'assistant',
            content: introMessage,
            timestamp: new Date(),
          };
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            newMap.set(sectionKey, [introAssistantMessage]);
            return newMap;
          });
          
          // GPT 응답은 생성하지 않음 - 사용자가 먼저 답변할 수 있게 함
          setIsProcessingGPT(false);
        }
      }
    } else if (subSection === 'new_pain') {
      // "새로운 통증" 서브섹션인 경우 하이라이트 제거
      setHighlightedBodyParts([]);
      
      if (!isActivated) {
        // 이전 setTimeout 취소 (중복 실행 방지)
        if (newPainQuestionTimeoutRef.current) {
          clearTimeout(newPainQuestionTimeoutRef.current);
          newPainQuestionTimeoutRef.current = null;
        }
        
        // GPT 질문 생성 여부 ref 초기화
        setIsProcessingGPT(true);
        
        // 첫 번째 하드코딩된 메시지
        const hardcodedMessage: Message = {
          id: `${sectionKey}_hardcoded_${Date.now()}`,
          role: 'assistant',
          content: getNewPainHardcodedMessage(),
          timestamp: new Date(),
        };
        
        // 하드코딩된 메시지 먼저 표시
        setMessagesBySection(prev => {
          const newMap = new Map(prev);
          // 이미 메시지가 있으면 추가하지 않음 (중복 방지)
          const existingMessages = newMap.get(sectionKey) || [];
          const hasHardcodedMessage = existingMessages.some(msg => msg.content === getNewPainHardcodedMessage());
          if (!hasHardcodedMessage) {
            newMap.set(sectionKey, [hardcodedMessage]);
          }
          return newMap;
        });
        
        // GPT가 생성한 질문을 가져와서 추가
        if (medicalRecordAnalysis) {
          try {
            const gptQuestion = await generateNewPainQuestion(
              patientName,
              medicalRecordAnalysis
            );
            
            // GPT 질문 메시지 추가 (800ms 후)
            const timeoutId = setTimeout(() => {
              setMessagesBySection(prev => {
                const newMap = new Map(prev);
                const existingMessages = newMap.get(sectionKey) || [];
                // 이미 같은 내용의 GPT 질문이 있으면 추가하지 않음 (중복 방지)
                const hasGptQuestion = existingMessages.some(msg => 
                  msg.role === 'assistant' && 
                  msg.content.includes('앞에서 이야기한 증상들 외에')
                );
                if (!hasGptQuestion) {
                  const gptMessage: Message = {
                    id: `${sectionKey}_gpt_${Date.now()}`,
                    role: 'assistant',
                    content: gptQuestion,
                    timestamp: new Date(),
                  };
                  newMap.set(sectionKey, [...existingMessages, gptMessage]);
                }
                return newMap;
              });
              
              setIsProcessingGPT(false);
              newPainQuestionTimeoutRef.current = null;
            }, 800);
            
            newPainQuestionTimeoutRef.current = timeoutId;
          } catch (error) {
            console.error('새로운 통증 질문 생성 오류:', error);
            setIsProcessingGPT(false);
          }
        } else {
          setIsProcessingGPT(false);
        }
      }
    }

    if (subSectionIndex === maxReachedNewPainSubSectionIndex + 1) {
      setMaxReachedNewPainSubSectionIndex(subSectionIndex);
      // 완료 처리는 handleSendMessage에서 response.isComplete일 때만 수행됨
    }
  };

  const handleSideEffectSubSectionChange = async (subSection: SideEffectSubSection) => {
    const subSectionIndex = sideEffectSubSections.findIndex(s => s.key === subSection);
    if (subSectionIndex === -1) return;

    // 이미 메시지가 있는 서브섹션은 한번 활성화된 것이므로 순서 제한 없이 클릭 가능
    const sectionKey = `side_effects_${subSection}`;
    const existingMessages = messagesBySection.get(sectionKey);
    const isActivated = existingMessages && existingMessages.length > 0;
    
    // 한번 활성화되지 않은 서브섹션만 순서 제한 적용 (테스트 모드에서는 비활성화)
    if (!TEST_MODE && !isActivated) {
      const nextAllowedIndex = maxReachedSideEffectSubSectionIndex + 1;
      if (subSectionIndex > nextAllowedIndex) {
        return;
      }
    }

    setCurrentSideEffectSubSection(subSection);

    // "복용 약" 서브섹션 처리
    if (subSection === 'medication') {
      if (!isActivated) {
        setIsProcessingGPT(true);
        
        // 약물 리스트 가져오기
        const medications = medicalRecordAnalysis?.medications || [];
        const medicationNames = medications.map(med => med.name);
        
        if (medicationNames.length === 0) {
          // 약물이 없으면 하드코딩 메시지 표시
          const emptyMessage: Message = {
            id: `${sectionKey}_empty_${Date.now()}`,
            role: 'assistant',
            content: getMedicationEmptyMessage(),
            timestamp: new Date(),
          };
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            newMap.set(sectionKey, [emptyMessage]);
            return newMap;
          });
          
          // 자동으로 완료 처리
          setTimeout(() => {
            setCompletedSideEffectSubSections(prev => {
              const updated = new Set(prev);
              updated.add(subSection);
              if (updated.size === sideEffectSubSections.length) {
                setMaxReachedIndex(prevIndex => Math.max(prevIndex, 3)); // 기타 섹션 인덱스
                
                // 다음 카테고리로 자동 전환 (2초 후)
                const currentCategoryIndex = categoryOrder.indexOf('side_effects');
                if (currentCategoryIndex < categoryOrder.length - 1) {
                  const nextCategory = categoryOrder[currentCategoryIndex + 1];
                  setTimeout(() => {
                    handleCategoryChange(nextCategory);
                    // 첫 번째 서브섹션은 사용자가 직접 클릭해야 함 (자동 시작하지 않음)
                  }, 2500);
                }
              }
              return updated;
            });
            setIsProcessingGPT(false);
          }, 2000);
        } else {
          // 약물이 있으면 하드코딩 메시지 먼저 생성
          const medicationsText = medicationNames.length === 1 
            ? medicationNames[0] 
            : medicationNames.slice(0, -1).join(', ') + ', ' + medicationNames[medicationNames.length - 1];
          
          const hardcodedMessage: Message = {
            id: `${sectionKey}_hardcoded_${Date.now()}`,
            role: 'assistant',
            content: getMedicationHardcodedMessage(medicationsText),
            timestamp: new Date(),
          };
          
          // 하드코딩 메시지 먼저 추가
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            newMap.set(sectionKey, [hardcodedMessage]);
            return newMap;
          });
          
          // GPT가 이어서 질문 생성
          try {
            const gptQuestion = await generateSideEffectQuestion(
              patientInfo.name,
              medicationNames
            );
            
            const gptMessage: Message = {
              id: `${sectionKey}_gpt_${Date.now()}`,
              role: 'assistant',
              content: gptQuestion,
              timestamp: new Date(),
            };
            
            setMessagesBySection(prev => {
              const newMap = new Map(prev);
              const existingMessages = newMap.get(sectionKey) || [];
              newMap.set(sectionKey, [...existingMessages, gptMessage]);
              return newMap;
            });
          } catch (error) {
            console.error('부작용 질문 생성 오류:', error);
            const errorMessage: Message = {
              id: `${sectionKey}_error_${Date.now()}`,
              role: 'assistant',
              content: '혹시 해당 약때문에 생긴 불편한 점들이 있으실까요?',
              timestamp: new Date(),
            };
            
            setMessagesBySection(prev => {
              const newMap = new Map(prev);
              const existingMessages = newMap.get(sectionKey) || [];
              newMap.set(sectionKey, [...existingMessages, errorMessage]);
              return newMap;
            });
          } finally {
            setIsProcessingGPT(false);
          }
        }
      }
    }

    if (TEST_MODE || subSectionIndex === maxReachedSideEffectSubSectionIndex + 1) {
      setMaxReachedSideEffectSubSectionIndex(subSectionIndex);
    }
  };

  const handleAdditionalSubSectionChange = async (subSection: AdditionalSubSection) => {
    const subSectionIndex = additionalSubSections.findIndex(s => s.key === subSection);
    if (subSectionIndex === -1) return;

    // 이미 메시지가 있는 서브섹션은 한번 활성화된 것이므로 순서 제한 없이 클릭 가능
    const sectionKey = `additional_questions_${subSection}`;
    const existingMessages = messagesBySection.get(sectionKey);
    const isActivated = existingMessages && existingMessages.length > 0;
    
    // 한번 활성화되지 않은 서브섹션만 순서 제한 적용 (테스트 모드에서는 비활성화)
    if (!TEST_MODE && !isActivated) {
      const nextAllowedIndex = maxReachedAdditionalSubSectionIndex + 1;
      if (subSectionIndex > nextAllowedIndex) {
        return;
      }
    }

    setCurrentAdditionalSubSection(subSection);

    // "추가 질문" 서브섹션 처리
    if (subSection === 'additional_question') {
      if (!isActivated) {
        setIsProcessingGPT(true);
        
        // 하드코딩 메시지 먼저 추가
        const hardcodedMessage: Message = {
          id: `${sectionKey}_hardcoded_${Date.now()}`,
          role: 'assistant',
          content: getAdditionalHardcodedMessage(),
          timestamp: new Date(),
        };
        
        setMessagesBySection(prev => {
          const newMap = new Map(prev);
          newMap.set(sectionKey, [hardcodedMessage]);
          return newMap;
        });
        
        // GPT가 이어서 질문 생성
        try {
          const gptQuestion = await generateAdditionalQuestion(
            patientInfo.name,
            medicalRecordAnalysis?.mainDiagnosis || ''
          );
          
          const gptMessage: Message = {
            id: `${sectionKey}_gpt_${Date.now()}`,
            role: 'assistant',
            content: gptQuestion,
            timestamp: new Date(),
          };
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get(sectionKey) || [];
            newMap.set(sectionKey, [...existingMessages, gptMessage]);
            return newMap;
          });
        } catch (error) {
          console.error('추가 질문 생성 오류:', error);
          const errorMessage: Message = {
            id: `${sectionKey}_error_${Date.now()}`,
            role: 'assistant',
            content: '추가로 궁금하신 점이나 전달하고 싶은 내용이 있으신가요?',
            timestamp: new Date(),
          };
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get(sectionKey) || [];
            newMap.set(sectionKey, [...existingMessages, errorMessage]);
            return newMap;
          });
        } finally {
          setIsProcessingGPT(false);
        }
      }
    }

    if (TEST_MODE || subSectionIndex === maxReachedAdditionalSubSectionIndex + 1) {
      setMaxReachedAdditionalSubSectionIndex(subSectionIndex);
    }
  };

  // 현재 활성화된 서브섹션의 메시지만 가져오기
  const getCurrentMessages = (): Message[] => {
    // 현재 카테고리에 따라 메시지 반환 (카테고리를 먼저 확인하여 이전 카테고리의 서브섹션이 남아있어도 올바른 메시지 반환)
    
    // 그외/새로운 통증 섹션
    if (currentCategory === 'other_new_pain') {
      if (currentNewPainSubSection) {
        const sectionKey = `other_new_pain_${currentNewPainSubSection}`;
        return messagesBySection.get(sectionKey) || [];
      }
      return messagesBySection.get('other_new_pain_intro') || [];
    }
    
    // 부작용 섹션
    if (currentCategory === 'side_effects') {
      if (currentSideEffectSubSection) {
        const sectionKey = `side_effects_${currentSideEffectSubSection}`;
        return messagesBySection.get(sectionKey) || [];
      }
      return messagesBySection.get('side_effects_intro') || [];
    }
    
    // 기타 섹션
    if (currentCategory === 'additional_questions') {
      if (currentAdditionalSubSection) {
        const sectionKey = `additional_questions_${currentAdditionalSubSection}`;
        return messagesBySection.get(sectionKey) || [];
      }
      return messagesBySection.get('additional_questions_intro') || [];
    }
    
    // 주요 진단 내용 섹션
    if (currentCategory === 'main_diagnosis') {
      if (currentMainDiagnosisSubSection) {
        const sectionKey = `main_diagnosis_${currentMainDiagnosisSubSection}`;
        return messagesBySection.get(sectionKey) || [];
      }
      return messagesBySection.get('main_diagnosis_intro') || [];
    }
    
    return [];
  };

  const currentMessages = getCurrentMessages();

  // 서브섹션이 변경될 때 하이라이트 유지 (handleMainDiagnosisSubSectionChange에서 설정한 값 유지)
  // 이 useEffect는 제거되었고, 하이라이트는 handleMainDiagnosisSubSectionChange에서 직접 설정됩니다.

  // 주요 진단 내용 섹션 선택 시 인트로 메시지 표시 (스크립트)
  useEffect(() => {
    if (
      currentCategory === 'main_diagnosis' && 
      !currentMainDiagnosisSubSection && 
      !mainDiagnosisIntroShownRef.current &&
      medicalRecordAnalysis?.mainDiagnosis
    ) {
      setIsGeneratingIntro(true);
      mainDiagnosisIntroShownRef.current = true; // 중복 호출 방지
      
      // 첫 번째 증상 이름 가져오기
      const firstSymptomName = mainDiagnosisSubSections[0]?.label || '증상 A';
      
      // 스크립트로 인삿말 생성 (4개 메시지)
      const introMessages: string[] = getMainDiagnosisIntroMessages(
        patientName,
        medicalRecordAnalysis.mainDiagnosis,
        firstSymptomName
      );
      
      // 메시지를 하나씩 순차적으로 추가
      introMessages.forEach((content, index) => {
        setTimeout(() => {
          const newMessage: Message = {
            id: `main_diagnosis_intro_${index}_${Date.now()}`,
            role: 'assistant',
            content,
            timestamp: new Date(),
          };
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get('main_diagnosis_intro') || [];
            newMap.set('main_diagnosis_intro', [...existingMessages, newMessage]);
            return newMap;
          });
          
          // 마지막 메시지 추가 후 로딩 상태 해제
          if (index === introMessages.length - 1) {
            setTimeout(() => {
              setIsGeneratingIntro(false);
            }, 100);
          }
        }, index * 800); // 각 메시지 간 800ms 간격
      });
    }
  }, [currentCategory, currentMainDiagnosisSubSection, patientName, medicalRecordAnalysis, mainDiagnosisSubSections]);

  // 그외/새로운 통증 섹션 인삿말 표시
  useEffect(() => {
    if (
      currentCategory === 'other_new_pain' &&
      !currentNewPainSubSection &&
      !newPainIntroShownRef.current &&
      medicalRecordAnalysis
    ) {
      setIsGeneratingIntro(true);
      newPainIntroShownRef.current = true; // 중복 호출 방지
      
      // 인삿말 메시지 생성
      const introMessages: string[] = getOtherNewPainIntroMessages(patientName);
      
      // 메시지를 하나씩 순차적으로 추가
      introMessages.forEach((content, index) => {
        setTimeout(() => {
          const newMessage: Message = {
            id: `other_new_pain_intro_${index}_${Date.now()}`,
            role: 'assistant',
            content,
            timestamp: new Date(),
          };
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get('other_new_pain_intro') || [];
            newMap.set('other_new_pain_intro', [...existingMessages, newMessage]);
            return newMap;
          });
          
          // 마지막 메시지 추가 후 isGeneratingIntro 해제
          if (index === introMessages.length - 1) {
            setTimeout(() => {
              setIsGeneratingIntro(false);
            }, 500);
          }
        }, index * 800); // 각 메시지 간 800ms 간격
      });
    }
  }, [currentCategory, currentNewPainSubSection, medicalRecordAnalysis, patientName, newPainSubSections]);

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
    if (currentCategory === 'other_new_pain' && currentNewPainSubSection) {
      loadScript('other_new_pain', currentNewPainSubSection);
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

  // 사용자 메시지에서 종료 키워드 확인 함수
  const checkForTerminationKeywords = (content: string): boolean => {
    const normalizedContent = content.trim();
    // "대화 종료" 키워드 확인
    return normalizedContent.includes('대화 종료');
  };

  // 강제 종료 처리 함수
  const handleForceComplete = async (sectionKey: string, category: Category, subSection: string | null) => {
    // 각 섹션별 하드코딩된 완료 메시지 사용
    let completionMessageText = '';
    if (category === 'main_diagnosis') {
      completionMessageText = getMainDiagnosisCompletionMessage();
    } else if (category === 'other_new_pain') {
      completionMessageText = getNewPainCompletionMessage();
    } else if (category === 'side_effects') {
      completionMessageText = getSideEffectCompletionMessage();
    } else if (category === 'additional_questions') {
      completionMessageText = getAdditionalCompletionMessage();
    }
    
    // 감사 메시지 추가
    const completionMessage: Message = {
      id: `${sectionKey}_completion_${Date.now()}`,
      role: 'assistant',
      content: completionMessageText,
      timestamp: new Date(),
    };
    
    setMessagesBySection(prev => {
      const newMap = new Map(prev);
      const existingMessages = newMap.get(sectionKey) || [];
      newMap.set(sectionKey, [...existingMessages, completionMessage]);
      return newMap;
    });
    
    // 완료 처리 및 다음으로 이동
    if (category === 'main_diagnosis' && subSection) {
      const subSectionKey = `main_diagnosis_${subSection}`;
      const subSectionIndex = mainDiagnosisSubSections.findIndex(s => s.key === subSection);
      
      // 완료 상태 설정 (두 가지 모두 설정)
      setCompletedSymptomSubSections(prev => new Set([...prev, subSectionKey]));
      setCompletedMainDiagnosisSubSections(prev => {
        const updated = new Set(prev);
        updated.add(subSection as MainDiagnosisSubSection);
        return updated;
      });
      // maxReached 인덱스 업데이트
      setMaxReachedMainDiagnosisSubSectionIndex(subSectionIndex);
      
      // 다음 서브섹션으로 이동
      if (subSectionIndex + 1 < mainDiagnosisSubSections.length) {
        const nextSubSection = mainDiagnosisSubSections[subSectionIndex + 1];
        setTimeout(() => {
          handleMainDiagnosisSubSectionChange(nextSubSection.key);
        }, 2000);
      } else {
        // 모든 서브섹션 완료 시 다음 카테고리로 이동
        setMaxReachedIndex(1);
        setTimeout(() => {
          handleCategoryChange('other_new_pain');
        }, 2000);
      }
    } else if (category === 'other_new_pain' && subSection) {
      const subSectionIndex = newPainSubSections.findIndex(s => s.key === subSection);
      
      // 완료 상태 설정
      setCompletedNewPainSubSections(prev => {
        const updated = new Set(prev);
        updated.add(subSection as NewPainSubSection);
        return updated;
      });
      // maxReached 인덱스 업데이트
      setMaxReachedNewPainSubSectionIndex(subSectionIndex);
      
      // 다음 서브섹션으로 이동
      if (subSectionIndex + 1 < newPainSubSections.length) {
        const nextSubSection = newPainSubSections[subSectionIndex + 1];
        setTimeout(() => {
          handleNewPainSubSectionChange(nextSubSection.key);
        }, 2000);
      } else {
        // 모든 서브섹션 완료 시 다음 카테고리로 이동
        setMaxReachedIndex(2);
        setTimeout(() => {
          handleCategoryChange('side_effects');
        }, 2000);
      }
    } else if (category === 'side_effects' && subSection) {
      const subSectionIndex = sideEffectSubSections.findIndex(s => s.key === subSection);
      
      // 완료 상태 설정 및 모든 서브섹션 완료 확인
      setCompletedSideEffectSubSections(prev => {
        const updated = new Set(prev);
        updated.add(subSection as SideEffectSubSection);
        
        // 모든 서브섹션 완료 확인
        if (updated.size === sideEffectSubSections.length) {
          // 모든 서브섹션 완료 시 다음 카테고리로 이동
          setMaxReachedIndex(3);
          setTimeout(() => {
            handleCategoryChange('additional_questions');
          }, 2000);
        }
        
        return updated;
      });
      // maxReached 인덱스 업데이트
      setMaxReachedSideEffectSubSectionIndex(subSectionIndex);
    } else if (category === 'additional_questions' && subSection) {
      const subSectionIndex = additionalSubSections.findIndex(s => s.key === subSection);
      
      // 완료 상태 설정
      setCompletedAdditionalSubSections(prev => {
        const updated = new Set(prev);
        updated.add(subSection as AdditionalSubSection);
        
        // 모든 서브섹션 완료 확인
        if (updated.size === additionalSubSections.length) {
          // 모든 대화 완료
          setTimeout(() => {
            const conversationLog = createConversationLog();
            downloadConversationLog();
            onConversationComplete?.(conversationLog);
          }, 2000);
        }
        
        return updated;
      });
      // maxReached 인덱스 업데이트
      setMaxReachedAdditionalSubSectionIndex(subSectionIndex);
    }
  };

  const handleSendMessage = async (content: string) => {
    // 주요 진단 내용 섹션에서 서브섹션이 없으면 메시지 받지 않음
    if (currentCategory === 'main_diagnosis' && !currentMainDiagnosisSubSection) {
      return;
    }

    // 완료된 증상 서브섹션에서는 메시지 받지 않음
    if (currentCategory === 'main_diagnosis' && currentMainDiagnosisSubSection) {
      const sectionKey = `main_diagnosis_${currentMainDiagnosisSubSection}`;
      if (completedSymptomSubSections.has(sectionKey)) {
        return;
      }
    }
    
    // 현재 활성화된 서브섹션 키 찾기
    let sectionKey: string | null = null;
    let currentSubSection: string | null = null;
    
    if (currentCategory === 'main_diagnosis' && currentMainDiagnosisSubSection) {
      sectionKey = `main_diagnosis_${currentMainDiagnosisSubSection}`;
      currentSubSection = currentMainDiagnosisSubSection;
    } else if (currentCategory === 'other_new_pain' && currentNewPainSubSection) {
      sectionKey = `other_new_pain_${currentNewPainSubSection}`;
      currentSubSection = currentNewPainSubSection;
    } else if (currentCategory === 'side_effects' && currentSideEffectSubSection) {
      sectionKey = `side_effects_${currentSideEffectSubSection}`;
      currentSubSection = currentSideEffectSubSection;
    } else if (currentCategory === 'additional_questions' && currentAdditionalSubSection) {
      sectionKey = `additional_questions_${currentAdditionalSubSection}`;
      currentSubSection = currentAdditionalSubSection;
    }
    
    if (!sectionKey) return; // 활성화된 서브섹션이 없으면 메시지 추가 안 함
    
    // 종료 키워드 확인
    if (checkForTerminationKeywords(content)) {
      await handleForceComplete(sectionKey, currentCategory, currentSubSection);
      return;
    }
    
    // 사용자 메시지를 해당 서브섹션에 추가
    const userMessage: Message = {
      id: `${sectionKey}_user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    // 기존 메시지 가져오기 (대화 히스토리용)
    const existingMessages = messagesBySection.get(sectionKey!) || [];
    const updatedMessages = [...existingMessages, userMessage];
    
    setMessagesBySection(prev => {
      const newMap = new Map(prev);
      newMap.set(sectionKey!, updatedMessages);
      return newMap;
    });

    // 주요 진단 내용의 증상 서브섹션인 경우 GPT 응답 받기
    if (currentCategory === 'main_diagnosis' && currentMainDiagnosisSubSection) {
      const subSection = currentMainDiagnosisSubSection;
      if (subSection === 'diagnosis_a' || subSection === 'diagnosis_b' || subSection === 'diagnosis_c') {
        setIsProcessingGPT(true);

        // 증상 정보 가져오기
        const symptomIndex = subSection === 'diagnosis_a' ? 0 : subSection === 'diagnosis_b' ? 1 : 2;
        const symptom = medicalRecordAnalysis?.symptoms[symptomIndex];
        const symptomName = symptom?.name || mainDiagnosisSubSections.find(s => s.key === subSection)?.label || '증상';
        const mentioned = symptom?.mentioned ?? false;
        const present = symptom?.present ?? false;

        // 대화 히스토리 가져오기 (방금 추가한 사용자 메시지 포함)
        const conversationHistory = updatedMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        try {
          // 질문 개수 계산
          const questionCount = conversationHistory.filter(msg => msg.role === 'assistant').length;
          
          const response: SymptomChatResponse = await chatAboutSymptom(
            symptomName,
            mentioned,
            present,
            patientInfo.name,
            medicalRecordAnalysis?.mainDiagnosis || '',
            conversationHistory,
            questionCount
          );

          // GPT 응답 추가
          let assistantMessage: Message;
          
          if (response.isComplete) {
            // 완료 메시지는 고정된 메시지로 변경
            assistantMessage = {
              id: `${sectionKey}_assistant_${Date.now()}`,
              role: 'assistant',
              content: getMainDiagnosisCompletionMessage(),
              timestamp: new Date(),
            };
          } else {
            assistantMessage = {
              id: `${sectionKey}_assistant_${Date.now()}`,
              role: 'assistant',
              content: response.message,
              timestamp: new Date(),
            };
          }

          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get(sectionKey!) || [];
            newMap.set(sectionKey!, [...existingMessages, assistantMessage]);
            return newMap;
          });

          // 완료 여부 확인
          if (response.isComplete) {
            const subSectionIndex = mainDiagnosisSubSections.findIndex(s => s.key === subSection);
            handleSymptomComplete(subSection, subSectionIndex);
          }
        } catch (error) {
          console.error('GPT 응답 오류:', error);
          // 오류 메시지 추가
          const errorMessage: Message = {
            id: `${sectionKey}_error_${Date.now()}`,
            role: 'assistant',
            content: '죄송합니다. 다시 질문해도 될까요?',
            timestamp: new Date(),
          };

          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get(sectionKey!) || [];
            newMap.set(sectionKey!, [...existingMessages, errorMessage]);
            return newMap;
          });
        } finally {
          setIsProcessingGPT(false);
        }
      } else if (subSection === 'examination') {
        // 검사 서브섹션인 경우: GPT가 대화 기록을 보고 추가 질문 또는 완료 처리
        setIsProcessingGPT(true);

        // 검사 정보 가져오기
        const examinations = medicalRecordAnalysis?.examinations || [];
        if (examinations.length > 0) {
          const examinationName = examinations[0].name;

          // 대화 히스토리 가져오기 (방금 추가한 사용자 메시지 포함)
          const conversationHistory = updatedMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          }));

          try {
            const response: SymptomChatResponse = await chatAboutExamination(
              examinationName,
              patientInfo.name,
              medicalRecordAnalysis?.mainDiagnosis || '',
              conversationHistory
            );

            // GPT 응답 추가
            let assistantMessage: Message;
            
          if (response.isComplete) {
            // 완료 메시지는 고정된 메시지
            assistantMessage = {
              id: `${sectionKey}_assistant_${Date.now()}`,
              role: 'assistant',
              content: getNewPainCompletionMessage(),
              timestamp: new Date(),
            };
              
              // 검사 서브섹션 완료 처리 (handleSymptomComplete와 동일한 패턴)
              const subSectionIndex = mainDiagnosisSubSections.findIndex(s => s.key === subSection);
              handleSymptomComplete(subSection, subSectionIndex);
            } else {
              // 추가 질문
              assistantMessage = {
                id: `${sectionKey}_assistant_${Date.now()}`,
                role: 'assistant',
                content: response.message,
                timestamp: new Date(),
              };
            }

            setMessagesBySection(prev => {
              const newMap = new Map(prev);
              const existingMessages = newMap.get(sectionKey!) || [];
              newMap.set(sectionKey!, [...existingMessages, assistantMessage]);
              return newMap;
            });
          } catch (error) {
            console.error('GPT 응답 오류:', error);
            const errorMessage: Message = {
              id: `${sectionKey}_error_${Date.now()}`,
              role: 'assistant',
              content: '죄송합니다. 다시 질문해도 될까요?',
              timestamp: new Date(),
            };

            setMessagesBySection(prev => {
              const newMap = new Map(prev);
              const existingMessages = newMap.get(sectionKey!) || [];
              newMap.set(sectionKey!, [...existingMessages, errorMessage]);
              return newMap;
            });
          } finally {
            setIsProcessingGPT(false);
          }
        }
      }
    }
    
    // 그외/새로운 통증 서브섹션인 경우
    if (currentCategory === 'other_new_pain' && currentNewPainSubSection) {
      const subSection = currentNewPainSubSection;
      
      if (subSection === 'other_pain') {
        setIsProcessingGPT(true);
        
        // otherSymptoms의 첫 번째 증상 가져오기
        const otherSymptoms = medicalRecordAnalysis?.otherSymptoms || [];
        if (otherSymptoms.length > 0) {
          const firstOtherSymptom = otherSymptoms[0];
          const symptomName = firstOtherSymptom.name;
          
          // otherSymptoms는 항상 mentioned=true이므로
          const mentioned = true;
          const present = true; // 언급되었다는 것은 증상이 있었다는 의미
          
          // 대화 히스토리 가져오기 (방금 추가한 사용자 메시지 포함)
          const conversationHistory = updatedMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          }));
          
          try {
            // 질문 개수 계산
            const questionCount = conversationHistory.filter(msg => msg.role === 'assistant').length;
            
            const response: SymptomChatResponse = await chatAboutSymptom(
              symptomName,
              mentioned,
              present,
              patientInfo.name,
              medicalRecordAnalysis?.mainDiagnosis || '',
              conversationHistory,
              questionCount
            );
            
            // GPT 응답 추가
            let assistantMessage: Message;
            
            if (response.isComplete) {
              // 완료 메시지는 고정된 메시지로 변경
              assistantMessage = {
                id: `${sectionKey}_assistant_${Date.now()}`,
                role: 'assistant',
                content: getMainDiagnosisCompletionMessage(),
                timestamp: new Date(),
              };
            } else {
              assistantMessage = {
                id: `${sectionKey}_assistant_${Date.now()}`,
                role: 'assistant',
                content: response.message,
                timestamp: new Date(),
              };
            }
            
            setMessagesBySection(prev => {
              const newMap = new Map(prev);
              const existingMessages = newMap.get(sectionKey!) || [];
              newMap.set(sectionKey!, [...existingMessages, assistantMessage]);
              return newMap;
            });
            
            // 완료 여부 확인
            if (response.isComplete) {
              const subSectionIndex = newPainSubSections.findIndex(s => s.key === subSection);
              
              // 완료 메시지가 실제로 표시되었는지 확인
              // (assistantMessage가 완료 메시지인 경우에만 완료 처리)
              const isCompletionMessage = assistantMessage.content.includes('답변 감사합니다');
              
              if (isCompletionMessage) {
                setCompletedNewPainSubSections(prev => {
                  const updated = new Set(prev);
                  updated.add(subSection);
                  
                  // 다음 서브섹션으로 자동 이동
                  if (subSectionIndex + 1 < newPainSubSections.length) {
                    const nextSubSection = newPainSubSections[subSectionIndex + 1];
                    setTimeout(() => {
                      handleNewPainSubSectionChange(nextSubSection.key);
                    }, 2500);
                  } else {
                    // 모든 서브섹션이 완료됨
                    if (updated.size === newPainSubSections.length) {
                      setMaxReachedIndex(prevIndex => Math.max(prevIndex, 2)); // 부작용 섹션 인덱스
                      
                      // 다음 카테고리로 자동 전환 (2.5초 후)
                      const currentCategoryIndex = categoryOrder.indexOf('other_new_pain');
                      if (currentCategoryIndex < categoryOrder.length - 1) {
                        const nextCategory = categoryOrder[currentCategoryIndex + 1];
                        setTimeout(() => {
                          handleCategoryChange(nextCategory);
                          // 첫 번째 서브섹션은 사용자가 직접 클릭해야 함 (자동 시작하지 않음)
                        }, 2500);
                      }
                    }
                  }
                  
                  return updated;
                });
                setMaxReachedNewPainSubSectionIndex(subSectionIndex);
              }
            }
          } catch (error) {
            console.error('GPT 응답 오류:', error);
            // 오류 메시지 추가
            const errorMessage: Message = {
              id: `${sectionKey}_error_${Date.now()}`,
              role: 'assistant',
              content: '죄송합니다. 다시 질문해도 될까요?',
              timestamp: new Date(),
            };
            
            setMessagesBySection(prev => {
              const newMap = new Map(prev);
              const existingMessages = newMap.get(sectionKey!) || [];
              newMap.set(sectionKey!, [...existingMessages, errorMessage]);
              return newMap;
            });
          } finally {
            setIsProcessingGPT(false);
          }
        }
      } else if (subSection === 'new_pain') {
        // 새로운 통증 서브섹션인 경우: GPT가 멀티턴 대화 진행
        setIsProcessingGPT(true);
        
        // 앞서 언급된 증상들 수집
        const mentionedSymptoms: string[] = [];
        
        // 주요 진단명과 관련된 증상들 중 언급된 것들
        if (medicalRecordAnalysis) {
          medicalRecordAnalysis.symptoms.forEach(symptom => {
            if (symptom.mentioned) {
              mentionedSymptoms.push(symptom.name);
            }
          });
          
          // 기타 증상들 (항상 mentioned=true)
          medicalRecordAnalysis.otherSymptoms.forEach(symptom => {
            mentionedSymptoms.push(symptom.name);
          });
        }
        
        // 대화 히스토리 가져오기 (방금 추가한 사용자 메시지 포함)
        const conversationHistory = updatedMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));
        
        // 첫 번째 사용자 메시지에서 증상 이름 추출 및 바디 파트 분석
        const userMessages = updatedMessages.filter(msg => msg.role === 'user');
        if (userMessages.length === 1 && medicalRecordAnalysis) {
          // 첫 번째 사용자 메시지인 경우, GPT가 증상 이름을 추출하고 바디 파트 분석
          const firstUserMessage = userMessages[0].content;
          
          try {
            // GPT가 환자 메시지에서 증상 이름들을 추출
            const extractedSymptoms = await extractSymptomsFromMessage(firstUserMessage);
            
            // 증상이 추출되었으면 바디 파트 분석
            if (extractedSymptoms.length > 0) {
              const bodyParts = await Promise.all(
                extractedSymptoms.map(async (symptom) => {
                  try {
                    const bodyPart = await determineBodyPartForSymptom(
                      symptom,
                      medicalRecordAnalysis.mainDiagnosis
                    );
                    return bodyPart;
                  } catch (error) {
                    console.error(`증상 "${symptom}"의 바디 파트 분석 오류:`, error);
                    return null;
                  }
                })
              );
              
              // null이 아닌 바디 파트만 필터링
              const validBodyParts = bodyParts.filter((bp): bp is BodyPart => bp !== null);
              if (validBodyParts.length > 0) {
                setHighlightedBodyParts(validBodyParts);
              }
            } else {
              // 증상이 없으면 바디 파트 하이라이트 제거
              setHighlightedBodyParts([]);
            }
          } catch (error) {
            console.error('증상 추출 및 바디 파트 분석 오류:', error);
          }
        }
        
        // 사용자 답변이 없으면 추가 질문 생성하지 않음
        const conversationUserMessages = conversationHistory.filter(msg => msg.role === 'user');
        if (conversationUserMessages.length === 0) {
          setIsProcessingGPT(false);
          return;
        }
        
        try {
          // chatAboutNewPain 호출 (absent와 유사한 구조)
          const response = await chatAboutNewPain(
            patientInfo.name,
            medicalRecordAnalysis?.mainDiagnosis || '',
            conversationHistory
          );
          
          // GPT 응답 추가
          let assistantMessage: Message;
          
          if (response.isComplete) {
            // 완료 메시지는 고정된 메시지
            assistantMessage = {
              id: `${sectionKey}_assistant_${Date.now()}`,
              role: 'assistant',
              content: getNewPainCompletionMessage(),
              timestamp: new Date(),
            };
            
            // 새로운 통증 서브섹션 완료 처리
            const subSection = currentNewPainSubSection;
            const subSectionIndex = newPainSubSections.findIndex(s => s.key === subSection);
            setCompletedNewPainSubSections(prev => {
              const updated = new Set(prev);
              updated.add('new_pain');
              
              // 다음 서브섹션으로 자동 이동
              if (subSectionIndex + 1 < newPainSubSections.length) {
                const nextSubSection = newPainSubSections[subSectionIndex + 1];
                setTimeout(() => {
                  handleNewPainSubSectionChange(nextSubSection.key);
                }, 2500);
              } else {
                // 모든 서브섹션이 완료됨
                if (updated.size === newPainSubSections.length) {
                  setMaxReachedIndex(prevIndex => Math.max(prevIndex, 2)); // 부작용 섹션 인덱스
                  
                  // 다음 카테고리로 자동 전환 (2.5초 후)
                  const currentCategoryIndex = categoryOrder.indexOf('other_new_pain');
                  if (currentCategoryIndex < categoryOrder.length - 1) {
                    const nextCategory = categoryOrder[currentCategoryIndex + 1];
                    setTimeout(() => {
                      handleCategoryChange(nextCategory);
                      // 첫 번째 서브섹션은 사용자가 직접 클릭해야 함 (자동 시작하지 않음)
                    }, 2500);
                  }
                }
              }
              
              return updated;
            });
            setMaxReachedNewPainSubSectionIndex(subSectionIndex);
          } else {
            // 다음 질문
            assistantMessage = {
              id: `${sectionKey}_assistant_${Date.now()}`,
              role: 'assistant',
              content: response.message,
              timestamp: new Date(),
            };
          }
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get(sectionKey!) || [];
            newMap.set(sectionKey!, [...existingMessages, assistantMessage]);
            return newMap;
          });
        } catch (error) {
          console.error('GPT 응답 오류:', error);
          // 오류 메시지 추가
          const errorMessage: Message = {
            id: `${sectionKey}_error_${Date.now()}`,
            role: 'assistant',
            content: '죄송합니다. 다시 질문해도 될까요?',
            timestamp: new Date(),
          };
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get(sectionKey!) || [];
            newMap.set(sectionKey!, [...existingMessages, errorMessage]);
            return newMap;
          });
        } finally {
          setIsProcessingGPT(false);
        }
      }
    }
    
    // 부작용 서브섹션인 경우
    if (currentCategory === 'side_effects' && currentSideEffectSubSection) {
      const subSection = currentSideEffectSubSection;
      
      if (subSection === 'medication') {
        setIsProcessingGPT(true);
        
        // 약물 리스트 가져오기
        const medications = medicalRecordAnalysis?.medications || [];
        const medicationNames = medications.map(med => med.name);
        
        // 대화 히스토리 가져오기 (방금 추가한 사용자 메시지 포함)
        const conversationHistory = updatedMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));
        
        try {
          const response: SideEffectChatResponse = await chatAboutSideEffects(
            patientInfo.name,
            medicationNames,
            conversationHistory
          );
          
          // GPT 응답 추가
          let assistantMessage: Message;
          
          if (response.isComplete) {
            // 완료 메시지는 고정된 메시지
            assistantMessage = {
              id: `${sectionKey}_assistant_${Date.now()}`,
              role: 'assistant',
              content: getSideEffectCompletionMessage(),
              timestamp: new Date(),
            };
            
            // 부작용 서브섹션 완료 처리
            setCompletedSideEffectSubSections(prev => {
              const updated = new Set(prev);
              updated.add('medication');
              if (updated.size === sideEffectSubSections.length) {
                setMaxReachedIndex(prevIndex => Math.max(prevIndex, 3)); // 기타 섹션 인덱스
                
                // 다음 카테고리로 자동 전환 (2초 후)
                const currentCategoryIndex = categoryOrder.indexOf('side_effects');
                if (currentCategoryIndex < categoryOrder.length - 1) {
                  const nextCategory = categoryOrder[currentCategoryIndex + 1];
                  setTimeout(() => {
                    handleCategoryChange(nextCategory);
                    // 첫 번째 서브섹션은 사용자가 직접 클릭해야 함 (자동 시작하지 않음)
                  }, 2500);
                }
              }
              return updated;
            });
          } else {
            // 추가 질문
            assistantMessage = {
              id: `${sectionKey}_assistant_${Date.now()}`,
              role: 'assistant',
              content: response.message,
              timestamp: new Date(),
            };
          }
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get(sectionKey!) || [];
            newMap.set(sectionKey!, [...existingMessages, assistantMessage]);
            return newMap;
          });
        } catch (error) {
          console.error('GPT 응답 오류:', error);
          // 오류 메시지 추가
          const errorMessage: Message = {
            id: `${sectionKey}_error_${Date.now()}`,
            role: 'assistant',
            content: '죄송합니다. 다시 질문해도 될까요?',
            timestamp: new Date(),
          };
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get(sectionKey!) || [];
            newMap.set(sectionKey!, [...existingMessages, errorMessage]);
            return newMap;
          });
        } finally {
          setIsProcessingGPT(false);
        }
      }
    }
    
    // 기타 서브섹션인 경우
    if (currentCategory === 'additional_questions' && currentAdditionalSubSection) {
      const subSection = currentAdditionalSubSection;
      
      if (subSection === 'additional_question') {
        setIsProcessingGPT(true);
        
        // 대화 히스토리 가져오기 (방금 추가한 사용자 메시지 포함)
        const conversationHistory = updatedMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));
        
        try {
          const response: AdditionalChatResponse = await chatAboutAdditional(
            patientInfo.name,
            medicalRecordAnalysis?.mainDiagnosis || '',
            conversationHistory
          );
          
          // GPT 응답 추가
          let assistantMessage: Message;
          
          if (response.isComplete) {
            // 완료 메시지는 고정된 메시지
            assistantMessage = {
              id: `${sectionKey}_assistant_${Date.now()}`,
              role: 'assistant',
              content: getAdditionalCompletionMessage(),
              timestamp: new Date(),
            };
            
            // 기타 서브섹션 완료 처리
            setCompletedAdditionalSubSections(prev => {
              const updated = new Set(prev);
              updated.add('additional_question');
              
              // 모든 섹션이 완료되면 다음 페이지로 이동
              if (updated.size === additionalSubSections.length && onConversationComplete) {
                // 최종 대화 로그 저장 및 자동 다운로드 후 다음 페이지로 이동
                setTimeout(() => {
                  saveConversationToLocalStorage();
                  const conversationLog = createConversationLog();
                  downloadConversationLog(); // 자동 다운로드
                  onConversationComplete(conversationLog); // conversation log 전달
                }, 1000);
              }
              
              return updated;
            });
          } else {
            // 추가 질문
            assistantMessage = {
              id: `${sectionKey}_assistant_${Date.now()}`,
              role: 'assistant',
              content: response.message,
              timestamp: new Date(),
            };
          }
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get(sectionKey!) || [];
            newMap.set(sectionKey!, [...existingMessages, assistantMessage]);
            return newMap;
          });
        } catch (error) {
          console.error('GPT 응답 오류:', error);
          // 오류 메시지 추가
          const errorMessage: Message = {
            id: `${sectionKey}_error_${Date.now()}`,
            role: 'assistant',
            content: '죄송합니다. 다시 한번 말씀해주실 수 있나요?',
            timestamp: new Date(),
          };
          
          setMessagesBySection(prev => {
            const newMap = new Map(prev);
            const existingMessages = newMap.get(sectionKey!) || [];
            newMap.set(sectionKey!, [...existingMessages, errorMessage]);
            return newMap;
          });
        } finally {
          setIsProcessingGPT(false);
        }
      }
    }
    
  };

  // 컴포넌트 마운트 시 로컬 스토리지에서 복구
  useEffect(() => {
    const restored = loadConversationFromLocalStorage();
    if (restored) {
    }
  }, []); // 빈 의존성 배열로 마운트 시 한 번만 실행

  // messagesBySection이 변경될 때마다 로컬 스토리지에 저장
  useEffect(() => {
    if (messagesBySection.size > 0) {
      saveConversationToLocalStorage();
    }
  }, [messagesBySection]);

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
        maxReachedIndex={TEST_MODE ? 3 : maxReachedIndex} // 테스트 모드에서는 모든 탭 접근 가능
        isMainDiagnosisComplete={TEST_MODE || completedMainDiagnosisSubSections.size === mainDiagnosisSubSections.length}
        isNewPainComplete={TEST_MODE || completedNewPainSubSections.size === newPainSubSections.length}
        isSideEffectsComplete={TEST_MODE || completedSideEffectSubSections.size === sideEffectSubSections.length}
        testMode={TEST_MODE}
      />
      
      {/* 그외/새로운 통증 섹션일 때 서브 섹션 탭 표시 - 메인 탭 바로 아래에 수평으로 팝업 */}
      {currentCategory === 'other_new_pain' && (
        <div className="absolute left-[380px] top-[111px] animate-fade-in-slide">
          {/* 서브 섹션 카드 - 일반 직사각형 둥근 모서리, 수평 배치 */}
          <div className="bg-white rounded-xl shadow-lg border border-zinc-300 px-4 py-3">
            {/* 서브 섹션 버튼들 - 가로로 배치 */}
            <div className="flex gap-3">
              {newPainSubSections.map((subSection, index) => {
                const isActive = currentNewPainSubSection === subSection.key;
                const isCompleted = completedNewPainSubSections.has(subSection.key);
                // 첫 번째 서브 섹션은 항상 클릭 가능, 나머지는 순서대로 (테스트 모드에서는 모두 클릭 가능)
                const isReachable = TEST_MODE || index === 0 || index <= maxReachedNewPainSubSectionIndex + 1;
                const isDisabled = TEST_MODE ? false : !isReachable;
                
                return (
                  <button
                    key={subSection.key}
                    onClick={() => {
                      if (TEST_MODE || isReachable) {
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
                // 테스트 모드에서는 모두 클릭 가능
                const isReachable = TEST_MODE || (maxReachedSideEffectSubSectionIndex === -1
                  ? index === 0
                  : index <= maxReachedSideEffectSubSectionIndex + 1);
                const isDisabled = TEST_MODE ? false : !isReachable;

                return (
                  <button
                    key={subSection.key}
                    onClick={() => {
                      if (TEST_MODE || isReachable) {
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
                // 테스트 모드에서는 모두 클릭 가능
                const isReachable = TEST_MODE || (maxReachedAdditionalSubSectionIndex === -1
                  ? index === 0
                  : index <= maxReachedAdditionalSubSectionIndex + 1);
                const isDisabled = TEST_MODE ? false : !isReachable;

                return (
                  <button
                    key={subSection.key}
                    onClick={() => {
                      if (TEST_MODE || isReachable) {
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
                // 첫 번째 서브 섹션만 클릭 가능, 나머지는 순서대로 (테스트 모드에서는 모두 클릭 가능)
                const isReachable = TEST_MODE || (maxReachedMainDiagnosisSubSectionIndex === -1 
                  ? index === 0  // 처음에는 첫 번째만
                  : index <= maxReachedMainDiagnosisSubSectionIndex + 1);  // 이후에는 순차적으로
                const isDisabled = TEST_MODE ? false : !isReachable;
                
                return (
                  <button
                    key={subSection.key}
                    onClick={() => {
                      if (TEST_MODE || isReachable) {
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
            {currentMessages.length === 0 && !(currentCategory === 'main_diagnosis' && !currentMainDiagnosisSubSection && isGeneratingIntro) && !isProcessingGPT ? (
              /* 메시지가 없을 때 작업 중 표시 (인삿말 생성 중이거나 GPT 처리 중이 아닐 때만) */
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
                    : currentCategory === 'other_new_pain' && currentNewPainSubSection
                    ? `${categoryLabels[currentCategory]} - ${newPainSubSections.find(s => s.key === currentNewPainSubSection)?.label}을(를) 작업중입니다 ...`
                    : currentCategory === 'other_new_pain' && isGeneratingIntro
                    ? `${categoryLabels[currentCategory]}을(를) 작업중입니다 ...`
                    : currentCategory === 'other_new_pain'
                    ? `${categoryLabels[currentCategory]}을(를) 작업중입니다 ...`
                    : currentCategory === 'side_effects' && currentSideEffectSubSection
                    ? `${categoryLabels[currentCategory]} - ${sideEffectSubSections.find(s => s.key === currentSideEffectSubSection)?.label}을(를) 작업중입니다 ...`
                    : currentCategory === 'side_effects'
                    ? null // 서브섹션을 선택하지 않았으면 메시지 표시 안 함
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
          <ChatInput 
            onSendMessage={handleSendMessage} 
            disabled={
              (currentCategory === 'main_diagnosis' && !currentMainDiagnosisSubSection) ||
              (currentCategory === 'main_diagnosis' && currentMainDiagnosisSubSection && 
               (currentMainDiagnosisSubSection === 'diagnosis_a' || currentMainDiagnosisSubSection === 'diagnosis_b' || currentMainDiagnosisSubSection === 'diagnosis_c') &&
               completedSymptomSubSections.has(`main_diagnosis_${currentMainDiagnosisSubSection}`)) ||
              isProcessingGPT ||
              (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].content.includes('답변 감사합니다'))
            }
          />
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
        <HumanModel3D highlightedParts={highlightedBodyParts} />
      </div>
    </div>
  );
}
