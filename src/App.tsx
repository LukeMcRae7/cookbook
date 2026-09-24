import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ScrollToTop } from './components/ScrollToTop'
import { Home } from './pages/Home'
import { ImportLanding } from './pages/ImportLanding'
import { Recipes } from './pages/Recipes'
import { RecipeDetails } from './pages/RecipeDetails'
import { RecipeEdit } from './pages/RecipeEdit'
import { Settings } from './pages/Settings'
import { RecipeStoreProvider } from './state/RecipeStore'
import { TimerStoreProvider } from './state/TimerStore'

/**
 * Hash routing on purpose: GitHub Pages serves static files only, so a deep
 * link like /recipes/abc would 404 on refresh under BrowserRouter. Hash routes
 * work at any subpath with no 404.html trick and no server config.
 */
export function App() {
  return (
    <RecipeStoreProvider>
      <TimerStoreProvider>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <AppShell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/import" element={<ImportLanding />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/recipes/:id" element={<RecipeDetails />} />
              <Route path="/recipes/:id/edit" element={<RecipeEdit />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </HashRouter>
      </TimerStoreProvider>
    </RecipeStoreProvider>
  )
}
