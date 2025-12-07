import { callGPTAPI, GPTMessage } from './gpt-common';
import { chatAboutSymptomPresent } from './gpt-chat-symptom-present';
import { chatAboutSymptomAbsent } from './gpt-chat-symptom-absent';
import { chatAboutSymptomNotMentioned } from './gpt-chat-symptom-not-mentioned';

/**
 * 증상별 첫 질문을 생성합니다.
 * @param symptomName 증상 이름
 * @param mentioned 진료 기록에서 언급되었는지 여부
 * @param patientName 환자 이름
 * @param mainDiagnosis 주요 진단명
 * @param conversationHistory 기존 대화 히스토리
 * @returns GPT 응답 (질문 텍스트와 완료 여부)
 */
export interface SymptomChatResponse {
  message: string;
  isComplete: boolean; // 대화가 완료되어 다음 증상으로 넘어갈 수 있는지 여부
  questionCount?: number; // 현재까지 물어본 질문 개수
}

/**
 * 증상에 대한 문진을 진행하는 함수 (라우터)
 * 
 * 전체 흐름:
 * 1. mentioned, present 값을 기준으로 적절한 함수 호출
 *    - 경우 1: mentioned=true, present=true  → chatAboutSymptomPresent
 *    - 경우 2: mentioned=true, present=false → chatAboutSymptomAbsent
 *    - 경우 3: mentioned=false              → chatAboutSymptomNotMentioned
 */
export async function chatAboutSymptom(
  symptomName: string,        // 문진할 증상 이름 (예: "두통", "복통")
  mentioned: boolean,          // 진료 기록에서 이 증상이 언급되었는지 여부
  present: boolean,           // 진료 기록에서 이 증상이 있었다고 기록되었는지 여부
  patientName: string,        // 환자 이름
  mainDiagnosis: string,      // 주요 진단명
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],  // 지금까지의 대화 기록
  _questionCount: number = 0  // 사용하지 않는 파라미터 (호환성을 위해 유지)
): Promise<SymptomChatResponse> {
  // ============================================
  // 증상 상태에 따른 3가지 경우로 분기
  // ============================================
  // 경우 1: mentioned=true, present=true  → 지난번 방문에서 "두통이 있었어요"라고 기록됨
  // 경우 2: mentioned=true, present=false → 지난번 방문에서 "두통은 없었어요"라고 기록됨
  // 경우 3: mentioned=false              → 지난번 방문에서 두통에 대해 아무 말도 안 함
  // ============================================
  
  if (!mentioned) {
    // 경우 3: 언급되지 않음
    return await chatAboutSymptomNotMentioned(
      symptomName,
      patientName,
      mainDiagnosis,
      conversationHistory
    );
  } else if (present) {
    // 경우 1: 증상이 있었음
    return await chatAboutSymptomPresent(
      symptomName,
      patientName,
      mainDiagnosis,
      conversationHistory
    );
  } else {
    // 경우 2: 증상이 없었음
    return await chatAboutSymptomAbsent(
      symptomName,
      patientName,
      mainDiagnosis,
      conversationHistory
    );
  }
}

/**
 * 검사에 대한 질문을 생성하는 함수
 * 
 * 증상과 달리 검사는 단순하게 처리:
 * - 환자가 검사에 대해 궁금한 점이 있으면 추가 질문
 * - 충분한 정보가 모였으면 완료
 * 
 * @param examinationName 검사 이름 (예: "혈액검사", "X-ray")
 * @param patientName 환자 이름
 * @param mainDiagnosis 주요 진단명
 * @param conversationHistory 기존 대화 히스토리
 * @returns GPT 응답 (질문 텍스트와 완료 여부)
 */
export async function chatAboutExamination(
  examinationName: string,
  patientName: string,
  mainDiagnosis: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<SymptomChatResponse> {
  const actualQuestionCount = conversationHistory.filter(msg => msg.role === 'assistant').length;
  
  // ============================================
  // 검사 문진 프롬프트 구성
  // ============================================
  // 증상과 달리 검사는 단순하게 처리 (복잡한 경우의 수 없음)
  const systemPrompt = `당신은 병원 챗봇입니다. 환자에게 친절하고 따뜻한 톤으로 검사에 대해 질문해주세요.`;

  const userPrompt = `환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}
- 검사명: ${examinationName}

이전 대화를 확인하여 환자의 답변을 평가해주세요.

환자가 궁금해하거나 질문하려는 부분이 명확하지 않으면 추가 질문을 하나 해주세요. 대신 질문은 간결해야 합니다.
이미 명확하게 답변이 충분하다고 판단되면 응답 끝에 "[COMPLETE]"를 추가해주세요.`;

  // ============================================
  // GPT API에 전송할 메시지 구성
  // ============================================
  const messages: GPTMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // 대화 히스토리 추가
  conversationHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  });

  // 현재 프롬프트 추가
  messages.push({
    role: 'user',
    content: userPrompt,
  });

  // ============================================
  // GPT API 호출 및 응답 처리
  // ============================================
  try {
    const response = await callGPTAPI(messages, 'gpt-4o', 0.7);
    
    // [COMPLETE] 마커 확인
    const isComplete = response.trim().endsWith('[COMPLETE]');
    let message = response.trim();
    
    if (isComplete) {
      // [COMPLETE] 마커 제거
      message = message.replace(/\[COMPLETE\]\s*$/, '').trim();
    }
    
    return {
      message,
      isComplete,
      questionCount: actualQuestionCount + 1,
    };
  } catch (error: any) {
    console.error('검사 문진 오류:', error);
    return {
      message: '죄송합니다. 다시 질문해도 될까요?',
      isComplete: false,
    };
  }
}

// 향후 주요 진단 내용 섹션의 각 서브섹션(증상 A, B, C)별 채팅 함수들이 여기에 추가될 예정
