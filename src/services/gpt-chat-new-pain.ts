import { callGPTAPI, GPTMessage, MedicalRecordAnalysis } from './gpt-common';

export interface NewPainChatResponse {
  message: string;
  isComplete: boolean; // 대화가 완료되었는지 여부
}

export interface QuestionItem {
  symptom: string; // 증상 이름
  questionType: 'start_time' | 'severity_time' | 'additional_info'; // 질문 유형
  question: string; // 질문 내용
  answered: boolean; // 답변 여부
  answer?: string; // 답변 내용 (있는 경우)
}

export interface NewPainQuestionList {
  questions: QuestionItem[]; // 질문 리스트
  currentQuestionIndex: number; // 현재 질문 인덱스
}

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
"앞에서 이야기한 증상들 외에, 혹시 최근들어 새로 생긴 증상들이 있을까요? 예를들어, [구체적인 증상 예시들] 등 자유롭게 이야기 해주세요!"

중요:
- 앞서 언급된 증상들(${mentionedSymptomsText})은 예시에 포함하지 마세요.
- 새로운 증상의 예시를 2-3개 구체적으로 제시해주세요.
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
    return '앞에서 이야기한 증상들 외에, 혹시 최근들어 새로 생긴 증상들이 있을까요? 예를들어, 두통, 복통, 어지러움 등 자유롭게 이야기 해주세요!';
  }
}

/**
 * 환자가 언급한 증상들에 대한 질문 리스트를 생성합니다.
 * @param symptoms 환자가 언급한 증상 이름 배열
 * @param patientName 환자 이름
 * @param mainDiagnosis 주요 진단명
 * @returns 질문 리스트
 */
export async function generateNewPainQuestionList(
  symptoms: string[],
  _patientName: string,
  _mainDiagnosis: string
): Promise<QuestionItem[]> {
  const symptomsText = symptoms.join(', ');
  
  const systemPrompt = `당신은 병원 챗봇입니다. 환자가 언급한 증상들에 대한 질문 리스트를 생성해주세요.`;
  
  const userPrompt = `환자가 다음 증상들을 언급했습니다: ${symptomsText}

질문 순서는 다음과 같습니다:
1. 첫 번째 증상: 시작 시기 → 심해지는 시점
2. 두 번째 증상: 시작 시기 → 심해지는 시점
3. ... (각 증상마다 반복)
4. 마지막: 통합 질문

응답 형식 (JSON):
{
  "questions": [
    {
      "symptom": "첫번째증상명",
      "questionType": "start_time",
      "question": "첫번째증상명이 언제부터 시작되었는지 알려주실 수 있나요?"
    },
    {
      "symptom": "첫번째증상명",
      "questionType": "severity_time",
      "question": "첫번째증상명이 어떨 때 가장 심해지거나 불편한지 알려주실 수 있나요?"
    },
    {
      "symptom": "두번째증상명",
      "questionType": "start_time",
      "question": "두번째증상명이 언제부터 시작되었는지 알려주실 수 있나요?"
    },
    {
      "symptom": "두번째증상명",
      "questionType": "severity_time",
      "question": "두번째증상명이 어떨 때 가장 심해지거나 불편한지 알려주실 수 있나요?"
    },
    ...
    {
      "symptom": "통합",
      "questionType": "additional_info",
      "question": "위 증상들에 대해 의사에게 전달하고 싶거나 추가적으로 물어보고 싶은 것이 있을까요?"
    }
  ]
}

중요:
- 각 증상마다 start_time 질문을 먼저 생성하고, 그 다음 severity_time 질문을 생성하세요
- 모든 증상의 start_time과 severity_time 질문이 끝난 후에 마지막에 통합 질문을 추가하세요
- 질문은 자연스럽고 부드러운 톤으로 작성하세요
- 질문 순서: 증상1(시작→심해지는시점) → 증상2(시작→심해지는시점) → ... → 통합질문`;

  const messages: GPTMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await callGPTAPI(messages);
    const trimmedResponse = response.trim();
    
    // JSON 파싱 시도
    let jsonMatch = trimmedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const questions: QuestionItem[] = parsed.questions.map((q: any) => ({
        symptom: q.symptom,
        questionType: q.questionType,
        question: q.question,
        answered: false,
      }));
      return questions;
    }
    
    // JSON 파싱 실패 시 기본 질문 리스트 생성
    const questions: QuestionItem[] = [];
    symptoms.forEach(symptom => {
      questions.push({
        symptom,
        questionType: 'start_time',
        question: `${symptom}이(가) 언제부터 시작되었는지 알려주실 수 있나요?`,
        answered: false,
      });
      questions.push({
        symptom,
        questionType: 'severity_time',
        question: `${symptom}이(가) 어떨 때 가장 심해지거나 불편한지 알려주실 수 있나요?`,
        answered: false,
      });
    });
    questions.push({
      symptom: '통합',
      questionType: 'additional_info',
      question: '위 증상들에 대해 의사에게 전달하고 싶거나 추가적으로 물어보고 싶은 것이 있을까요?',
      answered: false,
    });
    
    return questions;
  } catch (error) {
    console.error('질문 리스트 생성 오류:', error);
    // 오류 발생 시 기본 질문 리스트 생성
    const questions: QuestionItem[] = [];
    symptoms.forEach(symptom => {
      questions.push({
        symptom,
        questionType: 'start_time',
        question: `${symptom}이(가) 언제부터 시작되었는지 알려주실 수 있나요?`,
        answered: false,
      });
      questions.push({
        symptom,
        questionType: 'severity_time',
        question: `${symptom}이(가) 어떨 때 가장 심해지거나 불편한지 알려주실 수 있나요?`,
        answered: false,
      });
    });
    questions.push({
      symptom: '통합',
      questionType: 'additional_info',
      question: '위 증상들에 대해 의사에게 전달하고 싶거나 추가적으로 물어보고 싶은 것이 있을까요?',
      answered: false,
    });
    return questions;
  }
}

