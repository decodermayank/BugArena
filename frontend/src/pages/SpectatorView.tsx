import { useEffect, useState } from 'react';
import type { BugCategory, PlayerSlot } from '../types';
import { formatClock } from '../hooks/useWebSocket';
import type { RoomSession } from '../hooks/useWebSocket';
import { Crowd, DoodlePlayer1, DoodlePlayer2, DoodleBug } from '../components/Doodles';
import SoundToggle from '../components/SoundToggle';
import { CursorToggle } from '../components/CustomCursor';
import { soundFx } from '../utils/soundFx';

const BUG_OPTIONS: { id: BugCategory; label: string; hint: string }[] = [
  { id: 'off_by_one', label: 'OFF-BY-ONE', hint: 'range() / index slips by 1' },
  { id: 'inverted_condition', label: 'INVERTED LOGIC', hint: 'if flips to if not' },
  { id: 'arithmetic', label: 'BROKEN MATH', hint: '+ becomes -, * becomes //' },
];

const REACTION_EMOTES = [
  { id: 'bug', icon: '🐛', label: 'BUG' },
  { id: 'fire', icon: '🔥', label: 'FIRE' },
  { id: 'skull', icon: '💀', label: 'RIP' },
  { id: 'zap', icon: '⚡', label: 'GG' },
];

