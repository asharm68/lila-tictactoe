import { useRef, useState, useCallback, useEffect } from "react";
import { Client, Session } from "@heroiclabs/nakama-js";

const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || "localhost";
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || "7350";
const NAKAMA_SSL = import.meta.env.VITE_NAKAMA_SSL === "true";
const SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY || "defaultkey";

export type GamePhase = "idle" | "connecting" | "waiting" | "playing" | "game_over";

export interface GameState {
  board: (string | null)[];
  turn: string;
  winner: string | null;
  winReason: string | null;
  myMark: "X" | "O" | null;
  players: { [userId: string]: { username: string; mark: string } };
  lastMove: { position: number; mark: string; player: string } | null;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

const defaultGameState = (): GameState => ({
  board: Array(9).fill(null),
  turn: "",
  winner: null,
  winReason: null,
  myMark: null,
  players: {},
  lastMove: null,
});

export function useNakama() {
  const clientRef = useRef<Client | null>(null);
  const socketRef = useRef<any>(null);
  const sessionRef = useRef<Session | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const myUserIdRef = useRef<string>("");
  const usernameRef = useRef<string>("");

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [gameState, setGameState] = useState<GameState>(defaultGameState());
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myUserId, setMyUserId] = useState<string>("");

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    if (!clientRef.current || !sessionRef.current) return;
    try {
      const res = await clientRef.current.rpc(sessionRef.current, "get_leaderboard", {});
      const payload = res.payload as any;
      const data = typeof payload === "string" ? JSON.parse(payload) : payload;
      setLeaderboard(data.records || []);
    } catch (e) {
      console.error("Leaderboard fetch error:", e);
    }
  }, []);

  const handleMatchData = useCallback((matchData: any) => {
    let data: any;
    try {
      let raw: string;
      if (typeof matchData.data === "string") {
        raw = matchData.data;
      } else {
        raw = new TextDecoder().decode(new Uint8Array(matchData.data));
      }
      data = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse match data", e);
      return;
    }

    const myId = myUserIdRef.current;
    console.log("Match data:", data.type, data);

    switch (data.type) {
      case "waiting":
        setPhase("waiting");
        break;
      case "game_start":
        setPhase("playing");
        setGameState({
          board: data.board,
          turn: data.turn,
          winner: null,
          winReason: null,
          myMark: myId ? data.marks[myId] : null,
          players: Object.fromEntries(
            Object.entries(data.marks as { [id: string]: string }).map(
              ([id, mark]) => [id, { username: data.players[id], mark }]
            )
          ),
          lastMove: null,
        });
        break;
      case "move":
        setGameState((prev) => ({
          ...prev,
          board: data.board,
          turn: data.turn,
          lastMove: data.lastMove,
        }));
        break;
      case "game_over":
        setPhase("game_over");
        setGameState((prev) => ({
          ...prev,
          board: data.board,
          winner: data.winner,
          winReason: data.reason,
        }));
        fetchLeaderboard();
        break;
      case "error":
        showError(data.message);
        break;
    }
  }, [fetchLeaderboard, showError]);

  // Core function: create client + authenticate + connect socket
  const initConnection = useCallback(async (username: string): Promise<boolean> => {
    try {
      // Create client if needed
      if (!clientRef.current) {
        clientRef.current = new Client(SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_SSL);
      }

      // Get or create device ID
      let deviceId = localStorage.getItem("nakama_device_id");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("nakama_device_id", deviceId);
      }

      // Save username
      localStorage.setItem("nakama_username", username);
      usernameRef.current = username;

      // Authenticate
      console.log("Authenticating...", username);
      const session = await clientRef.current.authenticateDevice(deviceId, true, username);
      sessionRef.current = session;
      myUserIdRef.current = session.user_id!;
      setMyUserId(session.user_id!);
      console.log("Authenticated:", session.user_id);

      // Close existing socket if any
      try { if (socketRef.current) socketRef.current.disconnect(false); } catch {}

      // Create fresh socket with 10s timeout
      const socket = clientRef.current.createSocket(NAKAMA_SSL, false, undefined, 10000);
      socket.onmatchdata = handleMatchData;
      socket.ondisconnect = (_evt: any) => {
        console.log("Socket disconnected");
        setPhase((current: GamePhase) => {
          if (current === "game_over" || current === "waiting") return current;
          showError("Disconnected from server");
          return "idle";
        });
      };
      socket.onerror = (_evt: any) => {
        console.error("Socket error");
      };

      console.log("Connecting socket...");
      await socket.connect(session, true);
      socketRef.current = socket;
      console.log("Socket connected!");
      return true;
    } catch (e: any) {
      console.error("initConnection error:", e);
      return false;
    }
  }, [handleMatchData, showError]);

  // Find or create a match
  const findMatch = useCallback(async () => {
    setPhase("waiting");
    try {
      const res = await clientRef.current!.rpc(sessionRef.current!, "find_match", {});
      const payload = res.payload as any;
      const matchId = typeof payload === "string"
        ? JSON.parse(payload).matchId
        : payload.matchId;
      matchIdRef.current = matchId;
      console.log("Joining match:", matchId);
      await socketRef.current!.joinMatch(matchId, undefined, undefined);
      console.log("Joined match!");
    } catch (e: any) {
      console.error("findMatch error:", e);
      showError(e?.message || "Matchmaking failed");
      setPhase("idle");
    }
  }, [showError]);

  // Initial connect from login screen
  const connect = useCallback(async (username: string) => {
    setPhase("connecting");
    setError(null);
    const ok = await initConnection(username);
    if (ok) {
      await findMatch();
    } else {
      showError("Connection failed. Is Nakama running?");
      setPhase("idle");
    }
  }, [initConnection, findMatch, showError]);

  // Play again - reconnect and find new match
  const playAgain = useCallback(async () => {
    matchIdRef.current = null;
    setGameState(defaultGameState());
    setPhase("connecting");

    const username = usernameRef.current || localStorage.getItem("nakama_username") || "Player";
    const ok = await initConnection(username);
    if (ok) {
      await findMatch();
    } else {
      showError("Reconnection failed. Please refresh.");
      setPhase("idle");
    }
  }, [initConnection, findMatch, showError]);

  // Send move
  const sendMove = useCallback(async (position: number) => {
    if (!socketRef.current || !matchIdRef.current) return;
    try {
      await socketRef.current.sendMatchState(matchIdRef.current, 2, JSON.stringify({ position }));
    } catch (e: any) {
      console.error("Send move error:", e);
    }
  }, []);

  // Auto-connect on load if username saved
  useEffect(() => {
    const savedUsername = localStorage.getItem("nakama_username");
    const savedDeviceId = localStorage.getItem("nakama_device_id");
    if (savedUsername && savedDeviceId) {
      connect(savedUsername);
    }
  }, []);

  return { connect, sendMove, playAgain, fetchLeaderboard, phase, gameState, error, leaderboard, myUserId };
}
