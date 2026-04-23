import { GameState } from "../hooks/useNakama";

interface Props {
  gameState: GameState;
  myUserId: string;
  onMove: (pos: number) => void;
}

export function GameBoard({ gameState, myUserId, onMove }: Props) {
  const { board, turn, myMark, players, lastMove } = gameState;
  const isMyTurn = turn === myUserId;

  const getPlayerName = (userId: string) =>
    players[userId]?.username ?? "Unknown";

  const opponent = Object.keys(players).find((id) => id !== myUserId);
  const opponentName = opponent ? getPlayerName(opponent) : "—";
  const myName = players[myUserId]?.username ?? "You";

  return (
    <div style={{ animation: "slideUp 0.3s ease", position: "relative", zIndex: 2 }}>
      {/* Header bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
        padding: "12px 16px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 2,
      }}>
        <PlayerChip
          name={myName}
          mark={myMark ?? "X"}
          active={isMyTurn}
          isMe
        />
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 12,
          color: "var(--text-dim)",
          letterSpacing: 2,
        }}>
          VS
        </div>
        <PlayerChip
          name={opponentName}
          mark={myMark === "X" ? "O" : "X"}
          active={!isMyTurn}
          isMe={false}
        />
      </div>

      {/* Turn indicator */}
      <div style={{
        textAlign: "center",
        marginBottom: 16,
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 12,
        letterSpacing: 3,
        color: isMyTurn ? "var(--accent)" : "var(--text-dim)",
        transition: "color 0.3s",
      }}>
        {isMyTurn ? "► YOUR TURN" : "WAITING FOR OPPONENT..."}
      </div>

      {/* Board */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
        width: 300,
        margin: "0 auto 20px",
      }}>
        {board.map((cell, i) => (
          <Cell
            key={i}
            value={cell}
            index={i}
            isLastMove={lastMove?.position === i}
            disabled={!isMyTurn || cell !== null}
            onClick={() => onMove(i)}
          />
        ))}
      </div>

      {/* Score hint */}
      <div style={{
        textAlign: "center",
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 10,
        color: "var(--text-dim)",
        letterSpacing: 2,
      }}>
        SERVER-AUTHORITATIVE · ALL MOVES VALIDATED
      </div>
    </div>
  );
}

// ─── Cell ───────────────────────────────────────────────────────────────────

interface CellProps {
  value: string | null;
  index: number;
  isLastMove: boolean;
  disabled: boolean;
  onClick: () => void;
}

function Cell({ value, isLastMove, disabled, onClick }: CellProps) {
  const isX = value === "X";
  const isO = value === "O";
  const color = isX ? "var(--x-color)" : isO ? "var(--o-color)" : undefined;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        aspectRatio: "1",
        background: isLastMove
          ? "rgba(0, 212, 255, 0.08)"
          : "var(--surface2)",
        border: `1px solid ${isLastMove ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 2,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 42,
        fontWeight: 700,
        fontFamily: "'Share Tech Mono', monospace",
        color,
        textShadow: color ? `0 0 20px ${color}` : undefined,
        transition: "all 0.15s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--accent)";
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(0, 212, 255, 0.05)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = isLastMove
            ? "var(--accent)"
            : "var(--border)";
          (e.currentTarget as HTMLButtonElement).style.background = isLastMove
            ? "rgba(0, 212, 255, 0.08)"
            : "var(--surface2)";
        }
      }}
    >
      {value && (
        <span style={{ animation: "slideUp 0.2s ease" }}>{value}</span>
      )}
    </button>
  );
}

// ─── Player chip ─────────────────────────────────────────────────────────────

interface ChipProps {
  name: string;
  mark: string;
  active: boolean;
  isMe: boolean;
}

function PlayerChip({ name, mark, active, isMe }: ChipProps) {
  const color = mark === "X" ? "var(--x-color)" : "var(--o-color)";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      opacity: active ? 1 : 0.4,
      transition: "opacity 0.3s",
    }}>
      <span style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 20,
        color,
        textShadow: active ? `0 0 12px ${color}` : "none",
        transition: "text-shadow 0.3s",
      }}>
        {mark}
      </span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{name}</div>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 9,
          color: isMe ? "var(--accent)" : "var(--text-dim)",
          letterSpacing: 2,
        }}>
          {isMe ? "YOU" : "OPPONENT"}
        </div>
      </div>
    </div>
  );
}
