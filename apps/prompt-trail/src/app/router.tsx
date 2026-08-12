import { Route, Routes } from 'react-router-dom';

import { ContextLibraryPage } from '../pages/ContextLibraryPage';
import { DashboardPage } from '../pages/DashboardPage';
import { NewTrailPage } from '../pages/NewTrailPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PromptLibraryPage } from '../pages/PromptLibraryPage';
import { PromptEditorPage } from '../pages/PromptEditorPage';
import { RecipeBuilderPage } from '../pages/RecipeBuilderPage';
import { RunDetailPage } from '../pages/RunDetailPage';
import { RunListPage } from '../pages/RunListPage';
import { WelcomePage } from '../pages/WelcomePage';
import { routeIds, routePaths } from './routes';

export function AppRouter() {
  return (
    <Routes>
      <Route path={routePaths[routeIds.root]} element={<WelcomePage />} />
      <Route
        path={routePaths[routeIds.dashboard]}
        element={<DashboardPage />}
      />
      <Route
        path={routePaths[routeIds.promptLibrary]}
        element={<PromptLibraryPage />}
      />
      <Route
        path={routePaths[routeIds.promptNew]}
        element={<PromptEditorPage mode="create" />}
      />
      <Route
        path={routePaths[routeIds.promptEdit]}
        element={<PromptEditorPage mode="edit" />}
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
      <Route path={routePaths[routeIds.runList]} element={<RunListPage />} />
      <Route
        path={routePaths[routeIds.runDetail]}
        element={<RunDetailPage />}
      />
      <Route path={routePaths[routeIds.notFound]} element={<NotFoundPage />} />
    </Routes>
  );
}
