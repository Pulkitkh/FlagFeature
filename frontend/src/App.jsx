import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import SkipLink from './components/SkipLink'
import RequireAuth from './components/RequireAuth'
import { AuthProvider, useAuth } from './context/AuthContext'
import { EnvironmentProvider } from './context/EnvironmentContext'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import FlagsPage from './pages/FlagsPage'
import FlagDetailPage from './pages/FlagDetailPage'
import EnvironmentsPage from './pages/EnvironmentsPage'
import AuditLogPage from './pages/AuditLogPage'
import CleanupPage from './pages/CleanupPage'
import GroupsPage from './pages/GroupsPage'
import AccountsPage from './pages/AccountsPage'

/**
 * The signed-in shell. The environment provider lives inside the auth gate
 * because it calls the API immediately — mounting it before there's a token
 * would fire a guaranteed 401 on every page load.
 */
function Console() {
  const location = useLocation()

  return (
    <EnvironmentProvider>
      <SkipLink />
      <div className="h-screen-dvh flex w-full overflow-hidden">
        <Sidebar />
        {/*
          Keyed on the path so React tears down and rebuilds on navigation,
          which is what re-triggers the entrance animation — without the key
          the element persists and a route change happens with no transition
          at all. `id` is the skip link's destination.
        */}
        <main
          id="main-content"
          key={location.pathname}
          className="flex flex-1 animate-page-in flex-col overflow-hidden"
        >
          <Routes>
            <Route path="/flags" element={<FlagsPage />} />
            <Route path="/flags/:key" element={<FlagDetailPage />} />
            <Route path="/environments" element={<EnvironmentsPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/cleanup" element={<CleanupPage />} />
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
        </main>
      </div>
    </EnvironmentProvider>
  )
}

function AppRoutes() {
  const { isAuthenticated, checking } = useAuth()

  return (
    <Routes>
      {/* Public. The landing page is the front door and stays reachable when
          signed in — it just points at the console instead of the login form. */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={isAuthenticated && !checking ? <Navigate to="/flags" replace /> : <LoginPage />}
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
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
