import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to initialize Pyodide (Python in WebAssembly) and execute test suites
 * with sub-50ms performance and zero RCE server risk.
 */
export function usePyodide() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState(null);
  const pyodideRef = useRef(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function initPyodide() {
      if (pyodideRef.current || initializingRef.current) return;
      initializingRef.current = true;
      setIsLoading(true);

      try {
        // Wait for pyodide script to load if needed
        let attempts = 0;
        while (!window.loadPyodide && attempts < 50) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.loadPyodide) {
          throw new Error('Pyodide script failed to load from CDN. Please check internet connection.');
        }

        const pyodide = await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
        });

        // Preload Python test runner harness inside the WASM environment
        await pyodide.runPythonAsync(`
import sys
import io
import json
import traceback

def __run_codeduel_tests__(user_code_str, test_cases_json_str):
    test_cases_list = json.loads(test_cases_json_str)
    local_env = {}
    stdout_capture = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = stdout_capture

    try:
        # Compile and execute the user function
        exec(user_code_str, local_env)
    except Exception as e:
        sys.stdout = old_stdout
        tb = traceback.format_exc()
        return json.dumps({
            "passed": 0,
            "total": len(test_cases_list),
            "error": tb,
            "syntax_error": True,
            "results": [{"name": tc.get("name", f"Test {i+1}"), "passed": False, "error": str(e)} for i, tc in enumerate(test_cases_list)],
            "logs": stdout_capture.getvalue()
        })

    passed_count = 0
    results = []
    first_error = None

    for i, tc in enumerate(test_cases_list):
        tc_name = tc.get("name", f"Test {i+1}")
        tc_code = tc.get("code", "")
        try:
            exec(tc_code, local_env)
            results.append({"name": tc_name, "passed": True, "error": None})
            passed_count += 1
        except AssertionError as ae:
            err_msg = f"Assertion failed on {tc_name}"
            if first_error is None:
                first_error = err_msg
            results.append({"name": tc_name, "passed": False, "error": err_msg})
        except Exception as ex:
            tb = traceback.format_exc()
            if first_error is None:
                first_error = f"{type(ex).__name__}: {str(ex)}"
            results.append({"name": tc_name, "passed": False, "error": str(ex)})

    sys.stdout = old_stdout
    return json.dumps({
        "passed": passed_count,
        "total": len(test_cases_list),
        "error": first_error,
        "syntax_error": False,
        "results": results,
        "logs": stdout_capture.getvalue()
    })
        `);

        if (isMounted) {
          pyodideRef.current = pyodide;
          setIsReady(true);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to initialize Pyodide WASM:', err);
          setInitError(err.message || 'Pyodide initialization failed');
          setIsLoading(false);
        }
      }
    }

    initPyodide();

    return () => {
      isMounted = false;
    };
  }, []);

  const runTests = useCallback(
    async (userCode, testCases) => {
      if (!pyodideRef.current) {
        return {
          passed: 0,
          total: testCases?.length || 0,
          error: 'Pyodide engine is still loading. Please wait 2 seconds...',
          results: [],
          logs: '',
          executionTime: 0,
        };
      }

      const startTime = performance.now();
      try {
        const pyodide = pyodideRef.current;
        const testCasesJson = JSON.stringify(testCases || []);

        // Pass variables safely into Python globals
        pyodide.globals.set('__temp_user_code__', userCode);
        pyodide.globals.set('__temp_test_cases__', testCasesJson);

        const rawResultJson = await pyodide.runPythonAsync(`
__run_codeduel_tests__(__temp_user_code__, __temp_test_cases__)
        `);

        const result = JSON.parse(rawResultJson);
        const executionTime = Math.round(performance.now() - startTime);

        return {
          ...result,
          executionTime,
        };
      } catch (err) {
        const executionTime = Math.round(performance.now() - startTime);
        return {
          passed: 0,
          total: testCases?.length || 0,
          error: err.message || 'Unknown execution error',
          syntax_error: true,
          results: (testCases || []).map((tc) => ({
            name: tc.name,
            passed: false,
            error: err.message,
          })),
          logs: '',
          executionTime,
        };
      }
    },
    []
  );

  return { isReady, isLoading, initError, runTests };
}
