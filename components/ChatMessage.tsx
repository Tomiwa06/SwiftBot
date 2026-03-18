import React from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import { LOGO_URL } from '../constants';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) return null;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden ${isUser ? 'bg-slate-200' : 'bg-white border border-slate-100'}`}>
          {isUser ? (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-0.5">
                 <img src={LOGO_URL} alt="Bot" className="w-full h-full object-contain" />
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="flex flex-col gap-2">
            <div 
            className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                isUser 
                ? 'bg-[#001740] text-white rounded-tr-none' 
                : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
            }`}
            >
            {message.text}
            </div>
            
            {/* Render Booking Card if successful tool result attached */}
            {message.toolResult && (
                <div className="bg-white border border-green-200 rounded-xl overflow-hidden mt-1 animate-fade-in shadow-md">
                    <div className="bg-[#001740] px-4 py-3 flex items-center gap-2 text-white font-bold text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-400">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                        </svg>
                        Appointment Confirmed
                    </div>
                    <div className="p-4 space-y-3 text-sm text-slate-700">
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Service</span>
                            <span className="font-semibold text-[#001740] text-right">{message.toolResult.service}</span>
                        </div>
                         <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Date & Time</span>
                            <span className="font-semibold text-[#001740]">{message.toolResult.datetime}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Client</span>
                            <span className="font-semibold text-[#001740]">{message.toolResult.name}</span>
                        </div>
                         <div className="flex justify-between pt-1">
                            <span className="text-slate-500">Reference</span>
                            <span className="font-mono text-[#ce1126] font-bold">{message.toolResult.confirmationCode}</span>
                        </div>
                    </div>
                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-500">
                            <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
                            <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
                        </svg>
                        <span>{message.toolResult.meetLink ? "Google Meet link sent to email" : "Calendar invite sent to email"}</span>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;