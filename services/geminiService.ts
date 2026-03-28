import { GoogleGenAI, Type } from "@google/genai";
import type { FunctionDeclaration, Chat, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

// Initialize Gemini Client
let apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey || apiKey === 'your_actual_api_key_here') {
    apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
}
const ai = new GoogleGenAI({ apiKey: apiKey });

// Tool 1: Check Availability
const checkAvailabilityTool: FunctionDeclaration = {
  name: "checkAvailability",
  description: "Checks the calendar for available time slots on a specific date.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: {
        type: Type.STRING,
        description: "The date to check in YYYY-MM-DD format.",
      },
    },
    required: ["date"],
  },
};

// Tool 2: Book Appointment
const bookAppointmentTool: FunctionDeclaration = {
  name: "bookAppointment",
  description: "Books an appointment for a client with SwiftBooks.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: "The full name of the client.",
      },
      email: {
        type: Type.STRING,
        description: "The email address of the client.",
      },
      service: {
        type: Type.STRING,
        description: "The specific SwiftBooks service being requested.",
      },
      datetime: {
        type: Type.STRING,
        description: "The selected available date and time in ISO 8601 format (YYYY-MM-DDTHH:mm:ss).",
      },
    },
    required: ["name", "email", "service", "datetime"],
  },
};

let chatSession: Chat | null = null;

export const initializeChat = (): Chat => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const nextYear = currentYear + 1;
  const dateString = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });

  const dynamicInstruction = `
${SYSTEM_INSTRUCTION}

[CURRENT TIME REFERENCE]
Today's Date: ${dateString}

[CRITICAL INSTRUCTION: AVAILABILITY FIRST]
1. **Always Check Availability**: Before booking a specific time, you MUST use the 'checkAvailability' tool for the requested date. 
   - Ask the user for a preferred date.
   - Run 'checkAvailability(date)'.
   - Present the returned slots to the user.
   - ONLY proceed to 'bookAppointment' once the user selects a valid slot.
   
2. **Date Logic**: 
   - If the user says "January 5" and today is Feb 2025, assume 2026.
   - Always output dates in YYYY-MM-DD format for the check tool.
`;

  chatSession = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: dynamicInstruction,
      tools: [{ functionDeclarations: [checkAvailabilityTool, bookAppointmentTool] }],
    },
  });
  return chatSession;
};

export const sendMessageToGemini = async (
  message: string,
  chat: Chat
): Promise<{ text: string; toolCalls?: any[] }> => {
  try {
    const result: GenerateContentResponse = await chat.sendMessage({ message });
    
    // Check for tool calls
    const toolCalls = result.functionCalls;
    
    if (toolCalls && toolCalls.length > 0) {
        return { text: result.text || "", toolCalls: toolCalls };
    }

    return { text: result.text || "" };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "I apologize, but I'm having trouble connecting to the schedule right now. Please try again in a moment." };
  }
};

export const sendToolResponseToGemini = async (
  chat: Chat,
  toolId: string,
  toolName: string,
  result: any
): Promise<string> => {
    try {
        const resultResponse = await chat.sendMessage({
            message: [{
                functionResponse: {
                    id: toolId,
                    name: toolName,
                    response: { result: result } 
                }
            }]
        });
        return resultResponse.text || "";
    } catch (error) {
        console.error("Tool Response Error", error);
        return "I received the data, but had trouble generating a response.";
    }
}
