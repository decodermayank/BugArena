import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { usePyodide } from '../hooks/usePyodide';
import { DoodleBug, AVATAR_PRESETS } from '../components/Doodles';
import type { AvatarPresetId } from '../components/Doodles';
import ArcadeCodeInput from '../components/ArcadeCodeInput';
import EmoteJar from '../components/EmoteJar';
import SoundToggle from '../components/SoundToggle';
import { soundFx } from '../utils/soundFx';
import type { CreateRoomResponse } from '../types';

type JoinRole = 'player' | 'spectator';

const RANDOM_NAMES = [
  'syntax_samurai',
  'off_by_one',
  'null_pointer',
  'regex_rebel',
  'byte_bandit',
  'panic_hook',
  'deadlock_dan',
  'stack_overflow',
  'bit_flipper',
  'rubber_duck',
  'git_blame',
  'type_error',
  'mem_leak',
  'segfault_sam',
  'race_condition',
  'zero_day',
  'patch_master',
  'infinite_looper',
];

export default function Home() {
  const navigate = useNavigate();
  const engine = usePyodide();
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<AvatarPresetId>('hacker');
  const [joinRole, setJoinRole] = useState<JoinRole>('player');
  const [joinError, setJoinError] = useState('');
  const [hostError, setHostError] = useState('');
  const [busy, setBusy] = useState(false);

  // Restore saved avatar & nickname
  useEffect(() => {
    const savedAvatar = localStorage.getItem('bugarena_avatar') as AvatarPresetId;
    if (savedAvatar && AVATAR_PRESETS.some((a) => a.id === savedAvatar)) {
      setAvatar(savedAvatar);
    }
    const savedName = localStorage.getItem('bugarena_nickname');
    if (savedName) setNickname(savedName);
  }, []);

  const selectAvatar = (id: AvatarPresetId) => {
    setAvatar(id);
    localStorage.setItem('bugarena_avatar', id);
  };

  const handleRandomName = () => {
    const name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setNickname(name);
    localStorage.setItem('bugarena_nickname', name);
    setJoinError('');
  };

  const engineLabel =
    engine.status === 'ready' ? 'READY' : engine.status === 'loading' ? 'LOADING' : 'OFFLINE';

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError('6-CHAR CODE REQUIRED');
      return;
    }
    setBusy(true);
    setJoinError('');
    if (nickname.trim()) {
      localStorage.setItem('bugarena_nickname', nickname.trim());
    }

    try {
      const res = await fetch(`${API_URL}/api/room/${code}`);
      if (res.status === 404) {
        setJoinError('ROOM NOT FOUND');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const name = encodeURIComponent(nickname.trim() || 'challenger');
      navigate(
        joinRole === 'spectator'
          ? `/spectate/${code}?name=${name}&avatar=${avatar}`
          : `/join/${code}?name=${name}&avatar=${avatar}`,
      );
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
    <div className="min-h-dvh h-dvh w-full overflow-hidden relative flex flex-col justify-between bg-[#FAFAFA] text-black">
      <EmoteJar floorOffset={42} />

      {/* Header */}
      <header className="relative z-10 shrink-0 w-full flex items-center justify-between px-3 sm:px-8 py-2.5 sm:py-3.5 border-b-[1.5px] border-black bg-white/80 backdrop-blur-xs">
        <div className="flex items-center gap-2 sm:gap-3">
          <DoodleBug size={24} className="sm:w-[26px] sm:h-[26px]" />
          <span className="font-heading font-extrabold text-lg sm:text-2xl tracking-tight">
            BUGARENA
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <div className="flex items-center gap-1.5 sm:gap-2 border-[1.5px] border-black px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold tracking-wider bg-white">
            <span
              className={`inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0 ${
                engine.status === 'ready' ? 'bg-black' : 'border-[1.5px] border-black animate-pulse'
              }`}
            />
            <span className="hidden sm:inline">WASM ENGINE:</span> {engineLabel}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 flex-1 min-h-0 w-full overflow-y-auto px-3 sm:px-6 py-3 sm:py-6 pointer-events-none">
        <div className="w-full max-w-[740px] mx-auto my-auto flex flex-col items-center gap-3 sm:gap-5 pb-20 sm:pb-8 pointer-events-auto">
          {/* Title */}
          <div className="text-center">
            <h1 className="font-heading font-extrabold text-3xl sm:text-5xl md:text-6xl leading-none tracking-tight">
              BUGARENA
            </h1>
            <p className="font-hand text-xs sm:text-base md:text-lg mt-1 sm:mt-1.5 text-black/80">
              1v1 Live Python Debugging Arena
            </p>
          </div>

          {/* Dual Cards */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
            {/* Join card */}
            <form
              onSubmit={handleJoin}
              className="bg-[#FAFAFA] border-2 border-black p-3.5 sm:p-4.5 flex flex-col gap-2.5 shadow-[3px_3px_0px_#000]"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-extrabold text-base sm:text-lg">JOIN A MATCH</h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 border border-black bg-white">
                  LIVE
                </span>
              </div>

              {/* Segmented Code Input */}
              <ArcadeCodeInput
                value={roomCode}
                onChange={(c) => {
                  setRoomCode(c);
                  setJoinError('');
                }}
                disabled={busy}
              />

              {/* Nickname & Randomizer */}
              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-hand text-xs">NICKNAME</span>
                  <button
                    type="button"
                    onClick={handleRandomName}
                    className="font-hand text-[11px] text-black/75 hover:text-black cursor-pointer underline decoration-dotted flex items-center gap-1"
                  >
                    🎲 random name
                  </button>
                </div>
                <input
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setJoinError('');
                  }}
                  maxLength={16}
                  placeholder="neo"
                  className="border-2 border-black bg-white px-3 py-1.5 text-base font-bold placeholder:text-black/25 focus:outline-none"
                />
              </label>

              {/* Avatar Selector Strip */}
              <div className="flex flex-col gap-1">
                <span className="font-hand text-xs">CHOOSE AVATAR</span>
                <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = avatar === preset.id;
                    const IconComp = preset.Component;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectAvatar(preset.id)}
                        title={preset.name}
                        className={`min-w-0 border-2 border-black p-1 sm:p-1.5 flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-black text-white shadow-[2px_2px_0px_#000]'
                            : 'bg-white text-black hover:bg-black/10'
                        }`}
                      >
                        <IconComp size={22} className="shrink-0 sm:w-6 sm:h-6" />
                        <span className="text-[8px] sm:text-[9px] font-bold truncate max-w-full mt-0.5">
                          {preset.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Role Toggle */}
              <div className="grid grid-cols-2 border-2 border-black mt-1">
                {(['player', 'spectator'] as JoinRole[]).map((r, i) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setJoinRole(r)}
                    className={`py-2 text-xs font-bold cursor-pointer ${
                      i === 0 ? 'border-r-2 border-black' : ''
                    } ${
                      joinRole === r
                        ? 'bg-black text-white'
                        : 'bg-white text-black hover:bg-black/10'
                    }`}
                  >
                    [ {r === 'player' ? 'CHALLENGER' : 'SPECTATOR'} ]
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="btn-ink py-2.5 sm:py-3 text-sm sm:text-base cursor-pointer mt-1"
              >
                JOIN BATTLE →
              </button>

              <div className="min-h-4 text-[11px] font-bold">
                {joinError && <span className="bg-black text-white px-2 py-0.5">[!] {joinError}</span>}
              </div>
            </form>

            {/* Host card */}
            <div className="bg-[#FAFAFA] border-2 border-black p-3.5 sm:p-4.5 flex flex-col gap-2.5 shadow-[3px_3px_0px_#000]">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-extrabold text-base sm:text-lg">HOST A DUEL</h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 border border-black bg-white">
                  PROJECTOR
                </span>
              </div>
              <p className="font-hand text-xs sm:text-sm text-black/80 leading-relaxed">
                Open the big projector arena. Players scan the live QR code on their phones. Real-time
                audience prediction tug-of-war & crowd bug mutator votes.
              </p>

              <div className="border border-dashed border-black/50 p-2 text-xs bg-white/60 font-mono">
                <div className="font-bold flex items-center gap-1.5">
                  <span>✦</span>
                  <span>MATCH RULES:</span>
                </div>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-black/80">
                  <li>1 bug injected via AST mutation</li>
                  <li>First to pass all test cases wins</li>
                  <li>Spectators vote on next bug sabotage</li>
                </ul>
              </div>

              <div className="mt-auto flex flex-col gap-2 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={busy}
                  className="btn-ink py-2.5 sm:py-3 text-sm sm:text-base cursor-pointer"
                >
                  LAUNCH NEW ARENA
                </button>
                <div className="min-h-4 text-[11px] font-bold">
                  {hostError && <span className="bg-black text-white px-2 py-0.5">[!] {hostError}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Solo Practice Sandbox Quick Link */}
          <div className="w-full border-2 border-black bg-white p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 shadow-[2px_2px_0px_#000]">
            <div className="flex items-center gap-2.5 text-center sm:text-left">
              <span className="text-xl shrink-0">⚡</span>
              <div>
                <div className="font-heading font-extrabold text-xs sm:text-sm tracking-tight">
                  SOLO PRACTICE SANDBOX
                </div>
                <div className="font-hand text-[11px] sm:text-xs text-black/75">
                  Warming up or presenting solo? Offline in-browser Pyodide sandbox.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/practice')}
              className="btn-paper w-full sm:w-auto px-4 py-2 text-xs font-bold border-2 border-black flex items-center justify-center gap-2 hover:bg-black hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <span>PRACTICE SOLO</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer bar */}
      <footer className="relative z-10 shrink-0 h-10 border-t-[1.5px] border-black bg-[#FAFAFA] flex items-center justify-between px-3 sm:px-8 text-[10px] sm:text-[11px] font-bold tracking-wider pointer-events-none select-none">
        <span>BUGARENA</span>
        <span className="hidden sm:inline font-hand font-normal text-xs sm:text-sm">
          no login. no server code. just bugs.
        </span>
        <span>1V1 / LIVE / WASM</span>
      </footer>
    </div>
  );
}
