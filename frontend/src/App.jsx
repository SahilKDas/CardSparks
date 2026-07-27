import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import CreateDeck from './pages/CreateDeck'
import Dashboard from './pages/Dashboard'
import DeckDetail from './pages/DeckDetail'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Study from './pages/Study'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="decks/new" element={<CreateDeck />} />
        <Route path="decks/:deckId" element={<DeckDetail />} />
        <Route path="decks/:deckId/study" element={<Study />} />
        <Route path="login" element={<Login mode="login" />} />
        <Route path="signup" element={<Login mode="signup" />} />
        <Route path="404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  )
}

