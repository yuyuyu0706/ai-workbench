import { describe, expect, it } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';
import { health } from './health.js';

describe('health', () => {
  it('returns 200 with status ok', async () => {
    const response = await health({} as HttpRequest, {} as InvocationContext);

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({ status: 'ok' });
  });
});
