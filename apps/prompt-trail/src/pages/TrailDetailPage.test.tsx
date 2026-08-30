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
import { TrailDetailPage } from './TrailDetailPage';
function renderPage(
  repository: PromptTrailRepository,
  id = 'trail-1',
  state?: { trailCreated: true },
  uiStateStore?: DeveloperUiStateStore,
) {
  return render(
    <MemoryRouter
      initialEntries={[
        state ? { pathname: `/trails/${id}`, state } : `/trails/${id}`,
      ]}
    >
      <PromptTrailRepositoryProvider repository={repository}>
        <DeveloperToolsProvider
          value={
            uiStateStore ? ({ uiStateStore } as DeveloperToolsRuntime) : null
          }
        >
          <Routes>
            <Route path="/trails/:trailId" element={<TrailDetailPage />} />
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
  output: null,
  messages: [],
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
    listRunsByTrail: vi.fn(async () => [direct]),
    getProject: vi.fn(async () => ({ name: 'Project' })),
    listActiveLinks: vi.fn(async () => links),
    saveLink: vi.fn(async (link) => link),
    softDeleteLink: vi.fn(async (_runId, linkId) => ({
      ...links.find((link) => link.id === linkId),
      deletedAt: '2026-01-02',
    })),
  } as any;
}

async function openLinksPopover() {
  fireEvent.click(
    await screen.findByRole('button', { name: '関連リンクを表示' }),
  );
}

async function openPromptPopover() {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Prompt Snapshotを表示' }),
  );
}

function createTestUiStateStore() {
  const values = new Map<string, string>();
  return createDeveloperUiStateStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}

