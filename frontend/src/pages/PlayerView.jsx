import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import confetti from 'canvas-confetti';
import {
  Swords,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Timer,
  Terminal,
  Zap,
  Trophy,
  ShieldAlert,
  Users,
  ChevronRight,
  Code2
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { usePyodide } from '../hooks/usePyodide';
import SpectatorView from './SpectatorView';

export default function PlayerView() {
  const { roomCode } = useParams();
  const [searchParams] = useSearchParams();
  const nickname = searchParams.get('name') || 'Challenger';

  const { isReady: isPyodideReady, isLoading: isPyodideLoading, runTests } = usePyodide();

  const {
    roomState,
    isConnected,
    assignedRole,
    playerIndex,
    myPlayer,
    opponentPlayer,
    sendProgress,
    submitWin,
  } = useWebSocket({
    roomCode: roomCode || '',
    role: 'player',
    nickname,
  });

  const [code, setCode] = useState('');
  const [hasEdited, setHasEdited] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'console' | 'problem'

  // Preload buggy code when problem arrives
  useEffect(() => {
    if (roomState?.problem?.buggy_code && !hasEdited) {
      setCode(roomState.problem.buggy_code);
    }
  }, [roomState?.problem?.buggy_code, hasEdited]);

  // If match restarts / next round begins, reset code
  useEffect(() => {
    if (roomState?.problem?.buggy_code) {
      setCode(roomState.problem.buggy_code);
      setTestResults(null);
      setHasEdited(false);
    }
  }, [roomState?.problem?.id]);

  // Confetti on win
  useEffect(() => {
    if (roomState?.status === 'FINISHED' && roomState?.winner?.id === myPlayer?.id) {
      try {
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.6 },
          colors: ['#06b6d4', '#a855f7', '#22c55e', '#ec4899'],
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, [roomState?.status, roomState?.winner?.id, myPlayer?.id]);

  // Execute test cases using Pyodide in the browser
  const handleRunTests = async () => {
    if (!isPyodideReady || isRunning) return;
    setIsRunning(true);

    const testCases = roomState?.problem?.test_cases || [];
    const result = await runTests(code, testCases);
    setTestResults(result);
    setIsRunning(false);

    // Broadcast live test progress to opponent, projector, and spectators
    sendProgress(result.passed, result.total, result.error);

    // If passed all assertions, submit victory!
    if (result.passed === result.total && result.total > 0) {
      submitWin(code, result.passed, result.total);
    }
  };

  const handleResetCode = () => {
    if (roomState?.problem?.buggy_code) {
      setCode(roomState.problem.buggy_code);
      setHasEdited(false);
    }
  };

  // Keyboard shortcut Ctrl+Enter / Cmd+Enter to run tests
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunTests();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, isPyodideReady, isRunning, roomState]);

  // If auto-assigned to spectator because 2 players were already in the room
  if (assignedRole === 'spectator') {
    return <SpectatorView autoAssigned={true} />;
  }

  const totalTests = roomState?.problem?.test_cases?.length || 5;
  const myPassed = myPlayer?.passed || 0;
  const opponentPassed = opponentPlayer?.passed || 0;

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden selection:bg-purple-600 selection:text-white">
      {/* Top Competitive Battle Header */}
      <header className="relative z-10 border-b border-slate-800 bg-slate-950 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-1.5 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-lg">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-sm tracking-wider hidden sm:inline">CODEDUEL</span>
          </Link>

          <div className="h-4 w-px bg-slate-800"></div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/30">
              {roomCode?.toUpperCase()}
            </span>
            <span className="text-slate-400 truncate max-w-[150px] font-semibold">
              {roomState?.problem?.title || 'Bug Duel'}
            </span>
          </div>
        </div>

        {/* 1v1 Battle HUD: You vs Opponent Progress */}
        <div className="flex items-center gap-6">
          {/* Your mini progress */}
          <div className="flex items-center gap-2 text-xs">
            <div className="text-right">
              <div className="font-bold text-cyan-400 flex items-center gap-1 justify-end">
                <span>YOU</span>
                <span className="text-slate-500">({myPlayer?.name || nickname})</span>
              </div>
              <div className="font-mono text-[11px] text-slate-300">
                {myPassed}/{totalTests} Tests
              </div>
            </div>
            <div className="w-20 h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${(myPassed / totalTests) * 100}%` }}
              ></div>
            </div>
          </div>

          <span className="text-xs font-black text-slate-600 font-mono">VS</span>

          {/* Opponent mini progress */}
          <div className="flex items-center gap-2 text-xs">
            <div className="w-20 h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${(opponentPassed / totalTests) * 100}%` }}
              ></div>
            </div>
            <div>
              <div className="font-bold text-purple-400 flex items-center gap-1">
                <span>OPPONENT</span>
                <span className="text-slate-500 truncate max-w-[80px]">
                  ({opponentPlayer?.name || 'Waiting...'})
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-300">
                {opponentPassed}/{totalTests} Tests
              </div>
            </div>
          </div>
        </div>

        {/* Pyodide Engine Status & Match State */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px]">
            <Zap className={`w-3.5 h-3.5 ${isPyodideReady ? 'text-emerald-400' : 'text-amber-400 animate-spin'}`} />
            <span className="text-slate-400">
              {isPyodideReady ? 'Pyodide WASM Active' : 'Loading Python WASM...'}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 font-mono text-xs font-bold text-cyan-300">
            {roomState?.status === 'ACTIVE' ? 'MATCH ACTIVE' : roomState?.status || 'WAITING'}
          </div>
        </div>
      </header>

      {/* Main Split-Screen Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left / Center: Monaco Editor & Action Bar */}
        <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden bg-slate-950">
          {/* Editor Header Bar */}
          <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2 font-mono">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-200 font-semibold">solution.py</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                Python 3.11 (WASM)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetCode}
                title="Reset to initial buggy code"
                className="px-2.5 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Bug
              </button>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 relative">
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={(value) => {
                setCode(value || '');
                setHasEdited(true);
              }}
              options={{
                fontSize: 14,
                fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                automaticLayout: true,
                tabSize: 4,
                insertSpaces: true,
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>

          {/* Bottom Execution Bar */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="hidden sm:inline">Shortcut:</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-300">
                Ctrl + Enter
              </kbd>

              {testResults?.executionTime !== undefined && (
                <span className="flex items-center gap-1 text-emerald-400 font-mono">
                  <Zap className="w-3 h-3" />
                  {testResults.executionTime}ms WASM
                </span>
              )}
            </div>

            <button
              onClick={handleRunTests}
              disabled={!isPyodideReady || isRunning}
              className="py-2.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950 flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Running Tests...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Run Tests
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Problem Description & Test Results Panel */}
        <div className="w-full md:w-[420px] flex flex-col bg-slate-900/40 border-l border-slate-800 overflow-hidden">
          {/* Panel Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900/80 text-xs">
            <button
              onClick={() => setActiveTab('problem')}
              className={`flex-1 py-2.5 font-semibold text-center transition-all ${
                activeTab === 'problem'
                  ? 'border-b-2 border-cyan-400 text-cyan-300 bg-slate-800/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Problem Spec
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`flex-1 py-2.5 font-semibold text-center transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'tests'
                  ? 'border-b-2 border-cyan-400 text-cyan-300 bg-slate-800/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Test Cases ({testResults?.passed || 0}/{totalTests})
            </button>
            <button
              onClick={() => setActiveTab('console')}
              className={`flex-1 py-2.5 font-semibold text-center transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'console'
                  ? 'border-b-2 border-cyan-400 text-cyan-300 bg-slate-800/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Console Output
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'problem' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {roomState?.problem?.title || 'Loading Problem...'}
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30 font-mono">
                      Bug Category: {roomState?.problem?.mutation_category || 'AST Mutated'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  {roomState?.problem?.description ||
                    'Analyze the buggy function in the editor, identify the procedural AST mutation, and fix it to pass all assertions.'}
                </div>

                <div>
                  <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
                    Unit Test Assertions to Satisfy:
                  </h4>
                  <div className="space-y-2">
                    {(roomState?.problem?.test_cases || []).map((tc, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 font-mono text-xs text-slate-300"
                      >
                        <div className="text-slate-500 text-[10px] mb-0.5">{tc.name}</div>
                        <code>{tc.code}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tests' && (
              <div className="space-y-3">
                {/* Summary Progress Card */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block">Suite Progress</span>
                    <span className="font-mono font-bold text-lg text-white">
                      {testResults ? `${testResults.passed} / ${testResults.total}` : `0 / ${totalTests}`}{' '}
                      Passed
                    </span>
                  </div>
                  <div className="text-right">
                    {testResults?.passed === testResults?.total && testResults?.passed > 0 ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs font-bold">
                        100% SOLVED
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {testResults ? 'Some tests failing' : 'Click "Run Tests" to evaluate'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Individual test case results */}
                <div className="space-y-2">
                  {(roomState?.problem?.test_cases || []).map((tc, i) => {
                    const result = testResults?.results?.[i];
                    const isPassed = result?.passed;
                    const isFailed = result && !result.passed;

                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border text-xs font-mono transition-all ${
                          isPassed
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                            : isFailed
                            ? 'bg-red-950/30 border-red-500/40 text-red-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-300">{tc.name}</span>
                          {isPassed && (
                            <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              PASS
                            </span>
                          )}
                          {isFailed && (
                            <span className="flex items-center gap-1 text-red-400 text-[11px] font-bold">
                              <XCircle className="w-3.5 h-3.5" />
                              FAIL
                            </span>
                          )}
                          {!result && <span className="text-slate-600 text-[10px]">Pending</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{tc.code}</div>
                        {result?.error && (
                          <div className="mt-2 p-2 rounded bg-red-950/50 border border-red-500/30 text-red-300 text-[10px] font-mono whitespace-pre-wrap">
                            {result.error}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'console' && (
              <div className="space-y-3 font-mono text-xs">
                {testResults?.error ? (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 whitespace-pre-wrap">
                    <div className="font-bold text-red-400 mb-1 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      Execution Error:
                    </div>
                    {testResults.error}
                  </div>
                ) : null}

                {testResults?.logs ? (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap">
                    <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">
                      Standard Output:
                    </div>
                    {testResults.logs}
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-600 text-xs">
                    No stdout logs. Run tests to view Python console output.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-Screen Victory Overlay when Match Finishes */}
      {roomState?.status === 'FINISHED' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-purple-500/50 shadow-2xl text-center relative overflow-hidden">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 flex items-center justify-center mb-6">
              <Trophy className="w-10 h-10 animate-bounce" />
            </div>

            <h2 className="text-3xl font-black text-white mb-2">
              {roomState.winner?.id === myPlayer?.id ? '🎉 YOU WON!' : 'MATCH OVER'}
            </h2>

            <p className="text-slate-300 text-sm mb-6">
              {roomState.winner?.id === myPlayer?.id
                ? `Incredible! You fixed the procedural bug in ${roomState.winner.completion_time}s!`
                : `${roomState.winner?.name || 'Your opponent'} solved the bug first in ${
                    roomState.winner?.completion_time
                  }s.`}
            </p>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-left font-mono mb-6">
              <div className="text-purple-400 font-semibold mb-1">Injected Bug:</div>
              <div className="text-slate-400">
                {roomState.problem?.description_bug || roomState.problem?.mutation_category}
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                to={`/arena/${roomCode}`}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all text-center"
              >
                View Arena Screen
              </Link>
              <Link
                to="/"
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 to-cyan-500 text-white transition-all text-center"
              >
                Return to Lobby
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
