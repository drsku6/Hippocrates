import { GoogleGenAI, Chat } from "@google/genai";
import { evidenceflowai_PERSONA } from '../constants';
import { getApPrompt } from '../prompts/ap';
import { getHandoffPrompt } from '../prompts/handoff';
import { getStickyNotePrompt } from '../prompts/stickyNote';
import { getPresentationPrompt } from '../prompts/presentation';


if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const createChatSession = (): Chat => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: evidenceflowai_PERSONA,
      },
    });
    return chat;
  } catch (error) {
    console.error("Error creating chat session:", error);
    throw new Error("Failed to create a session with EvidenceFlowAI.");
  }
};


const getPromptForCommand = (command: string, conversationHistory: string): string | null => {
    switch(command.trim()) {
        case '/generate assessment and plan':
            return getApPrompt(conversationHistory);
        case '/generate sticky note':
            return getStickyNotePrompt(conversationHistory);
        case '/generate handoff':
            return getHandoffPrompt(conversationHistory);
        case '/generate short presentation':
            return getPresentationPrompt(conversationHistory);
        default:
            return null;
    }
}

export const sendMessageStream = async (chat: Chat, message: string, conversationHistory: string) => {
  try {
    const commandPrompt = getPromptForCommand(message, conversationHistory);
    if (commandPrompt) {
        return ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: commandPrompt
        });
    }
    return await chat.sendMessageStream({ message });
  } catch (error) {
    console.error("Error sending message to Gemini API:", error);
    throw new Error("Failed to get a response from EvidenceFlowAI.");
  }
};