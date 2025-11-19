import { Message } from '../ChatInterface';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`inline-flex flex-col justify-start items-start gap-6 ${
          isUser
            ? 'bg-gray-800 text-white rounded-tl-[20px] rounded-tr-[20px] rounded-bl-[20px]'
            : 'bg-white text-black border border-gray-300 rounded-tl-[20px] rounded-tr-[20px] rounded-br-[20px]'
        }`}
        style={{ 
          maxWidth: 'fit-content',
          padding: '16px 32px' // 위아래 패딩 줄임
        }}
      >
        <div className={`self-stretch justify-start text-[28px] font-normal font-inter whitespace-pre-wrap ${
          isUser ? 'text-white' : 'text-black'
        }`}>
          {message.content}
        </div>
      </div>
    </div>
  );
}