describe('TrailDetailPage', () => {
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
    renderPage(repository, 'trail-1', undefined, store);
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
    let trailAReads = 0;
    let resolveReload!: (runs: (typeof runA)[]) => void;
    const repository = {
      getTrail: vi.fn(async (id: string) =>
        id === 'trail-b' ? trailB : trailA,
      ),
      listRunsByTrail: vi.fn((trailId: string) => {
        if (trailId === 'trail-b') return Promise.resolve([runB]);
        trailAReads += 1;
        return trailAReads === 1
          ? Promise.resolve([runA])
          : new Promise<(typeof runA)[]>(
              (resolve) => (resolveReload = resolve),
            );
      }),
      getProject: vi.fn(async (id: string) => ({
        name: id === 'project-a' ? 'Project A' : 'Project B',
      })),
      listActiveLinks: vi.fn(async () => []),
      updateTrailMetadata: vi.fn(async () => {
        throw new PromptTrailRepositoryError('stale-write');
      }),
    } as any;
    render(
      <MemoryRouter initialEntries={['/trails/trail-a']}>
        <PromptTrailRepositoryProvider repository={repository}>
          <RouteSwitchProbe to="/trails/trail-b" />
          <Routes>
            <Route path="/trails/:trailId" element={<TrailDetailPage />} />
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
    await openPromptPopover();
    expect(await screen.findByText('Body B')).toBeVisible();

    await act(async () => resolveReload([runA]));
    await new Promise((resolve) => setTimeout(resolve));
    expect(screen.getByText('Body B')).toBeVisible();
    expect(screen.getByText(/Project B のTrail: Run B Trail/)).toBeVisible();
    expect(screen.queryByText('Body A')).not.toBeInTheDocument();
  });

  it('links the Prompt snapshot to the encoded New Trail reuse URL', async () => {
    renderPage(createDetailRepository([]));
    await openPromptPopover();

    expect(
      await screen.findByRole('link', { name: 'このPromptを再利用' }),
    ).toHaveAttribute('href', '/trails/new?sourceRunId=run-1');
  });

  it('applies every page override and restores already-loaded data when cleared', async () => {
    const repository = createDetailRepository([]);
    const store = createTestUiStateStore();
    store.setActiveOverride({ target: 'run-detail-page', state: 'loading' });
    renderPage(repository, 'trail-1', undefined, store);

    expect(screen.getByText('Runを読み込んでいます...')).toBeVisible();
    await waitFor(() => expect(repository.getTrail).toHaveBeenCalledOnce());
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
    await openPromptPopover();
    expect(await screen.findByText('Body A')).toBeVisible();
    expect(repository.getTrail).toHaveBeenCalledOnce();
  });

  it('does not apply a Link Form override while the real page is not data', () => {
    const store = createTestUiStateStore();
    store.setActiveOverride({
      target: 'run-detail-link-form',
      state: 'submitting',
    });
    const repository = {
      getTrail: vi.fn(() => new Promise(() => undefined)),
    } as unknown as PromptTrailRepository;
    renderPage(repository, 'trail-1', undefined, store);

    expect(screen.getByText('Runを読み込んでいます...')).toBeVisible();
    expect(screen.queryByRole('button', { name: '保存中...' })).toBeNull();
  });

  it('applies Link Form overrides, blocks saving, and hides then restores a real success notice', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = createDetailRepository([]);
    const store = createTestUiStateStore();
    renderPage(repository, 'trail-1', undefined, store);
    await screen.findByText('Prompt A');
    await openLinksPopover();
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
    renderPage(repository, 'trail-1', undefined, store);
    await openLinksPopover();
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
    renderPage(createDetailRepository([]), 'trail-1', undefined, store);
    await openLinksPopover();

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
    renderPage(repository, 'trail-1', undefined, store);
    await openLinksPopover();
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
    let activeLinks = [trailLink];
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => activeLinks),
      softDeleteLink: vi.fn(async (_runId, linkId) => {
        activeLinks = activeLinks.filter((link) => link.id !== linkId);
        return { ...trailLink, deletedAt: '2026-01-02' };
      }),
    } as any;
    renderPage(repository);
    await openLinksPopover();

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
      listRunsByTrail: vi.fn(async () => [direct]),
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
    await openLinksPopover();

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
    let activeLinks = [linkA, linkB];
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => activeLinks),
      softDeleteLink: vi.fn(async (_runId, linkId) => {
        await deletionPending;
        activeLinks = activeLinks.filter((link) => link.id !== linkId);
        return { ...linkA, deletedAt: '2026-01-02' };
      }),
    } as any;
    renderPage(repository);
    await openLinksPopover();

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
    const pending = { getTrail: vi.fn(() => new Promise(() => {})) } as any;
    renderPage(pending);
    expect(screen.getByText('Runを読み込んでいます...')).toBeInTheDocument();
    const missing = { getTrail: vi.fn(async () => null) } as any;
    renderPage(missing);
    expect(
      await screen.findByText('指定されたRunが見つかりません。'),
    ).toBeInTheDocument();
    const failed = {
      getTrail: vi.fn(async () => {
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
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => []),
      getRecipe: vi.fn(),
    } as any;
    renderPage(repo);
    expect(await screen.findByText('Prompt A')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Prompt Snapshotを表示' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Prompt Snapshot')).toBeNull();
    expect(
      screen.getByRole('button', { name: '関連リンクを表示' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('この作業で参照したChat・Issue・PR', { exact: false }),
    ).toBeNull();
    expect(
      screen.queryByText('まだ関連リンクがありません。', { exact: false }),
    ).toBeNull();
    expect(repo.getRecipe).not.toHaveBeenCalled();
    const recipeRun = {
      ...direct,
      recipeId: 'recipe-1',
      contextSnapshots: [
        { contextId: 'context-1', title: 'Context A', body: 'context' },
      ],
    };
    const recipeRepo = {
      ...repo,
      getRun: vi.fn(async () => recipeRun),
      listRunsByTrail: vi.fn(async () => [recipeRun]),
      getRecipe: vi.fn(async () => ({ title: 'Recipe A' })),
    };
    renderPage(recipeRepo);
    expect(await screen.findByText('Context A')).toBeInTheDocument();
  });

  it('formats summary dates and preserves their original values', async () => {
    const createdAt = '2026-01-02T03:04:00.000Z';
    const runWithDates = {
      ...direct,
      createdAt,
      updatedAt: 'invalid-date',
    };
    const repository = {
      getRun: vi.fn(async () => runWithDates),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
      listRunsByTrail: vi.fn(async () => [runWithDates]),
      listActiveLinks: vi.fn(async () => []),
    } as any;
    renderPage(repository);

    expect(await screen.findByText('invalid-date')).toHaveAttribute(
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
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => []),
    } as any;
    renderPage(repository);
    await openLinksPopover();

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
    expect(
      screen.queryByRole('button', { name: '関連リンクについて' }),
    ).toBeNull();
  });

  it('shows the creation notice only when navigation marks a newly created Trail', async () => {
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => []),
    } as any;

    const directAccess = renderPage(repository);
    await screen.findByText('Prompt A');
    expect(
      screen.queryByText('Trailを作成しました。', { exact: false }),
    ).toBeNull();
    directAccess.unmount();

    renderPage(repository, 'trail-1', { trailCreated: true });
    expect(
      await screen.findByText('Trailを作成しました。', { exact: false }),
    ).toHaveAttribute('role', 'status');
  });
});

