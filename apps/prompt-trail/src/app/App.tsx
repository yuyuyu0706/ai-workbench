import { BrowserRouter } from 'react-router-dom';

import { AppShell } from './AppShell';
import { AppRouter } from './router';
import { getRouterBasename } from './router-basename';

export function App() {
  return (
    <BrowserRouter basename={getRouterBasename(import.meta.env.BASE_URL)}>
      <AppShell>
        <AppRouter />
      </AppShell>
    </BrowserRouter>
  );
}
