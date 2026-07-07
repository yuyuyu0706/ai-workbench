import type { ReactNode } from 'react';

export type StateMessageVariant = 'loading' | 'empty' | 'error';

const labels: Record<StateMessageVariant, string> = {
  loading: 'Loading',
  empty: 'Empty',
  error: 'Error',
};

export interface StateMessageProps {
  variant: StateMessageVariant;
  title: ReactNode;
  description?: ReactNode;
}

export function StateMessage({
  variant,
  title,
  description,
}: StateMessageProps) {
  const liveRegionProps =
    variant === 'loading'
      ? ({ role: 'status', 'aria-live': 'polite' } as const)
      : variant === 'error'
        ? ({ role: 'alert' } as const)
        : {};

  return (
    <div
      className={`pt-card pt-state-message pt-state-message--${variant}`}
      {...liveRegionProps}
    >
      <p className="pt-state-message__eyebrow">{labels[variant]}</p>
      <p className="pt-state-message__title">{title}</p>
      {description === undefined ? null : (
        <p className="pt-state-message__description">{description}</p>
      )}
    </div>
  );
}
