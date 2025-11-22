import { callGPTAPI, GPTMessage, MedicalRecordAnalysis, extractTextFromPDF } from './gpt-common';

/**
 * 진료 기록 파일을 분석합니다.
 * @param file 진료 기록 파일 (텍스트, PDF 등)
 * @returns 분석 결과
 */
export async function analyzeMedicalRecord(file: File): Promise<MedicalRecordAnalysis> {
  // 파일 내용 읽기
  let fileContent: string;
  
  try {
    if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
      // 텍스트 파일
      fileContent = await file.text();
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      // PDF 파일 텍스트 추출
      fileContent = await extractTextFromPDF(file);
    } else if (file.type.startsWith('video/')) {
      // 동영상 파일은 파일명만 전달
      fileContent = `동영상 파일: ${file.name}`;
      // TODO: 동영상에서 텍스트 추출 (예: 음성 인식)
    } else {
      fileContent = `파일: ${file.name}`;
    }
  } catch (error: any) {
    throw new Error(`파일 읽기 실패: ${error.message}`);
  }

  // GPT에 분석 요청
  const prompt = `다음은 환자의 진료 기록입니다. 이 기록을 분석하여 다음 정보를 JSON 형식으로 제공해주세요:

1. 주요 진단명 (mainDiagnosis): 진료 기록에서 가장 중요한 진단명을 하나 추출하세요.
2. 주요 증상 (symptoms): 진료 기록에 적혀있는 증상을 무시하고, 해당 진단명의 대표적인 주요 증상 3개를 나열하세요 (common symptoms). 증상명은 반드시 전문적인 의학 용어를 사용하세요. (예: "다리에 힘빠짐" → "다리 근력 저하" 등)
3. 각 증상의 언급 여부 (mentioned): 각 증상이 진료 기록에서 언급되었는지 true/false로 표시하세요.
4. 각 증상의 유무 (present): mentioned가 true인 경우, 해당 증상이 있다고 했는지(present: true) 아니면 없다고 했는지(present: false)를 판단하세요. mentioned가 false인 경우 present는 false로 설정하세요.
5. 기타 증상 (otherSymptoms): 진료 기록에서 언급되었지만 주요 진단명과 관련 없는 기타 증상들을 나열하세요. (없으면 빈 배열) 증상명은 반드시 전문적인 의학 용어를 사용하세요.
6. 검사 (examinations): 진료 기록에서 언급된 검사들을 나열하세요. (없으면 빈 배열)
7. 처방약 (medications): 진료 기록에서 언급된 처방약들을 나열하세요. (없으면 빈 배열)

응답은 반드시 다음 JSON 형식으로만 제공해주세요. 다른 설명이나 텍스트 없이 JSON만 제공하세요:
{
  "mainDiagnosis": "진단명",
  "symptoms": [
    {
      "name": "증상1",
      "mentioned": true 또는 false,
      "present": true 또는 false
    },
    {
      "name": "증상2",
      "mentioned": true 또는 false,
      "present": true 또는 false
    },
    {
      "name": "증상3",
      "mentioned": true 또는 false,
      "present": true 또는 false
    }
  ],
  "otherSymptoms": [
    {
      "name": "기타 증상1",
      "mentioned": true
    },
    {
      "name": "기타 증상2",
      "mentioned": true
    }
  ],
  "examinations": [
    {
      "name": "검사 이름1"
    },
    {
      "name": "검사 이름2"
    }
  ],
  "medications": [
    {
      "name": "약 이름1"
    },
    {
      "name": "약 이름2"
    }
  ]
}

진료 기록:
${fileContent.substring(0, 10000)}`; // 파일 크기 제한

  const messages: GPTMessage[] = [
    {
      role: 'system',
      content: '당신은 의료 기록을 분석하는 전문가입니다. 진료 기록에서 주요 진단명과 증상을 정확하게 추출해주세요. 응답은 반드시 유효한 JSON 형식으로만 제공하세요. 다른 설명이나 마크다운 코드 블록 없이 순수 JSON만 제공하세요.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  let response: string;
  try {
    response = await callGPTAPI(messages);
  } catch (error: any) {
    console.error('GPT API 호출 오류:', error);
    throw new Error(`GPT API 호출 실패: ${error.message}`);
  }
  
  try {
    // JSON 응답 파싱 - 더 견고한 파싱 로직
    let jsonString = response.trim();
    
    // 마크다운 코드 블록 제거
    jsonString = jsonString.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // JSON 객체 시작과 끝 찾기
    const jsonStart = jsonString.indexOf('{');
    const jsonEnd = jsonString.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.error('GPT 응답:', response);
      throw new Error('JSON 형식을 찾을 수 없습니다.');
    }
    
    jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
    
    // JSON 파싱 시도
    let analysis: MedicalRecordAnalysis;
    try {
      analysis = JSON.parse(jsonString);
    } catch (parseError: any) {
      console.error('파싱 실패한 JSON 문자열:', jsonString);
      console.error('원본 응답:', response);
      throw new Error(`JSON 파싱 실패: ${parseError.message}`);
    }
    
    // 유효성 검사
    if (!analysis.mainDiagnosis || typeof analysis.mainDiagnosis !== 'string') {
      throw new Error('mainDiagnosis가 올바르지 않습니다.');
    }
    
    if (!Array.isArray(analysis.symptoms)) {
      throw new Error('symptoms가 배열이 아닙니다.');
    }
    
    if (analysis.symptoms.length === 0) {
      throw new Error('symptoms 배열이 비어있습니다.');
    }
    
    // 각 증상 유효성 검사
    for (const symptom of analysis.symptoms) {
      if (!symptom.name || typeof symptom.name !== 'string') {
        throw new Error('증상 name이 올바르지 않습니다.');
      }
      if (typeof symptom.mentioned !== 'boolean') {
        throw new Error('증상 mentioned가 boolean이 아닙니다.');
      }
      if (typeof symptom.present !== 'boolean') {
        throw new Error('증상 present가 boolean이 아닙니다.');
      }
      // mentioned가 false이면 present는 false여야 함
      if (!symptom.mentioned && symptom.present) {
        throw new Error('mentioned가 false인 경우 present는 false여야 합니다.');
      }
    }
    
    // otherSymptoms 유효성 검사
    if (!Array.isArray(analysis.otherSymptoms)) {
      throw new Error('otherSymptoms가 배열이 아닙니다.');
    }
    
    // 각 기타 증상 유효성 검사
    for (const symptom of analysis.otherSymptoms) {
      if (!symptom.name || typeof symptom.name !== 'string') {
        throw new Error('기타 증상 name이 올바르지 않습니다.');
      }
      if (typeof symptom.mentioned !== 'boolean') {
        throw new Error('기타 증상 mentioned가 boolean이 아닙니다.');
      }
    }
    
    // examinations 유효성 검사
    if (!Array.isArray(analysis.examinations)) {
      throw new Error('examinations가 배열이 아닙니다.');
    }
    
    // 각 검사 유효성 검사
    for (const examination of analysis.examinations) {
      if (!examination.name || typeof examination.name !== 'string') {
        throw new Error('검사 name이 올바르지 않습니다.');
      }
    }
    
    // medications 유효성 검사
    if (!Array.isArray(analysis.medications)) {
      throw new Error('medications가 배열이 아닙니다.');
    }
    
    // 각 처방약 유효성 검사
    for (const medication of analysis.medications) {
      if (!medication.name || typeof medication.name !== 'string') {
        throw new Error('처방약 name이 올바르지 않습니다.');
      }
    }
    
    return analysis;
  } catch (error: any) {
    console.error('진료 기록 분석 오류:', error);
    console.error('GPT 원본 응답:', response);
    if (error.message) {
      throw new Error(`분석 오류: ${error.message}`);
    }
    throw error;
  }
}

