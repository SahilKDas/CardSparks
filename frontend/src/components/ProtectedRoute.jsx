import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../context/useApp'

export function ProtectedRoute() {
  const { isAuthenticated } = useApp()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
