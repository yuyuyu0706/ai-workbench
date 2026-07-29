import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildRunDetailPath, routePaths } from '../app/routes';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageHeader, PageSection } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import { createDirectTrail } from '../trail-creation/create-direct-trail';
export function NewTrailPage() {
  const repository = usePromptTrailRepository();
  const navigate = useNavigate();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'failure'>(
    'idle',
  );
  const valid = body.trim().length > 0;
  const formOverride = selectActiveDeveloperUiState(
    uiStateSnapshot,
    'new-trail-form',
  );
  const displayedStatus =
    formOverride === 'submitting'
      ? 'submitting'
      : formOverride === 'save-failure'
        ? 'failure'
        : status;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (formOverride !== null || !valid || status === 'submitting') return;
    setStatus('submitting');
    try {
      const run = await createDirectTrail(repository, { promptBody: body });
      navigate(buildRunDetailPath(run.id), {
        state: { trailCreated: true },
      });
    } catch {
      setStatus('failure');
    }
  }
  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="New Trail"
        title="新しいTrailを始める"
        description="AIに依頼する内容を入力してください。作業後に関連リンクを追加すると、依頼から成果までをTrailとして残せます。"
      />
      <div className="prompt-trail-page__sections">
        <PageSection
          title="Prompt"
          description="Promptの最初の行がTrailタイトルになります。"
        >
          <form className="pt-form" onSubmit={submit}>
            <label htmlFor="prompt-body">Prompt本文</label>
            <textarea
              id="prompt-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={12}
              disabled={displayedStatus === 'submitting'}
            />
            {!valid && body.length > 0 ? (
              <p className="pt-form__error">Prompt本文を入力してください。</p>
            ) : null}
            {displayedStatus === 'failure' ? (
              <p className="pt-form__error">
                保存に失敗しました。内容を確認して再試行してください。
              </p>
            ) : null}
            <div className="prompt-trail-page__actions">
              <button
                className="pt-button pt-button--primary"
                disabled={!valid || displayedStatus === 'submitting'}
              >
                {displayedStatus === 'submitting' ? '作成中...' : 'Trailを作成'}
              </button>
              <Link
                className="pt-button pt-button--secondary"
                to={routePaths.dashboard}
              >
                Dashboardへ戻る
              </Link>
            </div>
          </form>
        </PageSection>
      </div>
    </section>
  );
}