describe('TrailDetailPage Link form', () => {
  it('rejects an empty Link title without saving', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => []),
      saveLink: vi.fn(),
    } as any;
    renderPage(repository);
    await screen.findByText('Prompt A');
    await openLinksPopover();
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
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => []),
      saveLink: vi.fn(),
    } as any;
    renderPage(repository);
    await screen.findByText('Prompt A');
    await openLinksPopover();
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
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => []),
      saveLink: vi.fn(),
    } as any;
    renderPage(repository);
    await screen.findByText('Prompt A');
    await openLinksPopover();
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
    let activeLinks: any[] = [];
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => activeLinks),
      saveLink: vi.fn(async (link: any) => {
        activeLinks = [...activeLinks, link];
        return link;
      }),
    } as any;
    renderPage(repository);
    await screen.findByText('Prompt A');
    await openLinksPopover();
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
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => []),
      saveLink: vi.fn(async () => {
        throw new Error('db');
      }),
    } as any;
    renderPage(repository);
    await screen.findByText('Prompt A');
    await openLinksPopover();
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
  let activeLinks: any[] = [];
  const repository = {
    getRun: vi.fn(async () => direct),
    getProject: vi.fn(async () => ({ name: 'Project' })),
    getTrail: vi.fn(async () => trail),
    listRunsByTrail: vi.fn(async () => [direct]),
    listActiveLinks: vi.fn(async () => activeLinks),
    saveLink: vi.fn(
      () =>
        new Promise((done) => {
          resolve = (link: any) => {
            activeLinks = [...activeLinks, link];
            done(link);
          };
        }),
    ),
  } as any;
  renderPage(repository);
  await screen.findByText('Prompt A');
  await openLinksPopover();
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

