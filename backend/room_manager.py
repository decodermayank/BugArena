"""
RoomManager for BugArena.
In-memory room state + 1-to-many WebSocket broadcast fan-out.

Match loop:
  WAITING -> (2 players joined OR host START_MATCH) -> ACTIVE (3 min timer)
  ACTIVE  -> (first player passes all tests OR timer hits 0) -> FINISHED
  FINISHED -> START_NEXT_ROUND (uses winning spectator bug vote) -> ACTIVE
"""

import json
import random
import time
import asyncio
from typing import Dict, List, Optional, Any, Set
from fastapi import WebSocket

MATCH_DURATION_SECONDS = 180
VOTE_CATEGORIES = ["off_by_one", "inverted_condition", "arithmetic"]


class Room:
    def __init__(self, room_code: str, problem: Dict[str, Any]):
        self.room_code = room_code
        self.status = "WAITING"  # WAITING | ACTIVE | FINISHED
        self.problem = problem
        self.round = 1
        self.players: List[Dict[str, Any]] = []  # Max 2 players
        self.spectator_count = 0
        self.predictions = {"player_1": 0, "player_2": 0}
        self.voted_prediction_clients: Set[str] = set()
        self.next_bug_votes = {c: 0 for c in VOTE_CATEGORIES}
        self.voted_bug_clients: Set[str] = set()
        self.event_log: List[str] = [f"Arena {room_code} open. Waiting for 2 challengers."]
        self.winner: Optional[Dict[str, Any]] = None
        self.finish_reason: Optional[str] = None
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.timer_task: Optional[asyncio.Task] = None
        # client_id -> {"ws", "role", "name", "player_index"}
        self.connections: Dict[str, Dict[str, Any]] = {}

    def log_event(self, message: str):
        self.event_log.append(message)
        if len(self.event_log) > 50:
            self.event_log.pop(0)

    def remaining_seconds(self) -> int:
        if self.status == "ACTIVE" and self.start_time:
            return max(0, int(round(MATCH_DURATION_SECONDS - (time.time() - self.start_time))))
        if self.status == "FINISHED" and self.start_time and self.end_time:
            return max(0, int(round(MATCH_DURATION_SECONDS - (self.end_time - self.start_time))))
        return MATCH_DURATION_SECONDS

    def to_dict(self) -> Dict[str, Any]:
        elapsed = 0
        if self.start_time:
            end = self.end_time if self.end_time else time.time()
            elapsed = int(end - self.start_time)

        problem = {
            "id": self.problem.get("id"),
            "title": self.problem.get("title"),
            "description": self.problem.get("description"),
            "function_name": self.problem.get("function_name"),
            "buggy_code": self.problem.get("buggy_code"),
            "test_cases": self.problem.get("test_cases", []),
            "mutation_category": self.problem.get("mutation_category") if self.status == "FINISHED" else None,
            "description_bug": self.problem.get("description_bug") if self.status == "FINISHED" else None,
        }
        if self.status == "FINISHED":
            problem["clean_code"] = self.problem.get("clean_code")
            problem["diff"] = self.problem.get("diff")

        # Do not leak players' full code to everyone; progress only
        players = [
            {k: v for k, v in p.items() if k != "code"} for p in self.players
        ]

        return {
            "type": "ROOM_STATE",
            "room_code": self.room_code,
            "status": self.status,
            "round": self.round,
            "problem": problem,
            "players": players,
            "spectator_count": self.spectator_count,
            "predictions": self.predictions,
            "next_bug_votes": self.next_bug_votes,
            "event_log": self.event_log,
            "winner": self.winner,
            "finish_reason": self.finish_reason,
            "elapsed_seconds": elapsed,
            "remaining_seconds": self.remaining_seconds(),
            "duration_seconds": MATCH_DURATION_SECONDS,
            "start_time": self.start_time,
        }


