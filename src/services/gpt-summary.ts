import { callGPTAPI, GPTMessage } from "./gpt-common";
import { ConversationLog } from "../components/ChatInterface";
import { BodyPart } from "../components/HumanModel/HumanModel3D";

export type SymptomTrend = "worse" | "same" | "better" | "new" | "no symptom";

export interface SymptomStatusItem {
  symptom: string;
  details: string;
  progress?: "worse" | "same" | "better" | "new" | "no symptom";
  bodyPart?: BodyPart | null;
}

export interface StructuredSummary {
  mainDiagnosisSymptoms: SymptomStatusItem[];
  knownSymptoms: SymptomStatusItem[];
  newSymptoms: SymptomStatusItem[];
  notesForDoctor: string[];
}

/**
 * 대화 로그를 기반으로 구조화된 요약을 생성합니다.
 * @param conversationLog 대화 로그
 * @returns 구조화된 요약 객체
 */
export async function generateSummary(
  conversationLog: ConversationLog
): Promise<StructuredSummary> {
  const symptomSectionKeys = [
    "main_diagnosis_diagnosis_a",
    "main_diagnosis_diagnosis_b",
    "main_diagnosis_diagnosis_c",
    "other_new_pain_other_pain",
    "other_new_pain_new_pain",
  ];
  const additionalSectionKeys = [
    "additional_questions_additional_question",
    "main_diagnosis_examination",
    "side_effects_medication",
  ];
  // 대화 내용을 텍스트로 변환
  const symptomConversationText = formatConversationForSummary(
    conversationLog,
    symptomSectionKeys
  );

  const additionalConversationText = formatConversationForSummary(
    conversationLog,
    additionalSectionKeys
  );

  // const medicalRecordText = formatMedicalRecord(conversationLog);

  const mainDiagnosisSymptomsText =
    formatMainDiagnosisSymptoms(conversationLog);

  const systemPrompt = `당신은 전문적인 문진 요약 작성자입니다. 환자와의 대화를 기반으로 구조화된 요약을 제공합니다.`;

  const knownSymptoms =
    conversationLog.medicalRecordAnalysis?.symptoms
      ?.map((symptom) => (symptom.present ? symptom.name : ""))
      .concat(
        conversationLog.medicalRecordAnalysis?.otherSymptoms?.map((symptom) =>
          symptom.mentioned ? symptom.name : ""
        ) ?? []
      ) ?? [];

  const sanitizedKnownSymptoms = knownSymptoms
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  const knownSymptomsText = sanitizedKnownSymptoms.length
    ? sanitizedKnownSymptoms.join(", ")
    : "기록된 기존 증상이 없습니다.";

  // const patitentQuestions =
  //   conversationLog.conversations.additional_questions_additional_question?.messages.map(
  //     (message) =>
  //       `${message.role === "user" ? "환자" : "챗봇"}: ${message.content}\n`
  //   ) ?? [];

  // 첫 번째 API 호출: 증상 상태와 새 증상만 분석 (Symptom Conversation만 사용)
  const symptomPrompt = `환자와 챗봇의 문진 내용을 아래와 같이 분석하여 JSON을 반환하세요.
  - 무조건 JSON 형식만 출력합니다. 마크다운, 설명, 텍스트는 허용되지 않습니다.

  [Known Symptoms] 
    ${knownSymptomsText}
  [Main Diagnosis Symptoms] 
    ${mainDiagnosisSymptomsText}
  [Symptom Conversation]
    ${symptomConversationText}

  - 각 증상 객체에는 "symptom", "progress", "details", "bodyPart"를 모두 포함합니다. bodyPart는 다음 값 중에 증상과 가장 관련 있는 하나를 사용해주세요: ["head","neck","shoulder","arm","elbow","wrist","hand","chest","abdomen","back","lower_back","hip","leg","thigh","knee","ankle","foot"].

  - "progress" 필드에는  "worse" or "same" or "better" or "new" or "no symptom" 중 하나를 다음의 내용을 따라 작성하세요.
  1. "mainDiagnosisSymptoms" 필드에 주요 증상의 경과를 판단합니다.
      - [Main Diagnosis Symptoms] 각각에 대해서 "progress" 필드에 현재 환자가 이 증상이 없다고 하면 "progress" 필드에 "no symptom"을 추가하세요.
      - 환자가 현재 증상이 있고, 악화되었다면 "worse", 변화가 없다면 "same", 개선되었다면 "better", 기존에 없었지만 새로 생겼다면 "new"를 추가하세요.
  2. "knownSymptoms" 필드에 그외 기존 증상의 경과를 판단합니다.
      - [Known Symptoms]에 있지만, [Main Diagnosis Symptoms]에는 없는 증상들을 대상으로 합니다.
      - 해당 증상에 대해 "progress" 필드에 현재 환자가 이 증상이 악화되었다면 "worse", 변화가 없다면 "same", 개선되었다면 "better"로 작성하세요.
  3. "newSymptoms" 필드에 새로운 증상을 추가합니다.
      - [Known Symptoms]에도 [Main Diagnosis Symptoms]에도 없었지만 이번 대화에서 환자의 증상이 있다면 증상을 작성하고, "progress" 필드에 "new"를 추가하세요.
      - 새로운 증상이 없다면 빈 배열을 반환하세요.

  JSON 예시:
  {
    "mainDiagnosisSymptoms": [
      {
        "symptom": "증상 이름",
        "progress": "worse" or "same" or "better" or "new" or "no symptom",
        "details": "증상에 대한 설명",
        "bodyPart": "head"
      },
    ],

    "knownSymptoms": [
      {
        "symptom": "증상 이름",
        "progress": "worse" or "same" or "better",
        "details": "증상에 대한 설명",
        "bodyPart": "head"
      },
    ],

    "newSymptoms": [
      {
        "symptom": "증상 이름",
        "progress": "new",
        "details": "증상에 대한 설명",
        "bodyPart": "head"
      },
    ]
  }
`;

  // 두 번째 API 호출: 의사 전달 사항만 분석 (Additional Conversation 사용)
  const notesPrompt = `환자와 챗봇의 문진 내용을 아래와 같이 분석하여 JSON을 반환하세요.
  - 무조건 JSON 형식만 출력합니다. 마크다운, 설명, 텍스트는 허용되지 않습니다.
  - 반드시 [Additional Conversation]을 우선적으로 사용하세요.

  [Additional Conversation]
    ${additionalConversationText}
  [Symptom Conversation]
    ${symptomConversationText}
    

  [Additional Conversation]을 이용해서 환자가 의사에게 전달하거나 질문할 내용을 작성합니다.
    - "notesForDoctor" 필드에 환자가 반드시 전달해야 할 내용 혹은 의사에게 질문하고 싶은 내용을 문장으로 최대 3개까지 작성하세요.
    - [Additional Conversation]에서 3개를 찾기 어렵다면, [Symptom Conversation]을 참고하여 환자의 시점으로 합리적으로 추론하여 작성하세요.
  
  JSON 예시:
  {
    "notesForDoctor": [
      "진료실에서 의사에게 꼭 전달해야 할 내용"
    ]
  }
`;

  const symptomMessages: GPTMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: symptomPrompt,
    },
  ];

  const notesMessages: GPTMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: notesPrompt,
    },
  ];

  try {
    // 두 API 호출을 병렬로 실행
    const [symptomResponse, notesResponse] = await Promise.all([
      callGPTAPI(symptomMessages, "gpt-5.1", 1),
      callGPTAPI(notesMessages, "gpt-5.1", 1),
    ]);
    console.log("Symptom Response:", symptomResponse);
    // 각 응답을 파싱하여 합치기
    const symptomData = parseSymptomResponse(symptomResponse);
    const notesData = parseNotesResponse(notesResponse);

    // 증상 이름 중복 제거 (우선순위: mainDiagnosisSymptoms > knownSymptoms > newSymptoms)
    const unifiedSymptoms = unifySymptoms(
      symptomData.mainDiagnosisSymptoms,
      symptomData.knownSymptoms,
      symptomData.newSymptoms
    );

    return {
      mainDiagnosisSymptoms: unifiedSymptoms.mainDiagnosisSymptoms,
      knownSymptoms: unifiedSymptoms.knownSymptoms,
      newSymptoms: unifiedSymptoms.newSymptoms,
      notesForDoctor: notesData.notesForDoctor,
    } as StructuredSummary;
  } catch (error: any) {
    console.error("요약 생성 오류:", error);
    throw new Error(`요약 생성 실패: ${error.message}`);
  }
}

