import { BrowserRouter, Route, Routes } from 'react-router-dom';
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

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
