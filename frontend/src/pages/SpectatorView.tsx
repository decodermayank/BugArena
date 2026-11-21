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
    <div className="flex gap-0 border-2 border-black h-5 w-full bg-paper">
      {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 ${i < passed ? 'bg-black' : 'bg-paper'} ${
            i > 0 ? 'border-l-2 border-black' : ''
          }`}
        />
      ))}
    </div>
  );
}

export default function SpectatorView({ session }: { session: RoomSession }) {
  const { roomState: room, isConnected, secondsLeft, votePrediction, voteNextBug, sendEmote } = session;
  const [predicted, setPredicted] = useState<PlayerSlot | null>(null);
  const [votedBug, setVotedBug] = useState<BugCategory | null>(null);
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [localEmotes, setLocalEmotes] = useState<{ id: number; icon: string; x: number }[]>([]);
  const round = room?.round;

  // New round: reset local locks
  useEffect(() => {
    setPredicted(null);
    setVotedBug(null);
  }, [round]);

  if (!room) return null;
  const [p1, p2] = room.players;
  const a = room.predictions.player_1;
  const b = room.predictions.player_2;
  const aPct = a + b === 0 ? 50 : Math.round((a / (a + b)) * 100);
  const bugTotal = Object.values(room.next_bug_votes).reduce((x, y) => x + y, 0);

  const predict = (t: PlayerSlot) => {
    if (predicted) return;
    setPredicted(t);
    soundFx.playThump();
    votePrediction(t);
  };

  const vote = (c: BugCategory) => {
    if (votedBug) return;
    setVotedBug(c);
    soundFx.playThump();
    voteNextBug(c);
  };

  const handleSpamReaction = (icon: string) => {
    soundFx.playEmotePop();
    setActiveReaction(icon);
    setTimeout(() => setActiveReaction(null), 180);

    // Send to WebSocket
    sendEmote(icon);

    // Local animated floater
    const id = Date.now() + Math.random();
    const x = 20 + Math.random() * 60;
    setLocalEmotes((prev) => [...prev, { id, icon, x }]);
    setTimeout(() => {
      setLocalEmotes((prev) => prev.filter((e) => e.id !== id));
    }, 2000);
  };

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-black border-x-0 sm:border-x-2 border-black max-w-xl mx-auto flex flex-col relative overflow-x-hidden select-none">
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

      {/* Live Challenger Progress */}
      <section className="border-b-2 border-black p-3.5 flex flex-col gap-3 bg-white">
        <div className="flex items-center justify-between text-xs font-bold text-black/70">
          <span>LIVE CHALLENGERS</span>
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

      {/* Victory Banner */}
      {room.status === 'FINISHED' && (
        <section className="border-b-2 border-black bg-black text-white p-4 text-center">
          <div className="font-display italic text-2xl sm:text-3xl">
            {room.winner ? `🏆 ${room.winner.name} wins!` : '🤝 Match Draw!'}
          </div>
          <div className="font-hand text-xs sm:text-sm mt-1 text-white/80">
            Vote next bug sabotage below! Host hits NEXT ROUND.
          </div>
        </section>
      )}

      {/* Tactile Big-Buzzer Betting */}
      <section className="border-b-2 border-black bg-white">
        <div className="px-3 py-2 border-b-2 border-black flex items-center justify-between bg-[#f6f6f6]">
          <h2 className="font-heading font-extrabold text-xs sm:text-sm">PREDICT THE WINNER</h2>
          <span className="font-hand text-xs text-black/60">tap buzzer to place bet</span>
        </div>

        <div className="grid grid-cols-2 p-2.5 gap-2.5">
          {(['player_1', 'player_2'] as PlayerSlot[]).map((slot, i) => {
            const pl = room.players[i];
            const isChosen = predicted === slot;
            const odds = slot === 'player_1' ? aPct : 100 - aPct;
            const Face = i === 0 ? DoodlePlayer1 : DoodlePlayer2;

            return (
              <button
                key={slot}
                disabled={!!predicted}
                onClick={() => predict(slot)}
                className={`border-2 border-black p-3 flex flex-col items-center justify-center transition-all ${
                  isChosen
                    ? 'bg-black text-white shadow-[3px_3px_0px_#000] scale-[1.02]'
                    : predicted
                      ? 'bg-paper text-black/40 opacity-50'
                      : 'bg-white text-black hover:bg-black/5 active:scale-95 shadow-[2px_2px_0px_#000] cursor-pointer'
                }`}
              >
                <Face size={40} className="mb-1" />
                <div className="font-heading font-extrabold text-xs sm:text-sm truncate max-w-full">
                  {pl ? pl.name : `PLAYER ${i + 1}`}
                </div>
                <div className="font-mono text-xs font-bold mt-0.5">{odds}% ODDS</div>
                <div className="font-hand text-[11px] mt-1">
                  {isChosen ? '✓ LOCKED IN' : 'TAP TO BET'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Prediction Tug Split */}
        <div className="flex h-3 border-t-2 border-black">
          <div className="bg-black transition-all" style={{ width: `${aPct}%` }} />
          <div className="hatch flex-1" />
        </div>
      </section>

      {/* Vote Next Sabotage Bug */}
      <section className="border-b-2 border-black bg-white">
        <div className="px-3 py-2 border-b-2 border-black flex items-center justify-between bg-[#f6f6f6]">
          <h2 className="font-heading font-extrabold text-xs sm:text-sm">VOTE NEXT BUG SABOTAGE</h2>
          <span className="font-hand text-xs text-black/60">audience sabotage</span>
        </div>

        <div className="divide-y-2 border-b-2 border-black">
          {BUG_OPTIONS.map((o) => {
            const n = room.next_bug_votes[o.id] ?? 0;
            const pct = bugTotal ? Math.round((n / bugTotal) * 100) : 0;
            const chosen = votedBug === o.id;

            return (
              <button
                key={o.id}
                disabled={!!votedBug}
                onClick={() => vote(o.id)}
                className={`relative w-full text-left px-3 py-3 transition-colors ${
                  chosen ? 'bg-black text-white' : 'bg-paper text-black hover:bg-black/5 cursor-pointer'
                }`}
              >
                {!chosen && (
                  <div
                    className="absolute inset-y-0 left-0 bg-black/10 transition-all pointer-events-none"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex justify-between items-center">
                  <div>
                    <div className="font-bold text-xs sm:text-sm">
                      {chosen ? '[✓] ' : '[ ] '}
                      {o.label}
                    </div>
                    <div
                      className={`font-hand text-[11px] sm:text-xs ${
                        chosen ? 'text-white/80' : 'text-black/70'
                      }`}
                    >
                      {o.hint}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-xs sm:text-sm shrink-0 ml-2">
                    {n} votes ({pct}%)
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live Floating Reaction Spammer Bar */}
      <section className="p-3 bg-[#FAFAFA] flex flex-col gap-1.5 border-b-2 border-black">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="font-hand text-xs text-black/75">LIVE ARENA REACTION SPAMMER:</span>
          <span className="text-[10px] font-mono text-black/60">floats on big projector</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {REACTION_EMOTES.map((em) => (
            <button
              key={em.id}
              type="button"
              onClick={() => handleSpamReaction(em.icon)}
              className={`border-2 border-black py-2.5 px-1 bg-white flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all shadow-[2px_2px_0px_#000] cursor-pointer ${
                activeReaction === em.icon ? 'bg-black text-white scale-95' : 'hover:bg-black/5'
              }`}
            >
              <span className="text-2xl leading-none">{em.icon}</span>
              <span className="font-heading font-extrabold text-[10px] tracking-wider">
                {em.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Local Floating Emotes */}
      {localEmotes.map((em) => (
        <div
          key={em.id}
          className="fixed bottom-24 text-3xl pointer-events-none transition-all duration-1000 ease-out animate-in fade-in slide-in-from-bottom-8 z-50"
          style={{ left: `${em.x}%`, transform: 'translateY(-100px)' }}
        >
          {em.icon}
        </div>
      ))}

      {/* Footer */}
      <footer className="mt-auto px-4 py-3 flex items-center justify-between bg-white text-[11px] font-bold">
        <div className="flex items-center gap-1.5">
          <Crowd count={Math.min(room.spectator_count, 5)} size={26} />
          <span className="text-black/60 hidden sm:inline">IN CROWD</span>
        </div>
        <span className="font-mono">
          {isConnected ? `● LIVE (${room.spectator_count} watching)` : '[!] OFFLINE'}
        </span>
      </footer>
    </div>
  );
}
