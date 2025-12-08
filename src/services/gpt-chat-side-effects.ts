import { callGPTAPI, GPTMessage } from './gpt-common';

export interface SideEffectChatResponse {
  message: string;
  isComplete: boolean;
}

// 하드코딩 메시지 헬퍼
export const getSideEffectsIntroMessage = (patientName: string) =>
  `${patientName}님, 다음으로는 부작용에 대해 질문을 드릴게요. '복용 약'을 클릭해 질문해 답해주세요.`;

export const getMedicationHardcodedMessage = (medicationsText: string) =>
  `지난번에 ${medicationsText} 약을 처방받으셨네요.`;

export const getMedicationEmptyMessage = () =>
  '복용 중인 약물이 없습니다. 다음 질문으로 넘어갈게요.';

export const getSideEffectCompletionMessage = () =>
  '답변 감사합니다. 다음 질문으로 넘어가볼게요.';

/**
 * 부작용에 대한 초기 질문을 생성합니다.
 * @param patientName 환자 이름
 * @param medications 약물 리스트
 * @returns GPT 응답
 */
export async function generateSideEffectQuestion(
  patientName: string,
  medications: string[]
): Promise<string> {
  const medicationsText = medications.length > 0
    ? medications.join(', ')
    : '없음';
  
  const systemPrompt = `당신은 병원 챗봇입니다. 환자는 주로 60세 이상의 고령자입니다. 환자에게 친절하고 따뜻한 톤으로 약물 부작용에 대해 질문해주세요.

중요한 말투 규칙 (60세 이상 환자 대상):
- 쉬운 단어와 짧은 문장을 사용하세요.
- 의학 용어 대신 일상 언어를 사용하세요 (예: "부작용" → "약 먹고 나서 불편한 점", "증상" → "아픈 곳이나 불편한 점").
- 한 번에 하나의 질문만 하세요.
- 인사말을 포함하지 마세요. (예: 안녕하세요.)
- 따옴표를 포함하기 마세요.
- 구체적인 예시를 들어서 설명하세요.
- 존댓말을 사용하되, 너무 딱딱하지 않게 친근하게 말하세요.`;
  
  const userPrompt = `환자 정보:
- 이름: ${patientName}
- 복용 중인 약물: ${medicationsText}

의사가 이미 "지난번에 ${medicationsText} 약을 처방받으셨네요."라고 말했습니다.

이 말에 이어서 부작용에 대해 물어보는 질문을 생성해주세요. 60세 이상 환자에게 맞게 쉽고 명확하게 질문해주세요.

예시:
- "혹시 해당 약때문에 생긴 불편한 점들이 있으실까요? 예를 들어, 소화불량, 어지러움, 두통 등이 있을 수 있습니다."
- "해당 약을 드시고 나서 몸에 이상한 점이나 불편한 점이 있으신가요? 예를 들어, 메스꺼우시거나, 피부에 뭐가 나거나, 잠을 잘 못 주무시는 것 같은지요?"
- "약 먹고 나서 몸이 어떠신가요? 불편한 점이 있으시면 말씀해주세요. 예를 들어, 소화가 안 되거나, 어지럽거나, 두통이 있으신지요?"

주의: "지난번에 ~~~약을 처방받으셨네요." 부분은 이미 말했으므로 포함하지 마세요. 그 이후 질문만 생성하세요.`;

  const messages: GPTMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  
  try {
    const response = await callGPTAPI(messages);
    return response.trim();
  } catch (error) {
    console.error('부작용 초기 질문 생성 오류:', error);
    return '지금 드시는 약 때문에 불편한 점이나 아픈 곳이 있으신가요?';
  }
}

/**
 * 부작용에 대한 멀티턴 대화를 처리합니다.
 * @param patientName 환자 이름
 * @param medications 약물 리스트
 * @param conversationHistory 대화 히스토리
 * @returns GPT 응답
 */
