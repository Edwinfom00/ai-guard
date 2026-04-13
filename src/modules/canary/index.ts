import { randomUUID } from 'crypto';
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
 * Generates a cryptographically random canary token using crypto.randomUUID().
 * Encoded in base64 to resist LLM normalization and zero-width char stripping.
 */
export function generateCanaryToken(prefix = 'CNRY'): string {
  const uuid = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  const encoded = Buffer.from(uuid).toString('base64');
  return `[${prefix}:${encoded}]`;
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
  const leaked = output.includes(token);

  if (leaked && config.throwOnLeak !== false) {
    throw new GuardianError(
      'PROMPT_INJECTION_DETECTED',
      'Canary token leaked in LLM output — possible system prompt extraction.',
      { token, outputSnippet: output.slice(0, 200) }
    );
  }

  return { leaked, token };
}
