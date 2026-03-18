import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ServiceCard from './components/ServiceCard';
import ChatMessage from './components/ChatMessage';
import { SERVICES, LOGO_URL } from './constants';
import { ChatMessage as ChatMessageType, SendingState, BookingDetails } from './types';
import { initializeChat, sendMessageToGemini, sendToolResponseToGemini } from './services/geminiService';
import { saveBookingToSheet, checkAvailability } from './services/sheetService';
import type { Chat } from '@google/genai';

export default function App() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [sendingState, setSendingState] = useState<SendingState>(SendingState.Idle);
  
  // Initialize embed mode from URL immediately
  const [isEmbedMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('mode') === 'embed';
    }
    return false;
  });
  
  const [showServiceOverlay, setShowServiceOverlay] = useState(false);

  const chatInstance = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Chat
  useEffect(() => {
    chatInstance.current = initializeChat();
    
    setMessages([
      {
        id: 'init-1',
        role: 'model',
        text: "Hello! Welcome to SwiftBooks. I'm SwiftBot. I can help you schedule an appointment for audit preparation, tax advisory, or any of our professional services."
      }
    ]);
  }, []);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sendingState]);

  const handleServiceClick = (serviceName: string) => {
    const prompt = `I'm interested in ${serviceName}. Can you help me book an appointment?`;
    setInput(prompt);
    setShowServiceOverlay(false); // Close overlay if open
    // In a real app we might auto-focus the input here
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input;
    if (!textToSend.trim() || !chatInstance.current || sendingState !== SendingState.Idle) return;

    // 1. Add User Message
    const userMsgId = Date.now().toString();
    const newMessages: ChatMessageType[] = [
      ...messages,
      { id: userMsgId, role: 'user', text: textToSend }
    ];
    setMessages(newMessages);
    setInput('');
    setSendingState(SendingState.Sending);

    try {
      // 2. Send to Gemini
      const response = await sendMessageToGemini(textToSend, chatInstance.current);

      // 3. Handle Tool Calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        setSendingState(SendingState.ProcessingTool);
        
        // We might have multiple tool calls, but usually just one in this flow
        const toolCall = response.toolCalls[0];
        const args = toolCall.args;
        
        if (toolCall.name === 'checkAvailability') {
          // --- HANDLE AVAILABILITY CHECK ---
          const dateToCheck = args.date as string;
          const slots = await checkAvailability(dateToCheck);
          
          let resultMessage = "";
          if (slots.length > 0) {
             resultMessage = `Available times for ${dateToCheck}: ${slots.join(', ')}`;
          } else {
             resultMessage = `No available slots found for ${dateToCheck}. Please choose another day.`;
          }

          // Send result back to Gemini
          const nextModelResponse = await sendToolResponseToGemini(
            chatInstance.current,
            toolCall.id,
            toolCall.name,
            { availableSlots: slots }
          );

          setMessages(prev => [
            ...prev,
            { 
              id: Date.now().toString(), 
              role: 'model', 
              text: nextModelResponse
            }
          ]);

        } else if (toolCall.name === 'bookAppointment') {
          // --- HANDLE BOOKING ---
          const bookingData: BookingDetails = {
              name: args.name as string,
              email: args.email as string,
              service: args.service as string,
              datetime: args.datetime as string,
              confirmationCode: `SB-${Math.floor(Math.random() * 10000)}`
          };
  
          // Save to Google Sheet (returns Meet Link if successful)
          const meetLink = await saveBookingToSheet(bookingData);
          
          if (meetLink) {
              bookingData.meetLink = meetLink;
          }
  
          // Send Tool Response back to Gemini
          const finalConfirmationText = await sendToolResponseToGemini(
              chatInstance.current,
              toolCall.id,
              toolCall.name,
              { status: "success", confirmationCode: bookingData.confirmationCode }
          );
  
          // Add Model Message with Tool Result UI
          setMessages(prev => [
              ...prev,
              { 
                  id: Date.now().toString(), 
                  role: 'model', 
                  text: finalConfirmationText,
                  toolResult: bookingData
              }
          ]);
        }

      } else {
        // Normal text response
        setMessages(prev => [
          ...prev,
          { id: Date.now().toString(), role: 'model', text: response.text }
        ]);
      }

    } catch (error) {
      console.error("Chat Error", error);
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'model', text: "I encountered an error processing your request. Please try again." }
      ]);
    } finally {
      setSendingState(SendingState.Idle);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- RENDER LOGIC ---

  // 1. The Service Grid (Reusable)
  const ServiceGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
      {SERVICES.map((service) => (
        <ServiceCard 
          key={service.id} 
          service={service} 
          onClick={handleServiceClick} 
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      {/* Hide Global Header in Embed Mode */}
      {!isEmbedMode && <Header />}

      <main className={`flex-grow w-full mx-auto ${isEmbedMode ? 'h-screen p-0 overflow-hidden' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8'}`}>
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 ${isEmbedMode ? 'h-full' : 'lg:h-[calc(100vh-10rem)]'}`}>
          
          {/* Left Column: Services (Hidden in Embed Mode) */}
          {!isEmbedMode && (
            <div className="lg:col-span-7 flex flex-col gap-6 lg:overflow-y-auto pr-2 scrollbar-hide pb-10 lg:pb-0">
              <div className="mb-4">
                <h1 className="text-4xl font-extrabold text-[#001740] mb-3 font-heading tracking-tight">Expert Accounting Solutions</h1>
                <p className="text-slate-600 text-lg leading-relaxed">
                  SwiftBooks provides comprehensive financial services tailored to your business needs. 
                  Select a service to start your booking inquiry.
                </p>
              </div>
              <ServiceGrid />
            </div>
          )}

          {/* Right Column: Chat Interface (Full width in Embed Mode) */}
          <div className={`${isEmbedMode ? 'col-span-12 h-full rounded-none border-none' : 'col-span-1 lg:col-span-5 h-[600px] lg:h-full rounded-2xl shadow-xl border border-slate-200'} flex flex-col bg-white overflow-hidden relative`}>
            
            {/* Chat Header */}
            <div className="bg-[#001740] p-4 flex items-center justify-between shadow-md z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                    {/* Bot Avatar */}
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                        <img src={LOGO_URL} alt="Bot" className="w-full h-full object-contain p-1" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#001740] rounded-full"></div>
                </div>
                <div>
                  <h2 className="text-white font-bold text-sm font-heading tracking-wide">SwiftBot</h2>
                  <p className="text-slate-300 text-xs">Assistant</p>
                </div>
              </div>
              
              {/* "Services" button only visible in Embed Mode */}
              {isEmbedMode && (
                <button 
                  onClick={() => setShowServiceOverlay(true)}
                  className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition-colors border border-white/20"
                >
                  View Services
                </button>
              )}
            </div>

            {/* Chat Messages Area */}
            <div className="flex-grow overflow-y-auto p-4 bg-slate-50 relative scrollbar-hide" ref={chatContainerRef}>
               {messages.length === 0 && (
                   <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                       Start a conversation...
                   </div>
               )}
               
               {messages.map((msg) => (
                 <ChatMessage key={msg.id} message={msg} />
               ))}

               {sendingState !== SendingState.Idle && (
                 <div className="flex justify-start mb-4 animate-pulse">
                   <div className="flex gap-1 bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none items-center shadow-sm">
                     <div className="w-2 h-2 bg-[#ce1126] rounded-full animate-bounce" style={{ animationDelay: '0ms'}}></div>
                     <div className="w-2 h-2 bg-[#ce1126] rounded-full animate-bounce" style={{ animationDelay: '150ms'}}></div>
                     <div className="w-2 h-2 bg-[#ce1126] rounded-full animate-bounce" style={{ animationDelay: '300ms'}}></div>
                   </div>
                 </div>
               )}
               <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
              <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-[#ce1126]/20 focus-within:border-[#ce1126] transition-all shadow-inner">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask to book an appointment..."
                  className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-800 resize-none max-h-32 py-2 px-1 placeholder:text-slate-400"
                  rows={1}
                  style={{ minHeight: '44px' }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || sendingState !== SendingState.Idle}
                  className="p-2.5 rounded-lg bg-[#ce1126] text-white hover:bg-[#b00c1e] disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-0.5 shadow-md hover:shadow-lg active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Overlay for Services (Embed Mode Only) */}
            {isEmbedMode && showServiceOverlay && (
              <div className="absolute inset-0 z-20 bg-slate-50/95 backdrop-blur-sm p-4 animate-fade-in flex flex-col">
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <h3 className="font-bold text-[#001740] text-lg">Select a Service</h3>
                  <button onClick={() => setShowServiceOverlay(false)} className="p-2 bg-white rounded-full shadow-sm text-slate-500 hover:text-[#ce1126]">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="overflow-y-auto flex-grow pr-2">
                   <ServiceGrid />
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
