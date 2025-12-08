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

  // 1단계: 주요 진단명 추출
  const diagnosisPrompt = `다음은 환자의 진료 기록입니다. 이 기록을 분석하여 가장 중요한 주요 진단명을 하나만 추출해주세요.

응답은 반드시 다음 JSON 형식으로만 제공해주세요. 다른 설명이나 텍스트 없이 JSON만 제공하세요:
{
  "mainDiagnosis": "진단명"
}

진료 기록:
${fileContent.substring(0, 10000)}`;

  const diagnosisMessages: GPTMessage[] = [
    {
      role: 'system',
      content: '당신은 의료 기록을 분석하는 전문가입니다. 진료 기록에서 가장 중요한 주요 진단명을 정확하게 추출해주세요. 응답은 반드시 유효한 JSON 형식으로만 제공하세요.',
    },
    {
      role: 'user',
      content: diagnosisPrompt,
    },
  ];

  let diagnosisResponse: string;
  try {
    diagnosisResponse = await callGPTAPI(diagnosisMessages);
  } catch (error: any) {
    console.error('진단명 추출 GPT API 호출 오류:', error);
    throw new Error(`진단명 추출 실패: ${error.message}`);
  }

  // 진단명 파싱
  let diagnosisJsonString = diagnosisResponse.trim();
  diagnosisJsonString = diagnosisJsonString.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const diagnosisJsonStart = diagnosisJsonString.indexOf('{');
  const diagnosisJsonEnd = diagnosisJsonString.lastIndexOf('}');
  
  if (diagnosisJsonStart === -1 || diagnosisJsonEnd === -1 || diagnosisJsonEnd <= diagnosisJsonStart) {
    throw new Error('진단명 JSON 형식을 찾을 수 없습니다.');
  }
  
  diagnosisJsonString = diagnosisJsonString.substring(diagnosisJsonStart, diagnosisJsonEnd + 1);
  const diagnosisResult = JSON.parse(diagnosisJsonString);
  const mainDiagnosis = diagnosisResult.mainDiagnosis;

  if (!mainDiagnosis || typeof mainDiagnosis !== 'string') {
    throw new Error('mainDiagnosis가 올바르지 않습니다.');
  }

  // 2단계: 진단명 기반으로 주요 증상 3개 추출 (의학 지식 기반, 노인 환자군 대상)
  const symptomsPrompt = `다음 진단명에 대한 대표적인 신경의학적 주요 증상 3개를 나열해주세요. 노인 환자군에 맞는 주요 증상들을 의학 지식에 기반하여 추출해주세요.

증상명은 반드시 전문적인 의학 용어를 사용하세요. (예: "다리에 힘빠짐" → "다리 근력 저하" 등)

진단명: ${mainDiagnosis}

응답은 반드시 다음 JSON 형식으로만 제공해주세요:
{
  "symptoms": [
    {
      "name": "증상1"
    },
    {
      "name": "증상2"
    },
    {
      "name": "증상3"
    }
  ]
}`;

  const symptomsMessages: GPTMessage[] = [
    {
      role: 'system',
      content: '당신은 의학 전문가입니다. 주어진 진단명에 대한 대표적인 신경의학적 주요 증상 3개를 의학 지식에 기반하여 추출해주세요. 노인 환자군에 맞는 주요 증상들을 우선적으로 추출해주세요. 응답은 반드시 유효한 JSON 형식으로만 제공하세요.',
    },
    {
      role: 'user',
      content: symptomsPrompt,
    },
  ];

  let symptomsResponse: string;
  try {
    symptomsResponse = await callGPTAPI(symptomsMessages);
  } catch (error: any) {
    console.error('증상 추출 GPT API 호출 오류:', error);
    throw new Error(`증상 추출 실패: ${error.message}`);
  }

  // 증상 파싱
  let symptomsJsonString = symptomsResponse.trim();
  symptomsJsonString = symptomsJsonString.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const symptomsJsonStart = symptomsJsonString.indexOf('{');
  const symptomsJsonEnd = symptomsJsonString.lastIndexOf('}');
  
  if (symptomsJsonStart === -1 || symptomsJsonEnd === -1 || symptomsJsonEnd <= symptomsJsonStart) {
    throw new Error('증상 JSON 형식을 찾을 수 없습니다.');
  }
  
  symptomsJsonString = symptomsJsonString.substring(symptomsJsonStart, symptomsJsonEnd + 1);
  const symptomsResult = JSON.parse(symptomsJsonString);
  const extractedSymptoms = symptomsResult.symptoms || [];

  if (!Array.isArray(extractedSymptoms) || extractedSymptoms.length === 0) {
    throw new Error('증상 배열이 올바르지 않습니다.');
  }

  // 특별한 예외 처리: "보행 장애" → "다리 근력 저하"
  extractedSymptoms.forEach((symptom: any) => {
    if (symptom.name === '보행 장애' || symptom.name === '보행장애') {
      symptom.name = '다리 근력 저하';
    }
  });

  // 3단계: txt 파일 재분석하여 mentioned, present, otherSymptoms, examinations, medications 추출
  const analysisPrompt = `다음은 환자의 진료 기록입니다. 이 기록을 분석하여 다음 정보를 JSON 형식으로 제공해주세요:

1. 주요 증상들의 언급 여부 및 유무:
   - 아래에 나열된 주요 증상들이 진료 기록에서 언급되었는지 확인하세요.
   - 각 증상의 mentioned: 진료 기록에서 언급되었으면 true, 언급되지 않았으면 false
   - 각 증상의 present: mentioned가 true인 경우, 해당 증상이 있다고 했는지(present: true) 아니면 없다고 했는지(present: false)를 판단하세요. mentioned가 false인 경우 present는 false로 설정하세요.

2. 기타 증상 (otherSymptoms): 진료 기록에서 언급되었지만 주요 진단명과 관련 없는 (주요 증상에 포함되어 있지 않은) 기타 증상들을 나열하세요. (없으면 빈 배열) 증상명은 반드시 전문적인 의학 용어를 사용하세요.

3. 검사 (examinations): 진료 기록에서 언급된 검사들을 나열하세요. (없으면 빈 배열)

4. 처방약 (medications): 진료 기록에서 언급된 처방약들을 나열하세요. (없으면 빈 배열)

주요 증상 목록:
${extractedSymptoms.map((s: any, i: number) => `${i + 1}. ${s.name}`).join('\n')}

응답은 반드시 다음 JSON 형식으로만 제공해주세요:
{
  "symptoms": [
    {
      "name": "${extractedSymptoms[0].name}",
      "mentioned": true 또는 false,
      "present": true 또는 false
    },
    {
      "name": "${extractedSymptoms[1]?.name || ''}",
      "mentioned": true 또는 false,
      "present": true 또는 false
    },
    {
      "name": "${extractedSymptoms[2]?.name || ''}",
      "mentioned": true 또는 false,
      "present": true 또는 false
    }
  ],
  "otherSymptoms": [
    {
      "name": "기타 증상1",
      "mentioned": true
    }
  ],
  "examinations": [
    {
      "name": "검사 이름1"
    }
  ],
  "medications": [
    {
      "name": "약 이름1"
    }
  ]
}

진료 기록:
${fileContent.substring(0, 10000)}`;

  const analysisMessages: GPTMessage[] = [
    {
      role: 'system',
      content: '당신은 의료 기록을 분석하는 전문가입니다. 진료 기록에서 증상의 언급 여부, 기타 증상, 검사, 처방약을 정확하게 추출해주세요. 응답은 반드시 유효한 JSON 형식으로만 제공하세요.',
    },
    {
      role: 'user',
      content: analysisPrompt,
    },
  ];

  let analysisResponse: string;
  try {
    analysisResponse = await callGPTAPI(analysisMessages);
  } catch (error: any) {
    console.error('분석 GPT API 호출 오류:', error);
    throw new Error(`분석 실패: ${error.message}`);
  }
  
  try {
    // JSON 응답 파싱
    let jsonString = analysisResponse.trim();
    jsonString = jsonString.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonStart = jsonString.indexOf('{');
    const jsonEnd = jsonString.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.error('GPT 응답:', analysisResponse);
      throw new Error('JSON 형식을 찾을 수 없습니다.');
    }
    
    jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
    
    const analysisResult = JSON.parse(jsonString);
    
    // 최종 결과 조합
    const analysis: MedicalRecordAnalysis = {
      mainDiagnosis: mainDiagnosis,
      symptoms: analysisResult.symptoms || [],
      otherSymptoms: analysisResult.otherSymptoms || [],
      examinations: analysisResult.examinations || [],
      medications: analysisResult.medications || [],
    };
    
    // 유효성 검사
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
    console.error('GPT 원본 응답:', analysisResponse);
    if (error.message) {
      throw new Error(`분석 오류: ${error.message}`);
    }
    throw error;
  }
}

