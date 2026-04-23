import { useEffect, useState } from "react";
import { useNakama } from "./hooks/useNakama";
import { LoginScreen } from "./components/LoginScreen";
import { WaitingScreen } from "./components/WaitingScreen";
import { GameBoard } from "./components/GameBoard";
import { GameOverScreen } from "./components/GameOverScreen";
import "./App.css";

export default function App() {
  const {
    connect,
    sendMove,
    playAgain,
    fetchLeaderboard,
    phase,
    gameState,
    error,
    leaderboard,
    myUserId,
  } = useNakama();

  const [autoConnecting, setAutoConnecting] = useState(false);

  // Auto-reconnect if username is saved
  useEffect(() => {
    const savedUsername = localStorage.getItem("nakama_username");
    const savedDeviceId = localStorage.getItem("nakama_device_id");
    if (savedUsername && savedDeviceId && phase === "idle") {
      setAutoConnecting(true);
      connect(savedUsername).finally(() => setAutoConnecting(false));
    }
  }, []);

  return (
    <div className="app-root">
      <div className="scanlines" />
      <div className="grid-bg" />

      {error && (
        <div className="error-toast">
          <span>⚠</span> {error}
        </div>
      )}

      {phase === "idle" || phase === "connecting" ? (
        <LoginScreen
          onConnect={connect}
          isConnecting={phase === "connecting" || autoConnecting}
        />
      ) : phase === "waiting" ? (
        <WaitingScreen />
      ) : phase === "playing" ? (
        <GameBoard
          gameState={gameState}
          myUserId={myUserId}
          onMove={sendMove}
        />
      ) : phase === "game_over" ? (
        <GameOverScreen
          gameState={gameState}
          myUserId={myUserId}
          leaderboard={leaderboard}
          onPlayAgain={playAgain}
          onFetchLeaderboard={fetchLeaderboard}
        />
      ) : null}
    </div>
  );
}
