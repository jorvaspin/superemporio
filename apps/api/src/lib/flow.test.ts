import { describe, expect, it } from 'vitest';
import { flowSignature } from './flow';

describe('Flow signature', () => {
  it('is deterministic regardless of input property order', async () => {
    const first = await flowSignature({ apiKey: 'key', amount: 1990, token: 'abc' }, 'secret');
    const second = await flowSignature({ token: 'abc', amount: 1990, apiKey: 'key' }, 'secret');
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
