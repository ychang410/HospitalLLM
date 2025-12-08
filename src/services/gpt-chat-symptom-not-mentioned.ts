import { callGPTAPI, GPTMessage } from './gpt-common';
import { SymptomChatResponse } from './gpt-chat-main-diagnosis';

/**
 * 경우 3: mentioned=false (언급되지 않음)
 * 
 * 질문 흐름:
 * - "지난번에는 [증상]에 대해 이야기하지 않았었는데, 혹시 지난 방문 이후에 이 증상이 새롭게 나타난 적이 있으신가요?"
 * - 환자가 "없다"고 답하면 → 대화 종료
 * - 환자가 "있다"고 답하면 → 다음 4가지 질문:
 *   1) 언제부터 증상이 시작되었는지
 *   2) 어떨 때 가장 심한지
 *   3) 증상의 빈도와 강도
 *   4) 일상생활에 미치는 영향
 * - 만약 환자가 이미 1, 2, 3, 4에 대한 내용을 다 말했다고 느끼면 해당 질문을 스킵하고 종료
 */
export async function chatAboutSymptomNotMentioned(
  symptomName: string,
  patientName: string,
  mainDiagnosis: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<SymptomChatResponse> {
  const actualQuestionCount = conversationHistory.filter(msg => msg.role === 'assistant').length;
  const isFirstQuestion = actualQuestionCount === 0;
  
  const systemPrompt = `당신은 병원 챗봇입니다. 환자에게 친절하고 따뜻한 톤으로 증상에 대해 질문해주세요. 환자의 나이를 고려하여 적절한 말투를 사용하세요. 한 번에 하나의 질문만 해주세요.`;

  let userPrompt = '';

  if (isFirstQuestion) {
    // ============================================
    // 첫 질문인 경우
    // ============================================
    const lastUserMessage = conversationHistory.filter(msg => msg.role === 'user').pop();
    
    if (lastUserMessage) {
      // 환자 답변이 있는 경우: "새롭게 나타난 적이 있으신가요?"에 대한 답변 확인
      userPrompt = `다음은 환자의 증상에 대한 문진입니다.

환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}
- 증상: ${symptomName}
- 진료 기록에서 언급 여부: 언급되지 않음

다음 문구가 이미 환자에게 전달되었습니다:
"지난번에는 ${symptomName} 증상에 대해서 이야기하지 않았었는데, 혹시 지난 방문 이후에 이 증상이 새롭게 나타난 적이 있으신가요?"

대화 히스토리:
${conversationHistory.map(msg => `${msg.role === 'assistant' ? '의사' : '환자'}: ${msg.content}`).join('\n')}

**매우 중요:**
1. 환자의 마지막 답변을 정확하게 분석하여 "없다", "없어요", "없습니다", "없음", "없네요", "없는 것 같아요", "아니요", "아니오" 등으로 답했는지, 아니면 "있다", "있어요", "있습니다", "네", "예" 등으로 답했는지를 판단하세요.
2. 환자가 "없다", "없어요", "없습니다", "없음", "없네요" 등으로 답했으면:
   → 대화를 마무리하고 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.
3. 환자가 "있다", "있어요", "있습니다" 등으로 답했거나, 구체적인 증상을 언급했다면:
   → 다음 4가지 질문을 순차적으로 물어봐야 합니다:
     1) 언제부터 증상이 시작되었는지
     2) 어떨 때 가장 심한지
     3) 증상의 빈도와 강도
     4) 일상생활에 미치는 영향
   → 하지만 환자의 답변을 확인하여, 이미 이 4가지 정보를 모두 제공했다고 판단되면:
      → 해당 질문들을 스킵하고 대화를 마무리하세요. 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.
   → 만약 일부 정보만 제공되었다면, 아직 물어보지 않은 질문을 하나만 해주세요.
4. 한 번에 하나의 질문만 해주세요.`;
    } else {
      // 환자 답변이 없는 경우: 하드코딩 메시지가 방금 보내졌고, 아직 답변이 없음
      userPrompt = `다음은 환자의 증상에 대한 문진입니다.

환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}
- 증상: ${symptomName}
- 진료 기록에서 언급 여부: 언급되지 않음

이 증상(${symptomName})에 대해 문진을 시작합니다.

다음 문구가 이미 환자에게 전달되었습니다:
"지난번에는 ${symptomName} 증상에 대해서 이야기하지 않았었는데, 혹시 지난 방문 이후에 이 증상이 새롭게 나타난 적이 있으신가요?"

이 문구에 자연스럽게 이어서 추가 설명이나 질문을 해주세요. 시작 문구를 반복하지 말고, 바로 이어서 말하세요.

중요: 한 번에 하나의 질문만 해주세요.`;
    }
  } else {
    // ============================================
    // 후속 질문인 경우
    // ============================================
    userPrompt = `이전 대화를 확인하여 다음 정보들을 순차적으로 물어봐주세요. 이미 답변된 내용은 스킵하세요:

**질문 흐름:**

**1단계: 새롭게 나타난 증상 유무 확인**
"지난 방문 이후에 이 증상이 새롭게 나타난 적이 있으신가요?"에 대한 답변 확인
- 환자가 "없다", "없어요", "없습니다", "없음", "없네요" 등으로 답했으면:
  → 대화를 마무리하고 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.
- 환자가 "있다", "있어요", "있습니다" 등으로 답했거나, 구체적인 증상을 언급했다면 → 2단계로 진행

**2단계: 증상 정보 수집 (4가지 질문)**
환자가 "있다"고 답한 경우, 다음 4가지 질문을 순차적으로 물어봐야 합니다:
1. 언제부터 증상이 시작되었는지
2. 어떨 때 가장 심한지
3. 증상의 빈도와 강도
4. 일상생활에 미치는 영향

**매우 중요:**
- 이전 대화를 확인하여, 환자가 이미 이 4가지 정보를 모두 제공했다고 판단되면:
  → 해당 질문들을 스킵하고 대화를 마무리하세요. 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.
- 만약 일부 정보만 제공되었다면, 아직 물어보지 않은 질문을 하나만 해주세요.
- 이미 답변된 내용이면 스킵하고 다음 질문으로 넘어가세요.

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
      questionCount: actualQuestionCount + 1,
    };
  } catch (error: any) {
    console.error('증상 문진 오류 (not mentioned):', error);
    return {
      message: '죄송합니다. 다시 질문해도 될까요?',
      isComplete: false,
    };
  }
}

