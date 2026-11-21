import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { BeforeMount } from '@monaco-editor/react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useWebSocket, formatClock } from '../hooks/useWebSocket';
import type { RoomSession } from '../hooks/useWebSocket';
import { usePyodide } from '../hooks/usePyodide';
import type { RequestedRole, TestRunResult } from '../types';
import SpectatorView from './SpectatorView';
import { DoodleBug, DoodlePlayer1, DoodlePlayer2, InkArrow } from '../components/Doodles';
import SoundToggle from '../components/SoundToggle';
import { CursorToggle } from '../components/CustomCursor';
import { soundFx } from '../utils/soundFx';

const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('bugarena', {
    base: 'vs',
    inherit: false,
    rules: [
      { token: '', foreground: '000000' },
      { token: 'comment', foreground: '666666', fontStyle: 'italic' },
      { token: 'keyword', foreground: '000000', fontStyle: 'bold' },
      { token: 'string', foreground: '000000', fontStyle: 'underline' },
      { token: 'number', foreground: '000000', fontStyle: 'bold' },
    ],
    colors: {
      'editor.background': '#FAFAFA',
      'editor.foreground': '#000000',
      'editorLineNumber.foreground': '#888888',
      'editorLineNumber.activeForeground': '#000000',
      'editor.lineHighlightBackground': '#00000010',
      'editor.selectionBackground': '#00000030',
      'editorCursor.foreground': '#00FF66',
      'editorIndentGuide.background1': '#00000020',
    },
  });
};

function Gate({ text }: { text: string }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-paper p-4">
      <div className="border-2 border-black bg-white px-6 py-4 font-bold text-center shadow-[4px_4px_0px_#000]">
        [!] {text}
      </div>
    </div>
  );
}

/** /join/:roomCode and /play/:roomCode: one socket; first 2 joiners play, the rest spectate. */
export function JoinRoute() {
  const { roomCode = '' } = useParams();
  const [sp] = useSearchParams();
  return <Session roomCode={roomCode} role="auto" nickname={sp.get('name') ?? ''} />;
}

/** /spectate/:roomCode: always spectator. */
export function SpectateRoute() {
  const { roomCode = '' } = useParams();
  const [sp] = useSearchParams();
  return <Session roomCode={roomCode} role="spectator" nickname={sp.get('name') ?? ''} />;
}

function Session({ roomCode, role, nickname }: { roomCode: string; role: RequestedRole; nickname: string }) {
  const session = useWebSocket({ roomCode, role, nickname });
  if (session.error) return <Gate text={`[!] ${session.error}`} />;
  if (!session.roomState) return <Gate text="CONNECTING TO BATTLE..." />;
  return session.assignedRole === 'player' ? <PlayerView session={session} /> : <SpectatorView session={session} />;
}