class RoomManager:
    def __init__(self, problems_path: str):
        self.rooms: Dict[str, Room] = {}
        self.problems_path = problems_path
        self._load_problems()

    def _load_problems(self):
        with open(self.problems_path, "r", encoding="utf-8") as f:
            self.problems = json.load(f)

    def generate_room_code(self) -> str:
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        for _ in range(100):
            code = "".join(random.choices(chars, k=6))
            if code not in self.rooms:
                return code
        return "".join(random.choices(chars, k=6))

    def _build_problem(self, template: Dict[str, Any], category: Optional[str]) -> Dict[str, Any]:
        from ast_mutator import mutate_code

        m = mutate_code(template["clean_code"], preferred_category=category)
        return {
            "id": template["id"],
            "title": template["title"],
            "description": template["description"],
            "function_name": template.get("function_name"),
            "clean_code": template["clean_code"],
            "buggy_code": m["buggy_code"],
            "test_cases": template["test_cases"],
            "mutation_category": m["mutation_category"],
            "description_bug": m["description"],
            "diff": m["diff"],
        }

    def create_room(self, preferred_problem_id: Optional[str] = None, preferred_category: Optional[str] = None) -> Room:
        template = None
        if preferred_problem_id:
            template = next((p for p in self.problems if p["id"] == preferred_problem_id), None)
        if template is None:
            template = random.choice(self.problems)

        room_code = self.generate_room_code()
        room = Room(room_code, self._build_problem(template, preferred_category))
        self.rooms[room_code] = room
        return room

    def get_room(self, room_code: str) -> Optional[Room]:
        return self.rooms.get(room_code.upper())

    # ------------------------------------------------------------------ join
    async def register_connection(
        self,
        room_code: str,
        client_id: str,
        requested_role: str,
        name: str,
        websocket: WebSocket,
    ) -> Dict[str, Any]:
        """
        Roles:
          - 'projector': host big screen
          - 'player' / 'auto': first 2 joiners become players, everyone later a spectator
          - 'spectator': always spectator
        """
        room = self.get_room(room_code)
        if not room:
            raise ValueError(f"Room {room_code} not found")

        requested = (requested_role or "spectator").lower()
        name = (name or "").strip()[:20]
        assigned_role = "spectator"
        player_index = None

        existing_idx = next((i for i, p in enumerate(room.players) if p["id"] == client_id), None)

        if requested == "projector":
            assigned_role = "projector"
            room.log_event("Projector connected")
        elif existing_idx is not None:
            # Reconnection of an existing player
            assigned_role = "player"
            player_index = f"player_{existing_idx + 1}"
            room.players[existing_idx]["connected"] = True
            room.log_event(f"{room.players[existing_idx]['name']} reconnected")
        elif requested in ("player", "auto") and len(room.players) < 2 and room.status != "FINISHED":
            idx = len(room.players)
            player_index = f"player_{idx + 1}"
            assigned_role = "player"
            pname = name or f"Challenger {idx + 1}"
            room.players.append({
                "id": client_id,
                "name": pname,
                "passed": 0,
                "total": len(room.problem["test_cases"]),
                "status": "coding" if room.status == "ACTIVE" else "waiting",
                "error": None,
                "connected": True,
                "last_improve": None,
            })
            room.log_event(f"{pname} joined as Player {idx + 1}")
        else:
            room.log_event(f"{name or 'Someone'} joined the crowd")

        # Replace any stale socket for this client id
        room.connections[client_id] = {
            "ws": websocket,
            "role": assigned_role,
            "name": name,
            "player_index": player_index,
        }
        room.spectator_count = sum(1 for c in room.connections.values() if c["role"] == "spectator")

        # Auto start when both players are in
        if room.status == "WAITING" and len(room.players) == 2:
            self._begin_round(room, "Both challengers in. DUEL STARTS!")

        await self.broadcast(room_code)
        return {"assigned_role": assigned_role, "player_index": player_index, "client_id": client_id}

    async def disconnect(self, room_code: str, client_id: str, websocket: Optional[WebSocket] = None):
        room = self.get_room(room_code)
        if not room:
            return
        conn = room.connections.get(client_id)
        if not conn:
            return
        # A newer socket for the same client replaced this one: ignore stale close
        if websocket is not None and conn["ws"] is not websocket:
            return
        room.connections.pop(client_id, None)

        role = conn.get("role")
        name = conn.get("name") or "Someone"
        if role == "player":
            idx = next((i for i, p in enumerate(room.players) if p["id"] == client_id), None)
            if idx is not None:
                if room.status == "WAITING":
                    # Free the slot (lobby only)
                    room.players.pop(idx)
                    room.log_event(f"{name} left the lobby")
                else:
                    room.players[idx]["connected"] = False
                    room.log_event(f"{room.players[idx]['name']} disconnected")
        room.spectator_count = sum(1 for c in room.connections.values() if c["role"] == "spectator")
        await self.broadcast(room_code)

    # ----------------------------------------------------------------- match
    def _begin_round(self, room: Room, message: str):
        room.status = "ACTIVE"
        room.start_time = time.time()
        room.end_time = None
        room.winner = None
        room.finish_reason = None
        for p in room.players:
            p["status"] = "coding"
            p["passed"] = 0
            p["total"] = len(room.problem["test_cases"])
            p["error"] = None
            p["last_improve"] = None
        room.log_event(message)
        if room.timer_task and not room.timer_task.done():
            room.timer_task.cancel()
        room.timer_task = asyncio.create_task(self._timer(room.room_code, room.start_time))

    async def _timer(self, room_code: str, started_at: float):
        try:
            await asyncio.sleep(MATCH_DURATION_SECONDS + 0.5)
        except asyncio.CancelledError:
            return
        room = self.get_room(room_code)
        if not room or room.status != "ACTIVE" or room.start_time != started_at:
            return
        await self._finish_on_timeout(room)

    async def _finish_on_timeout(self, room: Room):
        room.status = "FINISHED"
        room.end_time = time.time()
        room.finish_reason = "timeout"
        ranked = sorted(
            room.players,
            key=lambda p: (-p.get("passed", 0), p.get("last_improve") or float("inf")),
        )
        if ranked and ranked[0].get("passed", 0) > 0:
            top = ranked[0]
            tied = len(ranked) > 1 and ranked[1].get("passed") == top.get("passed") and \
                ranked[1].get("last_improve") == top.get("last_improve")
            if not tied:
                room.winner = {
                    "id": top["id"],
                    "name": top["name"],
                    "player_index": f"player_{room.players.index(top) + 1}",
                    "completion_time": float(MATCH_DURATION_SECONDS),
                    "passed": top["passed"],
                    "total": top["total"],
                }
                room.log_event(f"TIME UP! {top['name']} wins with {top['passed']}/{top['total']} tests")
            else:
                room.log_event("TIME UP! It's a draw.")
        else:
            room.log_event("TIME UP! Nobody fixed a thing. Draw.")
        for p in room.players:
            p["status"] = "finished"
        await self.broadcast(room.room_code)

    async def handle_start_match(self, room_code: str):
        """Host click: START DUEL (works with 1 or 2 players)."""
        room = self.get_room(room_code)
        if not room or room.status == "ACTIVE":
            return
        if room.status == "FINISHED":
            return
        if len(room.players) < 1:
            room.log_event("Need at least 1 challenger to start")
            await self.broadcast(room_code)
            return
        self._begin_round(room, "Host started the duel. GO!")
        await self.broadcast(room_code)

    def _player(self, room: Room, client_id: str):
        return next((p for p in room.players if p["id"] == client_id), None)

    async def handle_progress_update(self, room_code: str, client_id: str, passed: int, total: int, error: Optional[str] = None):
        room = self.get_room(room_code)
        if not room or room.status != "ACTIVE":
            return
        player = self._player(room, client_id)
        if not player:
            return

        expected_total = len(room.problem["test_cases"])
        try:
            passed = max(0, min(int(passed), expected_total))
        except (TypeError, ValueError):
            return
        total = expected_total

        old = player.get("passed", 0)
        player["passed"] = passed
        player["total"] = total
        player["error"] = (error or None) and str(error)[:200]
        if passed > old or player.get("last_improve") is None:
            player["last_improve"] = time.time()

        if player["error"]:
            line = player["error"].strip().splitlines()[-1] if player["error"].strip() else "Error"
            room.log_event(f"{player['name']} hit {line[:40]}")
        elif passed > old:
            room.log_event(f"{player['name']} passed {passed}/{total} tests")
        else:
            room.log_event(f"{player['name']} ran tests: {passed}/{total}")

        if passed == total:
            await self._declare_winner(room, player, "all_tests")
            return
        await self.broadcast(room_code)

    async def _declare_winner(self, room: Room, player: Dict[str, Any], reason: str, code: str = ""):
        if room.status != "ACTIVE":
            return
        room.status = "FINISHED"
        room.end_time = time.time()
        room.finish_reason = reason
        if room.timer_task and not room.timer_task.done():
            room.timer_task.cancel()
        for p in room.players:
            p["status"] = "finished"
        completion = round(room.end_time - (room.start_time or room.end_time), 2)
        room.winner = {
            "id": player["id"],
            "name": player["name"],
            "player_index": f"player_{room.players.index(player) + 1}",
            "completion_time": completion,
            "passed": player["passed"],
            "total": player["total"],
        }
        room.log_event(f"VICTORY! {player['name']} fixed the bug in {completion}s")
        await self.broadcast(room.room_code)

    async def handle_submit_win(self, room_code: str, client_id: str, code: str, passed: int, total: int):
        # Same as a progress update that passed everything
        await self.handle_progress_update(room_code, client_id, passed, total, None)

    async def handle_spectator_vote(self, room_code: str, client_id: str, target: str):
        room = self.get_room(room_code)
        if not room or client_id in room.voted_prediction_clients:
            return
        if target in room.predictions:
            room.predictions[target] += 1
            room.voted_prediction_clients.add(client_id)
            room.log_event(f"Crowd bets on {'Player 1' if target == 'player_1' else 'Player 2'}")
            await self.broadcast(room_code)

    async def handle_next_bug_vote(self, room_code: str, client_id: str, category: str):
        room = self.get_room(room_code)
        if not room or client_id in room.voted_bug_clients:
            return
        if category in room.next_bug_votes:
            room.next_bug_votes[category] += 1
            room.voted_bug_clients.add(client_id)
            room.log_event(f"Vote for next bug: {category.replace('_', ' ')}")
            await self.broadcast(room_code)

    async def start_next_round(self, room_code: str):
        room = self.get_room(room_code)
        if not room or room.status != "FINISHED":
            return

        winning_cat = max(room.next_bug_votes, key=room.next_bug_votes.get)
        if room.next_bug_votes[winning_cat] == 0:
            winning_cat = random.choice(VOTE_CATEGORIES)

        available = [p for p in self.problems if p["id"] != room.problem["id"]] or self.problems
        # Prefer a problem where the voted bug category can actually be injected
        random.shuffle(available)
        new_problem = None
        for tpl in available:
            candidate = self._build_problem(tpl, winning_cat)
            new_problem = new_problem or candidate
            if candidate["mutation_category"] == winning_cat:
                new_problem = candidate
                break
        room.problem = new_problem
        room.round += 1
        room.predictions = {"player_1": 0, "player_2": 0}
        room.voted_prediction_clients.clear()
        room.next_bug_votes = {c: 0 for c in VOTE_CATEGORIES}
        room.voted_bug_clients.clear()

        self._begin_round(
            room,
            f"ROUND {room.round}: {room.problem['title']} ({winning_cat.replace('_', ' ')} bug, chosen by the crowd)",
        )
        await self.broadcast(room_code)

    # ------------------------------------------------------------- broadcast
    async def broadcast(self, room_code: str):
        room = self.get_room(room_code)
        if not room or not room.connections:
            return

        message = json.dumps(room.to_dict())
        dead = []
        for client_id, conn in list(room.connections.items()):
            try:
                await conn["ws"].send_text(message)
            except Exception:
                dead.append((client_id, conn["ws"]))
        for client_id, ws in dead:
            await self.disconnect(room_code, client_id, ws)
