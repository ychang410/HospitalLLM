import { callGPTAPI, GPTMessage, MedicalRecordAnalysis } from './gpt-common';

export interface NewPainChatResponse {
  message: string;
  isComplete: boolean; // 대화가 완료되었는지 여부
}

// 하드코딩 메시지 헬퍼
export const getOtherNewPainIntroMessages = (patientName: string): string[] => [
  `${patientName}님, 다음으로는 주요 진단 내용과 관련된 내용 외에, 다른 증상들에 대해서 몇 가지 질문을 드릴게요.`,
  `위의 '그 외 통증'을 눌러서 문답을 시작해주세요.`,
];

export const getOtherPainEmptyMessage = () =>
  '지난 진료 때 앞선 주요 증상들외에 언급해주신 다른 증상들이 없었습니다. 다음 질문으로 넘어갈게요.';

export const getOtherPainFirstQuestion = (symptomName: string) =>
  `지난번에 ${symptomName}을(를) 언급해주셨는데, 혹시 기억나시나요?`;

export const getNewPainHardcodedMessage = () =>
  '다음으로는 새로운 통증에 대한 질문입니다.';

export const getNewPainCompletionMessage = () =>
  '답변 감사합니다. 다음 질문으로 넘어가볼게요.';

/**
 * 새로운 통증에 대한 초기 질문을 생성합니다.
 * @param patientName 환자 이름
 * @param medicalRecordAnalysis 진료 기록 분석 결과
 * @returns GPT가 생성한 질문 메시지
 */
export async function generateNewPainQuestion(
  patientName: string,
  medicalRecordAnalysis: MedicalRecordAnalysis
): Promise<string> {
  // 앞에서 이야기한 증상들 수집
  const mentionedSymptoms: string[] = [];
  
  // 주요 진단명과 관련된 증상들 중 언급된 것들
  medicalRecordAnalysis.symptoms.forEach(symptom => {
    if (symptom.mentioned) {
      mentionedSymptoms.push(symptom.name);
    }
  });
  
  // 기타 증상들 (항상 mentioned=true)
  medicalRecordAnalysis.otherSymptoms.forEach(symptom => {
    mentionedSymptoms.push(symptom.name);
  });
  
  const mentionedSymptomsText = mentionedSymptoms.length > 0
    ? mentionedSymptoms.join(', ')
    : '없음';
  
  const systemPrompt = `당신은 병원 챗봇입니다. 환자에게 친절하고 따뜻한 톤으로 새로운 증상에 대해 질문해주세요. 환자의 나이를 고려하여 적절한 말투를 사용하세요.`;
  
  const userPrompt = `다음은 환자에게 새로운 통증에 대해 질문하는 상황입니다.

환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${medicalRecordAnalysis.mainDiagnosis}
- 앞서 언급된 증상들: ${mentionedSymptomsText}

환자에게 다음과 같은 내용을 포함한 질문을 생성해주세요:
"앞에서 이야기한 증상들 외에, 혹시 최근들어 새로 생긴 증상이 있을까요? 예를들어, [구체적인 증상 예시] 등 자유롭게 이야기 해주세요!"

중요:
- 앞서 언급된 증상들(${mentionedSymptomsText})은 예시에 포함하지 마세요.
- 새로운 증상의 예시를 1개만 구체적으로 제시해주세요.
- 자연스럽고 친근한 톤으로 작성해주세요.
- 인사말은 포함하지 마세요.
- 질문만 생성하고, 다른 설명은 추가하지 마세요.`;

  const messages: GPTMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await callGPTAPI(messages);
    return response.trim();
  } catch (error) {
    console.error('새로운 통증 질문 생성 오류:', error);
    // 오류 발생 시 기본 메시지 반환
    return '앞에서 이야기한 증상들 외에, 혹시 최근들어 새로 생긴 증상이 있을까요? 예를들어, 두통 등 자유롭게 이야기 해주세요!';
  }
}

/**
 * 새로운 통증에 대한 대화형 문진을 처리합니다. (absent와 유사한 구조)
 * 
 * 질문 흐름:
 * - 첫 질문: "새로운 증상이 있나요?" (하드코딩 + GPT 예시)
 * - 환자가 "없다"고 답하면 → "감사합니다." 하고 즉시 complete
 * - 환자가 증상을 하나 언급하면 → 다음 4가지 질문:
 *   1) 언제부터 증상이 시작되었는지
 *   2) 어떨 때 가장 심한지
 *   3) 증상의 빈도와 강도
 *   4) 일상생활에 미치는 영향
 * - 만약 환자가 이미 1, 2, 3, 4에 대한 내용을 다 말했다고 느끼면 해당 질문을 스킵하고 종료
 */
