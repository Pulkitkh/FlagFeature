import { Navigate, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import RequireAuth from './components/RequireAuth'
import { AuthProvider, useAuth } from './context/AuthContext'
import { EnvironmentProvider } from './context/EnvironmentContext'
import LoginPage from './pages/LoginPage'
import FlagsPage from './pages/FlagsPage'
import FlagDetailPage from './pages/FlagDetailPage'
import EnvironmentsPage from './pages/EnvironmentsPage'
import AuditLogPage from './pages/AuditLogPage'
import GroupsPage from './pages/GroupsPage'
import AccountsPage from './pages/AccountsPage'

/**
 * The signed-in shell. The environment provider lives inside the auth gate
 * because it calls the API immediately — mounting it before there's a token
 * would fire a guaranteed 401 on every page load.
 */
function Console() {
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
            <Route
              path="/accounts"
              element={
                <RequireAuth adminOnly>
                  <AccountsPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/flags" replace />} />
          </Routes>
        </div>
      </div>
    </EnvironmentProvider>
  )
}

function AppRoutes() {
  const { isAuthenticated, checking } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated && !checking ? <Navigate to="/flags" replace /> : <LoginPage />
        }
      />
      <Route
        path="*"
        element={
          <RequireAuth>
            <Console />
          </RequireAuth>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
