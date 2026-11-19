"""Verify the AST mutator breaks code and fails a test; verify room flow."""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from ast_mutator import mutate_code, MUTATOR_CLASSES  # noqa: E402

problems = json.load(open(os.path.join(os.path.dirname(__file__), "problems.json"), encoding="utf-8"))
assert len(problems) >= 6, "need >= 6 problems"


class StepLimit(Exception):
    pass


def _guarded(fn):
    """Run fn with a trace-based step budget so mutated infinite loops abort."""
    steps = [0]

    def tracer(frame, event, arg):
        steps[0] += 1
        if steps[0] > 200_000:
            raise StepLimit()
        return tracer

    sys.settrace(tracer)
    try:
        return fn()
    finally:
        sys.settrace(None)


def run_tests(code, p):
    env = {}
    exec(code, env)
    passed = 0
    for t in p["test_cases"]:
        try:
            _guarded(lambda: exec(t["code"], env))
            passed += 1
        except BaseException:
            pass
    return passed, len(p["test_cases"])


broken = 0
for p in problems:
    assert run_tests(p["clean_code"], p) == (len(p["test_cases"]),) * 2, p["id"] + " clean fails"
    for cat in MUTATOR_CLASSES:
        for _ in range(5):
            m = mutate_code(p["clean_code"], preferred_category=cat)
            assert m["buggy_code"] != p["clean_code"]
            try:
                ok, tot = run_tests(m["buggy_code"], p)
            except Exception:
                ok, tot = 0, 1  # crashed = broken
            if ok < tot:
                broken += 1
print("mutations that broke a test:", broken)
assert broken > 0
print("AST MUTATOR OK")


# Room manager smoke test with fake websockets
from room_manager import RoomManager  # noqa: E402


class FakeWS:
    def __init__(self):
        self.msgs = []

    async def send_text(self, m):
        self.msgs.append(json.loads(m))


async def flow():
    rm = RoomManager(os.path.join(os.path.dirname(__file__), "problems.json"))
    room = rm.create_room()
    c = room.room_code
    ws = {k: FakeWS() for k in "pabcd"}
    await rm.register_connection(c, "proj", "projector", "", ws["p"])
    await rm.register_connection(c, "a", "auto", "Ann", ws["a"])
    assert room.status == "WAITING"
    await rm.register_connection(c, "b", "auto", "Bob", ws["b"])
    assert room.status == "ACTIVE", "auto-start with 2 players"
    r = await rm.register_connection(c, "c", "auto", "Cy", ws["c"])
    assert r["assigned_role"] == "spectator"
    await rm.handle_spectator_vote(c, "c", "player_1")
    await rm.handle_next_bug_vote(c, "c", "arithmetic")
    total = len(room.problem["test_cases"])
    await rm.handle_progress_update(c, "a", 1, total)
    await rm.handle_progress_update(c, "b", total, total)
    assert room.status == "FINISHED" and room.winner["name"] == "Bob"
    await rm.start_next_round(c)
    assert room.status == "ACTIVE" and room.round == 2
    assert room.problem["mutation_category"] == "arithmetic"
    # timeout path
    await rm.handle_progress_update(c, "a", 2, len(room.problem["test_cases"]))
    await rm._finish_on_timeout(room)
    assert room.winner["name"] == "Ann"
    print("ROOM FLOW OK")


asyncio.run(flow())
