import { type MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useNavigationGuard } from './NavigationGuardContext';
import { getActiveNavigationItemId, globalNavigationItems } from './navigation';

export function GlobalNavigation() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const guard = useNavigationGuard();
  const activeItemId = getActiveNavigationItemId(pathname);
  const locked = guard.dirty || guard.saving;

  const guardNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    path: string,
  ) => {
    if (!locked) return;
    event.preventDefault();
    if (guard.saving) return;
    if (guard.dirty && guard.requestDiscard !== null) {
      guard.requestDiscard(() => navigate(path));
    }
  };

  return (
    <nav className="global-navigation" aria-label="Global navigation">
      <ul className="global-navigation__list">
        {globalNavigationItems.map((item) => {
          const isActive = item.id === activeItemId;

          return (
            <li key={item.id}>
              <Link
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={guard.saving}
                className={
                  isActive
                    ? 'global-navigation__link global-navigation__link--active'
                    : 'global-navigation__link'
                }
                onClick={(event) => guardNavigation(event, item.path)}
                to={item.path}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
