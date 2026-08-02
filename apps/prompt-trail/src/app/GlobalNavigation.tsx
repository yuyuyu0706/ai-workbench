import { Link, useLocation } from 'react-router-dom';

import { getActiveNavigationItemId, globalNavigationItems } from './navigation';

export function GlobalNavigation() {
  const { pathname } = useLocation();
  const activeItemId = getActiveNavigationItemId(pathname);

  return (
    <nav className="global-navigation" aria-label="Global navigation">
      <ul className="global-navigation__list">
        {globalNavigationItems.map((item) => {
          const isActive = item.id === activeItemId;

          return (
            <li key={item.id}>
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={
                  isActive
                    ? 'global-navigation__link global-navigation__link--active'
                    : 'global-navigation__link'
                }
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
