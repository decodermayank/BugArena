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
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Face size={60} className="sm:w-[72px] sm:h-[72px] shrink-0" />
        <div className="min-w-0">
          <div className="font-hand text-xs sm:text-sm text-black/70">PLAYER {slot}</div>
          <div className="font-heading font-extrabold text-xl sm:text-3xl leading-none truncate">
            {player ? player.name : '- - -'}
          </div>
        </div>
        <div className="ml-auto shrink-0 font-display italic text-3xl sm:text-5xl md:text-6xl leading-none">
          {passed}
          <span className="text-xl sm:text-2xl md:text-3xl font-mono not-italic text-black/60">/{total}</span>
        </div>
      </div>
      <div className="flex b h-8 sm:h-12 w-full bg-white">
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
      <div className="min-h-dvh flex items-center justify-center p-4 bg-paper">
        <div className="b px-6 py-4 font-bold text-center bg-white">[!] {s.error}</div>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-paper">
        <div className="b px-6 py-4 font-bold bg-white">CONNECTING TO ARENA...</div>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/join/${room.room_code}`;
  const total = room.problem.test_cases.length;
  const [p1, p2] = room.players;
  const a = room.predictions?.player_1 ?? 0;
  const b = room.predictions?.player_2 ?? 0;
  const aPct = a + b === 0 ? 50 : Math.round((a / (a + b)) * 100);
  const ticker = room.event_log.slice(-6).reverse();
  const low = room.status === 'ACTIVE' && s.secondsLeft <= 30;

  const bugGuesses = room.bug_guesses || { off_by_one: 0, inverted_condition: 0, arithmetic: 0 };
  const totalBugGuesses = Object.values(bugGuesses).reduce((x, y) => x + y, 0);

  const bugVotes = room.next_bug_votes || { off_by_one: 0, inverted_condition: 0, arithmetic: 0 };
  const labels: Record<string, string> = {
    off_by_one: 'OFF-BY-ONE',
    inverted_condition: 'INVERTED LOGIC',
    arithmetic: 'BROKEN MATH',
  };

  return (
    <div className="min-h-dvh h-auto lg:h-dvh w-full overflow-x-hidden lg:overflow-hidden bg-paper text-black flex flex-col lg:grid lg:grid-rows-[auto_1fr_auto] relative">
      {/* Top Bar */}
      <header className="bb flex flex-wrap lg:grid lg:grid-cols-[1fr_auto_auto] items-stretch justify-between bg-paper">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 min-w-0 flex-1">
          <span className="font-heading font-extrabold text-xl sm:text-3xl shrink-0">BUGARENA</span>
          <DoodleBug size={28} className="shrink-0" />
          <span className="font-hand ml-2 text-xs sm:text-sm truncate">
            round {room.round}: {room.problem.title}
          </span>
        </div>
        <div className="bl border-t sm:border-t-0 border-black px-3 sm:px-5 flex items-center font-bold text-xs sm:text-sm shrink-0">
          {room.status === 'WAITING' ? 'LOBBY' : room.status === 'ACTIVE' ? 'LIVE BATTLE' : 'ROUND FINISHED'}
          {!s.isConnected && <span className="ml-2 text-red-600">[!] OFFLINE</span>}
        </div>
        <div
          className={`bl border-t sm:border-t-0 border-black px-4 sm:px-8 py-1 lg:py-0 flex items-center font-heading font-extrabold text-2xl sm:text-4xl lg:text-5xl tabular-nums shrink-0 ${
            low ? 'bg-black text-[#CCFF00] blink' : room.status === 'ACTIVE' ? 'bg-black text-white' : ''
          }`}
        >
          {formatClock(s.secondsLeft)}
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(240px,1fr)_2fr_minmax(240px,1fr)]">
        {/* Left Column: Code + QR */}
        <section className="bb lg:bb-0 lg:br flex flex-col min-h-0 bg-white">
          <div className="checker h-5 sm:h-6 bb shrink-0" />
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 sm:gap-3 p-4">
            <div className="font-hand text-xs sm:text-sm">scan with mobile to join</div>
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

        {/* Center Column: Duelists Progress */}
        <section className="bb lg:bb-0 lg:br flex flex-col min-h-0 bg-paper">
          <Progress player={p1} total={total} slot={1} />
          <div className="bt bb flex items-center justify-center py-1 relative bg-white">
            <span className="font-display italic text-2xl sm:text-3xl px-4 sm:px-6 bg-white">vs</span>
          </div>
          <Progress player={p2} total={total} slot={2} />

          <div className="bt p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 bg-white">
            <div className="text-xs font-bold">
              {room.players.length}/2 CHALLENGERS | {room.spectator_count} SPECTATORS
            </div>
            {room.status === 'WAITING' && (
              <div className="flex items-center gap-2 ml-auto">
                <InkArrow width={55} className="hidden sm:block" />
                <button
                  className="btn-ink px-4 sm:px-6 py-2 text-xs sm:text-sm font-bold tracking-wider"
                  disabled={room.players.length < 1}
                  onClick={s.startMatch}
                >
                  START DUEL
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Ticker & Live Crowd Bug Tally */}
        <section className="flex flex-col min-h-0 bg-white">
          {/* Live Arena Ticker */}
          <div className="bb px-4 py-2 font-heading font-extrabold text-xs sm:text-sm uppercase tracking-wider bg-paper">
            LIVE ARENA TICKER
          </div>
          <ul className="flex-1 min-h-[120px] max-h-48 lg:max-h-none overflow-y-auto text-xs">
            {ticker.map((line, i) => (
              <li
                key={`${room.event_log.length - i}`}
                className={`bb px-4 py-1.5 leading-tight ${i === 0 ? 'bg-black text-white font-bold' : 'text-black/80'}`}
              >
                {i === 0 ? '> ' : ''}
                {line}
              </li>
            ))}
          </ul>

          {/* Live Crowd Bug Guessing Tally */}
          <div className="bt px-4 py-2 font-heading font-extrabold text-xs uppercase tracking-wider bg-black text-white flex justify-between items-center">
            <span>CROWD BUG GUESSES</span>
            <span className="text-[#CCFF00] font-mono text-[11px]">{totalBugGuesses} votes</span>
          </div>
          {Object.keys(labels).map((k) => {
            const count = bugGuesses[k as keyof typeof bugGuesses] ?? 0;
            const pct = totalBugGuesses > 0 ? Math.round((count / totalBugGuesses) * 100) : 0;
            return (
              <div key={k} className="bt px-4 py-1.5 text-xs relative bg-white">
                <div className="absolute inset-y-0 left-0 bg-[#CCFF00]/30" style={{ width: `${pct}%` }} />
                <div className="relative flex justify-between font-bold">
                  <span>{labels[k]}</span>
                  <span className="font-mono">{pct}% ({count})</span>
                </div>
              </div>
            );
          })}
        </section>
      </main>

      {/* Footer: Spectator Crowd + Prediction Tug of War */}
      <footer className="bt grid grid-cols-1 md:grid-cols-[minmax(240px,1fr)_3fr] bg-paper">
        <div className="bb md:bb-0 md:br px-4 py-2 flex items-center gap-2 min-h-[44px]">
          <Crowd count={Math.min(room.spectator_count, 9)} size={36} />
          {room.spectator_count === 0 && (
            <span className="font-hand text-xs sm:text-sm text-black/70">crowd is tuning in...</span>
          )}
        </div>
        <div className="px-4 py-2 flex flex-col justify-center gap-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="truncate max-w-[120px] sm:max-w-none">
              {p1?.name ?? 'PLAYER 1'} ({a})
            </span>
            <span className="font-hand text-xs sm:text-sm text-center text-black/70">CROWD WINNER PREDICTION</span>
            <span className="truncate max-w-[120px] sm:max-w-none text-right">
              ({b}) {p2?.name ?? 'PLAYER 2'}
            </span>
          </div>
          <div className="flex b h-6 sm:h-8 w-full bg-white">
            <div className="bg-black transition-all duration-500" style={{ width: `${aPct}%` }} />
            <div className="hatch flex-1" />
          </div>
        </div>
      </footer>

      {/* END-OF-ROUND VICTORY & LEADERBOARD OVERLAY */}
      {room.status === 'FINISHED' && (
        <div className="absolute inset-0 bg-paper/98 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-30 border-[2px] border-black m-2 sm:m-4 shadow-2xl overflow-y-auto">
          <div className="font-hand text-sm sm:text-base text-black/70 uppercase tracking-widest">
            {room.finish_reason === 'timeout' ? "TIME'S UP" : 'BUG SQUASHED'}
          </div>

          <div className="font-display italic text-5xl sm:text-7xl md:text-8xl leading-none mt-1">
            {room.winner ? `${room.winner.name} wins!` : 'Draw / Stalemate'}
          </div>

          {room.winner && (
            <div className="font-mono font-bold text-xs sm:text-sm bg-black text-white px-3 py-1 mt-1">
              {room.winner.passed}/{room.winner.total} tests passed in {room.winner.completion_time}s
            </div>
          )}

          {/* Crowd vs Duelists Callout Banner */}
          {room.crowd_callout && (
            <div className="bg-[#CCFF00] text-black border-2 border-black px-4 sm:px-6 py-2.5 sm:py-3.5 max-w-2xl w-full text-center mt-3">
              <div className="font-heading font-extrabold text-lg sm:text-2xl tracking-tight leading-tight uppercase">
                ⚡ {room.crowd_callout.headline}
              </div>
              <div className="font-hand text-xs sm:text-sm mt-1">
                {room.crowd_callout.subtitle}
              </div>
              <div className="text-[11px] sm:text-xs font-bold mt-2 pt-2 border-t border-black/30 flex justify-around font-mono">
                <span>CROWD WINNER ACCURACY: {room.crowd_callout.winner_pct}%</span>
                <span>BUG GUESS ACCURACY: {room.crowd_callout.bug_pct}%</span>
              </div>
            </div>
          )}

          {/* Top Crowd Predictors Leaderboard */}
          <div className="b bg-white max-w-2xl w-full text-left mt-3">
            <div className="bb px-4 py-2 bg-black text-white font-heading font-extrabold text-xs sm:text-sm flex justify-between items-center tracking-wider uppercase">
              <span>TOP CROWD PREDICTORS</span>
              <span className="font-hand font-normal text-xs text-[#CCFF00]">LEADERBOARD</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x border-black bg-white">
              {room.leaderboard && room.leaderboard.length > 0 ? (
                room.leaderboard.slice(0, 6).map((entry, idx) => (
                  <div key={entry.id || idx} className="flex items-center justify-between px-3 sm:px-4 py-2 text-xs font-bold bb">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-6 h-6 flex items-center justify-center border border-black text-xs shrink-0 ${
                          idx === 0 ? 'bg-[#CCFF00] text-black font-extrabold' : 'bg-paper text-black'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <span className="truncate max-w-[120px] sm:max-w-[140px]">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.round_points > 0 && (
                        <span className="text-[10px] bg-[#CCFF00] text-black px-1 border border-black font-mono">
                          +{entry.round_points}
                        </span>
                      )}
                      <span className="font-mono text-xs sm:text-sm">{entry.score} PTS</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-3 font-hand text-xs text-black/60">
                  No crowd predictions recorded for this round.
                </div>
              )}
            </div>
          </div>

          {/* Bug explanation */}
          {room.problem.description_bug && (
            <div className="b px-4 py-1.5 text-xs sm:text-sm max-w-2xl bg-paper text-left mt-2">
              <span className="font-bold">THE BUG: </span>
              <span>{room.problem.description_bug}</span>
            </div>
          )}

          {/* Host Next Round Action & Next Bug Crowd Choice */}
          <div className="flex items-center gap-3 mt-3">
            <InkArrow width={80} className="hidden sm:block" />
            <button
              className="btn-ink px-6 sm:px-10 py-3 sm:py-3.5 text-base sm:text-lg font-bold tracking-wider hover:bg-[#CCFF00] hover:text-black hover:border-black transition-colors"
              onClick={s.startNextRound}
            >
              LAUNCH NEXT ROUND
            </button>
          </div>

          <div className="font-hand text-xs sm:text-sm text-black/70 mt-1">
            spectator vote for next round:{' '}
            {Object.keys(labels)
              .map((k) => `${labels[k]} (${bugVotes[k as keyof typeof bugVotes] ?? 0})`)
              .join(' • ')}
          </div>
        </div>
      )}
    </div>
  );
}
