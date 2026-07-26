/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import type { PromptTrailRepository } from '../repository';
import { RunDetailPage } from './RunDetailPage';
function renderPage(
  repository: PromptTrailRepository,
  id = 'run-1',
  state?: { trailCreated: true },
) {
  return render(
    <MemoryRouter
      initialEntries={[
        state ? { pathname: `/runs/${id}`, state } : `/runs/${id}`,
      ]}
    >
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
  it('confirms, cancels, and deletes only after repository success', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const trailLink = {
      id: 'link-1',
      runId: 'run-1',
      title: 'Result document',
      url: 'https://example.com/result',
      type: 'document',
      role: null,
      summary: null,
      externalId: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      deletedAt: null,
    };
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => [trailLink]),
      softDeleteLink: vi.fn(async () => ({
        ...trailLink,
        deletedAt: '2026-01-02',
      })),
    } as any;
    renderPage(repository);

    const remove = await screen.findByRole('button', {
      name: 'Result documentを削除',
    });
    await user.click(remove);
    expect(repository.softDeleteLink).not.toHaveBeenCalled();
    expect(
      screen.getByText('「Result document」を削除しますか？'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(remove).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Result document' })).toBeVisible();

    await user.click(remove);
    await user.keyboard('{Escape}');
    expect(remove).toHaveFocus();
    await user.click(remove);
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(repository.softDeleteLink).toHaveBeenCalledWith(
      'run-1',
      'link-1',
      expect.any(String),
    );
    expect(screen.queryByRole('link', { name: 'Result document' })).toBeNull();
    expect(screen.getByText('関連リンクを削除しました。')).toHaveAttribute(
      'role',
      'status',
    );
  });

  it('keeps a Link and its retry confirmation when deletion fails', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => [
        {
          id: 'link-1',
          runId: 'run-1',
          title: null,
          url: 'https://example.com/legacy',
          type: 'external',
          createdAt: '2026-01-01',
          deletedAt: null,
        },
      ]),
      softDeleteLink: vi.fn(async () => {
        throw new Error('db');
      }),
    } as any;
    renderPage(repository);

    await user.click(
      await screen.findByRole('button', {
        name: 'https://example.com/legacyを削除',
      }),
    );
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(
      await screen.findByText(
        '関連リンクを削除できませんでした。もう一度お試しください。',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'https://example.com/legacy' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '削除する' })).toBeEnabled();
  });
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
    expect(
      screen.getByRole('heading', { level: 2, name: 'Prompt' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Prompt Snapshot')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: '関連リンク' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('この作業で参照したChat・Issue・PR', { exact: false }),
    ).toBeNull();
    expect(
      screen.queryByText('まだ関連リンクがありません。', { exact: false }),
    ).toBeNull();
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

  it('formats summary dates and preserves their original values', async () => {
    const createdAt = '2026-01-02T03:04:00.000Z';
    const repository = {
      getRun: vi.fn(async () => ({
        ...direct,
        createdAt,
        updatedAt: 'invalid-date',
      })),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => []),
    } as any;
    renderPage(repository);

    const createdDate = new Date(createdAt);
    const pad = (value: number) => String(value).padStart(2, '0');
    const expectedCreatedAt = `${createdDate.getFullYear()}-${pad(
      createdDate.getMonth() + 1,
    )}-${pad(createdDate.getDate())} ${pad(createdDate.getHours())}:${pad(
      createdDate.getMinutes(),
    )}:${pad(createdDate.getSeconds())}`;
    const created = await screen.findByText(expectedCreatedAt);
    expect(created).toHaveAttribute('datetime', createdAt);
    expect(screen.getByText('invalid-date')).toHaveAttribute(
      'datetime',
      'invalid-date',
    );
  });

  it('opens and closes the related Link information accessibly', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => []),
    } as any;
    renderPage(repository);

    const button = await screen.findByRole('button', {
      name: '関連リンクについて',
    });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('この作業で参照したChat・Issue・PR', { exact: false }),
    ).toHaveAttribute('id', button.getAttribute('aria-controls'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();

    await user.click(button);
    fireEvent.mouseDown(document.body);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the creation notice only when navigation marks a newly created Trail', async () => {
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => []),
    } as any;

    const directAccess = renderPage(repository);
    await screen.findByText('Direct Prompt');
    expect(
      screen.queryByText('Trailを作成しました。', { exact: false }),
    ).toBeNull();
    directAccess.unmount();

    renderPage(repository, 'run-1', { trailCreated: true });
    expect(
      await screen.findByText('Trailを作成しました。', { exact: false }),
    ).toHaveAttribute('role', 'status');
  });
});

