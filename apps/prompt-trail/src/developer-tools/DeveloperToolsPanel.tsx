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
  type DeveloperUiStateSnapshot,
} from '../developer-ui-state';
import {
  callGatewayExecute,
  GATEWAY_PROVIDERS,
  type GatewayProvider,
} from '../gateway/execute-client';
import {
  useDeveloperTools,
  useDeveloperUiStateSnapshot,
} from './DeveloperToolsContext';

const PANEL_ID = 'developer-tools-panel';
const STORE_LABELS: ReadonlyArray<
  readonly [keyof DeveloperRecordCounts, string]
> = [
  ['workspaces', 'Workspaces'],
  ['projects', 'Projects'],
  ['prompts', 'Prompts'],
  ['contexts', 'Contexts'],
  ['recipes', 'Recipes'],
  ['trails', 'Trails'],
  ['runs', 'Runs'],
  ['links', 'Links'],
];

type DestructiveOperation = 'reset' | 'reset-and-load';
type Feedback =
  | { readonly kind: 'success' | 'rejected'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

export function DeveloperToolsPanel() {
  const developerTools = useDeveloperTools();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  if (developerTools === null || uiStateSnapshot === null) return null;

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
        <p className="developer-tools__active-override">
          UI State: {getActiveOverrideLabel(uiStateSnapshot)}
        </p>
      </div>
      {isOpen ? (
        <DeveloperToolsPanelContent
          panelId={PANEL_ID}
          requestClose={() => setIsOpen(false)}
          onBusyChange={setIsBusy}
          uiStateSnapshot={uiStateSnapshot}
        />
      ) : null}
    </section>
  );
}

