import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { UserProvider } from './context/UserContext';
import { AppLayout } from './layout/AppLayout';
import { JoinTeamModal } from './components/JoinTeamModal';
import { DashboardPage } from './pages/DashboardPage';
import { EventWorkspacePage } from './pages/EventWorkspacePage';
import { TeamPage } from './pages/TeamPage';
import { TaskTemplatesPage } from './pages/TaskTemplatesPage';
import { OrgTemplatesPage } from './pages/OrgTemplatesPage';
import { VendorPortalPage } from './pages/VendorPortalPage';
import { PerDiemFormPage } from './pages/PerDiemFormPage';
import { TransferListPage } from './pages/TransferListPage';
import { AVEquipmentPage } from './pages/AVEquipmentPage';
import { ServiceReportPage } from './pages/ServiceReportPage';
import { GeneratorsPage } from './pages/GeneratorsPage';
import { SOWGeneratorPage } from './pages/SOWGeneratorPage';
import { DesignsPage } from './pages/DesignsPage';
import { DesignWorkspacePage } from './pages/DesignWorkspacePage';
import { AdminPanelPage } from './pages/AdminPanelPage';
import { CalendarPage } from './pages/CalendarPage';
import { ReportsPage } from './pages/ReportsPage';

// Must match VITE_BASE_URL so client-side routing works on GitHub Pages
const basename = import.meta.env.BASE_URL ?? '/';

export default function App() {
  return (
    <AppErrorBoundary>
    <UserProvider>
      <BrowserRouter basename={basename}>
        <JoinTeamModal />
        <Routes>
          <Route path="/vendor/:token" element={<VendorPortalPage />} />
          <Route path="/per-diem-form" element={<PerDiemFormPage />} />
          <Route path="/transfer-list" element={<TransferListPage />} />
          <Route path="/av-equipment" element={<AVEquipmentPage />} />
          <Route path="/service-report" element={<ServiceReportPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="event/:eventCode" element={<EventWorkspacePage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="tasks" element={<TaskTemplatesPage />} />
            <Route path="templates" element={<OrgTemplatesPage />} />
            <Route path="designs" element={<DesignsPage />} />
            <Route path="designs/:eventCode" element={<DesignWorkspacePage />} />
            <Route path="generators" element={<GeneratorsPage />} />
            <Route path="sow-generator" element={<SOWGeneratorPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="admin" element={<AdminPanelPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </UserProvider>
    </AppErrorBoundary>
  );
}
