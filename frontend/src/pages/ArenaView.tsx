import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useWebSocket, formatClock } from '../hooks/useWebSocket';
import { Crowd, DoodleBug, DoodlePlayer1, DoodlePlayer2, InkArrow } from '../components/Doodles';
import type { PlayerState } from '../types';

function Progress({ player, total, slot }: { player?: PlayerState; total: number; slot: 1 | 2 }) {
  const passed = player?.passed ?? 0;
  const Face = slot === 1 ? DoodlePlayer1 : DoodlePlayer2;
  return (
    <div className="flex-1 min-h-0 p-4 flex flex-col justify-center gap-3">
      <div className="flex items-center gap-3">
        <Face size={72} />
        <div className="min-w-0">
          <div className="font-hand text-sm">PLAYER {slot}</div>
          <div className="font-heading font-extrabold text-3xl leading-none truncate">
            {player ? player.name : '- - -'}
          </div>
        </div>
        <div className="ml-auto font-display italic text-6xl leading-none">
          {passed}
          <span className="text-3xl">/{total}</span>
        </div>
      </div>
      <div className="flex b h-12">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`flex-1 ${i > 0 ? 'bl' : ''} ${i < passed ? 'bg-black' : 'bg-paper'}`} />
        ))}
      </div>
      <div className="text-xs h-4 truncate font-bold">
        {player?.error ? `[!] ${player.error.split('\n').pop()}` : player && !player.connected ? '[!] DISCONNECTED' : ''}
      </div>
    </div>
  );
}

