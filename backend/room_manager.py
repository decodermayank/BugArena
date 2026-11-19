"""
RoomManager for CodeDuel.
Manages in-memory room states, connection pools, and real-time broadcast fan-out.
Structured with clean separation so it can be swapped with Redis Pub/Sub if needed.
"""

import json
import random
import string
import time
import asyncio
from typing import Dict, List, Optional, Any, Set
from fastapi import WebSocket


class Room:
    def __init__(self, room_code: str, problem: Dict[str, Any]):
        self.room_code = room_code
        self.status = "WAITING"  # WAITING | ACTIVE | FINISHED
        self.problem = problem
        self.players: List[Dict[str, Any]] = []  # Max 2 players
        self.spectator_count = 0
        self.predictions = {"player_1": 0, "player_2": 0}
        self.voted_prediction_clients: Set[str] = set()
        self.next_bug_votes = {
            "off_by_one": 0,
            "inverted_condition": 0,
            "arithmetic": 0,
            "comparison": 0
        }
        self.voted_bug_clients: Set[str] = set()
        self.event_log: List[str] = [f"Arena {room_code} initialized. Waiting for challengers!"]
        self.winner: Optional[Dict[str, Any]] = None
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None

        # client_id -> {"ws": WebSocket, "role": str, "name": str}
        self.connections: Dict[str, Dict[str, Any]] = {}

    def log_event(self, message: str):
        self.event_log.append(message)
        if len(self.event_log) > 50:
            self.event_log.pop(0)

    def to_dict(self) -> Dict[str, Any]:
        elapsed = 0
        if self.start_time:
            end = self.end_time if self.end_time else time.time()
            elapsed = int(end - self.start_time)

        # Do not leak clean_code in problem to clients during match, but provide buggy_code and test cases
        sanitized_problem = {
            "id": self.problem.get("id"),
            "title": self.problem.get("title"),
            "description": self.problem.get("description"),
            "function_name": self.problem.get("function_name"),
            "buggy_code": self.problem.get("buggy_code"),
            "test_cases": self.problem.get("test_cases", []),
            "mutation_category": self.problem.get("mutation_category"),
            "description_bug": self.problem.get("description_bug")
        }

        # If finished, reveal diff / clean solution
        if self.status == "FINISHED":
            sanitized_problem["clean_code"] = self.problem.get("clean_code")
            sanitized_problem["diff"] = self.problem.get("diff")

        return {
            "type": "ROOM_STATE",
            "room_code": self.room_code,
            "status": self.status,
            "problem": sanitized_problem,
            "players": self.players,
            "spectator_count": self.spectator_count,
            "predictions": self.predictions,
            "next_bug_votes": self.next_bug_votes,
            "event_log": self.event_log,
            "winner": self.winner,
            "elapsed_seconds": elapsed,
            "start_time": self.start_time
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

    def create_room(self, preferred_problem_id: Optional[str] = None, preferred_category: Optional[str] = None) -> Room:
        from ast_mutator import mutate_code

        # Pick problem
        if preferred_problem_id:
            problem_template = next((p for p in self.problems if p["id"] == preferred_problem_id), None)
        else:
            problem_template = random.choice(self.problems)

        if not problem_template:
            problem_template = self.problems[0]

        # Procedurally inject bug
        mutation_result = mutate_code(problem_template["clean_code"], preferred_category=preferred_category)

        problem_data = {
            "id": problem_template["id"],
            "title": problem_template["title"],
            "description": problem_template["description"],
            "function_name": problem_template.get("function_name"),
            "clean_code": problem_template["clean_code"],
            "buggy_code": mutation_result["buggy_code"],
            "test_cases": problem_template["test_cases"],
            "mutation_category": mutation_result["mutation_category"],
            "description_bug": mutation_result["description"],
            "diff": mutation_result["diff"]
        }

        room_code = self.generate_room_code()
        room = Room(room_code, problem_data)
        self.rooms[room_code] = room
        return room

    def get_room(self, room_code: str) -> Optional[Room]:
        return self.rooms.get(room_code.upper())

    async def register_connection(
        self,
        room_code: str,
        client_id: str,
        requested_role: str,
        name: str,
        websocket: WebSocket
    ) -> Dict[str, Any]:
        """
        Registers a connection to the room.
        Auto-assigns role:
          - If requested 'player' and fewer than 2 players exist (or client reconnects), assign player.
          - Otherwise, fallback to 'spectator'.
        """
        room = self.get_room(room_code)
        if not room:
            raise ValueError(f"Room {room_code} not found")

        assigned_role = requested_role.lower()
        player_index = None

        if assigned_role == "player":
            # Check if this client is already registered as an existing player (reconnection)
            existing_player_idx = next(
                (i for i, p in enumerate(room.players) if p["id"] == client_id),
                None
            )
            if existing_player_idx is not None:
                player_index = f"player_{existing_player_idx + 1}"
                room.players[existing_player_idx]["name"] = name
                room.log_event(f"Player {name} reconnected ({player_index})")
            elif len(room.players) < 2:
                # Assign new slot
                idx = len(room.players)
                player_index = f"player_{idx + 1}"
                room.players.append({
                    "id": client_id,
                    "name": name or f"Challenger {idx + 1}",
                    "passed": 0,
                    "total": len(room.problem["test_cases"]),
                    "status": "coding" if room.status == "ACTIVE" else "waiting",
                    "code": room.problem["buggy_code"],
                    "error": None
                })
                room.log_event(f"{name or 'Player'} joined as {player_index.replace('_', ' ').title()}")
            else:
                # 2 players already present: Auto-assign to spectator!
                assigned_role = "spectator"
                room.log_event(f"{name} joined as Spectator (Players arena is full)")
        elif assigned_role == "projector":
            room.log_event(f"Projector screen connected")
        else:
            assigned_role = "spectator"
            room.log_event(f"Spectator {name or 'Anonymous'} tuned in")

        room.connections[client_id] = {
            "ws": websocket,
            "role": assigned_role,
            "name": name,
            "player_index": player_index
        }

        # Update spectator count
        room.spectator_count = sum(1 for c in room.connections.values() if c["role"] == "spectator")

        await self.broadcast(room_code)

        return {
            "assigned_role": assigned_role,
            "player_index": player_index,
            "client_id": client_id
        }

    async def disconnect(self, room_code: str, client_id: str):
        room = self.get_room(room_code)
        if not room:
            return

        conn = room.connections.pop(client_id, None)
        if conn:
            role = conn.get("role")
            name = conn.get("name", "Someone")
            if role == "spectator":
                room.spectator_count = max(0, room.spectator_count - 1)
            elif role == "player":
                room.log_event(f"Player {name} disconnected")
            await self.broadcast(room_code)

    async def handle_start_match(self, room_code: str):
        room = self.get_room(room_code)
        if not room:
            return
        if len(room.players) < 1:
            room.log_event("Cannot start match: At least 1 player required")
            await self.broadcast(room_code)
            return

        room.status = "ACTIVE"
        room.start_time = time.time()
        room.end_time = None
        room.winner = None
        for p in room.players:
            p["status"] = "coding"
            p["passed"] = 0
            p["error"] = None

        room.log_event("Match STARTED! Clock is ticking!")
        await self.broadcast(room_code)

    async def handle_progress_update(self, room_code: str, client_id: str, passed: int, total: int, error: Optional[str] = None):
        room = self.get_room(room_code)
        if not room or room.status != "ACTIVE":
            return

        player = next((p for p in room.players if p["id"] == client_id), None)
        if not player:
            return

        old_passed = player.get("passed", 0)
        player["passed"] = passed
        player["total"] = total
        player["error"] = error

        if error:
            # Short error summary
            first_err_line = error.strip().splitlines()[-1] if error.strip() else "Error"
            room.log_event(f"{player['name']} encountered {first_err_line[:40]}")
        elif passed > old_passed:
            room.log_event(f"{player['name']} passed {passed}/{total} tests!")

        await self.broadcast(room_code)

    async def handle_submit_win(self, room_code: str, client_id: str, code: str, passed: int, total: int):
        room = self.get_room(room_code)
        if not room or room.status != "ACTIVE":
            return

        player = next((p for p in room.players if p["id"] == client_id), None)
        if not player:
            return

        player["passed"] = passed
        player["total"] = total
        player["code"] = code
        player["status"] = "finished"

        if passed == total and room.winner is None:
            # Win condition satisfied!
            room.status = "FINISHED"
            room.end_time = time.time()
            completion_time = round(room.end_time - (room.start_time or room.end_time), 2)

            from ast_mutator import generate_diff
            ast_diff = generate_diff(room.problem["buggy_code"], code)

            room.winner = {
                "id": player["id"],
                "name": player["name"],
                "completion_time": completion_time,
                "ast_diff": ast_diff,
                "final_code": code
            }
            room.log_event(f"VICTORY! {player['name']} solved the bug in {completion_time}s!")

        await self.broadcast(room_code)

    async def handle_spectator_vote(self, room_code: str, client_id: str, target: str):
        room = self.get_room(room_code)
        if not room:
            return

        if client_id in room.voted_prediction_clients:
            return  # 1 vote per client

        if target in room.predictions:
            room.predictions[target] += 1
            room.voted_prediction_clients.add(client_id)
            target_label = "Player 1" if target == "player_1" else "Player 2"
            room.log_event(f"Spectator predicted {target_label} to win!")
            await self.broadcast(room_code)

    async def handle_next_bug_vote(self, room_code: str, client_id: str, category: str):
        room = self.get_room(room_code)
        if not room:
            return

        if client_id in room.voted_bug_clients:
            return

        if category in room.next_bug_votes:
            room.next_bug_votes[category] += 1
            room.voted_bug_clients.add(client_id)
            room.log_event(f"Vote cast for next bug: {category.replace('_', ' ').title()}")
            await self.broadcast(room_code)

    async def start_next_round(self, room_code: str):
        """
        Takes the winning bug category voted by spectators, picks a new problem,
        injects the new mutation, and resets scores for the next round.
        """
        room = self.get_room(room_code)
        if not room:
            return

        # Determine winning next bug category
        winning_cat = max(room.next_bug_votes, key=room.next_bug_votes.get)
        if room.next_bug_votes[winning_cat] == 0:
            winning_cat = random.choice(list(room.next_bug_votes.keys()))

        # Select a problem different from current if possible
        available = [p for p in self.problems if p["id"] != room.problem["id"]]
        if not available:
            available = self.problems
        problem_template = random.choice(available)

        from ast_mutator import mutate_code
        mutation_result = mutate_code(problem_template["clean_code"], preferred_category=winning_cat)

        room.problem = {
            "id": problem_template["id"],
            "title": problem_template["title"],
            "description": problem_template["description"],
            "function_name": problem_template.get("function_name"),
            "clean_code": problem_template["clean_code"],
            "buggy_code": mutation_result["buggy_code"],
            "test_cases": problem_template["test_cases"],
            "mutation_category": mutation_result["mutation_category"],
            "description_bug": mutation_result["description"],
            "diff": mutation_result["diff"]
        }

        room.status = "ACTIVE"
        room.start_time = time.time()
        room.end_time = None
        room.winner = None
        room.predictions = {"player_1": 0, "player_2": 0}
        room.voted_prediction_clients.clear()
        room.next_bug_votes = {k: 0 for k in room.next_bug_votes}
        room.voted_bug_clients.clear()

        for p in room.players:
            p["status"] = "coding"
            p["passed"] = 0
            p["total"] = len(room.problem["test_cases"])
            p["error"] = None
            p["code"] = room.problem["buggy_code"]

        room.log_event(f"ROUND 2: {room.problem['title']} with {winning_cat.replace('_', ' ')} bug!")
        await self.broadcast(room_code)

    async def broadcast(self, room_code: str):
        room = self.get_room(room_code)
        if not room or not room.connections:
            return

        payload = room.to_dict()
        message = json.dumps(payload)

        dead_connections = []
        for client_id, conn in list(room.connections.items()):
            ws = conn["ws"]
            try:
                await ws.send_text(message)
            except Exception:
                dead_connections.append(client_id)

        for client_id in dead_connections:
            await self.disconnect(room_code, client_id)
