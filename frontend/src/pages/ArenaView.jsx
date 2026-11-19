import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Swords,
  Timer,
  Users,
  Play,
  RotateCcw,
  Sparkles,
  Bug,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Tv
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

export default function ArenaView() {
  const { roomCode } = useParams();
  const tickerEndRef = useRef(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const {
    roomState,
    isConnected,
    error,
    startMatch,
    startNextRound
  } = useWebSocket({
    roomCode: roomCode || '',
    role: 'projector',
    nickname: 'Projector Arena',
  });

  // Calculate join URL for QR code
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/play/${roomCode}`
    : `http://localhost:5173/play/${roomCode}`;

  // Timer effect
  useEffect(() => {
    let interval = null;
    if (roomState?.status === 'ACTIVE' && roomState?.start_time) {
      interval = setInterval(() => {
        const now = Date.now() / 1000;
        setTimerSeconds(Math.max(0, Math.floor(now - roomState.start_time)));
      }, 500);
    } else if (roomState?.status === 'FINISHED' && roomState?.winner?.completion_time) {
      setTimerSeconds(Math.floor(roomState.winner.completion_time));
    } else if (roomState?.status === 'WAITING') {
      setTimerSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [roomState?.status, roomState?.start_time, roomState?.winner]);

  // Confetti on win
  useEffect(() => {
    if (roomState?.status === 'FINISHED' && roomState?.winner) {
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#a855f7', '#06b6d4', '#ec4899', '#22c55e'],
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, [roomState?.status, roomState?.winner]);

  // Scroll ticker
  useEffect(() => {
    if (tickerEndRef.current) {
      tickerEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomState?.event_log]);

  const player1 = roomState?.players?.[0] || null;
  const player2 = roomState?.players?.[1] || null;

  // Spectator prediction tug-of-war
  const p1Votes = roomState?.predictions?.player_1 || 0;
  const p2Votes = roomState?.predictions?.player_2 || 0;
  const totalVotes = p1Votes + p2Votes;
  const p1Pct = totalVotes > 0 ? Math.round((p1Votes / totalVotes) * 100) : 50;
  const p2Pct = 100 - p1Pct;

  // Next bug votes
  const nextBugVotes = roomState?.next_bug_votes || {};
  const totalBugVotes = Object.values(nextBugVotes).reduce((a, b) => a + b, 0);

  const bugLabels = {
    off_by_one: 'Off-by-One Loop/Index',
    inverted_condition: 'Inverted Condition (not / or)',
    arithmetic: 'Arithmetic Mutation (+ / -)',
    comparison: 'Comparison Operator Flip (< / >)',
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-purple-600 selection:text-white">
      {/* Dynamic Arena Ambience Lights */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-cyan-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-purple-600/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Top Projector Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-lg shadow-md shadow-purple-900/30">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <span className="font-black tracking-wider text-xl bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              CODEDUEL
            </span>
          </Link>

          <div className="h-6 w-px bg-slate-800"></div>

          {/* Room Code Badge */}
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
              Arena Code:
            </span>
            <span className="px-4 py-1.5 rounded-xl bg-slate-900 border border-purple-500/40 text-purple-300 font-mono font-black text-2xl tracking-widest shadow-lg shadow-purple-950">
              {roomCode?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Center Clock / Match State */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xl font-bold">
            <Timer className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span>{formatTime(timerSeconds)}</span>
          </div>

          <div className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 border">
            {roomState?.status === 'ACTIVE' && (
              <span className="bg-emerald-950/80 text-emerald-300 border-emerald-500/40 px-3 py-1 rounded-full flex items-center gap-2 border">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                DUEL IN PROGRESS
              </span>
            )}
            {roomState?.status === 'WAITING' && (
              <span className="bg-amber-950/80 text-amber-300 border-amber-500/40 px-3 py-1 rounded-full flex items-center gap-2 border">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                WAITING FOR CHALLENGERS
              </span>
            )}
            {roomState?.status === 'FINISHED' && (
              <span className="bg-purple-950/80 text-purple-300 border-purple-500/40 px-3 py-1 rounded-full flex items-center gap-2 border">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                MATCH OVER
              </span>
            )}
          </div>
        </div>

        {/* Right Host Actions & Spectator Count */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Users className="w-4 h-4 text-purple-400" />
            <span>{roomState?.spectator_count || 0} Spectators</span>
          </div>

          {roomState?.status === 'WAITING' && (
            <button
              onClick={startMatch}
              disabled={!player1}
              className="py-2.5 px-5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <Play className="w-4 h-4" />
              Start Match
            </button>
          )}

          {roomState?.status === 'FINISHED' && (
            <button
              onClick={startNextRound}
              className="py-2.5 px-5 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Next Round (Voted Bug)
            </button>
          )}
        </div>
      </header>

      {/* Main Duel Stage */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-8 py-6 flex flex-col justify-between gap-6">
        {/* Problem Banner */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/30 text-purple-400">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  {roomState?.problem?.title || 'Loading Challenge...'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-md bg-purple-950 border border-purple-500/30 text-purple-300 font-mono">
                  {roomState?.problem?.mutation_category || 'AST Mutated'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {roomState?.problem?.description || 'Fix the procedural bug and pass all unit tests first.'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Total Test Suite</span>
            <span className="font-mono font-bold text-lg text-cyan-300">
              {roomState?.problem?.test_cases?.length || 5} Assertions
            </span>
          </div>
        </div>

        {/* 1v1 Battle Arena Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-auto">
          {/* PLAYER 1 CARD */}
          <div
            className={`relative p-6 rounded-3xl border transition-all duration-300 flex flex-col justify-between ${
              roomState?.winner?.id === player1?.id
                ? 'bg-gradient-to-b from-cyan-950/90 to-slate-950/95 border-cyan-400 glow-cyan ring-2 ring-cyan-400/50'
                : 'bg-slate-900/70 border-slate-800'
            }`}
          >
            {roomState?.winner?.id === player1?.id && (
              <div className="absolute -top-4 left-6 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-300" />
                WINNER &bull; {roomState.winner.completion_time}s
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-black text-xl flex items-center justify-center">
                    P1
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">
                      {player1?.name || 'Awaiting Challenger 1...'}
                    </h3>
                    <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      {player1 ? (player1.status === 'finished' ? 'DONE' : 'CODING') : 'OPEN SLOT'}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-4xl font-black text-cyan-400">
                    {player1?.passed ?? 0}
                  </span>
                  <span className="text-xl text-slate-500 font-bold">
                    /{player1?.total ?? (roomState?.problem?.test_cases?.length || 5)}
                  </span>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Tests Passed</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative w-full h-6 rounded-full bg-slate-950 p-1 border border-slate-800 overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, ((player1?.passed || 0) / (player1?.total || 5)) * 100)}%`,
                  }}
                ></div>
              </div>

              {/* Status info */}
              {player1?.error ? (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono line-clamp-2">
                  <span className="font-bold text-red-400">Traceback: </span>
                  {player1.error}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>
                    {player1?.passed === player1?.total && player1?.passed > 0
                      ? 'All assertions passed! Bug defeated.'
                      : 'Running unit tests against buggy AST node...'}
                  </span>
                </div>
              )}
            </div>

            {/* Prediction confidence percentage */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Spectator Confidence:</span>
              <span className="font-bold font-mono text-cyan-400 text-sm">{p1Pct}% ({p1Votes} votes)</span>
            </div>
          </div>

          {/* PLAYER 2 CARD */}
          <div
            className={`relative p-6 rounded-3xl border transition-all duration-300 flex flex-col justify-between ${
              roomState?.winner?.id === player2?.id
                ? 'bg-gradient-to-b from-purple-950/90 to-slate-950/95 border-purple-400 glow-purple ring-2 ring-purple-400/50'
                : 'bg-slate-900/70 border-slate-800'
            }`}
          >
            {roomState?.winner?.id === player2?.id && (
              <div className="absolute -top-4 left-6 px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-300" />
                WINNER &bull; {roomState.winner.completion_time}s
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-950 border border-purple-500/40 text-purple-400 font-black text-xl flex items-center justify-center">
                    P2
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">
                      {player2?.name || 'Awaiting Challenger 2...'}
                    </h3>
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                      {player2 ? (player2.status === 'finished' ? 'DONE' : 'CODING') : 'OPEN SLOT'}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-4xl font-black text-purple-400">
                    {player2?.passed ?? 0}
                  </span>
                  <span className="text-xl text-slate-500 font-bold">
                    /{player2?.total ?? (roomState?.problem?.test_cases?.length || 5)}
                  </span>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Tests Passed</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative w-full h-6 rounded-full bg-slate-950 p-1 border border-slate-800 overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, ((player2?.passed || 0) / (player2?.total || 5)) * 100)}%`,
                  }}
                ></div>
              </div>

              {/* Status info */}
              {player2?.error ? (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono line-clamp-2">
                  <span className="font-bold text-red-400">Traceback: </span>
                  {player2.error}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <span>
                    {player2?.passed === player2?.total && player2?.passed > 0
                      ? 'All assertions passed! Bug defeated.'
                      : 'Running unit tests against buggy AST node...'}
                  </span>
                </div>
              )}
            </div>

            {/* Prediction confidence percentage */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Spectator Confidence:</span>
              <span className="font-bold font-mono text-purple-400 text-sm">{p2Pct}% ({p2Votes} votes)</span>
            </div>
          </div>
        </div>

        {/* Live Tug-of-War Prediction Bar */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2">
            <span className="text-cyan-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-cyan-400" />
              {player1?.name || 'Player 1'} ({p1Pct}%)
            </span>
            <span className="text-slate-400 font-normal">
              Spectator Prediction Tug-of-War ({totalVotes} votes)
            </span>
            <span className="text-purple-400 flex items-center gap-1.5">
              {player2?.name || 'Player 2'} ({p2Pct}%)
              <Flame className="w-4 h-4 text-purple-400" />
            </span>
          </div>

          <div className="relative w-full h-4 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
              style={{ width: `${p1Pct}%` }}
            ></div>
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${p2Pct}%` }}
            ></div>
          </div>
        </div>

        {/* Bottom Section: QR Code Box + Next Bug Poll + Live Event Ticker */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* QR Code Scannable Card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-white shadow-xl flex-shrink-0">
              <QRCodeSVG value={joinUrl} size={110} level="M" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold block">
                Scan to Join or Vote
              </span>
              <p className="text-xs text-slate-300 mt-1">
                Scan with phone camera to race 1v1 or vote live on Mentimeter polls!
              </p>
              <div className="mt-2 text-xs font-mono text-purple-400 break-all">
                codeduel/play/{roomCode}
              </div>
            </div>
          </div>

          {/* Next Bug Poll Visualization */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Bug className="w-3.5 h-3.5 text-purple-400" />
                Audience Poll: Next Round's Bug
              </span>
              <span className="text-xs text-slate-500">{totalBugVotes} votes</span>
            </div>

            <div className="space-y-2 text-xs">
              {Object.entries(bugLabels).map(([key, label]) => {
                const count = nextBugVotes[key] || 0;
                const pct = totalBugVotes > 0 ? Math.round((count / totalBugVotes) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                      <span className="truncate">{label}</span>
                      <span className="font-mono font-bold text-slate-200">{pct}% ({count})</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Event Ticker */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Live Arena Feed
            </span>

            <div className="flex-1 max-h-36 overflow-y-auto space-y-1.5 text-xs font-mono text-slate-400 pr-2">
              {(roomState?.event_log || []).map((msg, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-300">
                  <span className="text-slate-600 select-none">&gt;</span>
                  <span>{msg}</span>
                </div>
              ))}
              <div ref={tickerEndRef} />
            </div>
          </div>
        </div>

        {/* Winner Reveal / AST Diff Modal */}
        {roomState?.status === 'FINISHED' && roomState?.winner && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/90 to-indigo-950/90 border border-purple-500/50 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
                  <Trophy className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">
                    VICTORY: {roomState.winner.name} fixed the bug in {roomState.winner.completion_time}s!
                  </h3>
                  <p className="text-xs text-purple-300">
                    Procedural Bug Injected: {roomState.problem.description_bug || roomState.problem.mutation_category}
                  </p>
                </div>
              </div>

              <button
                onClick={startNextRound}
                className="py-3 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white shadow-lg shadow-purple-950 flex items-center gap-2 cursor-pointer"
              >
                Launch Next Round
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {roomState.winner.ast_diff && (
              <div className="mt-4">
                <span className="text-xs uppercase font-mono text-slate-400 tracking-wider block mb-2">
                  AST Bug vs Fix Unified Diff:
                </span>
                <pre className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-emerald-400 overflow-x-auto border border-slate-800">
                  {roomState.winner.ast_diff}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 px-8 py-3 flex items-center justify-between text-xs text-slate-500">
        <div>CodeDuel Arena Screen &bull; WebSockets Connected</div>
        <div>Audience join: {joinUrl}</div>
      </footer>
    </div>
  );
}
