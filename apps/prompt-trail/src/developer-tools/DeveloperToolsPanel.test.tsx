import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  PromptTrailDataRevisionProvider,
  usePromptTrailDataRevision,
} from '../app/PromptTrailDataRevisionContext';
import type {
  DeveloperDataService,
  DeveloperRecordCounts,
} from '../developer-data';
import type { DeveloperToolsRuntime } from '../app/prompt-trail-runtime';
import {
  createDeveloperUiStateStore,
  DEVELOPER_UI_STATE_CATALOG,
  type DeveloperUiStateStorage,
} from '../developer-ui-state';
import { DeveloperToolsProvider } from './DeveloperToolsContext';
import { DeveloperToolsPanel } from './DeveloperToolsPanel';

const emptyCounts: DeveloperRecordCounts = {
  projects: 0,
  prompts: 0,
  contexts: 0,
  recipes: 0,
  runs: 0,
  links: 0,
};
const standardCounts: DeveloperRecordCounts = {
  projects: 1,
  prompts: 1,
  contexts: 0,
  recipes: 0,
  runs: 1,
  links: 1,
};

function createService() {
  return {
    getRecordCounts: vi.fn().mockResolvedValue(emptyCounts),
    loadScenario: vi.fn().mockResolvedValue({
      status: 'loaded',
      scenarioId: 'standard',
      counts: standardCounts,
    }),
    resetDatabase: vi.fn().mockResolvedValue({
      status: 'reset',
      counts: emptyCounts,
    }),
    resetAndLoadScenario: vi.fn().mockResolvedValue({
      status: 'reset-and-loaded',
      scenarioId: 'standard',
      counts: standardCounts,
    }),
  };
}

function RevisionProbe() {
  const { revision } = usePromptTrailDataRevision();
  return <output aria-label="Data revision">{revision}</output>;
}

function createStorage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue;
    }),
    removeItem: vi.fn(() => {
      value = null;
    }),
  } satisfies DeveloperUiStateStorage;
}

function renderPanel(
  service: ReturnType<typeof createService> | null,
  storage: DeveloperUiStateStorage = createStorage(),
) {
  const developerTools = service
    ? ({
        dataService: service as unknown as DeveloperDataService,
        uiStateStore: createDeveloperUiStateStore(storage),
      } satisfies DeveloperToolsRuntime)
    : null;
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <PromptTrailDataRevisionProvider>
        <DeveloperToolsProvider value={developerTools}>
          <DeveloperToolsPanel />
          <RevisionProbe />
        </DeveloperToolsProvider>
      </PromptTrailDataRevisionProvider>
    </MemoryRouter>,
  );
}

async function openReadyPanel() {
  const toggle = screen.getByRole('button', { name: 'Developer Tools' });
  await userEvent.click(toggle);
  await screen.findByText('Projects');
  return toggle;
}

