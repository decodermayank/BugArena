import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useWebSocket, formatClock } from '../hooks/useWebSocket';
import { Crowd, DoodleBug, DoodlePlayer1, DoodlePlayer2, InkArrow } from '../components/Doodles';
import type { PlayerState } from '../types';

function Progress({ player, total, slot }: { player?: PlayerState; total: number; slot: 1 | 2 }) {
  const passed = player?.passed ?? 0;
  const Face = slot === 1 ? DoodlePlayer1 : DoodlePlayer2;
  return (
    <div className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col justify-center gap-2 sm:gap-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="shrink-0">
          <Face size={48} className="sm:hidden" />
          <Face size={64} className="hidden sm:block" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-hand text-xs sm:text-sm text-black/70">PLAYER {slot}</div>
          <div className="font-heading font-extrabold text-xl sm:text-2xl md:text-3xl leading-tight truncate">
            {player ? player.name : '- - -'}
          </div>
        </div>
        <div className="ml-auto shrink-0 font-display italic text-3xl sm:text-5xl md:text-6xl leading-none">
          {passed}
          <span className="text-xl sm:text-2xl md:text-3xl font-mono not-italic text-black/60">/{total}</span>
        </div>
      </div>
      <div className="flex b h-8 sm:h-12 w-full">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`flex-1 ${i > 0 ? 'bl' : ''} ${i < passed ? 'bg-black' : 'bg-paper'}`} />
        ))}
      </div>
      <div className="text-[11px] sm:text-xs h-4 truncate font-bold">
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
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="b px-6 py-4 font-bold text-center">[!] {s.error}</div>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
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
    <div className="min-h-dvh h-auto lg:h-dvh w-full overflow-x-hidden lg:overflow-hidden bg-paper text-black flex flex-col lg:grid lg:grid-rows-[auto_1fr_auto] relative">
      {/* Top strip */}
      <header className="bb flex flex-wrap lg:grid lg:grid-cols-[1fr_auto_auto] items-stretch justify-between">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 min-w-0 flex-1">
          <span className="font-heading font-extrabold text-xl sm:text-3xl shrink-0">BUGARENA</span>
          <DoodleBug size={28} className="shrink-0" />
          <span className="font-hand ml-2 text-xs sm:text-sm truncate">
            round {room.round}: {room.problem.title}
          </span>
        </div>
        <div className="bl border-t sm:border-t-0 border-black px-3 sm:px-5 flex items-center font-bold text-xs sm:text-sm shrink-0">
          {room.status === 'WAITING' ? 'LOBBY' : room.status === 'ACTIVE' ? 'LIVE' : 'FINISHED'}
          {!s.isConnected && <span className="ml-2 text-red-600">[!] OFFLINE</span>}
        </div>
        <div
          className={`bl border-t sm:border-t-0 border-black px-4 sm:px-8 py-1 lg:py-0 flex items-center font-heading font-extrabold text-2xl sm:text-4xl lg:text-5xl tabular-nums shrink-0 ${
            low ? 'bg-black text-white blink' : room.status === 'ACTIVE' ? 'bg-black text-white' : ''
          }`}
        >
          {formatClock(s.secondsLeft)}
        </div>
      </header>

      {/* Main grid */}
      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(240px,1fr)_2fr_minmax(240px,1fr)]">
        {/* Code + QR Section */}
        <section className="bb lg:bb-0 lg:br flex flex-col min-h-0">
          <div className="checker h-5 sm:h-6 bb shrink-0" />
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 sm:gap-3 p-4">
            <div className="font-hand text-xs sm:text-sm">scan to join</div>
            <div className="b p-2.5 sm:p-3 bg-white">
              <QRCodeSVG value={joinUrl} size={150} level="M" bgColor="#FFFFFF" fgColor="#000000" />
            </div>
            <div className="font-hand text-xs">or enter code</div>
            <div className="w-full max-w-[210px] bg-[#CCFF00] text-black border-[1.5px] border-black py-2 px-3 font-heading font-extrabold text-2xl sm:text-3xl tracking-[0.2em] text-center leading-none select-all">
              {room.room_code}
            </div>
            <div className="text-[11px] font-mono break-all text-center max-w-full px-2 text-black/75">
              {joinUrl}
            </div>
          </div>
        </section>

        {/* Versus Section */}
        <section className="bb lg:bb-0 lg:br flex flex-col min-h-0">
          <Progress player={p1} total={total} slot={1} />
          <div className="bt bb flex items-center justify-center py-1 relative bg-paper">
            <span className="font-display italic text-2xl sm:text-3xl px-4 sm:px-6 bg-paper">vs</span>
          </div>
          <Progress player={p2} total={total} slot={2} />

          <div className="bt p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3">
            <div className="text-xs font-bold">
              {room.players.length}/2 CHALLENGERS | {room.spectator_count} IN THE CROWD
            </div>
            {room.status === 'WAITING' && (
              <div className="flex items-center gap-2 ml-auto">
                <InkArrow width={55} className="hidden sm:block" />
                <button
                  className="btn-ink px-4 sm:px-5 py-2 text-xs sm:text-sm"
                  disabled={room.players.length < 1}
                  onClick={s.startMatch}
                >
                  START DUEL
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Ticker & Votes Section */}
        <section className="flex flex-col min-h-0">
          <div className="bb px-4 py-2 font-heading font-extrabold text-xs sm:text-sm">LIVE TICKER</div>
          <ul className="flex-1 min-h-[120px] max-h-48 lg:max-h-none overflow-y-auto text-xs">
            {ticker.map((line, i) => (
              <li key={`${room.event_log.length - i}`} className={`bb px-4 py-2 ${i === 0 ? 'bg-black text-white font-bold' : ''}`}>
                {i === 0 ? '> ' : ''}
                {line}
              </li>
            ))}
          </ul>
          <div className="bt px-4 py-2 font-heading font-extrabold text-xs sm:text-sm">NEXT BUG VOTES</div>
          {Object.keys(labels).map((k) => (
            <div key={k} className="bt px-4 py-1.5 text-xs flex justify-between font-bold">
              <span>{labels[k]}</span>
              <span>{bugVotes[k as keyof typeof bugVotes] ?? 0}</span>
            </div>
          ))}
        </section>
      </main>

      {/* Crowd + Tug of War Footer */}
      <footer className="bt grid grid-cols-1 md:grid-cols-[minmax(240px,1fr)_3fr]">
        <div className="bb md:bb-0 md:br px-4 py-2 flex items-center gap-2 min-h-[44px]">
          <Crowd count={Math.min(room.spectator_count, 9)} size={36} />
          {room.spectator_count === 0 && (
            <span className="font-hand text-xs sm:text-sm text-black/70">the crowd is empty...</span>
          )}
        </div>
        <div className="px-4 py-2 flex flex-col justify-center gap-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="truncate max-w-[120px] sm:max-w-none">
              {p1?.name ?? 'P1'} ({a})
            </span>
            <span className="font-hand text-xs sm:text-sm text-center">CROWD PREDICTION</span>
            <span className="truncate max-w-[120px] sm:max-w-none text-right">
              ({b}) {p2?.name ?? 'P2'}
            </span>
          </div>
          <div className="flex b h-6 sm:h-8 w-full">
            <div className="bg-black transition-all duration-500" style={{ width: `${aPct}%` }} />
            <div className="hatch flex-1" />
          </div>
        </div>
      </footer>

      {/* Victory modal */}
      {room.status === 'FINISHED' && (
        <div className="absolute inset-0 bg-paper/95 flex flex-col items-center justify-center gap-3 sm:gap-4 text-center z-10 border-[1.5px] border-black m-2 sm:m-4 p-4 overflow-y-auto">
          <div className="font-hand text-base sm:text-lg">{room.finish_reason === 'timeout' ? "TIME'S UP" : 'BUG SQUASHED'}</div>
          <div className="font-display italic text-5xl sm:text-7xl md:text-8xl leading-none">
            {room.winner ? `${room.winner.name} wins` : 'Draw'}
          </div>
          {room.winner && (
            <div className="font-bold text-sm sm:text-base">
              {room.winner.passed}/{room.winner.total} tests | {room.winner.completion_time}s
            </div>
          )}
          {room.problem.description_bug && (
            <div className="b px-4 py-2 text-xs sm:text-sm max-w-2xl text-left bg-white">
              <span className="font-bold">THE BUG: </span>
              {room.problem.description_bug}
            </div>
          )}
          <div className="flex items-center gap-3">
            <InkArrow width={80} className="hidden sm:block" />
            <button className="btn-ink px-6 sm:px-10 py-3 sm:py-4 text-base sm:text-xl" onClick={s.startNextRound}>
              NEXT ROUND
            </button>
          </div>
          <div className="font-hand text-xs sm:text-sm">
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
