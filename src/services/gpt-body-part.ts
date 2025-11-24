import { callGPTAPI, GPTMessage } from './gpt-common';
import { BodyPart, bodyPartKeywords } from '../components/HumanModel/HumanModel3D';

/**
 * 증상 이름을 기반으로 해당하는 신체 부위를 GPT가 판단합니다.
 * @param symptomName 증상 이름
 * @param mainDiagnosis 주요 진단명 (참고용)
 * @returns 신체 부위
 */
export async function determineBodyPartForSymptom(
  symptomName: string,
  mainDiagnosis?: string
): Promise<BodyPart> {
  // 신체 부위 목록
  const bodyPartList: BodyPart[] = [
    'head', 'neck', 'shoulder', 'arm', 'elbow', 'wrist', 'hand',
    'chest', 'abdomen', 'back', 'lower_back', 'hip',
    'leg', 'thigh', 'knee', 'ankle', 'foot'
  ];

  const bodyPartListString = bodyPartList.join(', ');

  const systemPrompt = `당신은 의료 전문가입니다. 증상 이름을 정확하게 분석하여 해당 증상이 발생하는 신체 부위를 판단해주세요. 증상 이름에 명시된 신체 부위를 우선적으로 고려하세요.`;

  const userPrompt = `다음 증상 이름을 분석하여 해당 증상이 발생하는 신체 부위를 정확하게 선택해주세요.

증상 이름: ${symptomName}
${mainDiagnosis ? `주요 진단명: ${mainDiagnosis}` : ''}

중요: 증상 이름에 신체 부위가 명시되어 있으면 그 부위를 선택하세요.
예시:
- "손떨림", "손 떨림", "손가락 떨림" → hand
- "다리 근력 저하", "다리 무력", "하지 근력 저하" → thigh 또는 knee
- "발목 통증", "발목 아픔" → ankle
- "무릎 통증", "무릎 아픔" → knee
- "손목 통증" → wrist
- "어깨 통증" → shoulder
- "허리 통증", "요통" → lower_back
- "두통", "머리 아픔" → head
- "목 통증" → neck
- "가슴 통증" → chest
- "배 통증", "복통" → abdomen

선택 가능한 신체 부위 목록:
${bodyPartListString}

응답은 반드시 위 목록 중 하나의 값만 반환해주세요. 다른 설명이나 텍스트 없이 신체 부위 값만 반환하세요.
예: "hand" 또는 "head" 또는 "knee" 등`;

  const messages: GPTMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  try {
    // 먼저 키워드 매칭으로 시도 (더 정확함)
    const lowerSymptomName = symptomName.toLowerCase();
    for (const [part, keywords] of Object.entries(bodyPartKeywords)) {
      for (const keyword of keywords) {
        if (lowerSymptomName.includes(keyword.toLowerCase())) {
          console.log(`키워드 매칭: "${symptomName}" → ${part} (키워드: ${keyword})`);
          return part as BodyPart;
        }
      }
    }
    
    // 키워드 매칭 실패 시 GPT 사용
    const response = await callGPTAPI(messages, 'gpt-4o-mini', 0.3); // 낮은 temperature로 일관성 확보
    
    // 응답에서 신체 부위 추출
    const trimmedResponse = response.trim().toLowerCase();
    
    // 유효한 부위인지 확인
    const bodyPart = bodyPartList.find(part => 
      trimmedResponse === part || trimmedResponse.includes(part)
    );
    
    if (!bodyPart) {
      console.warn(`GPT 응답에서 유효한 신체 부위를 찾을 수 없습니다: ${response}. 기본값 'head'를 사용합니다.`);
      return 'head'; // 기본값
    }
    
    console.log(`GPT 판단: "${symptomName}" → ${bodyPart}`);
    return bodyPart;
  } catch (error: any) {
    console.error('신체 부위 판단 오류:', error);
    // 오류 발생 시 기본값 반환
    return 'head';
  }
}

/**
 * 환자 메시지에서 증상 이름들을 GPT가 추출합니다.
 * @param patientMessage 환자 메시지
 * @returns 추출된 증상 이름 배열
 */
