import { describe, it, expect, vi } from 'vitest';
import { Guardian } from '../../src/core/Guardian.js';
import { GuardianSession } from '../../src/core/GuardianSession.js';
import { BudgetError } from '../../src/core/errors.js';

function makeOpenAIResponse(content: string, inputTokens = 10, outputTokens = 20) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
  };
}

describe('GuardianSession', () => {
  it('should initialize with a random session ID or custom session ID', () => {
    const session1 = new GuardianSession();
    expect(session1.getSessionId()).toBeDefined();
    expect(session1.getSessionId().startsWith('sess_')).toBe(true);

    const session2 = new GuardianSession({ sessionId: 'custom-session-id' });
    expect(session2.getSessionId()).toBe('custom-session-id');
  });

  it('should aggregate cumulative budget usage and enforce pre-flight and post-flight checks', async () => {
    // Budget limit is 50 tokens
    const guard = new Guardian({
      budget: { maxTokens: 50, model: 'gpt-4o-mini' },
    });

    const session = new GuardianSession();

    // First call consumes 30 tokens -> Total 30 -> OK
    const res1 = await guard.protect(
      async () => makeOpenAIResponse('First response', 15, 15),
      'First prompt',
      { session }
    );
    expect(res1.meta.budget?.totalTokens).toBe(30);
    expect(session.getCumulativeTokens()).toBe(30);

    // Second call consumes 15 tokens -> Total 45 -> OK
    const res2 = await guard.protect(
      async () => makeOpenAIResponse('Second response', 10, 5),
      'Second prompt',
      { session }
    );
    expect(res2.meta.budget?.totalTokens).toBe(15);
    expect(session.getCumulativeTokens()).toBe(45);

    // Third call consumes 10 tokens -> Exceeds budget on post-flight! -> Should throw BudgetError
    await expect(
      guard.protect(
        async () => makeOpenAIResponse('Third response', 5, 5),
        'Third prompt',
        { session }
      )
    ).rejects.toThrow(BudgetError);

    // Cumulative budget is now exceeded. Fourth call should throw BudgetError on pre-flight!
    // We mock the provider function to verify it's never called.
    const mockCall = vi.fn().mockResolvedValue(makeOpenAIResponse('Fourth response', 1, 1));
    await expect(
      guard.protect(mockCall, 'Fourth prompt', { session })
    ).rejects.toThrow(BudgetError);

    expect(mockCall).not.toHaveBeenCalled();
  });

  it('should detect cross-agent canary leaks within the same session', async () => {
    const guard = new Guardian({
      canary: { enabled: true, prefix: 'TEST-CNRY' },
    });

    const session = new GuardianSession();

    // Call Agent 1: this will generate a Canary Token in the session
    const call1 = vi.fn().mockImplementation((prompt) => {
      // Prompt should contain the canary token injected
      return makeOpenAIResponse('All good from agent 1');
    });

    await guard.protect(call1, 'Hello Agent 1', { session });
    
    // Get the generated canary token
    const generatedCanaries = session.getCanaryTokens();
    expect(generatedCanaries.length).toBe(1);
    const canaryToken = generatedCanaries[0]!;

    // Call Agent 2: we simulate Agent 2 leaking Agent 1's canary token
    const call2 = vi.fn().mockImplementation((prompt) => {
      return makeOpenAIResponse(`Leaking previous token: ${canaryToken}`);
    });

    await expect(
      guard.protect(call2, 'Hello Agent 2', { session })
    ).rejects.toThrow(/Canary token leaked/);
  });

  it('should record all audits within the session', async () => {
    const guard = new Guardian({
      budget: { maxTokens: 1000, model: 'gpt-4o-mini' },
    });

    const session = new GuardianSession({ sessionId: 'audit-session' });

    await guard.protect(async () => makeOpenAIResponse('A'), 'Prompt A', { session });
    await guard.protect(async () => makeOpenAIResponse('B'), 'Prompt B', { session });

    const audits = session.getAuditEntries();
    expect(audits).toHaveLength(2);
    expect(audits[0]?.sessionId).toBe('audit-session');
    expect(audits[1]?.sessionId).toBe('audit-session');
    expect(audits[0]?.promptHash).toBeDefined();
  });
});
