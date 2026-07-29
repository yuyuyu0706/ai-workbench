import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { routePaths } from '../app/routes';
import {
  developerDataScenarios,
  type DeveloperDataScenarioId,
  type DeveloperRecordCounts,
} from '../developer-data';
import {
  DEVELOPER_UI_STATE_CATALOG,
  type DeveloperUiStateOverride,
} from '../developer-ui-state';
import {
  useDeveloperTools,
  useDeveloperUiStateSnapshot,
} from './DeveloperToolsContext';

const PANEL_ID = 'developer-tools-panel';
const STORE_LABELS: ReadonlyArray<
  readonly [keyof DeveloperRecordCounts, string]
> = [
  ['projects', 'Projects'],
  ['prompts', 'Prompts'],
  ['contexts', 'Contexts'],
  ['recipes', 'Recipes'],
  ['runs', 'Runs'],
  ['links', 'Links'],
];

type DestructiveOperation = 'reset' | 'reset-and-load';
type Feedback =
  | { readonly kind: 'success' | 'rejected'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

export function DeveloperToolsPanel() {
  const developerTools = useDeveloperTools();
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  if (developerTools === null) return null;

  return (
    <section className="developer-tools" aria-label="Developer Tools">
      <div className="developer-tools__bar">
        <button
          className="pt-button pt-button--secondary"
          type="button"
          aria-expanded={isOpen}
          aria-controls={PANEL_ID}
          disabled={isBusy}
          onClick={() => {
            if (!isOpen) setIsBusy(true);
            setIsOpen((current) => !current);
          }}
        >
          Developer Tools
        </button>
      </div>
      {isOpen ? (
        <DeveloperToolsPanelContent
          panelId={PANEL_ID}
          requestClose={() => setIsOpen(false)}
          onBusyChange={setIsBusy}
        />
      ) : null}
    </section>
  );
}

function DeveloperToolsPanelContent({
  panelId,
  requestClose,
  onBusyChange,
}: {
  panelId: string;
  requestClose(): void;
  onBusyChange(isBusy: boolean): void;
}) {
  const developerTools = useDeveloperTools();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const { notifyDataChanged } = usePromptTrailDataRevision();
  const navigate = useNavigate();
  const [scenarioId, setScenarioId] =
    useState<DeveloperDataScenarioId>('standard');
  const [countsState, setCountsState] = useState<
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly counts: DeveloperRecordCounts }
    | { readonly status: 'failed' }
  >({ status: 'loading' });
  const [isOperating, setIsOperating] = useState(false);
  const [confirmation, setConfirmation] = useState<DestructiveOperation | null>(
    null,
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const requestId = useRef(0);
  const [uiStateTarget, setUiStateTarget] = useState(
    DEVELOPER_UI_STATE_CATALOG[0].target as DeveloperUiStateOverride['target'],
  );

  if (developerTools === null)
    throw new Error('Developer Tools Panel requires an enabled capability.');
  const service = developerTools.dataService;
  const uiStateStore = developerTools.uiStateStore;

  const isBusy = countsState.status === 'loading' || isOperating;

  useEffect(() => onBusyChange(isBusy), [isBusy, onBusyChange]);

  function loadCounts() {
    const currentRequest = ++requestId.current;
    setCountsState({ status: 'loading' });
    setFeedback(null);
    service
      .getRecordCounts()
      .then((nextCounts) => {
        if (requestId.current === currentRequest)
          setCountsState({ status: 'ready', counts: nextCounts });
      })
      .catch(() => {
        if (requestId.current === currentRequest) {
          setCountsState({ status: 'failed' });
          setFeedback({
            kind: 'error',
            message: '件数を読み込めませんでした。再試行してください。',
          });
        }
      });
  }

  useEffect(() => {
    const currentRequest = ++requestId.current;
    service
      .getRecordCounts()
      .then((nextCounts) => {
        if (requestId.current === currentRequest)
          setCountsState({ status: 'ready', counts: nextCounts });
      })
      .catch(() => {
        if (requestId.current === currentRequest) {
          setCountsState({ status: 'failed' });
          setFeedback({
            kind: 'error',
            message: '件数を読み込めませんでした。再試行してください。',
          });
        }
      });
    return () => onBusyChange(false);
  }, [onBusyChange, service]);

  async function execute(operation: 'load' | DestructiveOperation) {
    const currentRequest = ++requestId.current;
    setIsOperating(true);
    setFeedback(null);
    setConfirmation(null);
    try {
      const result =
        operation === 'load'
          ? await service.loadScenario(scenarioId)
          : operation === 'reset'
            ? await service.resetDatabase()
            : await service.resetAndLoadScenario(scenarioId);
      if (requestId.current !== currentRequest) return;
      setCountsState({ status: 'ready', counts: result.counts });
      if (result.status === 'database-not-empty') {
        setFeedback({
          kind: 'rejected',
          message:
            'DBが空ではないためLoadしませんでした。既存データを置き換えるにはReset & Loadを利用してください。',
        });
        return;
      }
      setFeedback({
        kind: 'success',
        message:
          operation === 'reset'
            ? '全データをResetしました。'
            : `Scenario「${scenarioId}」を${operation === 'load' ? 'Load' : 'Reset & Load'}しました。`,
      });
      notifyDataChanged();
      navigate(routePaths.dashboard);
    } catch {
      if (requestId.current === currentRequest)
        setFeedback({
          kind: 'error',
          message:
            'データ操作に失敗し、変更を完了できませんでした。もう一度お試しください。',
        });
    } finally {
      if (requestId.current === currentRequest) setIsOperating(false);
    }
  }

  const selectedScenario = developerDataScenarios.find(
    (scenario) => scenario.id === scenarioId,
  )!;
  const selectedUiStateEntry = DEVELOPER_UI_STATE_CATALOG.find(
    (entry) => entry.target === uiStateTarget,
  )!;

  return (
    <aside className="developer-tools__panel" id={panelId}>
      <div className="developer-tools__heading">
        <div>
          <p className="developer-tools__eyebrow">Development only</p>
          <h2>Developer Tools</h2>
        </div>
        <button
          className="pt-button pt-button--secondary"
          type="button"
          disabled={isBusy}
          onClick={requestClose}
        >
          閉じる
        </button>
      </div>

      <section
        className="developer-tools__section"
        aria-labelledby="data-scenario-heading"
      >
        <h3 id="data-scenario-heading">Data Scenario</h3>
        <div>
          <h4>Current Record Counts</h4>
          {countsState.status === 'loading' ? (
            <p role="status">6 Storeの件数を読み込んでいます...</p>
          ) : countsState.status === 'ready' ? (
            <dl className="developer-tools__counts">
              {STORE_LABELS.map(([name, label]) => (
                <div key={name}>
                  <dt>{label}</dt>
                  <dd>{countsState.counts[name]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <button
              className="pt-button pt-button--secondary"
              type="button"
              onClick={loadCounts}
            >
              件数を再読み込み
            </button>
          )}
        </div>

        <label className="developer-tools__field">
          <span>Scenario</span>
          <select
            value={scenarioId}
            disabled={isBusy || countsState.status !== 'ready'}
            onChange={(event) => {
              setScenarioId(event.target.value as DeveloperDataScenarioId);
              setConfirmation(null);
              setFeedback(null);
            }}
          >
            {developerDataScenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.id} — {scenario.label}
              </option>
            ))}
          </select>
        </label>
        <p>{selectedScenario.description}</p>
        <p>
          Expected Counts:{' '}
          {STORE_LABELS.map(
            ([name, label]) =>
              `${label} ${selectedScenario.expectedCounts[name]}`,
          ).join(' / ')}
        </p>

        <div className="developer-tools__actions">
          <button
            className="pt-button pt-button--primary"
            type="button"
            disabled={isBusy || countsState.status !== 'ready'}
            onClick={() => void execute('load')}
          >
            Load
          </button>
          <button
            className="pt-button pt-button--secondary"
            type="button"
            disabled={isBusy}
            onClick={() => setConfirmation('reset')}
          >
            Reset
          </button>
          <button
            className="pt-button pt-button--secondary"
            type="button"
            disabled={isBusy}
            onClick={() => setConfirmation('reset-and-load')}
          >
            Reset &amp; Load
          </button>
        </div>

        {confirmation !== null ? (
          <div className="developer-tools__confirmation" role="alert">
            <p>
              {confirmation === 'reset'
                ? '現在のbrowser / originに保存されたProjects、Prompts、Contexts、Recipes、Runs、Linksの全データを削除します。この操作は元に戻せません。'
                : `現在のbrowser / originの全6 Storeデータを削除し、Scenario「${scenarioId}」へ置き換えます。この操作は元に戻せません。`}
            </p>
            <div className="developer-tools__actions">
              <button
                className="pt-button pt-button--primary"
                type="button"
                onClick={() => void execute(confirmation)}
              >
                実行する
              </button>
              <button
                className="pt-button pt-button--secondary"
                type="button"
                onClick={() => setConfirmation(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : null}
        {isOperating ? (
          <p role="status">データ操作を実行しています...</p>
        ) : null}
        {feedback ? (
          <p role={feedback.kind === 'error' ? 'alert' : 'status'}>
            {feedback.message}
          </p>
        ) : null}
      </section>

      <section
        className="developer-tools__section"
        aria-labelledby="ui-state-heading"
      >
        <h3 id="ui-state-heading">UI State Override</h3>
        <p>実データを変更せず、確認したい画面状態を一度に1つだけ固定します。</p>
        <p aria-live="polite">
          Active Override:{' '}
          {uiStateSnapshot?.activeOverride
            ? `${uiStateSnapshot.activeOverride.target} / ${uiStateSnapshot.activeOverride.state}`
            : 'None'}
        </p>
        <label className="developer-tools__field">
          <span>Target</span>
          <select
            value={uiStateTarget}
            onChange={(event) =>
              setUiStateTarget(
                event.target.value as DeveloperUiStateOverride['target'],
              )
            }
          >
            {DEVELOPER_UI_STATE_CATALOG.map((entry) => (
              <option key={entry.target} value={entry.target}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <div className="developer-tools__state-actions">
          {selectedUiStateEntry.states.map((state) => (
            <button
              key={state.state}
              className="pt-button pt-button--secondary"
              type="button"
              aria-pressed={
                uiStateSnapshot?.activeOverride?.target === uiStateTarget &&
                uiStateSnapshot.activeOverride.state === state.state
              }
              onClick={() =>
                uiStateStore.setActiveOverride({
                  target: uiStateTarget,
                  state: state.state,
                } as DeveloperUiStateOverride)
              }
            >
              {state.label}
            </button>
          ))}
        </div>
        <button
          className="pt-button pt-button--secondary developer-tools__clear-override"
          type="button"
          disabled={uiStateSnapshot?.activeOverride === null}
          onClick={() => uiStateStore.clearActiveOverride()}
        >
          Clear Override
        </button>
      </section>
    </aside>
  );
}
