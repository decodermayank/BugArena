import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { useWebSocket, formatClock } from '../hooks/useWebSocket';
import { Crowd, DoodleBug, DoodlePlayer1, DoodlePlayer2, InkArrow } from '../components/Doodles';
import SoundToggle from '../components/SoundToggle';
import { CursorToggle } from '../components/CustomCursor';
import { soundFx } from '../utils/soundFx';
import type { PlayerState } from '../types';

interface PowAlert {
  id: number;
  text: string;
  sub: string;
  x: number;
  y: number;
}

interface FloatingEmote {
  id: number;
  emote: string;
  x: number;
}

function Progress({ player, total, slot }: { player?: PlayerState; total: number; slot: 1 | 2 }) {
  const passed = player?.passed ?? 0;
  const Face = slot === 1 ? DoodlePlayer1 : DoodlePlayer2;

  return (
    <div className="flex-1 min-h-0 p-3 sm:p-5 flex flex-col justify-center gap-2 sm:gap-3 bg-white">
      <div className="flex items-center gap-3">
        <div className="shrink-0 border-2 border-black p-1 bg-paper shadow-[2px_2px_0px_#000]">
          <Face size={48} className="sm:hidden" />
          <Face size={60} className="hidden sm:block" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-hand text-xs sm:text-sm text-black/70">CHALLENGER {slot}</div>
          <div className="font-heading font-extrabold text-xl sm:text-2xl md:text-3xl leading-tight truncate">
            {player ? player.name : 'WAITING...'}
          </div>
        </div>
        <div className="ml-auto shrink-0 font-display italic text-4xl sm:text-5xl md:text-6xl leading-none">
          {passed}
          <span className="text-xl sm:text-2xl md:text-3xl font-mono not-italic text-black/50">/{total}</span>
        </div>
      </div>

      {/* Segmented Test Progress Bar */}
      <div className="flex border-2 border-black h-8 sm:h-11 w-full bg-paper shadow-[2px_2px_0px_#000]">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 flex items-center justify-center font-bold text-xs transition-all duration-300 ${
              i > 0 ? 'border-l-2 border-black' : ''
            } ${i < passed ? 'bg-black text-white' : 'bg-paper text-black/30'}`}
          >
            {i < passed ? '✓' : i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArenaView() {
  const { roomCode = '' } = useParams<{ roomCode: string }>();
  const s = useWebSocket({ roomCode, role: 'projector' });
  const room = s.roomState;

  // Visual effects state
  const [showFightBanner, setShowFightBanner] = useState(false);
  const [fightBannerTitle, setFightBannerTitle] = useState('');
  const [powAlerts, setPowAlerts] = useState<PowAlert[]>([]);
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([]);

  // Sound & event tracking refs
  const prevStatusRef = useRef<string | null>(null);
  const prevP1ScoreRef = useRef<number>(0);
  const prevP2ScoreRef = useRef<number>(0);
  const prevLogLenRef = useRef<number>(0);
  const prevRoundRef = useRef<number>(1);
  const countdownPlayedRef = useRef<Set<number>>(new Set());

  // 1. Match Start / Next Round sound & Manga "FIGHT!" Screen Wipe
  useEffect(() => {
    if (!room) return;

    if (
      (prevStatusRef.current === 'WAITING' || prevStatusRef.current === 'FINISHED') &&
      room.status === 'ACTIVE'
    ) {
      soundFx.playFightGong();
      setFightBannerTitle(`ROUND ${room.round}: ${room.problem.title.toUpperCase()}`);
      setShowFightBanner(true);
      const timer = setTimeout(() => setShowFightBanner(false), 2400);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = room.status;
  }, [room?.status, room?.round, room?.problem.title]);

  // Reset countdown tracker on round change
  useEffect(() => {
    if (!room) return;
    if (room.round !== prevRoundRef.current) {
      prevRoundRef.current = room.round;
      countdownPlayedRef.current.clear();
      prevP1ScoreRef.current = 0;
      prevP2ScoreRef.current = 0;
    }
  }, [room?.round]);

  // 2. Score increases & Comic POW stamps
  useEffect(() => {
    if (!room || room.status !== 'ACTIVE') return;

    const [p1, p2] = room.players;
    const currentP1 = p1?.passed ?? 0;
    const currentP2 = p2?.passed ?? 0;

    if (currentP1 > prevP1ScoreRef.current) {
      soundFx.playPass();
      const alertId = Date.now() + Math.random();
      setPowAlerts((prev) => [
        ...prev,
        {
          id: alertId,
          text: 'POW! TEST PASSED',
          sub: `${p1?.name ?? 'P1'} +1`,
          x: 20 + Math.random() * 20,
          y: 30 + Math.random() * 20,
        },
      ]);
      setTimeout(() => {
        setPowAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }, 1500);
    }

    if (currentP2 > prevP2ScoreRef.current) {
      soundFx.playPass();
      const alertId = Date.now() + Math.random();
      setPowAlerts((prev) => [
        ...prev,
        {
          id: alertId,
          text: 'BAM! TEST PASSED',
          sub: `${p2?.name ?? 'P2'} +1`,
          x: 60 + Math.random() * 20,
          y: 40 + Math.random() * 20,
        },
      ]);
      setTimeout(() => {
        setPowAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }, 1500);
    }

    prevP1ScoreRef.current = currentP1;
    prevP2ScoreRef.current = currentP2;
  }, [room?.players, room?.status]);

  // 3. Victory sound & Confetti shower
  useEffect(() => {
    if (room?.status === 'FINISHED') {
      if (room.winner) {
        soundFx.playVictory();
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.5 },
          colors: ['#000000', '#FFFFFF', '#00FF66', '#FFB800'],
        });
      } else {
        soundFx.playFail();
      }
    }
  }, [room?.status, room?.winner]);

  // 4. Dramatic Ticking Countdown in final 5 seconds
  useEffect(() => {
    if (!room || room.status !== 'ACTIVE') return;

    const secs = s.secondsLeft;
    if (secs > 0 && secs <= 5 && !countdownPlayedRef.current.has(secs)) {
      countdownPlayedRef.current.add(secs);
      soundFx.playClockTick();
    }
  }, [room?.status, s.secondsLeft]);

  // 5. Incoming Spectator Emote Floaters
  useEffect(() => {
    if (!s.lastEmote) return;
    const emoteId = Date.now() + Math.random();
    const xPos = 15 + Math.random() * 70;
    setFloatingEmotes((prev) => [...prev, { id: emoteId, emote: s.lastEmote!.emote, x: xPos }]);

    soundFx.playEmotePop();

    const t = setTimeout(() => {
      setFloatingEmotes((prev) => prev.filter((item) => item.id !== emoteId));
    }, 2200);
    return () => clearTimeout(t);
  }, [s.lastEmote]);

  // 6. Match Event Log Audio Cues
  useEffect(() => {
    if (!room) return;
    if (room.event_log.length > prevLogLenRef.current) {
      if (prevLogLenRef.current > 0) {
        soundFx.playThump();
      }
      prevLogLenRef.current = room.event_log.length;
    }
  }, [room?.event_log]);

  if (s.error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-paper">
        <div className="border-2 border-black bg-white px-6 py-4 font-bold text-center shadow-[4px_4px_0px_#000]">
          [!] {s.error}
        </div>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-paper">
        <div className="border-2 border-black bg-white px-6 py-4 font-bold shadow-[4px_4px_0px_#000]">
          CONNECTING ARENA...
        </div>
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
    <div className="min-h-dvh h-auto lg:h-dvh w-full overflow-x-hidden lg:overflow-hidden bg-[#FAFAFA] text-black flex flex-col lg:grid lg:grid-rows-[auto_1fr_auto] relative select-none">
      {/* Top Strip */}
      <header className="border-b-2 border-black bg-white flex flex-wrap lg:grid lg:grid-cols-[1fr_auto_auto_auto] items-stretch justify-between">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 min-w-0 flex-1">
          <span className="font-heading font-extrabold text-xl sm:text-3xl shrink-0">BUGARENA</span>
          <DoodleBug size={24} className="shrink-0 sm:w-7 sm:h-7" />
          <span className="font-hand ml-2 text-xs sm:text-sm truncate">
            round {room.round}: {room.problem.title}
          </span>
        </div>

        <div className="border-l-2 border-black px-2 sm:px-3 flex items-center gap-1.5 shrink-0">
          <SoundToggle />
          <CursorToggle />
        </div>

        <div className="border-l-2 border-black px-4 sm:px-6 flex items-center font-bold text-xs sm:text-sm shrink-0">
          <span className="mr-2">STATUS:</span>
          <span
            className={`px-2 py-0.5 text-xs font-bold ${
              room.status === 'ACTIVE'
                ? 'bg-black text-white animate-pulse'
                : room.status === 'FINISHED'
                  ? 'bg-black text-white'
                  : 'bg-black/10'
            }`}
          >
            {room.status === 'WAITING' ? 'LOBBY' : room.status === 'ACTIVE' ? 'LIVE DUEL' : 'FINISHED'}
          </span>
          {!s.isConnected && <span className="ml-2 text-red-600">[!] OFFLINE</span>}
        </div>

        <div
          className={`border-l-2 border-black px-5 sm:px-8 py-1 lg:py-0 flex items-center font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl tabular-nums shrink-0 ${
            low ? 'bg-black text-white animate-pulse' : room.status === 'ACTIVE' ? 'bg-black text-white' : 'bg-white'
          }`}
        >
          {formatClock(s.secondsLeft)}
        </div>
      </header>

      {/* Main 3-Column Arena Grid */}
      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(250px,1fr)_2.5fr_minmax(240px,1fr)] bg-[#FAFAFA]">
        {/* Left Column: Code + QR */}
        <section className="border-b-2 lg:border-b-0 lg:border-r-2 border-black flex flex-col min-h-0 bg-white">
          <div className="checker h-5 sm:h-6 border-b-2 border-black shrink-0" />
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 sm:gap-3 p-4 sm:p-6 text-center">
            <span className="font-hand text-xs sm:text-sm">scan QR to join fight</span>
            <div className="border-2 border-black p-3 bg-white shadow-[3px_3px_0px_#000]">
              <QRCodeSVG value={joinUrl} size={150} level="M" bgColor="#FFFFFF" fgColor="#000000" />
            </div>
            <span className="font-hand text-xs">or enter room code</span>
            <div className="w-full max-w-[220px] bg-[#CCFF00] text-black border-2 border-black py-2.5 px-3 font-heading font-extrabold text-2xl sm:text-3xl tracking-[0.2em] text-center leading-none shadow-[2px_2px_0px_#000]">
              {room.room_code}
            </div>
            <div className="text-[11px] font-mono break-all text-center max-w-full px-2 text-black/70">
              {joinUrl}
            </div>
          </div>
        </section>

        {/* Center Column: 1v1 Versus Arena */}
        <section className="border-b-2 lg:border-b-0 lg:border-r-2 border-black flex flex-col min-h-0 bg-[#FAFAFA]">
          <Progress player={p1} total={total} slot={1} />

          {/* VS Divider Strip */}
          <div className="border-y-2 border-black flex items-center justify-center py-1.5 relative bg-black text-white">
            <span className="font-display italic text-2xl sm:text-3xl px-6 tracking-widest">
              VS
            </span>
          </div>

          <Progress player={p2} total={total} slot={2} />

          {/* Arena Control / Status Bar */}
          <div className="border-t-2 border-black p-3 sm:p-4 bg-white flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3">
            <div className="text-xs font-bold">
              {room.players.length}/2 CHALLENGERS | {room.spectator_count} IN CROWD
            </div>
            {room.status === 'WAITING' && (
              <div className="flex items-center gap-2 ml-auto">
                <InkArrow width={55} className="hidden sm:block" />
                <button
                  className="btn-ink px-5 sm:px-6 py-2.5 text-xs sm:text-sm cursor-pointer shadow-[2px_2px_0px_#000]"
                  disabled={room.players.length < 1}
                  onClick={s.startMatch}
                >
                  START DUEL →
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Live Ticker, Bug Guesses & Sabotage Votes */}
        <section className="flex flex-col min-h-0 bg-white">
          <div className="border-b-2 border-black px-4 py-2 font-heading font-extrabold text-xs sm:text-sm bg-[#f5f5f5]">
            LIVE ARENA TICKER
          </div>
          <ul className="flex-1 min-h-[120px] max-h-48 lg:max-h-none overflow-y-auto text-xs">
            {ticker.map((line, i) => (
              <li
                key={`${room.event_log.length - i}`}
                className={`border-b border-black/20 px-4 py-1.5 font-mono leading-tight ${
                  i === 0 ? 'bg-black text-white font-bold' : 'text-black/80'
                }`}
              >
                {i === 0 ? '> ' : '  '}
                {line}
              </li>
            ))}
          </ul>

          {/* Live Crowd Bug Guessing Tally */}
          <div className="border-t-2 border-black px-4 py-2 font-heading font-extrabold text-xs bg-black text-white flex justify-between items-center tracking-wider">
            <span>CROWD BUG GUESSES</span>
            <span className="text-[#CCFF00] font-mono text-[11px]">{totalBugGuesses} votes</span>
          </div>
          {Object.keys(labels).map((k) => {
            const count = bugGuesses[k as keyof typeof bugGuesses] ?? 0;
            const pct = totalBugGuesses > 0 ? Math.round((count / totalBugGuesses) * 100) : 0;
            return (
              <div key={k} className="border-t border-black/20 px-4 py-1.5 text-xs relative bg-white">
                <div className="absolute inset-y-0 left-0 bg-[#CCFF00]/30" style={{ width: `${pct}%` }} />
                <div className="relative flex justify-between font-bold">
                  <span>{labels[k]}</span>
                  <span className="font-mono">{pct}% ({count})</span>
                </div>
              </div>
            );
          })}

          {/* Audience Next Round Bug Votes */}
          <div className="border-t-2 border-black px-4 py-2 font-heading font-extrabold text-xs sm:text-sm bg-[#f5f5f5]">
            AUDIENCE SABOTAGE VOTES
          </div>
          <div className="divide-y border-t border-black/20">
            {Object.keys(labels).map((k) => (
              <div key={k} className="px-4 py-1.5 text-xs flex justify-between font-bold items-center">
                <span>{labels[k]}</span>
                <span className="border border-black px-2 py-0.5 bg-paper font-mono">
                  {bugVotes[k as keyof typeof bugVotes] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Interactive Tug-of-War Crowd Footer */}
      <footer className="border-t-2 border-black bg-white grid grid-cols-1 md:grid-cols-[minmax(280px,1.2fr)_2.8fr]">
        {/* Left: Audience Crowd Visualizer */}
        <div className="border-b-2 md:border-b-0 md:border-r-2 border-black px-4 py-2.5 flex items-center justify-between min-h-[50px] bg-paper">
          <div className="flex items-center gap-1 overflow-hidden">
            <Crowd count={Math.min(Math.max(room.spectator_count, 1), 8)} size={34} />
          </div>
          <span className="font-hand text-xs text-black/70 shrink-0">
            {room.spectator_count} SPECTATORS
          </span>
        </div>

        {/* Right: Dynamic Animated Tug-of-War Arena */}
        <div className="px-4 py-2.5 flex flex-col justify-center gap-1.5 bg-white">
          <div className="flex justify-between items-center text-xs font-bold">
            <div className="flex items-center gap-1.5 truncate">
              <span>{p1?.name ?? 'P1'}</span>
              <span className="text-[11px] font-mono text-black/60">({a} bets)</span>
              {aPct > 50 && <span className="text-xs">💪</span>}
            </div>

            <span className="font-hand text-xs tracking-wider uppercase font-bold text-black/70">
              ⚡ LIVE CROWD TUG-OF-WAR ⚡
            </span>

            <div className="flex items-center gap-1.5 truncate">
              {aPct < 50 && <span className="text-xs">💪</span>}
              <span className="text-[11px] font-mono text-black/60">({b} bets)</span>
              <span>{p2?.name ?? 'P2'}</span>
            </div>
          </div>

          {/* Physical Tug-of-War Rope */}
          <div className="relative border-2 border-black h-8 w-full bg-paper flex items-center overflow-hidden shadow-[2px_2px_0px_#000]">
            <div
              className="h-full bg-black transition-all duration-500 ease-out flex items-center justify-end pr-2"
              style={{ width: `${aPct}%` }}
            >
              <span className="text-[10px] font-bold text-white font-mono">{aPct}%</span>
            </div>
            <div className="hatch h-full flex-1 flex items-center pl-2">
              <span className="text-[10px] font-bold text-black font-mono">{100 - aPct}%</span>
            </div>

            <div
              className="absolute top-0 bottom-0 w-2.5 bg-red-600 border-x border-black transition-all duration-500 ease-out shadow-[0px_0px_6px_#000]"
              style={{ left: `calc(${aPct}% - 5px)` }}
            />
          </div>
        </div>
      </footer>

      {/* Comic-Book "FIGHT!" Screen Wipe Banner */}
      {showFightBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden bg-black/40">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-conic-gradient(from 0deg, #000 0deg 4deg, transparent 4deg 12deg)',
            }}
          />
          <div className="relative z-10 border-4 border-black bg-white p-6 sm:p-10 text-center shadow-[10px_10px_0px_#000] rotate-[-2deg] max-w-xl mx-4 animate-in zoom-in-75 duration-200">
            <div className="font-hand text-sm sm:text-base font-bold text-black/75 tracking-wider">
              {fightBannerTitle}
            </div>
            <div className="font-heading font-extrabold text-6xl sm:text-8xl tracking-tighter text-black my-2">
              FIGHT!
            </div>
            <div className="font-hand text-xs sm:text-sm font-bold bg-black text-white px-3 py-1 inline-block">
              FIRST TO SQUASH ALL BUGS WINS
            </div>
          </div>
        </div>
      )}

      {/* Comic POW Floater Stamps */}
      {powAlerts.map((alert) => (
        <div
          key={alert.id}
          className="fixed z-40 border-2 border-black bg-white p-3 shadow-[4px_4px_0px_#000] rotate-[-4deg] animate-in fade-in zoom-in-90 slide-in-from-bottom-6 duration-300 pointer-events-none"
          style={{ top: `${alert.y}%`, left: `${alert.x}%` }}
        >
          <div className="font-heading font-extrabold text-sm sm:text-base text-black">{alert.text}</div>
          <div className="font-hand text-xs text-black/70">{alert.sub}</div>
        </div>
      ))}

      {/* Floating Spectator Reactions */}
      {floatingEmotes.map((item) => (
        <div
          key={item.id}
          className="fixed bottom-16 z-40 text-4xl pointer-events-none transition-all duration-1000 ease-out animate-in fade-in slide-in-from-bottom-12"
          style={{ left: `${item.x}%`, transform: 'translateY(-120px)' }}
        >
          {item.emote}
        </div>
      ))}

      {/* Victory Celebration & Leaderboard Modal */}
      {room.status === 'FINISHED' && (
        <div className="absolute inset-0 bg-[#FAFAFA]/95 flex flex-col items-center justify-start sm:justify-center gap-3 text-center z-30 border-2 border-black m-2 sm:m-6 p-4 sm:p-8 overflow-y-auto shadow-[6px_6px_0px_#000]">
          <div className="font-hand text-base sm:text-xl font-bold">
            {room.finish_reason === 'timeout' ? "TIME'S UP!" : 'BUG SQUASHED!'}
          </div>
          <div className="font-display italic text-5xl sm:text-7xl md:text-8xl leading-none">
            {room.winner ? `${room.winner.name} wins!` : 'Draw / Stalemate'}
          </div>

          {room.winner && (
            <div className="font-heading font-extrabold text-sm sm:text-lg bg-black text-white px-4 py-1">
              {room.winner.passed}/{room.winner.total} tests passing in {room.winner.completion_time}s
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
          <div className="border-2 border-black bg-white max-w-2xl w-full text-left mt-3 shadow-[2px_2px_0px_#000]">
            <div className="border-b-2 border-black px-4 py-2 bg-black text-white font-heading font-extrabold text-xs sm:text-sm flex justify-between items-center tracking-wider uppercase">
              <span>TOP CROWD PREDICTORS</span>
              <span className="font-hand font-normal text-xs text-[#CCFF00]">LEADERBOARD</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x border-black bg-white">
              {room.leaderboard && room.leaderboard.length > 0 ? (
                room.leaderboard.slice(0, 6).map((entry, idx) => (
                  <div key={entry.id || idx} className="flex items-center justify-between px-3 sm:px-4 py-2 text-xs font-bold border-b border-black">
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
            <div className="border-2 border-black p-3 sm:p-4 text-xs sm:text-sm max-w-2xl text-left bg-white shadow-[2px_2px_0px_#000] mt-2">
              <span className="font-bold">THE BUG: </span>
              <span>{room.problem.description_bug}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-3">
            <InkArrow width={80} className="hidden sm:block" />
            <button
              className="btn-ink px-8 sm:px-12 py-3 sm:py-4 text-base sm:text-xl cursor-pointer shadow-[3px_3px_0px_#000]"
              onClick={s.startNextRound}
            >
              LAUNCH NEXT ROUND →
            </button>
          </div>

          <div className="font-hand text-xs sm:text-sm text-black/75">
            spectator vote for next round:{' '}
            {Object.keys(labels)
              .map((k) => `${labels[k]}: ${bugVotes[k as keyof typeof bugVotes] ?? 0}`)
              .join(' | ')}
          </div>
        </div>
      )}
    </div>
  );
}
