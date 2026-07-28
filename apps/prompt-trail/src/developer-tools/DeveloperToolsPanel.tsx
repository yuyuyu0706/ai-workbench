import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { routePaths } from '../app/routes';
import {
  developerDataScenarios,
  type DeveloperDataScenarioId,
  type DeveloperRecordCounts,
} from '../developer-data';
import { useDeveloperTools } from './DeveloperToolsContext';

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

  if (developerTools === null) return null;

  return (
    <section className="developer-tools" aria-label="Developer Tools">
      <div className="developer-tools__bar">
        <button
          className="pt-button pt-button--secondary"
          type="button"
          aria-expanded={isOpen}
          aria-controls={PANEL_ID}
          onClick={() => setIsOpen((current) => !current)}
        >
          Developer Tools
        </button>
      </div>
      {isOpen ? (
        <DeveloperToolsPanelContent
          panelId={PANEL_ID}
          requestClose={() => setIsOpen(false)}
        />
      ) : null}
    </section>
  );
}

function DeveloperToolsPanelContent({
  panelId,
  requestClose,
}: {
  panelId: string;
  requestClose(): void;
}) {
  const developerTools = useDeveloperTools();
  const { notifyDataChanged } = usePromptTrailDataRevision();
  const navigate = useNavigate();
  const [scenarioId, setScenarioId] =
    useState<DeveloperDataScenarioId>('standard');
  const [counts, setCounts] = useState<DeveloperRecordCounts | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [confirmation, setConfirmation] = useState<DestructiveOperation | null>(
    null,
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const requestId = useRef(0);

  if (developerTools === null)
    throw new Error('Developer Tools Panel requires an enabled capability.');
  const service = developerTools.dataService;

  useEffect(() => {
    const currentRequest = ++requestId.current;
    service
      .getRecordCounts()
      .then((nextCounts) => {
        if (requestId.current === currentRequest) setCounts(nextCounts);
      })
      .catch(() => {
        if (requestId.current === currentRequest)
          setFeedback({
            kind: 'error',
            message: '件数を読み込めませんでした。再度Panelを開いてください。',
          });
      })
      .finally(() => {
        if (requestId.current === currentRequest) setIsBusy(false);
      });
  }, [service]);

  async function execute(operation: 'load' | DestructiveOperation) {
    const currentRequest = ++requestId.current;
    setIsBusy(true);
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
      setCounts(result.counts);
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
      if (requestId.current === currentRequest) setIsBusy(false);
    }
  }

  const selectedScenario = developerDataScenarios.find(
    (scenario) => scenario.id === scenarioId,
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
          {counts === null ? (
            <p role="status">6 Storeの件数を読み込んでいます...</p>
          ) : (
            <dl className="developer-tools__counts">
              {STORE_LABELS.map(([name, label]) => (
                <div key={name}>
                  <dt>{label}</dt>
                  <dd>{counts[name]}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <label className="developer-tools__field">
          <span>Scenario</span>
          <select
            value={scenarioId}
            disabled={isBusy}
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
            disabled={isBusy}
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
        {isBusy && counts !== null ? (
          <p role="status">データ操作を実行しています...</p>
        ) : null}
        {feedback ? (
          <p role={feedback.kind === 'error' ? 'alert' : 'status'}>
            {feedback.message}
          </p>
        ) : null}
      </section>
    </aside>
  );
}
