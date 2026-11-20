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
    <div className="min-h-dvh flex items-center justify-center bg-paper p-4">
      <div className="b px-6 py-4 font-bold text-center">[!] {text}</div>
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
    <div className="h-dvh w-screen overflow-hidden grid grid-rows-[auto_1fr] bg-paper text-black">
      <header className="bb flex items-stretch text-xs sm:text-sm">
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 shrink-0">
          <span className="font-heading font-extrabold text-base sm:text-lg">BUGARENA</span>
          <DoodleBug size={20} />
        </div>
        <div className="bl px-2.5 sm:px-3 py-1 flex items-center gap-1.5 shrink-0">
          <Me size={24} className="shrink-0" />
          <span className="font-bold truncate max-w-[90px] sm:max-w-none">
            {myPlayer.name} {myPlayer.passed}/{total}
          </span>
        </div>
        <div className="bl px-2 sm:px-3 py-1 flex items-center gap-1.5 flex-1 min-w-0">
          <span className="font-hand">vs</span>
          <span className="font-bold truncate">
            {opponent ? `${opponent.name} ${opponent.passed}/${total}` : 'waiting...'}
          </span>
        </div>
        <div className="hidden sm:flex bl px-3 items-center font-bold shrink-0">ROOM {room.room_code}</div>
        <div className="bl px-3 sm:px-4 flex items-center bg-black text-white font-bold text-sm sm:text-xl shrink-0">
          {formatClock(secondsLeft)}
        </div>
      </header>

      <div className="grid grid-rows-[minmax(0,1.5fr)_minmax(0,2.5fr)] md:grid-rows-1 md:grid-cols-[minmax(280px,2fr)_3fr] min-h-0">
        {/* Left: problem + console */}
        <aside className="flex flex-col min-h-0 border-b-[1.5px] md:border-b-0 md:border-r-[1.5px] border-black">
          <div className="bb p-3 overflow-y-auto max-h-[45%]">
            <div className="font-hand text-xs text-black/70">ROUND {room.round}</div>
            <h2 className="font-display italic text-xl sm:text-2xl leading-tight">{room.problem.title}</h2>
            <p className="text-xs mt-1 whitespace-pre-wrap">{room.problem.description}</p>
            <p className="font-hand text-xs mt-2 text-black/80">There is exactly one bug. Find it, fix it.</p>
          </div>
          <div className="bb px-3 py-1.5 flex justify-between items-center text-xs font-bold bg-[#f3f3f3]">
            <span>TEST CONSOLE</span>
            <span>
              {result ? `${result.passed}/${result.total}` : `0/${total}`} PASSED
            </span>
          </div>
          <div className="flex-1 overflow-y-auto text-xs">
            {!result && <div className="p-3 font-hand text-black/60">Hit RUN TESTS to see results.</div>}
            {result?.error && (
              <div className="p-3 bb bg-black text-white whitespace-pre-wrap break-words">[!] {result.error}</div>
            )}
            {(result?.results.length ? result.results : room.problem.test_cases.map((t) => ({ name: t.name, passed: null as boolean | null, error: null as string | null }))).map(
              (t, i) => (
                <div key={i} className="bb px-3 py-1.5 flex justify-between gap-2">
                  <span className="truncate">
                    {t.passed === null ? '[ ]' : t.passed ? '[x]' : '[!]'} {t.name}
                  </span>
                  <span className={`font-bold shrink-0 ${t.passed ? 'text-black' : t.passed === false ? 'text-red-600' : ''}`}>
                    {t.passed === null ? '' : t.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ),
            )}
          </div>
        </aside>

        {/* Right: editor */}
        <section className="flex flex-col min-h-0 relative">
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language="python"
              theme="bugarena"
              beforeMount={defineTheme}
              value={code}
              onChange={(v) => setCode(v ?? '')}
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
              }}
            />
          </div>
          <div className="bt flex items-stretch">
            <div className="flex-1 px-3 flex items-center text-xs font-bold">
              ENGINE: {engine.status === 'ready' ? 'READY' : engine.status === 'loading' ? 'LOADING...' : 'ERROR'}
            </div>
            {active && <InkArrow width={55} className="hidden sm:block self-center mr-1" />}
            <button
              onClick={run}
              disabled={!active || running || !engine.isReady}
              className="btn-ink px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm"
            >
              {running ? 'RUNNING...' : 'RUN TESTS'}
            </button>
          </div>

          {!active && !finished && (
            <div className="absolute inset-0 bg-paper/90 flex flex-col items-center justify-center text-center gap-2 p-4">
              <div className="font-display italic text-3xl sm:text-4xl">Waiting for opponent</div>
              <div className="font-hand text-xs sm:text-sm">Duel starts automatically when 2 players are in (or host starts it).</div>
              <div className="font-bold text-sm blink">...</div>
            </div>
          )}

          {finished && (
            <div className="absolute inset-0 bg-paper/95 overflow-y-auto flex flex-col items-center justify-center text-center gap-3 p-4">
              <div className="font-display italic text-4xl sm:text-6xl">
                {room.winner ? (iWon ? 'You win!' : 'You lose') : 'Draw'}
              </div>
              <div className="font-hand text-xs sm:text-sm">
                {room.winner
                  ? `${room.winner.name} ${room.finish_reason === 'timeout' ? 'led at time-up' : 'fixed it'} (${room.winner.passed}/${room.winner.total})`
                  : 'Nobody cracked it.'}
              </div>
              {room.problem.description_bug && (
                <div className="b p-3 text-xs max-w-lg text-left bg-white">
                  <div className="font-bold">THE BUG</div>
                  {room.problem.description_bug}
                  {room.problem.diff && <pre className="mt-2 whitespace-pre-wrap font-mono">{room.problem.diff}</pre>}
                </div>
              )}
              <div className="font-hand text-xs sm:text-sm">Waiting for host to start the next round...</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
