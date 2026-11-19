import { useEffect, useState } from 'react';
import type { BugCategory, PlayerSlot } from '../types';
import { formatClock } from '../hooks/useWebSocket';
import type { RoomSession } from '../hooks/useWebSocket';
import { Crowd, DoodlePlayer1, DoodlePlayer2, DoodleBug } from '../components/Doodles';

const BUG_OPTIONS: { id: BugCategory; label: string; hint: string }[] = [
  { id: 'off_by_one', label: 'OFF-BY-ONE', hint: 'range() / index slips by 1' },
  { id: 'inverted_condition', label: 'INVERTED LOGIC', hint: 'if flips to if not' },
  { id: 'arithmetic', label: 'BROKEN MATH', hint: '+ becomes -, * becomes //' },
];

function Bar({ passed, total }: { passed: number; total: number }) {
  return (
    <div className="flex gap-0 b h-5 w-full">
      {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
        <div key={i} className={`flex-1 ${i < passed ? 'bg-black' : 'bg-paper'} ${i > 0 ? 'bl' : ''}`} />
      ))}
    </div>
  );
}

export default function SpectatorView({ session }: { session: RoomSession }) {
  const { roomState: room, isConnected, secondsLeft, votePrediction, voteNextBug } = session;
  const [predicted, setPredicted] = useState<PlayerSlot | null>(null);
  const [votedBug, setVotedBug] = useState<BugCategory | null>(null);
  const round = room?.round;

  // New round: votes reset on the server, so reset local locks too
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
    votePrediction(t);
  };
  const vote = (c: BugCategory) => {
    if (votedBug) return;
    setVotedBug(c);
    voteNextBug(c);
  };

  return (
    <div className="min-h-dvh bg-paper text-black border-x-[1.5px] border-black max-w-xl mx-auto flex flex-col">
      <header className="bb flex items-stretch justify-between">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="font-heading font-extrabold text-lg">BUGARENA</span>
          <DoodleBug size={22} />
        </div>
        <div className="bl px-3 flex items-center font-bold text-sm">ROOM {room.room_code}</div>
      </header>

      <div className="grid grid-cols-3 bb text-center">
        <div className="br py-2">
          <div className="font-hand text-xs">STATUS</div>
          <div className="font-bold text-sm">{room.status}</div>
        </div>
        <div className="br py-2">
          <div className="font-hand text-xs">TIME</div>
          <div className="font-bold text-sm">{formatClock(secondsLeft)}</div>
        </div>
        <div className="py-2">
          <div className="font-hand text-xs">ROUND</div>
          <div className="font-bold text-sm">{room.round}</div>
        </div>
      </div>

      {/* Live progress */}
      <section className="bb p-3 flex flex-col gap-3">
        {[p1, p2].map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            {i === 0 ? <DoodlePlayer1 size={44} /> : <DoodlePlayer2 size={44} />}
            <div className="flex-1">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>{p ? p.name : `PLAYER ${i + 1}: waiting...`}</span>
                <span>{p ? `${p.passed}/${p.total}` : '-'}</span>
              </div>
              <Bar passed={p?.passed ?? 0} total={p?.total ?? room.problem.test_cases.length} />
            </div>
          </div>
        ))}
      </section>

      {room.status === 'FINISHED' && (
        <section className="bb bg-black text-white p-3 text-center">
          <div className="font-display italic text-3xl">
            {room.winner ? `${room.winner.name} wins!` : 'Draw!'}
          </div>
          <div className="font-hand text-sm">Vote the next bug below. Host hits NEXT ROUND.</div>
        </section>
      )}

      {/* Predict winner */}
      <section className="bb">
        <h2 className="font-heading font-extrabold text-sm px-3 py-2 bb">PREDICT WINNER</h2>
        <div className="grid grid-cols-2">
          {(['player_1', 'player_2'] as PlayerSlot[]).map((slot, i) => {
            const pl = room.players[i];
            const chosen = predicted === slot;
            return (
              <button
                key={slot}
                disabled={!!predicted}
                onClick={() => predict(slot)}
                className={`py-4 px-2 font-bold text-sm ${i === 0 ? 'br' : ''} ${
                  chosen ? 'bg-black text-white' : 'bg-paper text-black'
                } ${predicted && !chosen ? 'opacity-40' : 'cursor-pointer hover:bg-black hover:text-white'}`}
              >
                {pl ? pl.name : `PLAYER ${i + 1}`}
                <div className="font-hand font-normal text-xs">{chosen ? 'locked in!' : 'tap to bet'}</div>
              </button>
            );
          })}
        </div>
        <div className="flex h-4 bt">
          <div className="bg-black transition-all" style={{ width: `${aPct}%` }} />
          <div className="hatch flex-1" />
        </div>
        <div className="flex justify-between text-[11px] px-3 py-1 font-bold">
          <span>{aPct}%</span>
          <span>{100 - aPct}%</span>
        </div>
      </section>

      {/* Vote next bug */}
      <section className="bb">
        <h2 className="font-heading font-extrabold text-sm px-3 py-2 bb">VOTE NEXT BUG</h2>
        {BUG_OPTIONS.map((o, i) => {
          const n = room.next_bug_votes[o.id] ?? 0;
          const pct = bugTotal ? Math.round((n / bugTotal) * 100) : 0;
          const chosen = votedBug === o.id;
          return (
            <button
              key={o.id}
              disabled={!!votedBug}
              onClick={() => vote(o.id)}
              className={`relative w-full text-left px-3 py-3 ${i > 0 ? 'bt' : ''} bg-paper ${
                votedBug ? '' : 'cursor-pointer hover:bg-black/5'
              }`}
            >
              <div className="absolute inset-y-0 left-0 bg-black/15" style={{ width: `${pct}%` }} />
              <div className="relative flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm">
                    {chosen ? '[x] ' : '[ ] '}
                    {o.label}
                  </div>
                  <div className="font-hand text-xs">{o.hint}</div>
                </div>
                <div className="font-bold text-sm">{n}</div>
              </div>
            </button>
          );
        })}
      </section>

      <footer className="mt-auto px-3 py-2 flex items-center justify-between">
        <Crowd count={Math.min(room.spectator_count, 6)} size={28} />
        <span className="text-[11px] font-bold">
          {isConnected ? `${room.spectator_count} WATCHING` : 'RECONNECTING...'}
        </span>
      </footer>
    </div>
  );
}
