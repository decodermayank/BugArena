# CodeDuel: Live 1v1 Debugging & Spectator Arena

> "Mentimeter for Live Competitive Debugging." Zero friction, QR code join, sub-50ms client-side WebAssembly execution (Pyodide), and real-time state synchronization via FastAPI WebSockets.

---

## Architecture Overview

- **Backend**:
  - `backend/problems.json`: 8 clean Python algorithms with comprehensive unit assertions.
  - `backend/ast_mutator.py`: Procedural AST mutation engine (`ast.NodeTransformer`) with comparison operator flips, arithmetic mutations, off-by-one shifts, and condition inverters.
  - `backend/room_manager.py`: In-memory room lifecycle manager, connection pools, and WebSocket fan-out broadcaster.
  - `backend/main.py`: FastAPI application providing REST endpoints (`/api/create-room`, `/api/health`) and real-time WebSockets (`/ws/{room_code}/{client_id}`).
- **Frontend**:
  - `frontend/src/hooks/usePyodide.js`: Safe in-browser Python execution via Pyodide WebAssembly with sub-50ms test runs and zero server RCE risk.
  - `frontend/src/hooks/useWebSocket.js`: Auto-reconnecting WebSocket client with state sync and role assignment.
  - `frontend/src/pages/Home.jsx`: Landing view for creating arenas or joining via room code.
  - `frontend/src/pages/ArenaView.jsx`: Projector/big-screen view with scannable QR code, countdown clock, 1v1 live test bars, spectator prediction tug-of-war, next-bug poll bar chart, and unified AST diff celebration.
  - `frontend/src/pages/PlayerView.jsx`: Split-screen Monaco Editor (`vs-dark`) preloaded with buggy Python code, `Ctrl+Enter` shortcut, and instant test suite feedback.
  - `frontend/src/pages/SpectatorView.jsx`: Mobile-first view with Mentimeter-style live voting (winner prediction and next-round bug category selection).

---

## Quickstart & Local Execution

### 1. Start the FastAPI Backend
Open a terminal in the project root:
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```
*Health check URL: `http://localhost:8000/api/health`*

### 2. Start the Vite Frontend
Open a second terminal in the project root:
```bash
cd frontend
npm run dev
```
*Frontend URL: `http://localhost:5173`*

---

## 4-Tab Verification Sequence

To test the entire real-time competitive loop:

1. **Tab 1 — Projector Arena Screen (`/arena/:roomCode`)**:
   - Go to `http://localhost:5173`.
   - Click **"Launch New Arena"**.
   - You will land on `/arena/:roomCode` (e.g. `X7K9P2`).
   - Notice the scannable QR code, countdown timer, empty player slots, and live event ticker.

2. **Tab 2 — Player 1 (`/play/:roomCode`)**:
   - In a second tab/window, go to `http://localhost:5173`.
   - Enter the room code, enter nickname **"Alex"**, select **Challenger (1v1)**, and click **Join Battle**.
   - Monaco Editor will load the buggy Python code.
   - Projector screen updates in real time: Player 1 slot shows "Alex".

3. **Tab 3 — Player 2 (`/play/:roomCode`)**:
   - In a third tab/window, go to `http://localhost:5173`.
   - Enter the room code, enter nickname **"Taylor"**, select **Challenger (1v1)**, and click **Join Battle**.
   - Projector screen updates: Player 2 slot shows "Taylor".
   - On the Projector screen (Tab 1), click **"Start Match"**.
   - Both players' screens switch to `MATCH ACTIVE` and the timer begins ticking!

4. **Tab 4 — Spectator (`/spectate/:roomCode`)**:
   - In a fourth tab (or mobile phone on the same Wi-Fi scanning the QR code):
   - Enter the room code and join as **Spectator**.
   - Tap **"Alex"** under **"Predict the Winner"** &rarr; Notice the live Tug-of-War bar swing on the Projector!
   - Tap a bug category under **"Vote on Next Bug"** (e.g. "Off-by-One") &rarr; Notice the live bar chart update on the Projector!

5. **Solve the Bug & Trigger Victory**:
   - In Player 1's tab (Alex), examine the bug (e.g. change `i // 15` to `i % 15` or fix the loop bound).
   - Press **Ctrl + Enter** or click **"Run Tests"**.
   - Within &lt;30ms, Pyodide executes all unit assertions in the browser.
   - When all tests pass (5/5), Alex's client submits victory.
   - **Projector triggers celebration confetti**, displays the unified AST diff of the fix, and allows launching the next round based on spectator bug votes!
