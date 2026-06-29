import { describe, it, expect, vi } from 'vitest';
import { Guardian } from '../../../src/core/Guardian.js';
import { redactPII } from '../../../src/modules/pii/redactor.js';

function makeOpenAIResponse(content: string) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 10 },
  };
}

describe('Reversible Anonymization', () => {
  it('should redact and generate a tokensMap locally', () => {
    const text = 'Contact john@company.com or sales@company.com. Call sales@company.com again.';
    const result = redactPII(text, { targets: ['email'], reversible: true });

    expect(result.text).toContain('[REDACTED:EMAIL_1]');
    expect(result.text).toContain('[REDACTED:EMAIL_2]');
    
    // Duplicate email sales@company.com should use the same token
    const firstSalesIndex = result.text.indexOf('[REDACTED:EMAIL_2]');
    const secondSalesIndex = result.text.lastIndexOf('[REDACTED:EMAIL_2]');
    expect(firstSalesIndex).not.toBe(secondSalesIndex);
    expect(firstSalesIndex).toBeGreaterThan(-1);

    expect(result.tokensMap).toBeDefined();
    expect(result.tokensMap?.get('[REDACTED:EMAIL_1]')).toBe('john@company.com');
    expect(result.tokensMap?.get('[REDACTED:EMAIL_2]')).toBe('sales@company.com');
  });

  it('should redact inputs and re-hydrate outputs in the Guardian lifecycle', async () => {
    const callFn = vi.fn().mockImplementation((prompt: string) => {
      // The LLM receives the anonymized prompt and responds referencing the tokens
      expect(prompt).toContain('[REDACTED:EMAIL_1]');
      expect(prompt).not.toContain('thomas@domain.com');
      return makeOpenAIResponse('Please contact [REDACTED:EMAIL_1] to finalize your request.');
    });

    const guard = new Guardian({
      pii: { targets: ['email'], onInput: true, onOutput: true, reversible: true },
    });

    const result = await guard.protect(callFn, 'My email is thomas@domain.com');

    // The final result.raw should be fully re-hydrated
    expect(result.raw).toBe('Please contact thomas@domain.com to finalize your request.');
  });
});
