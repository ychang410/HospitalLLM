import { callGPTAPI, GPTMessage } from "./gpt-common";
import { ConversationLog } from "../components/ChatInterface";
import { BodyPart } from "../components/HumanModel/HumanModel3D";

export type SymptomTrend = "worse" | "same" | "better";

export interface SymptomStatusItem {
  symptom: string;
  details: string;
  bodyPart?: BodyPart | null;
}

export interface StructuredSummary {
  symptomStatus: Record<SymptomTrend, SymptomStatusItem[]>;
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
    "new_pain_other_pain",
    "new_pain_new_pain",
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
  - 반드시 [Symptom Conversation]만을 사용하세요. 다른 대화 내용은 절대 참고하지 마세요.

  [Known Symptoms] 
    ${knownSymptomsText}
  [Symptom Conversation]
    ${symptomConversationText}

  1. [Symptom Conversation]만을 이용해서 [Known Symptoms]에 대해 증상이 악화되었는지, 변화가 없는지, 개선되었는지 판단합니다.
    - "symptomStatus" 필드에는 반드시 worse/same/better 세 가지 키가 존재해야 합니다.
    - [Known Symptoms]가 악화되었다면 worse에 추가하고, 변화가 없다면 same에 추가하고, 개선되었다면 better에 추가하세요. 
    - 각 증상 객체에는 "symptom", "details", "bodyPart"를 모두 포함합니다. bodyPart는 다음 값 중에 증상과 가장 관련 있는 하나를 사용해주세요: ["head","neck","shoulder","arm","elbow","wrist","hand","chest","abdomen","back","lower_back","hip","leg","thigh","knee","ankle","foot"].
    - 대화에서 언급되지 않은 증상 그룹은 빈 배열로 둡니다.
  2. [Symptom Conversation]만을 이용해서 새로운 증상이 있는지 판단합니다.
    - "newSymptoms" 배열에는 이전 진료 기록에 없었지만 이번 대화에서 환자가 호소하는 증상만 포함하세요. 새로운 증상이 없다면 빈 배열을 반환하세요.
  
  JSON 예시:
  {
    "symptomStatus": {
      "worse": [
        {
          "symptom": "증상 이름",
          "details": "증상에 대한 상세 설명",
          "bodyPart": "head"
        }
      ],
      "same": [],
      "better": []
    },
    "newSymptoms": [
      {
        "symptom": "새로운 증상 이름",
        "details": "언제 어떻게 시작되었는지 등 세부 설명",
        "bodyPart": "chest"
      }
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
    - [Additional Conversation]에서 3개를 찾기 어렵다면, [Symptom Conversation]을 참고하여 환자의 입장에서 합리적으로 추론하여 환자의 시점으로 작성하세요.
  
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

    return {
      symptomStatus: symptomData.symptomStatus,
      newSymptoms: symptomData.newSymptoms,
      notesForDoctor: notesData.notesForDoctor,
    };
  } catch (error: any) {
    console.error("요약 생성 오류:", error);
    throw new Error(`요약 생성 실패: ${error.message}`);
  }
}

function parseSymptomResponse(
  response: string
): Pick<StructuredSummary, "symptomStatus" | "newSymptoms"> {
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
        bodyPart: normalizeBodyPart(item.bodyPart),
      }));
  };

  return {
    symptomStatus: {
      worse: ensureArray(parsed?.symptomStatus?.worse),
      same: ensureArray(parsed?.symptomStatus?.same),
      better: ensureArray(parsed?.symptomStatus?.better),
    },
    newSymptoms: ensureArray(parsed?.newSymptoms),
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