export async function chatAboutSideEffects(
  patientName: string,
  medications: string[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<SideEffectChatResponse> {
  const medicationsText = medications.length > 0
    ? medications.join(', ')
    : '없음';
  
  const systemPrompt = `당신은 병원 챗봇입니다. 환자는 주로 60세 이상의 고령자입니다. 환자에게 친절하고 따뜻한 톤으로 약물 부작용에 대해 질문해주세요. 한 번에 하나의 질문만 해주세요.

중요한 말투 규칙 (60세 이상 환자 대상):
- 쉬운 단어와 짧은 문장을 사용하세요.
- 의학 용어 대신 일상 언어를 사용하세요 (예: "부작용" → "약 먹고 나서 불편한 점", "증상" → "아픈 곳이나 불편한 점", "심각도" → "얼마나 심한지").
- "현재까지 대화에서", "이 약물들에 대해", "정보가 아직 없는 것 같아요" 같은 딱딱하고 공식적인 표현은 사용하지 마세요.
- 대신 "불편한 점이 있으시군요", "어떤 게 불편하신가요?" 같은 자연스럽고 친근한 표현을 사용하세요.
- "정보가 없다", "아직 없는 것 같아요" 같은 표현은 직접적으로 말하지 마세요. 대신 자연스럽게 질문만 하세요.

**매우 중요: 질문 간소화**
- 핵심 정보만 물어보세요: 부작용 유무, 심각도, 발생 빈도/시간대
- 환자의 답변이 명확하면 추가 질문 없이 바로 완료하세요.
- 불필요하게 많은 질문을 하지 마세요.`;
  
  const userPrompt = `이전 대화를 확인하여 부작용에 대해 추가 질문을 해주세요:

환자 정보:
- 이름: ${patientName}
- 복용 중인 약물: ${medicationsText}

대화 히스토리:
${conversationHistory.map(msg => `${msg.role === 'assistant' ? '의사' : '환자'}: ${msg.content}`).join('\n')}

**질문 순서 (큰 그림에서 핵심만 물어보세요):**

1단계: 부작용이 있었는지 (혹은 불편한점)
- 이미 초기 질문에서 물어봤으므로, 환자가 답변했는지 확인만 하세요.
- 환자가 "없다"고 답하면 바로 "[COMPLETE]"를 추가하세요.

2단계: 해당 부작용 증상이 얼마나 심한지
- 환자가 부작용을 언급했다면, "얼마나 심하신가요?" 또는 "어느 정도 불편하신가요?" 질문
- 환자의 답변이 이미 심각도 정보를 포함하고 있으면 이 단계를 건너뛰세요.

3단계: 몇번정도 그러는지? 매번? 혹은 특정 시간대?
- "자주 그러시나요, 아니면 가끔 그러시나요?" 또는 "언제 주로 그러시나요?"
- 환자의 답변이 이미 빈도/시간대 정보를 포함하고 있으면 이 단계를 건너뛰세요.

**매우 중요한 규칙:**
- 환자의 답변이 명확하고 충분한 정보를 포함하고 있으면 추가 질문 없이 바로 "[COMPLETE]"를 추가하세요.
- 환자의 답변이 불명확하거나 빠진 정보가 있을 때만 추가 질문하세요.
- 불필요하게 많은 질문을 하지 마세요. 핵심 정보만 수집하면 충분합니다.
- 모든 정보를 수집했다고 판단되면 즉시 "[COMPLETE]"를 추가하세요.

쉽고 친근한 톤으로 다음 질문을 하나만 해주세요.`;

  const messages: GPTMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userPrompt },
  ];
  
  try {
    const response = await callGPTAPI(messages);
    const trimmedContent = response.trim();
    
    // [COMPLETE] 태그 확인
    const isComplete = trimmedContent.includes('[COMPLETE]');
    const message = isComplete 
      ? trimmedContent.replace(/\[COMPLETE\]/g, '').trim()
      : trimmedContent;
    
    return {
      message,
      isComplete,
    };
  } catch (error) {
    console.error('부작용 대화 오류:', error);
    return {
      message: '죄송합니다. 다시 한번 말씀해주실 수 있나요?',
      isComplete: false,
    };
  }
}
