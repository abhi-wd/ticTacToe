import { Client, Session } from "@heroiclabs/nakama-js";
import type { Socket } from "@heroiclabs/nakama-js";

const HOST = import.meta.env.VITE_NAKAMA_HOST || "localhost";
const PORT = Number(import.meta.env.VITE_NAKAMA_PORT) || 7350;
const USE_SSL = import.meta.env.VITE_NAKAMA_USE_SSL === "true";
const SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY || "defaultkey";

export const client = new Client(SERVER_KEY, HOST, PORT.toString(), USE_SSL);

let _socket: Socket | null = null;
let _session: Session | null = null;

export function getSocket(): Socket {
  if (!_socket) throw new Error("Socket not connected");
  return _socket;
}

export function getSession(): Session {
  if (!_session) throw new Error("No active session");
  return _session;
}

export function setSession(session: Session): void {
  _session = session;
}

export async function connectSocket(session: Session): Promise<Socket> {
  _session = session;
  if (_socket) {
    // Already connected, return existing
    return _socket;
  }
  const trace = false;
  _socket = client.createSocket(USE_SSL, trace);
  await _socket.connect(session, true);
  return _socket;
}

export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect(false);
    _socket = null;
  }
}