/**
 * 질문 리스트를 기반으로 다음 질문을 결정하고, 사용자 답변을 분석합니다.
 * @param questionList 질문 리스트
 * @param conversationHistory 대화 히스토리
 * @returns 다음 질문 또는 완료 여부
 */
export async function getNextQuestionFromList(
  questionList: QuestionItem[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<NewPainChatResponse> {
  // 마지막 사용자 메시지와 assistant 메시지
  const lastUserMessage = conversationHistory.filter(msg => msg.role === 'user').pop();
  const lastAssistantMessage = conversationHistory.filter(msg => msg.role === 'assistant').pop();
  
  // 마지막 assistant 메시지에 해당하는 질문 찾기
  let lastQuestionIndex = -1;
  if (lastAssistantMessage) {
    lastQuestionIndex = questionList.findIndex(q => q.question === lastAssistantMessage.content);
  }
  
  // 마지막 질문이 start_time이고, 사용자 답변에 severity_time 정보가 포함되어 있는지 확인
  if (lastQuestionIndex !== -1 && lastUserMessage) {
    const lastQuestion = questionList[lastQuestionIndex];
    if (lastQuestion.questionType === 'start_time') {
      const nextQuestion = questionList[lastQuestionIndex + 1];
      
      // 다음 질문이 같은 증상의 severity_time인지 확인
      if (nextQuestion && 
          nextQuestion.symptom === lastQuestion.symptom && 
          nextQuestion.questionType === 'severity_time') {
        
        // GPT에게 이전 답변에 severity_time 정보가 포함되어 있는지 확인
        const systemPrompt = `당신은 의료 전문가입니다. 환자의 답변을 분석하여 특정 정보가 포함되어 있는지 확인해주세요.`;
        
        const userPrompt = `다음 질문과 답변을 확인해주세요:

질문: ${lastQuestion.question}
답변: ${lastUserMessage.content}

이 답변에 "${nextQuestion.symptom}이(가) 어떨 때 가장 심해지거나 불편한지"에 대한 정보가 포함되어 있나요? (예: 밤에 주로 아파요 --> 밤에 가장 심해진다는 의미니까 Yes)

응답은 "예" 또는 "아니오"만 해주세요.`;

        const messages: GPTMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];
        
        try {
          const response = await callGPTAPI(messages, 'gpt-4o-mini', 0.3);
          const trimmedResponse = response.trim().toLowerCase();
          
          if (trimmedResponse.includes('예') || trimmedResponse.includes('yes') || trimmedResponse.includes('포함')) {
            // 이미 답변됨, severity_time 질문을 스킵하고 다음 질문으로
            const nextNextQuestion = questionList.find((q, index) => index > lastQuestionIndex + 1 && !q.answered);
            
            if (nextNextQuestion) {
              return {
                message: nextNextQuestion.question,
                isComplete: false,
              };
            } else {
              // 모든 질문 완료
              return {
                message: '',
                isComplete: true,
              };
            }
          }
        } catch (error) {
          console.error('답변 분석 오류:', error);
        }
      }
    }
  }
  
  // 다음 답변하지 않은 질문 찾기
  const nextQuestion = questionList.find(q => !q.answered);
  
  if (!nextQuestion) {
    // 모든 질문이 완료됨
    return {
      message: '',
      isComplete: true,
    };
  }
  
  // 다음 질문 반환
  return {
    message: nextQuestion.question,
    isComplete: false,
  };
}

/**
 * 새로운 통증에 대한 멀티턴 대화를 처리합니다. (기존 함수 - 호환성 유지)
 * @deprecated 질문 리스트 기반 방식으로 변경되었습니다.
 */
export async function chatAboutNewPain(
  patientName: string,
  mainDiagnosis: string,
  mentionedSymptoms: string[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<NewPainChatResponse> {
  const mentionedSymptomsText = mentionedSymptoms.length > 0
    ? mentionedSymptoms.join(', ')
    : '없음';
  
  // 대화 히스토리에서 질문 개수 계산 (assistant 메시지 수)
  const questionCount = conversationHistory.filter(msg => msg.role === 'assistant').length;
  
  const systemPrompt = `당신은 병원 챗봇입니다. 환자에게 친절하고 따뜻한 톤으로 새로운 증상에 대해 질문해주세요. 환자의 나이를 고려하여 적절한 말투를 사용하세요. 한 번에 하나의 질문만 해주세요.

**절대적으로 중요한 우선순위 규칙:**
- 환자가 새로운 증상이 없다고 답했으면 (예: "없다", "없어요", "없습니다", "없음", "없네요" 등) 반드시 응답 끝에 "[COMPLETE]"를 추가하고 "알겠습니다. 다음 질문으로 넘어가볼게요."라고만 답하세요.
- "없다"고 답했을 때는 절대 증상을 추출하거나 질문하지 마세요. 바로 완료 처리하세요.
- 환자가 구체적인 증상을 언급했을 때만 추가 질문을 진행하세요.

중요한 말투 규칙:
- "현재까지 대화에서", "이 두가지 증상에 대해", "정보가 아직 없는 것 같아요" 같은 딱딱하고 공식적인 표현은 사용하지 마세요.
- 대신 "두통이랑 가슴통증이 있으시군요", "언제부터 시작되었는지" 같은 자연스럽고 친근한 표현을 사용하세요.
- "정보가 없다", "아직 없는 것 같아요" 같은 표현은 직접적으로 말하지 마세요. 대신 자연스럽게 질문만 하세요.
- 예: "두통이랑 가슴통증이 언제부터 시작되었는지 알려주실 수 있나요?" (O)
- 예: "현재까지 대화에서 두통과 가슴 통증이 언급되었습니다. 이 두가지 증상에 대해 시작 시기 정보가 아직 없는 것 같아요" (X)

중요한 진행 규칙:
- 질문 개수에 관계없이, 매번 대화 히스토리를 확인하여 각 단계별로 정보가 충분한지 평가하세요.
- 1단계(시작 시기)와 2단계(심해지는 시점) 정보가 모두 충분하다고 판단되면, 반드시 3단계 질문을 해야 합니다.
- 3단계 질문을 건너뛰고 완료하지 마세요. 반드시 물어봐야 합니다.`;
  
  let userPrompt = '';
  
  if (questionCount === 0) {
    // 첫 번째 질문: 환자가 새로운 증상을 언급했는지 확인하고 추가 질문 시작
    userPrompt = `다음은 환자가 새로운 증상에 대해 답변한 대화입니다.

환자 정보:
- 이름: ${patientName}
- 주요 진단명: ${mainDiagnosis}
- 앞서 언급된 증상들: ${mentionedSymptomsText}

대화 히스토리:
${conversationHistory.map(msg => `${msg.role === 'assistant' ? '의사' : '환자'}: ${msg.content}`).join('\n')}

**절대적으로 중요한 우선순위 규칙 - 반드시 순서대로 따르세요:**

**1단계: 환자 답변 분석 (가장 먼저 수행)**
- 대화 히스토리에서 환자의 마지막 답변을 찾으세요.
- 환자의 답변이 다음 중 하나라면 "증상 없음"으로 판단하세요:
  * "없다", "없어요", "없습니다", "없음", "없네요", "없어"
  * "새로운 증상 없어요", "새로운 증상 없습니다", "새로운 증상 없네요"
  * "없습니다", "없어요", "없어", "없음"
  * "새로운 증상은 없어요", "새로운 증상은 없습니다"
  * 또는 유사한 부정 표현

**2단계: "증상 없음" 판단 시 (1단계에서 "증상 없음"으로 판단한 경우)**
- 반드시 응답 끝에 "[COMPLETE]"를 추가하세요.
- "알겠습니다. 다음 질문으로 넘어가볼게요."라고만 답하세요.
- 절대 증상을 추출하거나 질문하지 마세요.
- 절대 "두통이랑 가슴통증이 언제부터 시작되었는지" 같은 질문을 하지 마세요.

**3단계: "증상 있음" 판단 시 (1단계에서 구체적인 증상을 언급한 경우만)**
- 환자가 구체적인 증상을 언급했을 때만 (예: "두통이 있어요", "가슴통증이 있어요", "머리랑 배가 아파요" 등) 다음 단계로 진행하세요.

환자가 새로운 증상을 언급했다면, 다음 단계로 진행하세요:

**1단계: 증상 시작 시기**
모든 언급된 증상에 대해 "언제부터 시작되었는지"를 물어봐주세요.
- 환자가 여러 증상을 언급했다면, 자연스럽게 모든 증상을 한 번에 물어봐주세요. 
  예: "두통이랑 가슴통증이 언제부터 시작되었는지 알려주실 수 있나요?"
  예: "두통과 복통이 언제부터 시작되었는지 알려주실 수 있나요?"
- 환자가 한 증상만 언급했다면, 그 증상에 대해서만 물어봐주세요.
- "현재까지 대화에서", "정보가 아직 없는 것 같아요" 같은 딱딱한 표현은 사용하지 마세요.

**2단계: 증상이 심해지는 시점** (1단계 완료 후)
모든 증상에 대해 "어떨 때 가장 심해지거나 불편한지"를 물어봐주세요.
- 단, 1단계 답변에서 이미 2단계 정보도 함께 제공되었다면 2단계를 건너뛰고 3단계로 진행하세요.

**3단계: 의사에게 전달하고 싶은 내용** (1단계와 2단계 완료 후)
새롭게 생긴 증상들에 대해 의사에게 전달하고 싶거나 추가적으로 물어보고 싶은 것이 있는지 물어봐주세요.
- 예: "새롭게 생긴 증상들에 대해 의사에게 전달하고 싶거나 추가적으로 물어보고 싶은 것이 있을까요?"
- 환자가 없다고 답하거나, 추가로 전달할 내용이 없다고 하면 "[COMPLETE]"를 추가하세요.

중요 규칙:
1. 환자가 여러 증상을 언급했다면, 모든 증상을 한 번에 질문하세요 (예: "두통이랑 가슴통증이 언제부터 시작되었는지 알려주실 수 있나요?")
2. 환자가 여러 증상에 대해 한꺼번에 답변했을 때, 일부 증상의 정보가 빠졌다면 자연스럽고 부드러운 톤으로 추가 질문하세요:
   예: "복통은 언제부터 시작되었는지도 알려주실 수 있나요?"
   예: "가슴통증은 어떨 때 가장 심해지시나요?"
   - "현재까지 대화에서", "정보가 아직 없는 것 같아요" 같은 딱딱한 표현은 절대 사용하지 마세요.
3. **매우 중요: 모호한 답변 처리**
   - 환자가 여러 증상에 대해 질문받았는데, 어떤 증상에 대한 답변인지 명확하지 않은 경우:
     예: "두통과 복통이 언제 심해지냐"고 물었는데, 환자가 "밤에 주로 아프다"고 답하면
     → 이것이 두통인지 복통인지, 아니면 둘 다인지 불명확합니다.
   - 이런 경우 반드시 각 증상별로 명확히 확인해야 합니다:
     예: "밤에 주로 아프다고 하셨는데, 두통이랑 복통 둘 다 밤에 심해지시나요? 아니면 특정 증상만 그런가요?"
     또는: "두통은 언제 가장 심해지시나요? 복통은 언제 가장 심해지시나요?" (각각 개별적으로 질문)
   - 각 증상에 대한 정보가 명확히 구분되어야 합니다. 모호한 답변은 절대 수용하지 마세요.
   - "현재까지 대화에서", "정보가 아직 없는 것 같아요" 같은 딱딱한 표현은 절대 사용하지 마세요.
4. 1단계 답변에서 2단계 정보도 모두 제공되었다면, 2단계를 건너뛰고 3단계로 진행하세요.
5. 모든 증상에 대해 1단계와 2단계 정보를 모두 수집했다고 판단되면, 반드시 3단계 질문을 해야 합니다.
6. 3단계에서 환자가 추가로 전달할 내용이 없다고 하거나, 모든 단계가 완료되면 "[COMPLETE]"를 추가해주세요.

**매우 중요: 단계별 평가 및 진행**
- 질문 개수에 관계없이, 매번 대화 히스토리를 확인하여 각 단계별로 정보가 충분한지 평가하세요.
- 정보가 충분하다고 판단되면 즉시 다음 단계로 진행하거나 완료하세요.
- 1단계와 2단계 정보가 모두 충분하다고 판단되면, 반드시 3단계 질문을 해야 합니다.
- 질문 개수로 판단하지 말고, 실제 수집된 정보의 충분함으로만 판단하세요.`;
  } else {
    // 후속 질문: 이전 대화를 확인하여 다음 질문 진행
    userPrompt = `이전 대화를 확인하여 다음 단계로 진행해주세요:

**현재 단계 확인:**
1. 1단계 (증상 시작 시기): 모든 언급된 증상에 대해 "언제부터 시작되었는지" 정보 수집
2. 2단계 (증상이 심해지는 시점): 모든 증상에 대해 "어떨 때 가장 심해지거나 불편한지" 정보 수집
3. 3단계 (의사에게 전달하고 싶은 내용): 새롭게 생긴 증상들에 대해 의사에게 전달하고 싶거나 추가적으로 물어보고 싶은 것이 있는지 확인

**대화 히스토리:**
${conversationHistory.map(msg => `${msg.role === 'assistant' ? '의사' : '환자'}: ${msg.content}`).join('\n')}

**진행 방법:**
1. 대화 히스토리에서 환자가 언급한 모든 증상을 추출하세요.
2. 각 증상별로 다음을 확인하세요:
   - 1단계 정보(언제 시작)가 있는지
   - 2단계 정보(언제 심해지는지)가 있는지
   - 3단계 정보(의사에게 전달하고 싶은 내용)가 있는지

3. 질문 전략 (자연스럽고 부드러운 톤으로):
   - **1단계가 완료되지 않은 경우**: 빠진 증상에 대해서만 "언제부터 시작되었는지" 질문
     - 여러 증상이 빠졌다면 모두 한 번에 질문 (예: "두통이랑 복통이 언제부터 시작되었는지 알려주실 수 있나요?")
     - 한 증상만 빠졌다면 자연스럽게 질문:
       예: "복통은 언제부터 시작되었는지도 알려주실 수 있나요?"
       예: "가슴통증은 언제부터 시작되었는지 알려주실 수 있나요?"
     - "현재까지 대화에서", "정보가 아직 없는 것 같아요" 같은 표현은 절대 사용하지 마세요.
   - **1단계는 완료되었지만 2단계가 완료되지 않은 경우**: 
     - 먼저 1단계 답변에서 2단계 정보도 함께 제공되었는지 확인
     - 2단계 정보가 이미 모두 제공되었다면 3단계로 진행
     - 2단계 정보가 빠졌다면 자연스럽게 질문:
       예: "복통은 어떨 때 가장 심해지시나요?"
       예: "두통이랑 가슴통증이 어떨 때 가장 심해지시나요?"
     - "정보가 아직 없는 것 같아요" 같은 표현은 사용하지 마세요.
   - **1단계와 2단계가 모두 완료되었지만 3단계가 완료되지 않은 경우**:
     - 반드시 3단계 질문을 해야 합니다: "새롭게 생긴 증상들에 대해 의사에게 전달하고 싶거나 추가적으로 물어보고 싶은 것이 있을까요?"
     - 3단계 질문을 건너뛰고 완료하지 마세요. 반드시 물어봐야 합니다.
     - 3단계 질문 후 환자가 없다고 답하거나, 추가로 전달할 내용이 없다고 하면 "[COMPLETE]" 추가
   - **모든 단계가 완료된 경우**: "[COMPLETE]" 추가

4. 환자가 여러 증상에 대해 한꺼번에 답변했을 때:
   - 각 증상별로 정보가 충분한지 체크
   - 빠진 증상이 있으면 자연스럽고 부드러운 톤으로 추가 질문:
     예: "복통은 언제부터 시작되었는지도 알려주실 수 있나요?"
     예: "가슴통증은 어떨 때 가장 심해지시나요?"
   - "방금 답변에서는", "정보가 아직 없는 것 같아요" 같은 딱딱한 표현은 사용하지 마세요.
   - 모든 증상의 정보가 충분하면 다음 단계로 진행하거나 완료

5. **매우 중요: 모호한 답변 처리**
   - 환자가 여러 증상에 대해 질문받았는데, 어떤 증상에 대한 답변인지 명확하지 않은 경우:
     예: "두통과 복통이 언제 심해지냐"고 물었는데, 환자가 "밤에 주로 아프다"고 답하면
     → 이것이 두통인지 복통인지, 아니면 둘 다인지 불명확합니다.
   - 이런 경우 자연스럽고 부드러운 톤으로 각 증상별로 명확히 확인해야 합니다:
     예: "밤에 주로 아프다고 하셨는데, 두통이랑 복통 둘 다 밤에 심해지시나요? 아니면 특정 증상만 그런가요?"
     또는: "두통은 언제 가장 심해지시나요? 복통은 언제 가장 심해지시나요?" (각각 개별적으로 질문)
   - 각 증상에 대한 정보가 명확히 구분되어야 합니다. 모호한 답변은 절대 수용하지 마세요.
   - "현재까지 대화에서", "정보가 아직 없는 것 같아요" 같은 딱딱한 표현은 절대 사용하지 마세요.

**매우 중요: 단계별 평가 및 진행**
- 매번 대화 히스토리를 확인하여 각 단계별로 정보가 충분한지 평가하세요.
- 질문 개수에 관계없이, 정보가 충분하다고 판단되면 즉시 다음 단계로 진행하거나 완료하세요.
- 1단계와 2단계 정보가 모두 충분하다고 판단되면, 반드시 3단계 질문을 해야 합니다.
- 3단계 질문 후 환자가 답변했거나, 모든 단계의 정보가 충분하다고 판단되면 "[COMPLETE]"를 추가하세요.
- 질문 개수로 판단하지 말고, 실제 수집된 정보의 충분함으로만 판단하세요.

위 규칙에 따라 다음 질문을 하나만 해주세요.`;
  }
  
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
    console.error('새로운 통증 대화 오류:', error);
    return {
      message: '죄송합니다. 다시 질문해도 될까요?',
      isComplete: false,
    };
  }
}

