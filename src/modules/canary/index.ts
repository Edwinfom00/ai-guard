import { GuardianError } from '../../core/errors.js';

export interface CanaryConfig {
  enabled: boolean;
  /** Throw when canary token found in output. Default: true */
  throwOnLeak?: boolean;
  /** Custom prefix for the canary token. Default: 'CNRY' */
  prefix?: string;
}

export interface CanaryResult {
  leaked: boolean;
  token: string;
}

/**
 * Generates a cryptographically random canary token.
 * Uses zero-width unicode chars between segments to make it
 * nearly impossible for the LLM to reproduce naturally.
 */
export function generateCanaryToken(prefix = 'CNRY'): string {
  const rand = Math.random().toString(36).slice(2, 9).toUpperCase();
  // \u200B = zero-width space — invisible in UI but detectable in output
  return `[${prefix}\u200B:${rand}]`;
}

/**
 * Injects a canary token at the end of a prompt.
 * The token is invisible in most UIs but will appear in the raw LLM output
 * if the model echoes back the system prompt.
 */
export function injectCanary(prompt: string, token: string): string {
  return `${prompt}\n<!-- ${token} -->`;
}

/**
 * Checks whether the canary token leaked into the LLM's response.
 */
export function checkCanaryLeak(
  output: string,
  token: string,
  config: CanaryConfig
): CanaryResult {
  // Strip zero-width spaces for comparison — some models may strip them
  const normalize = (s: string) => s.replace(/\u200B/g, '');
  const leaked = normalize(output).includes(normalize(token));

  if (leaked && config.throwOnLeak !== false) {
    throw new GuardianError(
      'PROMPT_INJECTION_DETECTED',
      'Canary token leaked in LLM output — possible system prompt extraction.',
      { token, outputSnippet: output.slice(0, 200) }
    );
  }

  return { leaked, token };
}
