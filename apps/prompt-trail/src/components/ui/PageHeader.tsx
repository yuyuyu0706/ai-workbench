import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="pt-page-header">
      <div className="pt-page-header__content">
        {eyebrow === undefined ? null : (
          <p className="pt-page-header__eyebrow">{eyebrow}</p>
        )}
        <h1 className="pt-page-header__title">{title}</h1>
        {description === undefined ? null : (
          <p className="pt-page-header__description">{description}</p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="pt-page-header__actions">{actions}</div>
      )}
    </header>
  );
}
