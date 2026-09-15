import { Link as RouterLink } from 'react-router-dom';
import { buildNewTrailReusePath } from '../../app/routes';
import type { RunId } from '../../domain';

/**
 * Presentation-only Prompt display panel, shared by the "Prompt Snapshot"
 * (Run exists) and "Prompt" (no Run yet) cases via the `heading` prop. State
 * is owned by the caller (`TrailStepRow`); this component only renders and
 * notifies via `onClose`.
 */
export function PromptPanel({
  heading,
  title,
  body,
  onClose,
  reuseRunId,
}: {
  heading: string;
  title: string;
  body: string;
  onClose: () => void;
  reuseRunId?: RunId;
}) {
  return (
    <>
      <div className="pt-run-popover__header">
        <div className="pt-run-popover__header-title">
          <h3>{heading}</h3>
          {reuseRunId !== undefined ? (
            <RouterLink
              className="pt-run-popover__reuse-link"
              to={buildNewTrailReusePath(reuseRunId)}
              aria-label="このPromptを再利用"
              title="このPromptを再利用"
            >
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                <rect x="8" y="8" width="11" height="11" rx="2" />
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
              </svg>
            </RouterLink>
          ) : null}
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
      <h4>{title}</h4>
      <pre className="pt-snapshot">{body}</pre>
    </>
  );
}
