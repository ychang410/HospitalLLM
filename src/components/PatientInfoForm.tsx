import { useState } from 'react';
import { PatientInfo } from '../App';
import { USE_BIRTHDATE_VERSION } from '../config/patient-info';

interface PatientInfoFormProps {
  onSubmit: (info: PatientInfo) => void;
}

export default function PatientInfoForm({ onSubmit }: PatientInfoFormProps) {
  const [patientInfo, setPatientInfo] = useState<PatientInfo>(() => {
    if (USE_BIRTHDATE_VERSION) {
      return {
        name: '',
        gender: '',
        age: '',
        birthYear: '',
        birthMonth: '',
        birthDay: '',
      };
    }
    return {
      name: '',
      gender: '',
      age: '',
    };
  });

  const handleChange = (field: keyof PatientInfo, value: string) => {
    setPatientInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    // 테스트 중이므로 유효성 검사 없이 바로 진행
    onSubmit(patientInfo);
  };

  return (
    <div className="w-[1366px] h-[1024px] relative bg-white overflow-hidden mx-auto">
      {/* 안내 문구 */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[201px] text-center text-black text-2xl font-normal font-inter whitespace-nowrap">
        {USE_BIRTHDATE_VERSION 
          ? '안녕하세요! 환자분의 성함과 성별, 그리고 생년월일을 아래에 입력해주세요.'
          : '안녕하세요! 환자분의 성함과 성별, 그리고 만 나이를 아래에 입력해주세요.'}
      </div>

      {/* 폼 컨테이너 */}
      <div className="w-[1223px] h-[494px] left-[72px] top-[265px] absolute bg-white rounded-2xl border border-zinc-300">
        <div className="p-8 space-y-8">
          {/* 이름 & 성별 행 */}
          <div className="flex gap-8">
            <div className="flex-1">
              <label className="block text-black text-2xl font-normal font-inter mb-4">
                이름
              </label>
              <input
                type="text"
                value={patientInfo.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="예: 홍길동"
                className="w-full h-20 bg-custom-light-gray px-6 text-black text-xl font-normal font-inter border-none outline-none rounded"
              />
            </div>
            <div className="flex-1">
              <label className="block text-black text-2xl font-normal font-inter mb-4">
                성별
              </label>
              <select
                value={patientInfo.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full h-20 bg-custom-light-gray px-6 text-black text-xl font-normal font-inter border-none outline-none rounded appearance-none cursor-pointer"
              >
                <option value="">예: 여성 / 남성</option>
                <option value="여성">여성</option>
                <option value="남성">남성</option>
              </select>
            </div>
          </div>

          {USE_BIRTHDATE_VERSION ? (
            /* 생년월일 행 */
            <div>
              <label className="block text-black text-2xl font-normal font-inter mb-4">
                생년월일
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="text"
                  value={patientInfo.birthYear || ''}
                  onChange={(e) => handleChange('birthYear', e.target.value.replace(/\D/g, ''))}
                  placeholder="년"
                  maxLength={4}
                  className="w-32 h-20 bg-custom-light-gray px-4 text-center text-black text-xl font-normal font-inter border-none outline-none rounded"
                />
                <span className="text-black text-xl font-normal font-inter">년</span>
                <input
                  type="text"
                  value={patientInfo.birthMonth || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                      handleChange('birthMonth', value);
                    }
                  }}
                  placeholder="월"
                  maxLength={2}
                  className="w-32 h-20 bg-custom-light-gray px-4 text-center text-black text-xl font-normal font-inter border-none outline-none rounded"
                />
                <span className="text-black text-xl font-normal font-inter">월</span>
                <input
                  type="text"
                  value={patientInfo.birthDay || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 31)) {
                      handleChange('birthDay', value);
                    }
                  }}
                  placeholder="일"
                  maxLength={2}
                  className="w-32 h-20 bg-custom-light-gray px-4 text-center text-black text-xl font-normal font-inter border-none outline-none rounded"
                />
                <span className="text-black text-xl font-normal font-inter">일</span>
              </div>
            </div>
          ) : (
            /* 나이 행 */
            <div>
              <label className="block text-black text-2xl font-normal font-inter mb-4">
                만 나이
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="text"
                  value={patientInfo.age}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 150)) {
                      handleChange('age', value);
                    }
                  }}
                  placeholder="예: 65"
                  maxLength={3}
                  className="w-32 h-20 bg-custom-light-gray px-4 text-center text-black text-xl font-normal font-inter border-none outline-none rounded"
                />
                <span className="text-black text-xl font-normal font-inter">세</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 다음 버튼 */}
      <button
        onClick={handleNext}
        className="absolute left-[1128px] top-[664px] w-28 h-12 bg-white hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center"
      >
        <span className="text-black text-xl font-normal font-inter">다음 →</span>
      </button>
    </div>
  );
}

