import { useState } from "react";

const API = "http://localhost:5000";

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/auth/${isLogin ? "login" : "register"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isLogin ? { email, password } : { name, email, password }
          ),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      onAuth(data.token, data.user);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot reach the server. Is it running?"
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m) {
    setMode(m);
    setError("");
  }

  return (
    <main className="app">
      <h1>
        Study <span>Quest</span>
      </h1>
      <p className="sub">Log in to turn your notes into quizzes.</p>

      <div className="auth-card">
        <div className="tabs">
          <button
            type="button"
            className={`tab ${isLogin ? "active" : ""}`}
            onClick={() => switchMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={`tab ${!isLogin ? "active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={submit}>
          {!isLogin && (
            <input
              className="field"
              type="text"
              placeholder="Name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            className="field"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="field"
            type="password"
            placeholder="Password (6+ characters)"
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}