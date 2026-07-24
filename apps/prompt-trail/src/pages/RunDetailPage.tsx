import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { routePaths } from '../app/routes';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { LINK_ROLES, LINK_TYPES, type Link as TrailLink } from '../domain';
import { createRunLink } from '../trail-creation/create-run-link';
import {
  loadRunDetailDataState,
  type RunDetailDataState,
} from '../run-detail/run-detail-data-state';
export function RunDetailPage() {
  const repository = usePromptTrailRepository();
  const { runId = '' } = useParams();
  const [snapshot, setSnapshot] = useState<{
    repository: typeof repository;
    runId: string;
    state: RunDetailDataState | { status: 'loading' };
    links: readonly TrailLink[];
  }>({ repository, runId, state: { status: 'loading' }, links: [] });
  const [formSnapshot, setFormSnapshot] = useState({
    repository,
    runId,
    url: '',
    type: 'external' as (typeof LINK_TYPES)[number],
    role: 'result' as (typeof LINK_ROLES)[number],
    status: 'idle' as 'idle' | 'submitting' | 'failure',
  });
  const isCurrent =
    snapshot.repository === repository && snapshot.runId === runId;
  const state = isCurrent ? snapshot.state : ({ status: 'loading' } as const);
  const links = isCurrent ? snapshot.links : [];
  const form =
    formSnapshot.repository === repository && formSnapshot.runId === runId
      ? formSnapshot
      : {
          repository,
          runId,
          url: '',
          type: 'external' as const,
          role: 'result' as const,
          status: 'idle' as const,
        };
  useEffect(() => {
    let active = true;
    loadRunDetailDataState(repository, runId).then((next) => {
      if (active)
        setSnapshot({
          repository,
          runId,
          state: next,
          links: next.status === 'data' ? next.data.links : [],
        });
    });
    return () => {
      active = false;
    };
  }, [repository, runId]);
  async function saveLink(event: React.FormEvent) {
    event.preventDefault();
    if (state.status !== 'data' || form.status === 'submitting') return;
    let url: string;
    try {
      const parsed = new URL(form.url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      url = parsed.toString();
    } catch {
      setFormSnapshot((current) =>
        current.repository === repository && current.runId === runId
          ? { ...current, status: 'failure' }
          : current,
      );
      return;
    }
    const savingForm = { ...form, status: 'submitting' as const };
    setFormSnapshot(savingForm);
    try {
      const link = await repository.saveLink(
        createRunLink({
          runId: state.data.run.id,
          url,
          type: form.type,
          role: form.role,
        }),
      );
      setSnapshot((current) =>
        current.repository === repository && current.runId === runId
          ? { ...current, links: [...current.links, link] }
          : current,
      );
      setFormSnapshot((current) =>
        current.repository === repository && current.runId === runId
          ? {
              repository,
              runId,
              url: '',
              type: 'external',
              role: 'result',
              status: 'idle',
            }
          : current,
      );
    } catch {
      setFormSnapshot((current) =>
        current.repository === repository && current.runId === runId
          ? { ...current, status: 'failure' }
          : current,
      );
    }
  }
  if (state.status === 'loading')
    return (
      <DetailMessage
        variant="loading"
        title="Runを読み込んでいます..."
        description="RepositoryからRunとTrailを取得しています。"
      />
    );
  if (state.status === 'not-found')
    return (
      <DetailMessage
        variant="empty"
        title="指定されたRunが見つかりません。"
        description="Dashboardから別のRunを選択してください。"
      />
    );
  if (state.status === 'failure')
    return (
      <DetailMessage
        variant="error"
        title="Runの読み込みに失敗しました。"
        description="ページを再読み込みするか、Dashboardへ戻ってください。"
      />
    );
  const { run, project, recipe } = state.data;
  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Run Detail"
        title="Run Detail"
        description={`${project.name} のTrail: ${run.promptSnapshot.title}`}
      />
      <div className="prompt-trail-page__sections">
        <PageSection title="実行サマリ">
          <dl className="pt-detail-list">
            <div>
              <dt>Project</dt>
              <dd>{project.name}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{run.status}</dd>
            </div>
            <div>
              <dt>種類</dt>
              <dd>{recipe === null ? 'Direct Prompt' : 'Recipe'}</dd>
            </div>
            <div>
              <dt>Created At</dt>
              <dd>{run.createdAt}</dd>
            </div>
            <div>
              <dt>Updated At</dt>
              <dd>{run.updatedAt}</dd>
            </div>
            {recipe === null ? null : (
              <div>
                <dt>Recipe</dt>
                <dd>{recipe.title}</dd>
              </div>
            )}
          </dl>
        </PageSection>
        <PageSection title="Prompt Snapshot">
          <h3>{run.promptSnapshot.title}</h3>
          <pre className="pt-snapshot">{run.promptSnapshot.body}</pre>
        </PageSection>
        {run.contextSnapshots.length > 0 ? (
          <PageSection title="Context Snapshot">
            {run.contextSnapshots.map((context) => (
              <article key={context.contextId}>
                <h3>{context.title}</h3>
                <pre className="pt-snapshot">{context.body}</pre>
              </article>
            ))}
          </PageSection>
        ) : null}
        <PageSection
          title="成果物 / Link"
          description="Prompt SnapshotとLinkをこのTrailで確認できます。"
        >
          <form className="pt-form" onSubmit={saveLink}>
            <label htmlFor="link-url">URL</label>
            <input
              id="link-url"
              type="url"
              value={form.url}
              onChange={(e) =>
                setFormSnapshot({ ...form, url: e.target.value })
              }
              disabled={form.status === 'submitting'}
              required
            />
            <label htmlFor="link-type">Link種別</label>
            <select
              id="link-type"
              value={form.type}
              onChange={(e) =>
                setFormSnapshot({
                  ...form,
                  type: e.target.value as typeof form.type,
                })
              }
            >
              {LINK_TYPES.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <label htmlFor="link-role">Link役割</label>
            <select
              id="link-role"
              value={form.role}
              onChange={(e) =>
                setFormSnapshot({
                  ...form,
                  role: e.target.value as typeof form.role,
                })
              }
            >
              {LINK_ROLES.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            {form.status === 'failure' ? (
              <p className="pt-form__error">
                Linkを保存できませんでした。http または https
                URLを確認してください。
              </p>
            ) : null}
            <button
              className="pt-button pt-button--primary"
              disabled={form.status === 'submitting'}
            >
              {form.status === 'submitting' ? '保存中...' : 'Linkを登録'}
            </button>
          </form>
          {links.length === 0 ? (
            <p>まだ成果物・参照Linkがありません。</p>
          ) : (
            <ul className="pt-link-list">
              {links.map((link) => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.url}
                  </a>
                  <span>
                    {link.type} / {link.role} / {link.createdAt}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PageSection>
      </div>
      <div className="prompt-trail-page__actions">
        <Link
          className="pt-button pt-button--secondary"
          to={routePaths.dashboard}
        >
          Dashboardへ戻る
        </Link>
      </div>
    </section>
  );
}
function DetailMessage({
  variant,
  title,
  description,
}: {
  variant: 'loading' | 'empty' | 'error';
  title: string;
  description: string;
}) {
  return (
    <section className="prompt-trail-page">
      <PageHeader eyebrow="Run Detail" title="Run Detail" />
      <StateMessage variant={variant} title={title} description={description} />
      <div className="prompt-trail-page__actions">
        <Link
          className="pt-button pt-button--secondary"
          to={routePaths.dashboard}
        >
          Dashboardへ戻る
        </Link>
      </div>
    </section>
  );
}
