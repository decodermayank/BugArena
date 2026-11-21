import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { BeforeMount } from '@monaco-editor/react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { usePyodide } from '../hooks/usePyodide';
import { DoodleBug, InkArrow } from '../components/Doodles';
import SoundToggle from '../components/SoundToggle';
import { CursorToggle } from '../components/CustomCursor';
import { soundFx } from '../utils/soundFx';
import type { TestCase, TestRunResult } from '../types';

interface PracticeProblem {
  id: string;
  title: string;
  category: string;
  description: string;
  hint: string;
  buggy_code: string;
  test_cases: TestCase[];
}

const PRACTICE_PROBLEMS: PracticeProblem[] = [
  {
    id: 'two_sum',
    title: 'Two Sum',
    category: 'LOGIC ERROR',
    description:
      'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. Each input has exactly one solution.',
    hint: 'Look closely at the return statement when a matching complement is found. Are both indices distinct?',
    buggy_code: `def two_sum(nums, target):
    lookup = {}
    for i in range(len(nums)):
        diff = target - nums[i]
        if diff in lookup:
            # BUG: returning identical index instead of lookup[diff]
            return [i, i]
        lookup[nums[i]] = i
    return []`,
    test_cases: [
      { name: 'Standard pair [2, 7, 11, 15], 9', code: 'assert two_sum([2, 7, 11, 15], 9) == [0, 1]' },
      { name: 'Mid-array pair [3, 2, 4], 6', code: 'assert two_sum([3, 2, 4], 6) == [1, 2]' },
      { name: 'Identical elements [3, 3], 6', code: 'assert two_sum([3, 3], 6) == [0, 1]' },
      { name: 'Negative target [-1, -2, -3, -4, -5], -8', code: 'assert two_sum([-1, -2, -3, -4, -5], -8) == [2, 4]' },
    ],
  },
  {
    id: 'is_palindrome',
    title: 'Valid Palindrome',
    category: 'INVERTED LOGIC',
    description:
      'Given a string `s`, return `True` if it is a palindrome considering only alphanumeric characters and ignoring cases, or `False` otherwise.',
    hint: 'Inspect the while loop condition. When should the two-pointer scan continue?',
    buggy_code: `def is_palindrome(s):
    filtered = [ch.lower() for ch in s if ch.isalnum()]
    left = 0
    right = len(filtered) - 1
    # BUG: inverted loop condition
    while left > right:
        if filtered[left] != filtered[right]:
            return False
        left = left + 1
        right = right - 1
    return True`,
    test_cases: [
      { name: 'Standard palindrome', code: "assert is_palindrome('A man, a plan, a canal: Panama') == True" },
      { name: 'Non-palindrome', code: "assert is_palindrome('race a car') == False" },
      { name: 'Empty string with spaces', code: "assert is_palindrome('   ') == True" },
      { name: 'Alphanumeric mix', code: "assert is_palindrome('0P') == False" },
    ],
  },
  {
    id: 'binary_search',
    title: 'Binary Search',
    category: 'OFF-BY-ONE',
    description:
      'Given a sorted array of integers `nums` and a target value `target`, return the index of `target` if found, or `-1` if it is not present in `nums`.',
    hint: 'When nums[mid] < target, what should low become to avoid stalling in the same index?',
    buggy_code: `def binary_search(nums, target):
    low = 0
    high = len(nums) - 1
    while low <= high:
        mid = (low + high) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            # BUG: missing + 1 causes infinite loop on misses
            low = mid
        else:
            high = mid - 1
    return -1`,
    test_cases: [
      { name: 'Element found at middle', code: 'assert binary_search([-1, 0, 3, 5, 9, 12], 9) == 4' },
      { name: 'Element not present', code: 'assert binary_search([-1, 0, 3, 5, 9, 12], 2) == -1' },
      { name: 'Single item match', code: 'assert binary_search([5], 5) == 0' },
      { name: 'Search boundary element', code: 'assert binary_search([1, 2, 3, 4, 5], 5) == 4' },
    ],
  },
  {
    id: 'fibonacci',
    title: 'Nth Fibonacci Number',
    category: 'OFF-BY-ONE',
    description:
      'Return the nth Fibonacci number, where `F(0) = 0`, `F(1) = 1`, and `F(n) = F(n-1) + F(n-2)` for `n >= 2`.',
    hint: 'Check the range() stop value. Python ranges are exclusive of the upper bound!',
    buggy_code: `def fibonacci(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    a = 0
    b = 1
    # BUG: range stops at n - 1 instead of n
    for i in range(2, n):
        c = a + b
        a = b
        b = c
    return b`,
    test_cases: [
      { name: 'Base case 0', code: 'assert fibonacci(0) == 0' },
      { name: 'Base case 1', code: 'assert fibonacci(1) == 1' },
      { name: 'Small fib (n=2)', code: 'assert fibonacci(2) == 1' },
      { name: 'Medium fib (n=6)', code: 'assert fibonacci(6) == 8' },
      { name: 'Larger fib (n=10)', code: 'assert fibonacci(10) == 55' },
    ],
  },
  {
    id: 'count_vowels',
    title: 'Count Vowels',
    category: 'INCOMPLETE LOGIC',
    description:
      'Given a string `text`, return the total number of vowels (a, e, i, o, u, case-insensitive) in the string.',
    hint: 'Check the uppercase vowels in the lookup set. Did any get left behind?',
    buggy_code: `def count_vowels(text):
    # BUG: Missing uppercase 'O' and 'U'
    vowels = set('aeiouAEI')
    count = 0
    for ch in text:
        if ch in vowels:
            count = count + 1
    return count`,
    test_cases: [
      { name: 'Hello World', code: "assert count_vowels('Hello World') == 3" },
      { name: 'All vowels', code: "assert count_vowels('AeIoU') == 5" },
      { name: 'No vowels', code: "assert count_vowels('xyz 123 !?') == 0" },
      { name: 'Sentence with mixed case', code: "assert count_vowels('Programming is awesome') == 8" },
    ],
  },
];

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

