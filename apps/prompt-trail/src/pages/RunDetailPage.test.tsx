/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
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

describe('RunDetailPage Link form', () => {
  it('rejects invalid and non-HTTP URLs without saving', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => []),
      saveLink: vi.fn(),
    } as any;
    renderPage(repository);
    await screen.findByText('Direct Prompt');
    const url = screen.getByLabelText('URL');
    await user.type(url, 'ftp://example.com');
    await user.click(screen.getByRole('button', { name: 'Linkを登録' }));
    expect(await screen.findByText(/http または https/)).toBeInTheDocument();
    expect(repository.saveLink).not.toHaveBeenCalled();
  });
  it('adds saved Links and resets the form', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => []),
      saveLink: vi.fn(async (link: any) => link),
    } as any;
    renderPage(repository);
    await screen.findByText('Direct Prompt');
    await user.type(screen.getByLabelText('URL'), 'https://example.com/result');
    await user.selectOptions(screen.getByLabelText('Link種別'), 'document');
    await user.selectOptions(screen.getByLabelText('Link役割'), 'output');
    await user.click(screen.getByRole('button', { name: 'Linkを登録' }));
    expect(
      await screen.findByText('https://example.com/result'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('URL')).toHaveValue('');
    expect(screen.getByLabelText('Link種別')).toHaveValue('external');
    expect(screen.getByLabelText('Link役割')).toHaveValue('result');
    expect(screen.getByText(/document \/ output/)).toBeInTheDocument();
  });
  it('retains input and shows an inline error when saving fails', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => []),
      saveLink: vi.fn(async () => {
        throw new Error('db');
      }),
    } as any;
    renderPage(repository);
    await screen.findByText('Direct Prompt');
    const url = screen.getByLabelText('URL');
    await user.type(url, 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Linkを登録' }));
    expect(
      await screen.findByText(/Linkを保存できませんでした/),
    ).toBeInTheDocument();
    expect(url).toHaveValue('https://example.com');
    expect(screen.getByText('Prompt A')).toBeInTheDocument();
  });
});

it('prevents duplicate Link submissions while saving and then lists the result', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  let resolve!: (link: any) => void;
  const repository = {
    getRun: vi.fn(async () => direct),
    getProject: vi.fn(async () => ({ name: 'Project' })),
    listActiveLinks: vi.fn(async () => []),
    saveLink: vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    ),
  } as any;
  renderPage(repository);
  await screen.findByText('Direct Prompt');
  await user.type(screen.getByLabelText('URL'), 'https://example.com/pending');
  await user.click(screen.getByRole('button', { name: 'Linkを登録' }));
  const button = screen.getByRole('button', { name: '保存中...' });
  expect(button).toBeDisabled();
  await user.click(button);
  expect(repository.saveLink).toHaveBeenCalledOnce();
  resolve({ ...repository.saveLink.mock.calls[0][0], id: 'link-pending' });
  expect(
    await screen.findByText('https://example.com/pending'),
  ).toBeInTheDocument();
});

function RouteSwitchProbe() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/runs/run-b')}>Run Bへ切替</button>;
}
it('keeps Run B state when a pending Run A Link save resolves after a route change', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  let resolve!: (link: any) => void;
  const runA = {
    ...direct,
    id: 'run-a',
    projectId: 'project-a',
    promptSnapshot: { title: 'Prompt A', body: 'Body A' },
  };
  const runB = {
    ...direct,
    id: 'run-b',
    projectId: 'project-b',
    promptSnapshot: { title: 'Prompt B', body: 'Body B' },
  };
  const repository = {
    getRun: vi.fn(async (id) => (id === 'run-a' ? runA : runB)),
    getProject: vi.fn(async (id) => ({
      name: id === 'project-a' ? 'Project A' : 'Project B',
    })),
    listActiveLinks: vi.fn(async (id) => [
      {
        id: id === 'run-a' ? 'link-a' : 'link-b',
        url: id === 'run-a' ? 'https://a.existing' : 'https://b.existing',
        type: 'external',
        role: 'result',
        createdAt: '2026-01-01',
      },
    ]),
    saveLink: vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    ),
  } as any;
  render(
    <MemoryRouter initialEntries={['/runs/run-a']}>
      <PromptTrailRepositoryProvider repository={repository}>
        <RouteSwitchProbe />
        <Routes>
          <Route path="/runs/:runId" element={<RunDetailPage />} />
        </Routes>
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
  await screen.findByText('Prompt A');
  await user.type(screen.getByLabelText('URL'), 'https://a.pending');
  await user.click(screen.getByRole('button', { name: 'Linkを登録' }));
  await user.click(screen.getByRole('button', { name: 'Run Bへ切替' }));
  expect(await screen.findByText('Prompt B')).toBeInTheDocument();
  expect(screen.getByText('Project B')).toBeInTheDocument();
  expect(screen.getByText('https://b.existing')).toBeInTheDocument();
  expect(screen.getByLabelText('URL')).toHaveValue('');
  resolve({
    id: 'link-a-new',
    runId: 'run-a',
    url: 'https://a.pending',
    type: 'external',
    role: 'result',
    createdAt: '2026-01-01',
  });
  await new Promise((resolve) => setTimeout(resolve));
  expect(screen.getByText('Prompt B')).toBeInTheDocument();
  expect(screen.getByText('Project B')).toBeInTheDocument();
  expect(screen.queryByText('https://a.pending')).toBeNull();
  expect(screen.getByText('https://b.existing')).toBeInTheDocument();
  expect(screen.getByLabelText('URL')).toHaveValue('');
  expect(screen.getByLabelText('Link種別')).toHaveValue('external');
  expect(screen.getByLabelText('Link役割')).toHaveValue('result');
});
