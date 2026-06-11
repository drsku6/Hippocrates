import { Chat } from '@google/genai';

export enum Sender {
  User = 'user',
  EvidenceFlowAI = 'EvidenceFlowAI',
}

export interface Message {
  sender: Sender;
  content: string;
  timestamp: string;
  status?: 'streaming' | 'complete' | 'error';
  loadingMessage?: string;
  isChoicePrompt?: boolean;
  choiceSelected?: string;
  originalCaseText?: string;
  isHtml?: boolean;
}

export type ChatSession = Chat | null;

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  patientSummary?: PatientSummary;
  masterAlgorithmHtml?: string;
  isGeneratingAlgorithm?: boolean;
  algorithmError?: string;
  createdAt?: number;
}

export interface PatientSummary {
  summary: string;
  topic: string;
}