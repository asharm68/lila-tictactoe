export function WaitingScreen() {
  return (
    <div className="card" style={{ textAlign: "center", animation: "slideUp 0.4s ease" }}>
      <div className="logo">MATCHMAKING</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2, marginBottom: 32, color: "#fff" }}>
        FINDING OPPONENT
      </h2>

      {/* Animated radar */}
      <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 32px" }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              inset: `${i * 20}px`,
              border: "1px solid rgba(0, 212, 255, 0.3)",
              borderRadius: "50%",
              animation: `pulse 2s ease ${i * 0.4}s infinite`,
            }}
          />
        ))}
        <div style={{
          position: "absolute",
          inset: "50%",
          transform: "translate(-50%,-50%)",
          width: 12,
          height: 12,
          background: "var(--accent)",
          borderRadius: "50%",
          boxShadow: "0 0 20px var(--accent)",
          animation: "pulse 1s ease infinite",
        }} />
      </div>

      <p style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 12,
        color: "#4a6580",
        letterSpacing: 2,
        animation: "pulse 2s ease infinite",
      }}>
        SCANNING FOR PLAYERS...
      </p>

      <p style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 11,
        color: "#2a3a4a",
        marginTop: 8,
      }}>
        Usually takes 10–30 seconds
      </p>
    </div>
  );
}
