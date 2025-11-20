import { Category } from '../ChatInterface';

interface ChatHeaderProps {
  currentCategory: Category | null;
  onCategoryChange: (category: Category) => void;
  maxReachedIndex: number;
  isMainDiagnosisComplete: boolean;
  isNewPainComplete: boolean;
  isSideEffectsComplete: boolean;
}

const categories: { key: Category; label: string }[] = [
  { key: 'main_diagnosis', label: '주요 진단 내용' },
  { key: 'new_pain', label: '그외/새로운 통증' },
  { key: 'side_effects', label: '부작용' },
  { key: 'additional_questions', label: '기타' },
];

export default function ChatHeader({ currentCategory, onCategoryChange, maxReachedIndex, isMainDiagnosisComplete, isNewPainComplete, isSideEffectsComplete }: ChatHeaderProps) {
  const getTabPosition = (index: number) => {
    // 계산: 채팅창 왼쪽(60px) ~ 바디 이미지창 오른쪽(1307px) 사이에 박스 4개 균등 배치
    // 박스 너비: 288px (w-72)
    // 첫 번째 박스 left: 60px
    // 네 번째 박스 right: 1307px → left: 1307 - 288 = 1019px
    // 간격 = (1019 - 60 - 288 * 3) / 3 = (1019 - 60 - 864) / 3 = 95 / 3 = 31.67px
    const positions = [
      { left: '60px' },      // 주요 진단 내용: 60px
      { left: '380px' },     // 그외/새로운 통증: 60 + 288 + 32 = 380px
      { left: '700px' },     // 부작용: 380 + 288 + 32 = 700px
      { left: '1019px' },    // 기타: 700 + 288 + 31 = 1019px (오른쪽: 1019 + 288 = 1307px)
    ];
    return positions[index];
  };

  return (
    <div className="relative">
      {categories.map((category, index) => {
        const position = getTabPosition(index);
        const isActive = currentCategory === category.key;
        const isReachable = index === 0 || (index <= maxReachedIndex + 1 && (
          index === 0 ? true : // 주요 진단 내용은 항상 접근 가능
          index === 1 ? isMainDiagnosisComplete :
          index === 2 ? isNewPainComplete :
          index === 3 ? isSideEffectsComplete :
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
            className={`absolute top-[40px] w-72 px-8 py-4 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-zinc-300 inline-flex flex-col justify-start items-start gap-3 overflow-hidden transition-all duration-300 ${
              isActive
                ? 'bg-white/70 text-black'
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
              <div className="flex-1 justify-start text-black text-2xl font-medium font-inter">
                {category.label}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

