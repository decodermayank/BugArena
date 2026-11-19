import { useState, useEffect, useRef, useCallback } from 'react';

// Generates or retrieves a persistent client id for this browser session/tab
function getOrCreateClientId() {
  const storageKey = 'codeduel_client_id';
  let id = sessionStorage.getItem(storageKey);
  if (!id) {
    id = 'c_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
    sessionStorage.setItem(storageKey, id);
  }
  return id;
}

export function useWebSocket({ roomCode, role = 'spectator', nickname = 'Challenger' }) {
  const [roomState, setRoomState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [assignedRole, setAssignedRole] = useState(role);
  const [playerIndex, setPlayerIndex] = useState(null);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const clientId = useRef(getOrCreateClientId()).current;

  // Track assigned player index from roomState whenever it updates
  useEffect(() => {
    if (roomState && roomState.players) {
      const idx = roomState.players.findIndex((p) => p.id === clientId);
      if (idx !== -1) {
        setPlayerIndex(`player_${idx + 1}`);
        setAssignedRole('player');
      } else if (role === 'player' && roomState.players.length >= 2) {
        // If joined as player but not in players array and room full, auto-assigned to spectator
        setAssignedRole('spectator');
        setPlayerIndex(null);
      }
    }
  }, [roomState, clientId, role]);

  useEffect(() => {
    if (!roomCode) return;

    let isUnmounted = false;
    let reconnectDelay = 1000;

    function connect() {
      if (isUnmounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In local dev, backend runs on port 8000
      const host = window.location.hostname || 'localhost';
      const backendPort = import.meta.env.VITE_BACKEND_PORT || '8000';
      const wsUrl = `${protocol}//${host}:${backendPort}/ws/${roomCode.toUpperCase()}/${clientId}?role=${role}&name=${encodeURIComponent(nickname)}`;

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setIsConnected(true);
          setError(null);
          reconnectDelay = 1000;
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ROOM_STATE') {
              setRoomState(data);
            } else if (data.type === 'ERROR') {
              setError(data.message);
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onerror = (e) => {
          if (isUnmounted) return;
          console.warn('WebSocket encountered error:', e);
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setIsConnected(false);
          // Auto-reconnect with exponential backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 1.5, 5000);
            connect();
          }, reconnectDelay);
        };
      } catch (err) {
        if (!isUnmounted) {
          setError(err.message);
        }
      }
    }

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [roomCode, role, nickname, clientId]);

  const sendEvent = useCallback((eventData) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(eventData));
    }
  }, []);

  const startMatch = useCallback(() => {
    sendEvent({ type: 'START_MATCH' });
  }, [sendEvent]);

  const sendProgress = useCallback(
    (passed, total, err = null) => {
      sendEvent({
        type: 'PROGRESS_UPDATE',
        passed,
        total,
        error: err,
      });
    },
    [sendEvent]
  );

  const submitWin = useCallback(
    (code, passed, total) => {
      sendEvent({
        type: 'SUBMIT_WIN',
        code,
        passed,
        total,
      });
    },
    [sendEvent]
  );

  const votePrediction = useCallback(
    (target) => {
      sendEvent({
        type: 'SPECTATOR_VOTE',
        target,
      });
    },
    [sendEvent]
  );

  const voteNextBug = useCallback(
    (category) => {
      sendEvent({
        type: 'NEXT_BUG_VOTE',
        category,
      });
    },
    [sendEvent]
  );

  const startNextRound = useCallback(() => {
    sendEvent({ type: 'START_NEXT_ROUND' });
  }, [sendEvent]);

  const myPlayer = roomState?.players?.find((p) => p.id === clientId) || null;
  const opponentPlayer = roomState?.players?.find((p) => p.id !== clientId) || null;

  return {
    roomState,
    isConnected,
    error,
    assignedRole,
    playerIndex,
    clientId,
    myPlayer,
    opponentPlayer,
    startMatch,
    sendProgress,
    submitWin,
    votePrediction,
    voteNextBug,
    startNextRound,
  };
}
