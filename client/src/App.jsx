import { useEffect, useState } from "react";
import "./App.css";
import Cursor from "./Cursor";
import Auth from "./Auth";

const API = "http://localhost:5000";
const TOKEN_KEY = "studyquest_token";

// local date as "YYYY-MM-DD", offset in days
function localDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(
    () => !!localStorage.getItem(TOKEN_KEY)
  );

  const [notes, setNotes] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [history, setHistory] = useState([]);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setNotes("");
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
    setError("");
    setSaved(null);
    setSaveMsg("");
    setHistory([]);
  }

  function handleAuth(newToken, newUser) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setChecking(false);
  }

  async function loadHistory(tok) {
    try {
      const res = await fetch(`${API}/api/progress/history`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history);
      }
    } catch {
      // history is optional, so ignore errors
    }
  }

  // check that the saved token is still valid
  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("bad token");
        const data = await res.json();
        if (!cancelled) {
          setUser(data.user);
          loadHistory(token);
        }
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function generate() {
    setLoading(true);
    setError("");
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
    setSaved(null);
    setSaveMsg("");
    try {
      const res = await fetch(`${API}/api/quiz/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes }),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setQuiz(data.questions);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswers() {
    setSubmitted(true);
    setSaveMsg("");

    const results = quiz.map((q, i) => ({
      question: String(q.question),
      options: q.options.map(String),
      answerIndex: q.answerIndex,
      chosenIndex: answers[i] ?? null,
      explanation: String(q.explanation || ""),
    }));

    try {
      const res = await fetch(`${API}/api/progress/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ results, localDate: localDate() }),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save progress.");
      setUser(data.user);
      setSaved({ xpGained: data.xpGained });
      loadHistory(token);
    } catch (e) {
      setSaveMsg(
        e.message === "Failed to fetch" ? "Could not save progress." : e.message
      );
    }
  }

  function reset() {
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
    setSaved(null);
    setSaveMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (checking) {
    return (
      <>
        <Cursor />
        <main className="app">
          <p className="sub">Loading...</p>
        </main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Cursor />
        <Auth onAuth={handleAuth} />
      </>
    );
  }

  const wordCount = notes.trim() ? notes.trim().split(/\s+/).length : 0;
  const answered = Object.keys(answers).length;
  const progress = quiz ? (answered / quiz.length) * 100 : 0;
  const score = quiz
    ? quiz.filter((q, i) => answers[i] === q.answerIndex).length
    : 0;

  const level = Math.floor(user.xp / 100) + 1;
  const levelPct = user.xp % 100;
  const liveStreak =
    user.lastActiveDate === localDate() ||
    user.lastActiveDate === localDate(-1)
      ? user.streak
      : 0;

  return (
    <>
      <Cursor />

      {quiz && (
        <div className="progress">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}

      <main className="app">
        <header className="topbar">
          <span className="who">{user.name}</span>
          <span className="chip">Lv {level}</span>
          <span className="xp">{user.xp} XP</span>
          <span className="streak">{liveStreak} day streak</span>
          <button className="ghost" onClick={logout}>
            Log out
          </button>
        </header>
        <div className="levelbar">
          <div style={{ width: `${levelPct}%` }} />
        </div>

        <h1>
          Study <span>Quest</span>
        </h1>
        <p className="sub">Paste your notes. Get a quiz.</p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste your study notes here..."
        />

        <div className="row">
          <span className="count">{wordCount} words</span>
          <button
            className="primary"
            onClick={generate}
            disabled={loading || notes.trim().length < 50}
          >
            {loading ? "Generating..." : "Generate quiz"}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {quiz && (
          <p className="meta">
            {quiz.length} questions &middot; {answered} answered
          </p>
        )}

        {quiz &&
          quiz.map((q, i) => (
            <section
              className="card"
              key={i}
              style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
            >
              <h3>
                {i + 1}. {q.question}
              </h3>
              {q.options.map((opt, j) => {
                let cls = "option";
                if (answers[i] === j) cls += " selected";
                if (submitted && j === q.answerIndex) cls += " correct";
                if (submitted && answers[i] === j && j !== q.answerIndex)
                  cls += " wrong";
                return (
                  <button
                    key={j}
                    className={cls}
                    disabled={submitted}
                    onClick={() => setAnswers({ ...answers, [i]: j })}
                  >
                    {opt}
                  </button>
                );
              })}
              {submitted && <p className="explain">{q.explanation}</p>}
            </section>
          ))}

        {quiz && !submitted && (
          <div className="row">
            <span className="count">
              {answered < quiz.length
                ? `${quiz.length - answered} left to answer`
                : "All answered"}
            </span>
            <button
              className="primary"
              onClick={submitAnswers}
              disabled={answered < quiz.length}
            >
              Submit answers
            </button>
          </div>
        )}

        {submitted && (
          <>
            <div className="result">
              <span>
                {score} / {quiz.length}
              </span>
              <small>+{saved ? saved.xpGained : score * 10} XP</small>
              <button className="ghost" onClick={reset}>
                New quiz
              </button>
            </div>
            {saveMsg && <p className="savemsg">{saveMsg}</p>}
          </>
        )}

        {history.length > 0 && (
          <section className="history">
            <p className="meta">Recent quizzes</p>
            {history.map((h) => (
              <div className="hrow" key={h._id}>
                <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                <span>
                  {h.score} / {h.total}
                </span>
                <span className="xp">+{h.xpGained} XP</span>
              </div>
            ))}
          </section>
        )}
      </main>
    </>
  );
}