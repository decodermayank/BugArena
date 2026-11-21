/** Shared WebSocket payload types (mirror backend/room_manager.py). */

export type RequestedRole = 'player' | 'auto' | 'spectator' | 'projector';
export type AssignedRole = 'player' | 'spectator' | 'projector';
export type RoomStatus = 'WAITING' | 'ACTIVE' | 'FINISHED';
export type PlayerSlot = 'player_1' | 'player_2';
export type BugCategory = 'off_by_one' | 'inverted_condition' | 'arithmetic';

export interface TestCase {
  name: string;
  code: string;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  function_name: string | null;
  buggy_code: string;
  test_cases: TestCase[];
  /** Revealed only when the round is FINISHED */
  mutation_category?: string | null;
  description_bug?: string | null;
  clean_code?: string;
  diff?: string;
}

export interface PlayerState {
  id: string;
  name: string;
  passed: number;
  total: number;
  status: 'waiting' | 'coding' | 'finished';
  error: string | null;
  connected: boolean;
}

export interface Winner {
  id: string;
  name: string;
  player_index: PlayerSlot;
  completion_time: number;
  passed: number;
  total: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  round_points: number;
  correct_winner?: boolean;
  correct_bug?: boolean;
}

export interface CrowdCallout {
  headline: string;
  subtitle: string;
  winner_pct: number;
  bug_pct: number;
}

export interface RoomState {
  type: 'ROOM_STATE';
  room_code: string;
  status: RoomStatus;
  round: number;
  problem: Problem;
  players: PlayerState[];
  spectator_count: number;
  predictions: Record<PlayerSlot, number>;
  bug_guesses: Record<BugCategory, number>;
  next_bug_votes: Record<BugCategory, number>;
  leaderboard: LeaderboardEntry[];
  crowd_callout: CrowdCallout | null;
  event_log: string[];
  winner: Winner | null;
  finish_reason: 'all_tests' | 'timeout' | null;
  elapsed_seconds: number;
  remaining_seconds: number;
  duration_seconds: number;
  start_time: number | null;
}

export interface ErrorMessage {
  type: 'ERROR';
  message: string;
}

export interface EmoteReactionMessage {
  type: 'EMOTE_REACTION';
  emote: string;
  sender: string;
}

export type ServerMessage = RoomState | ErrorMessage | EmoteReactionMessage;

export type ClientEvent =
  | { type: 'START_MATCH' }
  | { type: 'START_NEXT_ROUND' }
  | { type: 'PROGRESS_UPDATE'; passed: number; total: number; error: string | null }
  | { type: 'SUBMIT_WIN'; code: string; passed: number; total: number }
  | { type: 'SPECTATOR_VOTE'; target: PlayerSlot }
  | { type: 'BUG_GUESS'; category: BugCategory }
  | { type: 'NEXT_BUG_VOTE'; category: BugCategory }
  | { type: 'EMOTE_REACTION'; emote: string };

export interface SingleTestResult {
  name: string;
  passed: boolean;
  error: string | null;
}

/** What the Pyodide worker returns for each run. */
export interface TestRunResult {
  passed: number;
  total: number;
  error: string | null;
  results: SingleTestResult[];
  logs?: string;
}

export interface CreateRoomResponse {
  room_code: string;
}
