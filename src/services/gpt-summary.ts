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
  // 대화 내용을 텍스트로 변환
  const conversationText = formatConversationForSummary(conversationLog);

  const summaryFormat = `{
  "symptomStatus": {
    "worse": [
      {
        "symptom": "증상 이름",
        "details": "증상에 대한 상세 설명",
        "bodyPart": "head"
      }
    ],
    "same": [
      {
        "symptom": "증상 이름",
        "details": "증상에 대한 상세 설명",
        "bodyPart": "neck"
      }
    ],
    "better": [
      {
        "symptom": "증상 이름",
        "details": "증상에 대한 상세 설명",
        "bodyPart": "hand"
      }
    ]
  },
  "newSymptoms": [
    {
      "symptom": "새로운 증상 이름",
      "details": "언제 어떻게 시작되었는지 등 세부 설명",
      "bodyPart": "chest"
    }
  ],
  "notesForDoctor": [
    "진료실에서 의사에게 꼭 전달해야 할 내용"
  ]
}`;

  const systemPrompt = `당신은 의료진을 위한 전문적인 문진 요약 작성자입니다. 환자와의 대화를 기반으로 의사가 진료 전에 빠르게 파악할 수 있는 구조화된 정보를 제공합니다.`;

  const knownSymptoms =
    conversationLog.medicalRecordAnalysis?.symptoms?.map((symptom) =>
      typeof symptom?.name === "string" ? symptom.name : ""
    ) ?? [];

  const sanitizedKnownSymptoms = knownSymptoms
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  const knownSymptomsText = sanitizedKnownSymptoms.length
    ? sanitizedKnownSymptoms.join(", ")
    : "기록된 기존 증상이 없습니다.";

  const userPrompt = `다음은 환자와의 문진 대화 내용입니다. 이를 분석하여 아래 요구 사항을 만족하는 JSON만 반환하세요.

- 무조건 JSON 형식만 출력합니다. 마크다운, 설명, 텍스트는 허용되지 않습니다.
- "symptomStatus" 필드에는 반드시 worse/same/better 세 가지 키가 존재해야 합니다.
- 기존 증상이 악화되었다면 worse에 추가하고, 변화가 없다면 same에 추가하고, 개선되었다면 better에 추가하세요. 
- 각 증상 객체에는 "symptom", "details", "bodyPart"를 모두 포함합니다. bodyPart는 다음 값 중 하나를 사용해주세요: ["head","neck","shoulder","arm","elbow","wrist","hand","chest","abdomen","back","lower_back","hip","leg","thigh","knee","ankle","foot"]. 부위를 특정할 수 없다면 null을 사용하세요.
- 대화에서 언급되지 않은 증상 그룹은 빈 배열로 둡니다.
- "newSymptoms" 배열에는 이전 진료 기록에 없었지만 이번 대화에서 새롭게 언급된 증상만 포함하세요. 기존 증상 목록: ${knownSymptomsText}. 새로운 증상이 없다면 빈 배열을 반환하세요.
- "notesForDoctor"에는 환자가 반드시 전달해야 할 내용 혹은 의사에게 질문하고 싶은 내용을 짧은 문장으로 3개 작성하세요. 대화에서 언급이 없다면 환자의 입장에서 합리적으로 추론하여 환자의 시점에서 작성하세요.

- "same" 필드의 항목을 다시 확인하세요. 기존에 증상이 없었고 지금도 증상이 없다면 그곳에서 삭제합니다.

JSON 예시:
${summaryFormat}

대화 내용:
${conversationText}`;

  const messages: GPTMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  try {
    const rawSummary = await callGPTAPI(messages, "gpt-5.1", 1);
    return parseSummaryResponse(rawSummary);
  } catch (error: any) {
    console.error("요약 생성 오류:", error);
    throw new Error(`요약 생성 실패: ${error.message}`);
  }
}

function parseSummaryResponse(response: string): StructuredSummary {
  let jsonString = response.trim();

  jsonString = jsonString.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

  const jsonStart = jsonString.indexOf("{");
  const jsonEnd = jsonString.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    console.error("요약 응답:", response);
    throw new Error("구조화된 요약 JSON을 파싱할 수 없습니다.");
  }

  jsonString = jsonString.substring(jsonStart, jsonEnd + 1);

  let parsed: StructuredSummary;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error: any) {
    console.error("요약 JSON 문자열:", jsonString);
    throw new Error(`요약 JSON 파싱 실패: ${error.message}`);
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

  const ensureStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    );
  };

  const sanitized: StructuredSummary = {
    symptomStatus: {
      worse: ensureArray(parsed?.symptomStatus?.worse),
      same: ensureArray(parsed?.symptomStatus?.same),
      better: ensureArray(parsed?.symptomStatus?.better),
    },
    newSymptoms: ensureArray(parsed?.newSymptoms),
    notesForDoctor: ensureStringArray(parsed?.notesForDoctor),
  };

  return sanitized;
}

/**
 * 대화 로그를 요약 생성을 위한 텍스트 형식으로 변환합니다.
 * @param conversationLog 대화 로그
 * @returns 포맷된 대화 텍스트
 */
function formatConversationForSummary(
  conversationLog: ConversationLog
): string {
  let text = `환자 정보:
- 이름: ${conversationLog.patientInfo.name}
- 성별: ${conversationLog.patientInfo.gender}
- 생년월일: ${conversationLog.patientInfo.birthYear}-${conversationLog.patientInfo.birthMonth}-${conversationLog.patientInfo.birthDay}
- 전화번호: ${conversationLog.patientInfo.phone}

`;

  if (conversationLog.medicalRecordAnalysis) {
    text += `주요 진단명: ${conversationLog.medicalRecordAnalysis.mainDiagnosis}\n\n`;

    if (
      Array.isArray(conversationLog.medicalRecordAnalysis.symptoms) &&
      conversationLog.medicalRecordAnalysis.symptoms.length > 0
    ) {
      text += `지난 진료에서 보고된 증상:\n`;
      conversationLog.medicalRecordAnalysis.symptoms.forEach((symptom, idx) => {
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

  text += `대화 내용:\n\n`;

  // 섹션별로 대화 내용 정리
  Object.entries(conversationLog.conversations).forEach(([, data]) => {
    text += `[${data.section}`;
    if (data.subSection) {
      text += ` - ${data.subSection}`;
    }
    text += `]\n`;

    data.messages.forEach((message) => {
      const role = message.role === "user" ? "환자" : "의사";
      text += `${role}: ${message.content}\n`;
    });

    text += "\n";
  });

  return text;
}
