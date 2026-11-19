import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Users,
  Swords,
  Flame,
  Bug,
  CheckCircle2,
  Trophy,
  Sparkles,
  ArrowRight,
  Vote,
  ShieldCheck
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

export default function SpectatorView({ autoAssigned = false }) {
  const { roomCode } = useParams();
  const [searchParams] = useSearchParams();
  const nickname = searchParams.get('name') || 'Audience Member';

  const {
    roomState,
    isConnected,
    votePrediction,
    voteNextBug
  } = useWebSocket({
    roomCode: roomCode || '',
    role: 'spectator',
    nickname,
  });

  const [predictedTarget, setPredictedTarget] = useState(null);
  const [votedBugCategory, setVotedBugCategory] = useState(null);

  const player1 = roomState?.players?.[0] || null;
  const player2 = roomState?.players?.[1] || null;

  // Prediction percentages
  const p1Votes = roomState?.predictions?.player_1 || 0;
  const p2Votes = roomState?.predictions?.player_2 || 0;
  const totalVotes = p1Votes + p2Votes;
  const p1Pct = totalVotes > 0 ? Math.round((p1Votes / totalVotes) * 100) : 50;
  const p2Pct = 100 - p1Pct;

  // Next bug voting
  const nextBugVotes = roomState?.next_bug_votes || {};
  const totalBugVotes = Object.values(nextBugVotes).reduce((a, b) => a + b, 0);

  const bugOptions = [
    { id: 'off_by_one', label: 'Off-by-One Loop / Slice', icon: '🐛' },
    { id: 'inverted_condition', label: 'Inverted Condition (not / or)', icon: '🔄' },
    { id: 'arithmetic', label: 'Arithmetic Mutation (+ / -)', icon: '✖️' },
    { id: 'comparison', label: 'Comparison Flip (< / >=)', icon: '⚖️' },
  ];

  const handlePredict = (target) => {
    if (predictedTarget) return; // already voted
    setPredictedTarget(target);
    votePrediction(target);
  };

  const handleVoteBug = (category) => {
    if (votedBugCategory) return;
    setVotedBugCategory(category);
    voteNextBug(category);
  };

  const totalTests = roomState?.problem?.test_cases?.length || 5;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-purple-600 selection:text-white px-4 py-5 max-w-lg mx-auto">
      {/* Mobile Top Header */}
      <header className="border-b border-slate-800/80 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-lg">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black text-sm tracking-wider">CODEDUEL</span>
              <span className="text-[10px] text-purple-400 block font-mono">
                ARENA {roomCode?.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1 text-[11px]">
              <Users className="w-3 h-3 text-purple-400" />
              {roomState?.spectator_count || 1} live
            </span>
          </div>
        </div>

        {autoAssigned && (
          <div className="mt-3 p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>2 Challengers are currently dueling. You are in live spectator & voting mode!</span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 space-y-6">
        {/* Match Problem & Status */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">Active Challenge</span>
            <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-mono font-bold">
              {roomState?.status === 'ACTIVE' ? 'IN PROGRESS' : roomState?.status || 'WAITING'}
            </span>
          </div>
          <h2 className="text-lg font-black text-white">{roomState?.problem?.title || 'Buggy Challenge'}</h2>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
            {roomState?.problem?.description || 'Challengers are hunting procedural bugs!'}
          </p>
        </div>

        {/* Live 1v1 Battle HUD (Mobile Progress) */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Live Duel Progress
          </div>

          {/* Player 1 Row */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                {player1?.name || 'Player 1'}
              </span>
              <span className="font-mono font-bold text-slate-200">
                {player1?.passed || 0}/{totalTests} Tests
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(100, ((player1?.passed || 0) / totalTests) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Player 2 Row */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-purple-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                {player2?.name || 'Player 2'}
              </span>
              <span className="font-mono font-bold text-slate-200">
                {player2?.passed || 0}/{totalTests} Tests
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${Math.min(100, ((player2?.passed || 0) / totalTests) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Mentimeter Control 1: Predict the Winner */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-400" />
              Predict the Winner
            </span>
            {predictedTarget && (
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Vote Locked
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Tap your pick to update the Projector screen's live Tug-of-War bar!
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => handlePredict('player_1')}
              disabled={!!predictedTarget}
              className={`p-3 rounded-xl border text-left transition-all active:scale-95 cursor-pointer disabled:cursor-default ${
                predictedTarget === 'player_1'
                  ? 'bg-cyan-950/90 border-cyan-400 ring-2 ring-cyan-400/40 text-cyan-300'
                  : 'bg-slate-950/80 border-slate-800 hover:border-cyan-500/50 text-slate-200'
              }`}
            >
              <div className="text-[10px] text-slate-500 font-mono">PLAYER 1</div>
              <div className="font-bold text-sm truncate">{player1?.name || 'Player 1'}</div>
              <div className="text-xs font-mono font-bold text-cyan-400 mt-1">{p1Pct}%</div>
            </button>

            <button
              onClick={() => handlePredict('player_2')}
              disabled={!!predictedTarget}
              className={`p-3 rounded-xl border text-left transition-all active:scale-95 cursor-pointer disabled:cursor-default ${
                predictedTarget === 'player_2'
                  ? 'bg-purple-950/90 border-purple-400 ring-2 ring-purple-400/40 text-purple-300'
                  : 'bg-slate-950/80 border-slate-800 hover:border-purple-500/50 text-slate-200'
              }`}
            >
              <div className="text-[10px] text-slate-500 font-mono">PLAYER 2</div>
              <div className="font-bold text-sm truncate">{player2?.name || 'Player 2'}</div>
              <div className="text-xs font-mono font-bold text-purple-400 mt-1">{p2Pct}%</div>
            </button>
          </div>

          {/* Tug of war bar */}
          <div className="relative w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex mt-2">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{ width: `${p1Pct}%` }}
            ></div>
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${p2Pct}%` }}
            ></div>
          </div>
        </div>

        {/* Mentimeter Control 2: Vote on Next Bug */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Bug className="w-4 h-4 text-purple-400" />
              Vote on Next Bug Category
            </span>
            {votedBugCategory && (
              <span className="text-[11px] text-purple-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Voted
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Choose which bug type will procedurally mutate the next round's code!
          </p>

          <div className="space-y-2">
            {bugOptions.map((opt) => {
              const count = nextBugVotes[opt.id] || 0;
              const pct = totalBugVotes > 0 ? Math.round((count / totalBugVotes) * 100) : 0;
              const isSelected = votedBugCategory === opt.id;

              return (
                <button
                  key={opt.id}
                  onClick={() => handleVoteBug(opt.id)}
                  disabled={!!votedBugCategory}
                  className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer disabled:cursor-default ${
                    isSelected
                      ? 'bg-purple-950/80 border-purple-400 text-purple-200'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{opt.icon}</span>
                    <span className="text-xs font-semibold">{opt.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      {pct}% ({count})
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Match Ticker Feed */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Arena Feed
          </span>
          <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-400">
            {(roomState?.event_log || []).slice(-4).map((msg, idx) => (
              <div key={idx} className="truncate">
                &bull; {msg}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Mobile Footer */}
      <footer className="pt-4 border-t border-slate-900 text-center text-[11px] text-slate-500">
        CodeDuel Spectator &bull; Voting & Progress Sync
      </footer>
    </div>
  );
}
