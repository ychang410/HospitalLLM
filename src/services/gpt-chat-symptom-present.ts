import { callGPTAPI, GPTMessage } from './gpt-common';
import { SymptomChatResponse } from './gpt-chat-main-diagnosis';

/**
 * 경우 1: mentioned=true, present=true (증상이 있었음)
 * 
 * 질문 흐름:
 * a. "기억나시나요?" → 예/아니오
 * i. 기억나요 → Better? Same? Worse?
 *    - Better: 점차적으로/갑자기 좋아졌는지 + 일상생활에서도 좋아진게 느껴지는지 → complete
 *    - Same: 현재 일상에서 언제 가장 불편감을 느끼시는지, 언제 주로 증상이 나타나는지 → complete
 *    - Worse: 언제 증상이 유독 심해지는지 / 일상생활에서 언제 가장 불편한지 → complete
 * ii. 기억 안나요 → "지난 진료 기록을 살펴본 결과, xxx이 있다고 말씀해주셨었어요. 그렇다면, 지난번 말고 현재기준으로 증상이 있으신가요?"
 *     - 있다: 언제 주로 증상이 나타나는지 / 일상에서 언제 가장 불편한지? → complete
 *     - 없다: complete
 */
export async function chatAboutSymptomPresent(
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
      // 환자 답변이 있는 경우: "기억나시나요?"에 대한 답변 확인
      userPrompt = `다음은 환자의 증상에 대한 문진입니다.

환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}
- 증상: ${symptomName}
- 진료 기록에서 언급 여부: 언급됨
- 증상 유무: 있었음

다음 문구가 이미 환자에게 전달되었습니다:
"지난번 방문때 ${symptomName} 증상을 이야기해주셨네요. 혹시 기억나시나요?"

대화 히스토리:
${conversationHistory.map(msg => `${msg.role === 'assistant' ? '의사' : '환자'}: ${msg.content}`).join('\n')}

**매우 중요:**
1. 환자의 마지막 답변을 정확하게 분석하여 "기억난다"고 답했는지, "기억 안 난다"고 답했는지를 판단하세요.
2. 환자가 "기억난다", "예", "네", "기억나요" 등으로 답했으면:
   → "지난번과 비교했을 때 증상이 좋아졌나요(Better), 그대로인가요(Same), 아니면 악화되었나요(Worse)?"라고 물어보세요.
3. 환자가 "기억 안 낔다", "아니오", "아니요", "모르겠다" 등으로 답했으면:
   → 먼저 리마인더를 해주세요: "기억이 잘 나지 않으시군요. 제가 진료 기록을 살펴본 결과, 지난번 방문 때 ${symptomName}에 대해 이야기 하신 것으로 확인되어 질문을 드렸습니다."
   → 그 다음에: "그렇다면, 지난번 말고 현재기준으로 ${symptomName} 증상이 있으신가요?"라고 물어보세요.
   → **이 질문에 대한 답변을 확인하세요:**
     - 환자가 "있다", "있어요", "있습니다" 등으로 답했으면: **반드시** "언제 주로 증상이 나타나는지 / 일상에서 언제 가장 불편한지?"를 물어보고 complete
     - 환자가 "없다", "없어요", "없습니다" 등으로 답했으면: 즉시 complete
   → **중요:** "있다"고 답한 경우, 후속 질문을 반드시 해야 합니다. 건너뛰지 마세요.
4. 한 번에 하나의 질문만 해주세요.`;
    } else {
      // 환자 답변이 없는 경우: 하드코딩 메시지가 방금 보내졌고, 아직 답변이 없음
      userPrompt = `다음은 환자의 증상에 대한 문진입니다.

환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}
- 증상: ${symptomName}
- 진료 기록에서 언급 여부: 언급됨
- 증상 유무: 있었음

이 증상(${symptomName})은 지난 방문에서 이미 언급되었고, 증상이 있었다고 기록되어 있습니다.

다음 문구가 이미 환자에게 전달되었습니다:
"지난번 방문때 ${symptomName} 증상을 이야기해주셨네요. 혹시 기억나시나요?"

이 문구에 자연스럽게 이어서 추가 설명이나 질문을 해주세요. 시작 문구를 반복하지 말고, 바로 이어서 말하세요.

중요: 한 번에 하나의 질문만 해주세요.`;
    }
  } else {
    // ============================================
    // 후속 질문인 경우
    // ============================================
    userPrompt = `이전 대화를 확인하여 다음 정보들을 순차적으로 물어봐주세요. 이미 답변된 내용은 스킵하세요:

**질문 흐름:**

**1단계: 기억 여부 확인**
지난 방문에서 이 증상에 대해 이야기했던 것을 기억하는지 (이미 물어봤으면 스킵)
- 환자가 "예" 또는 "기억난다"고 답하면 → 2단계로 진행
- 환자가 "아니오" 또는 "기억 안 난다"고 답하면 → 1-ii 단계로 진행

**1-ii 단계: 기억 안 난다 (리마인더)**
환자가 "기억 안 난다"고 답한 경우:
- 이미 리마인더를 했다면 스킵하고 다음으로 진행
- 아직 리마인더를 하지 않았다면:
  → 리마인더: "기억이 잘 나지 않으시군요. 제가 진료 기록을 살펴본 결과, 지난번 방문 때 ${symptomName}에 대해 이야기 하신 것으로 확인되어 질문을 드렸습니다."
  → 그 다음: "그렇다면, 지난번 말고 현재기준으로 ${symptomName} 증상이 있으신가요?"
- 환자가 "있다", "있어요", "있습니다" 등으로 답했으면:
  → **반드시** 다음 질문을 해야 합니다: "언제 주로 증상이 나타나는지 / 일상에서 언제 가장 불편한지?"
  → 이 질문에 대한 답변을 받은 후 complete
- 환자가 "없다", "없어요", "없습니다" 등으로 답했으면: 즉시 complete

**매우 중요:**
- "현재 증상이 있으신가요?"에 대해 "있다"고 답한 경우, 반드시 "언제 주로 증상이 나타나는지 / 일상에서 언제 가장 불편한지?"를 물어봐야 합니다.
- 이 질문을 건너뛰지 마세요.

**2단계: 증상 변화 상태 (기억나는 경우)**
지난 방문 이후 증상이 좋아졌는지(Better), 그대로인지(Same), 악화되었는지(Worse)
- 이미 답변했다면 스킵하고 3단계로 진행

**3단계: 증상별 세부 질문**

**3-a. Better (좋아진 경우):**
- 점차적으로 좋아졌는지, 아니면 어느 순간 갑자기 좋아졌는지
- 일상생활에서도 좋아진 게 느껴지는지
→ 모두 답변했으면 complete

**3-b. Same (그대로인 경우):**
- 이전과 비슷하다고 이야기하셨는데, 그럼 현재 일상에서 언제 가장 불편감을 느끼시는지
- 언제 주로 증상이 나타나는지
→ 모두 답변했으면 complete

**3-c. Worse (악화된 경우):**
- 언제 증상이 유독 심해지는지
- 일상생활에서 언제 가장 불편한지
→ 모두 답변했으면 complete

**중요 규칙:**
- 환자가 "기억 안 난다"고 답했으면, 1-ii 단계만 진행하고 2-3단계는 스킵
  - 1-ii 단계에서 "현재 증상이 있으신가요?"에 대해 "있다"고 답한 경우:
    → **반드시** "언제 주로 증상이 나타나는지 / 일상에서 언제 가장 불편한지?"를 물어봐야 합니다.
    → 이 질문을 건너뛰지 마세요.
    → 이 질문에 대한 답변을 받은 후 complete
  - "없다"고 답한 경우: 즉시 complete
- 환자가 "그대로" 또는 "비슷하다"고 답했으면, 3-b 단계만 진행하고 complete
- 환자가 "좋아졌다"고 답했으면, 3-a 단계만 진행하고 complete
- 환자가 "악화되었다"고 답했으면, 3-c 단계만 진행하고 complete

**매우 중요:**
- "기억 안 난다" → "현재 증상이 있으신가요?" → "있다"고 답한 경우, 반드시 후속 질문("언제 주로 증상이 나타나는지 / 일상에서 언제 가장 불편한지?")을 해야 합니다.
- 이 질문을 건너뛰고 complete하지 마세요.

현재까지 ${actualQuestionCount}개의 질문을 했습니다. 이전 대화를 확인하여 다음 질문을 하나만 해주세요. 이미 답변된 내용이면 스킵하고 다음 질문으로 넘어가세요.`;

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
    console.error('증상 문진 오류 (present):', error);
    return {
      message: '죄송합니다. 다시 질문해도 될까요?',
      isComplete: false,
    };
  }
}

