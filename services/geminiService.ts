
import { GoogleGenAI, Chat, Type, Content } from "@google/genai";
import { HIPPOCRATES_PERSONA } from '../constants';
import { getApPrompt } from '../prompts/ap';
import { getHandoffPrompt } from '../prompts/handoff';
import { getStickyNotePrompt } from '../prompts/stickyNote';
import { getPresentationPrompt } from '../prompts/presentation';
import { getLearningPrompt } from '../prompts/learning';
import { CaseOfTheWeek, CurbsideConsult } from "../types";


if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const createChatSession = (history?: Content[]): Chat => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
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
    switch(command.trim().toLowerCase()) {
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
        // Commands are text-only, using flash for speed
        return ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
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

export const generateLearningContent = async (conversationHistory: string): Promise<{ caseOfTheWeek: CaseOfTheWeek; curbsideConsults: CurbsideConsult[] }> => {
    try {
        const prompt = getLearningPrompt(conversationHistory);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Use a more powerful model for this complex task
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        caseOfTheWeek: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                summary: { type: Type.STRING },
                                reasoning: { type: Type.STRING },
                                learningPoints: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                },
                                whatIf: { type: Type.STRING }
                            },
                        },
                        curbsideConsults: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    question: { type: Type.STRING },
                                    answer: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        return parsedJson;

    } catch (error) {
        console.error("Error generating learning content:", error);
        throw new Error("Failed to generate learning content from Hippocrates.");
    }
};