function DeveloperToolsPanelContent({
  panelId,
  requestClose,
  onBusyChange,
  uiStateSnapshot,
}: {
  panelId: string;
  requestClose(): void;
  onBusyChange(isBusy: boolean): void;
  uiStateSnapshot: DeveloperUiStateSnapshot;
}) {
  const developerTools = useDeveloperTools();
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
  const [uiState, setUiState] = useState<string>(
    DEVELOPER_UI_STATE_CATALOG[0].states[0].state,
  );
  const [uiStateError, setUiStateError] = useState<string | null>(null);

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
  const draftOverride = {
    target: uiStateTarget,
    state: uiState,
  } as DeveloperUiStateOverride;
  const isDraftActive =
    uiStateSnapshot.activeOverride?.target === draftOverride.target &&
    uiStateSnapshot.activeOverride.state === draftOverride.state;

  function applyUiStateOverride() {
    setUiStateError(null);
    try {
      uiStateStore.setActiveOverride(draftOverride);
    } catch {
      setUiStateError(
        'UI State Overrideを保存できませんでした。もう一度お試しください。',
      );
    }
  }

  function clearUiStateOverride() {
    setUiStateError(null);
    try {
      uiStateStore.clearActiveOverride();
    } catch {
      setUiStateError(
        'UI State Overrideを解除できませんでした。もう一度お試しください。',
      );
    }
  }

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

      <details className="developer-tools__section">
        <summary>
          <h3>Data Scenario</h3>
        </summary>
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
      </details>

      <details className="developer-tools__section">
        <summary>
          <h3>UI State Override</h3>
        </summary>
        <p>実データを変更せず、確認したい画面状態を一度に1つだけ固定します。</p>
        <p aria-live="polite">
          Active Override: {getActiveOverrideLabel(uiStateSnapshot)}
        </p>
        <label className="developer-tools__field">
          <span>Target</span>
          <select
            value={uiStateTarget}
            onChange={(event) => {
              const target = event.target
                .value as DeveloperUiStateOverride['target'];
              const entry = DEVELOPER_UI_STATE_CATALOG.find(
                (candidate) => candidate.target === target,
              )!;
              setUiStateTarget(target);
              setUiState(entry.states[0].state);
              setUiStateError(null);
            }}
          >
            {DEVELOPER_UI_STATE_CATALOG.map((entry) => (
              <option key={entry.target} value={entry.target}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="developer-tools__field">
          <span>State</span>
          <select
            value={uiState}
            onChange={(event) => {
              setUiState(event.target.value);
              setUiStateError(null);
            }}
          >
            {selectedUiStateEntry.states.map((state) => (
              <option key={state.state} value={state.state}>
                {state.label}
              </option>
            ))}
          </select>
        </label>
        <div className="developer-tools__state-actions">
          <button
            className="pt-button pt-button--primary"
            type="button"
            disabled={isDraftActive}
            onClick={applyUiStateOverride}
          >
            適用
          </button>
          <button
            className="pt-button pt-button--secondary"
            type="button"
            disabled={uiStateSnapshot.activeOverride === null}
            onClick={clearUiStateOverride}
          >
            解除
          </button>
        </div>
        {uiStateError ? <p role="alert">{uiStateError}</p> : null}
      </details>

      <ExecuteSection />
    </aside>
  );
}

const CLAUDE_KNOWN_MODELS = [
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-haiku-4-5-20251001',
] as const;
const CUSTOM_MODEL_OPTION = 'custom';
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5';

function ExecuteSection() {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<GatewayProvider>(
    GATEWAY_PROVIDERS[0],
  );
  const [modelChoice, setModelChoice] = useState<string>(DEFAULT_CLAUDE_MODEL);
  const [customModel, setCustomModel] = useState('');
  const [maxTokens, setMaxTokens] = useState('');
  const [temperature, setTemperature] = useState('');
  const [topP, setTopP] = useState('');
  const [topK, setTopK] = useState('');
  const [stopSequences, setStopSequences] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<
    | { readonly kind: 'success'; readonly output: string }
    | { readonly kind: 'error'; readonly message: string }
    | null
  >(null);

  const model =
    modelChoice === CUSTOM_MODEL_OPTION ? customModel.trim() : modelChoice;
  const isClaude = provider === 'claude';

  async function handleExecute() {
    setIsExecuting(true);
    setResult(null);
    try {
      const output = await callGatewayExecute(prompt, provider, {
        model: model.trim() === '' ? undefined : model.trim(),
        maxTokens: maxTokens.trim() === '' ? undefined : Number(maxTokens),
        temperature:
          temperature.trim() === '' ? undefined : Number(temperature),
        topP: isClaude && topP.trim() !== '' ? Number(topP) : undefined,
        topK: isClaude && topK.trim() !== '' ? Number(topK) : undefined,
        stopSequences:
          isClaude && stopSequences.trim() !== ''
            ? stopSequences.split('\n').filter((line) => line.trim() !== '')
            : undefined,
      });
      setResult({ kind: 'success', output });
    } catch (error) {
      setResult({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'AI Execution Gatewayの呼び出しに失敗しました。',
      });
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <details className="developer-tools__section">
      <summary>
        <h3>AI Execution Gateway (/api/execute)</h3>
      </summary>
      <p>
        任意のPromptをAI Execution Gatewayへ送信して、生成結果を確認できます。
      </p>

      <label className="developer-tools__field">
        <span>Prompt</span>
        <textarea
          rows={4}
          value={prompt}
          disabled={isExecuting}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </label>

      <label className="developer-tools__field">
        <span>Provider</span>
        <select
          value={provider}
          disabled={isExecuting}
          onChange={(event) =>
            setProvider(event.target.value as GatewayProvider)
          }
        >
          {GATEWAY_PROVIDERS.map((providerId) => (
            <option key={providerId} value={providerId}>
              {providerId}
            </option>
          ))}
        </select>
      </label>

      <label className="developer-tools__field">
        <span>Model</span>
        <select
          value={modelChoice}
          disabled={isExecuting}
          onChange={(event) => setModelChoice(event.target.value)}
        >
          {CLAUDE_KNOWN_MODELS.map((knownModel) => (
            <option key={knownModel} value={knownModel}>
              {knownModel}
            </option>
          ))}
          <option value={CUSTOM_MODEL_OPTION}>その他（自由入力）</option>
        </select>
      </label>

      {modelChoice === CUSTOM_MODEL_OPTION ? (
        <label className="developer-tools__field">
          <span>Model（自由入力）</span>
          <input
            type="text"
            value={customModel}
            disabled={isExecuting}
            onChange={(event) => setCustomModel(event.target.value)}
          />
        </label>
      ) : null}

      <label className="developer-tools__field">
        <span>Max Tokens（任意）</span>
        <input
          type="number"
          value={maxTokens}
          disabled={isExecuting}
          onChange={(event) => setMaxTokens(event.target.value)}
        />
      </label>

      <label className="developer-tools__field">
        <span>Temperature（任意）</span>
        <input
          type="number"
          step="0.1"
          value={temperature}
          disabled={isExecuting}
          onChange={(event) => setTemperature(event.target.value)}
        />
      </label>

      {isClaude ? (
        <>
          <label className="developer-tools__field">
            <span>Top P（任意）</span>
            <input
              type="number"
              step="0.1"
              value={topP}
              disabled={isExecuting}
              onChange={(event) => setTopP(event.target.value)}
            />
          </label>

          <label className="developer-tools__field">
            <span>Top K（任意）</span>
            <input
              type="number"
              value={topK}
              disabled={isExecuting}
              onChange={(event) => setTopK(event.target.value)}
            />
          </label>

          <label className="developer-tools__field">
            <span>Stop Sequences（任意・改行区切り）</span>
            <textarea
              rows={3}
              value={stopSequences}
              disabled={isExecuting}
              onChange={(event) => setStopSequences(event.target.value)}
            />
          </label>
        </>
      ) : null}

      <div className="developer-tools__actions">
        <button
          className="pt-button pt-button--primary"
          type="button"
          disabled={isExecuting || prompt.trim() === ''}
          onClick={() => void handleExecute()}
        >
          {isExecuting ? '実行中...' : 'Execute'}
        </button>
      </div>

      {result?.kind === 'success' ? (
        <p className="developer-tools__execute-result" role="status">
          {result.output}
        </p>
      ) : null}
      {result?.kind === 'error' ? <p role="alert">{result.message}</p> : null}
    </details>
  );
}

function getActiveOverrideLabel(snapshot: DeveloperUiStateSnapshot): string {
  const activeOverride = snapshot.activeOverride;
  if (activeOverride === null) return 'なし（通常状態）';

  const entry = DEVELOPER_UI_STATE_CATALOG.find(
    (candidate) => candidate.target === activeOverride.target,
  )!;
  const state = entry.states.find(
    (candidate) => candidate.state === activeOverride.state,
  )!;
  return `${entry.label} / ${state.label}`;
}
