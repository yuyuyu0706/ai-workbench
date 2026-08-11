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
      { title: '  title  ', body: '\n  markdown\n' },
      { createId: () => 'prompt-new' as Prompt['id'], now: () => after },
    );
    expect(savePrompt).toHaveBeenCalledWith({
      id: 'prompt-new',
      scope: 'project',
      projectId: DEFAULT_PROJECT_ID,
      title: 'title',
      body: '\n  markdown\n',
      status: 'active',
      tags: [],
      variableValues: {},
      createdAt: after,
      updatedAt: after,
      deletedAt: null,
    });
    expect(repository.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: DEFAULT_PROJECT_ID }),
    );
  });

  it('persists the given variableValues when creating a Prompt', async () => {
    const savePrompt = vi.fn(async (prompt: Prompt) => prompt);
    const repository = {
      getProject: vi.fn(async () => ({ id: DEFAULT_PROJECT_ID })),
      savePrompt,
    } as unknown as PromptTrailRepository;
    await createPrompt(
      repository,
      { title: 'title', body: 'Hello ${name}' },
      { createId: () => 'prompt-new' as Prompt['id'], now: () => after },
      { name: 'Alice' },
    );
    expect(savePrompt).toHaveBeenCalledWith(
      expect.objectContaining({ variableValues: { name: 'Alice' } }),
    );
  });

  it('updates only editor fields and updatedAt', async () => {
    const original: Prompt = {
      id: 'global-prompt' as Prompt['id'],
      scope: 'global',
      title: 'old',
      body: 'old body',
      status: 'active',
      tags: ['keep'],
      variableValues: {},
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
      { title: 'new', body: 'new body' },
      { now: () => after },
    );
    expect(savePrompt).toHaveBeenCalledWith({
      ...latest,
      title: 'new',
      body: 'new body',
      variableValues: {},
      updatedAt: after,
    });
  });

  it('persists the given variableValues when updating a Prompt', async () => {
    const latest: Prompt = {
      id: 'global-prompt' as Prompt['id'],
      scope: 'global',
      title: 'old',
      body: 'Hello ${name}',
      status: 'active',
      tags: [],
      variableValues: { name: 'old value' },
      createdAt: before,
      updatedAt: before,
      deletedAt: null,
    };
    const savePrompt = vi.fn(async (prompt: Prompt) => prompt);
    const repository = {
      getPrompt: vi.fn(async () => latest),
      savePrompt,
    } as unknown as PromptTrailRepository;
    await updatePrompt(
      repository,
      latest.id,
      { title: 'new', body: 'Hello ${name}' },
      { now: () => after },
      { name: 'Alice' },
    );
    expect(savePrompt).toHaveBeenCalledWith(
      expect.objectContaining({ variableValues: { name: 'Alice' } }),
    );
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
          { title: 'new', body: 'new body' },
          { now: () => after },
        ),
      ).rejects.toMatchObject({ status });
      expect(savePrompt).not.toHaveBeenCalled();
    },
  );
});

import { PromptTrailRepositoryError } from '../repository';
import {
  nextPromptBodyUpdatedAt,
  updatePromptBody,
} from './update-prompt-body';

describe('updatePromptBody', () => {
  it('validates body, preserves whitespace, and delegates atomic body-only update', async () => {
    const updated = {
      id: 'prompt-body' as Prompt['id'],
      body: '  new body\n',
    } as Prompt;
    const repository = {
      updatePromptBody: vi.fn(async () => updated),
    } as unknown as PromptTrailRepository;

    await expect(
      updatePromptBody(
        repository,
        {
          promptId: updated.id,
          expectedUpdatedAt: before,
          body: '  new body\n',
        },
        () => before,
      ),
    ).resolves.toEqual({ status: 'success', prompt: updated });

    expect(repository.updatePromptBody).toHaveBeenCalledWith({
      promptId: updated.id,
      expectedUpdatedAt: before,
      body: '  new body\n',
      variableValues: {},
      updatedAt: '2026-01-01T00:00:00.001Z',
    });
  });

  it('passes variableValues through to the repository', async () => {
    const updated = {
      id: 'prompt-body' as Prompt['id'],
      body: 'body ${name}',
      variableValues: { name: 'Alice' },
    } as unknown as Prompt;
    const repository = {
      updatePromptBody: vi.fn(async () => updated),
    } as unknown as PromptTrailRepository;

    await updatePromptBody(
      repository,
      {
        promptId: updated.id,
        expectedUpdatedAt: before,
        body: 'body ${name}',
        variableValues: { name: 'Alice' },
      },
      () => before,
    );

    expect(repository.updatePromptBody).toHaveBeenCalledWith(
      expect.objectContaining({ variableValues: { name: 'Alice' } }),
    );
  });

  it('maps expected repository errors and rethrows unexpected errors', async () => {
    for (const [code, status] of [
      ['reference-not-found', 'not-found'],
      ['reference-unavailable', 'unavailable'],
      ['stale-write', 'stale'],
    ] as const) {
      const repository = {
        updatePromptBody: vi.fn(async () => {
          throw new PromptTrailRepositoryError(code);
        }),
      } as unknown as PromptTrailRepository;
      await expect(
        updatePromptBody(repository, {
          promptId: 'prompt-body' as Prompt['id'],
          expectedUpdatedAt: before,
          body: 'body',
        }),
      ).resolves.toEqual({ status });
    }

    await expect(
      updatePromptBody(
        {
          updatePromptBody: vi.fn(async () => {
            throw new Error('boom');
          }),
        } as unknown as PromptTrailRepository,
        {
          promptId: 'prompt-body' as Prompt['id'],
          expectedUpdatedAt: before,
          body: 'body',
        },
      ),
    ).rejects.toThrow('boom');
  });

  it('rejects blank bodies before repository access', async () => {
    const repository = {
      updatePromptBody: vi.fn(),
    } as unknown as PromptTrailRepository;
    await expect(
      updatePromptBody(repository, {
        promptId: 'prompt-body' as Prompt['id'],
        expectedUpdatedAt: before,
        body: ' \n ',
      }),
    ).resolves.toEqual({ status: 'invalid' });
    expect(repository.updatePromptBody).not.toHaveBeenCalled();
  });

  it('keeps updatedAt monotonic', () => {
    expect(nextPromptBodyUpdatedAt(before, after)).toBe(after);
    expect(nextPromptBodyUpdatedAt(after, before)).toBe(
      '2026-08-01T00:00:00.001Z',
    );
  });
});