/**
 * 증상 이름 중복을 제거합니다.
 * 우선순위: mainDiagnosisSymptoms > knownSymptoms > newSymptoms
 * 같은 증상 이름이 여러 배열에 있으면, 우선순위가 낮은 배열에서 제거됩니다.
 */
function unifySymptoms(
  mainDiagnosisSymptoms: SymptomStatusItem[],
  knownSymptoms: SymptomStatusItem[],
  newSymptoms: SymptomStatusItem[]
): Pick<
  StructuredSummary,
  "mainDiagnosisSymptoms" | "knownSymptoms" | "newSymptoms"
> {
  // mainDiagnosisSymptoms의 증상 이름 집합
  const mainSymptomNames = new Set(
    mainDiagnosisSymptoms.map((item) => item.symptom.trim().toLowerCase())
  );

  // knownSymptoms에서 mainDiagnosisSymptoms에 있는 증상 제거
  const filteredKnownSymptoms = knownSymptoms.filter(
    (item) => !mainSymptomNames.has(item.symptom.trim().toLowerCase())
  );

  // mainDiagnosisSymptoms와 filteredKnownSymptoms의 증상 이름 집합
  const mainAndKnownSymptomNames = new Set([
    ...mainSymptomNames,
    ...filteredKnownSymptoms.map((item) => item.symptom.trim().toLowerCase()),
  ]);

  // newSymptoms에서 mainDiagnosisSymptoms나 knownSymptoms에 있는 증상 제거
  const filteredNewSymptoms = newSymptoms.filter(
    (item) => !mainAndKnownSymptomNames.has(item.symptom.trim().toLowerCase())
  );

  return {
    mainDiagnosisSymptoms,
    knownSymptoms: filteredKnownSymptoms,
    newSymptoms: filteredNewSymptoms,
  };
}

