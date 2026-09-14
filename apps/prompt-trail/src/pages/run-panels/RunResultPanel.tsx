import type { RefObject } from 'react';
import type { Run } from '../../domain';

/**
 * Presentation-only execution-result panel: conversation history plus the
 * message-send form. State (`messageDraft`, `sendStatus`, `executeStatus`)
 * is owned by the caller (`TrailStepRow`).
 */
export function RunResultPanel({
  run,
  executeStatus,
  sendStatus,
  messageDraft,
  onMessageDraftChange,
  onSendMessage,
  messageTextareaRef,
  onClose,
}: {
  run: Run;
  executeStatus: 'idle' | 'running' | 'failure';
  sendStatus: 'idle' | 'sending' | 'failure';
  messageDraft: string;
  onMessageDraftChange: (value: string) => void;
  onSendMessage: (event: React.FormEvent) => void;
  messageTextareaRef: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
}) {
  return (
    <>
      <div className="pt-run-popover__header">
        <h3>実行結果</h3>
        <button
          type="button"
          className="pt-run-popover__close"
          aria-label="閉じる"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {executeStatus === 'failure' ? (
        <p className="pt-form__error" role="alert">
          実行に失敗しました。もう一度お試しください。
        </p>
      ) : null}
      <div className="pt-run-conversation-scroll">
        {run.messages.length === 0 ? (
          <p className="pt-run-popover__empty">まだ実行されていません</p>
        ) : (
          <div className="pt-run-conversation">
            {run.messages.map((message, index) => (
              <p
                key={index}
                className={
                  message.role === 'user'
                    ? 'pt-run-conversation__message pt-run-conversation__message--user'
                    : 'pt-run-conversation__message pt-run-conversation__message--assistant'
                }
              >
                {message.content}
              </p>
            ))}
          </div>
        )}
      </div>
      <form className="pt-run-conversation-form" onSubmit={onSendMessage}>
        <div className="pt-run-conversation-form__row">
          <label htmlFor={`run-message-${run.id}`} className="pt-sr-only">
            メッセージ
          </label>
          <textarea
            ref={messageTextareaRef}
            id={`run-message-${run.id}`}
            rows={1}
            value={messageDraft}
            onChange={(e) => onMessageDraftChange(e.target.value)}
            disabled={sendStatus === 'sending'}
          />
          <button
            className="pt-run-conversation-form__send ti-arrow-up"
            type="submit"
            aria-label="送信"
            disabled={
              sendStatus === 'sending' || messageDraft.trim().length === 0
            }
          >
            {sendStatus === 'sending' ? (
              <span className="pt-run-actions__spinner" aria-hidden="true" />
            ) : (
              <ArrowUpIcon />
            )}
          </button>
        </div>
        {sendStatus === 'failure' ? (
          <p className="pt-form__error" role="alert">
            送信できませんでした。もう一度お試しください。
          </p>
        ) : null}
      </form>
    </>
  );
}

function ArrowUpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 19V6M6 11l6-6 6 6" />
    </svg>
  );
}
