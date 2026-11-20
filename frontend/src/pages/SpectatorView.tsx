import { useEffect, useState } from 'react';
import type { BugCategory, PlayerSlot } from '../types';
import { formatClock } from '../hooks/useWebSocket';
import type { RoomSession } from '../hooks/useWebSocket';
import { Crowd, DoodlePlayer1, DoodlePlayer2, DoodleBug } from '../components/Doodles';

const BUG_OPTIONS: { id: BugCategory; label: string; hint: string }[] = [
  { id: 'off_by_one', label: 'OFF-BY-ONE', hint: 'range() / index slips by 1' },
  { id: 'inverted_condition', label: 'INVERTED LOGIC', hint: 'if flips to if not / wrong condition' },
  { id: 'arithmetic', label: 'BROKEN MATH', hint: '+ becomes -, * becomes //' },
];

function Bar({ passed, total }: { passed: number; total: number }) {
  return (
    <div className="flex gap-0 b h-5 w-full bg-paper">
      {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
        <div key={i} className={`flex-1 ${i < passed ? 'bg-black' : 'bg-paper'} ${i > 0 ? 'bl' : ''}`} />
      ))}
    </div>
  );
}

export default function SpectatorView({ session }: { session: RoomSession }) {
  const { roomState: room, isConnected, secondsLeft, votePrediction, guessBug, voteNextBug } = session;
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
    votePrediction(slot);
  };

  const handleGuessBug = (cat: BugCategory) => {
    if (guessedBug || room.status !== 'ACTIVE') return;
    setGuessedBug(cat);
    sessionStorage.setItem(`ba_b_${roomCode}_${round}`, cat);
    guessBug(cat);
  };

  const handleVoteNextBug = (cat: BugCategory) => {
    if (votedNextBug) return;
    setVotedNextBug(cat);
    sessionStorage.setItem(`ba_n_${roomCode}_${round}`, cat);
    voteNextBug(cat);
  };

  // Score computation for this spectator
  const winningSlot = room.winner?.player_index;
  const actualBug = room.problem?.mutation_category;
  const wasWinnerCorrect = !!(winningSlot && predictedWinner === winningSlot);
  const wasBugCorrect = !!(actualBug && guessedBug === actualBug);
  const roundPoints = (wasWinnerCorrect ? 100 : 0) + (wasBugCorrect ? 150 : 0);

  return (
    <div className="min-h-dvh bg-paper text-black border-x-0 sm:border-x-[1.5px] border-black max-w-xl mx-auto flex flex-col pb-8">
      {/* Header */}
      <header className="bb flex items-stretch justify-between bg-paper sticky top-0 z-20">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="font-heading font-extrabold text-base sm:text-lg">BUGARENA</span>
          <DoodleBug size={20} />
        </div>
        <div className="bl px-3 flex items-center font-bold text-xs sm:text-sm bg-[#CCFF00] border-l-[1.5px] border-black">
          ROOM {room.room_code}
        </div>
      </header>

      {/* Match Meta Bar */}
      <div className="grid grid-cols-3 bb text-center bg-paper">
        <div className="br py-2">
          <div className="font-hand text-[11px] sm:text-xs text-black/70">STATUS</div>
          <div className="font-bold text-xs sm:text-sm">
            {room.status === 'WAITING' ? 'LOBBY' : room.status === 'ACTIVE' ? 'LIVE DUEL' : 'FINISHED'}
          </div>
        </div>
        <div className="br py-2">
          <div className="font-hand text-[11px] sm:text-xs text-black/70">TIME</div>
          <div className="font-bold text-xs sm:text-sm">{formatClock(secondsLeft)}</div>
        </div>
        <div className="py-2">
          <div className="font-hand text-[11px] sm:text-xs text-black/70">ROUND</div>
          <div className="font-bold text-xs sm:text-sm">{room.round}</div>
        </div>
      </div>

      {/* Live Duelists Progress */}
      <section className="bb p-3 flex flex-col gap-3 bg-white">
        <div className="flex justify-between items-center">
          <span className="font-heading font-extrabold text-xs tracking-wider">DUEL PROGRESS</span>
          <span className="font-hand text-xs">{room.problem.title}</span>
        </div>
        {[p1, p2].map((p, i) => (
          <div key={i} className="flex items-center gap-2.5 sm:gap-3">
            {i === 0 ? <DoodlePlayer1 size={40} /> : <DoodlePlayer2 size={40} />}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="truncate">{p ? p.name : `PLAYER ${i + 1}: waiting...`}</span>
                <span className="ml-2 shrink-0">{p ? `${p.passed}/${p.total}` : '-'}</span>
              </div>
              <Bar passed={p?.passed ?? 0} total={p?.total ?? room.problem.test_cases.length} />
            </div>
          </div>
        ))}
      </section>

      {/* END-OF-ROUND FINISHED RESULTS & LEADERBOARD */}
      {room.status === 'FINISHED' && (
        <section className="bb bg-white flex flex-col">
          {/* Winner Banner */}
          <div className="bg-black text-white p-4 text-center">
            <div className="font-hand text-xs text-[#CCFF00] tracking-widest uppercase">ROUND {room.round} COMPLETED</div>
            <div className="font-display italic text-3xl sm:text-4xl mt-1">
              {room.winner ? `${room.winner.name} wins!` : 'Stalemate / Draw!'}
            </div>
            {room.winner && (
              <div className="text-xs font-mono mt-1 text-white/80">
                Solved in {room.winner.completion_time}s ({room.winner.passed}/{room.winner.total} tests)
              </div>
            )}
          </div>

          {/* Crowd Accuracy vs. Duelists Callout */}
          {room.crowd_callout && (
            <div className="m-3 p-3.5 bg-[#CCFF00] text-black border-2 border-black">
              <div className="flex items-center gap-1.5 font-heading font-extrabold text-base sm:text-lg leading-tight uppercase tracking-tight">
                <span>⚡</span>
                <span>{room.crowd_callout.headline}</span>
              </div>
              <div className="font-hand text-xs mt-1 leading-snug">
                {room.crowd_callout.subtitle}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-black text-[11px] font-bold">
                <div>WINNER PICK: {room.crowd_callout.winner_pct}%</div>
                <div>BUG GUESS: {room.crowd_callout.bug_pct}%</div>
              </div>
            </div>
          )}

          {/* Spectator Personal Score Breakdown */}
          <div className="mx-3 mb-3 p-3 b bg-paper">
            <div className="flex justify-between items-center bb pb-1.5 mb-2">
              <span className="font-heading font-extrabold text-xs tracking-wider">YOUR ROUND SCORE</span>
              <span className="bg-[#CCFF00] text-black border border-black px-2 py-0.5 font-bold font-mono text-xs">
                +{roundPoints} PTS
              </span>
            </div>
            <div className="flex justify-between items-center text-xs py-1">
              <span>Winner Pick: <strong className="uppercase">{predictedWinner ? (predictedWinner === 'player_1' ? (p1?.name || 'Player 1') : (p2?.name || 'Player 2')) : 'None'}</strong></span>
              <span className={`font-bold ${wasWinnerCorrect ? 'text-black' : 'text-black/60'}`}>
                {wasWinnerCorrect ? '✓ CORRECT (+100)' : predictedWinner ? '✗ MISSED (0)' : 'NO GUESS'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs py-1">
              <span>Bug Pick: <strong className="uppercase">{guessedBug ? guessedBug.replace('_', ' ') : 'None'}</strong></span>
              <span className={`font-bold ${wasBugCorrect ? 'text-black' : 'text-black/60'}`}>
                {wasBugCorrect ? '✓ CORRECT (+150)' : guessedBug ? '✗ MISSED (0)' : 'NO GUESS'}
              </span>
            </div>
          </div>

          {/* Top Crowd Predictors Leaderboard */}
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-heading font-extrabold text-xs tracking-wider uppercase">TOP CROWD PREDICTORS</h2>
              <span className="font-hand text-xs">Live Standings</span>
            </div>
            <div className="b bg-white">
              {room.leaderboard && room.leaderboard.length > 0 ? (
                room.leaderboard.slice(0, 5).map((entry, idx) => {
                  const isMe = entry.id === session.clientId;
                  return (
                    <div
                      key={entry.id || idx}
                      className={`flex items-center justify-between px-3 py-2 text-xs font-bold ${
                        idx > 0 ? 'bt' : ''
                      } ${isMe ? 'bg-[#CCFF00]/30' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 flex items-center justify-center border border-black text-[10px] shrink-0 ${
                            idx === 0 ? 'bg-[#CCFF00] text-black font-extrabold' : 'bg-paper text-black'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <span className="truncate">
                          {entry.name} {isMe ? '(You)' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.round_points > 0 && (
                          <span className="text-[10px] bg-black text-white px-1 font-mono">
                            +{entry.round_points}
                          </span>
                        )}
                        <span className="font-mono text-xs">{entry.score} PTS</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs font-hand text-black/60">
                  No predictions recorded for this round.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 1. WINNER GUESS (+100 PTS) */}
      <section className="bb bg-white">
        <div className="px-3 py-2 bb flex justify-between items-center bg-paper">
          <div>
            <span className="font-heading font-extrabold text-xs tracking-wider">1. GUESS THE WINNER</span>
            <span className="ml-2 font-hand text-xs text-black/70">+100 PTS</span>
          </div>
          {predictedWinner && (
            <span className="bg-[#CCFF00] border border-black text-black px-2 py-0.5 text-[10px] font-bold uppercase">
              LOCKED IN: {predictedWinner === 'player_1' ? (p1?.name || 'P1') : (p2?.name || 'P2')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2">
          {(['player_1', 'player_2'] as PlayerSlot[]).map((slot, i) => {
            const pl = room.players[i];
            const chosen = predictedWinner === slot;
            const disabled = !!predictedWinner || room.status !== 'ACTIVE';
            return (
              <button
                key={slot}
                disabled={disabled}
                onClick={() => handlePredictWinner(slot)}
                className={`py-3.5 sm:py-4 px-2 font-bold text-xs sm:text-sm transition-colors ${i === 0 ? 'br' : ''} ${
                  chosen
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-black/5'
                } ${predictedWinner && !chosen ? 'opacity-35 cursor-not-allowed' : disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="uppercase tracking-tight truncate">{pl ? pl.name : `PLAYER ${i + 1}`}</div>
                <div className="font-hand font-normal text-[11px] sm:text-xs mt-0.5">
                  {chosen ? '✓ locked in (+100 pts)' : disabled ? 'predictions closed' : 'tap to pick winner'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Tug-of-War Bar */}
        <div className="bt p-2.5 bg-paper">
          <div className="flex justify-between text-[11px] font-bold mb-1">
            <span>{p1?.name || 'PLAYER 1'}: {aPct}%</span>
            <span className="font-hand text-[10px] text-black/60">CROWD TALLY</span>
            <span>{p2?.name || 'PLAYER 2'}: {100 - aPct}%</span>
          </div>
          <div className="flex h-3.5 sm:h-4 b bg-white">
            <div className="bg-black transition-all duration-300" style={{ width: `${aPct}%` }} />
            <div className="hatch flex-1" />
          </div>
        </div>
      </section>

      {/* 2. CURRENT BUG GUESS (+150 PTS) */}
      <section className="bb bg-white">
        <div className="px-3 py-2 bb flex justify-between items-center bg-paper">
          <div>
            <span className="font-heading font-extrabold text-xs tracking-wider">2. GUESS THE BUG</span>
            <span className="ml-2 font-hand text-xs text-black/70">+150 PTS</span>
          </div>
          {guessedBug && (
            <span className="bg-[#CCFF00] border border-black text-black px-2 py-0.5 text-[10px] font-bold uppercase">
              LOCKED IN: {guessedBug.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="p-2 text-xs font-hand text-black/70">
          What glitch is lurking in the code? Spot it before duelists finish:
        </div>

        {BUG_OPTIONS.map((o, i) => {
          const count = bugGuesses[o.id] ?? 0;
          const pct = totalBugGuesses > 0 ? Math.round((count / totalBugGuesses) * 100) : 0;
          const chosen = guessedBug === o.id;
          const disabled = !!guessedBug || room.status !== 'ACTIVE';
          return (
            <button
              key={o.id}
              disabled={disabled}
              onClick={() => handleGuessBug(o.id)}
              className={`relative w-full text-left px-3 py-3 ${i > 0 ? 'bt' : ''} bg-white transition-colors ${
                chosen ? 'bg-[#CCFF00]/25' : ''
              } ${disabled && !chosen ? 'opacity-40 cursor-not-allowed' : disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-black/5'}`}
            >
              {/* Live Crowd Guess % Indicator */}
              <div className="absolute inset-y-0 left-0 bg-black/10" style={{ width: `${pct}%` }} />
              <div className="relative flex justify-between items-center">
                <div>
                  <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                    <span>{chosen ? '[x]' : '[ ]'}</span>
                    <span>{o.label}</span>
                    {chosen && (
                      <span className="ml-2 bg-black text-white px-1.5 py-0.2 text-[10px]">
                        LOCKED (+150)
                      </span>
                    )}
                  </div>
                  <div className="font-hand text-[11px] sm:text-xs text-black/70 mt-0.5">{o.hint}</div>
                </div>
                <div className="font-mono text-xs font-bold shrink-0 ml-2">
                  {pct}% ({count})
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* 3. VOTE NEXT ROUND BUG CATEGORY */}
      <section className="bb bg-white">
        <div className="px-3 py-2 bb flex justify-between items-center bg-paper">
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

        {BUG_OPTIONS.map((o, i) => {
          const count = nextBugVotes[o.id] ?? 0;
          const pct = totalNextVotes > 0 ? Math.round((count / totalNextVotes) * 100) : 0;
          const chosen = votedNextBug === o.id;
          return (
            <button
              key={o.id}
              disabled={!!votedNextBug}
              onClick={() => handleVoteNextBug(o.id)}
              className={`relative w-full text-left px-3 py-2.5 ${i > 0 ? 'bt' : ''} bg-white transition-colors ${
                votedNextBug ? 'cursor-default' : 'cursor-pointer hover:bg-black/5'
              }`}
            >
              <div className="absolute inset-y-0 left-0 bg-black/10" style={{ width: `${pct}%` }} />
              <div className="relative flex justify-between items-center">
                <div>
                  <div className="font-bold text-xs sm:text-sm">
                    {chosen ? '● ' : '○ '}
                    {o.label}
                  </div>
                </div>
                <div className="font-mono text-xs font-bold">
                  {pct}% ({count})
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Footer crowd counter */}
      <footer className="mt-auto px-4 py-3 flex items-center justify-between bg-paper border-t border-black/15 sm:border-t-0">
        <Crowd count={Math.min(room.spectator_count, 6)} size={28} />
        <span className="text-[11px] font-bold tracking-wider">
          {isConnected ? `${room.spectator_count} IN THE CROWD` : '[!] RECONNECTING...'}
        </span>
      </footer>
    </div>
  );
}