export async function chatAboutNewPain(
  patientName: string,
  mainDiagnosis: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<NewPainChatResponse> {
  const actualQuestionCount = conversationHistory.filter(msg => msg.role === 'assistant').length;
  const isFirstQuestion = actualQuestionCount === 0;
  
  const systemPrompt = `당신은 병원 챗봇입니다. 환자에게 친절하고 따뜻한 톤으로 새로운 증상에 대해 질문해주세요. 환자의 나이를 고려하여 적절한 말투를 사용하세요. 한 번에 하나의 질문만 해주세요.`;

  let userPrompt = '';

  if (isFirstQuestion) {
    // ============================================
    // 첫 질문인 경우: 환자 첫 답변 확인
    // ============================================
    const lastUserMessage = conversationHistory.filter(msg => msg.role === 'user').pop();
    
    if (lastUserMessage) {
      // 환자 답변이 있는 경우: "새로운 증상이 있나요?"에 대한 답변 확인
      userPrompt = `다음은 환자의 새로운 증상에 대한 문진입니다.

환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}

다음 문구가 이미 환자에게 전달되었습니다:
"앞에서 이야기한 증상들 외에, 혹시 최근들어 새로 생긴 증상이 있을까요?"

대화 히스토리:
${conversationHistory.map(msg => `${msg.role === 'assistant' ? '의사' : '환자'}: ${msg.content}`).join('\n')}

**매우 중요:**
1. 환자의 마지막 답변을 정확하게 분석하여 "없다", "없어요", "없습니다", "없음" 등으로 답했는지, 아니면 구체적인 증상을 언급했는지를 판단하세요.
2. 환자가 "없다", "없어요", "없습니다", "없음" 등으로 답했으면:
   → "감사합니다."라고 말하고 대화를 마무리하세요. 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.
3. 환자가 구체적인 증상을 하나 언급했다면 (예: "두통이 있어요", "머리가 아파요"):
   → 다음 4가지 질문을 순차적으로 물어봐야 합니다:
     1) 언제부터 증상이 시작되었는지
     2) 어떨 때 가장 심한지
     3) 증상의 빈도와 강도
     4) 일상생활에 미치는 영향
   → 하지만 환자의 답변을 확인하여, 이미 이 4가지 정보를 모두 제공했다고 판단되면:
      → 해당 질문들을 스킵하고 대화를 마무리하세요. 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.
   → 만약 일부 정보만 제공되었다면, 아직 물어보지 않은 질문을 하나만 해주세요.
4. 환자가 여러 증상을 언급했더라도, 첫 번째 증상만 처리하세요.
5. 한 번에 하나의 질문만 해주세요.`;
    } else {
      // 환자 답변이 없는 경우: 하드코딩 메시지가 방금 보내졌고, 아직 답변이 없음
      userPrompt = `다음은 환자의 새로운 증상에 대한 문진입니다.

환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}

다음 문구가 이미 환자에게 전달되었습니다:
"앞에서 이야기한 증상들 외에, 혹시 최근들어 새로 생긴 증상이 있을까요?"

이 문구에 자연스럽게 이어서 추가 설명이나 질문을 해주세요. 시작 문구를 반복하지 말고, 바로 이어서 말하세요.

중요: 한 번에 하나의 질문만 해주세요.`;
    }
  } else {
    // ============================================
    // 후속 질문인 경우
    // ============================================
    userPrompt = `이전 대화를 확인하여 다음 정보들을 순차적으로 물어봐주세요. 이미 답변된 내용은 스킵하세요:

**질문 흐름:**

**1단계: 새로운 증상 유무 확인**
"새로운 증상이 있나요?"에 대한 답변 확인
- 환자가 "없다", "없어요", "없습니다", "없음" 등으로 답했으면:
  → "감사합니다."라고 말하고 대화를 마무리하세요. 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.
- 환자가 구체적인 증상을 언급했으면 → 2단계로 진행

**2단계: 증상 정보 수집 (4가지 질문)**
환자가 증상을 언급한 경우, 다음 4가지 질문을 순차적으로 물어봐야 합니다:
1. 언제부터 증상이 시작되었는지
2. 어떨 때 가장 심한지
3. 증상의 빈도와 강도
4. 일상생활에 미치는 영향

**매우 중요:**
- 이전 대화를 확인하여, 환자가 이미 이 4가지 정보를 모두 제공했다고 판단되면:
  → 해당 질문들을 스킵하고 대화를 마무리하세요. 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.
- 만약 일부 정보만 제공되었다면, 아직 물어보지 않은 질문을 하나만 해주세요.
- 이미 답변된 내용이면 스킵하고 다음 질문으로 넘어가세요.
- 환자가 여러 증상을 언급했더라도, 첫 번째 증상만 처리하세요.

현재까지 ${actualQuestionCount}개의 질문을 했습니다. 이전 대화를 확인하여 다음 질문을 하나만 해주세요.`;
  }

  // ============================================
  // GPT API 호출 및 응답 처리
  // ============================================
  const messages: GPTMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  conversationHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  });

  messages.push({
    role: 'user',
    content: userPrompt,
  });

  try {
    const response = await callGPTAPI(messages, 'gpt-4o', 0.7);
    const isComplete = response.trim().endsWith('[COMPLETE]');
    let message = response.trim();
    
    if (isComplete) {
      message = message.replace(/\[COMPLETE\]\s*$/, '').trim();
    }
    
    return {
      message,
      isComplete,
    };
  } catch (error: any) {
    console.error('새로운 통증 문진 오류:', error);
    return {
      message: '죄송합니다. 다시 질문해도 될까요?',
      isComplete: false,
    };
  }
}
