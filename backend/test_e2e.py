import asyncio
import json
import httpx
from websockets.asyncio.client import connect

async def test_full_loop():
    print("=== CODEDUEL FULL REAL-TIME INTEGRATION TEST ===")
    base_url = "http://127.0.0.1:8000"
    ws_base = "ws://127.0.0.1:8000"

    # Step 1: Create room
    async with httpx.AsyncClient() as client:
        res = await client.post(f"{base_url}/create-room")
        assert res.status_code == 200, f"Create room failed: {res.text}"
        room_data = res.json()
        room_code = room_data["room_code"]
        print(f"[OK] Room created: {room_code} | Problem: {room_data['problem']['title']}")
        print(f"     Bug category: {room_data['problem']['mutation_category']}")

    # Step 2: Connect Projector
    projector_ws = await connect(f"{ws_base}/ws/{room_code}/proj_1?role=projector&name=Main+Projector")
    msg = json.loads(await projector_ws.recv())
    assert msg["type"] == "ROOM_STATE"
    print("[OK] Projector connected and received initial ROOM_STATE")

    # Step 3: Connect Player 1
    p1_ws = await connect(f"{ws_base}/ws/{room_code}/p1_client?role=player&name=Alex")
    msg_proj = json.loads(await projector_ws.recv())
    msg_p1 = json.loads(await p1_ws.recv())
    assert len(msg_p1["players"]) == 1
    assert msg_p1["players"][0]["name"] == "Alex"
    print("[OK] Player 1 (Alex) joined room")

    # Step 4: Connect Player 2
    p2_ws = await connect(f"{ws_base}/ws/{room_code}/p2_client?role=player&name=Taylor")
    msg_proj = json.loads(await projector_ws.recv())
    msg_p1 = json.loads(await p1_ws.recv())
    msg_p2 = json.loads(await p2_ws.recv())
    assert len(msg_p2["players"]) == 2
    assert msg_p2["players"][1]["name"] == "Taylor"
    print("[OK] Player 2 (Taylor) joined room")

    # Step 5: Connect Spectator 1
    spec1_ws = await connect(f"{ws_base}/ws/{room_code}/spec_1?role=spectator&name=Sam")
    await projector_ws.recv()
    await p1_ws.recv()
    await p2_ws.recv()
    msg_spec1 = json.loads(await spec1_ws.recv())
    assert msg_spec1["spectator_count"] == 1
    print("[OK] Spectator 1 (Sam) joined. Spectator count: 1")

    # Step 6: Test Auto-Assignment to Spectator when room is full (Player 3)
    p3_ws = await connect(f"{ws_base}/ws/{room_code}/p3_client?role=player&name=Jordan")
    await projector_ws.recv()
    await p1_ws.recv()
    await p2_ws.recv()
    await spec1_ws.recv()
    msg_p3 = json.loads(await p3_ws.recv())
    # Players list should still have only Alex and Taylor
    assert len(msg_p3["players"]) == 2
    assert msg_p3["spectator_count"] == 2
    print("[OK] 3rd player (Jordan) automatically assigned to Spectator!")

    # Step 7: Start Match
    await projector_ws.send(json.dumps({"type": "START_MATCH"}))
    state_after_start = json.loads(await projector_ws.recv())
    await p1_ws.recv()
    await p2_ws.recv()
    await spec1_ws.recv()
    await p3_ws.recv()
    assert state_after_start["status"] == "ACTIVE"
    print("[OK] Match started! Status is ACTIVE")

    # Step 8: Player 1 sends progress update (3/5 tests passed)
    await p1_ws.send(json.dumps({
        "type": "PROGRESS_UPDATE",
        "passed": 3,
        "total": 5,
        "error": None
    }))
    prog_state = json.loads(await projector_ws.recv())
    await p1_ws.recv()
    await p2_ws.recv()
    await spec1_ws.recv()
    await p3_ws.recv()
    assert prog_state["players"][0]["passed"] == 3
    print("[OK] Progress update fanned out: Player 1 has 3/5 tests")

    # Step 9: Spectator votes on prediction (Player 1) and next bug (off_by_one)
    await spec1_ws.send(json.dumps({"type": "SPECTATOR_VOTE", "target": "player_1"}))
    pred_state = json.loads(await projector_ws.recv())
    await p1_ws.recv()
    await p2_ws.recv()
    await spec1_ws.recv()
    await p3_ws.recv()
    assert pred_state["predictions"]["player_1"] == 1
    print("[OK] Spectator prediction registered: Player 1 has 1 vote")

    await spec1_ws.send(json.dumps({"type": "NEXT_BUG_VOTE", "category": "off_by_one"}))
    bug_state = json.loads(await projector_ws.recv())
    await p1_ws.recv()
    await p2_ws.recv()
    await spec1_ws.recv()
    await p3_ws.recv()
    assert bug_state["next_bug_votes"]["off_by_one"] == 1
    print("[OK] Next bug vote registered: off_by_one has 1 vote")

    # Step 10: Player 1 submits win (5/5 tests passed)
    with open("backend/problems.json", "r") as f:
        problems = json.load(f)
    p_meta = next(p for p in problems if p["id"] == room_data["problem"]["id"])
    clean_solution = p_meta["clean_code"]

    await p1_ws.send(json.dumps({
        "type": "SUBMIT_WIN",
        "code": clean_solution,
        "passed": 5,
        "total": 5
    }))
    win_state = json.loads(await projector_ws.recv())
    assert win_state["status"] == "FINISHED"
    assert win_state["winner"]["name"] == "Alex"
    assert "ast_diff" in win_state["winner"]
    print(f"[OK] VICTORY confirmed! Winner: {win_state['winner']['name']} in {win_state['winner']['completion_time']}s")
    print(f"     AST Diff generated:\n{win_state['winner']['ast_diff']}")

    # Clean up
    await projector_ws.close()
    await p1_ws.close()
    await p2_ws.close()
    await spec1_ws.close()
    await p3_ws.close()
    print("=== ALL INTEGRATION CHECKS PASSED ===")

if __name__ == "__main__":
    asyncio.run(test_full_loop())
