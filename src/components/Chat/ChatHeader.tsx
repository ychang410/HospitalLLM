import { Category } from '../ChatInterface';

interface ChatHeaderProps {
  currentCategory: Category | null;
  onCategoryChange: (category: Category) => void;
  maxReachedIndex: number;
  isBasicInfoComplete: boolean;
  isMainDiagnosisComplete: boolean;
  isNewPainComplete: boolean;
  isSideEffectsComplete: boolean;
}

const categories: { key: Category; label: string }[] = [
  { key: 'basic_info', label: '기본 정보' },
  { key: 'main_diagnosis', label: '주요 진단 내용' },
  { key: 'new_pain', label: '그외/새로운 통증' },
  { key: 'side_effects', label: '부작용' },
  { key: 'additional_questions', label: '기타' },
];

export default function ChatHeader({ currentCategory, onCategoryChange, maxReachedIndex, isBasicInfoComplete, isMainDiagnosisComplete, isNewPainComplete, isSideEffectsComplete }: ChatHeaderProps) {
  const getTabPosition = (index: number) => {
    // 새로운 디자인에 맞춘 정확한 위치
    const positions = [
      { left: '60px' },    // 기본 정보
      { left: '316px' },   // 주요 진단 내용
      { left: '572px' },   // 그외/새로운 통증
      { left: '828px' },   // 부작용
      { left: '1083px' },  // 추가 질문
    ];
    return positions[index];
  };

  return (
    <div className="relative">
      {categories.map((category, index) => {
        const position = getTabPosition(index);
        const isActive = currentCategory === category.key;
        const isReachable = index === 0 || (index <= maxReachedIndex + 1 && (
          index === 1 ? isBasicInfoComplete :
          index === 2 ? isMainDiagnosisComplete :
          index === 3 ? isNewPainComplete :
          index === 4 ? isSideEffectsComplete :
          true
        ));
        const isDisabled = !isReachable;
        // 하얀색으로 표시될 탭 (활성화된 탭 또는 maxReachedIndex까지의 탭)
        const isWhite = index <= maxReachedIndex;
        
        return (
          <button
            key={category.key}
            onClick={() => {
              if (isReachable) {
                onCategoryChange(category.key);
              }
            }}
            disabled={isDisabled && maxReachedIndex !== -1} // 초기 상태에서는 disabled 속성 제거
            className={`absolute top-[20px] w-56 h-20 px-6 py-6 rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-300 inline-flex flex-col justify-between items-start overflow-hidden transition-all duration-300 ${
              isActive
                ? 'bg-orange-200 text-black'
                : isWhite
                ? isDisabled
                  ? 'bg-white text-black cursor-not-allowed opacity-50'
                  : 'bg-white text-black cursor-pointer hover:bg-gray-50'
                : isDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-black cursor-pointer hover:bg-gray-50'
            }`}
            style={{ left: position.left }}
          >
            <div className="self-stretch inline-flex justify-start items-center gap-3">
              <div className="flex-1 text-center justify-start text-black text-2xl font-bold font-inter">
                {category.label}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