describe('DeveloperToolsPanel', () => {
  it('does not expose its launcher or panel when the capability is disabled', () => {
    renderPanel(null);
    expect(
      screen.queryByRole('button', { name: 'Developer Tools' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('loads a scenario and only increments data revision on success', async () => {
    const service = createService();
    renderPanel(service);
    await openReadyPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Load' }));

    expect(service.loadScenario).toHaveBeenCalledWith('standard');
    expect(await screen.findByText(/Scenario「standard」をLoad/)).toBeVisible();
    expect(screen.getByLabelText('Data revision')).toHaveTextContent('1');
  });

  it('shows a non-empty rejection without incrementing data revision', async () => {
    const service = createService();
    service.loadScenario.mockResolvedValueOnce({
      status: 'database-not-empty',
      counts: standardCounts,
    });
    renderPanel(service);
    await openReadyPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Load' }));

    expect(
      await screen.findByText(/DBが空ではないためLoadしませんでした/),
    ).toBeVisible();
    expect(screen.getByLabelText('Data revision')).toHaveTextContent('0');
  });

  it('shows a retryable service failure without incrementing data revision', async () => {
    const service = createService();
    service.loadScenario.mockRejectedValueOnce(new Error('failed'));
    renderPanel(service);
    await openReadyPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Load' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'データ操作に失敗',
    );
    expect(screen.getByLabelText('Data revision')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Load' })).toBeEnabled();
  });

  it.each([
    ['Reset', 'resetDatabase'],
    ['Reset & Load', 'resetAndLoadScenario'],
  ] as const)('requires confirmation before %s', async (buttonName, method) => {
    const service = createService();
    renderPanel(service);
    await openReadyPanel();

    await userEvent.click(screen.getByRole('button', { name: buttonName }));
    expect(service[method]).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '実行する' }));
    await waitFor(() => expect(service[method]).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Data revision')).toHaveTextContent('1');
  });

  it('cancels without a service call and preserves scenario and counts', async () => {
    const service = createService();
    renderPanel(service);
    await openReadyPanel();
    const scenario = screen.getByRole('combobox', { name: 'Scenario' });
    await userEvent.selectOptions(scenario, 'dense');
    await userEvent.click(screen.getByRole('button', { name: 'Reset & Load' }));
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(service.resetAndLoadScenario).not.toHaveBeenCalled();
    expect(scenario).toHaveValue('dense');
    expect(screen.getByText('Projects').nextElementSibling).toHaveTextContent(
      '0',
    );
  });

  it('disables all operations and both close controls while an operation is pending', async () => {
    const service = createService();
    let resolveLoad!: (
      value: Awaited<ReturnType<DeveloperDataService['loadScenario']>>,
    ) => void;
    service.loadScenario.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    renderPanel(service);
    const toggle = await openReadyPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Load' }));

    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '閉じる' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Load' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset & Load' })).toBeDisabled();
    expect(screen.getByRole('complementary')).toBeInTheDocument();

    resolveLoad({
      status: 'loaded',
      scenarioId: 'standard',
      counts: standardCounts,
    });
    await waitFor(() => expect(toggle).toBeEnabled());
  });

  it('replaces loading with an error, disables Load, and retries count loading', async () => {
    const service = createService();
    service.getRecordCounts
      .mockRejectedValueOnce(new Error('count failed'))
      .mockResolvedValueOnce(emptyCounts);
    renderPanel(service);
    await userEvent.click(
      screen.getByRole('button', { name: 'Developer Tools' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '件数を読み込めませんでした',
    );
    expect(
      screen.queryByText('6 Storeの件数を読み込んでいます...'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load' })).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: '件数を再読み込み' }),
    );
    expect(await screen.findByText('Projects')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Load' })).toBeEnabled();
  });

  it('renders all catalog targets and states in catalog order', async () => {
    renderPanel(createService());
    await openReadyPanel();

    const target = screen.getByRole('combobox', { name: 'Target' });
    expect(
      [...target.querySelectorAll('option')].map((option) => option.value),
    ).toEqual(DEVELOPER_UI_STATE_CATALOG.map((entry) => entry.target));

    const states: string[] = [];
    for (const entry of DEVELOPER_UI_STATE_CATALOG) {
      await userEvent.selectOptions(target, entry.target);
      states.push(
        ...[
          ...screen
            .getByRole('combobox', { name: 'State' })
            .querySelectorAll('option'),
        ].map((option) => option.value),
      );
    }
    expect(states).toEqual(
      DEVELOPER_UI_STATE_CATALOG.flatMap((entry) =>
        entry.states.map((state) => state.state),
      ),
    );
    expect(states).toHaveLength(28);
  });

  it('keeps target and state selection as a draft until explicitly applied', async () => {
    const service = createService();
    const storage = createStorage();
    renderPanel(service, storage);
    await openReadyPanel();

    const target = screen.getByRole('combobox', { name: 'Target' });
    const state = screen.getByRole('combobox', { name: 'State' });
    await userEvent.selectOptions(state, 'empty');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(screen.getAllByText(/なし（通常状態）/)).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: '適用' }));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '適用' })).toBeDisabled();
    expect(screen.getAllByText(/Dashboard Page \/ Empty/)).toHaveLength(2);

    await userEvent.selectOptions(target, 'new-trail-form');
    expect(state).toHaveValue('submitting');
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    await userEvent.selectOptions(target, 'dashboard-page');
    await userEvent.selectOptions(state, 'empty');
    expect(screen.getByRole('button', { name: '適用' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '解除' }));
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/なし（通常状態）/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: '解除' })).toBeDisabled();
    expect(service.loadScenario).not.toHaveBeenCalled();
    expect(service.resetDatabase).not.toHaveBeenCalled();
    expect(service.resetAndLoadScenario).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Data revision')).toHaveTextContent('0');
  });

  it('shows and restores the active override while the panel is closed and reopened', async () => {
    const storage = createStorage(
      JSON.stringify({
        version: 1,
        activeOverride: { target: 'new-trail-form', state: 'save-failure' },
      }),
    );
    renderPanel(createService(), storage);

    expect(
      screen.getByText(/UI State: New Trail Form \/ Save failure/),
    ).toBeVisible();
    await openReadyPanel();
    expect(screen.getAllByText(/New Trail Form \/ Save failure/)).toHaveLength(
      2,
    );
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(
      screen.getByText(/UI State: New Trail Form \/ Save failure/),
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Developer Tools' }),
    );
    expect(screen.getAllByText(/New Trail Form \/ Save failure/)).toHaveLength(
      2,
    );
  });

  it.each([
    ['setItem', '保存できませんでした'],
    ['removeItem', '解除できませんでした'],
  ] as const)(
    'keeps the snapshot and draft when %s fails',
    async (method, message) => {
      const storage = createStorage();
      if (method === 'removeItem') {
        storage.getItem = vi.fn(() =>
          JSON.stringify({
            version: 1,
            activeOverride: { target: 'dashboard-page', state: 'loading' },
          }),
        );
      }
      if (method === 'setItem') {
        storage.setItem = vi.fn((key: string, value: string) => {
          void key;
          void value;
          throw new Error('blocked');
        });
      } else {
        storage.removeItem = vi.fn(() => {
          throw new Error('blocked');
        });
      }
      renderPanel(createService(), storage);
      await openReadyPanel();

      if (method === 'setItem') {
        await userEvent.selectOptions(
          screen.getByRole('combobox', { name: 'State' }),
          'empty',
        );
        await userEvent.click(screen.getByRole('button', { name: '適用' }));
        expect(screen.getByRole('combobox', { name: 'State' })).toHaveValue(
          'empty',
        );
        expect(screen.getAllByText(/なし（通常状態）/)).toHaveLength(2);
      } else {
        await userEvent.click(screen.getByRole('button', { name: '解除' }));
        expect(screen.getAllByText(/Dashboard Page \/ Loading/)).toHaveLength(
          2,
        );
      }
      expect(screen.getByRole('alert')).toHaveTextContent(message);
    },
  );

  it('keeps UI state operations independent during and after data operations', async () => {
    const service = createService();
    let resolveLoad!: (
      value: Awaited<ReturnType<DeveloperDataService['loadScenario']>>,
    ) => void;
    service.loadScenario.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    renderPanel(service);
    await openReadyPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Load' }));
    expect(screen.getByRole('combobox', { name: 'Target' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'State' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: '適用' }));
    expect(screen.getAllByText(/Dashboard Page \/ Loading/)).toHaveLength(2);

    resolveLoad({
      status: 'loaded',
      scenarioId: 'standard',
      counts: standardCounts,
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Load' })).toBeEnabled(),
    );
    expect(screen.getAllByText(/Dashboard Page \/ Loading/)).toHaveLength(2);
    expect(screen.getByLabelText('Data revision')).toHaveTextContent('1');
  });

  it.each(['Load', 'Reset', 'Reset & Load'] as const)(
    'keeps the active override after %s completes',
    async (operation) => {
      renderPanel(createService());
      await openReadyPanel();
      await userEvent.click(screen.getByRole('button', { name: '適用' }));

      await userEvent.click(
        screen.getByRole('button', { name: new RegExp(`^${operation}$`) }),
      );
      if (operation !== 'Load') {
        await userEvent.click(screen.getByRole('button', { name: '実行する' }));
      }

      await waitFor(() =>
        expect(screen.getByLabelText('Data revision')).toHaveTextContent('1'),
      );
      expect(screen.getAllByText(/Dashboard Page \/ Loading/)).toHaveLength(2);
    },
  );
});
