import { BrowserRouter } from 'react-router-dom';

import { AppShell } from './AppShell';
import { AppRouter } from './router';

export function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <AppRouter />
      </AppShell>
    </BrowserRouter>
  );
}
