/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import type { PromptTrailRepository } from '../repository';
import { RunDetailPage } from './RunDetailPage';
function renderPage(repository: PromptTrailRepository, id = 'run-1') {
  return render(
    <MemoryRouter initialEntries={[`/runs/${id}`]}>
      <PromptTrailRepositoryProvider repository={repository}>
        <Routes>
          <Route path="/runs/:runId" element={<RunDetailPage />} />
        </Routes>
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
}
const direct = {
  id: 'run-1',
  projectId: 'project-1',
  recipeId: null,
  promptSnapshot: { title: 'Prompt A', body: 'Body A' },
  contextSnapshots: [],
  status: 'prepared',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
describe('RunDetailPage', () => {
  it('shows loading, not-found, and failure states', async () => {
    const pending = { getRun: vi.fn(() => new Promise(() => {})) } as any;
    renderPage(pending);
    expect(screen.getByText('Runを読み込んでいます...')).toBeInTheDocument();
    const missing = { getRun: vi.fn(async () => null) } as any;
    renderPage(missing);
    expect(
      await screen.findByText('指定されたRunが見つかりません。'),
    ).toBeInTheDocument();
    const failed = {
      getRun: vi.fn(async () => {
        throw new Error('db');
      }),
    } as any;
    renderPage(failed);
    expect(
      await screen.findByText('Runの読み込みに失敗しました。'),
    ).toBeInTheDocument();
  });
  it('renders Direct Run without Recipe and Recipe Run context', async () => {
    const repo = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => []),
      getRecipe: vi.fn(),
    } as any;
    renderPage(repo);
    expect(await screen.findByText('Direct Prompt')).toBeInTheDocument();
    expect(repo.getRecipe).not.toHaveBeenCalled();
    const recipeRepo = {
      ...repo,
      getRun: vi.fn(async () => ({
        ...direct,
        recipeId: 'recipe-1',
        contextSnapshots: [
          { contextId: 'context-1', title: 'Context A', body: 'context' },
        ],
      })),
      getRecipe: vi.fn(async () => ({ title: 'Recipe A' })),
    };
    renderPage(recipeRepo);
    expect(await screen.findByText('Recipe A')).toBeInTheDocument();
    expect(screen.getByText('Context A')).toBeInTheDocument();
  });
});
