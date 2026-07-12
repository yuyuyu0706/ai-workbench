import { describe, expect, it } from 'vitest';

import { getRouterBasename } from './router-basename';

describe('getRouterBasename', () => {
  it('keeps localhost routing rooted at /', () => {
    expect(getRouterBasename('/')).toBeUndefined();
  });

  it('uses the GitHub Pages project path without a trailing slash', () => {
    expect(getRouterBasename('/ai-workbench/')).toBe('/ai-workbench');
  });
});
