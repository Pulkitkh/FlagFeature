import { Navigate, Route, Routes } from 'react-router-dom'
import { EnvironmentProvider } from './context/EnvironmentContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import AuditLogPage from './pages/AuditLogPage'
import DashboardPage from './pages/DashboardPage'
import EnvironmentsPage from './pages/EnvironmentsPage'
import FlagDetailPage from './pages/FlagDetailPage'
import FlagsPage from './pages/FlagsPage'
import GroupsPage from './pages/GroupsPage'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <EnvironmentProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/flags" element={<FlagsPage />} />
            <Route path="/flags/:key" element={<FlagDetailPage />} />
            <Route path="/environments" element={<EnvironmentsPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </EnvironmentProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
