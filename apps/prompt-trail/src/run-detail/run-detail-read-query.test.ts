/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { loadRunDetailReadModel } from './run-detail-read-query';
const run = { id: 'run-1', projectId: 'project-1', recipeId: null } as any;
describe('loadRunDetailReadModel', () => {
  it('reads a Direct Run and active links without recipe lookup', async () => {
    const repository = {
      getRun: vi.fn(async () => run),
      getProject: vi.fn(async () => ({ id: 'project-1' })),
      getRecipe: vi.fn(),
      listActiveLinks: vi.fn(async () => [{ id: 'link-1' }]),
    } as any;
    const result = await loadRunDetailReadModel(repository, run.id);
    expect(result).toMatchObject({
      run,
      recipe: null,
      links: [{ id: 'link-1' }],
    });
    expect(repository.getRecipe).not.toHaveBeenCalled();
  });
  it('reads Recipe Runs and identifies missing data', async () => {
    const recipeRun = { ...run, recipeId: 'recipe-1' };
    const repository = {
      getRun: vi.fn(async () => recipeRun),
      getProject: vi.fn(async () => ({ id: 'project-1' })),
      getRecipe: vi.fn(async () => ({ id: 'recipe-1' })),
      listActiveLinks: vi.fn(async () => []),
    } as any;
    expect(
      (await loadRunDetailReadModel(repository, recipeRun.id))?.recipe,
    ).toEqual({ id: 'recipe-1' });
    repository.getProject.mockResolvedValueOnce(null);
    await expect(
      loadRunDetailReadModel(repository, recipeRun.id),
    ).rejects.toThrow('inconsistent');
    repository.getRun.mockResolvedValueOnce(null);
    expect(await loadRunDetailReadModel(repository, recipeRun.id)).toBeNull();
  });
});
