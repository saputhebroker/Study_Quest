import { useEffect, useState } from "react";
import "./App.css";
import Cursor from "./Cursor";
import Auth from "./Auth";

const API = "http://localhost:5000";
const TOKEN_KEY = "studyquest_token";

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

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setNotes("");
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
    setError("");
  }

  function handleAuth(newToken, newUser) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setChecking(false);
  }

  // on page load (or login), check that the saved token is still valid
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
        if (!cancelled) setUser(data.user);
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

  function reset() {
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
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
          <span className="xp">{user.xp} XP</span>
          <button className="ghost" onClick={logout}>
            Log out
          </button>
        </header>

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
              onClick={() => setSubmitted(true)}
              disabled={answered < quiz.length}
            >
              Submit answers
            </button>
          </div>
        )}

        {submitted && (
          <div className="result">
            <span>
              {score} / {quiz.length}
            </span>
            <small>+{score * 10} XP</small>
            <button className="ghost" onClick={reset}>
              New quiz
            </button>
          </div>
        )}
      </main>
    </>
  );
}