function parseSymptomResponse(
  response: string
): Pick<
  StructuredSummary,
  "mainDiagnosisSymptoms" | "knownSymptoms" | "newSymptoms"
> {
  let jsonString = response.trim();

  jsonString = jsonString.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

  const jsonStart = jsonString.indexOf("{");
  const jsonEnd = jsonString.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    console.error("증상 응답:", response);
    throw new Error("구조화된 증상 JSON을 파싱할 수 없습니다.");
  }

  jsonString = jsonString.substring(jsonStart, jsonEnd + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error: any) {
    console.error("증상 JSON 문자열:", jsonString);
    throw new Error(`증상 JSON 파싱 실패: ${error.message}`);
  }

  // 기본 구조 보정
  const allowedBodyParts: BodyPart[] = [
    "head",
    "neck",
    "shoulder",
    "arm",
    "elbow",
    "wrist",
    "hand",
    "chest",
    "abdomen",
    "back",
    "lower_back",
    "hip",
    "leg",
    "thigh",
    "knee",
    "ankle",
    "foot",
  ];

  const normalizeBodyPart = (value: unknown): BodyPart | undefined => {
    if (typeof value !== "string") return undefined;
    return allowedBodyParts.includes(value as BodyPart)
      ? (value as BodyPart)
      : undefined;
  };

  const ensureArray = (value: unknown): SymptomStatusItem[] => {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is SymptomStatusItem =>
          typeof item?.symptom === "string" && typeof item?.details === "string"
      )
      .map((item) => ({
        symptom: item.symptom,
        details: item.details,
        progress: item.progress as
          | "worse"
          | "same"
          | "better"
          | "new"
          | "no symptom"
          | undefined,
        bodyPart: normalizeBodyPart(item.bodyPart),
      }));
  };

  return {
    mainDiagnosisSymptoms: ensureArray(parsed?.mainDiagnosisSymptoms ?? []),
    knownSymptoms: ensureArray(parsed?.knownSymptoms ?? []),
    newSymptoms: ensureArray(parsed?.newSymptoms ?? []),
  };
}

