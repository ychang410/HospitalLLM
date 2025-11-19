import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
}

export default function ChatInput({ onSendMessage }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center justify-between" style={{ gap: '20px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="여기에 입력해주세요 ..."
          className="flex-1 h-16 px-7 bg-white rounded-xl text-2xl font-normal font-inter border-none outline-none focus:ring-2 focus:ring-gray-300 placeholder:text-2xl placeholder:text-black"
        />
        <button
          onClick={handleSend}
          className="flex items-center justify-center bg-transparent border-none p-0 cursor-pointer flex-shrink-0"
          aria-label="음성 입력"
        >
          <img 
            src="/mdi_microphone.svg" 
            alt="마이크" 
            className="w-[59px] h-[59px]"
          />
        </button>
      </div>
    </div>
  );
}

