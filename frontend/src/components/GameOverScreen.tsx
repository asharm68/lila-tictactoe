import { useEffect } from "react";
import { GameState, LeaderboardEntry } from "../hooks/useNakama";

interface Props {
  gameState: GameState;
  myUserId: string;
  leaderboard: LeaderboardEntry[];
  onPlayAgain: () => void;
  onFetchLeaderboard: () => void;
}

export function GameOverScreen({
  gameState,
  myUserId,
  leaderboard,
  onPlayAgain,
  onFetchLeaderboard,
}: Props) {
  const { winner, winReason, board, players } = gameState;

  useEffect(() => {
    onFetchLeaderboard();
  }, []);

  const isDraw = winner === "draw";
  const isDisconnect = winReason === "opponent_disconnected";
  const iWon = winner === myUserId;

  const resultLabel = isDraw
    ? "DRAW"
    : isDisconnect
    ? "OPPONENT LEFT"
    : iWon
    ? "VICTORY"
    : "DEFEAT";

  const resultColor = isDraw
    ? "var(--accent3)"
    : iWon || isDisconnect
    ? "var(--accent)"
    : "var(--accent2)";

  const winnerName = winner && !isDraw && winner !== "disconnect"
    ? players[winner]?.username ?? "Unknown"
    : null;

  return (
    <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 420, padding: "0 12px" }}>
      {/* Result card */}
      <div className="card" style={{ marginBottom: 12, animation: "slideUp 0.3s ease", textAlign: "center" }}>
        {/* Big result */}
        <div style={{
          fontSize: 48,
          fontWeight: 700,
          letterSpacing: 4,
          color: resultColor,
          textShadow: `0 0 30px ${resultColor}`,
          marginBottom: 8,
          fontFamily: "'Rajdhani', sans-serif",
        }}>
          {resultLabel}
        </div>

        {winnerName && (
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 12,
            color: "var(--text-dim)",
            letterSpacing: 2,
            marginBottom: 20,
          }}>
            {iWon ? "YOU WIN" : `${winnerName} WINS`}
          </div>
        )}

        {/* Mini board replay */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 4,
          width: 150,
          margin: "0 auto 24px",
          opacity: 0.7,
        }}>
          {board.map((cell, i) => (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontFamily: "'Share Tech Mono', monospace",
                color: cell === "X" ? "var(--x-color)" : cell === "O" ? "var(--o-color)" : "transparent",
              }}
            >
              {cell}
            </div>
          ))}
        </div>

        <button className="btn" onClick={onPlayAgain}>
          PLAY AGAIN
        </button>
      </div>

      {/* Leaderboard */}
      <div className="card" style={{ animation: "slideUp 0.5s ease" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}>
          <span style={{ color: "var(--accent)", fontSize: 16 }}>◆</span>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 11,
            letterSpacing: 3,
            color: "var(--text-dim)",
          }}>
            GLOBAL LEADERBOARD
          </span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 12,
            color: "var(--text-dim)",
            textAlign: "center",
            padding: "20px 0",
          }}>
            No records yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {leaderboard.slice(0, 10).map((entry, idx) => (
              <LeaderboardRow
                key={entry.userId}
                entry={entry}
                rank={idx + 1}
                isMe={entry.userId === myUserId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  rank,
  isMe,
}: {
  entry: LeaderboardEntry;
  rank: number;
  isMe: boolean;
}) {
  const rankColor =
    rank === 1 ? "#ffd700" : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : "var(--text-dim)";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 10px",
      background: isMe ? "rgba(0, 212, 255, 0.06)" : "transparent",
      border: isMe ? "1px solid rgba(0, 212, 255, 0.2)" : "1px solid transparent",
      borderRadius: 2,
    }}>
      <span style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 12,
        color: rankColor,
        width: 24,
        textAlign: "center",
        fontWeight: 700,
      }}>
        {rank <= 3 ? ["①", "②", "③"][rank - 1] : `${rank}`}
      </span>

      <span style={{
        flex: 1,
        fontSize: 14,
        fontWeight: 600,
        color: isMe ? "var(--accent)" : "var(--text)",
      }}>
        {entry.username}
        {isMe && (
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 9,
            color: "var(--accent)",
            marginLeft: 6,
            letterSpacing: 1,
          }}>
            [YOU]
          </span>
        )}
      </span>

      <span style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 13,
        color: "var(--text)",
        fontWeight: 700,
      }}>
        {entry.score}
        <span style={{ fontSize: 9, color: "var(--text-dim)", marginLeft: 3 }}>PTS</span>
      </span>
    </div>
  );
}
