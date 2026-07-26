import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { routePaths } from '../app/routes';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import type { Link as TrailLink, LinkType } from '../domain';
import {
  createRunLink,
  type SelectableLinkType,
} from '../trail-creation/create-run-link';
import {
  loadRunDetailDataState,
  type RunDetailDataState,
} from '../run-detail/run-detail-data-state';
import { formatDateTime } from './date-time';
export function RunDetailPage() {
  const repository = usePromptTrailRepository();
  const { runId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const linkInformationId = useId();
  const linkInformationRef = useRef<HTMLDivElement>(null);
  const linkInformationButtonRef = useRef<HTMLButtonElement>(null);
  const [isLinkInformationOpen, setIsLinkInformationOpen] = useState(false);
  const trailCreated =
    (location.state as { trailCreated?: boolean } | null)?.trailCreated ===
    true;
  const [createdNoticeRunId] = useState(trailCreated ? runId : null);
  const [snapshot, setSnapshot] = useState<{
    repository: typeof repository;
    runId: string;
    state: RunDetailDataState | { status: 'loading' };
    links: readonly TrailLink[];
  }>({ repository, runId, state: { status: 'loading' }, links: [] });
  const [formSnapshot, setFormSnapshot] = useState({
    repository,
    runId,
    title: '',
    url: '',
    type: '' as SelectableLinkType | '',
    status: 'idle' as 'idle' | 'submitting' | 'failure',
    error: null as 'title' | 'url' | 'type' | 'save' | null,
    successNotice: false,
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
          title: '',
          url: '',
          type: '' as const,
          status: 'idle' as const,
          error: null,
          successNotice: false,
        };
  useEffect(() => {
    if (trailCreated) {
      void navigate(`${location.pathname}${location.search}${location.hash}`, {
        replace: true,
        state: null,
      });
    }
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    trailCreated,
  ]);
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
  useEffect(() => {
    if (!isLinkInformationOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!linkInformationRef.current?.contains(event.target as Node)) {
        setIsLinkInformationOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsLinkInformationOpen(false);
        linkInformationButtonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLinkInformationOpen]);
  async function saveLink(event: React.FormEvent) {
    event.preventDefault();
    if (state.status !== 'data' || form.status === 'submitting') return;
    const title = form.title.trim();
    if (title.length === 0) {
      setFormSnapshot({
        ...form,
        status: 'failure',
        error: 'title',
        successNotice: false,
      });
      return;
    }
    let url: string;
    try {
      const parsed = new URL(form.url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      url = parsed.toString();
    } catch {
      setFormSnapshot((current) =>
        current.repository === repository && current.runId === runId
          ? {
              ...current,
              status: 'failure',
              error: 'url',
              successNotice: false,
            }
          : current,
      );
      return;
    }
    if (form.type === '') {
      setFormSnapshot({
        ...form,
        status: 'failure',
        error: 'type',
        successNotice: false,
      });
      return;
    }
    const savingForm = {
      ...form,
      status: 'submitting' as const,
      error: null,
      successNotice: false,
    };
    setFormSnapshot(savingForm);
    try {
      const link = await repository.saveLink(
        createRunLink({
          runId: state.data.run.id,
          title,
          url,
          type: form.type,
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
              title: '',
              url: '',
              type: '',
              status: 'idle',
              error: null,
              successNotice: true,
            }
          : current,
      );
    } catch {
      setFormSnapshot((current) =>
        current.repository === repository && current.runId === runId
          ? {
              ...current,
              status: 'failure',
              error: 'save',
              successNotice: false,
            }
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
        {createdNoticeRunId === runId ? (
          <p className="pt-success-notice" role="status">
            Trailを作成しました。Promptを確認し、作業に関係する関連リンクを追加してください。
          </p>
        ) : null}
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
              <dd>
                <time dateTime={run.createdAt}>
                  {formatDateTime(run.createdAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Updated At</dt>
              <dd>
                <time dateTime={run.updatedAt}>
                  {formatDateTime(run.updatedAt)}
                </time>
              </dd>
            </div>
            {recipe === null ? null : (
              <div>
                <dt>Recipe</dt>
                <dd>{recipe.title}</dd>
              </div>
            )}
          </dl>
        </PageSection>
        <PageSection title="Prompt">
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
          title="関連リンク"
          actions={
            <div className="pt-run-link-information" ref={linkInformationRef}>
              <button
                ref={linkInformationButtonRef}
                className="pt-run-link-information__button"
                type="button"
                aria-label="関連リンクについて"
                aria-expanded={isLinkInformationOpen}
                aria-controls={linkInformationId}
                onClick={() => setIsLinkInformationOpen((open) => !open)}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v6M12 7.5v.5" />
                </svg>
              </button>
              {isLinkInformationOpen ? (
                <p
                  className="pt-run-link-information__popover"
                  id={linkInformationId}
                >
                  この作業で参照したChat・Issue・PR・Documentや、作成した成果物のURLを登録できます。
                </p>
              ) : null}
            </div>
          }
        >
          <form className="pt-form" onSubmit={saveLink}>
            <label htmlFor="link-title">Link名称</label>
            <input
              id="link-title"
              value={form.title}
              onChange={(e) =>
                setFormSnapshot({
                  ...form,
                  title: e.target.value,
                  status: 'idle',
                  error: null,
                  successNotice: false,
                })
              }
              disabled={form.status === 'submitting'}
            />
            <label htmlFor="link-url">URL</label>
            <input
              id="link-url"
              type="url"
              value={form.url}
              onChange={(e) =>
                setFormSnapshot({
                  ...form,
                  url: e.target.value,
                  status: 'idle',
                  error: null,
                  successNotice: false,
                })
              }
              disabled={form.status === 'submitting'}
            />
            <label htmlFor="link-type">Link種別</label>
            <select
              id="link-type"
              value={form.type}
              onChange={(e) =>
                setFormSnapshot({
                  ...form,
                  type: e.target.value as typeof form.type,
                  status: 'idle',
                  error: null,
                  successNotice: false,
                })
              }
              disabled={form.status === 'submitting'}
            >
              <option value="">選択してください</option>
              {SELECTABLE_LINK_TYPES.map((value) => (
                <option key={value} value={value}>
                  {LINK_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
            {form.status === 'failure' ? (
              <p className="pt-form__error">
                {form.error === 'title'
                  ? 'Link名称を入力してください。'
                  : form.error === 'type'
                    ? 'Link種別を選択してください。'
                    : form.error === 'url'
                      ? 'http または https のURLを入力してください。'
                      : 'Linkを保存できませんでした。入力内容を保持しています。もう一度お試しください。'}
              </p>
            ) : null}
            {form.successNotice ? (
              <p className="pt-success-notice" role="status">
                関連リンクを登録しました。
              </p>
            ) : null}
            <button
              className="pt-button pt-button--primary pt-run-link-submit"
              disabled={form.status === 'submitting'}
            >
              {form.status === 'submitting' ? '保存中...' : '関連リンクを登録'}
            </button>
          </form>
          {links.length > 0 ? (
            <ul className="pt-link-list">
              {links.map((link) => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.title?.trim() || link.url}
                  </a>
                  {link.title?.trim() ? (
                    <span className="pt-link-list__url">{link.url}</span>
                  ) : null}
                  <span>
                    {LINK_TYPE_LABELS[link.type]} / {link.createdAt}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
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

const SELECTABLE_LINK_TYPES: readonly SelectableLinkType[] = [
  'chat',
  'issue',
  'pull-request',
  'commit',
  'release',
  'document',
];

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  chat: 'Chat',
  issue: 'Issue',
  'pull-request': 'Pull Request',
  commit: 'Commit',
  release: 'Release',
  document: 'Document',
  external: 'その他',
};
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
