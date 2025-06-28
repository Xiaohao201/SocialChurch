export const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const defaultSystemPrompt = "你是一个友善的AI助手。";
export const defaultMaxTokens = 2000;
export const defaultTemperature = 0.7;

export const deepseekConfig = {
  apiKey: DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
}; 