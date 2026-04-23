import { useState, FormEvent } from "react";

interface Props {
  onConnect: (username: string) => void;
  isConnecting: boolean;
}

export function LoginScreen({ onConnect, isConnecting }: Props) {
  const [username, setUsername] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    onConnect(name);
  };

  return (
    <div className="card" style={{ animation: "slideUp 0.4s ease" }}>
      <div className="logo">LILA GAMES</div>
      <h1 className="title">
        TIC<span>TAC</span>TOE
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label" htmlFor="username">
            Enter Callsign
          </label>
          <input
            id="username"
            className="input-field"
            type="text"
            placeholder="PLAYER_001"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            autoFocus
            disabled={isConnecting}
          />
        </div>

        <button
          className="btn"
          type="submit"
          disabled={isConnecting || !username.trim()}
        >
          {isConnecting ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <LoadingDot /> CONNECTING
            </span>
          ) : (
            "FIND MATCH"
          )}
        </button>
      </form>

      <div style={{
        marginTop: 28,
        borderTop: "1px solid #1a3050",
        paddingTop: 20,
        display: "flex",
        gap: 20,
        justifyContent: "center",
      }}>
        {["REAL-TIME", "SERVER AUTH", "LEADERBOARD"].map((tag) => (
          <span
            key={tag}
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10,
              letterSpacing: 2,
              color: "#4a6580",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function LoadingDot() {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        border: "2px solid #00d4ff",
        borderTopColor: "transparent",
        display: "inline-block",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}
