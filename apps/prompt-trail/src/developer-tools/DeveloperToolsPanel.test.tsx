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
import { createDeveloperUiStateStore } from '../developer-ui-state';
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

function renderPanel(service: ReturnType<typeof createService> | null) {
  const developerTools = service
    ? ({
        dataService: service as unknown as DeveloperDataService,
        uiStateStore: createDeveloperUiStateStore({
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        }),
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

  it('applies one UI state override at a time and clears it', async () => {
    const service = createService();
    renderPanel(service);
    await openReadyPanel();

    expect(screen.getByText('Active Override: None')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Clear Override' }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Loading' }));
    expect(
      screen.getByText('Active Override: dashboard-page / loading'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Loading' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Target' }),
      'new-trail-form',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save failure' }));
    expect(
      screen.getByText('Active Override: new-trail-form / save-failure'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Loading' })).toBeNull();

    await userEvent.click(
      screen.getByRole('button', { name: 'Clear Override' }),
    );
    expect(screen.getByText('Active Override: None')).toBeVisible();
  });
});
