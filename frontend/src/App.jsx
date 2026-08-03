import { Navigate, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import { EnvironmentProvider } from './context/EnvironmentContext'
import FlagsPage from './pages/FlagsPage'
import FlagDetailPage from './pages/FlagDetailPage'
import EnvironmentsPage from './pages/EnvironmentsPage'
import AuditLogPage from './pages/AuditLogPage'
import GroupsPage from './pages/GroupsPage'

export default function App() {
  return (
    <EnvironmentProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-transparent">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/flags" replace />} />
            <Route path="/flags" element={<FlagsPage />} />
            <Route path="/flags/:key" element={<FlagDetailPage />} />
            <Route path="/environments" element={<EnvironmentsPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="*" element={<Navigate to="/flags" replace />} />
          </Routes>
        </div>
      </div>
    </EnvironmentProvider>
  )
}
