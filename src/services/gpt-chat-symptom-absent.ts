import { callGPTAPI, GPTMessage } from './gpt-common';
import { SymptomChatResponse } from './gpt-chat-main-diagnosis';

/**
 * 경우 2: mentioned=true, present=false (증상이 없었음)
 * 
 * 질문 흐름:
 * - "지난번에 [증상]은 없었다고 하시긴 했는데, 지금은 어떠신가요?"
 * - 환자가 "없다"고 답하면 → complete
 * - 환자가 "있다"고 답하면 → 추가 정보 수집
 */
export async function chatAboutSymptomAbsent(
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
    userPrompt = `다음은 환자의 증상에 대한 문진입니다.

환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}
- 증상: ${symptomName}
- 진료 기록에서 언급 여부: 언급됨
- 증상 유무: 없었음

이 증상(${symptomName})은 지난 방문에서 언급되었지만, 증상이 없다고 기록되어 있습니다.

다음 문구가 이미 환자에게 전달되었습니다:
"지난번에 ${symptomName} 증상은 없었다고 하시긴 했는데, 지금은 어떠신가요?"

이 문구에 자연스럽게 이어서 추가 설명이나 질문을 해주세요. 시작 문구를 반복하지 말고, 바로 이어서 말하세요.

중요: 
- 한 번에 하나의 질문만 해주세요.
- 환자가 증상이 여전히 없다고 답변하면, 대화를 마무리하고 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.`;
  } else {
    // ============================================
    // 후속 질문인 경우
    // ============================================
    userPrompt = `이전 대화를 확인하여 다음 정보들을 순차적으로 물어봐주세요. 이미 답변된 내용은 스킵하세요:

질문 목록:
1. 지난 방문에서 이 증상이 없었다고 했다고 알려주기 + 기억나시나요? (이미 물어봤으면 스킵)
2. 지금은 증상이 있는지 (이미 없었다고 답변했다면 대화 종료하고 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.)

현재까지 ${actualQuestionCount}개의 질문을 했습니다. 이전 대화를 확인하여 다음 질문을 하나만 해주세요. 
특히 중요: 환자가 증상이 여전히 없다고 답변하면, 대화를 마무리하고 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.`;

    // 질문 개수에 따른 완료 조건 안내
    if (actualQuestionCount >= 2 && actualQuestionCount <= 3) {
      userPrompt += `\n\n현재 ${actualQuestionCount}개의 질문을 했습니다. 환자의 답변이 충분하다고 판단되면, 대화를 마무리하고 다음 증상으로 넘어갈 수 있다고 안내해주세요. 대화를 완료하려면 응답 끝에 "[COMPLETE]"를 추가해주세요.`;
    } else if (actualQuestionCount > 3) {
      userPrompt += `\n\n현재 ${actualQuestionCount}개의 질문을 했습니다. 환자의 답변이 충분한지 평가해주세요. 충분하다고 판단되면 응답 끝에 "[COMPLETE]"를 추가해주세요. 부족하다면 추가 질문을 하나 더 해주세요.`;
    }
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
    console.error('증상 문진 오류 (absent):', error);
    return {
      message: '죄송합니다. 다시 질문해도 될까요?',
      isComplete: false,
    };
  }
}

