// 신체 부위 타입 정의
export type BodyPart = 
  | 'head'           // 머리
  | 'neck'           // 목
  | 'shoulder'       // 어깨 (좌우 동시)
  | 'arm'            // 팔 (좌우 동시)
  | 'elbow'          // 팔꿈치 (좌우 동시)
  | 'wrist'          // 손목 (좌우 동시)
  | 'hand'           // 손 (좌우 동시)
  | 'chest'          // 가슴
  | 'abdomen'        // 배/복부
  | 'back'           // 등
  | 'lower_back'     // 허리
  | 'hip'            // 엉덩이/골반
  | 'leg'            // 다리 전체 (좌우 동시)
  | 'thigh'          // 허벅지 (좌우 동시)
  | 'knee'           // 무릎 (좌우 동시)
  | 'ankle'          // 발목 (좌우 동시)
  | 'foot';          // 발 (좌우 동시)

// 부위별 키워드 매핑 (한국어)
export const bodyPartKeywords: Record<BodyPart, string[]> = {
  head: ['머리', '두통', '두부', '두개', '관자', '이마', '뒤통수', '두부통증'],
  neck: ['목', '목덜미', '경부', '경추', '목통증', '목뼈'],
  shoulder: ['어깨', '견부', '견관절', '어깨통증', '어깨관절'],
  arm: ['팔', '상완', '상지', '팔통증', '팔꿈치', '상박'],
  elbow: ['팔꿈치', '주관절', '팔꿈치통증'],
  wrist: ['손목', '수근', '손목통증', '손목관절'],
  hand: ['손', '수부', '손가락', '손통증', '손목', '손바닥'],
  chest: ['가슴', '흉부', '흉곽', '가슴통증', '흉통', '심장'],
  abdomen: ['배', '복부', '위', '배통증', '복통', '위장', '소화'],
  back: ['등', '척추', '등통증', '척추통증'],
  lower_back: ['허리', '요추', '요부', '허리통증', '요통', '허리뼈'],
  hip: ['엉덩이', '골반', '고관절', '둔부', '골반통증', '고관절통증'],
  leg: ['다리', '하지', '다리통증', '하지통증', '다리 근력', '하지 근력'],
  thigh: ['허벅지', '대퇴', '허벅지통증', '대퇴부'],
  knee: ['무릎', '슬관절', '무릎통증', '무릎관절'],
  ankle: ['발목', '족관절', '발목통증', '발목관절'],
  foot: ['발', '족부', '발통증', '발가락', '발바닥', '발뒤꿈치'],
};

// leg, back, hip, arm을 제외한 부위별 좌표 위치 (이미지 기준 상대 좌표, 0-1 범위)
export const bodyPartPositions: Record<Exclude<BodyPart, 'leg' | 'back' | 'hip' | 'arm'>, { x: number; y: number }[]> = {
  head: [{ x: 0.5, y: 0.15 }],
  neck: [{ x: 0.5, y: 0.24 }],
  shoulder: [{ x: 0.35, y: 0.27 }, { x: 0.65, y: 0.27 }], // 좌우 동시
  elbow: [{ x: 0.27, y: 0.4 }, { x: 0.74, y: 0.4 }],
  wrist: [{ x: 0.25, y: 0.55 }, { x: 0.75, y: 0.55 }],
  hand: [{ x: 0.14, y: 0.51 }, { x: 0.87, y: 0.51 }],
  chest: [{ x: 0.5, y: 0.35 }],
  abdomen: [{ x: 0.505, y: 0.42 }],
  lower_back: [{ x: 0.5, y: 0.55 }],
  thigh: [{ x: 0.41, y: 0.57 }, { x: 0.6, y: 0.57 }],
  knee: [{ x: 0.41, y: 0.65 }, { x: 0.6, y: 0.65 }],
  ankle: [{ x: 0.41, y: 0.8 }, { x: 0.6, y: 0.8 }],
  foot: [{ x: 0.36, y: 0.86 }, { x: 0.65, y: 0.86 }],
};

// leg 전용 좌표 (다리 전체 영역 - 좌우 합쳐서 하나)
export interface LegPosition {
  x: number; // 중심 x 좌표
  y: number; // 시작 y 좌표
  width: number; // 너비 (상대값 또는 픽셀)
  height: number; // 높이 (상대값)
}

export const legPosition: LegPosition = {
  x: 0.5,     // 중심 x 좌표
  y: 0.57,    // 시작 y 좌표 (thigh 위치)
  width: 0.19, // 상대 너비 (가로로 넓게)
  height: 0.29, // 상대 높이 (foot y - thigh y)
};

