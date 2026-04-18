/**
 * Thin wrapper around nakama.ts for use in React.
 * Keeps all Nakama SDK calls outside of components.
 */
import { v4 as uuidv4 } from 'uuid'
import { client, connectSocket } from '../nakama'
import { useGameStore } from '../store/gameStore'

/** Device-auth login. Persists device ID in localStorage. */
export async function login(displayName: string): Promise<void> {
  let deviceId = localStorage.getItem('ttt_device_id')
  if (!deviceId) {
    deviceId = uuidv4()
    localStorage.setItem('ttt_device_id', deviceId)
  }

  const session = await client.authenticateDevice(deviceId, true, displayName || 'Player')
  const socket  = await connectSocket(session)
  useGameStore.getState().setAuth(session, socket)
}

/** Adds player to Nakama matchmaker queue, stores ticket. */
export async function startMatchmaking(mode: 'classic' | 'timed' = 'classic'): Promise<string> {
  const { socket } = useGameStore.getState()
  if (!socket) throw new Error('Not connected')

  // Require opponent to have the same mode
  const query = `+properties.mode:${mode}`
  const stringProps = { mode }
  
  const result = await socket.addMatchmaker(query, 2, 2, stringProps)
  return result.ticket
}

/** Cancels the matchmaker ticket. */
export async function cancelMatchmaking(ticket: string): Promise<void> {
  const { socket } = useGameStore.getState()
  if (!socket) return
  await socket.removeMatchmaker(ticket)
}

/** Joins the match using the matchmaker token (the correct approach). */
export async function joinMatch(token: string | null, matchId: string): Promise<void> {
  const { socket } = useGameStore.getState()
  if (!socket) throw new Error('Not connected')

  if (token) {
    await socket.joinMatch('', token)
  } else if (matchId) {
    await socket.joinMatch(matchId)
  } else {
    throw new Error('No match token or ID')
  }
}

/** Leaves the current match cleanly. */
export async function leaveMatch(): Promise<void> {
  const { socket, matchId, reset } = useGameStore.getState()
  if (socket && matchId) {
    await socket.leaveMatch(matchId).catch(() => {})
  }
  reset()
}

export async function createPrivateRoom(): Promise<{ matchId: string, code: string }> {
  const { session } = useGameStore.getState()
  if (!session) throw new Error('Not connected')
  const res = await client.rpc(session, 'rpc_create_room', {})
  const data = typeof res.payload === 'string' ? JSON.parse(res.payload) : res.payload
  return data || { matchId: '', code: '' }
}

export async function joinPrivateRoom(code: string): Promise<string> {
  const { session } = useGameStore.getState()
  if (!session) throw new Error('Not connected')
  const res = await client.rpc(session, 'rpc_join_room', { code })
  const data = typeof res.payload === 'string' ? JSON.parse(res.payload) : res.payload
  return data?.matchId ?? ''
}

/** Fetch top-10 leaderboard records. */
export async function fetchLeaderboard() {
  const { session } = useGameStore.getState()
  if (!session) return []
  const res = await client.listLeaderboardRecords(session, 'tictactoe_wins', [], 10)
  return res.records ?? []
}
