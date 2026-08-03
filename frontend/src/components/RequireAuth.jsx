import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

/**
 * Gate for every page behind the login. While the stored token is being
 * checked it renders a spinner rather than the login screen, so a signed-in
 * user reloading the page doesn't see a flash of "sign in".
 */
export default function RequireAuth({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, checking } = useAuth()
  const location = useLocation()

  if (checking) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label="Checking your session" />
      </div>
    )
  }

  if (!isAuthenticated) {
    // Remember where they were headed so signing in lands them there.
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/flags" replace />
  }

  return children
}
