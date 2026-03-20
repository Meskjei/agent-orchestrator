import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export interface BrainLLMConfig {
  provider: 'anthropic' | 'openai' | 'local' | 'custom';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export function createLLM(config: BrainLLMConfig) {
  switch (config.provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
        baseURL: config.baseUrl,
      });
      return anthropic(config.model ?? 'claude-sonnet-4-20250514');
    }
    case 'openai': {
      const openai = createOpenAI({
        apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
        baseURL: config.baseUrl,
      });
      return openai(config.model ?? 'gpt-4o');
    }
    case 'local': {
      const openai = createOpenAI({
        apiKey: config.apiKey ?? 'ollama',
        baseURL: config.baseUrl ?? 'http://localhost:11434/v1',
      });
      return openai(config.model ?? 'llama3');
    }
    case 'custom': {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      return openai(config.model ?? 'gpt-4o');
    }
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}