export default function ArenaView() {
  const { roomCode = '' } = useParams();
  const s = useWebSocket({ roomCode, role: 'projector', nickname: 'Projector' });
  const room = s.roomState;

  if (s.error) {
    return (
      <div className="h-dvh flex items-center justify-center">
        <div className="b px-6 py-4 font-bold">[!] {s.error}</div>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="h-dvh flex items-center justify-center">
        <div className="b px-6 py-4 font-bold">CONNECTING...</div>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/join/${room.room_code}`;
  const total = room.problem.test_cases.length;
  const [p1, p2] = room.players;
  const a = room.predictions.player_1;
  const b = room.predictions.player_2;
  const aPct = a + b === 0 ? 50 : Math.round((a / (a + b)) * 100);
  const ticker = room.event_log.slice(-7).reverse();
  const low = room.status === 'ACTIVE' && s.secondsLeft <= 30;
  const bugVotes = room.next_bug_votes;
  const labels: Record<string, string> = {
    off_by_one: 'OFF-BY-ONE',
    inverted_condition: 'INVERTED LOGIC',
    arithmetic: 'BROKEN MATH',
  };

  return (
    <div className="h-dvh w-screen overflow-hidden bg-paper text-black grid grid-rows-[auto_1fr_auto] relative">
      {/* Top strip */}
      <header className="bb grid grid-cols-[1fr_auto_auto]">
        <div className="flex items-center gap-3 px-5 py-2">
          <span className="font-heading font-extrabold text-3xl">BUGARENA</span>
          <DoodleBug size={34} />
          <span className="font-hand ml-4">
            round {room.round}: {room.problem.title}
          </span>
        </div>
        <div className="bl px-5 flex items-center font-bold text-sm">
          {room.status === 'WAITING' ? 'LOBBY' : room.status === 'ACTIVE' ? 'LIVE' : 'FINISHED'}
          {!s.isConnected && <span className="ml-3">[!] OFFLINE</span>}
        </div>
        <div
          className={`bl px-8 flex items-center font-heading font-extrabold text-5xl tabular-nums ${
            low ? 'bg-black text-white blink' : room.status === 'ACTIVE' ? 'bg-black text-white' : ''
          }`}
        >
          {formatClock(s.secondsLeft)}
        </div>
      </header>

      {/* Chessboard main grid */}
      <main className="grid grid-cols-[minmax(260px,1fr)_2fr_minmax(240px,1fr)] min-h-0">
        {/* Code + QR */}
        <section className="br flex flex-col min-h-0">
          <div className="checker h-6 bb shrink-0" />
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4">
            <div className="font-hand text-sm">scan to join</div>
            <div className="b p-3 bg-white">
              <QRCodeSVG value={joinUrl} size={180} level="M" bgColor="#FFFFFF" fgColor="#000000" />
            </div>
            <div className="font-hand text-xs">or enter code</div>
            <div className="bg-[#CCFF00] text-black border-[1.5px] border-black px-3 py-1 font-heading font-extrabold text-6xl xl:text-7xl tracking-[0.12em] leading-none pl-[calc(0.75rem+0.12em)]">
              {room.room_code}
            </div>
            <div className="text-[10px] break-all text-center">{joinUrl}</div>
          </div>
        </section>

        {/* Versus */}
        <section className="flex flex-col min-h-0 br">
          <Progress player={p1} total={total} slot={1} />
          <div className="bt bb flex items-center justify-center py-1 relative">
            <span className="font-display italic text-4xl px-6 bg-paper">vs</span>
          </div>
          <Progress player={p2} total={total} slot={2} />

          <div className="bt p-3 flex items-center justify-between gap-3">
            <div className="text-xs font-bold">
              {room.players.length}/2 CHALLENGERS | {room.spectator_count} IN THE CROWD
            </div>
            {room.status === 'WAITING' && (
              <div className="flex items-center gap-2">
                <InkArrow width={70} />
                <button
                  className="btn-ink px-5 py-2 text-sm"
                  disabled={room.players.length < 1}
                  onClick={s.startMatch}
                >
                  START DUEL
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Ticker */}
        <section className="flex flex-col min-h-0">
          <div className="bb px-4 py-2 font-heading font-extrabold text-sm">LIVE TICKER</div>
          <ul className="flex-1 min-h-0 overflow-hidden text-xs">
            {ticker.map((line, i) => (
              <li key={`${room.event_log.length - i}`} className={`bb px-4 py-2 ${i === 0 ? 'bg-black text-white font-bold' : ''}`}>
                {i === 0 ? '> ' : ''}
                {line}
              </li>
            ))}
          </ul>
          <div className="bt px-4 py-2 font-heading font-extrabold text-sm">NEXT BUG VOTES</div>
          {Object.keys(labels).map((k) => (
            <div key={k} className="bt px-4 py-1 text-xs flex justify-between font-bold">
              <span>{labels[k]}</span>
              <span>{bugVotes[k as keyof typeof bugVotes] ?? 0}</span>
            </div>
          ))}
        </section>
      </main>

      {/* Crowd + tug of war */}
      <footer className="bt grid grid-cols-[minmax(260px,1fr)_3fr]">
        <div className="br px-4 py-2 flex items-end">
          <Crowd count={Math.min(room.spectator_count, 9)} size={44} />
          {room.spectator_count === 0 && <span className="font-hand text-sm">the crowd is empty...</span>}
        </div>
        <div className="px-4 py-2 flex flex-col justify-center gap-1">
          <div className="flex justify-between text-xs font-bold">
            <span>
              {p1?.name ?? 'P1'} ({a})
            </span>
            <span className="font-hand">CROWD PREDICTION</span>
            <span>
              ({b}) {p2?.name ?? 'P2'}
            </span>
          </div>
          <div className="flex b h-8">
            <div className="bg-black transition-all duration-500" style={{ width: `${aPct}%` }} />
            <div className="hatch flex-1" />
          </div>
        </div>
      </footer>

      {/* Victory screen */}
      {room.status === 'FINISHED' && (
        <div className="absolute inset-0 bg-paper flex flex-col items-center justify-center gap-4 text-center z-10 border-[1.5px] border-black m-3">
          <div className="font-hand text-lg">{room.finish_reason === 'timeout' ? "TIME'S UP" : 'BUG SQUASHED'}</div>
          <div className="font-display italic text-8xl leading-none">
            {room.winner ? `${room.winner.name} wins` : 'Draw'}
          </div>
          {room.winner && (
            <div className="font-bold">
              {room.winner.passed}/{room.winner.total} tests | {room.winner.completion_time}s
            </div>
          )}
          {room.problem.description_bug && (
            <div className="b px-4 py-2 text-sm max-w-2xl">
              <span className="font-bold">THE BUG: </span>
              {room.problem.description_bug}
            </div>
          )}
          <div className="flex items-center gap-3">
            <InkArrow width={100} />
            <button className="btn-ink px-10 py-4 text-xl" onClick={s.startNextRound}>
              NEXT ROUND
            </button>
          </div>
          <div className="font-hand text-sm">
            crowd vote:{' '}
            {Object.keys(labels)
              .map((k) => `${labels[k]} ${bugVotes[k as keyof typeof bugVotes] ?? 0}`)
              .join(' / ')}
          </div>
        </div>
      )}
    </div>
  );
}