function Bar({ passed, total }: { passed: number; total: number }) {
  return (
    <div className="flex gap-0 border-2 border-black h-5 w-full bg-paper shadow-[1px_1px_0px_#000]">
      {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 transition-all duration-300 ${i < passed ? 'bg-black' : 'bg-paper'} ${
            i > 0 ? 'border-l-2 border-black' : ''
          }`}
        />
      ))}
    </div>
  );
}

export default function SpectatorView({ session }: { session: RoomSession }) {
  const { roomState: room, secondsLeft, votePrediction, guessBug, voteNextBug, sendEmote } = session;
  const round = room?.round ?? 1;
  const roomCode = room?.room_code ?? '';

  const [predictedWinner, setPredictedWinner] = useState<PlayerSlot | null>(() => {
    return (sessionStorage.getItem(`ba_w_${roomCode}_${round}`) as PlayerSlot) || null;
  });
  const [guessedBug, setGuessedBug] = useState<BugCategory | null>(() => {
    return (sessionStorage.getItem(`ba_b_${roomCode}_${round}`) as BugCategory) || null;
  });
  const [votedNextBug, setVotedNextBug] = useState<BugCategory | null>(() => {
    return (sessionStorage.getItem(`ba_n_${roomCode}_${round}`) as BugCategory) || null;
  });

  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [localEmotes, setLocalEmotes] = useState<{ id: number; icon: string; x: number }[]>([]);

  // Reset local state when a new round starts
  useEffect(() => {
    setPredictedWinner((sessionStorage.getItem(`ba_w_${roomCode}_${round}`) as PlayerSlot) || null);
    setGuessedBug((sessionStorage.getItem(`ba_b_${roomCode}_${round}`) as BugCategory) || null);
    setVotedNextBug((sessionStorage.getItem(`ba_n_${roomCode}_${round}`) as BugCategory) || null);
  }, [round, roomCode]);

  if (!room) return null;
  const [p1, p2] = room.players;
  const a = room.predictions?.player_1 ?? 0;
  const b = room.predictions?.player_2 ?? 0;
  const aPct = a + b === 0 ? 50 : Math.round((a / (a + b)) * 100);

  const bugGuesses = room.bug_guesses || { off_by_one: 0, inverted_condition: 0, arithmetic: 0 };
  const totalBugGuesses = Object.values(bugGuesses).reduce((x, y) => x + y, 0);

  const nextBugVotes = room.next_bug_votes || { off_by_one: 0, inverted_condition: 0, arithmetic: 0 };
  const totalNextVotes = Object.values(nextBugVotes).reduce((x, y) => x + y, 0);

  const handlePredictWinner = (slot: PlayerSlot) => {
    if (predictedWinner || room.status !== 'ACTIVE') return;
    setPredictedWinner(slot);
    sessionStorage.setItem(`ba_w_${roomCode}_${round}`, slot);
    soundFx.playThump();
    votePrediction(slot);
  };

  const handleGuessBug = (cat: BugCategory) => {
    if (guessedBug || room.status !== 'ACTIVE') return;
    setGuessedBug(cat);
    sessionStorage.setItem(`ba_b_${roomCode}_${round}`, cat);
    soundFx.playThump();
    guessBug(cat);
  };

  const handleVoteNextBug = (cat: BugCategory) => {
    if (votedNextBug) return;
    setVotedNextBug(cat);
    sessionStorage.setItem(`ba_n_${roomCode}_${round}`, cat);
    soundFx.playThump();
    voteNextBug(cat);
  };

  const handleSpamReaction = (icon: string) => {
    soundFx.playEmotePop();
    setActiveReaction(icon);
    setTimeout(() => setActiveReaction(null), 180);

    sendEmote(icon);

    const id = Date.now() + Math.random();
    const x = 20 + Math.random() * 60;
    setLocalEmotes((prev) => [...prev, { id, icon, x }]);
    setTimeout(() => {
      setLocalEmotes((prev) => prev.filter((e) => e.id !== id));
    }, 2000);
  };

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-black border-x-0 sm:border-x-2 border-black max-w-xl mx-auto flex flex-col relative overflow-x-hidden select-none pb-24">
      {/* Top Header */}
      <header className="border-b-2 border-black flex items-stretch justify-between bg-white">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2">
          <span className="font-heading font-extrabold text-sm sm:text-lg">BUGARENA</span>
          <DoodleBug size={18} className="shrink-0 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-black text-white">CROWD</span>
        </div>
        <div className="flex items-center">
          <div className="flex items-center gap-1.5 mr-2">
            <SoundToggle />
            <CursorToggle />
          </div>
          <div className="border-l-2 border-black px-3 py-2 flex items-center font-mono font-bold text-xs sm:text-sm">
            ROOM {room.room_code}
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="grid grid-cols-3 border-b-2 border-black text-center bg-paper">
        <div className="border-r-2 border-black py-2">
          <div className="font-hand text-[10px] sm:text-xs text-black/70">STATUS</div>
          <div className="font-bold text-xs sm:text-sm">{room.status}</div>
        </div>
        <div className="border-r-2 border-black py-2">
          <div className="font-hand text-[10px] sm:text-xs text-black/70">TIME</div>
          <div className="font-mono font-bold text-xs sm:text-sm">{formatClock(secondsLeft)}</div>
        </div>
        <div className="py-2">
          <div className="font-hand text-[10px] sm:text-xs text-black/70">ROUND</div>
          <div className="font-bold text-xs sm:text-sm">#{room.round}</div>
        </div>
      </div>

      {/* Live Duelists Progress */}
      <section className="border-b-2 border-black p-3.5 flex flex-col gap-3 bg-white">
        <div className="flex items-center justify-between text-xs font-bold text-black/70">
          <span className="font-heading font-extrabold text-xs tracking-wider">LIVE CHALLENGERS</span>
          <span className="font-mono">{room.problem.title}</span>
        </div>
        {[p1, p2].map((p, i) => (
          <div key={i} className="flex items-center gap-2.5 sm:gap-3">
            <div className="border border-black p-0.5 bg-paper shrink-0">
              {i === 0 ? <DoodlePlayer1 size={36} /> : <DoodlePlayer2 size={36} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="truncate">{p ? p.name : `PLAYER ${i + 1}: waiting...`}</span>
                <span className="ml-2 shrink-0 font-mono">
                  {p ? `${p.passed}/${p.total}` : '-'}
                </span>
              </div>
              <Bar passed={p?.passed ?? 0} total={p?.total ?? room.problem.test_cases.length} />
            </div>
          </div>
        ))}
      </section>

      {/* END-OF-ROUND FINISHED RESULTS & LEADERBOARD */}
      {room.status === 'FINISHED' && (
        <section className="border-b-2 border-black bg-white flex flex-col shadow-[2px_2px_0px_#000]">
          <div className="bg-black text-white p-4 text-center">
            <div className="font-hand text-xs text-[#CCFF00] tracking-widest uppercase">ROUND {room.round} COMPLETED</div>
            <div className="font-display italic text-3xl sm:text-4xl mt-1">
              {room.winner ? `${room.winner.name} wins!` : 'Stalemate / Draw!'}
            </div>
            {room.winner && (
              <div className="font-mono text-xs text-white/80 mt-1">
                {room.winner.passed}/{room.winner.total} tests passing in {room.winner.completion_time}s
              </div>
            )}
          </div>

          {/* Crowd Callout Box */}
          {room.crowd_callout && (
            <div className="bg-[#CCFF00] border-b-2 border-black p-3 text-center">
              <div className="font-heading font-extrabold text-sm sm:text-base leading-tight uppercase">
                ⚡ {room.crowd_callout.headline}
              </div>
              <div className="font-hand text-xs text-black/80 mt-0.5">
                {room.crowd_callout.subtitle}
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          <div className="p-3">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1">🏆 CROWD LEADERBOARD</span>
              <span className="text-[10px] text-black/60 font-mono">SCORES</span>
            </div>
            <div className="border border-black divide-y border-black bg-white">
              {room.leaderboard && room.leaderboard.length > 0 ? (
                room.leaderboard.map((entry, idx) => (
                  <div key={entry.id || idx} className="flex justify-between items-center px-2.5 py-1.5 text-xs font-bold">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 flex items-center justify-center border border-black text-[10px] shrink-0 ${
                        idx === 0 ? 'bg-[#CCFF00] text-black font-extrabold' : 'bg-paper text-black'
                      }`}>
                        #{idx + 1}
                      </span>
                      <span className="truncate max-w-[150px]">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.round_points > 0 && (
                        <span className="text-[10px] bg-[#CCFF00] text-black px-1 border border-black font-mono">
                          +{entry.round_points}
                        </span>
                      )}
                      <span className="font-mono text-xs">{entry.score} PTS</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center font-hand text-xs text-black/60">
                  No predictions recorded.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 1. WINNER GUESS (+100 PTS) */}
      <section className="border-b-2 border-black bg-white">
        <div className="px-3 py-2 border-b-2 border-black flex justify-between items-center bg-paper">
          <div>
            <span className="font-heading font-extrabold text-xs tracking-wider">1. GUESS THE WINNER</span>
            <span className="ml-2 font-hand text-xs text-black/70">+100 PTS</span>
          </div>
          {predictedWinner && (
            <span className="bg-[#CCFF00] border border-black text-black px-2 py-0.5 text-[10px] font-bold uppercase shadow-[1px_1px_0px_#000]">
              LOCKED IN: {predictedWinner === 'player_1' ? (p1?.name || 'P1') : (p2?.name || 'P2')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 divide-x-2 divide-black">
          {/* Player 1 Option */}
          <button
            type="button"
            disabled={Boolean(predictedWinner) || room.status !== 'ACTIVE'}
            onClick={() => handlePredictWinner('player_1')}
            className={`p-3 text-left transition-colors flex flex-col justify-between ${
              predictedWinner === 'player_1'
                ? 'bg-[#CCFF00] text-black font-extrabold'
                : predictedWinner
                  ? 'bg-paper opacity-50 cursor-not-allowed'
                  : 'bg-white hover:bg-black hover:text-white cursor-pointer active:scale-[0.99]'
            }`}
          >
            <div className="flex items-center gap-2">
              <DoodlePlayer1 size={28} />
              <div className="min-w-0">
                <div className="text-[10px] font-mono opacity-60">PLAYER 1</div>
                <div className="font-bold text-xs sm:text-sm truncate">{p1?.name || 'Player 1'}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-between items-end">
              <span className="text-[10px] font-mono font-bold">{a} bets</span>
              <span className="font-mono text-sm font-extrabold">{aPct}%</span>
            </div>
          </button>

          {/* Player 2 Option */}
          <button
            type="button"
            disabled={Boolean(predictedWinner) || room.status !== 'ACTIVE'}
            onClick={() => handlePredictWinner('player_2')}
            className={`p-3 text-left transition-colors flex flex-col justify-between ${
              predictedWinner === 'player_2'
                ? 'bg-[#CCFF00] text-black font-extrabold'
                : predictedWinner
                  ? 'bg-paper opacity-50 cursor-not-allowed'
                  : 'bg-white hover:bg-black hover:text-white cursor-pointer active:scale-[0.99]'
            }`}
          >
            <div className="flex items-center gap-2">
              <DoodlePlayer2 size={28} />
              <div className="min-w-0">
                <div className="text-[10px] font-mono opacity-60">PLAYER 2</div>
                <div className="font-bold text-xs sm:text-sm truncate">{p2?.name || 'Player 2'}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-between items-end">
              <span className="text-[10px] font-mono font-bold">{b} bets</span>
              <span className="font-mono text-sm font-extrabold">{100 - aPct}%</span>
            </div>
          </button>
        </div>

        {/* Live Tug-of-War Bar */}
        <div className="border-t-2 border-black p-2.5 bg-paper">
          <div className="flex justify-between text-[11px] font-bold mb-1">
            <span>{p1?.name || 'PLAYER 1'}: {aPct}%</span>
            <span className="font-hand text-[10px] text-black/60">CROWD TALLY</span>
            <span>{p2?.name || 'PLAYER 2'}: {100 - aPct}%</span>
          </div>
          <div className="flex h-3.5 sm:h-4 border border-black bg-white shadow-[1px_1px_0px_#000]">
            <div className="bg-black transition-all duration-300" style={{ width: `${aPct}%` }} />
            <div className="hatch flex-1" />
          </div>
        </div>
      </section>

      {/* 2. BUG GUESSING (+50 PTS) */}
      <section className="border-b-2 border-black bg-white">
        <div className="px-3 py-2 border-b-2 border-black flex justify-between items-center bg-paper">
          <div>
            <span className="font-heading font-extrabold text-xs tracking-wider">2. GUESS THE BUG TYPE</span>
            <span className="ml-2 font-hand text-xs text-black/70">+50 PTS</span>
          </div>
          {guessedBug && (
            <span className="bg-[#CCFF00] border border-black text-black px-2 py-0.5 text-[10px] font-bold uppercase shadow-[1px_1px_0px_#000]">
              LOCKED IN: {guessedBug.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="divide-y divide-black">
          {BUG_OPTIONS.map((opt) => {
            const count = bugGuesses[opt.id] || 0;
            const pct = totalBugGuesses > 0 ? Math.round((count / totalBugGuesses) * 100) : 0;
            const isSelected = guessedBug === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                disabled={Boolean(guessedBug) || room.status !== 'ACTIVE'}
                onClick={() => handleGuessBug(opt.id)}
                className={`w-full p-2.5 text-left transition-colors relative flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#CCFF00] text-black font-extrabold'
                    : guessedBug
                      ? 'bg-white opacity-60 cursor-not-allowed'
                      : 'bg-white hover:bg-black hover:text-white cursor-pointer'
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-black/5 pointer-events-none"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative min-w-0 pr-2">
                  <div className="font-bold text-xs">{opt.label}</div>
                  <div className="font-hand text-[10px] opacity-75 truncate">{opt.hint}</div>
                </div>
                <div className="relative font-mono text-xs font-bold shrink-0">
                  {pct}% ({count})
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. VOTE NEXT ROUND BUG CATEGORY */}
      <section className="border-b-2 border-black bg-white">
        <div className="px-3 py-2 border-b-2 border-black flex justify-between items-center bg-paper">
          <div>
            <span className="font-heading font-extrabold text-xs tracking-wider">3. VOTE NEXT ROUND'S BUG</span>
            <span className="ml-2 font-hand text-xs text-black/70">crowd power</span>
          </div>
          {votedNextBug && (
            <span className="bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase">
              VOTED: {votedNextBug.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="divide-y divide-black">
          {BUG_OPTIONS.map((opt) => {
            const count = nextBugVotes[opt.id] || 0;
            const pct = totalNextVotes > 0 ? Math.round((count / totalNextVotes) * 100) : 0;
            const isVoted = votedNextBug === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                disabled={Boolean(votedNextBug)}
                onClick={() => handleVoteNextBug(opt.id)}
                className={`w-full p-2.5 text-left transition-colors relative flex items-center justify-between ${
                  isVoted
                    ? 'bg-black text-white font-extrabold'
                    : votedNextBug
                      ? 'bg-white opacity-60 cursor-not-allowed'
                      : 'bg-white hover:bg-black hover:text-white cursor-pointer'
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-[#CCFF00]/20 pointer-events-none"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative min-w-0 pr-2">
                  <div className="font-bold text-xs">{opt.label}</div>
                  <div className="font-hand text-[10px] opacity-75 truncate">{opt.hint}</div>
                </div>
                <div className="relative font-mono text-xs font-bold shrink-0">
                  {pct}% ({count})
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Local floating reactions */}
      {localEmotes.map((e) => (
        <div
          key={e.id}
          className="fixed bottom-24 text-3xl pointer-events-none transition-all duration-1000 ease-out animate-in fade-in slide-in-from-bottom-12 z-50"
          style={{ left: `${e.x}%`, transform: 'translateY(-80px)' }}
        >
          {e.icon}
        </div>
      ))}

      {/* Bottom Floating Reaction Bar */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-xl mx-auto border-t-2 border-black bg-white p-2 flex items-center justify-between gap-1 shadow-[0px_-2px_0px_#000] z-40">
        <div className="flex items-center gap-1.5 px-2">
          <Crowd count={Math.min(room.spectator_count, 6)} size={24} />
          <span className="font-hand text-[11px] font-bold text-black/75 hidden sm:inline">
            CHEER:
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {REACTION_EMOTES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSpamReaction(r.icon)}
              className={`border border-black px-2.5 py-1 text-sm font-bold bg-paper hover:bg-black hover:text-white transition-transform active:scale-90 cursor-pointer shadow-[1px_1px_0px_#000] ${
                activeReaction === r.icon ? 'scale-125 bg-[#CCFF00]' : ''
              }`}
              title={`React ${r.label}`}
            >
              {r.icon}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
