/**
 * An SDK "family" groups providers that share a message format and response shape.
 * Adding a provider that fits an existing family requires only a registry entry.
 * Adding a new family requires a new FamilyCall implementation.
 */
export type Family = 'anthropic' | 'openai-compat';

/** Resolved inputs a family call receives after the registry has looked up meta + env. */
export interface CallArgs {
  prompt: string;
  systemPrompt?: string;
  model: string;
  apiKey?: string;
  baseURL?: string;
}

export type FamilyCall = (args: CallArgs) => Promise<string>;

/**
 * One row in the provider registry. Pure data - no SDK references.
 * envKey/baseUrlEnv are names of env vars that will be read at call time.
 */
export interface ProviderMeta {
  family: Family;
  envKey?: string;       // env var holding the API key, if the provider needs one
  baseUrl?: string;      // hardcoded endpoint (e.g. Groq has a known URL)
  baseUrlEnv?: string;   // env var name for a user-supplied endpoint (e.g. local Ollama)
  defaultModel: string;  // fallback when the caller does not specify a model
}
