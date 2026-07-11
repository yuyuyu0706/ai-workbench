import { useId, type ReactNode } from 'react';

export interface PageSectionProps {
  title: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageSection({
  title,
  eyebrow,
  description,
  actions,
  children,
}: PageSectionProps) {
  const titleId = useId();

  return (
    <section className="pt-card pt-page-section" aria-labelledby={titleId}>
      <div className="pt-page-section__header">
        <div className="pt-page-section__content">
          {eyebrow === undefined ? null : (
            <p className="pt-page-section__eyebrow">{eyebrow}</p>
          )}
          <h2 className="pt-page-section__title" id={titleId}>
            {title}
          </h2>
          {description === undefined ? null : (
            <p className="pt-page-section__description">{description}</p>
          )}
        </div>
        {actions === undefined ? null : (
          <div className="pt-page-section__actions">{actions}</div>
        )}
      </div>
      <div className="pt-page-section__body">{children}</div>
    </section>
  );
}
