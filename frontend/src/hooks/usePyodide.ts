import { useCallback, useEffect, useRef, useState } from 'react';
import type { TestCase, TestRunResult } from '../types';

export type EngineStatus = 'loading' | 'ready' | 'error';

const RUN_TIMEOUT_MS = 10000;

interface Pending {
  resolve: (r: TestRunResult) => void;
  timer: ReturnType<typeof setTimeout>;
  total: number;
}

/**
 * Runs Python 100% client-side with Pyodide (WebAssembly) inside a Web Worker,
 * so the UI never freezes. Infinite loops are killed by a timeout + worker restart.
 */
export function usePyodide() {
  const [status, setStatus] = useState<EngineStatus>('loading');
  const [initError, setInitError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, Pending>>(new Map());
  const idRef = useRef(0);
  const aliveRef = useRef(true);

  const spawn = useCallback(() => {
    setStatus('loading');
    const worker = new Worker('/pyodide.worker.js');
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as
        | { type: 'ready' }
        | { type: 'init-error'; error: string }
        | { type: 'result'; id: number; result: TestRunResult };
      if (m.type === 'ready') {
        setStatus('ready');
      } else if (m.type === 'init-error') {
        setStatus('error');
        setInitError(m.error);
      } else if (m.type === 'result') {
        const p = pendingRef.current.get(m.id);
        if (p) {
          clearTimeout(p.timer);
          pendingRef.current.delete(m.id);
          p.resolve(m.result);
        }
      }
    };
    worker.onerror = () => {
      setStatus('error');
      setInitError('Worker crashed');
    };
    workerRef.current = worker;
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    spawn();
    return () => {
      aliveRef.current = false;
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current.forEach((p) => clearTimeout(p.timer));
      pendingRef.current.clear();
    };
  }, [spawn]);

  const runTests = useCallback(
    (code: string, tests: TestCase[]): Promise<TestRunResult> => {
      return new Promise((resolve) => {
        const worker = workerRef.current;
        if (!worker) {
          resolve({ passed: 0, total: tests.length, error: 'Engine not started', results: [] });
          return;
        }
        const id = ++idRef.current;
        const timer = setTimeout(() => {
          // Likely an infinite loop: kill the worker and start a fresh one.
          pendingRef.current.delete(id);
          worker.terminate();
          if (aliveRef.current) spawn();
          resolve({
            passed: 0,
            total: tests.length,
            error: 'TimeoutError: code ran longer than 10s (infinite loop?)',
            results: tests.map((t) => ({ name: t.name, passed: false, error: 'Timed out' })),
          });
        }, RUN_TIMEOUT_MS);
        pendingRef.current.set(id, { resolve, timer, total: tests.length });
        worker.postMessage({ type: 'run', id, code, tests });
      });
    },
    [spawn],
  );

  return { status, isReady: status === 'ready', initError, runTests };
}