export default function PlayerView({ session }: { session: RoomSession }) {
  const { roomState: room, myPlayer, opponent, mySlot, secondsLeft, sendProgress } = session;
  const engine = usePyodide();
  const [code, setCode] = useState(room?.problem.buggy_code ?? '');
  const [result, setResult] = useState<TestRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'problem'>('editor');
  const [expandedTest, setExpandedTest] = useState<number | null>(null);
  const lastKey = useRef('');

  const key = room ? `${room.round}:${room.problem.id}` : '';
  useEffect(() => {
    if (room && key !== lastKey.current) {
      lastKey.current = key;
      setCode(room.problem.buggy_code);
      setResult(null);
    }
  }, [key, room]);

  if (!room || !myPlayer) return null;

  const active = room.status === 'ACTIVE';
  const finished = room.status === 'FINISHED';
  const iWon = room.winner?.id === myPlayer.id;
  const total = room.problem.test_cases.length;

  const run = async () => {
    if (!active || running) return;
    setRunning(true);
    soundFx.playThump();
    const r = await engine.runTests(code, room.problem.test_cases);
    setResult(r);
    sendProgress(r.passed, r.total, r.error);
    setRunning(false);

    if (r.passed > (myPlayer?.passed ?? 0)) {
      soundFx.playPass();
    } else if (r.error || r.passed < r.total) {
      soundFx.playFail();
    }
  };

  const handleResetBuggyCode = () => {
    if (window.confirm('Reset code back to original buggy version?')) {
      setCode(room.problem.buggy_code);
      setResult(null);
      soundFx.playThump();
    }
  };

  const Me = mySlot === 'player_2' ? DoodlePlayer2 : DoodlePlayer1;
  const Opp = mySlot === 'player_2' ? DoodlePlayer1 : DoodlePlayer2;

  const myPct = total > 0 ? Math.round(((myPlayer?.passed ?? 0) / total) * 100) : 0;
  const oppPct = total > 0 ? Math.round(((opponent?.passed ?? 0) / total) * 100) : 0;

  return (
    <div className="h-dvh w-screen overflow-hidden flex flex-col bg-[#FAFAFA] text-black select-none">
      {/* Top Header */}
      <header className="border-b-2 border-black flex items-stretch text-xs sm:text-sm bg-white shrink-0 w-full overflow-hidden">
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 shrink-0">
          <span className="font-heading font-extrabold text-xs sm:text-base">BUGARENA</span>
          <DoodleBug size={16} className="shrink-0 sm:w-5 sm:h-5" />
        </div>

        {/* You badge */}
        <div className="border-l-2 border-black px-1.5 sm:px-3 py-1 flex items-center gap-1 shrink-0 max-w-[110px] sm:max-w-none bg-paper">
          <Me size={16} className="shrink-0 sm:w-5 sm:h-5" />
          <span className="font-bold truncate text-[10px] sm:text-xs">
            {myPlayer.name} ({myPlayer.passed}/{total})
          </span>
        </div>

        {/* Rival badge */}
        <div className="border-l-2 border-black px-1.5 sm:px-3 py-1 flex items-center gap-1 flex-1 min-w-0">
          <span className="font-hand text-[10px] text-black/60 hidden xs:inline">vs</span>
          <Opp size={16} className="shrink-0 sm:w-5 sm:h-5 opacity-70" />
          <span className="font-bold truncate text-[10px] sm:text-xs text-black/80">
            {opponent ? `${opponent.name} (${opponent.passed}/${total})` : 'waiting...'}
          </span>
        </div>

        {/* Sound & Cursor Toggles */}
        <div className="hidden sm:flex border-l-2 border-black px-2 items-center gap-1 shrink-0">
          <SoundToggle />
          <CursorToggle />
        </div>

        <div className="hidden md:flex border-l-2 border-black px-2.5 items-center font-mono font-bold text-xs shrink-0">
          ROOM {room.room_code}
        </div>

        {/* PINNED COUNTDOWN TIMER - ALWAYS VISIBLE ON ALL SCREENS */}
        <div
          className={`border-l-2 border-black px-2.5 sm:px-5 flex items-center gap-1.5 font-mono font-extrabold text-xs sm:text-base shrink-0 ml-auto tabular-nums select-none ${
            active && secondsLeft <= 15
              ? 'bg-red-600 text-white animate-pulse'
              : active && secondsLeft <= 30
                ? 'bg-[#CCFF00] text-black font-extrabold'
                : active
                  ? 'bg-black text-white'
                  : 'bg-paper text-black'
          }`}
          title={`Time remaining: ${formatClock(secondsLeft)}`}
        >
          <span>⏱</span>
          <span>{formatClock(secondsLeft)}</span>
        </div>
      </header>

      {/* Adrenaline Opponent Drag-Strip Race Track */}
      <div className="border-b-2 border-black bg-white px-2 sm:px-4 py-1.5 sm:py-2 shrink-0 flex flex-col gap-1 shadow-[0px_2px_0px_#000]">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="font-mono text-[10px] sm:text-xs">⚡ LIVE RACE TRACK</span>
            <span className="font-hand text-black/60 text-xs hidden sm:inline">(first to squash all bugs wins)</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Clock Badge in Track Bar */}
            <div
              className={`px-1.5 sm:px-2 py-0.5 border border-black font-mono font-bold text-[10px] sm:text-xs flex items-center gap-1 shadow-[1px_1px_0px_#000] ${
                active && secondsLeft <= 15
                  ? 'bg-red-600 text-white animate-pulse'
                  : active && secondsLeft <= 30
                    ? 'bg-[#CCFF00] text-black font-extrabold'
                    : 'bg-paper text-black'
              }`}
            >
              <span>⏱ {formatClock(secondsLeft)}</span>
            </div>

            <span className="text-[10px] sm:text-xs">
              YOU: <span className="font-mono font-bold">{myPlayer.passed}/{total}</span>
            </span>
            <span className="text-[10px] sm:text-xs text-black/70">
              RIVAL: <span className="font-mono font-bold">{opponent?.passed ?? 0}/{total}</span>
            </span>
          </div>
        </div>

        {/* 2-Lane Sprint Tracks */}
        <div className="grid grid-cols-1 gap-1">
          {/* Lane 1: You */}
          <div className="relative border border-black h-4 bg-paper flex items-center overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-300 ease-out"
              style={{ width: `${myPct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 flex items-center transition-all duration-300"
              style={{ left: `calc(${Math.min(myPct, 95)}% - 6px)` }}
            >
              <span className="text-xs">🏃</span>
            </div>
            <span className="absolute right-1 text-[9px] font-bold font-mono text-black/70">
              [🏁 FINISH]
            </span>
          </div>

          {/* Lane 2: Opponent */}
          <div className="relative border border-black h-4 bg-paper flex items-center overflow-hidden">
            <div
              className="h-full hatch transition-all duration-300 ease-out"
              style={{ width: `${oppPct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 flex items-center transition-all duration-300"
              style={{ left: `calc(${Math.min(oppPct, 95)}% - 6px)` }}
            >
              <span className="text-xs opacity-75">👾</span>
            </div>
            <span className="absolute right-1 text-[9px] font-bold font-mono text-black/70">
              [🏁 FINISH]
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Tab Bar with Sticky Live Countdown Timer */}
      <div className="md:hidden grid grid-cols-[1fr_1fr_auto] border-b-2 border-black bg-[#f0f0f0] text-xs font-bold shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`py-2 px-2 flex items-center justify-center gap-1 border-r border-black cursor-pointer transition-colors ${
            mobileTab === 'editor' ? 'bg-black text-white' : 'bg-white text-black'
          }`}
        >
          <span>💻 CODE</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('problem')}
          className={`py-2 px-2 flex items-center justify-center gap-1 border-r border-black cursor-pointer transition-colors ${
            mobileTab === 'problem' ? 'bg-black text-white' : 'bg-white text-black'
          }`}
        >
          <span>📋 PROBLEM</span>
          <span
            className={`px-1 py-0.2 text-[10px] font-bold ${
              mobileTab === 'problem' ? 'bg-white text-black' : 'bg-black text-white'
            }`}
          >
            {result ? `${result.passed}/${result.total}` : `${myPlayer.passed}/${total}`}
          </span>
        </button>

        {/* Live Timer directly in Mobile Tab Bar */}
        <div
          className={`px-3 py-2 flex items-center justify-center gap-1 font-mono font-extrabold text-xs tabular-nums ${
            active && secondsLeft <= 15
              ? 'bg-red-600 text-white animate-pulse'
              : active && secondsLeft <= 30
                ? 'bg-[#CCFF00] text-black font-extrabold'
                : 'bg-black text-white'
          }`}
        >
          <span>⏱</span>
          <span>{formatClock(secondsLeft)}</span>
        </div>
      </div>

      {/* Main Split: Left (Problem + Test Cards), Right (Monaco + Controls) */}
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[minmax(300px,2fr)_3fr]">
        {/* Left: Problem & Test Verification Cards */}
        <aside
          className={`flex-col min-h-0 border-b-2 md:border-b-0 md:border-r-2 border-black bg-[#FAFAFA] ${
            mobileTab === 'problem' ? 'flex flex-1' : 'hidden md:flex'
          }`}
        >
          {/* Problem Brief */}
          <div className="border-b-2 border-black p-3 sm:p-4 overflow-y-auto max-h-[40%] bg-white">
            <div className="flex items-center justify-between">
              <span className="font-hand text-xs text-black/70">ROUND {room.round} CHALLENGE</span>
              <button
                type="button"
                onClick={handleResetBuggyCode}
                className="font-hand text-[11px] text-black/70 hover:text-black underline cursor-pointer"
              >
                ↺ revert to original bug
              </button>
            </div>
            <h2 className="font-heading font-extrabold text-lg sm:text-2xl leading-tight mt-0.5">
              {room.problem.title}
            </h2>
            <p className="text-xs mt-1.5 whitespace-pre-wrap leading-relaxed text-black/90">
              {room.problem.description}
            </p>
            <p className="font-hand text-xs mt-2 text-black/80 font-bold">
              There is exactly one bug. Find it, fix it, squash it.
            </p>
          </div>

          {/* Test Console Header */}
          <div className="border-b-2 border-black px-3 py-2 flex justify-between items-center text-xs font-bold bg-[#f3f3f3]">
            <span>TEST VERIFICATION CARDS</span>
            <span className="border border-black px-2 py-0.5 bg-white font-mono">
              {result ? `${result.passed}/${result.total}` : `0/${total}`} PASSED
            </span>
          </div>

          {/* Test Cards List with Expandable Accordions */}
          <div className="flex-1 overflow-y-auto text-xs p-2 space-y-1.5 bg-[#FAFAFA]">
            {!result && (
              <div className="p-4 font-hand text-black/60 flex flex-col gap-1 text-center">
                <span>Press [ RUN TESTS ] or Ctrl + Enter to test your code.</span>
              </div>
            )}

            {result?.error && (
              <div className="border-2 border-black bg-black text-white p-3 whitespace-pre-wrap break-words font-mono text-[11px] shadow-[2px_2px_0px_#000]">
                <div className="font-bold mb-1 text-red-400">RUNTIME ERROR:</div>
                {result.error}
              </div>
            )}

            {room.problem.test_cases.map((t, i) => {
              const res = result?.results[i];
              const isPassed = res?.passed;
              const isExpanded = expandedTest === i;

              return (
                <div
                  key={i}
                  className={`border-2 border-black bg-white transition-all ${
                    isPassed === true
                      ? 'border-black'
                      : isPassed === false
                        ? 'border-red-600 bg-red-50/20'
                        : 'border-black/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedTest(isExpanded ? null : i)}
                    className="w-full px-3 py-2 flex items-center justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 ${
                          isPassed === true
                            ? 'bg-black text-white'
                            : isPassed === false
                              ? 'bg-red-600 text-white'
                              : 'bg-black/10 text-black'
                        }`}
                      >
                        {isPassed === true ? '✓ PASS' : isPassed === false ? '✗ FAIL' : '· WAIT'}
                      </span>
                      <span className="font-bold truncate text-xs">{t.name}</span>
                    </div>
                    <span className="text-[11px] font-hand text-black/60 shrink-0 ml-2">
                      {isExpanded ? 'hide ▲' : 'inspect ▼'}
                    </span>
                  </button>

                  {/* Expandable Test Case Details Accordion */}
                  {isExpanded && (
                    <div className="border-t border-black p-2.5 bg-paper font-mono text-[11px] flex flex-col gap-1">
                      <div className="text-black/70 font-bold">ASSERTION:</div>
                      <pre className="bg-white border border-black/40 p-1.5 overflow-x-auto whitespace-pre-wrap">
                        {t.code}
                      </pre>
                      {res?.error && (
                        <div className="text-red-600 font-bold mt-1">
                          FAILED: {res.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick mobile switch back */}
          <div className="border-t-2 border-black p-2 bg-white flex items-center justify-between md:hidden shrink-0">
            <span className="font-hand text-xs text-black/70">Ready to edit?</span>
            <button
              type="button"
              onClick={() => setMobileTab('editor')}
              className="btn-ink px-4 py-2 text-xs font-bold cursor-pointer"
            >
              BACK TO CODE →
            </button>
          </div>
        </aside>

        {/* Right: Monaco Editor & Action Toolbar */}
        <section
          className={`flex-col min-h-0 relative ${
            mobileTab === 'editor' ? 'flex flex-1' : 'hidden md:flex'
          }`}
        >
          {/* Editor Header Bar with Reset Button */}
          <div className="border-b border-black px-3 py-1.5 bg-white flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold">solution.py</span>
              <span className="text-[10px] text-black/60 font-mono">Python 3.10 (WASM)</span>
            </div>
            <button
              type="button"
              onClick={handleResetBuggyCode}
              className="font-hand text-xs text-black/70 hover:text-black underline cursor-pointer"
            >
              [ ↺ RESET TO BUG ]
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language="python"
              theme="bugarena"
              beforeMount={defineTheme}
              value={code}
              onChange={(v) => setCode(v ?? '')}
              onMount={(editor) => {
                editor.addCommand(2048 | 3, run); // Ctrl/Cmd + Enter
              }}
              options={{
                readOnly: !active,
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                tabSize: 4,
                renderLineHighlight: 'line',
                padding: { top: 10 },
                automaticLayout: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                cursorStyle: 'line',
                cursorWidth: 2,
              }}
            />
          </div>

          {/* Bottom Execution Bar */}
          <div className="border-t-2 border-black flex items-stretch bg-white">
            <div className="flex-1 px-3 flex items-center gap-2 text-xs font-bold truncate">
              <span className="hidden sm:inline text-black/70">HOTKEY:</span>
              <kbd className="border border-black px-1.5 py-0.5 text-[10px] bg-paper shadow-[1px_1px_0px_#000]">
                ⌘ / Ctrl + Enter
              </kbd>
            </div>

            {active && <InkArrow width={55} className="hidden sm:block self-center mr-1" />}

            <button
              onClick={run}
              disabled={!active || running || !engine.isReady}
              className="btn-ink px-6 sm:px-8 py-3 text-xs sm:text-sm shrink-0 cursor-pointer shadow-[3px_3px_0px_#000]"
            >
              {running ? 'TESTING...' : 'RUN TESTS →'}
            </button>
          </div>

          {/* Lobby Waiting Overlay */}
          {!active && !finished && (
            <div className="absolute inset-0 bg-[#FAFAFA]/90 flex flex-col items-center justify-center text-center gap-2 p-4 z-20">
              <div className="font-display italic text-3xl sm:text-5xl">Waiting for opponent</div>
              <div className="font-hand text-xs sm:text-sm">
                Duel starts automatically when 2 players are in (or host starts it).
              </div>
              <div className="font-bold text-sm blink mt-1">● ● ●</div>
            </div>
          )}

          {/* Match Finished Overlay */}
          {finished && (
            <div className="absolute inset-0 bg-[#FAFAFA]/95 overflow-y-auto flex flex-col items-center justify-start sm:justify-center text-center gap-3 p-4 sm:p-6 z-20 border-2 border-black m-2 shadow-[6px_6px_0px_#000]">
              <div className="font-display italic text-5xl sm:text-7xl leading-none">
                {room.winner ? (iWon ? '🎉 YOU WIN!' : '💀 YOU LOSE') : '🤝 DRAW'}
              </div>
              <div className="font-hand text-xs sm:text-sm font-bold">
                {room.winner
                  ? `${room.winner.name} ${room.finish_reason === 'timeout' ? 'led at time-up' : 'fixed all bugs'} (${room.winner.passed}/${room.winner.total})`
                  : 'Nobody squashed the bug in time.'}
              </div>
              {room.problem.description_bug && (
                <div className="border-2 border-black p-3 text-xs max-w-lg text-left bg-white shadow-[2px_2px_0px_#000]">
                  <div className="font-bold mb-1">THE BUG INJECTED:</div>
                  <div className="mb-2">{room.problem.description_bug}</div>
                  {room.problem.diff && (
                    <pre className="p-2 border border-black/40 bg-paper whitespace-pre-wrap font-mono text-[11px] overflow-x-auto">
                      {room.problem.diff}
                    </pre>
                  )}
                </div>
              )}
              <div className="font-hand text-xs sm:text-sm text-black/70">
                Waiting for host to launch the next round...
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
