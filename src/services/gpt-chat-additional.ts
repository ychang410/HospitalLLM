import { callGPTAPI, GPTMessage } from './gpt-common';

export interface AdditionalChatResponse {
  message: string;
  isComplete: boolean;
}

/**
 * 추가 질문에 대한 초기 질문을 생성합니다.
 * @param patientName 환자 이름
 * @param mainDiagnosis 주요 진단명
 * @returns GPT 응답
 */
export async function generateAdditionalQuestion(
  patientName: string,
  mainDiagnosis: string
): Promise<string> {
  const systemPrompt = `당신은 병원 챗봇입니다. 환자는 주로 60세 이상의 고령자입니다. 환자에게 친절하고 따뜻한 톤으로 추가 질문을 해주세요.

중요한 말투 규칙 (60세 이상 환자 대상):
- 쉬운 단어와 짧은 문장을 사용하세요.
- 의학 용어 대신 일상 언어를 사용하세요.
- 한 번에 하나의 질문만 하세요.
- 인사말을 포함하지 마세요.
- 따옴표를 포함하지 마세요.
- 구체적인 예시를 들어서 설명하세요.
- 존댓말을 사용하되, 너무 딱딱하지 않게 친근하게 말하세요.`;
  
  const userPrompt = `환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}

환자에게 다음과 같은 내용으로 질문해주세요:

"${patientName}님이 앞서서 답변해주신것들 외에, 추가적으로 오늘 진료중에 의사선생님께 전달하고 싶은게 있을지. 지난 진료 이후로 생긴 질문들도 괜찮고, 운동이나 식사같은 일반적인 질문도 좋습니다!"

60세 이상 환자에게 맞게 쉽고 명확하게, 위 내용을 자연스럽게 질문해주세요.`;

  const messages: GPTMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  
  try {
    const response = await callGPTAPI(messages);
    return response.trim();
  } catch (error) {
    console.error('추가 질문 생성 오류:', error);
    return `${patientName}님이 앞서서 답변해주신것들 외에, 추가적으로 오늘 진료중에 의사선생님께 전달하고 싶은게 있을지. 지난 진료 이후로 생긴 질문들도 괜찮고, 운동이나 식사같은 일반적인 질문도 좋습니다!`;
  }
}

/**
 * 추가 질문에 대한 멀티턴 대화를 처리합니다.
 * @param patientName 환자 이름
 * @param mainDiagnosis 주요 진단명
 * @param conversationHistory 대화 히스토리
 * @returns GPT 응답
 */
export async function chatAboutAdditional(
  patientName: string,
  mainDiagnosis: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AdditionalChatResponse> {
  const systemPrompt = `당신은 병원 챗봇입니다. 환자는 주로 60세 이상의 고령자입니다. 환자에게 친절하고 따뜻한 톤으로 추가 질문에 대해 답변해주세요. 한 번에 하나의 질문만 해주세요.

**절대적으로 중요한 우선순위 규칙:**
- 환자가 추가 질문이나 전달하고 싶은 내용이 없다고 답했으면 (예: "없다", "없어요", "없습니다", "없음", "없네요", "없어", "없습니다", "추가 질문 없어요", "추가 질문 없습니다", "전달할 내용 없어요" 등) 반드시 응답 끝에 "[COMPLETE]"를 추가하고 "알겠습니다. 문진이 완료되었습니다."라고만 답하세요.
- "없다"고 답했을 때는 절대 추가 질문을 하지 마세요. 바로 완료 처리하세요.
- 환자가 구체적인 질문이나 전달하고 싶은 내용을 언급했을 때만 추가 질문을 진행하세요.

중요한 말투 규칙 (60세 이상 환자 대상):
- 쉬운 단어와 짧은 문장을 사용하세요.
- 의학 용어 대신 일상 언어를 사용하세요.
- "현재까지 대화에서", "정보가 아직 없는 것 같아요" 같은 딱딱하고 공식적인 표현은 사용하지 마세요.
- 대신 자연스럽고 친근한 표현을 사용하세요.
- "정보가 없다", "아직 없는 것 같아요" 같은 표현은 직접적으로 말하지 마세요. 대신 자연스럽게 질문만 하세요.

**매우 중요: 멀티턴 대화 처리**
- 환자가 추가로 전달하고 싶은 내용이나 궁금한 점이 있는지 확인하세요.
- 환자의 답변이 정확히 이해되지 않으면 자연스럽게 다시 물어보세요.
- 환자의 답변이 명확하면 다른 질문이 더 있는지 확인하세요.
- 모든 질문이 명확하게 답변되었고 더 이상 질문이 없다고 판단될 때만 완료하세요.
- 불필요하게 많은 질문을 하지 마세요.`;
  
  const userPrompt = `이전 대화를 확인하여 추가 질문에 대해 답변해주세요:

환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}

대화 히스토리:
${conversationHistory.map(msg => `${msg.role === 'assistant' ? '의사' : '환자'}: ${msg.content}`).join('\n')}

**절대적으로 중요한 우선순위 규칙 - 반드시 순서대로 따르세요:**

**1단계: 환자 답변 분석 (가장 먼저 수행)**
- 대화 히스토리에서 환자의 마지막 답변을 찾으세요.
- 환자의 답변이 다음 중 하나라면 "추가 질문 없음"으로 판단하세요:
  * "없다", "없어요", "없습니다", "없음", "없네요", "없어"
  * "추가 질문 없어요", "추가 질문 없습니다", "추가 질문 없네요"
  * "전달할 내용 없어요", "전달할 내용 없습니다", "전달할 내용 없네요"
  * "궁금한 점 없어요", "궁금한 점 없습니다", "궁금한 점 없네요"
  * "없습니다", "없어요", "없어", "없음"
  * 또는 유사한 부정 표현

**2단계: "추가 질문 없음" 판단 시 (1단계에서 "추가 질문 없음"으로 판단한 경우)**
- 반드시 응답 끝에 "[COMPLETE]"를 추가하세요.
- "알겠습니다. 문진이 완료되었습니다."라고만 답하세요.
- 절대 추가 질문을 하지 마세요.
- 절대 "다른 궁금한 점이 있으신가요?" 같은 질문을 하지 마세요.

**3단계: "추가 질문 있음" 판단 시 (1단계에서 구체적인 질문이나 전달하고 싶은 내용을 언급한 경우만)**
- 환자가 구체적인 질문이나 전달하고 싶은 내용을 언급했을 때만 다음 단계로 진행하세요.
- 진행 방법:
  1. 환자의 답변이 정확히 이해되지 않거나 불명확한 경우:
     - 자연스럽고 친근한 톤으로 다시 물어보세요.
     - 예: "방금 말씀하신 내용이 정확히 이해가 안 되는데, 다시 한번 설명해주실 수 있나요?"
     - 예: "조금 더 자세히 말씀해주실 수 있나요?"
  2. 환자의 답변이 명확한 경우:
     - 다른 질문이 더 있는지 확인하세요.
     - 예: "다른 궁금한 점이나 전달하고 싶은 내용이 더 있으신가요?"
  3. 모든 질문이 명확하게 답변되었고, 더 이상 물어볼 내용이 없다고 판단되면 응답 끝에 "[COMPLETE]"를 추가하세요.

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
    console.error('추가 질문 대화 오류:', error);
    return {
      message: '죄송합니다. 다시 한번 말씀해주실 수 있나요?',
      isComplete: false,
    };
  }
}
