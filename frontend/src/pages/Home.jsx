import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Tv, Users, Zap, ShieldAlert, Sparkles, ArrowRight, Code2 } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [joinRole, setJoinRole] = useState('player');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const getBackendUrl = () => {
    const host = window.location.hostname || 'localhost';
    const port = import.meta.env.VITE_BACKEND_PORT || '8000';
    const protocol = window.location.protocol;
    return `${protocol}//${host}:${port}`;
  };

  const handleCreateArena = async () => {
    setIsCreating(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${getBackendUrl()}/api/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.room_code) {
        navigate(`/arena/${data.room_code}`);
      } else {
        throw new Error('Failed to get room code from server');
      }
    } catch (err) {
      console.error('Failed to create arena:', err);
      setErrorMessage(
        'Could not connect to CodeDuel backend on port 8000. Ensure the FastAPI server is running.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4) {
      setErrorMessage('Please enter a valid 6-character room code');
      return;
    }

    const nameParam = encodeURIComponent(nickname.trim() || 'Challenger');
    if (joinRole === 'spectator') {
      navigate(`/spectate/${cleanCode}?name=${nameParam}`);
    } else {
      navigate(`/play/${cleanCode}?name=${nameParam}&role=player`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-purple-600 selection:text-white">
      {/* Background glowing gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-xl shadow-lg shadow-purple-900/30">
              <Swords className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                CODEDUEL
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/30 text-purple-300">
                LIVE ARENA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Pyodide WASM Engine Ready</span>
          </div>
        </div>
      </header>

      {/* Main Hero & Action Section */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto px-6 py-12 flex flex-col justify-center">
        {/* Banner Tag */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-purple-500/40 text-purple-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Mentimeter for Live Competitive Debugging
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
            Race 1v1 to Kill Bugs.{' '}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Audience Votes in Real-Time.
            </span>
          </h1>
          <p className="mt-4 text-slate-400 text-base md:text-lg max-w-2xl mx-auto">
            Zero friction, no account creation. Scan a QR code to enter the arena as a live challenger or vote as a spectator with sub-50ms client-side WebAssembly execution.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 max-w-xl mx-auto w-full p-4 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-sm flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
          {/* Card 1: Host Arena / Projector View */}
          <div className="relative group p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800 hover:border-purple-500/50 transition-all duration-300 shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-6">
                <Tv className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Host Arena Screen</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Projector / Big Screen view. Shows live scannable QR code, countdown clock, 1v1 test progress bars, live spectator tug-of-war, and event ticker.
              </p>
            </div>

            <button
              onClick={handleCreateArena}
              disabled={isCreating}
              className="w-full py-4 px-6 rounded-xl font-bold text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/40 hover:shadow-purple-900/60 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating Arena...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Launch New Arena
                </>
              )}
            </button>
          </div>

          {/* Card 2: Join via Room Code */}
          <div className="relative group p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800 hover:border-cyan-500/50 transition-all duration-300 shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-6">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Enter Room Code</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Scan with mobile or enter the 6-character room code from the projector screen.
              </p>

              <form onSubmit={handleJoin} className="space-y-3">
                <div>
                  <input
                    type="text"
                    maxLength={6}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="ROOM CODE (e.g. X7K9P2)"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:outline-none text-center font-mono font-bold tracking-widest text-lg text-cyan-300 placeholder:text-slate-600 uppercase"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    maxLength={20}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Your Nickname (e.g. Neo)"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:outline-none text-sm text-slate-100 placeholder:text-slate-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setJoinRole('player')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      joinRole === 'player'
                        ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    Challenger (1v1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinRole('spectator')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      joinRole === 'spectator'
                        ? 'bg-purple-950/80 border-purple-400 text-purple-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Spectator (Vote)
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3.5 px-6 rounded-xl font-bold text-base bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/40 hover:shadow-cyan-900/60 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Join Battle
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-200">Sub-50ms Execution</h3>
              <p className="text-xs text-slate-400 mt-1">
                Pyodide compiles and executes Python test suites directly in WebAssembly inside your browser. Zero server lag.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-950/60 text-purple-400 border border-purple-500/20">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-200">Procedural AST Mutator</h3>
              <p className="text-xs text-slate-400 mt-1">
                Injects subtle off-by-one errors, operator inversions, and arithmetic mutations into verified algorithm templates.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-pink-950/60 text-pink-400 border border-pink-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-200">Live Mentimeter Voting</h3>
              <p className="text-xs text-slate-400 mt-1">
                Audience members vote on winner predictions and decide which bug category strikes the challengers next round.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 py-6 px-6 text-center text-xs text-slate-500">
        CodeDuel &bull; Mentimeter for Live Competitive Debugging &bull; Built with FastAPI, WebSockets & Pyodide
      </footer>
    </div>
  );
}
