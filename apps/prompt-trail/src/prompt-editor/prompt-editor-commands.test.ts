import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROJECT_ID,
  type Prompt,
  type UtcDateTimeString,
} from '../domain';
import type { PromptTrailRepository } from '../repository';
import { createPrompt } from './create-prompt';
import { updatePrompt } from './update-prompt';

const before = '2026-01-01T00:00:00.000Z' as UtcDateTimeString;
const after = '2026-08-01T00:00:00.000Z' as UtcDateTimeString;

describe('Prompt editor commands', () => {
  it('creates a Default Project Active Prompt with injectable identity and time', async () => {
    const savePrompt = vi.fn(async (prompt: Prompt) => prompt);
    const repository = {
      getProject: vi.fn(async () => null),
      saveProject: vi.fn(async (project) => project),
      savePrompt,
    } as unknown as PromptTrailRepository;
    await createPrompt(
      repository,
      { title: '  title  ', body: '\n  markdown\n', kind: 'other' },
      { createId: () => 'prompt-new' as Prompt['id'], now: () => after },
    );
    expect(savePrompt).toHaveBeenCalledWith({
      id: 'prompt-new',
      scope: 'project',
      projectId: DEFAULT_PROJECT_ID,
      title: 'title',
      body: '\n  markdown\n',
      kind: 'other',
      status: 'active',
      tags: [],
      createdAt: after,
      updatedAt: after,
      deletedAt: null,
    });
    expect(repository.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: DEFAULT_PROJECT_ID }),
    );
  });

  it('updates only editor fields and updatedAt', async () => {
    const original: Prompt = {
      id: 'global-prompt' as Prompt['id'],
      scope: 'global',
      title: 'old',
      body: 'old body',
      kind: 'other',
      status: 'active',
      tags: ['keep'],
      createdAt: before,
      updatedAt: before,
      deletedAt: null,
    };
    const savePrompt = vi.fn(async (prompt: Prompt) => prompt);
    await updatePrompt(
      { savePrompt } as unknown as PromptTrailRepository,
      original,
      { title: 'new', body: 'new body', kind: 'codex-request' },
      { now: () => after },
    );
    expect(savePrompt).toHaveBeenCalledWith({
      ...original,
      title: 'new',
      body: 'new body',
      kind: 'codex-request',
      updatedAt: after,
    });
  });
});
