import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import type { Config } from '@feynman/types';

/**
 * Factory: returns a Vercel AI SDK LanguageModel for the configured provider + model.
 *
 * Adding a new provider in the future = add a case here + update Config type.
 * No hand-rolled adapter needed — the SDK's LanguageModel interface is the abstraction.
 */
export function createProviderModel(config: Config): LanguageModel {
  const { provider, model } = config;

  switch (provider) {
    case 'lmstudio': {
      const lmstudio = createOpenAICompatible({
        name: 'lmstudio',
        baseURL: config.lmstudio.baseUrl,
      });
      return lmstudio(model);
    }

    case 'openrouter': {
      if (!config.openrouter.apiKey) {
        throw new Error(
          "OpenRouter API key is missing.\n" +
            "Set the OPENROUTER_API_KEY environment variable or add it to your config:\n" +
            '  ~/.feynman/config.json → { "openrouter": { "apiKey": "sk-..." } }',
        );
      }
      const openrouter = createOpenRouter({ apiKey: config.openrouter.apiKey });
      return openrouter(model);
    }

    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}
