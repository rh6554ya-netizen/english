import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { PwaProvider } from './lib/pwa';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { DialogueStudioPage } from './pages/DialogueStudioPage';
import { LoopPlayerPage } from './pages/LoopPlayerPage';
import { QuickDrillPage } from './pages/QuickDrillPage';
import { PatternsPage } from './pages/PatternsPage';
import { SurvivalPage } from './pages/SurvivalPage';
import { SrsVaultPage } from './pages/SrsVaultPage';
import { AdminPage } from './pages/AdminPage';

const useHashRouter = import.meta.env.VITE_USE_HASH_ROUTER === 'true';

export default function App() {
  const Router = useHashRouter ? HashRouter : BrowserRouter;
  return (
    <PwaProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/scenarios" element={<ScenariosPage />} />
              <Route path="/studio/:slug" element={<DialogueStudioPage />} />
              <Route path="/loop-player" element={<LoopPlayerPage />} />
              <Route path="/quick-drill" element={<QuickDrillPage />} />
              <Route path="/patterns" element={<PatternsPage />} />
              <Route path="/survival" element={<SurvivalPage />} />
              <Route path="/srs" element={<SrsVaultPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </PwaProvider>
  );
}
