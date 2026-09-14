import type { RefObject } from 'react';
import type { Link, LinkId, LinkType, RunId } from '../../domain';
import type { SelectableLinkType } from '../../trail-creation/create-run-link';

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

export type RunLinkFormSnapshot = {
  readonly title: string;
  readonly url: string;
  readonly type: SelectableLinkType | '';
  readonly status: 'idle' | 'submitting' | 'failure';
  readonly error: 'title' | 'url' | 'type' | 'save' | null;
  readonly successNotice: boolean;
};

export type RunLinkDeleteSnapshot = {
  readonly linkId: LinkId | null;
  readonly status: 'idle' | 'deleting' | 'failure';
  readonly successNotice: boolean;
};

/**
 * Presentation-only related-links panel: registration form, list, and
 * delete confirmation. State and the `run-detail-link-form` /
 * `run-detail-link-delete` developer-UI-state lookups stay in the caller
 * (`TrailStepRow`); this component only renders already-resolved values.
 */
export function RunLinksPanel({
  runId,
  links,
  isLinkInformationOpen,
  onToggleLinkInformation,
  linkInformationId,
  linkInformationRef,
  linkInformationButtonRef,
  formSnapshot,
  displayedFormStatus,
  formOverride,
  onFormFieldChange,
  onSaveLink,
  deleteButtonRefs,
  deleteSnapshot,
  deleteOverride,
  overrideDeleteLinkId,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
  onClose,
}: {
  runId: RunId;
  links: readonly Link[];
  isLinkInformationOpen: boolean;
  onToggleLinkInformation: () => void;
  linkInformationId: string;
  linkInformationRef: RefObject<HTMLDivElement | null>;
  linkInformationButtonRef: RefObject<HTMLButtonElement | null>;
  formSnapshot: RunLinkFormSnapshot;
  displayedFormStatus: 'idle' | 'submitting' | 'failure';
  formOverride: 'submitting' | 'save-failure' | null;
  onFormFieldChange: (
    field: 'title' | 'url' | 'type',
    value: string,
  ) => void;
  onSaveLink: (event: React.FormEvent) => void;
  deleteButtonRefs: RefObject<Map<LinkId, HTMLButtonElement>>;
  deleteSnapshot: RunLinkDeleteSnapshot;
  deleteOverride: 'confirming' | 'deleting' | 'delete-failure' | null;
  overrideDeleteLinkId: LinkId | null;
  onStartDelete: (linkId: LinkId) => void;
  onCancelDelete: (linkId: LinkId) => void;
  onConfirmDelete: (linkId: LinkId) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="pt-run-popover__header">
        <div className="pt-run-popover__header-title">
          <h3>関連リンク</h3>
          <div className="pt-run-link-information" ref={linkInformationRef}>
            <button
              ref={linkInformationButtonRef}
              className="pt-run-link-information__button"
              type="button"
              aria-label="関連リンクについて"
              aria-expanded={isLinkInformationOpen}
              aria-controls={linkInformationId}
              onClick={onToggleLinkInformation}
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
        </div>
        <button
          type="button"
          className="pt-run-popover__close"
          aria-label="閉じる"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <form className="pt-form" onSubmit={onSaveLink}>
        <label htmlFor={`link-title-${runId}`}>Link名称</label>
        <input
          id={`link-title-${runId}`}
          value={formSnapshot.title}
          onChange={(e) => onFormFieldChange('title', e.target.value)}
          disabled={displayedFormStatus === 'submitting'}
        />
        <label htmlFor={`link-url-${runId}`}>URL</label>
        <input
          id={`link-url-${runId}`}
          type="url"
          value={formSnapshot.url}
          onChange={(e) => onFormFieldChange('url', e.target.value)}
          disabled={displayedFormStatus === 'submitting'}
        />
        <label htmlFor={`link-type-${runId}`}>Link種別</label>
        <select
          id={`link-type-${runId}`}
          value={formSnapshot.type}
          onChange={(e) => onFormFieldChange('type', e.target.value)}
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
          {displayedFormStatus === 'submitting' ? '保存中...' : '関連リンクを登録'}
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
                  onClick={() => onStartDelete(link.id)}
                  disabled={
                    deleteOverride !== null || displayedDeleteStatus === 'deleting'
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
                        onClick={() => onConfirmDelete(link.id)}
                      >
                        {displayedDeleteStatus === 'deleting'
                          ? '削除中...'
                          : '削除する'}
                      </button>
                      <button
                        className="pt-button pt-button--secondary"
                        type="button"
                        disabled={displayedDeleteStatus === 'deleting'}
                        onClick={() => onCancelDelete(link.id)}
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
    </>
  );
}
