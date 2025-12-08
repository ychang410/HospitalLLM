const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface PatientData {
  name: string;
  gender: string;
  age: string; // 만 나이
}

export interface PatientResponse {
  id: string;
  name: string;
  gender: string;
  age: string; // 만 나이
  createdAt: string;
}

export interface MedicalRecordResponse {
  id: string;
  fileType: string;
  fileName: string;
  uploadedAt: string;
}

export interface ConversationData {
  patientId: string;
  medicalRecordId: string;
  category: string;
  subSection?: string;
}

export interface ConversationResponse {
  id: string;
  patientId: string;
  medicalRecordId: string;
  category: string;
  subSection: string | null;
  createdAt: string;
}

export interface MessageData {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  timestamp: string;
}

// 진료 기록 업로드
export const uploadMedicalRecord = async (file: File, patientId?: string): Promise<MedicalRecordResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  if (patientId) {
    formData.append('patientId', patientId);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/medical-records/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `서버 오류 (${response.status}): ${response.statusText}`);
    }

    return response.json();
  } catch (error: any) {
    if (error.message) {
      throw error;
    }
    // 네트워크 오류 등
    throw new Error(`네트워크 오류: 백엔드 서버(${API_BASE_URL})에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.`);
  }
};

// 진료 기록과 환자 연결
export const updateMedicalRecordPatient = async (medicalRecordId: string, patientId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/medical-records/${medicalRecordId}/patient`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ patientId }),
  });

  if (!response.ok) {
    throw new Error('Failed to update medical record patient');
  }
};

// 환자 정보 생성
export const createPatient = async (patientData: PatientData): Promise<PatientResponse> => {
  const response = await fetch(`${API_BASE_URL}/patients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patientData),
  });

  if (!response.ok) {
    throw new Error('Failed to create patient');
  }

  return response.json();
};

// 대화 생성
export const createConversation = async (conversationData: ConversationData): Promise<ConversationResponse> => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(conversationData),
  });

  if (!response.ok) {
    throw new Error('Failed to create conversation');
  }

  return response.json();
};

// 메시지 추가
export const addMessage = async (messageData: MessageData): Promise<MessageResponse> => {
  const response = await fetch(`${API_BASE_URL}/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messageData),
  });

  if (!response.ok) {
    throw new Error('Failed to add message');
  }

  return response.json();
};

// 대화 조회
export const getConversation = async (conversationId: string) => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation/${conversationId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch conversation');
  }

  return response.json();
};

