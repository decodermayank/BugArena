/* Classic Web Worker: runs Pyodide (Python/WebAssembly) off the UI thread. */
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

const HARNESS = [
  'import sys, io, json, traceback',
  '',
  'def __run_bugarena_tests__(user_code, tests_json):',
  '    tests = json.loads(tests_json)',
  '    env = {"__name__": "__bugarena__"}',
  '    out = io.StringIO()',
  '    old = sys.stdout',
  '    sys.stdout = out',
  '    try:',
  '        try:',
  '            exec(compile(user_code, "<your_code>", "exec"), env)',
  '        except BaseException as e:',
  '            msg = "".join(traceback.format_exception_only(type(e), e)).strip()',
  '            return json.dumps({"passed": 0, "total": len(tests), "error": msg,',
  '                "results": [{"name": t.get("name", "Test"), "passed": False, "error": msg} for t in tests],',
  '                "logs": out.getvalue()})',
  '        passed = 0',
  '        results = []',
  '        first_error = None',
  '        for i, t in enumerate(tests):',
  '            name = t.get("name", "Test %d" % (i + 1))',
  '            try:',
  '                exec(t.get("code", ""), env)',
  '                results.append({"name": name, "passed": True, "error": None})',
  '                passed += 1',
  '            except AssertionError:',
  '                err = "Assertion failed"',
  '                first_error = first_error or ("Assertion failed: " + name)',
  '                results.append({"name": name, "passed": False, "error": err})',
  '            except BaseException as ex:',
  '                err = type(ex).__name__ + ": " + str(ex)',
  '                first_error = first_error or err',
  '                results.append({"name": name, "passed": False, "error": err})',
  '        return json.dumps({"passed": passed, "total": len(tests), "error": first_error,',
  '            "results": results, "logs": out.getvalue()})',
  '    finally:',
  '        sys.stdout = old',
].join('\n');

const pyodideReady = (async () => {
  const py = await loadPyodide();
  py.runPython(HARNESS);
  return py;
})();

pyodideReady
  .then(() => postMessage({ type: 'ready' }))
  .catch((e) => postMessage({ type: 'init-error', error: String(e) }));

onmessage = async (event) => {
  const msg = event.data;
  if (!msg || msg.type !== 'run') return;
  try {
    const py = await pyodideReady;
    py.globals.set('__bugarena_code__', msg.code);
    py.globals.set('__bugarena_tests__', JSON.stringify(msg.tests));
    const raw = py.runPython('__run_bugarena_tests__(__bugarena_code__, __bugarena_tests__)');
    postMessage({ type: 'result', id: msg.id, result: JSON.parse(raw) });
  } catch (err) {
    postMessage({
      type: 'result',
      id: msg.id,
      result: { passed: 0, total: msg.tests.length, error: String(err), results: [] },
    });
  }
};