describe('RunDetailPage Link form', () => {
  it('rejects an empty Link title without saving', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => []),
      saveLink: vi.fn(),
    } as any;
    renderPage(repository);
    await screen.findByText('Direct Prompt');
    await user.type(screen.getByLabelText('URL'), 'https://example.com');
    await user.selectOptions(screen.getByLabelText('Link種別'), 'document');
    await user.click(screen.getByRole('button', { name: '関連リンクを登録' }));
    expect(
      await screen.findByText('Link名称を入力してください。'),
    ).toBeInTheDocument();
    expect(repository.saveLink).not.toHaveBeenCalled();
  });

  it('rejects an unselected Link type without saving', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      listActiveLinks: vi.fn(async () => []),
      saveLink: vi.fn(),
    } as any;
    renderPage(repository);
    await screen.findByText('Direct Prompt');
    await user.type(screen.getByLabelText('Link名称'), 'Result document');
    await user.type(screen.getByLabelText('URL'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: '関連リンクを登録' }));
    expect(
      await screen.findByText('Link種別を選択してください。'),
    ).toBeInTheDocument();
    expect(repository.saveLink).not.toHaveBeenCalled();
  });

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
    expect(screen.getByLabelText('Link名称')).toBeInTheDocument();
    expect(screen.queryByLabelText('Link役割')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Link名称'), 'FTP result');
    await user.selectOptions(screen.getByLabelText('Link種別'), 'document');
    const url = screen.getByLabelText('URL');
    await user.type(url, 'ftp://example.com');
    await user.click(screen.getByRole('button', { name: '関連リンクを登録' }));
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
    await user.type(screen.getByLabelText('Link名称'), 'Result document');
    await user.type(screen.getByLabelText('URL'), 'https://example.com/result');
    await user.selectOptions(screen.getByLabelText('Link種別'), 'document');
    await user.click(screen.getByRole('button', { name: '関連リンクを登録' }));
    expect(
      await screen.findByText('https://example.com/result'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('URL')).toHaveValue('');
    expect(screen.getByLabelText('Link名称')).toHaveValue('');
    expect(screen.getByLabelText('Link種別')).toHaveValue('');
    expect(screen.getByText('Result document')).toBeInTheDocument();
    expect(screen.getByText(/Document \//)).toBeInTheDocument();
    expect(screen.getByText('関連リンクを登録しました。')).toHaveAttribute(
      'role',
      'status',
    );
    await user.type(screen.getByLabelText('Link名称'), 'N');
    expect(screen.queryByText('関連リンクを登録しました。')).toBeNull();
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
    await user.type(screen.getByLabelText('Link名称'), 'Failed link');
    await user.selectOptions(screen.getByLabelText('Link種別'), 'document');
    const url = screen.getByLabelText('URL');
    await user.type(url, 'https://example.com');
    await user.click(screen.getByRole('button', { name: '関連リンクを登録' }));
    expect(
      await screen.findByText(/Linkを保存できませんでした/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Link名称')).toHaveValue('Failed link');
    expect(url).toHaveValue('https://example.com');
    expect(screen.getByLabelText('Link種別')).toHaveValue('document');
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
  await user.type(screen.getByLabelText('Link名称'), 'Pending link');
  await user.selectOptions(screen.getByLabelText('Link種別'), 'document');
  await user.type(screen.getByLabelText('URL'), 'https://example.com/pending');
  await user.click(screen.getByRole('button', { name: '関連リンクを登録' }));
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
  await user.type(screen.getByLabelText('Link名称'), 'A pending');
  await user.selectOptions(screen.getByLabelText('Link種別'), 'document');
  await user.type(screen.getByLabelText('URL'), 'https://a.pending');
  await user.click(screen.getByRole('button', { name: '関連リンクを登録' }));
  await user.click(screen.getByRole('button', { name: 'Run Bへ切替' }));
  expect(await screen.findByText('Prompt B')).toBeInTheDocument();
  expect(screen.getByText('Project B')).toBeInTheDocument();
  expect(screen.getByText('https://b.existing')).toBeInTheDocument();
  expect(screen.getByText(/その他/)).toBeInTheDocument();
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
  expect(screen.getByLabelText('Link名称')).toHaveValue('');
  expect(screen.getByLabelText('Link種別')).toHaveValue('');
});
