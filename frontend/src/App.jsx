import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import CreateDeck from './pages/CreateDeck'
import Dashboard from './pages/Dashboard'
import DeckDetail from './pages/DeckDetail'
import Landing from './pages/Landing'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Stats from './pages/Stats'
import Study from './pages/Study'
import Community from './pages/Community'
import SharedDeck from './pages/SharedDeck'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="login" element={<Login mode="login" />} />
        <Route path="signup" element={<Login mode="signup" />} />
        <Route path="shared/:token" element={<SharedDeck />} />
        <Route element={<ProtectedRoute />}>
          <Route path="decks" element={<Dashboard />} />
          <Route path="stats" element={<Stats />} />
          <Route path="community" element={<Community />} />
          <Route path="settings" element={<Settings />} />
          <Route path="decks/new" element={<CreateDeck />} />
          <Route path="decks/:deckId" element={<DeckDetail />} />
          <Route path="decks/:deckId/study" element={<Study />} />
        </Route>
        <Route path="404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  )
}
