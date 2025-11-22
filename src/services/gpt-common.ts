import * as pdfjsLib from 'pdfjs-dist';
import { BodyPart } from '../components/HumanModel/HumanModel3D';

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
    present: boolean; // 증상이 있다고 했는지 여부 (있음=true, 없음=false). mentioned가 true일 때만 의미 있음
    bodyPart?: BodyPart; // 증상과 가장 유사한 신체 부위 (GPT가 분석 완료 후 계산됨)
  }>;
  otherSymptoms: Array<{
    name: string; // 주요 진단명과 관련 없는 기타 증상명
    mentioned: boolean; // 진료 기록에서 언급되었는지 여부 (항상 true)
    bodyPart?: BodyPart; // 증상과 가장 유사한 신체 부위 (GPT가 분석 완료 후 계산됨)
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
 * @param model 사용할 모델 (기본값: 'gpt-4o')
 * @param temperature 온도 설정 (기본값: 0.7)
 * @returns GPT 응답 메시지
 */
export async function callGPTAPI(
  messages: GPTMessage[],
  model: string = 'gpt-4o',
  temperature: number = 0.7
): Promise<string> {
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
        model: model,
        messages: messages,
        temperature: temperature,
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
export async function extractTextFromPDF(file: File): Promise<string> {
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
 * 나이를 계산합니다.
 * @param birthYear 출생 연도
 * @param birthMonth 출생 월
 * @param birthDay 출생 일
 * @returns 나이
 */
export function calculateAge(birthYear: string, birthMonth: string, birthDay: string): number {
  if (!birthYear || !birthMonth || !birthDay) return 0;
  
  const birthDate = new Date(
    parseInt(birthYear),
    parseInt(birthMonth) - 1,
    parseInt(birthDay)
  );
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

