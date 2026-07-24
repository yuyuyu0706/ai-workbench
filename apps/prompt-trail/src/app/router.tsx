import { Navigate, Route, Routes } from 'react-router-dom';

import { ContextLibraryPage } from '../pages/ContextLibraryPage';
import { DashboardPage } from '../pages/DashboardPage';
import { NewTrailPage } from '../pages/NewTrailPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PromptLibraryPage } from '../pages/PromptLibraryPage';
import { RecipeBuilderPage } from '../pages/RecipeBuilderPage';
import { RunDetailPage } from '../pages/RunDetailPage';
import { routeIds, routePaths } from './routes';

export function AppRouter() {
  return (
    <Routes>
      <Route
        path={routePaths[routeIds.root]}
        element={<Navigate to={routePaths[routeIds.dashboard]} replace />}
      />
      <Route
        path={routePaths[routeIds.dashboard]}
        element={<DashboardPage />}
      />
      <Route
        path={routePaths[routeIds.promptLibrary]}
        element={<PromptLibraryPage />}
      />
      <Route
        path={routePaths[routeIds.contextLibrary]}
        element={<ContextLibraryPage />}
      />
      <Route
        path={routePaths[routeIds.recipeBuilder]}
        element={<RecipeBuilderPage />}
      />
      <Route path={routePaths[routeIds.newTrail]} element={<NewTrailPage />} />
      <Route
        path={routePaths[routeIds.runDetail]}
        element={<RunDetailPage />}
      />
      <Route path={routePaths[routeIds.notFound]} element={<NotFoundPage />} />
    </Routes>
  );
}