export async function extractSymptomsFromMessage(patientMessage: string): Promise<string[]> {
  const systemPrompt = `당신은 의료 전문가입니다. 환자의 메시지를 정확하게 분석하여 증상이 있는지 없는지를 판단하고, 증상이 있다면 실제로 언급된 증상 이름들만 정확하게 추출해주세요.`;

  const userPrompt = `다음 환자 메시지를 분석해주세요.

환자 메시지: ${patientMessage}

**매우 중요:**
1. 먼저 환자가 새로운 증상이 있다고 답했는지, 없다고 답했는지를 정확하게 판단하세요.
2. 환자가 증상이 없다고 답했으면 (예: "없다", "없어요", "없습니다", "없음", "없네요" 등) "없음"이라고만 응답하세요.
3. 환자가 증상이 있다고 답했거나, 구체적인 증상을 언급했다면, 실제로 언급된 증상 이름들만 추출하세요.
4. 환자가 실제로 언급하지 않은 증상은 절대 추출하지 마세요 (hallucination 금지).
5. 여러 증상이 언급되었을 수 있습니다 (예: "두통과 복통", "머리랑 가슴 통증" 등)
6. 각 증상을 개별적으로 추출해주세요
7. 증상 이름만 추출하고, 다른 설명은 제외해주세요

응답 형식:
- 증상이 없으면: "없음"
- 증상이 있으면: "증상1, 증상2, 증상3" (쉼표로 구분)

예시:
- "없어요" → "없음"
- "없습니다" → "없음"
- "두통이랑 가슴통증이 있어요" → "두통, 가슴통증"
- "머리랑 배가 아파요" → "두통, 복통"`;

  const messages: GPTMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  try {
    const response = await callGPTAPI(messages, 'gpt-4o-mini', 0.3);
    const trimmedResponse = response.trim().toLowerCase();
    
    // "없음" 또는 부정 답변이면 빈 배열 반환
    if (trimmedResponse.includes('없음') || trimmedResponse.includes('없') || trimmedResponse.length === 0) {
      console.log(`증상 추출: "${patientMessage}" → [] (증상 없음)`);
      return [];
    }
    
    // 쉼표로 구분된 증상 이름들 추출
    const symptoms = trimmedResponse
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.includes('없음') && !s.includes('없'));
    
    console.log(`증상 추출: "${patientMessage}" → [${symptoms.join(', ')}]`);
    return symptoms;
  } catch (error: any) {
    console.error('증상 추출 오류:', error);
    // 오류 발생 시 빈 배열 반환
    return [];
  }
}

/**
 * 환자 메시지에서 증상이 있는지 없는지를 GPT가 판단합니다.
 * @param patientMessage 환자 메시지
 * @returns 증상이 있으면 true, 없으면 false
 */
export async function determineIfSymptomsArePresent(patientMessage: string): Promise<boolean> {
  const systemPrompt = `당신은 의료 전문가입니다. 환자의 메시지를 정확하게 분석하여 새로운 증상이 있는지 없는지를 판단해주세요.`;

  const userPrompt = `다음 환자 메시지를 분석하여 새로운 증상이 있는지 없는지를 판단해주세요.

환자 메시지: ${patientMessage}

**매우 중요:**
1. 환자가 새로운 증상이 있다고 답했는지, 없다고 답했는지를 정확하게 판단하세요.
2. 환자가 증상이 없다고 답했으면 (예: "없다", "없어요", "없습니다", "없음", "없네요", "없어", "없습니다" 등) false를 반환하세요.
3. 환자가 증상이 있다고 답했거나, 구체적인 증상을 언급했다면 true를 반환하세요.
4. 환자가 실제로 언급하지 않은 증상은 절대 추출하지 마세요 (hallucination 금지).

응답 형식:
- 증상이 없으면: "없음" 또는 "false"
- 증상이 있으면: "있음" 또는 "true"

예시:
- "없어요" → "없음"
- "없습니다" → "없음"
- "두통이랑 가슴통증이 있어요" → "있음"
- "머리랑 배가 아파요" → "있음"`;

  const messages: GPTMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  try {
    const response = await callGPTAPI(messages, 'gpt-4o-mini', 0.3);
    const trimmedResponse = response.trim().toLowerCase();
    
    // "없음" 또는 부정 답변이면 false 반환
    if (trimmedResponse.includes('없음') || trimmedResponse.includes('없') || trimmedResponse.includes('false')) {
      console.log(`증상 유무 판단: "${patientMessage}" → false (증상 없음)`);
      return false;
    }
    
    // "있음" 또는 긍정 답변이면 true 반환
    if (trimmedResponse.includes('있음') || trimmedResponse.includes('있') || trimmedResponse.includes('true')) {
      console.log(`증상 유무 판단: "${patientMessage}" → true (증상 있음)`);
      return true;
    }
    
    // 명확하지 않은 경우 기본값은 false
    console.log(`증상 유무 판단: "${patientMessage}" → false (명확하지 않음)`);
    return false;
  } catch (error: any) {
    console.error('증상 유무 판단 오류:', error);
    // 오류 발생 시 기본값 false 반환
    return false;
  }
}

