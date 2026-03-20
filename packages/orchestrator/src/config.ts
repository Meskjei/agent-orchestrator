import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export interface BrainLLMConfig {
  provider: 'anthropic' | 'openai' | 'local';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export function createLLM(config: BrainLLMConfig) {
  if (config.apiKey) {
    process.env[config.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'] = config.apiKey;
  }

  switch (config.provider) {
    case 'anthropic':
      return anthropic(config.model ?? 'claude-sonnet-4-20250514');
    case 'openai':
      return openai(config.model ?? 'gpt-4o');
    case 'local':
      return openai(config.model ?? 'llama3');
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}