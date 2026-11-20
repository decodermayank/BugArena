"""
FastAPI Backend for BugArena (Live 1v1 Debugging & Spectator Arena).
Provides REST APIs for room creation & health, and native WebSockets for real-time match state synchronization.
"""

import os
import json
import logging
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from room_manager import RoomManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("BugArena")

app = FastAPI(title="BugArena API", version="1.0.0")

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROBLEMS_PATH = os.path.join(os.path.dirname(__file__), "problems.json")
room_manager = RoomManager(problems_path=PROBLEMS_PATH)


class CreateRoomRequest(BaseModel):
    problem_id: Optional[str] = None
    preferred_category: Optional[str] = None


@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "BugArena Backend"}


@app.get("/api/problems")
async def list_problems():
    return [
        {
            "id": p["id"],
            "title": p["title"],
            "description": p["description"]
        }
        for p in room_manager.problems
    ]


@app.post("/create-room")
@app.post("/api/create-room")
async def create_room(req: Optional[CreateRoomRequest] = None):
    problem_id = req.problem_id if req else None
    preferred_category = req.preferred_category if req else None

    room = room_manager.create_room(
        preferred_problem_id=problem_id,
        preferred_category=preferred_category
    )
    logger.info(f"Created arena room: {room.room_code}")
    return room.to_dict()


@app.get("/api/room/{room_code}")
async def get_room_state(room_code: str):
    room = room_manager.get_room(room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room.to_dict()


@app.websocket("/ws/{room_code}/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    client_id: str,
    role: str = Query(default="spectator"),
    name: str = Query(default="")
):
    await websocket.accept()
    room_code_upper = room_code.upper()
    room = room_manager.get_room(room_code_upper)

    if not room:
        await websocket.send_text(json.dumps({
            "type": "ERROR",
            "message": f"Room {room_code_upper} does not exist"
        }))
        await websocket.close()
        return

    try:
        connection_info = await room_manager.register_connection(
            room_code=room_code_upper,
            client_id=client_id,
            requested_role=role,
            name=name,
            websocket=websocket
        )
        logger.info(f"Client {client_id} connected to {room_code_upper} as {connection_info['assigned_role']}")

        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                continue

            event_type = data.get("type")

            if event_type == "START_MATCH":
                await room_manager.handle_start_match(room_code_upper)

            elif event_type == "PROGRESS_UPDATE":
                passed = data.get("passed", 0)
                total = data.get("total", 0)
                error = data.get("error")
                await room_manager.handle_progress_update(
                    room_code_upper,
                    client_id,
                    passed=passed,
                    total=total,
                    error=error
                )

            elif event_type == "SUBMIT_WIN":
                code = data.get("code", "")
                passed = data.get("passed", 0)
                total = data.get("total", 0)
                await room_manager.handle_submit_win(
                    room_code_upper,
                    client_id,
                    code=code,
                    passed=passed,
                    total=total
                )

            elif event_type == "SPECTATOR_VOTE":
                target = data.get("target")  # "player_1" or "player_2"
                if target:
                    await room_manager.handle_spectator_vote(room_code_upper, client_id, target)

            elif event_type == "BUG_GUESS":
                category = data.get("category")
                if category:
                    await room_manager.handle_bug_guess(room_code_upper, client_id, category)

            elif event_type == "NEXT_BUG_VOTE":
                category = data.get("category")
                if category:
                    await room_manager.handle_next_bug_vote(room_code_upper, client_id, category)

            elif event_type == "START_NEXT_ROUND":
                await room_manager.start_next_round(room_code_upper)

    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected from {room_code_upper}")
        await room_manager.disconnect(room_code_upper, client_id, websocket)
    except Exception as e:
        logger.error(f"Error in websocket loop for {client_id}: {e}")
        await room_manager.disconnect(room_code_upper, client_id, websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
