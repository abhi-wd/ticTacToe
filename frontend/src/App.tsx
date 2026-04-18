import { Routes, Route, Navigate } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import MatchmakingScreen from './screens/MatchmakingScreen'
import GameScreen from './screens/GameScreen'
import { useGameStore } from './store/gameStore'
import { useEffect } from 'react'

// Wires up the socket match-data handler once, globally.
// Lives here so it's always mounted regardless of which screen is active.
function SocketProvider() {
  const { socket, applyServerMessage } = useGameStore()

  useEffect(() => {
    if (!socket) return
    socket.onmatchdata = applyServerMessage
    return () => { socket.onmatchdata = undefined as never }
  }, [socket, applyServerMessage])

  return null
}

export default function App() {
  return (
    <>
      <SocketProvider />
      <Routes>
        <Route path="/"            element={<HomeScreen />} />
        <Route path="/matchmaking" element={<MatchmakingScreen />} />
        <Route path="/game"        element={<GameScreen />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
