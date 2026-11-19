import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { usePyodide } from '../hooks/usePyodide';
import { DoodleBug } from '../components/Doodles';
import EmoteJar from '../components/EmoteJar';
import type { CreateRoomResponse } from '../types';

type JoinRole = 'player' | 'spectator';

export default function Home() {
  const navigate = useNavigate();
  const engine = usePyodide();
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [joinRole, setJoinRole] = useState<JoinRole>('player');
  const [joinError, setJoinError] = useState('');
  const [hostError, setHostError] = useState('');
  const [busy, setBusy] = useState(false);

  const engineLabel =
    engine.status === 'ready' ? 'READY' : engine.status === 'loading' ? 'LOADING' : 'OFFLINE';

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError('INVALID CODE');
      return;
    }
    setBusy(true);
    setJoinError('');
    try {
      const res = await fetch(`${API_URL}/api/room/${code}`);
      if (res.status === 404) {
        setJoinError('INVALID CODE');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const name = encodeURIComponent(nickname.trim());
      navigate(joinRole === 'spectator' ? `/spectate/${code}?name=${name}` : `/join/${code}?name=${name}`);
    } catch {
      setJoinError('SERVER OFFLINE');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    setBusy(true);
    setHostError('');
    try {
      const res = await fetch(`${API_URL}/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as CreateRoomResponse;
      navigate(`/arena/${data.room_code}`);
    } catch {
      setHostError('SERVER OFFLINE');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col justify-between bg-[#FAFAFA] text-black">
      <EmoteJar floorOffset={40} />

      {/* Header */}
      <header className="relative z-10 shrink-0 w-full flex items-center justify-between px-8 py-4 border-b-[1.5px] border-black">
        <div className="flex items-center gap-3">
          <DoodleBug size={32} />
          <span className="font-heading font-extrabold text-2xl tracking-tight">BUGARENA</span>
        </div>
        <div className="flex items-center gap-2 border-[1.5px] border-black px-3 py-1.5 text-xs font-bold tracking-wider">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              engine.status === 'ready' ? 'bg-black' : 'border-[1.5px] border-black animate-pulse'
            }`}
          />
          WASM ENGINE: {engineLabel}
        </div>
      </header>

      {/* Body */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-3 gap-4 sm:gap-6">
        <div className="text-center">
          <h1 className="font-heading font-extrabold text-5xl sm:text-6xl md:text-7xl leading-none tracking-tight">
            BUGARENA
          </h1>
          <p className="font-hand text-lg sm:text-xl mt-3">1v1 Live Python Debugging Arena</p>
        </div>

        <div className="w-full max-w-[720px] grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Join */}
          <form
            onSubmit={handleJoin}
            className="bg-[#FAFAFA] border-2 border-black p-5 flex flex-col gap-3"
          >
            <h2 className="font-heading font-extrabold text-xl">JOIN A MATCH</h2>

            <label className="flex flex-col gap-1">
              <span className="font-hand text-sm">ROOM CODE</span>
              <input
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  setJoinError('');
                }}
                maxLength={6}
                placeholder="X7K9P2"
                autoComplete="off"
                className="border-2 border-black bg-white px-3 py-2 text-xl font-bold tracking-[0.3em] uppercase placeholder:text-black/25"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-hand text-sm">NICKNAME</span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={16}
                placeholder="neo"
                className="border-2 border-black bg-white px-3 py-2 placeholder:text-black/25"
              />
            </label>

            <div className="grid grid-cols-2 border-2 border-black">
              {(['player', 'spectator'] as JoinRole[]).map((r, i) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setJoinRole(r)}
                  className={`py-2 text-xs font-bold cursor-pointer ${i === 0 ? 'border-r-2 border-black' : ''} ${
                    joinRole === r ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/10'
                  }`}
                >
                  [ {r === 'player' ? 'CHALLENGER' : 'SPECTATOR'} ]
                </button>
              ))}
            </div>

            <button type="submit" disabled={busy} className="btn-ink py-3 text-base">
              JOIN BATTLE →
            </button>
            <div className="h-5 text-xs font-bold">
              {joinError && <span className="bg-black text-white px-2 py-0.5">[!] {joinError}</span>}
            </div>
          </form>

          {/* Host */}
          <div className="bg-[#FAFAFA] border-2 border-black p-5 flex flex-col gap-3">
            <h2 className="font-heading font-extrabold text-xl">HOST A DUEL</h2>
            <p className="font-hand text-sm">
              Open the projector screen. Players scan the QR code and fight. The crowd votes.
            </p>
            <div className="mt-auto flex flex-col gap-4">
              <button onClick={handleCreate} disabled={busy} className="btn-ink py-4 text-base">
                LAUNCH NEW ARENA
              </button>
              <div className="h-5 text-xs font-bold">
                {hostError && <span className="bg-black text-white px-2 py-0.5">[!] {hostError}</span>}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer bar (emotes pile up just above it) */}
      <footer className="relative z-10 shrink-0 h-10 border-t-[1.5px] border-black bg-[#FAFAFA] flex items-center justify-between px-8 text-[11px] font-bold tracking-wider">
        <span>BUGARENA</span>
        <span className="hidden sm:inline font-hand font-normal text-sm">no login. no server code. just bugs.</span>
        <span>1V1 / LIVE / WASM</span>
      </footer>
    </div>
  );
}
