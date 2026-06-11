
import { GoogleGenAI, Chat, Type, Content } from "@google/genai";
import { HIPPOCRATES_PERSONA } from '../constants';
import { getApPrompt } from '../prompts/ap';
import { getHandoffPrompt } from '../prompts/handoff';
import { getStickyNotePrompt } from '../prompts/stickyNote';
import { getPresentationPrompt } from '../prompts/presentation';
import { getPatientSummaryPrompt, getMasterAlgorithmPrompt } from '../prompts/learning';
import { PatientSummary } from "../types";


if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const createChatSession = (history?: Content[]): Chat => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3.5-flash',
      config: {
        systemInstruction: HIPPOCRATES_PERSONA,
      },
      history: history,
    });
    return chat;
  } catch (error) {
    console.error("Error creating chat session:", error);
    throw new Error("Failed to create a session with Hippocrates.");
  }
};


const getPromptForCommand = (command: string, conversationHistory: string): string | null => {
    const trimmedCmd = command.trim().toLowerCase();
    if (trimmedCmd.startsWith('/clinicalalgorithm')) {
        const topic = command.replace(/^\/clinicalalgorithm\s*/i, '').trim();
        const input = topic || conversationHistory;
        if (!input.trim()) {
            return `Please specify a topic to generate an algorithm. For example, type '/clinicalalgorithm Hyponatremia' or describe a patient case first.`;
        }
        return getMasterAlgorithmPrompt(input);
    }

    switch(trimmedCmd) {
        case '/assessment_and_plan':
            return getApPrompt(conversationHistory);
        case '/sticky_note':
            return getStickyNotePrompt(conversationHistory);
        case '/handoff':
            return getHandoffPrompt(conversationHistory);
        case '/short_presentation':
            return getPresentationPrompt(conversationHistory);
        default:
            return null;
    }
}

export const sendMessageStream = async (chat: Chat, message: string, conversationHistory: string) => {
  try {
    const commandPrompt = getPromptForCommand(message, conversationHistory);
    if (commandPrompt) {
        // Commands are text-only, using flash for speed
        return ai.models.generateContentStream({
            model: 'gemini-3.5-flash',
            contents: commandPrompt
        });
    }
    
    // Use the existing chat session for conversational messages
    return await chat.sendMessageStream({ message });

  } catch (error) {
    console.error("Error sending message to Gemini API:", error);
    throw new Error("Failed to get a response from Hippocrates.");
  }
};

export const generatePatientSummary = async (conversationHistory: string): Promise<PatientSummary> => {
    try {
        const prompt = getPatientSummaryPrompt(conversationHistory);
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        topic: { type: Type.STRING }
                    },
                    required: ['summary', 'topic']
                }
            }
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        return parsedJson;

    } catch (error) {
        console.error("Error generating patient summary:", error);
        throw new Error("Failed to generate patient summary from Hippocrates.");
    }
};

export const generateMasterAlgorithm = async (input: string): Promise<string> => {
    try {
        const prompt = getMasterAlgorithmPrompt(input);
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
        });

        return response.text.trim();

    } catch (error) {
        console.error("Error generating master algorithm:", error);
        throw new Error("Failed to generate master algorithm from Hippocrates.");
    }
};