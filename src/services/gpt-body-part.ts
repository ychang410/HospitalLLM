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

