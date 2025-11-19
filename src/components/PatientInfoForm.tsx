import { useState } from 'react';
import { PatientInfo } from '../App';

interface PatientInfoFormProps {
  onSubmit: (info: PatientInfo) => void;
}

export default function PatientInfoForm({ onSubmit }: PatientInfoFormProps) {
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    gender: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    phone: '',
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
      <div className="absolute left-[201px] top-[171px] text-center text-black text-3xl font-normal font-inter">
        안녕하세요! 환자분의 성함과 생년월일, 전화번호를 아래에 입력해주세요.
      </div>

      {/* 폼 컨테이너 */}
      <div className="w-[1223px] h-[617px] left-[71px] top-[237px] absolute bg-white rounded-2xl border border-custom-gray">
        <div className="p-8 space-y-8">
          {/* 이름 & 성별 행 */}
          <div className="flex gap-8">
            <div className="flex-1">
              <label className="block text-black text-3xl font-normal font-inter mb-4">
                이름
              </label>
              <input
                type="text"
                value={patientInfo.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="예: 홍길동"
                className="w-full h-20 bg-custom-light-gray px-6 text-black text-2xl font-normal font-inter border-none outline-none rounded"
              />
            </div>
            <div className="flex-1">
              <label className="block text-black text-3xl font-normal font-inter mb-4">
                성별
              </label>
              <select
                value={patientInfo.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full h-20 bg-custom-light-gray px-6 text-black text-2xl font-normal font-inter border-none outline-none rounded appearance-none cursor-pointer"
              >
                <option value="">예: 여성 / 남성</option>
                <option value="여성">여성</option>
                <option value="남성">남성</option>
              </select>
            </div>
          </div>

          {/* 생년월일 행 */}
          <div>
            <label className="block text-black text-3xl font-normal font-inter mb-4">
              생년월일
            </label>
            <div className="flex gap-4 items-center">
              <input
                type="text"
                value={patientInfo.birthYear}
                onChange={(e) => handleChange('birthYear', e.target.value.replace(/\D/g, ''))}
                placeholder="년"
                maxLength={4}
                className="w-32 h-20 bg-custom-light-gray px-4 text-center text-black text-2xl font-normal font-inter border-none outline-none rounded"
              />
              <span className="text-black text-2xl font-normal font-inter">년</span>
              <input
                type="text"
                value={patientInfo.birthMonth}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                    handleChange('birthMonth', value);
                  }
                }}
                placeholder="월"
                maxLength={2}
                className="w-32 h-20 bg-custom-light-gray px-4 text-center text-black text-2xl font-normal font-inter border-none outline-none rounded"
              />
              <span className="text-black text-2xl font-normal font-inter">월</span>
              <input
                type="text"
                value={patientInfo.birthDay}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 31)) {
                    handleChange('birthDay', value);
                  }
                }}
                placeholder="일"
                maxLength={2}
                className="w-32 h-20 bg-custom-light-gray px-4 text-center text-black text-2xl font-normal font-inter border-none outline-none rounded"
              />
              <span className="text-black text-2xl font-normal font-inter">일</span>
            </div>
          </div>

          {/* 전화번호 행 */}
          <div>
            <label className="block text-black text-3xl font-normal font-inter mb-4">
              전화번호
            </label>
            <input
              type="tel"
              value={patientInfo.phone}
              onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
              placeholder="예: 01012345678"
              maxLength={11}
              className="w-full h-20 bg-custom-light-gray px-6 text-black text-2xl font-normal font-inter border-none outline-none rounded"
            />
          </div>
        </div>
      </div>

      {/* 다음 버튼 */}
      <button
        onClick={handleNext}
        className="absolute left-[1127px] top-[752px] w-28 h-14 bg-white hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center"
      >
        <span className="text-black text-2xl font-normal font-inter">다음 →</span>
      </button>
    </div>
  );
}

