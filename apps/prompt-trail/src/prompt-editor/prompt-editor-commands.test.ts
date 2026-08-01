import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROJECT_ID,
  type Prompt,
  type UtcDateTimeString,
} from '../domain';
import type { PromptTrailRepository } from '../repository';
import { createPrompt } from './create-prompt';
import { deletePrompt } from './delete-prompt';
import { updatePrompt } from './update-prompt';

const before = '2026-01-01T00:00:00.000Z' as UtcDateTimeString;
const after = '2026-08-01T00:00:00.000Z' as UtcDateTimeString;

describe('Prompt editor commands', () => {
  it('soft deletes only an active Prompt with an injectable time', async () => {
    const prompt = {
      id: 'prompt-delete' as Prompt['id'],
      status: 'active',
      deletedAt: null,
    } as Prompt;
    const softDeletePrompt = vi.fn(async () => ({
      ...prompt,
      deletedAt: after,
    }));
    const repository = {
      getPrompt: vi.fn(async () => prompt),
      softDeletePrompt,
    } as unknown as PromptTrailRepository;

    await deletePrompt(repository, prompt.id, { now: () => after });

    expect(repository.getPrompt).toHaveBeenCalledWith(prompt.id);
    expect(softDeletePrompt).toHaveBeenCalledWith(prompt.id, after);
    expect(Object.keys(repository).sort()).toEqual([
      'getPrompt',
      'softDeletePrompt',
    ]);
  });

  it.each([
    [null, 'not-found'],
    [
      { id: 'deleted', status: 'active', deletedAt: after } as Prompt,
      'unavailable',
    ],
    [
      { id: 'draft', status: 'draft', deletedAt: null } as Prompt,
      'unavailable',
    ],
  ] as const)(
    'rejects a missing or unavailable Prompt delete target',
    async (prompt, status) => {
      const repository = {
        getPrompt: vi.fn(async () => prompt),
        softDeletePrompt: vi.fn(),
      } as unknown as PromptTrailRepository;

      await expect(
        deletePrompt(repository, 'target' as Prompt['id']),
      ).rejects.toMatchObject({ status });
      expect(repository.softDeletePrompt).not.toHaveBeenCalled();
    },
  );

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
    const latest = { ...original, tags: ['latest'], body: 'other-tab body' };
    const repository = {
      getPrompt: vi.fn(async () => latest),
      savePrompt,
    } as unknown as PromptTrailRepository;
    await updatePrompt(
      repository,
      original.id,
      { title: 'new', body: 'new body', kind: 'codex-request' },
      { now: () => after },
    );
    expect(savePrompt).toHaveBeenCalledWith({
      ...latest,
      title: 'new',
      body: 'new body',
      kind: 'codex-request',
      updatedAt: after,
    });
  });

  it.each([
    [null, 'not-found'],
    [
      {
        id: 'deleted' as Prompt['id'],
        status: 'active',
        deletedAt: after,
      } as Prompt,
      'unavailable',
    ],
    [
      {
        id: 'deprecated' as Prompt['id'],
        status: 'deprecated',
        deletedAt: null,
      } as Prompt,
      'unavailable',
    ],
  ] as const)(
    'does not save a missing or unavailable latest Prompt',
    async (latest, status) => {
      const savePrompt = vi.fn();
      const repository = {
        getPrompt: vi.fn(async () => latest),
        savePrompt,
      } as unknown as PromptTrailRepository;

      await expect(
        updatePrompt(
          repository,
          'target' as Prompt['id'],
          { title: 'new', body: 'new body', kind: 'other' },
          { now: () => after },
        ),
      ).rejects.toMatchObject({ status });
      expect(savePrompt).not.toHaveBeenCalled();
    },
  );
});