function RouteSwitchProbe({ to = '/trails/trail-b' }: { to?: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>Run Bへ切替</button>;
}
it('keeps Run B state when a pending Run A Link save resolves after a route change', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  let resolve!: (link: any) => void;
  const trailA = { ...trail, id: 'trail-a', projectId: 'project-a' };
  const trailB = { ...trail, id: 'trail-b', projectId: 'project-b' };
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
  const repository = {
    getRun: vi.fn(async (id) => (id === 'run-a' ? runA : runB)),
    getProject: vi.fn(async (id) => ({
      name: id === 'project-a' ? 'Project A' : 'Project B',
    })),
    getTrail: vi.fn(async (id: string) => (id === 'trail-b' ? trailB : trailA)),
    listRunsByTrail: vi.fn(async (trailId: string) => [
      trailId === 'trail-b' ? runB : runA,
    ]),
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
    <MemoryRouter initialEntries={['/trails/trail-a']}>
      <PromptTrailRepositoryProvider repository={repository}>
        <RouteSwitchProbe />
        <Routes>
          <Route path="/trails/:trailId" element={<TrailDetailPage />} />
        </Routes>
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
  await screen.findByText('Prompt A');
  await openLinksPopover();
  await user.type(screen.getByLabelText('Link名称'), 'A pending');
  await user.selectOptions(screen.getByLabelText('Link種別'), 'document');
  await user.type(screen.getByLabelText('URL'), 'https://a.pending');
  await user.click(screen.getByRole('button', { name: '関連リンクを登録' }));
  await user.click(screen.getByRole('button', { name: 'Run Bへ切替' }));
  expect(await screen.findByText('Prompt B')).toBeInTheDocument();
  expect(screen.getByText('Project B')).toBeInTheDocument();
  await openLinksPopover();
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

describe('TrailDetailPage Run actions popovers', () => {
  async function openResultPopover() {
    fireEvent.click(
      await screen.findByRole('button', { name: '実行結果を表示' }),
    );
  }

  it('opens only one of the Prompt, result, and Links popovers at a time', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    renderPage(createDetailRepository([]));
    await screen.findByText('Prompt A');

    await user.click(
      screen.getByRole('button', { name: 'Prompt Snapshotを表示' }),
    );
    expect(screen.getByText('Prompt A', { selector: 'h4' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: '実行結果を表示' }));
    expect(
      screen.queryByText('Prompt A', { selector: 'h4' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('まだ実行されていません')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '関連リンクを表示' }));
    expect(
      screen.queryByText('まだ実行されていません'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Link名称')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '関連リンクを表示' }));
    expect(screen.queryByLabelText('Link名称')).not.toBeInTheDocument();
  });

  it('shows the empty state when a Run has no output yet', async () => {
    renderPage(createDetailRepository([]));
    await openResultPopover();
    expect(await screen.findByText('まだ実行されていません')).toBeVisible();
  });

  it('shows the Run output inside the result popover once executed', async () => {
    const executedRun = { ...direct, output: 'Generated output text' };
    const repository = {
      getRun: vi.fn(async () => executedRun),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
      listRunsByTrail: vi.fn(async () => [executedRun]),
      listActiveLinks: vi.fn(async () => []),
    } as any;
    renderPage(repository);
    await openResultPopover();
    expect(await screen.findByText('Generated output text')).toBeVisible();
  });

  it('executes a Run, shows a loading state, and surfaces the new result', async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve)),
    );
    vi.stubGlobal('fetch', fetchMock);
    const executedRun = { ...direct, output: 'Fresh output' };
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => []),
      saveRun: vi.fn(async () => executedRun),
    } as any;
    renderPage(repository);
    await screen.findByText('Prompt A');

    const executeButton = screen.getByRole('button', { name: '実行する' });
    fireEvent.click(executeButton);
    expect(executeButton).toBeDisabled();

    resolveFetch(
      new Response(JSON.stringify({ output: 'Fresh output' }), {
        status: 200,
      }),
    );

    await waitFor(() => expect(executeButton).toBeEnabled());
    expect(repository.saveRun).toHaveBeenCalledOnce();
    expect(
      screen.getByLabelText('新しい実行結果があります'),
    ).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('shows an error and stays enabled when execution fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const repository = {
      getRun: vi.fn(async () => direct),
      getProject: vi.fn(async () => ({ name: 'Project' })),
      getTrail: vi.fn(async () => trail),
      listRunsByTrail: vi.fn(async () => [direct]),
      listActiveLinks: vi.fn(async () => []),
      saveRun: vi.fn(),
    } as any;
    renderPage(repository);
    await screen.findByText('Prompt A');

    const executeButton = screen.getByRole('button', { name: '実行する' });
    fireEvent.click(executeButton);
    await waitFor(() => expect(executeButton).toBeEnabled());
    expect(repository.saveRun).not.toHaveBeenCalled();

    await openResultPopover();
    expect(
      await screen.findByText('実行に失敗しました。もう一度お試しください。'),
    ).toBeVisible();

    vi.unstubAllGlobals();
  });
});