function parseNotesResponse(
  response: string
): Pick<StructuredSummary, "notesForDoctor"> {
  let jsonString = response.trim();

  jsonString = jsonString.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

  const jsonStart = jsonString.indexOf("{");
  const jsonEnd = jsonString.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    console.error("의사 전달사항 응답:", response);
    throw new Error("구조화된 의사 전달사항 JSON을 파싱할 수 없습니다.");
  }

  jsonString = jsonString.substring(jsonStart, jsonEnd + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error: any) {
    console.error("의사 전달사항 JSON 문자열:", jsonString);
    throw new Error(`의사 전달사항 JSON 파싱 실패: ${error.message}`);
  }

  const ensureStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    );
  };

  return {
    notesForDoctor: ensureStringArray(parsed?.notesForDoctor),
  };
}

function formatMedicalRecord(conversationLog: ConversationLog): string {
  let text = `환자 정보:
- 성별: ${conversationLog.patientInfo.gender}
- 생년월일: ${conversationLog.patientInfo.birthYear}-${conversationLog.patientInfo.birthMonth}-${conversationLog.patientInfo.birthDay}

`;

  if (conversationLog.medicalRecordAnalysis) {
    text += `주요 진단명: ${conversationLog.medicalRecordAnalysis.mainDiagnosis}\n\n`;

    if (
      Array.isArray(conversationLog.medicalRecordAnalysis.symptoms) &&
      conversationLog.medicalRecordAnalysis.symptoms.length > 0
    ) {
      text += `지난 진료에서 보고된 증상:\n`;
      conversationLog.medicalRecordAnalysis.symptoms.forEach((symptom, idx) => {
        if (!symptom.mentioned) return;
        text += `${idx + 1}. ${symptom.name} (부위: ${
          symptom.bodyPart || "미상"
        }, 지난 방문 시 상태: ${
          symptom.present ? "증상 있었음" : "증상 없었음"
        })\n`;
      });
      text += `\n`;
    }

    if (
      Array.isArray(conversationLog.medicalRecordAnalysis.otherSymptoms) &&
      conversationLog.medicalRecordAnalysis.otherSymptoms.length > 0
    ) {
      text += `기타 기록된 증상: ${conversationLog.medicalRecordAnalysis.otherSymptoms
        .map((symptom) => symptom.name)
        .join(", ")}\n\n`;
    }
  }
  return text;
}
/**
 * 대화 로그를 요약 생성을 위한 텍스트 형식으로 변환합니다.
 * @param conversationLog 대화 로그
 * @param allowedSectionKeys 특정 section 키만 포함할 경우 지정 (예: ["main_diagnosis_diagnosis_a", "main_diagnosis_diagnosis_b"])
 * @returns 포맷된 대화 텍스트
 */
function formatConversationForSummary(
  conversationLog: ConversationLog,
  allowedSectionKeys?: string[]
): string {
  let text = "";
  // 섹션별로 대화 내용 정리
  Object.entries(conversationLog.conversations).forEach(([key, data]) => {
    // allowedSectionKeys가 지정된 경우, 해당 키만 포함
    if (allowedSectionKeys && !allowedSectionKeys.includes(key)) {
      return;
    }

    text += `[${data.section}`;
    if (data.subSection) {
      text += ` - ${data.subSection}`;
    }
    text += `]\n`;

    data.messages.forEach((message) => {
      const role = message.role === "user" ? "환자" : "챗봇";
      text += `${role}: ${message.content}\n`;
    });

    text += "\n";
  });

  return text;
}

function formatMainDiagnosisSymptoms(conversationLog: ConversationLog): string {
  let text = "";
  if (conversationLog.medicalRecordAnalysis) {
    text += `${conversationLog.medicalRecordAnalysis.symptoms
      .map((symptom) => symptom.name)
      .join(", ")}`;
  }
  return text;
}
