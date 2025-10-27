import { Chat } from '@google/genai';

export enum Sender {
  User = 'user',
  DrGopalan = 'dr_gopalan',
}

export interface Message {
  sender: Sender;
  content: string;
  timestamp: string;
  status?: 'streaming' | 'complete' | 'error';
  loadingMessage?: string;
}

export type ChatSession = Chat | null;