// back 전용 좌표 (등 전체 영역)
export interface BackPosition {
  x: number; // 중심 x 좌표
  y: number; // 중심 y 좌표
  width: number; // 너비 (상대값)
  height: number; // 높이 (상대값)
}

export const backPosition: BackPosition = {
  x: 0.5,      // 중심 x 좌표
  y: 0.35,     // 중심 y 좌표
  width: 0.24, // 상대 너비
  height: 0.18, // 상대 높이
};

// hip 전용 좌표 (엉덩이 영역)
export interface HipPosition {
  x: number; // 중심 x 좌표
  y: number; // 중심 y 좌표
  width: number; // 너비 (상대값)
  height: number; // 높이 (상대값)
}

export const hipPosition: HipPosition = {
  x: 0.5,      // 중심 x 좌표
  y: 0.65,     // 중심 y 좌표
  width: 0.2,  // 상대 너비 (가로로 넓게)
  height: 0.08, // 상대 높이
};

// arm 전용 좌표 (팔 전체 영역 - 각도 반영)
export interface ArmPosition {
  left: { 
    startX: number; // 시작 x 좌표 (shoulder)
    startY: number; // 시작 y 좌표 (shoulder)
    endX: number;   // 끝 x 좌표 (hand)
    endY: number;   // 끝 y 좌표 (hand)
    width: number;  // 너비 (픽셀)
  };
  right: { 
    startX: number; // 시작 x 좌표 (shoulder)
    startY: number; // 시작 y 좌표 (shoulder)
    endX: number;   // 끝 x 좌표 (hand)
    endY: number;   // 끝 y 좌표 (hand)
    width: number;  // 너비 (픽셀)
  };
}

export const armPosition: ArmPosition = {
  left: {
    startX: 0.35,  // shoulder
    startY: 0.27,
    endX: 0.16,    // hand
    endY: 0.51,
    width: 100,    // 픽셀 단위 너비
  },
  right: {
    startX: 0.65,  // shoulder
    startY: 0.27,
    endX: 0.85,    // hand
    endY: 0.51,
    width: 100,    // 픽셀 단위 너비
  },
};

interface HumanModel3DProps {
  highlightedParts?: BodyPart[];
  showAllParts?: boolean; // 모든 부위를 표시할지 여부 (테스트용)
}

