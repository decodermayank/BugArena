import { useCallback, useEffect, useRef, useState } from 'react';
import { WS_URL } from '../config';
import type {
  AssignedRole,
  BugCategory,
  ClientEvent,
  PlayerSlot,
  PlayerState,
  RequestedRole,
  RoomState,
  ServerMessage,
} from '../types';

function getClientId(): string {
  const key = 'bugarena_client_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = 'c_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(4);
    sessionStorage.setItem(key, id);
  }
  return id;
}

interface Options {
  roomCode: string;
  role: RequestedRole;
  nickname?: string;
}

export function useWebSocket({ roomCode, role, nickname = '' }: Options) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [receivedAt, setReceivedAt] = useState<number>(Date.now());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const socketRef = useRef<WebSocket | null>(null);
  const clientId = useRef(getClientId()).current;

  useEffect(() => {
    if (!roomCode) return;
    let unmounted = false;
    let fatal = false;
    let delay = 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (unmounted || fatal) return;
      const url = `${WS_URL}/ws/${roomCode.toUpperCase()}/${clientId}?role=${role}&name=${encodeURIComponent(nickname)}`;
      const ws = new WebSocket(url);
      socketRef.current = ws;
      ws.onopen = () => {
        if (unmounted) return;
        setIsConnected(true);
        setError(null);
        delay = 1000;
      };
      ws.onmessage = (ev) => {
        if (unmounted) return;
        try {
          const data = JSON.parse(ev.data as string) as ServerMessage;
          if (data.type === 'ROOM_STATE') {
            setRoomState(data);
            setReceivedAt(Date.now());
          } else if (data.type === 'ERROR') {
            fatal = true;
            setError(data.message);
          }
        } catch (e) {
          console.error('Bad WS message', e);
        }
      };
      ws.onclose = () => {
        if (unmounted) return;
        setIsConnected(false);
        if (fatal) return;
        timer = setTimeout(() => {
          delay = Math.min(delay * 1.5, 5000);
          connect();
        }, delay);
      };
    };

    connect();
    return () => {
      unmounted = true;
      if (timer) clearTimeout(timer);
      socketRef.current?.close();
    };
  }, [roomCode, role, nickname, clientId]);

  // Local 4Hz tick so countdowns are smooth between server broadcasts
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const send = useCallback((ev: ClientEvent) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(ev));
  }, []);

  const myPlayerIndex = roomState ? roomState.players.findIndex((p) => p.id === clientId) : -1;
  const myPlayer: PlayerState | null = myPlayerIndex >= 0 && roomState ? roomState.players[myPlayerIndex] : null;
  const mySlot: PlayerSlot | null = myPlayerIndex >= 0 ? (`player_${myPlayerIndex + 1}` as PlayerSlot) : null;
  const opponent: PlayerState | null =
    roomState && myPlayerIndex >= 0 ? roomState.players[myPlayerIndex === 0 ? 1 : 0] ?? null : null;

  const assignedRole: AssignedRole | null = !roomState
    ? null
    : role === 'projector'
      ? 'projector'
      : myPlayer
        ? 'player'
        : 'spectator';

  let secondsLeft = roomState?.remaining_seconds ?? 180;
  if (roomState && roomState.status === 'ACTIVE') {
    secondsLeft = Math.max(0, roomState.remaining_seconds - (now - receivedAt) / 1000);
  }

  return {
    roomState,
    isConnected,
    error,
    clientId,
    assignedRole,
    myPlayer,
    mySlot,
    opponent,
    secondsLeft: Math.ceil(secondsLeft),
    startMatch: () => send({ type: 'START_MATCH' }),
    startNextRound: () => send({ type: 'START_NEXT_ROUND' }),
    sendProgress: (passed: number, total: number, err: string | null) =>
      send({ type: 'PROGRESS_UPDATE', passed, total, error: err }),
    votePrediction: (target: PlayerSlot) => send({ type: 'SPECTATOR_VOTE', target }),
    guessBug: (category: BugCategory) => send({ type: 'BUG_GUESS', category }),
    voteNextBug: (category: BugCategory) => send({ type: 'NEXT_BUG_VOTE', category }),
  };
}

export type RoomSession = ReturnType<typeof useWebSocket>;

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