export default function PracticeView() {
  const navigate = useNavigate();
  const engine = usePyodide();
  const [problemIdx, setProblemIdx] = useState(0);
  const problem = PRACTICE_PROBLEMS[problemIdx];
  const [code, setCode] = useState(problem.buggy_code);
  const [result, setResult] = useState<TestRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'problem'>('editor');
  const [startTime] = useState(Date.now());
  const [seconds, setSeconds] = useState(0);

  // Timer
  useEffect(() => {
    if (solved) return;
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [solved, startTime]);

  // Load next problem
  useEffect(() => {
    setCode(problem.buggy_code);
    setResult(null);
    setShowHint(false);
    setSolved(false);
  }, [problemIdx, problem]);

  const run = async () => {
    if (running || !engine.isReady) return;
    setRunning(true);
    soundFx.playThump();
    const r = await engine.runTests(code, problem.test_cases);
    setResult(r);
    setRunning(false);

    if (r.passed === problem.test_cases.length && r.total > 0) {
      setSolved(true);
      soundFx.playVictory();
      confetti({
        particleCount: 50,
        spread: 60,
        colors: ['#000000', '#ffffff', '#888888'],
        origin: { y: 0.6 },
      });
    } else if (r.passed > 0) {
      soundFx.playPass();
    } else {
      soundFx.playFail();
    }
  };

  const handleNextProblem = () => {
    setProblemIdx((prev) => (prev + 1) % PRACTICE_PROBLEMS.length);
  };

  const handleReset = () => {
    setCode(problem.buggy_code);
    setResult(null);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="h-dvh w-screen overflow-hidden flex flex-col bg-[#FAFAFA] text-black">
      {/* Top Header */}
      <header className="bb flex items-stretch text-xs sm:text-sm bg-white min-h-[40px] shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 font-heading font-extrabold text-sm sm:text-lg hover:underline cursor-pointer"
          >
            <span>BUGARENA</span>
            <DoodleBug size={18} className="shrink-0 sm:w-5 sm:h-5" />
          </button>
          <span className="hidden xs:inline bl px-1.5 sm:px-2 text-[10px] sm:text-[11px] font-bold bg-black text-white">
            DOJO
          </span>
        </div>

        <div className="bl px-2 sm:px-3 py-1 flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
          <span className="font-hand text-xs text-black/70 hidden md:inline">CHALLENGE:</span>
          <select
            value={problemIdx}
            onChange={(e) => setProblemIdx(Number(e.target.value))}
            className="border border-black px-1.5 py-0.5 font-bold text-xs bg-white cursor-pointer w-full max-w-[130px] sm:max-w-[220px] truncate"
          >
            {PRACTICE_PROBLEMS.map((p, i) => (
              <option key={p.id} value={i}>
                #{i + 1}: {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="bl px-2 sm:px-3 flex items-center font-mono font-bold text-xs sm:text-sm shrink-0">
          ⏱ {formatTime(seconds)}
        </div>

        <div className="bl px-2 flex items-center gap-1 shrink-0">
          <SoundToggle />
          <CursorToggle />
        </div>

        <div className="bl px-2 sm:px-3 flex items-center gap-1.5 text-xs font-bold shrink-0">
          <span
            className={`w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0 ${
              engine.isReady ? 'bg-black' : 'border border-black animate-pulse'
            }`}
          />
          <span className="hidden sm:inline">WASM:</span>
          <span className="hidden sm:inline">{engine.status.toUpperCase()}</span>
        </div>

        <button
          onClick={() => navigate('/')}
          className="bl px-2.5 sm:px-3 py-1.5 font-bold text-xs hover:bg-black hover:text-white transition-colors cursor-pointer shrink-0"
          title="Exit to home"
        >
          <span className="sm:hidden">✕</span>
          <span className="hidden sm:inline">✕ EXIT</span>
        </button>
      </header>

      {/* Mobile Tab Bar */}
      <div className="md:hidden grid grid-cols-2 bb bg-[#f0f0f0] text-xs font-bold shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`py-2 px-3 flex items-center justify-center gap-1.5 border-r border-black cursor-pointer transition-colors ${
            mobileTab === 'editor' ? 'bg-black text-white' : 'bg-white text-black'
          }`}
        >
          <span>💻 CODE EDITOR</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('problem')}
          className={`py-2 px-3 flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            mobileTab === 'problem' ? 'bg-black text-white' : 'bg-white text-black'
          }`}
        >
          <span>📋 PROBLEM & TESTS</span>
          <span
            className={`px-1.5 py-0.5 text-[10px] font-bold ${
              mobileTab === 'problem' ? 'bg-white text-black' : 'bg-black text-white'
            }`}
          >
            {result ? `${result.passed}/${result.total}` : `0/${problem.test_cases.length}`}
          </span>
        </button>
      </div>

      {/* Main split */}
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[minmax(300px,2fr)_3fr]">
        {/* Left: Problem & Test Console */}
        <aside
          className={`flex-col min-h-0 border-b-[1.5px] md:border-b-0 md:border-r-[1.5px] border-black bg-[#FAFAFA] ${
            mobileTab === 'problem' ? 'flex flex-1' : 'hidden md:flex'
          }`}
        >
          <div className="bb p-3 sm:p-4 overflow-y-auto max-h-[50%] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold px-2 py-0.5 bg-black text-white">
                BUG: {problem.category}
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="font-hand text-xs text-black/70 hover:text-black underline cursor-pointer"
              >
                ↺ reset code
              </button>
            </div>

            <h1 className="font-heading font-extrabold text-xl sm:text-2xl leading-tight">
              {problem.title}
            </h1>
            <p className="text-xs leading-relaxed whitespace-pre-wrap">{problem.description}</p>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className="text-[11px] font-bold border border-black px-2 py-0.5 bg-white hover:bg-black hover:text-white transition-colors cursor-pointer"
              >
                {showHint ? '🙈 HIDE HINT' : '💡 REVEAL BUG HINT'}
              </button>
              {showHint && (
                <div className="mt-2 p-2 border border-black bg-white text-xs font-hand">
                  {problem.hint}
                </div>
              )}
            </div>
          </div>

          <div className="bb px-3 py-2 flex justify-between items-center text-xs font-bold bg-[#f0f0f0]">
            <span>TEST CONSOLE</span>
            <span>
              {result ? `${result.passed}/${result.total}` : `0/${problem.test_cases.length}`} PASSED
            </span>
          </div>

          <div className="flex-1 overflow-y-auto text-xs">
            {!result && (
              <div className="p-4 font-hand text-black/60 flex flex-col gap-1">
                <span>Hit RUN TESTS (or press Ctrl + Enter) to test your fix.</span>
                <span>There is exactly one bug. Find it, fix it, squash it.</span>
              </div>
            )}

            {result?.error && (
              <div className="p-3 bb bg-black text-white whitespace-pre-wrap break-words font-mono text-[11px]">
                [!] {result.error}
              </div>
            )}

            {problem.test_cases.map((t, i) => {
              const r = result?.results[i];
              const passed = r?.passed;

              return (
                <div
                  key={i}
                  className={`bb px-3 py-2 flex items-center justify-between gap-2 ${
                    passed === true ? 'bg-white' : passed === false ? 'bg-black/5' : ''
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-bold text-xs">
                      {passed === undefined ? '[ ]' : passed ? '[✓]' : '[✗]'}
                    </span>
                    <span className="truncate">{t.name}</span>
                  </div>
                  <span
                    className={`font-bold shrink-0 text-xs ${
                      passed === true ? 'text-black' : passed === false ? 'text-red-600' : 'text-black/40'
                    }`}
                  >
                    {passed === undefined ? 'PENDING' : passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick switch back on mobile */}
          <div className="bt p-2 bg-white flex items-center justify-between md:hidden shrink-0">
            <span className="font-hand text-xs text-black/70">Ready to test?</span>
            <button
              type="button"
              onClick={() => setMobileTab('editor')}
              className="btn-ink px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              BACK TO CODE →
            </button>
          </div>
        </aside>

        {/* Right: Monaco Editor */}
        <section
          className={`flex-col min-h-0 relative ${
            mobileTab === 'editor' ? 'flex flex-1' : 'hidden md:flex'
          }`}
        >
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
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                tabSize: 4,
                renderLineHighlight: 'line',
                padding: { top: 12 },
                automaticLayout: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                cursorStyle: 'line',
                cursorWidth: 2,
              }}
            />
          </div>

          <div className="bt flex items-stretch bg-white">
            <div className="flex-1 px-3 flex items-center gap-1.5 text-xs font-bold text-black/70 truncate">
              <span className="hidden sm:inline">SHORTCUT:</span>
              <kbd className="hidden sm:inline border border-black px-1.5 py-0.5 text-[10px] bg-paper">Ctrl/Cmd + Enter</kbd>
              {result && (
                <span className={`px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold ${
                  result.passed === problem.test_cases.length ? 'bg-black text-white' : 'bg-red-600 text-white'
                }`}>
                  {result.passed}/{result.total}
                </span>
              )}
            </div>
            <InkArrow width={50} className="hidden sm:block self-center mr-1" />
            <button
              onClick={run}
              disabled={running || !engine.isReady}
              className="btn-ink px-5 sm:px-8 py-3 text-xs sm:text-sm cursor-pointer shrink-0"
            >
              {running ? 'TESTING...' : 'RUN TESTS →'}
            </button>
          </div>

          {/* Solved Celebration Overlay */}
          {solved && (
            <div className="absolute inset-0 bg-[#FAFAFA]/95 overflow-y-auto flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 text-center gap-3 z-20 border-2 border-black m-2 sm:m-3 shadow-[4px_4px_0px_#000]">
              <div className="font-hand text-sm sm:text-base text-black/80">BUG SQUASHED!</div>
              <div className="font-heading font-extrabold text-3xl sm:text-5xl tracking-tight">
                ALL TESTS PASSED
              </div>
              <div className="font-mono text-sm font-bold">
                Time: {formatTime(seconds)} | Problem #{problemIdx + 1}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                <button
                  onClick={handleNextProblem}
                  className="btn-ink px-6 py-3 text-sm font-bold flex items-center gap-2 cursor-pointer shadow-[3px_3px_0px_#000]"
                >
                  <span>NEXT BUG</span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => setSolved(false)}
                  className="btn-paper px-4 py-3 text-sm font-bold cursor-pointer"
                >
                  INSPECT CODE
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