export default function HumanModel3D({ highlightedParts = [], showAllParts = false }: HumanModel3DProps) {
  console.log('HumanModel3D highlightedParts:', highlightedParts);
  console.log('HumanModel3D showAllParts:', showAllParts);
  
  // showAllParts가 true이면 큰 네모들(leg, arm, back, hip)만 표시
  const partsToShow: BodyPart[] = showAllParts 
    ? ['leg', 'arm', 'back', 'hip']
    : highlightedParts;
  
  console.log('HumanModel3D partsToShow:', partsToShow);
  
  return (
    <div className="relative w-full h-full">
      <style>{`
        @keyframes ripple {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.4;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.3);
            opacity: 0.2;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.8);
            opacity: 0;
          }
        }
        @keyframes rippleRect {
          0% {
            transform: translateX(-50%) scale(0.9);
            opacity: 0.4;
          }
          50% {
            transform: translateX(-50%) scale(1.2);
            opacity: 0.2;
          }
          100% {
            transform: translateX(-50%) scale(1.5);
            opacity: 0;
          }
        }
        @keyframes rippleRectCenter {
          0% {
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0.4;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.2;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
      <img 
        src="/body_image.jpg" 
        alt="인체 모델" 
        className="w-full h-full object-contain object-center border-none outline-none"
        style={{ 
          border: 'none', 
          outline: 'none',
          objectPosition: 'center center'
        }}
      />
      
      {/* leg인 경우 다리 전체를 하나의 둥근 네모로 표시 */}
      {partsToShow.includes('leg') && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${legPosition.x * 101}%`,
            top: `${legPosition.y * 80}%`,
            width: `${legPosition.width * 200}%`,
            height: `${legPosition.height * 130}%`,
            transform: 'translate(-50%, 0)',
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderRadius: '60px',
            zIndex: 9,
          }}
        >
          {/* 퍼져나가는 애니메이션 */}
          {[0, 1, 2].map((ringIndex) => (
            <div
              key={`leg-ring-${ringIndex}`}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                width: '100%',
                height: '100%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(59, 130, 246, 0.3)',
                borderRadius: '60px',
                animation: `rippleRectCenter 2s ease-out infinite`,
                animationDelay: `${ringIndex * 0.6}s`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}
      
      {/* arm인 경우 팔 전체를 둥근 네모로 표시 (수직선) */}
      {partsToShow.includes('arm') && (
        <>
          {/* 왼쪽 팔 수직선 (오른쪽으로 20도 회전) */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${armPosition.left.startX * 101.5}%`,
              top: `${armPosition.left.startY * 98}%`,
              width: `${armPosition.left.width - 50}px`,
              height: '25%',
              transform: 'translate(-50%, 0) rotate(20deg)',
              transformOrigin: '50% 0',
              backgroundColor: 'rgba(59, 130, 246, 0.5)',
              borderRadius: '50px',
              zIndex: 9,
            }}
          >
            {/* 퍼져나가는 애니메이션 */}
            {[0, 1, 2].map((ringIndex) => (
              <div
                key={`arm-left-ring-${ringIndex}`}
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                  width: '100%',
                  height: '100%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                  borderRadius: '50px',
                  animation: `rippleRectCenter 2s ease-out infinite`,
                  animationDelay: `${ringIndex * 0.6}s`,
                  opacity: 0,
                }}
              />
            ))}
          </div>
          {/* 오른쪽 팔 수직선 (왼쪽으로 20도 회전) */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${armPosition.right.startX * 100.5}%`,
              top: `${armPosition.right.startY * 98}%`,
              width: `${armPosition.right.width - 50}px`,
              height: '25%',
              transform: 'translate(-50%, 0) rotate(-20deg)',
              transformOrigin: '50% 0',
              backgroundColor: 'rgba(59, 130, 246, 0.5)',
              borderRadius: '50px',
              zIndex: 9,
            }}
          >
            {/* 퍼져나가는 애니메이션 */}
            {[0, 1, 2].map((ringIndex) => (
              <div
                key={`arm-right-ring-${ringIndex}`}
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                  width: '100%',
                  height: '100%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                  borderRadius: '50px',
                  animation: `rippleRectCenter 2s ease-out infinite`,
                  animationDelay: `${ringIndex * 0.6}s`,
                  opacity: 0,
                }}
              />
            ))}
          </div>
        </>
      )}
      
      {/* hip인 경우 엉덩이를 가로 둥근 네모로 표시 */}
      {partsToShow.includes('hip') && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${hipPosition.x * 100.5}%`,
            top: `${hipPosition.y * 77}%`,
            width: `${hipPosition.width * 220}%`,
            height: `${hipPosition.height * 120}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderRadius: '30px',
            zIndex: 9,
          }}
        >
          {/* 퍼져나가는 애니메이션 */}
          {[0, 1, 2].map((ringIndex) => (
            <div
              key={`hip-ring-${ringIndex}`}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                width: '100%',
                height: '100%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(59, 130, 246, 0.3)',
                borderRadius: '30px',
                animation: `rippleRectCenter 2s ease-out infinite`,
                animationDelay: `${ringIndex * 0.6}s`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}
      
      {/* back인 경우 등을 둥근 네모로 표시 */}
      {partsToShow.includes('back') && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${backPosition.x * 100.5}%`,
            top: `${backPosition.y * 100}%`,
            width: `${backPosition.width * 150}%`,
            height: `${backPosition.height * 120}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderRadius: '20px',
            zIndex: 9,
          }}
        >
          {/* 퍼져나가는 애니메이션 */}
          {[0, 1, 2].map((ringIndex) => (
            <div
              key={`back-ring-${ringIndex}`}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                width: '100%',
                height: '100%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(59, 130, 246, 0.3)',
                borderRadius: '20px',
                animation: `rippleRectCenter 2s ease-out infinite`,
                animationDelay: `${ringIndex * 0.6}s`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}
      
      {/* 하이라이트 오버레이 */}
      {partsToShow.filter(part => part !== 'leg' && part !== 'arm' && part !== 'back' && part !== 'hip').map((part, partIndex) => {
        const positions = bodyPartPositions[part];
        console.log(`Part: ${part}, Positions:`, positions);
        if (!positions || positions.length === 0) {
          console.warn(`No positions found for body part: ${part}`);
          return null;
        }
        return positions.map((pos, posIndex) => (
          <div
            key={`${part}-${partIndex}-${posIndex}`}
            className="absolute pointer-events-none"
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
          >
            {/* 정적 하이라이트 원 */}
            <div 
              className="absolute rounded-full"
              style={{
                width: `60px`,
                height: `60px`,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                zIndex: 10,
              }}
            />
            {/* 퍼져나가는 애니메이션 원들 */}
            {[0, 1, 2].map((ringIndex) => (
              <div
                key={`ring-${ringIndex}`}
                className="absolute rounded-full"
                style={{
                  width: `120px`,
                  height: `120px`,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                  animation: `ripple 2s ease-out infinite`,
                  animationDelay: `${ringIndex * 0.6}s`,
                  opacity: 0,
                  zIndex: 10,
                }}
              />
            ))}
          </div>
        ));
      })}
    </div>
  );
}

