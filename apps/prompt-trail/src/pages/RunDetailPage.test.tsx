/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import type { DeveloperToolsRuntime } from '../app/prompt-trail-runtime';
import { DeveloperToolsProvider } from '../developer-tools/DeveloperToolsContext';
import {
  createDeveloperUiStateStore,
  type DeveloperUiStateStore,
} from '../developer-ui-state';
import {
  PromptTrailRepositoryError,
  type PromptTrailRepository,
} from '../repository';
import { RunDetailPage } from './RunDetailPage';
function renderPage(
  repository: PromptTrailRepository,
  id = 'run-1',
  state?: { trailCreated: true },
  uiStateStore?: DeveloperUiStateStore,
) {
  return render(
    <MemoryRouter
      initialEntries={[
        state ? { pathname: `/runs/${id}`, state } : `/runs/${id}`,
      ]}
    >
      <PromptTrailRepositoryProvider repository={repository}>
        <DeveloperToolsProvider
          value={
            uiStateStore ? ({ uiStateStore } as DeveloperToolsRuntime) : null
          }
        >
          <Routes>
            <Route path="/runs/:runId" element={<RunDetailPage />} />
          </Routes>
        </DeveloperToolsProvider>
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
}
const direct = {
  id: 'run-1',
  trailId: 'trail-1',
  deletedAt: null,
  archivedAt: null,
  projectId: 'project-1',
  recipeId: null,
  promptSnapshot: { title: 'Prompt A', body: 'Body A' },
  contextSnapshots: [],
  status: 'prepared',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
const trail = {
  id: 'trail-1',
  projectId: 'project-1',
  title: 'Trail A',
  kind: 'development',
  deletedAt: null,
  archivedAt: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

function createTrailLink(id: string, title: string) {
  return {
    id,
    runId: 'run-1',
    title,
    url: `https://example.com/${id}`,
    type: 'document',
    role: null,
    summary: null,
    externalId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    deletedAt: null,
  };
}

function createDetailRepository(
  links: readonly ReturnType<typeof createTrailLink>[],
) {
  return {
    getRun: vi.fn(async () => direct),
    getTrail: vi.fn(async () => trail),
    getProject: vi.fn(async () => ({ name: 'Project' })),
    listActiveLinks: vi.fn(async () => links),
    saveLink: vi.fn(async (link) => link),
    softDeleteLink: vi.fn(async (_runId, linkId) => ({
      ...links.find((link) => link.id === linkId),
      deletedAt: '2026-01-02',
    })),
  } as any;
}

function createTestUiStateStore() {
  const values = new Map<string, string>();
  return createDeveloperUiStateStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}

describe('RunDetailPage', () => {
  it('shows Trail metadata and saves an edited title and kind', async () => {
    const repository = createDetailRepository([]);
    repository.updateTrailMetadata = vi.fn(async (update: any) => ({
      ...trail,
      title: update.title,
      kind: update.kind,
      updatedAt: update.updatedAt,
    }));
    renderPage(repository);

    expect(await screen.findByText('Trail A')).toBeVisible();
    expect(screen.getByText('開発')).toBeVisible();
    expect(screen.getByText('準備済み')).toHaveClass(
      'pt-status-pin',
      'pt-status-pin--prepared',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Trail情報を編集' }));
    const title = screen.getByRole('textbox', { name: 'Trail名' });
    expect(title).toHaveFocus();
    fireEvent.change(title, { target: { value: '  Updated Trail  ' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Trail種別' }), {
      target: { value: 'research' },
    });
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }));

    expect(await screen.findByText('Updated Trail')).toBeVisible();
    expect(screen.getByText('調査')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Trail情報を編集' }),
      ).toHaveFocus(),
    );
    expect(repository.updateTrailMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        trailId: trail.id,
        expectedUpdatedAt: trail.updatedAt,
        title: 'Updated Trail',
        kind: 'research',
      }),
    );
  });

  it('keeps the draft and offers an explicit reload after a stale write', async () => {
    const repository = createDetailRepository([]);
    repository.updateTrailMetadata = vi.fn(async () => {
      const { PromptTrailRepositoryError } = await import('../repository');
      throw new PromptTrailRepositoryError('stale-write');
    });
    renderPage(repository);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Trail情報を編集' }),
    );
    const title = screen.getByRole('textbox', { name: 'Trail名' });
    fireEvent.change(title, { target: { value: 'My local draft' } });
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '別の画面でTrail情報が更新されました',
    );
    expect(title).toHaveValue('My local draft');
    expect(
      screen.getByRole('button', { name: '最新内容を読み込む' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '最新内容を読み込む' }),
      ).toHaveFocus(),
    );
    expect(title).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Trail種別' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '変更を保存' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled();

    fireEvent.change(title, { target: { value: 'Discarded change' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    fireEvent.keyDown(title, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(title).toHaveValue('My local draft');
    expect(repository.updateTrailMetadata).toHaveBeenCalledOnce();
  });

  it('keeps Developer Tools metadata overrides isolated from real editor state', async () => {
    const repository = createDetailRepository([]);
    repository.updateTrailMetadata = vi.fn();
    const store = createTestUiStateStore();
    renderPage(repository, 'run-1', undefined, store);
    await screen.findByText('Trail A');

    for (const override of [
      'editing',
      'submitting',
      'save-failure',
      'stale',
    ] as const) {
      act(() =>
        store.setActiveOverride({
          target: 'run-detail-trail-metadata',
          state: override,
        }),
      );
      expect(screen.getByRole('textbox', { name: 'Trail名' })).toHaveValue(
        'Trail A',
      );
      expect(screen.getByRole('textbox', { name: 'Trail名' })).toBeDisabled();
      fireEvent.change(screen.getByRole('textbox', { name: 'Trail名' }), {
        target: { value: 'Override mutation' },
      });
      expect(repository.updateTrailMetadata).not.toHaveBeenCalled();
    }
    act(() => store.clearActiveOverride());
    expect(screen.getByText('Trail A')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Trail情報を編集' }),
    ).toBeVisible();
  });

  it('associates validation errors, focuses invalid input, and disables no-op save', async () => {
    const repository = createDetailRepository([]);
    repository.updateTrailMetadata = vi.fn();
    renderPage(repository);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Trail情報を編集' }),
    );
    const title = screen.getByRole('textbox', { name: 'Trail名' });
    expect(screen.getByRole('button', { name: '変更を保存' })).toBeDisabled();
    fireEvent.change(title, { target: { value: '   ' } });
    fireEvent.submit(title.closest('form')!);
    expect(await screen.findByRole('alert')).toHaveAttribute(
      'id',
      title.getAttribute('aria-describedby'),
    );
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveFocus();
    expect(repository.updateTrailMetadata).not.toHaveBeenCalled();
  });

  it('retains metadata after a failure and retries successfully', async () => {
    const repository = createDetailRepository([]);
    repository.updateTrailMetadata = vi
      .fn()
      .mockRejectedValueOnce(new Error('storage'))
      .mockImplementation(async (update: any) => ({
        ...trail,
        title: update.title,
        kind: update.kind,
        updatedAt: update.updatedAt,
      }));
    renderPage(repository);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Trail情報を編集' }),
    );
    const title = screen.getByRole('textbox', { name: 'Trail名' });
    fireEvent.change(title, { target: { value: 'Retry Trail' } });
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trail情報を保存できませんでした',
    );
    expect(title).toHaveValue('Retry Trail');
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }));
    expect(await screen.findByText('Trail情報を保存しました。')).toBeVisible();
    expect(repository.updateTrailMetadata).toHaveBeenCalledTimes(2);
  });

  it('blocks duplicate metadata submissions and ignores completion after unmount', async () => {
    let resolveSave!: (value: typeof trail) => void;
    const repository = createDetailRepository([]);
    repository.updateTrailMetadata = vi.fn(
      () => new Promise<typeof trail>((resolve) => (resolveSave = resolve)),
    );
    const rendered = renderPage(repository);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Trail情報を編集' }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Trail名' }), {
      target: { value: 'Pending Trail' },
    });
    const form = screen
      .getByRole('textbox', { name: 'Trail名' })
      .closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(repository.updateTrailMetadata).toHaveBeenCalledOnce();
    rendered.unmount();
    await act(async () => resolveSave({ ...trail, title: 'Pending Trail' }));
  });

  it('ignores an old stale reload after switching to another Run', async () => {
    const trailA = {
      ...trail,
      id: 'trail-a',
      projectId: 'project-a',
      title: 'Run A Trail',
    };
    const trailB = {
      ...trail,
      id: 'trail-b',
      projectId: 'project-b',
      title: 'Run B Trail',
    };
    const runA = {
      ...direct,
      id: 'run-a',
      projectId: 'project-a',
      trailId: 'trail-a',
      promptSnapshot: { title: 'Prompt A', body: 'Body A' },
    };
    const runB = {
      ...direct,
      id: 'run-b',
      projectId: 'project-b',
      trailId: 'trail-b',
      promptSnapshot: { title: 'Prompt B', body: 'Body B' },
    };
    let runAReads = 0;
    let resolveReload!: (run: typeof runA) => void;
    const repository = {
      getRun: vi.fn((id: string) => {
        if (id === 'run-b') return Promise.resolve(runB);
        runAReads += 1;
        return runAReads === 1
          ? Promise.resolve(runA)
          : new Promise<typeof runA>((resolve) => (resolveReload = resolve));
      }),
      getTrail: vi.fn(async (id: string) =>
        id === 'trail-b' ? trailB : trailA,
      ),
      getProject: vi.fn(async (id: string) => ({
        name: id === 'project-a' ? 'Project A' : 'Project B',
      })),
      listActiveLinks: vi.fn(async () => []),
      updateTrailMetadata: vi.fn(async () => {
        throw new PromptTrailRepositoryError('stale-write');
      }),
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
    fireEvent.click(
      await screen.findByRole('button', { name: 'Trail情報を編集' }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Trail名' }), {
      target: { value: 'Run A draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '最新内容を読み込む' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run Bへ切替' }));
    expect(await screen.findByText('Body B')).toBeVisible();

    await act(async () => resolveReload(runA));
    await new Promise((resolve) => setTimeout(resolve));
    expect(screen.getByText('Body B')).toBeVisible();
    expect(screen.getByText(/Project B のTrail: Run B Trail/)).toBeVisible();
    expect(screen.queryByText('Body A')).not.toBeInTheDocument();
  });

  it('links the Prompt snapshot to the encoded New Trail reuse URL', async () => {
    renderPage(createDetailRepository([]));

    expect(
      await screen.findByRole('link', { name: 'このPromptを再利用' }),
    ).toHaveAttribute('href', '/runs/new?sourceRunId=run-1');
  });

  it('applies every page override and restores already-loaded data when cleared', async () => {
    const repository = createDetailRepository([]);
    const store = createTestUiStateStore();
    store.setActiveOverride({ target: 'run-detail-page', state: 'loading' });
    renderPage(repository, 'run-1', undefined, store);

    expect(screen.getByText('Runを読み込んでいます...')).toBeVisible();
    await waitFor(() => expect(repository.getRun).toHaveBeenCalledOnce());
    act(() =>
      store.setActiveOverride({
        target: 'run-detail-page',
        state: 'not-found',
      }),
    );
    expect(screen.getByText('指定されたRunが見つかりません。')).toBeVisible();
    act(() =>
      store.setActiveOverride({ target: 'run-detail-page', state: 'failure' }),
    );
    expect(screen.getByText('Runの読み込みに失敗しました。')).toBeVisible();

    act(() => store.clearActiveOverride());
    expect(await screen.findByText('Body A')).toBeVisible();
    expect(repository.getRun).toHaveBeenCalledOnce();
  });

  it('does not apply a Link Form override while the real page is not data', () => {
    const store = createTestUiStateStore();
    store.setActiveOverride({
      target: 'run-detail-link-form',
      state: 'submitting',
    });
    const repository = {
      getRun: vi.fn(() => new Promise(() => undefined)),
    } as unknown as PromptTrailRepository;
    renderPage(repository, 'run-1', undefined, store);

    expect(screen.getByText('Runを読み込んでいます...')).toBeVisible();
    expect(screen.queryByRole('button', { name: '保存中...' })).toBeNull();
  });

  it('applies Link Form overrides, blocks saving, and hides then restores a real success notice', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = createDetailRepository([]);
    const store = createTestUiStateStore();
    renderPage(repository, 'run-1', undefined, store);
    await screen.findByText('Body A');
    await user.type(screen.getByLabelText('Link名称'), 'Saved link');
    await user.type(screen.getByLabelText('URL'), 'https://example.com/saved');
    await user.selectOptions(screen.getByLabelText('Link種別'), 'document');
    await user.click(screen.getByRole('button', { name: '関連リンクを登録' }));
    expect(await screen.findByText('関連リンクを登録しました。')).toBeVisible();

    act(() =>
      store.setActiveOverride({
        target: 'run-detail-link-form',
        state: 'submitting',
      }),
    );
    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled();
    expect(screen.queryByText('関連リンクを登録しました。')).toBeNull();
    act(() =>
      store.setActiveOverride({
        target: 'run-detail-link-form',
        state: 'save-failure',
      }),
    );
    expect(screen.getByText(/Linkを保存できませんでした/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: '関連リンクを登録' }));
    expect(repository.saveLink).toHaveBeenCalledOnce();

    act(() => store.clearActiveOverride());
    expect(screen.getByText('関連リンクを登録しました。')).toBeVisible();
  });

  it('targets the selected Link then the first Link for delete overrides without deleting', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const links = [
      createTrailLink('link-1', 'First'),
      createTrailLink('link-2', 'Second'),
    ];
    const repository = createDetailRepository(links);
    const store = createTestUiStateStore();
    renderPage(repository, 'run-1', undefined, store);
    await user.click(
      await screen.findByRole('button', { name: 'Secondを削除' }),
    );

    act(() =>
      store.setActiveOverride({
        target: 'run-detail-link-delete',
        state: 'delete-failure',
      }),
    );
    expect(screen.getByText('「Second」を削除しますか？')).toBeVisible();
    expect(screen.getByText(/関連リンクを削除できませんでした/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(repository.softDeleteLink).not.toHaveBeenCalled();

    act(() => store.clearActiveOverride());
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    act(() =>
      store.setActiveOverride({
        target: 'run-detail-link-delete',
        state: 'confirming',
      }),
    );
    expect(screen.getByText('「First」を削除しますか？')).toBeVisible();
    act(() =>
      store.setActiveOverride({
        target: 'run-detail-link-delete',
        state: 'deleting',
      }),
    );
    expect(screen.getByRole('button', { name: '削除中...' })).toBeDisabled();
    expect(repository.softDeleteLink).not.toHaveBeenCalled();
  });

  it('does not fabricate a delete target when no Links exist', async () => {
    const store = createTestUiStateStore();
    store.setActiveOverride({
      target: 'run-detail-link-delete',
      state: 'delete-failure',
    });
    renderPage(createDetailRepository([]), 'run-1', undefined, store);
    await screen.findByText('Body A');

    expect(screen.queryByText(/を削除しますか/)).toBeNull();
    expect(screen.queryByText(/関連リンクを削除できませんでした/)).toBeNull();
  });

  it('hides a real delete success notice only while a delete override is active', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = createDetailRepository([
      createTrailLink('link-1', 'First'),
      createTrailLink('link-2', 'Second'),
    ]);
    const store = createTestUiStateStore();
    renderPage(repository, 'run-1', undefined, store);
    await user.click(
      await screen.findByRole('button', { name: 'Secondを削除' }),
    );
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(await screen.findByText('関連リンクを削除しました。')).toBeVisible();

    act(() =>
      store.setActiveOverride({
        target: 'run-detail-link-delete',
        state: 'confirming',
      }),
    );
    expect(screen.queryByText('関連リンクを削除しました。')).toBeNull();
    act(() => store.clearActiveOverride());
    expect(screen.getByText('関連リンクを削除しました。')).toBeVisible();
  });

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
      getTrail: vi.fn(async () => trail),
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
    await waitFor(() => expect(remove).toHaveFocus());
    expect(screen.getByRole('link', { name: 'Result document' })).toBeVisible();

    await user.click(remove);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(remove).toHaveFocus());
    await user.click(remove);
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(repository.softDeleteLink).toHaveBeenCalledWith(
      'run-1',
      'link-1',
      expect.any(String),
    );
    expect(
      await screen.findByText('関連リンクを削除しました。'),
    ).toHaveAttribute('role', 'status');
    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: 'Result document' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('keeps a Link and its retry confirmation when deletion fails', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
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

  it('prevents another Link deletion while a deletion is pending', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    let completeDeletion!: () => void;
    const deletionPending = new Promise<void>((resolve) => {
      completeDeletion = resolve;
    });
    const linkA = {
      id: 'link-a',
      runId: 'run-1',
      title: 'Link A',
      url: 'https://example.com/a',
      type: 'document',
      createdAt: '2026-01-01',
      deletedAt: null,
    };
    const linkB = {
      ...linkA,
      id: 'link-b',
      title: 'Link B',
      url: 'https://example.com/b',
    };
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
      listActiveLinks: vi.fn(async () => [linkA, linkB]),
      softDeleteLink: vi.fn(async () => {
        await deletionPending;
        return { ...linkA, deletedAt: '2026-01-02' };
      }),
    } as any;
    renderPage(repository);

    const deleteA = await screen.findByRole('button', {
      name: 'Link Aを削除',
    });
    const deleteB = screen.getByRole('button', { name: 'Link Bを削除' });
    await user.click(deleteA);
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(deleteA).toBeDisabled();
    expect(deleteB).toBeDisabled();
    await user.click(deleteB);
    expect(screen.queryByText('「Link B」を削除しますか？')).toBeNull();
    expect(repository.softDeleteLink).toHaveBeenCalledTimes(1);

    completeDeletion();
    expect(
      await screen.findByText('関連リンクを削除しました。'),
    ).toHaveAttribute('role', 'status');
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Link A' })).toBeNull(),
    );
    expect(screen.getByRole('link', { name: 'Link B' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Link Bを削除' })).toBeEnabled();
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
      getTrail: vi.fn(async () => trail),
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
      getTrail: vi.fn(async () => trail),
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
      getTrail: vi.fn(async () => trail),
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
      getTrail: vi.fn(async () => trail),
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
      getTrail: vi.fn(async () => trail),
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
      getTrail: vi.fn(async () => trail),
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
      getTrail: vi.fn(async () => trail),
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
      getTrail: vi.fn(async () => trail),
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
      getTrail: vi.fn(async () => trail),
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
      getTrail: vi.fn(async () => trail),
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
    getTrail: vi.fn(async () => trail),
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
