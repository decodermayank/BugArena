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
      'editorCursor.foreground': '#000000',
      'editorIndentGuide.background1': '#00000020',
    },
  });
};

function Gate({ text }: { text: string }) {
  return (
    <div className="h-dvh flex items-center justify-center bg-paper p-4">
      <div className="b px-6 py-4 font-bold bg-white text-center">{text}</div>
    </div>
  );
}

/** /join/:roomCode and /play/:roomCode: first 2 joiners play, the rest spectate. */
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
  if (!session.roomState) return <Gate text="CONNECTING..." />;
  return session.assignedRole === 'player' ? <PlayerView session={session} /> : <SpectatorView session={session} />;
}

export default function PlayerView({ session }: { session: RoomSession }) {
  const { roomState: room, myPlayer, opponent, mySlot, secondsLeft, sendProgress } = session;
  const engine = usePyodide();
  const [code, setCode] = useState(room?.problem.buggy_code ?? '');
  const [result, setResult] = useState<TestRunResult | null>(null);
  const [running, setRunning] = useState(false);
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
    const r = await engine.runTests(code, room.problem.test_cases);
    setResult(r);
    sendProgress(r.passed, r.total, r.error);
    setRunning(false);
  };

  const Me = mySlot === 'player_2' ? DoodlePlayer2 : DoodlePlayer1;

  return (
    <div className="h-dvh w-full max-w-full overflow-hidden grid grid-rows-[auto_1fr] bg-paper text-black">
      {/* Responsive Top Bar */}
      <header className="bb flex items-stretch text-xs sm:text-sm bg-paper select-none overflow-x-auto sm:overflow-x-hidden">
        {/* Brand */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 shrink-0">
          <span className="font-heading font-extrabold text-sm sm:text-lg">BUGARENA</span>
          <DoodleBug size={18} className="shrink-0" />
        </div>

        {/* Current Challenger Badge */}
        <div className="bl px-2 sm:px-3 py-1.5 flex items-center gap-1.5 min-w-0 max-w-[120px] sm:max-w-none shrink-0 sm:shrink">
          <Me size={20} className="shrink-0" />
          <span className="font-bold truncate text-[11px] sm:text-xs">
            {myPlayer.name} ({myPlayer.passed}/{total})
          </span>
        </div>

        {/* Opponent Badge */}
        <div className="bl px-2 sm:px-3 py-1.5 flex items-center gap-1 min-w-0 flex-1">
          <span className="font-hand text-[10px] sm:text-xs text-black/60 shrink-0">vs</span>
          <span className="font-bold truncate text-[11px] sm:text-xs text-black/80">
            {opponent ? `${opponent.name} (${opponent.passed}/${total})` : 'waiting...'}
          </span>
        </div>

        {/* Room Code Badge */}
        <div className="hidden md:flex bl px-2.5 items-center font-mono font-bold text-xs shrink-0">
          ROOM {room.room_code}
        </div>

        {/* Countdown Timer */}
        <div className="bl px-2.5 sm:px-4 py-1.5 flex items-center bg-black text-white font-mono font-bold text-xs sm:text-base shrink-0">
          {formatClock(secondsLeft)}
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="grid grid-rows-[minmax(0,1.2fr)_minmax(0,2fr)] md:grid-rows-1 md:grid-cols-[minmax(280px,2fr)_3fr] min-h-0 w-full overflow-hidden">
        {/* Left: problem + test console */}
        <aside className="flex flex-col min-h-0 min-w-0 border-b-[1.5px] md:border-b-0 md:border-r-[1.5px] border-black overflow-hidden bg-white">
          {/* Problem Statement Card */}
          <div className="bb p-2.5 sm:p-3 overflow-y-auto max-h-[45%] shrink-0">
            <div className="font-hand text-[11px] text-black/70">ROUND {room.round}</div>
            <h2 className="font-display italic text-lg sm:text-2xl leading-tight break-words">{room.problem.title}</h2>
            <p className="text-xs mt-1 whitespace-pre-wrap leading-relaxed text-black/85">{room.problem.description}</p>
            <p className="font-hand text-xs mt-1.5 text-black/80">There is exactly one bug. Find it, fix it.</p>
          </div>

          {/* Test Console Bar */}
          <div className="bb px-2.5 sm:px-3 py-1.5 flex justify-between items-center text-xs font-bold bg-[#f3f3f3] shrink-0">
            <span>TEST CONSOLE</span>
            <span className="font-mono">
              {result ? `${result.passed}/${result.total}` : `0/${total}`} PASSED
            </span>
          </div>

          {/* Test Cases Output */}
          <div className="flex-1 min-h-0 overflow-y-auto text-xs">
            {!result && <div className="p-3 font-hand text-black/60">Hit RUN TESTS to execute assertions.</div>}
            {result?.error && (
              <div className="p-2.5 sm:p-3 bb bg-black text-white whitespace-pre-wrap font-mono text-[11px] break-words">
                [!] {result.error}
              </div>
            )}
            {(result?.results.length
              ? result.results
              : room.problem.test_cases.map((t) => ({ name: t.name, passed: null as boolean | null, error: null as string | null }))
            ).map((t, i) => (
              <div key={i} className="bb px-2.5 sm:px-3 py-1.5 flex justify-between items-center gap-2">
                <span className="truncate min-w-0">
                  {t.passed === null ? '[ ]' : t.passed ? '[x]' : '[!]'} {t.name}
                </span>
                <span className={`font-bold font-mono text-[11px] shrink-0 ${t.passed ? 'text-black' : t.passed === false ? 'text-red-600' : ''}`}>
                  {t.passed === null ? '' : t.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* Right: Monaco editor & Run Action Bar */}
        <section className="flex flex-col min-h-0 min-w-0 relative overflow-hidden bg-white">
          <div className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
            <Editor
              height="100%"
              width="100%"
              language="python"
              theme="bugarena"
              beforeMount={defineTheme}
              value={code}
              onChange={(v) => setCode(v ?? '')}
              options={{
                readOnly: !active,
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                tabSize: 4,
                renderLineHighlight: 'line',
                padding: { top: 8, bottom: 8 },
                automaticLayout: true,
                wordWrap: 'on',
                wrappingStrategy: 'advanced',
                lineNumbersMinChars: 3,
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 4,
              }}
            />
          </div>

          {/* Action Bar */}
          <div className="bt flex items-stretch bg-paper shrink-0 min-h-[42px]">
            <div className="flex-1 px-2.5 sm:px-3 flex items-center text-[11px] sm:text-xs font-bold truncate">
              ENGINE: {engine.status === 'ready' ? 'READY' : engine.status === 'loading' ? 'LOADING...' : 'ERROR'}
            </div>
            {active && <InkArrow width={50} className="hidden sm:block self-center mr-1" />}
            <button
              onClick={run}
              disabled={!active || running || !engine.isReady}
              className="btn-ink px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold tracking-wider shrink-0"
            >
              {running ? 'RUNNING...' : 'RUN TESTS'}
            </button>
          </div>

          {/* Waiting for Opponent Overlay */}
          {!active && !finished && (
            <div className="absolute inset-0 bg-paper/92 flex flex-col items-center justify-center text-center gap-2 p-4 z-10">
              <div className="font-display italic text-2xl sm:text-4xl">Waiting for opponent</div>
              <div className="font-hand text-xs sm:text-sm text-black/80 max-w-sm">
                Duel starts automatically when 2 players join (or host starts the match).
              </div>
              <div className="font-mono text-sm font-bold blink mt-1">● ● ●</div>
            </div>
          )}

          {/* Post-Round Finished Overlay */}
          {finished && (
            <div className="absolute inset-0 bg-paper/98 overflow-y-auto flex flex-col items-center justify-center text-center gap-3 p-4 z-20">
              <div className="font-display italic text-4xl sm:text-6xl leading-none">
                {room.winner ? (iWon ? 'You win!' : 'You lose') : 'Draw'}
              </div>
              <div className="font-hand text-xs sm:text-sm text-black/80">
                {room.winner
                  ? `${room.winner.name} ${room.finish_reason === 'timeout' ? 'led when time expired' : 'squashed the bug'} (${room.winner.passed}/${room.winner.total} tests)`
                  : 'Neither player passed all tests before the clock ran out.'}
              </div>
              {room.problem.description_bug && (
                <div className="b p-3 text-xs max-w-md w-full text-left bg-white">
                  <div className="font-bold text-black uppercase tracking-wider mb-1">THE BUG</div>
                  <div className="text-black/85">{room.problem.description_bug}</div>
                  {room.problem.diff && (
                    <pre className="mt-2 p-2 bg-[#111] text-[#CCFF00] font-mono text-[10px] overflow-x-auto border border-black max-h-36">
                      {room.problem.diff}
                    </pre>
                  )}
                </div>
              )}
              <div className="font-hand text-xs sm:text-sm text-black/70">
                Waiting for the host to launch the next round...
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
