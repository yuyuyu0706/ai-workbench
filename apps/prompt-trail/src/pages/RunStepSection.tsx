import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildNewTrailReusePath } from '../app/routes';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageSection } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import type { LinkId, LinkType, UtcDateTimeString } from '../domain';
import { RunStatusPin } from '../run-status';
import {
  createRunLink,
  type SelectableLinkType,
} from '../trail-creation/create-run-link';
import type { TrailDetailRunItem } from '../trail-detail/trail-detail-read-query';
import { formatDateTime } from './date-time';

export function RunStepSection({
  run: runItem,
  onLinkChanged,
}: {
  run: TrailDetailRunItem;
  onLinkChanged: () => void;
}) {
  const repository = usePromptTrailRepository();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const { run, project, recipe } = runItem;
  const linkInformationId = useId();
  const linkInformationRef = useRef<HTMLDivElement>(null);
  const linkInformationButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRefs = useRef(new Map<LinkId, HTMLButtonElement>());
  const [isLinkInformationOpen, setIsLinkInformationOpen] = useState(false);
  const [linksSnapshot, setLinksSnapshot] = useState({
    source: runItem.links,
    links: runItem.links,
  });
  if (linksSnapshot.source !== runItem.links) {
    setLinksSnapshot({ source: runItem.links, links: runItem.links });
  }
  const links = linksSnapshot.links;
  function setLinks(updater: (current: typeof links) => typeof links) {
    setLinksSnapshot((current) => ({
      ...current,
      links: updater(current.links),
    }));
  }
  const [formSnapshot, setFormSnapshot] = useState({
    title: '',
    url: '',
    type: '' as SelectableLinkType | '',
    status: 'idle' as 'idle' | 'submitting' | 'failure',
    error: null as 'title' | 'url' | 'type' | 'save' | null,
    successNotice: false,
  });
  const [deleteSnapshot, setDeleteSnapshot] = useState({
    linkId: null as LinkId | null,
    status: 'idle' as 'idle' | 'deleting' | 'failure',
    successNotice: false,
  });

  const formOverride = selectActiveDeveloperUiState(
    uiStateSnapshot,
    'run-detail-link-form',
  );
  const displayedFormStatus =
    formOverride === 'submitting'
      ? 'submitting'
      : formOverride === 'save-failure'
        ? 'failure'
        : formSnapshot.status;
  const deleteOverride =
    links.length > 0
      ? selectActiveDeveloperUiState(uiStateSnapshot, 'run-detail-link-delete')
      : null;
  const overrideDeleteLinkId = deleteOverride
    ? links.some((link) => link.id === deleteSnapshot.linkId)
      ? deleteSnapshot.linkId
      : links[0]?.id
    : null;

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

  useEffect(() => {
    if (
      deleteOverride !== null ||
      deleteSnapshot.linkId === null ||
      deleteSnapshot.status === 'deleting'
    )
      return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || deleteSnapshot.linkId === null) return;
      const button = deleteButtonRefs.current.get(deleteSnapshot.linkId);
      setDeleteSnapshot({ linkId: null, status: 'idle', successNotice: false });
      requestAnimationFrame(() => button?.focus());
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteOverride, deleteSnapshot.linkId, deleteSnapshot.status]);

  function cancelDelete(linkId: LinkId) {
    if (deleteOverride !== null) return;
    const button = deleteButtonRefs.current.get(linkId);
    setDeleteSnapshot({ linkId: null, status: 'idle', successNotice: false });
    requestAnimationFrame(() => button?.focus());
  }

  async function deleteLink(linkId: LinkId) {
    if (deleteOverride !== null || deleteSnapshot.status === 'deleting')
      return;
    setDeleteSnapshot({ linkId, status: 'deleting', successNotice: false });
    try {
      await repository.softDeleteLink(
        run.id,
        linkId,
        new Date().toISOString() as UtcDateTimeString,
      );
      setLinks((current) => current.filter((link) => link.id !== linkId));
      setDeleteSnapshot((current) =>
        current.linkId === linkId && current.status === 'deleting'
          ? { linkId: null, status: 'idle', successNotice: true }
          : current,
      );
      onLinkChanged();
    } catch {
      setDeleteSnapshot((current) =>
        current.linkId === linkId && current.status === 'deleting'
          ? { ...current, status: 'failure', successNotice: false }
          : current,
      );
    }
  }

  async function saveLink(event: React.FormEvent) {
    event.preventDefault();
    if (formOverride !== null || formSnapshot.status === 'submitting') return;
    const title = formSnapshot.title.trim();
    if (title.length === 0) {
      setFormSnapshot({
        ...formSnapshot,
        status: 'failure',
        error: 'title',
        successNotice: false,
      });
      return;
    }
    let url: string;
    try {
      const parsed = new URL(formSnapshot.url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      url = parsed.toString();
    } catch {
      setFormSnapshot((current) => ({
        ...current,
        status: 'failure',
        error: 'url',
        successNotice: false,
      }));
      return;
    }
    if (formSnapshot.type === '') {
      setFormSnapshot({
        ...formSnapshot,
        status: 'failure',
        error: 'type',
        successNotice: false,
      });
      return;
    }
    setFormSnapshot((current) => ({
      ...current,
      status: 'submitting',
      error: null,
      successNotice: false,
    }));
    try {
      const link = await repository.saveLink(
        createRunLink({
          runId: run.id,
          title,
          url,
          type: formSnapshot.type,
        }),
      );
      setLinks((current) => [...current, link]);
      setFormSnapshot({
        title: '',
        url: '',
        type: '',
        status: 'idle',
        error: null,
        successNotice: true,
      });
      onLinkChanged();
    } catch {
      setFormSnapshot((current) => ({
        ...current,
        status: 'failure',
        error: 'save',
        successNotice: false,
      }));
    }
  }

  return (
    <>
      <PageSection title="実行サマリ">
        <dl className="pt-detail-list">
          <div>
            <dt>Project</dt>
            <dd>{project.name}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <RunStatusPin status={run.status} />
            </dd>
          </div>
          <div>
            <dt>種類</dt>
            <dd>{recipe === null ? 'Direct Prompt' : 'Recipe'}</dd>
          </div>
          <div>
            <dt>Created At</dt>
            <dd>
              <time dateTime={run.createdAt}>
                {formatDateTime(run.createdAt, { includeSeconds: true })}
              </time>
            </dd>
          </div>
          <div>
            <dt>Updated At</dt>
            <dd>
              <time dateTime={run.updatedAt}>
                {formatDateTime(run.updatedAt, { includeSeconds: true })}
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
      <PageSection
        title="Prompt"
        actions={
          <Link
            className="pt-button pt-button--secondary"
            to={buildNewTrailReusePath(run.id)}
          >
            このPromptを再利用
          </Link>
        }
      >
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
        titleAccessory={
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
          <label htmlFor={`link-title-${run.id}`}>Link名称</label>
          <input
            id={`link-title-${run.id}`}
            value={formSnapshot.title}
            onChange={(e) =>
              setFormSnapshot({
                ...formSnapshot,
                title: e.target.value,
                status: 'idle',
                error: null,
                successNotice: false,
              })
            }
            disabled={displayedFormStatus === 'submitting'}
          />
          <label htmlFor={`link-url-${run.id}`}>URL</label>
          <input
            id={`link-url-${run.id}`}
            type="url"
            value={formSnapshot.url}
            onChange={(e) =>
              setFormSnapshot({
                ...formSnapshot,
                url: e.target.value,
                status: 'idle',
                error: null,
                successNotice: false,
              })
            }
            disabled={displayedFormStatus === 'submitting'}
          />
          <label htmlFor={`link-type-${run.id}`}>Link種別</label>
          <select
            id={`link-type-${run.id}`}
            value={formSnapshot.type}
            onChange={(e) =>
              setFormSnapshot({
                ...formSnapshot,
                type: e.target.value as typeof formSnapshot.type,
                status: 'idle',
                error: null,
                successNotice: false,
              })
            }
            disabled={displayedFormStatus === 'submitting'}
          >
            <option value="">選択してください</option>
            {SELECTABLE_LINK_TYPES.map((value) => (
              <option key={value} value={value}>
                {LINK_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
          {displayedFormStatus === 'failure' ? (
            <p className="pt-form__error">
              {formOverride === 'save-failure'
                ? 'Linkを保存できませんでした。入力内容を保持しています。もう一度お試しください。'
                : formSnapshot.error === 'title'
                  ? 'Link名称を入力してください。'
                  : formSnapshot.error === 'type'
                    ? 'Link種別を選択してください。'
                    : formSnapshot.error === 'url'
                      ? 'http または https のURLを入力してください。'
                      : 'Linkを保存できませんでした。入力内容を保持しています。もう一度お試しください。'}
            </p>
          ) : null}
          {formOverride === null && formSnapshot.successNotice ? (
            <p className="pt-success-notice" role="status">
              関連リンクを登録しました。
            </p>
          ) : null}
          <button
            className="pt-button pt-button--primary pt-run-link-submit"
            disabled={displayedFormStatus === 'submitting'}
          >
            {displayedFormStatus === 'submitting'
              ? '保存中...'
              : '関連リンクを登録'}
          </button>
        </form>
        {links.length > 0 ? (
          <ul className="pt-link-list">
            {links.map((link) => {
              const label = link.title?.trim() || link.url;
              const isConfirming = deleteOverride
                ? overrideDeleteLinkId === link.id
                : deleteSnapshot.linkId === link.id;
              const displayedDeleteStatus =
                deleteOverride && overrideDeleteLinkId === link.id
                  ? deleteOverride === 'confirming'
                    ? 'idle'
                    : deleteOverride === 'deleting'
                      ? 'deleting'
                      : 'failure'
                  : deleteSnapshot.status;
              return (
                <li key={link.id} className="pt-run-link-row">
                  <div className="pt-run-link-row__content">
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {label}
                    </a>
                    {link.title?.trim() ? (
                      <span className="pt-link-list__url">{link.url}</span>
                    ) : null}
                    <span>
                      {LINK_TYPE_LABELS[link.type]} / {link.createdAt}
                    </span>
                  </div>
                  <button
                    ref={(node) => {
                      if (node) deleteButtonRefs.current.set(link.id, node);
                      else deleteButtonRefs.current.delete(link.id);
                    }}
                    className="pt-run-link-row__delete"
                    type="button"
                    aria-label={`${label}を削除`}
                    onClick={() => {
                      if (deleteOverride !== null) return;
                      if (deleteSnapshot.status === 'deleting') return;
                      setDeleteSnapshot({
                        linkId: link.id,
                        status: 'idle',
                        successNotice: false,
                      });
                    }}
                    disabled={
                      deleteOverride !== null ||
                      displayedDeleteStatus === 'deleting'
                    }
                  >
                    削除
                  </button>
                  {isConfirming ? (
                    <div className="pt-run-link-confirmation">
                      <p>「{label}」を削除しますか？</p>
                      {displayedDeleteStatus === 'failure' ? (
                        <p className="pt-form__error">
                          関連リンクを削除できませんでした。もう一度お試しください。
                        </p>
                      ) : null}
                      <div className="pt-run-link-confirmation__actions">
                        <button
                          className="pt-button pt-button--primary"
                          type="button"
                          disabled={displayedDeleteStatus === 'deleting'}
                          onClick={() => void deleteLink(link.id)}
                        >
                          {displayedDeleteStatus === 'deleting'
                            ? '削除中...'
                            : '削除する'}
                        </button>
                        <button
                          className="pt-button pt-button--secondary"
                          type="button"
                          disabled={displayedDeleteStatus === 'deleting'}
                          onClick={() => cancelDelete(link.id)}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        {deleteOverride === null && deleteSnapshot.successNotice ? (
          <p className="pt-success-notice" role="status">
            関連リンクを削除しました。
          </p>
        ) : null}
      </PageSection>
    </>
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
