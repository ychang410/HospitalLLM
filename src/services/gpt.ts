import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface GPTMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GPTResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

/**
 * 진료 기록 분석 결과
 */
export interface MedicalRecordAnalysis {
  mainDiagnosis: string; // 주요 진단명
  symptoms: Array<{
    name: string; // 주요 진단명과 관련된 일반적인 증상명
    mentioned: boolean; // 진료 기록에서 언급되었는지 여부
  }>;
  otherSymptoms: Array<{
    name: string; // 주요 진단명과 관련 없는 기타 증상명
    mentioned: boolean; // 진료 기록에서 언급되었는지 여부 (항상 true)
  }>;
  examinations: Array<{
    name: string; // 검사 이름
  }>; // 검사 목록 (없으면 빈 배열)
  medications: Array<{
    name: string; // 약 이름
  }>; // 처방약 목록 (없으면 빈 배열)
}

/**
 * GPT API를 호출하여 응답을 받습니다.
 * @param messages 대화 메시지 배열
 * @returns GPT 응답 메시지
 */
export async function callGPTAPI(messages: GPTMessage[]): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다. .env 파일에 VITE_OPENAI_API_KEY를 설정해주세요.');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // 또는 'gpt-3.5-turbo', 'gpt-4' 등
        messages: messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 오류: ${response.status} ${response.statusText}`);
    }

    const data: GPTResponse = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('GPT API에서 응답을 받지 못했습니다.');
    }

    return data.choices[0].message.content;
  } catch (error: any) {
    console.error('GPT API 호출 오류:', error);
    throw error;
  }
}

/**
 * PDF 파일에서 텍스트를 추출합니다.
 * @param file PDF 파일
 * @returns 추출된 텍스트
 */
async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    // 모든 페이지에서 텍스트 추출
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // 텍스트 항목들을 하나의 문자열로 결합
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }
    
    return fullText.trim();
  } catch (error: any) {
    throw new Error(`PDF 파일 읽기 실패: ${error.message}`);
  }
}

/**
 * 진료 기록 파일을 읽고 요약합니다. (테스트용)
 * @param file 진료 기록 파일 (텍스트, PDF 등)
 * @returns 요약 텍스트
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
2. 주요 증상 (symptoms): 해당 진단명의 대표적인 주요 증상 3개를 나열하세요 (common symptoms). 증상명은 반드시 전문적인 의학 용어를 사용하세요. (예: "다리에 힘빠짐" → "다리 근력 저하" 등)
3. 각 증상의 언급 여부 (mentioned): 각 증상이 진료 기록에서 언급되었는지 true/false로 표시하세요.
4. 기타 증상 (otherSymptoms): 진료 기록에서 언급되었지만 주요 진단명과 관련 없는 기타 증상들을 나열하세요. (없으면 빈 배열) 증상명은 반드시 전문적인 의학 용어를 사용하세요.
5. 검사 (examinations): 진료 기록에서 언급된 검사들을 나열하세요. (없으면 빈 배열)
6. 처방약 (medications): 진료 기록에서 언급된 처방약들을 나열하세요. (없으면 빈 배열)

응답은 반드시 다음 JSON 형식으로만 제공해주세요. 다른 설명이나 텍스트 없이 JSON만 제공하세요:
{
  "mainDiagnosis": "진단명",
  "symptoms": [
    {
      "name": "증상1",
      "mentioned": true 또는 false
    },
    {
      "name": "증상2",
      "mentioned": true 또는 false
    },
    {
      "name": "증상3",
      "mentioned": true 또는 false
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

