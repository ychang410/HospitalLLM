import { callGPTAPI, GPTMessage } from './gpt-common';

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

export async function chatAboutSymptom(
  symptomName: string,
  mentioned: boolean,
  present: boolean,
  patientName: string,
  mainDiagnosis: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  _questionCount: number = 0 // 현재까지 물어본 질문 개수 (향후 사용 가능)
): Promise<SymptomChatResponse> {
  let systemPrompt = '';
  let userPrompt = '';
  
  // 대화 히스토리에서 질문 개수 계산 (assistant 메시지 수)
  const actualQuestionCount = conversationHistory.filter(msg => msg.role === 'assistant').length;
  
  // ============================================
  // 경우의 수 3가지:
  // 1) mentioned=true, present=true  (증상이 있었음)
  // 2) mentioned=true, present=false (증상이 없었음)
  // 3) mentioned=false              (언급되지 않음)
  // ============================================
  
  if (actualQuestionCount === 0) {
    // ============================================
    // 첫 질문인 경우
    // ============================================
    
    systemPrompt = `당신은 병원 챗봇입니다. 환자에게 친절하고 따뜻한 톤으로 증상에 대해 질문해주세요. 환자의 나이를 고려하여 적절한 말투를 사용하세요. 한 번에 하나의 질문만 해주세요.`;

    if (!mentioned) {
      // ============================================
      // 경우 3: mentioned=false (언급되지 않음)
      // ============================================
      
      // 환자 답변이 있는지 확인 (하드코딩 메시지에 대한 답변)
      const lastUserMessage = conversationHistory.filter(msg => msg.role === 'user').pop();
      
      if (lastUserMessage) {
        // 환자 답변이 있으면 그 답변을 확인하여 "없다"고 답했는지 판단
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
1. 환자의 답변을 정확하게 분석하여 증상이 있다고 답했는지, 없다고 답했는지를 판단하세요.
2. 환자가 증상이 없다고 답했으면 (예: "없다", "없어요", "없습니다", "없음", "없네요" 등) 응답 끝에 "[COMPLETE]"를 반드시 추가하고 "알겠습니다. 다음 질문으로 넘어가볼게요."라고만 답하세요.
3. 환자가 증상이 있다고 답했거나, 구체적인 증상을 언급했다면, 그 증상에 대해 추가 질문을 해주세요.
4. 한 번에 하나의 질문만 해주세요.`;
      } else {
        // 환자 답변이 없으면 첫 질문 생성
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

중요: 
- 한 번에 하나의 질문만 해주세요.
- 환자가 증상이 없다고 답변하면, 대화를 마무리하고 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.`;
      }
    } else if (present) {
      // ============================================
      // 경우 1: mentioned=true, present=true (증상이 있었음)
      // ============================================
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
    } else {
      // ============================================
      // 경우 2: mentioned=true, present=false (증상이 없었음)
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
    }
  } else {
    // ============================================
    // 두 번째 이상 질문인 경우
    // ============================================
    
    systemPrompt = `당신은 병원 챗봇입니다. 환자에게 친절하고 따뜻한 톤으로 증상에 대해 질문해주세요. 환자의 나이를 고려하여 적절한 말투를 사용하세요. 

중요 지침:
1. 한 번에 하나의 질문만 해주세요.
2. 이전 대화를 확인하여 이미 환자가 답변한 내용에 대해서는 다시 물어보지 마세요.
3. 이미 답변된 내용이면 다음 질문으로 넘어가거나 해당 내용은 스킵하세요.
4. 질문은 2-3개 정도가 적절하며, 그 이후에도 정보가 부족하면 추가 질문을 할 수 있습니다.`;

    if (!mentioned) {
      // ============================================
      // 경우 3: mentioned=false (언급되지 않음) - 후속 질문
      // ============================================
      userPrompt = `이전 대화를 확인하여 다음 정보들을 순차적으로 물어봐주세요. 이미 답변된 내용은 스킵하세요:

질문 목록:
1. 지난 방문 이후 새롭게 나타난 적이 있는지 (이미 물어봤으면 스킵)
2. 언제부터 생겼는지
3. 주로 어떨 때 가장 심하게 나타나는지
4. 증상의 빈도와 강도
5. 증상이 일상생활에 미치는 영향

현재까지 ${actualQuestionCount}개의 질문을 했습니다. 이전 대화를 확인하여 다음 질문을 하나만 해주세요. 이미 답변된 내용이면 스킵하고 다음 질문으로 넘어가세요.

특히 중요: 환자가 증상이 없다고 답변하면, 대화를 마무리하고 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.`;
    } else if (!present) {
      // ============================================
      // 경우 2: mentioned=true, present=false (증상이 없었음) - 후속 질문
      // ============================================
      userPrompt = `이전 대화를 확인하여 다음 정보들을 순차적으로 물어봐주세요. 이미 답변된 내용은 스킵하세요:

질문 목록:
1. 지난 방문에서 이 증상이 없었다고 했다고 알려주기 + 기억나시나요? (이미 물어봤으면 스킵)
2. 지금은 증상이 있는지 (이미 없었다고 답변했다면 대화 종료하고 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.)

현재까지 ${actualQuestionCount}개의 질문을 했습니다. 이전 대화를 확인하여 다음 질문을 하나만 해주세요. 
특히 중요: 환자가 증상이 여전히 없다고 답변하면, 대화를 마무리하고 응답 끝에 "[COMPLETE]"를 반드시 추가해주세요.`;
    } else {
      // ============================================
      // 경우 1: mentioned=true, present=true (증상이 있었음) - 후속 질문
      // ============================================
      userPrompt = `이전 대화를 확인하여 다음 정보들을 순차적으로 물어봐주세요. 이미 답변된 내용은 스킵하세요:

질문 목록:
1. 지난 방문에서 이 증상에 대해 이야기했던 것을 기억하는지 (이미 물어봤으면 스킵)
2. 지난 방문 이후 증상이 회복되었는지, 그대로인지, 더 악화되었는지
3. 증상의 변화 양상 (점진적/갑작스러운 악화/좋아짐 등) OR 비슷하다고 2번에 답변했으면, 3번 질문은 일상생활에서 어떤 부분이 가장 불편한지 물어봐주세요.
4. 악화되었다면 어느 정도 악화되었는지

현재까지 ${actualQuestionCount}개의 질문을 했습니다. 이전 대화를 확인하여 다음 질문을 하나만 해주세요. 이미 답변된 내용이면 스킵하고 다음 질문으로 넘어가세요.`;
    }

    // 2-3개 질문 후 평가
    if (actualQuestionCount >= 2 && actualQuestionCount <= 3) {
      userPrompt += `\n\n현재 ${actualQuestionCount}개의 질문을 했습니다. 환자의 답변이 충분하다고 판단되면, 대화를 마무리하고 다음 증상으로 넘어갈 수 있다고 안내해주세요. 대화를 완료하려면 응답 끝에 "[COMPLETE]"를 추가해주세요.`;
    } else if (actualQuestionCount > 3) {
      userPrompt += `\n\n현재 ${actualQuestionCount}개의 질문을 했습니다. 환자의 답변이 충분한지 평가해주세요. 충분하다고 판단되면 응답 끝에 "[COMPLETE]"를 추가해주세요. 부족하다면 추가 질문을 하나 더 해주세요.`;
    }
  }

  const messages: GPTMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // 기존 대화 히스토리 추가 (첫 질문인 경우는 없음)
  conversationHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  });

  // 마지막에 현재 프롬프트 추가
  messages.push({
    role: 'user',
    content: userPrompt,
  });

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
      questionCount: actualQuestionCount + 1, // 현재 질문까지 포함
    };
  } catch (error: any) {
    console.error('증상 문진 오류:', error);
    // 오류 발생 시 기본 응답
    return {
      message: '죄송합니다. 다시 질문해도 될까요?',
      isComplete: false,
    };
  }
}

/**
 * 검사에 대한 질문을 생성합니다.
 * @param examinationName 검사 이름
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
  
  let systemPrompt = '';
  let userPrompt = '';
  
  // 환자 답변 후: 대화 기록을 보고 추가 질문 또는 완료 처리
  systemPrompt = `당신은 병원 챗봇입니다. 환자에게 친절하고 따뜻한 톤으로 검사에 대해 질문해주세요.`;

  userPrompt = `검사명: ${examinationName}

이전 대화를 확인하여 환자의 답변을 평가해주세요.

환자가 궁금해하거나 질문하려는 부분이 명확하지 않으면 추가 질문을 하나 해주세요. 대신 질문은 간결해야 합니다.
이미 명확하게 답변이 충분하다고 판단되면 응답 끝에 "[COMPLETE]"를 추가해주세요.`;

  const messages: GPTMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // 기존 대화 히스토리 추가
  conversationHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  });

  // 마지막에 현재 프롬프트 추가
  messages.push({
    role: 'user',
    content: userPrompt,
  });

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
